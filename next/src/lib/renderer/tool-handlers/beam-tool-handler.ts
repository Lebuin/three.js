import { Geometries } from '@/lib/geom/geometries';
import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Beam } from '@/lib/model/parts/beam';
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

interface BeamPoint {
  point: THREE.Vector3;
  centerAligned: boolean;
}

const mouseHandlerModifiers = {
  Control: false,
  ArrowUp: true,
} as const;
type MouseHandlerModifiers = typeof mouseHandlerModifiers;
type MouseHandlerEvent = BaseMouseHandlerEvent<MouseHandlerModifiers>;

export class BeamToolHandler extends ToolHandler {
  readonly tool = 'beam';
  readonly materialThickness = [50, 100];

  private mouseHandler: MouseHandler<MouseHandlerModifiers>;
  private targetFinder: TargetFinder;
  private drawingHelper: DrawingHelper;

  private points: BeamPoint[] = [];
  private fleetingPoint?: BeamPoint;
  private fleetingBeam?: MaterialObject;
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
    this.removeFleetingBeam();
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

    this.fleetingPoint = this.createBeamPoint(event, target);
    this.updateDrawingHelper(target);
    this.updateRenderer(target);
    this.updateFleetingBeam();
  };

  private onClick = (event: MouseHandlerEvent) => {
    this.updateFixedLine(event);
    const target = this.targetFinder.findTarget(event.event);
    if (!target) {
      return;
    }

    const beamPoint = this.createBeamPoint(event, target);
    this.points.push(beamPoint);
    this.fleetingPoint = undefined;
    this.isFixedLine = false;

    if (this.points.length < 4) {
      this.updateDrawingHelper(target);
      this.updateRenderer(target);
      this.updateFleetingBeam();
      this.updateConstraints();
    } else {
      this.mouseHandler.reset();
      this.targetFinder.clearConstraints();
      this.drawingHelper.clear();
      this.confirmBeam();
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

  updateRenderer(target: Target) {
    this.renderer.setMouseTarget(target.point);
    this.renderer.render();
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
      const beamPlane = new THREE.Plane().setFromCoplanarPoints(
        this.points[0].point,
        this.points[1].point,
        this.points[2].point,
      );
      const line = new THREE.Line3(
        this.points[2].point,
        this.points[2].point.clone().add(beamPlane.normal),
      );
      this.targetFinder.setConstraintLine(line);
    } else if (this.points.length === 4) {
      this.targetFinder.clearConstraints();
      this.confirmBeam();
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
   * Get the line on which the 3rd and 4th points of the beam must lie. This can only be
   * calculated once the first 3 points are set.
   */
  private getZLine() {
    if (this.points.length < 3) {
      throw new Error(
        "The beam's Z line is only defined when the first 3 points are set",
      );
    }

    const beamPlane = new THREE.Plane().setFromCoplanarPoints(
      this.points[0].point,
      this.points[1].point,
      this.points[2].point,
    );
    const zLine = new THREE.Line3(
      this.points[2].point,
      this.points[2].point.clone().add(beamPlane.normal),
    );
    return zLine;
  }

  ///
  // Update the fleeting beam

  private createBeamPoint(event: MouseHandlerEvent, target: Target): BeamPoint {
    if (this.points.length < 2) {
      return {
        point: target.constrainedPoint,
        centerAligned: this.isCenterAligned(event),
      };
    } else if (this.points.length === 2) {
      return this.getThirdPoint(event, target);
    } else {
      return this.getFourthPoint(event, target);
    }
  }

  private getThirdPoint(event: MouseHandlerEvent, target: Target): BeamPoint {
    const length = this.materialThickness[0];
    const direction = target.constrainedPoint
      .clone()
      .sub(this.points[1].point)
      .normalize();
    const isCenterAligned = this.isCenterAligned(event);
    const distance = isCenterAligned ? length / 2 : length;
    const point = this.points[1].point
      .clone()
      .add(direction.clone().multiplyScalar(distance));

    return {
      point,
      centerAligned: isCenterAligned,
    };
  }

  private getFourthPoint(event: MouseHandlerEvent, target: Target): BeamPoint {
    const length = this.materialThickness[1];
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

  private getFleetingBeam() {
    if (!this.fleetingBeam) {
      const geometries = new Geometries({});
      this.fleetingBeam = new MaterialObject(geometries);
      this.renderer.add(this.fleetingBeam);
    }
    return this.fleetingBeam;
  }

  private removeFleetingBeam() {
    if (this.fleetingBeam) {
      this.renderer.remove(this.fleetingBeam);
      this.fleetingBeam = undefined;
    }
  }

  private updateFleetingBeam() {
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

    const { size, position, quaternion } = this.getBeamProperties(points);

    const faceGeometry = this.getFaceGeometry(size);
    const edgeGeometry = this.getEdgeGeometry(size, faceGeometry);
    const vertexGeometry = new THREE.BufferGeometry();
    const geometries = new Geometries({
      faces: faceGeometry,
      edges: edgeGeometry,
      vertices: vertexGeometry,
    });

    const fleetingBeam = this.getFleetingBeam();
    fleetingBeam.setGeometries(geometries);

    fleetingBeam.position.copy(position);
    fleetingBeam.quaternion.copy(quaternion);

    const childPosition = size.clone().divideScalar(2);
    fleetingBeam.children.forEach((child) => {
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

  private confirmBeam() {
    this.fleetingPoint = undefined;
    if (this.fleetingBeam) {
      const { size, position, quaternion } = this.getBeamProperties(
        this.points,
      );
      const beam = new Beam(size, position, quaternion);
      this.model.addPart(beam);
      this.removeFleetingBeam();
    }

    this.points = [];
  }

  private getBeamProperties(points: BeamPoint[]) {
    if (points.length !== 4) {
      throw new Error('Invalid number of points');
    }

    const beamSides = {
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
    const quaternion = getQuaternionFromAxes(beamSides.x, beamSides.y);

    for (let i = 0; i < 3; i++) {
      const centerAligned = points[i + 1].centerAligned;
      if (centerAligned) {
        position.add(points[i].point.clone().sub(points[i + 1].point));
        size.setComponent(i, size.getComponent(i) * 2);
      }
    }

    const beamZAxis = beamSides.x.clone().cross(beamSides.y).normalize();
    const zIsInverted = beamZAxis.dot(beamSides.z) < 0;
    if (zIsInverted) {
      position.add(beamSides.z.clone().normalize().multiplyScalar(size.z));
    }

    return {
      size,
      position,
      quaternion,
    };
  }
}
