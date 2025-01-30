import { getOC } from '@/lib/geom/oc';
import { directionFromVector, pointFromVector } from '@/lib/geom/util';
import { TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { Part } from './part';
export class Plane extends Part {
  private _size: number;

  constructor(
    size: number,
    position?: THREE.Vector3,
    quaternion?: THREE.Quaternion,
  ) {
    super(position, quaternion);
    this._size = size;
  }

  get size() {
    return this._size;
  }
  set size(size: number) {
    this._size = size;
    this.onChange();
  }

  protected buildOCShape(): TopoDS_Shape {
    const oc = getOC();
    const origin = pointFromVector(new THREE.Vector3());
    const normal = directionFromVector(new THREE.Vector3(0, 1, 0));
    const plane = new oc.gp_Pln_3(origin, normal);
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_9(
      plane,
      -this.size,
      this.size,
      -this.size,
      this.size,
    );
    const face = faceMaker.Shape();

    const shell = new oc.TopoDS_Shell();
    const builder = new oc.BRep_Builder();
    builder.MakeShell(shell);
    builder.Add(shell, face);

    return shell;
  }
}
