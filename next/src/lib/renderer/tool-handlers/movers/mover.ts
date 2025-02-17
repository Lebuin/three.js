import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';
import { BaseMover } from './base-mover';

export class Mover extends BaseMover<Part> {
  private startPosition: THREE.Vector3;

  constructor(part: Part, subShape: Vertex | Edge | Face, target: Target) {
    super(part, subShape, target);
    this.startPosition = this.part.position.clone();
  }

  isMovable() {
    return true;
  }

  getConstraint() {
    return null;
  }

  move(delta: THREE.Vector3) {
    this.part.position = this.startPosition.clone().add(delta);
  }
}
