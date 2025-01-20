import {
  axisDirections,
  distanceBetweenLines,
  distanceToLine,
  intersectPlaneAndLine,
  intersectPlanes,
} from '@/lib/util/geometry';
import { disposeObject } from '@/lib/util/three';
import * as THREE from 'three';
import Raycaster from '../raycaster';
import { Renderer } from '../renderer';

interface SnapPoint {
  point: THREE.Vector3;
  lines?: THREE.Line3[];
}

export interface Target {
  target?: THREE.Vector3;
  snapPoint?: SnapPoint;
  snappedLine?: THREE.Line3;
  plane?: THREE.Plane;
}

/**
 * Find a target point in the scene based on a ray (typically from a mouse event), optionally
 * constrained to a plane or line.
 *
 * - When no constraints are set, the target point will lie on one of the primary planes. It will
 *   snap to the axes, and to points and lines in the scene (TODO).
 * - When a neighbour point is set, the target point will lie in a plane that is parallel to the
 *   primary planes and that goes through the neighbour point, unless the target point is snapping
 *   to another point or line.
 * - When a plane constraint is set, the target point is guaranteed to lie in that plane. It will
 *   still snap to lines and points in the scene that intersect this plane.
 * - When a line constraint is set, the target point is guaranteed to lie on that line. It will
 *   still snap to points and lines in the scene that intersect this line.
 */
export class TargetFinder {
  private renderer: Renderer;

  private _neighborPoint?: THREE.Vector3;
  private _constraintPlane?: THREE.Plane;
  private _constraintLine?: THREE.Line3;

  private snapObjects: THREE.Object3D[] = [];
  private snapGroup: THREE.Group;
  private snapLines: THREE.Line[] = [];
  private snapPoints: THREE.Points[] = [];

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    this.snapGroup = new THREE.Group();
    this.snapGroup.visible = false;
    this.renderer.add(this.snapGroup);

