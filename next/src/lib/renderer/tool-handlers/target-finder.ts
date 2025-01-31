import {
  EdgeSupport,
  getIntersections as makeIntersection,
  VertexSupport,
} from '@/lib/geom/projection';
import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Axes, AxesInclude } from '@/lib/model/parts/axes';
import { Line } from '@/lib/model/parts/line';
import { Plane } from '@/lib/model/parts/plane';
import {
  axisDirections,
  distanceToLine,
  getQuaternionFromNormal,
} from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import {
  GeometriesObject,
  OCGeometriesObject,
} from '../part-objects/geometries-object';
import { PartObject } from '../part-objects/part-object';
import Raycaster, { Intersection } from '../raycaster';
import { Renderer } from '../renderer';

export interface Target {
  target: THREE.Vector3;
  constrainedTarget: THREE.Vector3;
  plane?: THREE.Plane;

  face?: Face;
  edge?: Edge;
  vertex?: Vertex;
}

interface ConstraintIntersectionUserData {
  edgeSupportMap: EdgeSupport[] | undefined;
  vertexSupportMap: VertexSupport[] | undefined;
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
  private mainAxes: PartObject;
  private constraintPlaneAxes: PartObject;
  private constraintObject?: PartObject;
  private constraintIntersections: OCGeometriesObject[] = [];
  private snapHelpers: THREE.Group;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    this.mainAxes = this.getAxesWithOrigin(new THREE.Vector3());
    this.constraintPlaneAxes = this.getAxesWithOrigin(
      new THREE.Vector3(),
      'xz',
    );

    this.snapHelpers = new THREE.Group();
    this.snapHelpers.visible = false;
    this.renderer.add(this.snapHelpers);

