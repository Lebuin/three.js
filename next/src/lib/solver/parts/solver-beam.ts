import { Beam } from '@/lib/model/parts';
import { Solver } from '../solver';
import { SolverPart } from './solver-part';
import { SolverVertex } from './solver-vertex';

export class SolverBeam<T extends Beam> extends SolverPart<T> {
  addConstraints(solver: Solver, vertices: SolverVertex<T>[]) {
    solver.slvs.distance(
      solver.groupSolve,
      vertices[0].point,
      vertices[2].point,
      this.part.size.y,
      solver.slvs.E_FREE_IN_3D,
    );
    solver.slvs.distance(
      solver.groupSolve,
      vertices[0].point,
      vertices[4].point,
      this.part.size.z,
      solver.slvs.E_FREE_IN_3D,
    );
  }
}
