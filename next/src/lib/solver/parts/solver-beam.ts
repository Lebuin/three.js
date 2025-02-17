import { Beam } from '@/lib/model/parts';
import { SolverPart } from './solver-part';
import { SolverVertex } from './solver-vertex';

export class SolverBeam<T extends Beam> extends SolverPart<T> {
  addConstraints(vertices: SolverVertex<T>[]) {
    this.solver.slvs.distance(
      this.solver.groupSolve,
      vertices[0].point,
      vertices[2].point,
      this.part.size.y,
      this.solver.slvs.E_FREE_IN_3D,
    );
    this.solver.slvs.distance(
      this.solver.groupSolve,
      vertices[0].point,
      vertices[4].point,
      this.part.size.z,
      this.solver.slvs.E_FREE_IN_3D,
    );
  }
}
