import { Board } from '@/lib/model/parts/board';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Renderer } from '../renderer';
import { MouseHandler, MouseHandlerEvent } from './mouse-handler';
import { ToolHandler } from './tool-handler';

interface BoardPoint {
  point: Vector3;
  centerAligned: boolean;
}

export class BoardToolHandler extends ToolHandler {
  private mouseHandler: MouseHandler;

  private points: BoardPoint[] = [];
  private fleetingPoint?: BoardPoint;
  private fleetingBoard?: Board;

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(renderer);

    this.setupListeners();
  }

  dispose() {
    super.dispose();
    this.mouseHandler.dispose();
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

    if (
      Math.abs(signedDistance) < materialThickness ||
      this.isCenterAligned(event)
    ) {
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

  private createFleetingBoard() {
    if (!this.fleetingBoard) {
      this.fleetingBoard = new Board();
      this.fleetingBoard.temporary = true;
      this.model.addPart(this.fleetingBoard);
    }
    return this.fleetingBoard;
  }

  private removeFleetingBoard() {
    if (this.fleetingBoard) {
      this.model.removePart(this.fleetingBoard);
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

    const fleetingBoard = this.createFleetingBoard();
    fleetingBoard.position = position;
    fleetingBoard.size = size;
    fleetingBoard.quaternion = quaternion;
  }

  private confirmBoard() {
    this.points = [];
    this.fleetingPoint = undefined;
    if (this.fleetingBoard) {
      this.fleetingBoard.temporary = false;
      this.fleetingBoard = undefined;
    }
    this.renderer.setTool('select');
  }
}
