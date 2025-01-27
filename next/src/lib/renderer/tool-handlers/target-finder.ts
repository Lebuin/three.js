import { Axes } from '@/lib/model/parts/axes';
import { axisDirections, distanceToLine } from '@/lib/util/geometry';
import { disposeObject } from '@/lib/util/three';
import { THREE } from '@lib/three.js';
import { PartObject } from '../part-objects/part-object';
import Raycaster, { Intersection } from '../raycaster';
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

  private snapObjects: PartObject[] = [];
  private snapHelperObjects: PartObject[] = [];
  private snapHelpers: THREE.Group;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    this.snapHelpers = new THREE.Group();
    this.snapHelpers.visible = false;
    this.renderer.add(this.snapHelpers);

    this.updateSnapObjects();
  }

  dispose() {
    this.renderer.remove(this.snapHelpers);
    disposeObject(this.snapHelpers);
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
    this.snapObjects = this.renderer.partObjects;

    disposeObject(this.snapHelpers);
    const snapHelpers = this.getSnapAxes();
    this.snapHelperObjects = snapHelpers.map((helper) => {
      return new PartObject(helper);
    });

    this.snapHelpers.children = [];
    if (this.snapHelperObjects.length > 0) {
      this.snapHelpers.add(...this.snapHelperObjects);
    }
    this.snapHelpers.updateMatrixWorld();
  }

  private getSnapPlanes(): THREE.Plane[] {
    if (!this.constraintLine && !this.constraintPlane) {
      return [];
    }

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

  private getSnapAxes(): Axes[] {
    const snapAxes = [this.getAxesWithOrigin()];
    if (this.neighborPoint) {
      snapAxes.push(this.getAxesWithOrigin(this.neighborPoint));
    }
    return snapAxes;
  }

  private getAxesWithOrigin(origin = new THREE.Vector3()): Axes {
    return new Axes(this.renderer.groundPlaneSize, origin);
  }

  ///
  // Find targets

  findTarget(mouseEvent: MouseEvent): Target {
    this.renderer.raycaster.setFromEvent(mouseEvent);

    const intersection = this.renderer.raycaster.castSnapping([
      ...this.snapObjects,
      ...this.snapHelperObjects,
    ]);
    if (intersection) {
      return this.createTargetFromIntersection(intersection);
    }

    if (this.constraintLine) {
      return this.getTargetOnLine(this.renderer.raycaster, this.constraintLine);
    } else if (this.constraintPlane) {
      return this.getTargetOnPlane(
        this.renderer.raycaster,
        this.constraintPlane,
      );
    } else {
      return this.getTargetNearPoint(
        this.renderer.raycaster,
        this.neighborPoint ?? new THREE.Vector3(),
      );
    }
  }

  private createTargetFromIntersection(
    intersection: Intersection<PartObject>,
  ): Target {
    const point = intersection.point;
    const object = intersection.object;
    if (object.parent === this.snapHelpers) {
      if (object.part instanceof Axes) {
        const snappedLine = new THREE.Line3(
          object.part.position.clone(),
          point.clone(),
        );
        return {
          target: point,
          snappedLine: snappedLine,
          plane: this.constraintPlane,
        };
      } else {
        throw new Error(
          `Unexpected part in snap helpers group: ${object.part.constructor.name}`,
        );
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
