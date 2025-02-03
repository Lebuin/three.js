import { Geometries } from '@/lib/geom/geometries';
import { Board } from '@/lib/model/parts/board';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { MaterialObject } from '../part-objects/material-object';
import { Renderer } from '../renderer';
import { MouseHandler, MouseHandlerEvent } from './mouse-handler';
import { ToolHandler } from './tool-handler';

interface BoardPoint {
  point: THREE.Vector3;
  centerAligned: boolean;
}

export class BoardToolHandler extends ToolHandler {
  readonly tool = 'board';

  private mouseHandler: MouseHandler;

  private points: BoardPoint[] = [];
  private fleetingPoint?: BoardPoint;
  private fleetingBoard?: MaterialObject;

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(renderer);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.mouseHandler.delete();
    this.removeFleetingBoard();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
  }

  private onMouseMove = (event: MouseHandlerEvent) => {
    this.fleetingPoint = this.createBoardPoint(event);
    this.updateFleetingBoard();
  };

  private onClick = (event: MouseHandlerEvent) => {
    const boardPoint = this.createBoardPoint(event);
    this.points.push(boardPoint);
    this.fleetingPoint = undefined;

    this.updateFleetingBoard();

    if (this.points.length === 1) {
      this.mouseHandler.targetFinder.setNeighborPoint(boardPoint.point);
    } else if (this.points.length === 2) {
      const planeNormal = this.points[1].point
        .clone()
        .sub(this.points[0].point)
        .normalize();
      this.mouseHandler.targetFinder.setConstraintPlane(
        planeNormal,
        boardPoint.point,
      );
    } else if (this.points.length === 3) {
      const boardPlane = new THREE.Plane().setFromCoplanarPoints(
        this.points[0].point,
        this.points[1].point,
        this.points[2].point,
      );
      this.mouseHandler.targetFinder.setConstraintLine(
        boardPlane.normal,
        boardPoint.point,
      );
    } else if (this.points.length === 4) {
      this.mouseHandler.targetFinder.clearConstraints();
      this.confirmBoard();
    }
  };

  private createBoardPoint(event: MouseHandlerEvent) {
    if (this.points.length < 3) {
      return {
        point: event.point,
        centerAligned: this.isCenterAligned(event),
      };
    } else {
      return this.getFourthPoint(event);
    }
  }

  /**
   * Get the line on which the 3rd and 4th points of the board must lie. This can only be
   * calculated once the first 3 points are set.
   */
  private getZLine() {
    if (this.points.length < 3) {
      throw new Error(
        "The board's Z line is only defined when the first 3 points are set",
      );
    }

    const boardPlane = new THREE.Plane().setFromCoplanarPoints(
      this.points[0].point,
      this.points[1].point,
      this.points[2].point,
    );
    const zLine = new THREE.Line3(
      this.points[2].point,
      this.points[2].point.clone().add(boardPlane.normal),
    );
    return zLine;
  }

  private getFourthPoint(event: MouseHandlerEvent) {
    const materialThickness = 18;
    const zLine = this.getZLine();
    const zAxis = zLine.delta(new THREE.Vector3());
    const signedDistance = zLine.closestPointToPointParameter(
      event.point,
      false,
    );

    if (this.isCenterAligned(event)) {
      const point = this.points[2].point
        .clone()
        .add(zAxis.clone().multiplyScalar(materialThickness / 2));
      return {
        point: point,
        centerAligned: true,
      };
    } else {
      const point = this.points[2].point
        .clone()
        .add(
          zAxis
            .clone()
            .multiplyScalar(Math.sign(signedDistance) * materialThickness),
        );
      return {
        point: point,
        centerAligned: false,
      };
    }
  }

  private isCenterAligned(event: MouseHandlerEvent) {
    return event.ctrlPressed;
  }

  private getBoardProperties(points: BoardPoint[]) {
    if (points.length !== 4) {
      throw new Error('Invalid number of points');
    }

    const boardSides = {
      x: points[1].point.clone().sub(points[0].point),
      y: points[2].point.clone().sub(points[1].point),
      z: points[3].point.clone().sub(points[2].point),
    };

    const position = points[0].point.clone();
    const size = new THREE.Vector3(
      points[0].point.distanceTo(points[1].point),
      points[1].point.distanceTo(points[2].point),
      points[2].point.distanceTo(points[3].point),
    );
    const quaternion = getQuaternionFromAxes(boardSides.x, boardSides.y);

    for (let i = 0; i < 3; i++) {
      const centerAligned = points[i + 1].centerAligned;
      if (centerAligned) {
        position.add(points[i].point.clone().sub(points[i + 1].point));
        const dimension = (['x', 'y', 'z'] as const)[i];
        size[dimension] *= 2;
      }
    }

    const boardZAxis = boardSides.x.clone().cross(boardSides.y).normalize();
    const zIsInverted = boardZAxis.dot(boardSides.z) < 0;
    if (zIsInverted) {
      position.add(points[3].point.clone().sub(points[2].point));
    }

    return {
      size,
      position,
      quaternion,
    };
  }

  private getFleetingBoard() {
    if (!this.fleetingBoard) {
      const geometries = new Geometries({});
      this.fleetingBoard = new MaterialObject(geometries);
      this.renderer.add(this.fleetingBoard);
    }
    return this.fleetingBoard;
  }

  private removeFleetingBoard() {
    if (this.fleetingBoard) {
      this.renderer.remove(this.fleetingBoard);
      this.fleetingBoard = undefined;
    }
  }

  private updateFleetingBoard() {
    const points = [...this.points];
    if (this.fleetingPoint) {
      points.push(this.fleetingPoint);
    }

    if (points.length === 0) {
      return;
    }
    while (points.length < 4) {
      points.push({
        point: points[points.length - 1].point.clone(),
        centerAligned: false,
      });
    }

    const { size, position, quaternion } = this.getBoardProperties(points);

    const faceGeometry = this.getFaceGeometry(size);
    const edgeGeometry = this.getEdgeGeometry(size, faceGeometry);
    const vertexGeometry = new THREE.BufferGeometry();
    const geometries = new Geometries({
      faces: faceGeometry,
      edges: edgeGeometry,
      vertices: vertexGeometry,
    });

    const fleetingBoard = this.getFleetingBoard();
    fleetingBoard.setGeometries(geometries);

    fleetingBoard.position.copy(position);
    fleetingBoard.quaternion.copy(quaternion);

    const childPosition = size.clone().divideScalar(2);
    fleetingBoard.children.forEach((child) => {
      child.position.copy(childPosition);
    });
  }

  private getFaceGeometry(size: THREE.Vector3) {
    const numZero = size.toArray().filter((s) => s === 0).length;
    if (numZero === 0) {
      const faceGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      return faceGeometry;
    } else {
      const faceGeometry = new THREE.PlaneGeometry(size.x, size.y);
      return faceGeometry;
    }
  }

  private getEdgeGeometry(
    size: THREE.Vector3,
    faceGeometry: THREE.BufferGeometry,
  ) {
    const numZero = size.toArray().filter((s) => s === 0).length;

    if (numZero < 2) {
      const edgeGeometry = new THREE.EdgesGeometry(faceGeometry);
      return edgeGeometry;
    } else {
      const edgeGeometry = new THREE.BufferGeometry().setFromPoints([
        size.clone().multiplyScalar(-0.5),
        size.clone().multiplyScalar(0.5),
      ]);
      return edgeGeometry;
    }
  }

  private confirmBoard() {
    this.fleetingPoint = undefined;
    if (this.fleetingBoard) {
      const { size, position, quaternion } = this.getBoardProperties(
        this.points,
      );
      const board = new Board(size, position, quaternion);
      this.model.addPart(board);
      this.removeFleetingBoard();
    }

    this.points = [];
    this.renderer.setTool('select');
  }
}
