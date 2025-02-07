import { THREE } from '@lib/three.js';
import { GeometriesObject } from './part-objects/geometries-object';

const _point1 = new THREE.Vector3();
const _point2 = new THREE.Vector3();
const _line = new THREE.Line3();
const _intersection = new THREE.Vector3();

/**
 * A frustum that can be used to check if objects are contained or intersected by the frustum.
 * Contrary to a regular frustum, checks in this class are exact and do not rely on approximations.
 */
export class SelectionFrustum {
  public frustum: THREE.Frustum;

  constructor(frustum: THREE.Frustum) {
    this.frustum = frustum;
  }

  getContained<T extends GeometriesObject>(objects: T[]): T[] {
    return objects.filter((object) => this.containsObject(object));
  }

  getIntersecting<T extends GeometriesObject>(objects: T[]): T[] {
    return objects.filter((object) => this.intersectsObject(object));
  }

  intersectsObject<T extends GeometriesObject>(object: T): boolean {
    const vertices = object.geometries.vertices;
    const vertexPositions = vertices.getAttribute('position');
    for (let i = 0; i < vertexPositions.count; i++) {
      _point1.fromBufferAttribute(vertexPositions, i);
      if (this.containsPoint(_point1)) {
        return true;
      }
    }

    const edges = object.geometries.edges;
    const index = edges.getIndex();
    const edgePositions = edges.getAttribute('position');
    const count = (index ? index.count : edgePositions.count) / 2;
    for (let i = 0; i < count; i++) {
      _point1.fromBufferAttribute(
        edgePositions,
        index ? index.array[i * 2] : i * 2,
      );
      _point2.fromBufferAttribute(
        edgePositions,
        index ? index.array[i * 2 + 1] : i * 2 + 1,
      );
      _line.set(_point1, _point2);
      if (this.intersectsLine(_line)) {
        return true;
      }
    }

    return false;
  }

  containsObject<T extends GeometriesObject>(object: T): boolean {
    const vertices = object.geometries.vertices;
    const vertexPositions = vertices.getAttribute('position');
    for (let i = 0; i < vertexPositions.count; i++) {
      _point1.fromBufferAttribute(vertexPositions, i);
      if (!this.containsPoint(_point1)) {
        return false;
      }
    }
    return true;
  }

  containsPoint(point: THREE.Vector3) {
    for (let i = 0; i < 6; i++) {
      if (this.frustum.planes[i].distanceToPoint(point) < 0) {
        return false;
      }
    }

    return true;
  }

  intersectsLine(line: THREE.Line3) {
    for (let i = 0; i < 6; i++) {
      const intersection = this.frustum.planes[i].intersectLine(
        line,
        _intersection,
      );
      if (intersection && this.containsPoint(intersection)) {
        return true;
      }
    }
    return false;
  }
}
