import { Entity } from '@lib/solvespace';

export class SolverWorkplane {
  public readonly workplane: Entity;
  public readonly origin: Entity;
  public readonly quaternion: Entity;

  constructor(workplane: Entity, origin: Entity, quaternion: Entity) {
    this.workplane = workplane;
    this.origin = origin;
    this.quaternion = quaternion;
  }
}
