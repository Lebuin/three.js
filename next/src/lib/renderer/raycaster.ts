import { Pixels } from '@/lib/util/geometry';
import { TopoDS_Edge, TopoDS_Face, TopoDS_Vertex } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { OCGeometries } from '../geom/geometries';
import { projectOnto } from '../geom/projection';
import { GeometriesObject } from './part-objects/geometries-object';
import { Renderer } from './renderer';

type OCGeometriesObject = GeometriesObject<OCGeometries>;

export interface Intersection<
  T extends OCGeometriesObject = OCGeometriesObject,
> {
  point: THREE.Vector3;
  distance: number;

  object: T;
  face?: TopoDS_Face;
  edge?: TopoDS_Edge;
  vertex?: TopoDS_Vertex;
}

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

    const geometries = geometriesObject.geometries as unknown;
    if (!(geometries instanceof OCGeometries)) {
      throw new Error('Invalid object: not a OCGeometries');
    }

    const intersection: Intersection = {
      point: threeIntersection.point,
      distance: threeIntersection.distance,
      object: geometriesObject as OCGeometriesObject,
    };

    if (this.isFace(object)) {
      if (threeIntersection.faceIndex == null) {
        throw new Error('Invalid face index');
      }
      intersection.face = geometries.getFace(threeIntersection.faceIndex);
    } else if (this.isEdge(object)) {
      if (threeIntersection.index == null) {
        throw new Error('Invalid edge index');
      }
      intersection.edge = geometries.getEdge(threeIntersection.index);
    } else if (this.isVertex(object)) {
      if (threeIntersection.index == null) {
        throw new Error('Invalid vertex index');
      }
      intersection.vertex = geometries.getVertex(threeIntersection.index);
    } else {
      throw new Error('Invalid object type');
    }
    return intersection;
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
      intersection.face ?? intersection.edge ?? intersection.vertex;
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
    if (closestIntersection.vertex) {
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

    if (closestIntersection.face) {
      const closerEdgeIntersection = this.snapToIntersectionsOfType(
        closestIntersection,
        intersections,
        'edge',
      );
      if (closerEdgeIntersection) {
        return closerEdgeIntersection;
      }
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
      if (!intersection[type]) {
        continue;
      }
      if (this.isVisible(intersection.point, objectsToCheckForVisibility)) {
        return intersection;
      }
    }
  }

  private isVisible(point: THREE.Vector3, objects: Set<THREE.Mesh>): boolean {
    const raycaster = new THREE.Raycaster();
    raycaster.set(this.raycaster.ray.origin, point);
    const faceIntersections = raycaster.intersectObjects(
      Array.from(objects),
      false,
    );

    for (const faceIntersection of faceIntersections) {
      const isCorner = faceIntersection.point.distanceTo(point) < 1e-6;
      if (!isCorner) {
        return false;
      }
    }

    return true;
  }
}