    this.updateSnapObjects();
  }

  delete() {
    this.renderer.remove(this.snapHelpers);
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

    this.snapHelpers.children = [];
    this.constraintObject = undefined;
    this.constraintIntersections = [];

    this.snapHelpers.add(this.mainAxes);

    this.constraintObject = this.getConstraintObject();
    if (this.constraintObject) {
      this.constraintIntersections = this.getConstraintIntersections(
        this.constraintObject,
        [this.mainAxes, ...this.snapObjects],
      );
      this.snapHelpers.add(
        this.constraintObject,
        ...this.constraintIntersections,
      );
    }

    if (this.constraintPlane) {
      this.constraintPlaneAxes.part.position = this.neighborPoint!.clone();
      this.constraintPlaneAxes.part.quaternion = getQuaternionFromNormal(
        this.constraintPlane.normal,
      );
      this.snapHelpers.add(this.constraintPlaneAxes);
    }

    this.snapHelpers.updateMatrixWorld();
  }

  private get shouldSnapToConstraintObject() {
    return this.constraintPlane == null && this.constraintLine == null;
  }

  private getConstraintObject(): PartObject | undefined {
    if (this.constraintPlane) {
      return this.getPlaneConstraintObject(
        this.constraintPlane,
        this.neighborPoint!,
      );
    } else if (this.constraintLine) {
      return this.getLineConstraintObject(this.constraintLine);
    } else if (this.neighborPoint) {
      // This is not a hard constraint: the target does not have to lie on the axes, but it will
      // snap to them.
      return this.getAxesWithOrigin(this.neighborPoint);
    } else {
      return undefined;
    }
  }

  private getPlaneConstraintObject(
    plane: THREE.Plane,
    point: THREE.Vector3,
  ): PartObject {
    const quaternion = getQuaternionFromNormal(plane.normal);
    const planePart = new Plane(
      this.renderer.groundPlaneSize,
      point,
      quaternion,
    );
    const object = new PartObject(planePart);
    return object;
  }

  private getLineConstraintObject(line: THREE.Line3) {
    const direction = line.delta(new THREE.Vector3());
    const quaternion = getQuaternionFromNormal(direction);
    const linePart = new Line(direction.length(), line.start, quaternion);
    const object = new PartObject(linePart);
    return object;
  }

  private getAxesWithOrigin(
    origin: THREE.Vector3,
    include: AxesInclude = 'xyz',
  ): PartObject {
    const axes = new Axes(
      { length: this.renderer.groundPlaneSize, include },
      origin,
    );
    const object = new PartObject(axes);
    return object;
  }

  private getConstraintIntersections(
    constraintObject: PartObject,
    sceneObjects: PartObject[],
  ): OCGeometriesObject[] {
    return sceneObjects.map((sceneObject) => {
      return this.getConstraintIntersection(constraintObject, sceneObject);
    });
  }

  private getConstraintIntersection(
    constraintObject: PartObject,
    sceneObject: PartObject,
  ): OCGeometriesObject {
    const {
      shape,
      edgeSupportMap2: edgeSupportMap,
      vertexSupportMap2: vertexSupportMap,
    } = makeIntersection(constraintObject.part.shape, sceneObject.part.shape);
    const userData: ConstraintIntersectionUserData = {
      vertexSupportMap,
      edgeSupportMap,
    };
    const geometriesObject = new GeometriesObject(shape.geometries);
    geometriesObject.userData = userData;
    return geometriesObject;
  }

  ///
  // Find targets

  findTarget(mouseEvent: MouseEvent): Target | null {
    const intersection = this.findIntersection(mouseEvent);
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

  private findIntersection(mouseEvent: MouseEvent): Intersection | undefined {
    this.renderer.raycaster.setFromEvent(mouseEvent);

    const snapObjects: OCGeometriesObject[] = [
      this.mainAxes,
      ...this.snapObjects,
      ...this.constraintIntersections,
    ];
    if (this.constraintObject && this.shouldSnapToConstraintObject) {
      snapObjects.push(this.constraintObject);
    }
    if (this.constraintPlane) {
      snapObjects.push(this.constraintPlaneAxes);
    }
    const intersection = this.renderer.raycaster.castSnapping(snapObjects);
    return intersection;
  }

  private createTargetFromIntersection(intersection: Intersection): Target {
    const object = intersection.object;
    const target: Target = {
      target: intersection.point.clone(),
      constrainedTarget: this.getConstrainedFromIntersection(intersection),
      plane: this.getPlaneFromIntersection(intersection),
    };

    if (
      object !== this.constraintObject &&
      object !== this.constraintPlaneAxes
    ) {
      if ('vertex' in intersection) {
        target.vertex = intersection.vertex;
      }
      if ('edge' in intersection) {
        target.edge = intersection.edge;
      }
      if ('face' in intersection) {
        target.face = intersection.face;
      }
    }

    if (this.constraintIntersections.includes(object)) {
      const userData = intersection.object
        .userData as ConstraintIntersectionUserData;
      let index: number, supportMap: VertexSupport[] | undefined;
      if ('vertex' in intersection) {
        index = intersection.vertexIndex;
        supportMap = userData.vertexSupportMap;
      } else if ('edge' in intersection) {
        index = intersection.edgeIndex;
        supportMap = userData.edgeSupportMap;
      } else {
        throw new Error('Expected a vertex or edge intersection');
      }

      if (supportMap == null) {
        throw new Error('No support map found for intersection');
      }

      const support = supportMap[index];
      if (support instanceof Vertex) {
        target.vertex = support;
      } else if (support instanceof Edge) {
        target.edge = support;
      } else {
        target.face = support;
      }
    }

    return target;
  }

  private getConstrainedFromIntersection(
    intersection: Intersection,
  ): THREE.Vector3 {
    if (this.constraintPlane) {
      return this.constraintPlane.projectPoint(
        intersection.point,
        new THREE.Vector3(),
      );
    } else if (this.constraintLine) {
      return this.constraintLine.closestPointToPoint(
        intersection.point,
        false,
        new THREE.Vector3(),
      );
    } else {
      return intersection.point.clone();
    }
  }

  private getPlaneFromIntersection(
    intersection: Intersection,
  ): THREE.Plane | undefined {
    if (this.constraintPlane) {
      return this.constraintPlane;
    } else if (this.constraintLine) {
      return undefined;
    } else if (!this.neighborPoint) {
      return undefined;
    } else if (intersection.object === this.mainAxes) {
      return new THREE.Plane().setFromCoplanarPoints(
        new THREE.Vector3(),
        intersection.point,
        this.neighborPoint,
      );
    } else {
      const direction = intersection.point.clone().sub(this.neighborPoint);
      for (let i = 0; i < 3; i++) {
        if (direction.getComponent(i) === 0) {
          const normal = new THREE.Vector3();
          normal.setComponent(i, 1);
          return new THREE.Plane().setFromNormalAndCoplanarPoint(
            normal,
            this.neighborPoint,
          );
        }
      }
      return undefined;
    }
  }

  private getTargetOnLine(raycaster: Raycaster, line: THREE.Line3): Target {
    const target = new THREE.Vector3();
    const constrainedTarget = new THREE.Vector3();
    distanceToLine(raycaster.ray, line, target, constrainedTarget);
    return {
      target,
      constrainedTarget,
    };
  }

  getTargetOnPlane(raycaster: Raycaster, plane: THREE.Plane): Target | null {
    const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!target) {
      return null;
    }

    return {
      target,
      constrainedTarget: target,
      plane,
    };
  }

  private getTargetNearPoint(
    raycaster: Raycaster,
    point: THREE.Vector3,
  ): Target | null {
    const planeNormal = this.getDominantPlaneNormal(raycaster.ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!target) {
      return null;
    }

    return {
      target,
      constrainedTarget: target,
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
