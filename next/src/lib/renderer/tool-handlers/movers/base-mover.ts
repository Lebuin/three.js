import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';

export type Constraint = THREE.Plane | THREE.Line3;

export class ConstraintError extends Error {}

export abstract class BaseMover<T extends Part = Part> {
  public readonly part: T;
  public readonly subShape: Vertex | Edge | Face;
  public readonly target: Target;

  constructor(part: T, subShape: Vertex | Edge | Face, target: Target) {
    this.part = part;
    this.subShape = subShape;
    this.target = target;
  }

  get startPoint() {
    return this.target.constrainedPoint;
  }

  /**
   * Check whether a Mover can do any work on the given part and subShape.
   */
  abstract isMovable(): boolean;

  abstract move(delta: THREE.Vector3): void;

  /**
   * Get the constraint (a line or plane) on which the move destination has to lie.
   */
  abstract getConstraint(): Nullable<Constraint>;
}
