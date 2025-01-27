import { ShapeGeometry } from '@/lib/geom/shape-geometry';
import { TopoDS_Shape } from '@lib/opencascade.js';
import * as THREE from 'three';

interface PartEvents {
  change: object;
}

export abstract class Part extends THREE.EventDispatcher<PartEvents> {
  private _position: THREE.Vector3;
  private _quaternion: THREE.Quaternion;
  public temporary = false;

  protected geometry?: ShapeGeometry;

  constructor(position?: THREE.Vector3, quaternion?: THREE.Quaternion) {
    super();
    this._position = position ?? new THREE.Vector3();
    this._quaternion = quaternion ?? new THREE.Quaternion();
  }

  protected onChange() {
    this.invalidateOCShape();
    this.dispatchEvent({ type: 'change' });
  }

  get position() {
    return this._position;
  }
  set position(position: THREE.Vector3) {
    this._position = position;
    this.onChange();
  }

  get quaternion() {
    return this._quaternion;
  }
  set quaternion(quaternion: THREE.Quaternion) {
    this._quaternion = quaternion;
    this.onChange();
  }

  protected invalidateOCShape() {
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = undefined;
    }
  }

  public getGeometry() {
    if (!this.geometry) {
      const shape = this.buildOCShape();
      this.geometry = new ShapeGeometry(shape);
    }
    return this.geometry;
  }

  protected abstract buildOCShape(): TopoDS_Shape;
}
