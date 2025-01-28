import { getOC } from '@/lib/geom/oc';
import { RootShape, shapeFactory } from '@/lib/geom/shape';
import { quaternionFromQuaternion, vectorFromVector } from '@/lib/geom/util';
import { TopLoc_Location, TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
interface PartEvents {
  change: object;
}

export abstract class Part extends THREE.EventDispatcher<PartEvents> {
  private _position: THREE.Vector3;
  private _quaternion: THREE.Quaternion;

  protected _shape?: RootShape;

  constructor(position?: THREE.Vector3, quaternion?: THREE.Quaternion) {
    super();
    this._position = position ?? new THREE.Vector3();
    this._quaternion = quaternion ?? new THREE.Quaternion();
  }

  dispose() {
    this.invalidateShape();
  }

  protected onChange() {
    this.invalidateShape();
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

  protected invalidateShape() {
    if (this._shape) {
      this._shape.dispose();
      this._shape = undefined;
    }
  }

  get shape() {
    if (!this._shape) {
      const shape = this.buildOCShape();
      this.locateOCShape(shape);
      this._shape = shapeFactory(shape);
    }
    return this._shape;
  }

  protected abstract buildOCShape(): TopoDS_Shape;

  protected locateOCShape(shape: TopoDS_Shape) {
    const location = this.getOCLocation();
    shape.Location_2(location, true);
  }

  getOCLocation(): TopLoc_Location {
    const oc = getOC();
    const transform = new oc.gp_Trsf_1();
    const quaternion = quaternionFromQuaternion(this.quaternion);
    const translation = vectorFromVector(this.position);
    transform.SetTransformation_3(quaternion, translation);
    const location = new oc.TopLoc_Location_2(transform);
    return location;
  }
}
