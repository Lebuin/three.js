import { CoincidentConstraint } from '@/lib/model/constraints';
import { Solver } from '../solver';
import { SolverVertex } from './solver-vertex';

export class SolverConstraint {
  public readonly constraint: CoincidentConstraint;
  public readonly solverVertex1: SolverVertex;
  public readonly solverVertex2: SolverVertex;

  constructor(
    constraint: CoincidentConstraint,
    solverVertex1: SolverVertex,
    solverVertex2: SolverVertex,
  ) {
    this.constraint = constraint;
    this.solverVertex1 = solverVertex1;
    this.solverVertex2 = solverVertex2;
  }

  addToSolver(solver: Solver) {
    solver.slvs.coincident(
      solver.groupSolve,
      this.solverVertex1.point,
      this.solverVertex2.point,
      solver.slvs.E_FREE_IN_3D,
    );
  }
}
