import { Part, PartVertex } from '@/lib/model/parts';
import { Entity } from '@lib/solvespace';
import { SolverPart } from './solver-part';
import { SolverWorkplane } from './solver-workplane';

export class SolverVertex<T extends Part = Part> {
  public readonly solverPart: SolverPart<T>;
  public readonly vertex: PartVertex<T>;
  public readonly workplane: SolverWorkplane;
  public readonly point: Entity;

  constructor(
    solverPart: SolverPart<T>,
    vertex: PartVertex<T>,
    workplane: SolverWorkplane,
    point: Entity,
  ) {
    this.solverPart = solverPart;
    this.vertex = vertex;
    this.workplane = workplane;
    this.point = point;
  }
}
