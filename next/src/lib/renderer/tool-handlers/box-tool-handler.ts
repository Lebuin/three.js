import { Geometries } from '@/lib/geom/geometries';
import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts';
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

interface BoxPoint {
  point: THREE.Vector3;
  centerAligned: boolean;
}

const mouseHandlerModifiers = {
  Control: false,
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

/**
 * A tool for drawing boxes. {@link BoardToolHandler} and {@link BoxToolHandler} are subclasses of
 * this class.
 */
export abstract class BoxToolHandler<T extends Part> extends ToolHandler {
  abstract readonly fixedDimensions: number[];

  protected mouseHandler: MouseHandler<MouseHandlerModifiers>;
  protected targetFinder: TargetFinder;
  protected drawingHelper: DrawingHelper;

  protected points: BoxPoint[] = [];
  protected fleetingPoint?: BoxPoint;
  protected fleetingBox?: MaterialObject;
  protected isFixedLine = false;

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
    this.renderer.setRotateTarget();
    this.removeFleetingBox();
    this.removeListeners();
  }

  ///
  // Handle events

  protected setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
  }

  protected removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
  }

  protected onMouseMove = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);

    const target = this.targetFinder.findTarget(event.event);
    if (target) {
      this.fleetingPoint = this.createBoxPoint(event, target);
    }

    this.updateRenderer(target);
  };

  protected onClick = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    if (!target) {
      return;
    }

    const boxPoint = this.createBoxPoint(event, target);
    this.points.push(boxPoint);
    this.fleetingPoint = undefined;
    this.isFixedLine = false;

    if (this.points.length < 4) {
      this.updateRenderer(target);
      this.updateConstraints();
    } else {
      this.mouseHandler.reset();
      this.targetFinder.clearConstraints();
      this.drawingHelper.clear();
      this.confirmBox();
    }
  };

  protected isCenterAligned(event: MouseHandlerEvent) {
    return event.modifiers.Control;
  }

  protected updateFixedLine(event: MouseHandlerEvent) {
    const isFixedLine = event.modifiers.ArrowUp;
    if (isFixedLine !== this.isFixedLine) {
      this.isFixedLine = isFixedLine;
      this.updateConstraints();
    }
  }

  ///
  // Update the scene based on the current target

  protected updateRenderer(target: Optional<Target>): void {
    this.updateDrawingHelper(target);
    this.updateFleetingBox();
    super.updateRenderer(target);
  }

  protected updateDrawingHelper(target: Optional<Target>) {
    if (!target) {
      return;
    }

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

  ///
  // Update the targetFinder constraints

  protected updateConstraints() {
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
      const boxPlane = new THREE.Plane().setFromCoplanarPoints(
        this.points[0].point,
        this.points[1].point,
        this.points[2].point,
      );
      const line = new THREE.Line3(
        this.points[2].point,
        this.points[2].point.clone().add(boxPlane.normal),
      );
      this.targetFinder.setConstraintLine(line);
    }
  }

  protected getFixedLine(): THREE.Line3 | null {
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

  ///
  // Update the fleeting box

  protected createBoxPoint(event: MouseHandlerEvent, target: Target): BoxPoint {
    const totalPoints = 4;
    const numFreePoints = totalPoints - this.fixedDimensions.length;
    if (this.points.length < numFreePoints) {
      return {
        point: target.constrainedPoint,
        centerAligned: this.isCenterAligned(event),
      };
    } else {
      return this.getPointAlongFixedDimension(
        event,
        target,
        this.points[this.points.length - 1],
        this.fixedDimensions[this.points.length - numFreePoints],
      );
    }
  }

  protected getPointAlongFixedDimension(
    event: MouseHandlerEvent,
    target: Target,
    previousPoint: BoxPoint,
    length: number,
  ): BoxPoint {
    const direction = target.constrainedPoint
      .clone()
      .sub(previousPoint.point)
      .normalize();
    const isCenterAligned = this.isCenterAligned(event);
    const distance = isCenterAligned ? length / 2 : length;
    const point = previousPoint.point
      .clone()
      .add(direction.clone().multiplyScalar(distance));

    return {
      point,
      centerAligned: isCenterAligned,
    };
  }

  protected getFleetingBox() {
    if (!this.fleetingBox) {
      const geometries = new Geometries({});
      this.fleetingBox = new MaterialObject(geometries);
      this.renderer.add(this.fleetingBox);
    }
    return this.fleetingBox;
  }

  protected removeFleetingBox() {
    if (this.fleetingBox) {
      this.renderer.remove(this.fleetingBox);
      this.fleetingBox = undefined;
    }
  }

  protected updateFleetingBox() {
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

    const { size, position, quaternion } = this.getBoxProperties(points);

    const faceGeometry = this.getFaceGeometry(size);
    const edgeGeometry = this.getEdgeGeometry(size, faceGeometry);
    const vertexGeometry = new THREE.BufferGeometry();
    const geometries = new Geometries({
      faces: faceGeometry,
      edges: edgeGeometry,
      vertices: vertexGeometry,
    });

    const fleetingBox = this.getFleetingBox();
    fleetingBox.setGeometries(geometries);

    fleetingBox.position.copy(position);
    fleetingBox.quaternion.copy(quaternion);

    const childPosition = size.clone().divideScalar(2);
    fleetingBox.children.forEach((child) => {
      child.position.copy(childPosition);
    });
  }

  protected getFaceGeometry(size: THREE.Vector3) {
    const numZero = size.toArray().filter((s) => s === 0).length;
    if (numZero === 0) {
      const faceGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      return faceGeometry;
    } else {
      const faceGeometry = new THREE.PlaneGeometry(size.x, size.y);
      return faceGeometry;
    }
  }

  protected getEdgeGeometry(
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

  protected confirmBox() {
    this.fleetingPoint = undefined;
    if (this.fleetingBox) {
      const { size, position, quaternion } = this.getBoxProperties(this.points);
      const box = this.getPart(size, position, quaternion);
      this.model.addPart(box);
      this.removeFleetingBox();
    }

    this.points = [];
  }

  protected abstract getPart(
    size: THREE.Vector3,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): T;

  protected getBoxProperties(points: BoxPoint[]) {
    if (points.length !== 4) {
      throw new Error('Invalid number of points');
    }

    const boxSides = {
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
    const quaternion = getQuaternionFromAxes(boxSides.x, boxSides.y);

    for (let i = 0; i < 3; i++) {
      const centerAligned = points[i + 1].centerAligned;
      if (centerAligned) {
        position.add(points[i].point.clone().sub(points[i + 1].point));
        size.setComponent(i, size.getComponent(i) * 2);
      }
    }

    const boxZAxis = boxSides.x.clone().cross(boxSides.y).normalize();
    const zIsInverted = boxZAxis.dot(boxSides.z) < 0;
    if (zIsInverted) {
      position.add(boxSides.z.clone().normalize().multiplyScalar(size.z));
    }

    return {
      size,
      position,
      quaternion,
    };
  }
}
