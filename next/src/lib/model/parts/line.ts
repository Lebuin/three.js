import { pointFromVector } from '@/lib/geom/util';
import { getOC, TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { BasePart } from './base-part';

export class Line extends BasePart {
  private _length: number;

  constructor(
    length: number,
    position?: THREE.Vector3,
    quaternion?: THREE.Quaternion,
  ) {
    super(position, quaternion);
    this._length = length;
  }

  get length() {
    return this._length;
  }
  set length(length: number) {
    this._length = length;
    this.onChange();
  }

  protected buildOCShape(): TopoDS_Shape {
    const oc = getOC();
    const wireMaker = new oc.BRepBuilderAPI_MakeWire_1();
    const origin = pointFromVector(new THREE.Vector3());

    for (const direction of [1, -1]) {
      const vector = new THREE.Vector3(0, 0, this.length * direction);
      const end = pointFromVector(vector);
      const edgeMaker = new oc.BRepBuilderAPI_MakeEdge_3(origin, end);
      wireMaker.Add_1(edgeMaker.Edge());
    }

    const shape = wireMaker.Wire();
    return shape;
  }
}
