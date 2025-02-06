import { Pixels } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { OCGeometries } from '../geom/geometries';
import { projectOnto } from '../geom/projection';
import { Edge, Face, Vertex } from '../geom/shape';
import {
  GeometriesObject,
  OCGeometriesObject,
} from './part-objects/geometries-object';
import { Renderer } from './renderer';

export interface IntersectOptions {
  snapToLines: boolean;
  snapToPoints: boolean;
}
const defaultIntersectOptions = {
  snapToLines: false,
  snapToPoints: false,
} as const;

export interface BaseIntersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> {
  point: THREE.Vector3;
  pointOnRay: THREE.Vector3;
  distance: number;
  distanceToRay: number;
  object: T;
}

export interface FaceIntersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> extends BaseIntersection<T> {
  face: Face;
  faceIndex: number;
}

export interface EdgeIntersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> extends BaseIntersection<T> {
  edge: Edge;
  edgeIndex: number;
}

export interface VertexIntersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> extends BaseIntersection<T> {
  vertex: Vertex;
  vertexIndex: number;
}

export type Intersection<T extends OCGeometriesObject = OCGeometriesObject> =
  | FaceIntersection<T>
  | EdgeIntersection<T>
  | VertexIntersection<T>;

export default class Raycaster {
  private renderer: Renderer;
  private raycaster: THREE.Raycaster;
  private pixelThreshold: Pixels = 15;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.raycaster = new THREE.Raycaster();
  }

  get threshold() {
    const pixelSize = this.renderer.getPixelSize();
    const threshold = this.pixelThreshold / pixelSize;
    return threshold;
  }

  get ray() {
    return this.raycaster.ray;
  }

  get layers() {
    return this.raycaster.layers;
  }

  public setFromEvent(event: MouseEvent) {
    const pointer = this.renderer.getPointerFromEvent(event);
    this.raycaster.setFromCamera(pointer, this.renderer.camera);
  }

  intersectObjects<T extends OCGeometriesObject>(
    objects: T[],
    options: Partial<IntersectOptions> = {},
  ): Intersection<T>[] {
    const fullOptions = { ...defaultIntersectOptions, ...options };
    this.raycaster.params.Points.threshold = fullOptions.snapToPoints
      ? this.threshold
      : 0;
    this.raycaster.params.Line.threshold = fullOptions.snapToLines
      ? this.threshold
      : 0;
    const threeIntersections = this.raycaster.intersectObjects(objects, true);
    const intersections = threeIntersections.map((intersection) =>
      this.mapIntersection(intersection),
    ) as Intersection<T>[];
    return intersections;
  }

  cast<T extends OCGeometriesObject>(
    objects: T[],
    options: Partial<IntersectOptions> = {},
  ): Intersection<T> | undefined {
    const intersections = this.intersectObjects(objects, options);
    if (intersections.length === 0) {
      return;
    }

    const intersection = this.projectIntersectionOntoShape(intersections[0]);
    return intersection;
  }

  castSnapping<T extends OCGeometriesObject>(
    objects: T[],
    options: Partial<IntersectOptions> = {},
  ): Intersection<T> | undefined {
    const fullOptions = { ...defaultIntersectOptions, ...options };
    const intersections = this.intersectObjects(objects, fullOptions);
    if (intersections.length === 0) {
      return;
    }

    const snappedIntersection = this.getSnappedIntersection(
      intersections,
      fullOptions,
    );
    const intersection = this.projectIntersectionOntoShape(snappedIntersection);
    return intersection;
  }

  private mapIntersection(threeIntersection: THREE.Intersection): Intersection {
    const object = threeIntersection.object;
    const geometriesObject = object.parent;
    if (!(geometriesObject instanceof GeometriesObject)) {
      throw new Error('Invalid object: not an instance of GeometriesObject');
    }
    const geometries = geometriesObject.geometries as OCGeometries;

    const pointOnRay = this.ray.closestPointToPoint(
      threeIntersection.point,
      new THREE.Vector3(),
    );
    const distanceToRay = pointOnRay.distanceTo(threeIntersection.point);
    const baseIntersection: BaseIntersection = {
      point: threeIntersection.point,
      pointOnRay: pointOnRay,
      distance: threeIntersection.distance,
      distanceToRay: distanceToRay,
      object: geometriesObject as OCGeometriesObject,
    };

    let extra;
    if (this.isFace(object)) {
      if (threeIntersection.faceIndex == null) {
        throw new Error('Invalid face index');
      }
      extra = {
        face: geometries.faceMap[threeIntersection.faceIndex],
        faceIndex: threeIntersection.faceIndex,
      };
    } else if (this.isEdge(object)) {
      if (threeIntersection.index == null) {
        throw new Error('Invalid edge index');
      }
      const step = 2;
      const index = threeIntersection.index / step;
      extra = {
        edge: geometries.edgeMap[index],
        edgeIndex: index,
      };
    } else if (this.isVertex(object)) {
      if (threeIntersection.index == null) {
        throw new Error('Invalid vertex index');
      }
      extra = {
        vertex: geometries.vertexMap[threeIntersection.index],
        vertexIndex: threeIntersection.index,
      };
    } else {
      throw new Error('Invalid object type');
    }

    return {
      ...baseIntersection,
      ...extra,
    };
  }

  private isFace(object: THREE.Object3D) {
    return object instanceof THREE.Mesh;
  }
  private isEdge(object: THREE.Object3D) {
    return object instanceof THREE.LineSegments;
  }
  private isVertex(object: THREE.Object3D) {
    return object instanceof THREE.Points;
  }

  private projectIntersectionOntoShape<T extends OCGeometriesObject>(
    intersection: Intersection<T>,
  ): Intersection<T> {
    const point = intersection.point;
    const subShape =
      'face' in intersection
        ? intersection.face
        : 'edge' in intersection
        ? intersection.edge
        : 'vertex' in intersection
        ? intersection.vertex
        : undefined;
    if (subShape == null) {
      throw new Error('Intersection does not have a subshape');
    }

    const projectedPoint = projectOnto(point, subShape);
    return {
      ...intersection,
      point: projectedPoint,
    };
  }

  private getSnappedIntersection<T extends OCGeometriesObject>(
    intersections: Intersection<T>[],
    options: IntersectOptions,
  ): Intersection<T> {
    if (options.snapToPoints) {
      const nearbyVertexIntersection = this.getSnappedIntersectionOfType(
        intersections,
        'vertex',
      );
      if (nearbyVertexIntersection) {
        return nearbyVertexIntersection;
      }
    }

    if (options.snapToLines) {
      const nearbyEdgeIntersection = this.getSnappedIntersectionOfType(
        intersections,
        'edge',
      );
      if (nearbyEdgeIntersection) {
        return nearbyEdgeIntersection;
      }
    }

    return intersections[0];
  }

  /**
   * Get an intersection of the given type that is close to the closest intersection.
   *
   * Here is an explanation of what this method does for vertices. The same logic applies to edges.
   * When snapping to a vertex, there are often multiple vertices that are overlapping, or close to
   * one another. In these cases, we prefer snapping to a vertex that is part of an object whose
   * faces are also intersecting the raycasting ray. If no such vertex is found, or there are
   * multiple vertices on the same part, snap to the vertex that is closest to the ray (default
   * raycasting behaviour is to snap to the vertex closest to the camera).
   */
  private getSnappedIntersectionOfType<T extends OCGeometriesObject>(
    intersections: Intersection<T>[],
    type: 'edge' | 'vertex',
  ): Nullable<Intersection<T>> {
    const intersectionsOfType = this.getNearbyIntersectionsOfType(
      intersections,
      type,
    );
    if (intersectionsOfType.length === 0) {
      return null;
    } else if (intersectionsOfType.length === 1) {
      return intersectionsOfType[0];
    }

    const faceIntersections = intersections.filter(
      (intersection) => 'face' in intersection,
    );
    const objects = new Set([
      ...intersectionsOfType.map((intersection) => intersection.object),
    ]);
    const objectDistances = new Map(
      Array.from(objects).map((object) => [
        object,
        this.getObjectDistance(object, faceIntersections),
      ]),
    );
    const minDistance = _.min(Array.from(objectDistances.values()));

    const closestIntersections = intersectionsOfType.filter((intersection) => {
      const distance = objectDistances.get(intersection.object) ?? Infinity;
      return distance === minDistance;
    });

    const sortedIntersections = _.sortBy(closestIntersections, 'distanceToRay');
    return sortedIntersections[0];
  }

  private getNearbyIntersectionsOfType<T extends OCGeometriesObject>(
    intersections: Intersection<T>[],
    type: 'edge' | 'vertex',
  ): Intersection<T>[] {
    const visibleIntersections = [];
    const distance = intersections[0].distance;

    const objectsToCheckForVisibility = new Set(
      intersections.map((intersection) => intersection.object.faces),
    );
    for (const intersection of intersections) {
      if (intersection.distance - distance > 2 * this.threshold) {
        break;
      }
      if (
        type in intersection &&
        this.isVisible(intersection.point, objectsToCheckForVisibility)
      ) {
        visibleIntersections.push(intersection);
      }
    }

    return visibleIntersections;
  }

  private isVisible(point: THREE.Vector3, objects: Set<THREE.Mesh>): boolean {
    const raycaster = new THREE.Raycaster();
    raycaster.set(this.ray.origin, point.clone().sub(this.ray.origin));
    const faceIntersections = raycaster.intersectObjects(
      Array.from(objects),
      false,
    );

    const distance = this.ray.origin.distanceTo(point);
    for (const faceIntersection of faceIntersections) {
      if (faceIntersection.distance - distance > 1e-6) {
        break;
      }
      const isCorner = faceIntersection.point.distanceTo(point) < 1e-6;
      if (!isCorner) {
        return false;
      }
    }

    return true;
  }

  private getObjectDistance<T extends OCGeometriesObject>(
    object: T,
    intersections: Intersection<T>[],
  ): number {
    const intersection = intersections.find(
      (intersection) => intersection.object === object,
    );
    if (intersection) {
      return intersection.distance;
    } else {
      return Infinity;
    }
  }
}
