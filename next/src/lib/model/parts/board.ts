import * as THREE from 'three';
import { Part } from './part';

export class Board extends Part {
  private _size: THREE.Vector3;

  constructor(
    size?: THREE.Vector3,
    position?: THREE.Vector3,
    quaternion?: THREE.Quaternion,
  ) {
    super(position, quaternion);
    this._size = size ?? new THREE.Vector3();
  }

  get size() {
    return this._size;
  }
  set size(size: THREE.Vector3) {
    this._size = size;
    this.dispatchEvent({ type: 'change' });
  }
}
