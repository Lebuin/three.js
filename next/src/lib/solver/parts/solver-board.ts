import { Board } from '@/lib/model/parts';
import { Solver } from '../solver';
import { SolverPart } from './solver-part';
import { SolverVertex } from './solver-vertex';

export class SolverBoard<T extends Board> extends SolverPart<T> {
  addConstraints(solver: Solver, vertices: SolverVertex<T>[]) {
    solver.slvs.distance(
      solver.groupSolve,
      vertices[0].point,
      vertices[4].point,
      this.part.size.z,
      solver.slvs.E_FREE_IN_3D,
    );
  }
}
