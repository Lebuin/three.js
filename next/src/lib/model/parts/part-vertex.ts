import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { CoincidentConstraint } from '../constraints';
import { Part } from './part';

export class PartVertex<T extends Part = Part> {
  public readonly part: T;
  private _localPosition: THREE.Vector3;
  private _constraints: CoincidentConstraint[] = [];

  constructor(part: T, localPosition: THREE.Vector3) {
    this.part = part;
    this._localPosition = localPosition;
  }

  get localPosition() {
    return this._localPosition;
  }

  get globalPosition() {
    return this._localPosition
      .clone()
      .multiply(this.part.size)
      .applyQuaternion(this.part.quaternion)
      .add(this.part.position);
  }

  get constraints() {
    return this._constraints;
  }

  addConstraint(constraint: CoincidentConstraint) {
    this._constraints.push(constraint);
  }

  removeConstraint(constraint: CoincidentConstraint) {
    _.pull(this._constraints, constraint);
  }
}
