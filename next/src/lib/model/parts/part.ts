import { THREE } from '@lib/three.js';
import { BasePart } from './base-part';
import { PartVertex } from './part-vertex';

export abstract class Part extends BasePart {
  private _size: THREE.Vector3;
  /**
   * Each vertex in this array corresponds to a corner of the part. The vertices are ordered as
   * follows: (0, 0, 0); (1, 0, 0); (0, 1, 0); (1, 1, 0); (0, 0, 1); (1, 0, 1); (0, 1, 1); (1, 1, 1).
   */
  private _vertices: PartVertex<this>[];

  constructor(
    size = new THREE.Vector3(),
    position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
  ) {
    super(position, quaternion);
    this._size = size;
    this._vertices = this.createVertices();
  }

  get size() {
    return this._size;
  }
  set size(size: THREE.Vector3) {
    this._size = size;
    this.onChange();
  }

  get vertices() {
    return this._vertices;
  }

  protected createVertices() {
    const vertices: PartVertex<this>[] = [];
    for (const n of [0, 1]) {
      for (const v of [0, 1]) {
        for (const u of [0, 1]) {
          const localPosition = new THREE.Vector3(u, v, n);
          const vertex = new PartVertex(this, localPosition);
          vertices.push(vertex);
        }
      }
    }

    return vertices;
  }
}
