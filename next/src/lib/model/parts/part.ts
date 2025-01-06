import * as THREE from 'three';

interface PartEventMap {
  change: object;
}

export abstract class Part extends THREE.EventDispatcher<PartEventMap> {
  private _position: THREE.Vector3;
  private _quaternion: THREE.Quaternion;

  constructor(position?: THREE.Vector3, quaternion?: THREE.Quaternion) {
    super();
    this._position = position ?? new THREE.Vector3();
    this._quaternion = quaternion ?? new THREE.Quaternion();
  }

  get position() {
    return this._position;
  }
  set position(position: THREE.Vector3) {
    this._position = position;
    this.dispatchEvent({ type: 'change' });
  }

  get quaternion() {
    return this._quaternion;
  }
  set quaternion(quaternion: THREE.Quaternion) {
    this._quaternion = quaternion;
    this.dispatchEvent({ type: 'change' });
  }
}
