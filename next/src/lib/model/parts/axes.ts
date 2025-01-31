import { pointFromVector } from '@/lib/geom/util';
import { axisDirections } from '@/lib/util/geometry';
import { getOC, TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { Part } from './part';

export type AxesInclude = 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz';
export interface AxesOptions {
  length: number;
  include: AxesInclude;
}
const defaultAxesOptions: AxesOptions = {
  length: 100,
  include: 'xyz',
};

export class Axes extends Part {
  private options: AxesOptions;

  constructor(
    options: Partial<AxesOptions> = {},
    position?: THREE.Vector3,
    quaternion?: THREE.Quaternion,
  ) {
    super(position, quaternion);
    this.options = { ...defaultAxesOptions, ...options };
  }

  get length() {
    return this.options.length;
  }
  set length(length: number) {
    this.options.length = length;
    this.onChange();
  }

  protected buildOCShape(): TopoDS_Shape {
    const oc = getOC();
    const wireMaker = new oc.BRepBuilderAPI_MakeWire_1();
    const origin = pointFromVector(new THREE.Vector3());

    for (const [axis, axisDirection] of Object.entries(axisDirections)) {
      if (!this.options.include.includes(axis)) {
        continue;
      }

      for (const direction of [1, -1]) {
        const vector = axisDirection
          .clone()
          .multiplyScalar(this.length * direction);
        const end = pointFromVector(vector);
        const edgeMaker = new oc.BRepBuilderAPI_MakeEdge_3(origin, end);
        wireMaker.Add_1(edgeMaker.Edge());
      }
    }

    const shape = wireMaker.Wire();
    return shape;
  }
}
