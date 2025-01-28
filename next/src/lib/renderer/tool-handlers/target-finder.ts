import { OCGeometries, STRIDE } from '@/lib/geom/geometries';
import { getIntersections } from '@/lib/geom/projection';
import { Vertex } from '@/lib/geom/shape';
import { pointToVector, vertexFromPoint } from '@/lib/geom/util';
import { Axes } from '@/lib/model/parts/axes';
import { axisDirections, distanceToLine } from '@/lib/util/geometry';
import { disposeObject, getIndexedAttribute3 } from '@/lib/util/three';
import { TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import {
  GeometriesObject,
  OCGeometriesObject,
} from '../part-objects/geometries-object';
import { PartObject } from '../part-objects/part-object';
import Raycaster, { Intersection } from '../raycaster';
import { Renderer } from '../renderer';

export interface Target {
  target?: THREE.Vector3;
  snappedPoint?: THREE.Vector3;
  snappedLine?: THREE.Line3;
  plane?: THREE.Plane;
  shape?: TopoDS_Shape;
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
  private snapHelperObjects: OCGeometriesObject[] = [];
  private snapHelpers: THREE.Group;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;

  constructor(renderer: Renderer) {
    this.renderer = renderer;

    const mainAxes = new Axes(this.renderer.groundPlaneSize);
    this.mainAxes = new PartObject(mainAxes);

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
    this.snapHelperObjects = this.getSnapHelperObjects();

    this.snapHelpers.children = [];
    this.snapHelpers.add(this.mainAxes, ...this.snapHelperObjects);
    this.snapHelpers.updateMatrixWorld();
  }

  private getSnapHelperObjects(): OCGeometriesObject[] {
    if (!this.neighborPoint) {
      return [];
    }

    const axes = this.getAxesWithOrigin(this.neighborPoint);
    const intersections = this.getAxesIntersections(axes, [
      ...this.snapObjects,
      this.mainAxes,
    ]);
    return [axes, intersections];
  }

  private getAxesWithOrigin(origin = new THREE.Vector3()): PartObject {
    const axes = new Axes(this.renderer.groundPlaneSize, origin);
    return new PartObject(axes);
  }

  private getAxesIntersections(
    axes: PartObject,
    objects: PartObject[],
  ): OCGeometriesObject {
    const intersections = _.flatten(
      objects.map((object) => {
        return getIntersections(axes.part.shape, object.part.shape);
      }),
    );

    const position = new Float32Array(intersections.length * 3);
    const vertexMap: Vertex[] = [];
    for (let i = 0; i < intersections.length; i++) {
      const intersection = intersections[i];
      const vertex = vertexFromPoint(intersection.point);
      position.set(pointToVector(intersection.point).toArray(), i * STRIDE);
      vertexMap[i] = new Vertex(vertex);
    }
    const vertices = new THREE.BufferGeometry();
    vertices.setAttribute(
      'position',
      new THREE.BufferAttribute(position, STRIDE),
    );

    const geometries = new OCGeometries({
      vertices,
      vertexMap,
    });
    const geometriesObject = new GeometriesObject(geometries);
    return geometriesObject;
  }

  ///
  // Find targets

  findTarget(mouseEvent: MouseEvent): Target {
    this.renderer.raycaster.setFromEvent(mouseEvent);

    const intersection = this.renderer.raycaster.castSnapping([
      ...this.snapObjects,
      this.mainAxes,
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

  private createTargetFromIntersection(intersection: Intersection): Target {
    const object = intersection.object;
    if (object.parent === this.snapHelpers) {
      return this.createTargetFromSnapHelper(intersection);
    }

    const point = intersection.point;
    return {
      target: point.clone(),
      snappedPoint: point.clone(),
      plane: this.getTargetPlane(point),
    };
  }

  private createTargetFromSnapHelper(intersection: Intersection): Target {
    const point = intersection.point;
    if ('vertex' in intersection) {
      return {
        target: point.clone(),
        snappedPoint: point.clone(),
        plane: this.getTargetPlane(point),
      };
    } else if ('edge' in intersection) {
      const startPoint = getIndexedAttribute3(
        intersection.object.edges.geometry,
        'position',
        intersection.edgeIndex * 2,
      );
      const plane = new THREE.Plane().setFromCoplanarPoints(
        startPoint.clone(),
        point.clone(),
        this.neighborPoint ?? new THREE.Vector3(),
      );
      return {
        target: point.clone(),
        snappedPoint: point.clone(),
        plane: plane,
      };
    } else {
      throw new Error('Unexpected intersection with snap helper face');
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

  getTargetPlane(point: THREE.Vector3): THREE.Plane | undefined {
    if (this.constraintPlane) {
      return this.constraintPlane;
    }
    if (!this.neighborPoint) {
      return;
    }

    const direction = point.clone().sub(this.neighborPoint);
    for (let i = 0; i < 3; i++) {
      if (direction.getComponent(i) === 0) {
        const normal = new THREE.Vector3();
        normal.setComponent(i, 1);
        return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
      }
    }
  }
}