    this.updateSnapObjects();
  }

  dispose() {
    this.renderer.remove(this.snapGroup);
  }

  ///
  // Getters

  get neighborPoint() {
    return this._neighborPoint;
  }
  get constraintPlane() {
    return this._constraintPlane;
  }
  get constraintLine() {
    return this._constraintLine;
  }

  ///
  // Set constraints

  clearConstraints() {
    this._neighborPoint = undefined;
    this._constraintPlane = undefined;
    this._constraintLine = undefined;
    this.updateSnapObjects();
  }

  setNeighborPoint(point: THREE.Vector3) {
    this._neighborPoint = point;
    this.updateSnapObjects();
  }

  setConstraintPlane(normal: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      point,
    );
    this._constraintLine = undefined;
    this.updateSnapObjects();
  }

  setConstraintLine(direction: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintLine = new THREE.Line3(point, point.clone().add(direction));
    this._constraintPlane = undefined;
    this.updateSnapObjects();
  }

  private updateSnapObjects() {
    this.snapObjects = this.renderer.partObjects.filter(
      (object) => !object.part.temporary,
    );

    for (const child of this.snapGroup.children) {
      disposeObject(child);
    }

    let snapPlanes = this.getSnapPlanes();
    let snapLines = this.getSnapLines();
    let snapPoints: SnapPoint[] = [];

    if (this.constraintPlane) {
      [snapPlanes, snapLines, snapPoints] = this.constrainToPlane(
        this.constraintPlane,
        snapPlanes,
        snapLines,
        this.neighborPoint!,
      );
    } else if (this.constraintLine) {
      [snapPlanes, snapLines, snapPoints] = this.constrainToLine(
        this.constraintLine,
        snapPlanes,
        snapLines,
      );
    }

    this.snapLines = snapLines.map((line) => this.getSnapLineObject(line));
    this.snapPoints = snapPoints.map((point) => this.getSnapPointObject(point));

    this.snapGroup.children = [];
    if (this.snapLines.length > 0) {
      this.snapGroup.add(...this.snapLines);
    }
    if (this.snapPoints.length > 0) {
      this.snapGroup.add(...this.snapPoints);
    }
    this.snapGroup.updateMatrixWorld();
  }

  private getSnapPlanes(): THREE.Plane[] {
    const snapPlanes: THREE.Plane[] = [
      ...this.getAxesSnapPlanes(),
      ...this.getAxesSnapPlanes(this.neighborPoint),
    ];

    if (this.constraintPlane) {
      snapPlanes.push(
        ...this.getSnapPlanesForPlane(
          this.constraintPlane,
          this.neighborPoint!,
        ),
      );
    }

    return snapPlanes;
  }

  getAxesSnapPlanes(origin = new THREE.Vector3()): THREE.Plane[] {
    const snapPlanes = Object.values(axisDirections).map((direction) => {
      return new THREE.Plane().setFromNormalAndCoplanarPoint(direction, origin);
    });
    return snapPlanes;
  }

  private getSnapPlanesForPlane(
    constraintPlane: THREE.Plane,
    neighborPoint: THREE.Vector3,
  ): THREE.Plane[] {
    // Add the plan that has a normal which is orthogonal to the Y axis. When intersected with the
    // constraint plane in a later step, this will give a constraint line that points upwards.
    const yAxis = new THREE.Vector3(0, 1, 0);
    const sideways = yAxis.clone().cross(constraintPlane.normal);
    if (sideways.lengthSq() < 1e-6) {
      return [];
    }

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      sideways,
      neighborPoint,
    );
    return [plane];
  }

  private getSnapLines(): THREE.Line3[] {
    const snapLines = this.getAxesSnapLines();
    if (this.neighborPoint) {
      snapLines.push(...this.getAxesSnapLines(this.neighborPoint));
    }
    return snapLines;
  }

  private getAxesSnapLines(origin = new THREE.Vector3()): THREE.Line3[] {
    const allAxisDirections = Object.values(axisDirections);
    allAxisDirections.push(
      ...Object.values(axisDirections).map((direction) =>
        direction.clone().negate(),
      ),
    );

    return allAxisDirections.map((direction) => {
      const start = origin.clone();
      const end = origin
        .clone()
        .add(direction.clone().multiplyScalar(this.renderer.groundPlaneSize));
      const line = new THREE.Line3(start, end);
      return line;
    });
  }

  private getSnapLineObject(line: THREE.Line3): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      line.start,
      line.end,
    ]);
    // Only used for debugging
    const material = new THREE.LineBasicMaterial({
      color: 0x000000,
      depthTest: false,
      depthWrite: false,
    });

    const lineObject = new THREE.Line(geometry, material);
    lineObject.userData.line = line;
    return lineObject;
  }

  private getSnapPointObject(point: SnapPoint): THREE.Points {
    const geometry = new THREE.BufferGeometry().setFromPoints([point.point]);
    // Only used for debugging
    const material = new THREE.PointsMaterial({
      size: 5,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false,
    });
    const pointObject = new THREE.Points(geometry, material);
    pointObject.userData.point = point;
    return pointObject;
  }

  ///
  // Constrain snap objects to a plane or line

  private constrainToPlane(
    constraintPlane: THREE.Plane,
    snapPlanes: THREE.Plane[],
    snapLines: THREE.Line3[],
    neighborPoint: THREE.Vector3,
  ): [THREE.Plane[], THREE.Line3[], SnapPoint[]] {
    const constrainedPlanes: THREE.Plane[] = [];
    const constrainedLines: THREE.Line3[] = [];
    const constrainedPoints: SnapPoint[] = [];

    for (const plane of snapPlanes) {
      const intersection = intersectPlanes(constraintPlane, plane);
      if (intersection) {
        const direction = intersection
          .delta(new THREE.Vector3())
          .multiplyScalar(this.renderer.groundPlaneSize);
        const start = intersection.closestPointToPoint(
          neighborPoint,
          false,
          new THREE.Vector3(),
        );
        constrainedLines.push(
          new THREE.Line3(start.clone(), start.clone().add(direction)),
        );
        constrainedLines.push(
          new THREE.Line3(start.clone(), start.clone().sub(direction)),
        );
      }
    }

    for (const line of [...constrainedLines, ...snapLines]) {
      if (
        Math.abs(constraintPlane.distanceToPoint(line.start)) < 1e-6 &&
        Math.abs(constraintPlane.distanceToPoint(line.end)) < 1e-6
      ) {
        constrainedLines.push(line);
      } else {
        const intersection = intersectPlaneAndLine(
          constraintPlane,
          line,
          new THREE.Vector3(),
        );
        if (intersection) {
          constrainedPoints.push({
            point: intersection,
            lines: [line],
          });
        }
      }
    }

    return [constrainedPlanes, constrainedLines, constrainedPoints];
  }

  private constrainToLine(
    constraintLine: THREE.Line3,
    snapPlanes: THREE.Plane[],
    snapLines: THREE.Line3[],
  ): [THREE.Plane[], THREE.Line3[], SnapPoint[]] {
    const constrainedPlanes: THREE.Plane[] = [];
    const constrainedLines: THREE.Line3[] = [];
    const constrainedPoints: SnapPoint[] = [];

    for (const plane of snapPlanes) {
      const intersection = intersectPlaneAndLine(
        plane,
        constraintLine,
        new THREE.Vector3(),
      );
      if (intersection) {
        constrainedPoints.push({
          point: intersection,
          lines: [constraintLine],
        });
      }
    }

    for (const line of snapLines) {
      const intersection = new THREE.Vector3();
      const distance = distanceBetweenLines(constraintLine, line, intersection);
      if (distance < 1e-6) {
        constrainedPoints.push({
          point: intersection,
          lines: [constraintLine, line],
        });
      }
    }

    return [constrainedPlanes, constrainedLines, constrainedPoints];
  }

  ///
  // Find targets

  findTarget(raycaster: Raycaster): Target {
    const intersects = raycaster.intersectObjects([
      ...this.snapObjects,
      ...this.snapLines,
      ...this.snapPoints,
    ]);
    if (intersects.length > 0) {
      return this.createTargetFromIntersect(intersects[0]);
    }

    if (this.constraintLine) {
      return this.getTargetOnLine(raycaster, this.constraintLine);
    } else if (this.constraintPlane) {
      return this.getTargetOnPlane(raycaster, this.constraintPlane);
    } else {
      return this.getTargetNearPoint(
        raycaster,
        this.neighborPoint ?? new THREE.Vector3(),
      );
    }
  }

  private createTargetFromIntersect(intersect: THREE.Intersection): Target {
    const point = intersect.point;
    const object = intersect.object;
    if (object.parent === this.snapGroup) {
      if (object instanceof THREE.Line) {
        const line = object.userData.line as THREE.Line3;
        return {
          target: line.closestPointToPoint(point, true, new THREE.Vector3()),
          snappedLine: line,
          plane: this.constraintPlane,
        };
      } else if (object instanceof THREE.Points) {
        const snapPoint = object.userData.point as SnapPoint;
        return {
          target: snapPoint.point,
          snapPoint: snapPoint,
          plane: this.constraintPlane,
        };
      } else {
        throw new Error('Unexpected object in snap group');
      }
    } else {
      return {
        target: point,
        snapPoint: {
          point,
        },
        plane: this.constraintPlane,
      };
    }
  }

  private getTargetOnLine(raycaster: Raycaster, line: THREE.Line3): Target {
    const target = new THREE.Vector3();
    distanceToLine(raycaster.ray, line, undefined, target);
    return {
      target,
    };
  }

  getTargetOnPlane(raycaster: Raycaster, plane: THREE.Plane): Target {
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  private getTargetNearPoint(
    raycaster: Raycaster,
    point: THREE.Vector3,
  ): Target {
    const planeNormal = this.getDominantPlaneNormal(raycaster.ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  getTargetOnAxisPlane(raycaster: Raycaster, point: THREE.Vector3): Target {
    const planeNormal = this.getDominantPlaneNormal(raycaster.ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  private getDominantPlaneNormal(
    direction: THREE.Vector3,
    normals: THREE.Vector3[] = Object.values(axisDirections),
  ): THREE.Vector3 {
    if (normals.length === 0) {
      throw new Error('No normals provided');
    } else if (normals.length === 1) {
      return normals[0];
    }

    const absDirection = new THREE.Vector3(
      Math.abs(direction.x),
      Math.abs(direction.y) * this.dominantPlaneYPreference,
      Math.abs(direction.z),
    );
    const absNormals = normals.map((normal) => {
      return new THREE.Vector3(
        Math.abs(normal.x),
        Math.abs(normal.y),
        Math.abs(normal.z),
      );
    });

    const angles = absNormals.map((normal) => {
      return normal.angleTo(absDirection);
    });

    const minAngle = Math.min(...angles);
    return normals[angles.indexOf(minAngle)];
  }
}
