import {
  RootShapeWithEdges,
  RootShapeWithFaces,
  shapeFactory,
} from '@/lib/geom/shape';
import { quaternionFromQuaternion, vectorFromVector } from '@/lib/geom/util';
import { getOC, gp_Trsf, TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
interface PartEvents {
  change: object;
}

export abstract class BasePart extends THREE.EventDispatcher<PartEvents> {
  private _position: THREE.Vector3;
  private _quaternion: THREE.Quaternion;

  protected _shape?: RootShapeWithEdges | RootShapeWithFaces;

  constructor(
    position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
  ) {
    super();
    this._position = position;
    this._quaternion = quaternion;
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
    this._shape = undefined;
  }

  get shape() {
    if (!this._shape) {
      const shape = this.buildOCShape();
      const locatedShape = this.locateOCShape(shape);
      this._shape = shapeFactory(locatedShape);
    }
    return this._shape;
  }

  protected abstract buildOCShape(): TopoDS_Shape;

  protected locateOCShape(shape: TopoDS_Shape) {
    const oc = getOC();
    // It should be possible, and way more efficient, to use shape.Located(location), but for some
    // reason OCCT doesn't always respect the local coordinate system of the shape, e.g. when using
    // BRepExtrema_DistShapeShape.
    const transform = this.getOCTransform();
    const transformer = new oc.BRepBuilderAPI_Transform_2(
      shape,
      transform,
      true,
    );
    const locatedShape = transformer.Shape();
    return locatedShape;
  }

  getOCTransform(): gp_Trsf {
    const oc = getOC();
    const transform = new oc.gp_Trsf_1();
    const quaternion = quaternionFromQuaternion(this.quaternion);
    const translation = vectorFromVector(this.position);
    transform.SetTransformation_3(quaternion, translation);
    return transform;
  }
}
