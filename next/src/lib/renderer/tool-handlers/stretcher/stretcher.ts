import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts/part';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';

export type Constraint = THREE.Plane | THREE.Line3;

export abstract class Stretcher<T extends Part = Part> {
  protected part: T;
  protected subShape: Vertex | Edge | Face;
  protected target: Target;

  constructor(part: T, subShape: Vertex | Edge | Face, target: Target) {
    this.part = part;
    this.subShape = subShape;
    this.target = target;
  }

  abstract stretch(delta: THREE.Vector3): void;
  abstract cancel(): void;
  abstract getConstraint(point: THREE.Vector3): Nullable<Constraint>;
}
