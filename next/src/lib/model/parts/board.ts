import { directionFromVector } from '@/lib/geom/util';
import { getOC } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { Part } from './part';

export class Board extends Part {
  protected buildOCShape() {
    const numZeroes = this.absSize
      .toArray()
      .filter((x) => Math.abs(x) < 1e-6).length;
    if (numZeroes === 0) {
      return this.buildOCBox();
    } else if (numZeroes === 1) {
      return this.buildOCPlane();
    } else {
      throw new Error('Invalid size');
    }
  }

  private buildOCBox() {
    const oc = getOC();
    const box = new oc.BRepPrimAPI_MakeBox_2(...this.absSize.toArray());
    const shape = box.Shape();
    return shape;
  }

  private buildOCPlane() {
    const oc = getOC();
    const sides = this.absSize
      .toArray()
      .map((length, index) => ({ index, length }))
      .filter((side) => side.length >= 1e-6);

    const axisDirections = sides.map((side) => {
      const direction = new THREE.Vector3();
      direction.setComponent(side.index, 1);
      return direction;
    });
    const normal = new THREE.Vector3().crossVectors(
      axisDirections[0],
      axisDirections[1],
    );
    const origin = new oc.gp_Pnt_3(0, 0, 0);
    const axes = new oc.gp_Ax3_3(
      origin,
      directionFromVector(normal),
      directionFromVector(axisDirections[0]),
    );
    const plane = new oc.gp_Pln_2(axes);

    const faceMaker = new oc.BRepBuilderAPI_MakeFace_9(
      plane,
      0,
      sides[0].length,
      0,
      sides[1].length,
    );
    const face = faceMaker.Face();

    const builder = new oc.BRep_Builder();
    const shell = new oc.TopoDS_Shell();
    builder.MakeShell(shell);
    builder.Add(shell, face);

    return shell;
  }
}
