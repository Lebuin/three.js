import { Pixels } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { OCGeometries } from '../geom/geometries';
import { projectOnto } from '../geom/projection';
import { Edge, Face, Vertex } from '../geom/shape';
import {
  GeometriesObject,
  OCGeometriesObject,
} from './part-objects/geometries-object';
import { Renderer } from './renderer';

export interface BaseIntersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> {
  point: THREE.Vector3;
  distance: number;
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
    const boundingRect = this.renderer.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2();
    pointer.x =
      ((event.clientX - boundingRect.left) / boundingRect.width) * 2 - 1;
    pointer.y = -(
      ((event.clientY - boundingRect.top) / boundingRect.height) * 2 -
      1
    );

    this.raycaster.setFromCamera(pointer, this.renderer.camera);
  }

  intersectObjects<T extends OCGeometriesObject>(
    objects: T[],
  ): Intersection<T>[] {
    this.raycaster.params.Points.threshold = this.threshold;
    this.raycaster.params.Line.threshold = this.threshold;
    const threeIntersections = this.raycaster.intersectObjects(objects, true);
    const intersections = threeIntersections.map((intersection) =>
      this.mapIntersection(intersection),
    ) as Intersection<T>[];
    return intersections;
  }

  cast<T extends OCGeometriesObject>(
    objects: T[],
  ): Intersection<T> | undefined {
    const intersections = this.intersectObjects(objects);
    if (intersections.length === 0) {
      return;
    }

    const intersection = this.projectIntersection(intersections[0]);
    return intersection;
  }

  castSnapping<T extends OCGeometriesObject>(
    objects: T[],
  ): Intersection<T> | undefined {
    const intersections = this.intersectObjects(objects);
    if (intersections.length === 0) {
      return;
    }

    const closestIntersection = intersections[0];
    const snappedIntersection = this.snapToIntersections(
      closestIntersection,
      intersections.slice(1),
    );

    const intersection = this.projectIntersection(snappedIntersection);
    return intersection;
  }

  private mapIntersection(threeIntersection: THREE.Intersection): Intersection {
    const object = threeIntersection.object;
    const geometriesObject = object.parent;
    if (!(geometriesObject instanceof GeometriesObject)) {
      throw new Error('Invalid object: not an instance of GeometriesObject');
    }
    const geometries = geometriesObject.geometries as OCGeometries;

    const baseIntersection: BaseIntersection = {
      point: threeIntersection.point,
      distance: threeIntersection.distance,
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

  private projectIntersection<T extends OCGeometriesObject>(
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

  private snapToIntersections<T extends OCGeometriesObject>(
    closestIntersection: Intersection<T>,
    intersections: Intersection<T>[],
  ): Intersection<T> {
    if ('vertex' in closestIntersection) {
      return closestIntersection;
    }

    const nearbyVertexIntersection = this.snapToIntersectionsOfType(
      closestIntersection,
      intersections,
      'vertex',
    );
    if (nearbyVertexIntersection) {
      return nearbyVertexIntersection;
    }

    if ('edge' in closestIntersection) {
      return closestIntersection;
    }

    const nearbyEdgeIntersection = this.snapToIntersectionsOfType(
      closestIntersection,
      intersections,
      'edge',
    );
    if (nearbyEdgeIntersection) {
      this.snapToIntersectionsOfType(
        closestIntersection,
        intersections,
        'edge',
      );
      return nearbyEdgeIntersection;
    }

    return closestIntersection;
  }

  private snapToIntersectionsOfType<T extends OCGeometriesObject>(
    closestIntersection: Intersection<T>,
    intersections: Intersection<T>[],
    type: 'edge' | 'vertex',
  ): Intersection<T> | undefined {
    const objectsToCheckForVisibility = new Set([
      closestIntersection.object.faces,
    ]);
    for (const intersection of intersections) {
      objectsToCheckForVisibility.add(intersection.object.faces);
      if (
        intersection.distance - closestIntersection.distance >
        this.threshold
      ) {
        return;
      }
      if (!(type in intersection)) {
        continue;
      }
      if (this.isVisible(intersection.point, objectsToCheckForVisibility)) {
        return intersection;
      }
    }
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
}
