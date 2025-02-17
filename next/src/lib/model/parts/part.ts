import { quaternionFromQuaternion, vectorFromVector } from '@/lib/geom/util';
import { getOC, gp_Trsf } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { BasePart } from './base-part';
import { PartVertex } from './part-vertex';

export abstract class Part extends BasePart {
  private _size: THREE.Vector3;
  private _absPosition?: THREE.Vector3;

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
  get absSize() {
    return new THREE.Vector3(
      Math.abs(this.size.x),
      Math.abs(this.size.y),
      Math.abs(this.size.z),
    );
  }

  get position() {
    return super.position;
  }
  set position(position: THREE.Vector3) {
    this._absPosition = undefined;
    super.position = position;
  }
  get absPosition() {
    if (this._absPosition == null) {
      this._absPosition = this.position.clone();
      for (let i = 0; i < 3; i++) {
        const length = this.size.getComponent(i);
        if (length < 0) {
          const globalDirection = new THREE.Vector3()
            .setComponent(i, 1)
            .applyQuaternion(this.quaternion);
          this._absPosition.add(globalDirection.clone().multiplyScalar(length));
        }
      }
    }
    return this._absPosition;
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

  getConnectedParts(): Set<Part> {
    const connectedParts = new Set<Part>();
    for (const vertex of this.vertices) {
      for (const constraint of vertex.constraints) {
        const otherVertex =
          constraint.vertex1 === vertex
            ? constraint.vertex2
            : constraint.vertex1;
        const otherPart = otherVertex.part;
        connectedParts.add(otherPart);
      }
    }
    return connectedParts;
  }

  getOCTransform(): gp_Trsf {
    const oc = getOC();
    const transform = new oc.gp_Trsf_1();
    const quaternion = quaternionFromQuaternion(this.quaternion);
    const translation = vectorFromVector(this.absPosition);
    transform.SetTransformation_3(quaternion, translation);
    return transform;
  }
}
