import { Geometries } from '@/lib/geom/geometries';
import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Board } from '@/lib/model/parts/board';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { DrawingHelper } from '../helpers/drawing-helper';
import { PlaneHelperRect } from '../helpers/plane-helper';
import { MaterialObject } from '../part-objects/material-object';
import { Renderer } from '../renderer';
import {
  MouseHandlerEvent as BaseMouseHandlerEvent,
  MouseHandler,
} from './mouse-handler';
import { Target, TargetFinder } from './target-finder';
import { ToolHandler } from './tool-handler';

interface BoardPoint {
  point: THREE.Vector3;
  centerAligned: boolean;
}

const mouseHandlerModifiers = {
  Control: false,
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class BoardToolHandler extends ToolHandler {
  readonly tool = 'board';
  readonly materialThickness = 18;

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;

  private points: BoardPoint[] = [];
  private fleetingPoint?: BoardPoint;
  private fleetingBoard?: MaterialObject;
  private isFixedLine = false;

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(
      renderer.canvas,
      mouseHandlerModifiers,
    );
    this.targetFinder = new TargetFinder(renderer, {
      snapToLines: true,
      snapToPoints: true,
    });
    this.drawingHelper = new DrawingHelper();
    this.renderer.addUpdating(this.drawingHelper);

    this.setupListeners();
  }

  delete() {
    super.delete();
    this.mouseHandler.delete();
    this.targetFinder.delete();
    this.renderer.removeUpdating(this.drawingHelper);
    this.renderer.setMouseTarget();
    this.removeFleetingBoard();
    this.removeListeners();
  }

  ///
  // Handle events

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
  }

  private onMouseMove = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    if (!target) {
      return;
    }

    this.fleetingPoint = this.createBoardPoint(event, target);
    this.updateDrawingHelper(target);
    this.updateRenderer(target);
    this.updateFleetingBoard();
  };

  private onClick = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    if (!target) {
      return;
    }

    const boardPoint = this.createBoardPoint(event, target);
    this.points.push(boardPoint);
    this.fleetingPoint = undefined;
    this.isFixedLine = false;

    if (this.points.length < 4) {
      this.updateDrawingHelper(target);
      this.updateRenderer(target);
      this.updateFleetingBoard();
      this.updateConstraints();
    } else {
      this.mouseHandler.reset();
      this.targetFinder.clearConstraints();
      this.drawingHelper.clear();
      this.confirmBoard();
    }
  };

  private isCenterAligned(event: MouseHandlerEvent) {
    return event.modifiers.Control;
  }

  private updateFixedLine(event: MouseHandlerEvent) {
    const isFixedLine = event.modifiers.ArrowUp;
    if (isFixedLine !== this.isFixedLine) {
      this.isFixedLine = isFixedLine;
      this.updateConstraints();
    }
  }

  ///
  // Update the scene based on the current target

  updateDrawingHelper(target: Target) {
    const { point, constrainedPoint, plane, face, edge, vertex } = target;

    const points: THREE.Vector3[] = [];
    const vertices: Vertex[] = [];
    const lines: THREE.Line3[] = [];
    const edges: Edge[] = [];
    const planes: PlaneHelperRect[] = [];
    const faces: Face[] = [];

    if (this.targetFinder.neighborPoint) {
      const line = new THREE.Line3(
        this.targetFinder.neighborPoint,
        constrainedPoint,
      );
      lines.push(line);
    }

    if (plane) {
      const origin = this.targetFinder.neighborPoint ?? new THREE.Vector3();
      const planeRect: PlaneHelperRect = {
        start: origin,
        end: constrainedPoint,
        normal: plane.normal,
      };
      planes.push(planeRect);
    }

    if (vertex) {
      vertices.push(vertex);
    }

    if (edge) {
      edges.push(edge);
      points.push(point);
    }

    if (face) {
      faces.push(face);
      points.push(point);
    }

    this.drawingHelper.setPoints(points);
    this.drawingHelper.setVertices(vertices);
    this.drawingHelper.setLines(lines);
    this.drawingHelper.setEdges(edges);
    this.drawingHelper.setPlanes(planes);
    this.drawingHelper.setFaces(faces);
  }

  getMouseTarget(target: Target) {
    if (this.points.length > 0) {
      return target.point;
    } else {
      return super.getMouseTarget(target);
    }
  }

  ///
  // Update the targetFinder constraints

  private updateConstraints() {
    const fixedLine = this.getFixedLine();
    if (this.points.length === 0) {
      this.targetFinder.clearConstraints();
    } else if (fixedLine) {
      this.targetFinder.setConstraintLine(fixedLine);
    } else if (this.points.length === 1) {
      this.targetFinder.setNeighborPoint(this.points[0].point);
    } else if (this.points.length === 2) {
      const planeNormal = this.points[1].point
        .clone()
        .sub(this.points[0].point)
        .normalize();
      this.targetFinder.setConstraintPlane(planeNormal, this.points[1].point);
    } else if (this.points.length === 3) {
      const boardPlane = new THREE.Plane().setFromCoplanarPoints(
        this.points[0].point,
        this.points[1].point,
        this.points[2].point,
      );
      const line = new THREE.Line3(
        this.points[2].point,
        this.points[2].point.clone().add(boardPlane.normal),
      );
      this.targetFinder.setConstraintLine(line);
    }
  }

  private getFixedLine(): THREE.Line3 | null {
    if (!this.isFixedLine || this.points.length === 0 || !this.fleetingPoint) {
      return null;
    }

    const start = this.points[this.points.length - 1].point;
    const end = this.fleetingPoint.point;
    const line = new THREE.Line3(start, end);
    if (line.distance() < 1e-6) {
      return null;
    }
    return line;
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

  ///
  // Update the fleeting board

  private createBoardPoint(
    event: MouseHandlerEvent,
    target: Target,
  ): BoardPoint {
    if (this.points.length < 3) {
      return {
        point: target.constrainedPoint,
        centerAligned: this.isCenterAligned(event),
      };
    } else {
      return this.getFourthPoint(event, target);
    }
  }

  private getFourthPoint(event: MouseHandlerEvent, target: Target): BoardPoint {
    const length = this.materialThickness;
    const direction = target.constrainedPoint
      .clone()
      .sub(this.points[2].point)
      .normalize();
    const isCenterAligned = this.isCenterAligned(event);
    const distance = isCenterAligned ? length / 2 : length;
    const point = this.points[2].point
      .clone()
      .add(direction.clone().multiplyScalar(distance));

    return {
      point,
      centerAligned: isCenterAligned,
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
        size.setComponent(i, size.getComponent(i) * 2);
      }
    }

    const boardZAxis = boardSides.x.clone().cross(boardSides.y).normalize();
    const zIsInverted = boardZAxis.dot(boardSides.z) < 0;
    if (zIsInverted) {
      position.add(boardSides.z.clone().normalize().multiplyScalar(size.z));
    }

    return {
      size,
      position,
      quaternion,
    };
  }
}
