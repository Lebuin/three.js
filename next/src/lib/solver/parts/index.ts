import { Beam, Board, Part } from '@/lib/model/parts';
import { Solver } from '../solver';
import { SolverBeam } from './solver-beam';
import { SolverBoard } from './solver-board';
import { SolverPart } from './solver-part';

export { SolverBoard } from './solver-board';
export { SolverPart } from './solver-part';
export { SolverVertex } from './solver-vertex';

export function solverPartFactory<T extends Part>(
  solver: Solver,
  part: T,
): SolverPart<T> {
  if (part instanceof Board) {
    return new SolverBoard(solver, part);
  } else if (part instanceof Beam) {
    return new SolverBeam(solver, part);
  } else {
    throw new Error('Unknown part type');
  }
}
