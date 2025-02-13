import { PartVertex } from '../parts/part-vertex';
import { Constraint } from './constraint';

export class CoincidentConstraint extends Constraint {
  public readonly vertex1: PartVertex;
  public readonly vertex2: PartVertex;

  constructor(vertex1: PartVertex, vertex2: PartVertex) {
    super();
    this.vertex1 = vertex1;
    this.vertex2 = vertex2;
  }

  add() {
    this.vertex1.addConstraint(this);
    this.vertex2.addConstraint(this);
  }

  remove() {
    this.vertex1.removeConstraint(this);
    this.vertex2.removeConstraint(this);
  }
}
