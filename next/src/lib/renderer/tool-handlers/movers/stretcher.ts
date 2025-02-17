import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Part } from '@/lib/model/parts';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';
import { BaseMover } from './base-mover';

export abstract class Stretcher<T extends Part> extends BaseMover<T> {
  private startPosition: THREE.Vector3;
  private startSize: THREE.Vector3;
  private stretchMask: THREE.Vector3;
  private moveMask: THREE.Vector3;

  constructor(part: T, subShape: Vertex | Edge | Face, target: Target) {
    super(part, subShape, target);
    this.startPosition = this.part.position.clone();
    this.startSize = this.part.size.clone();
    this.stretchMask = this.getStretchMask();
    this.moveMask = this.stretchMask.clone().addScalar(-1).divideScalar(-2);
  }

  private getStretchMask(): THREE.Vector3 {
    const localTarget = this.startPoint
      .clone()
      .sub(this.part.position)
      .applyQuaternion(this.part.quaternion.clone().invert());
    const stretchMask = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      if (Math.abs(localTarget.getComponent(i)) < 1e-6) {
        stretchMask.setComponent(i, -1);
      }
    }
    return stretchMask;
  }

  move(delta: THREE.Vector3) {
    const localDelta = delta
      .clone()
      .applyQuaternion(this.part.quaternion.clone().invert());
    localDelta.z = 0;
    const positionDelta = new THREE.Vector3().multiplyVectors(
      localDelta,
      this.moveMask,
    );
    const stretchDelta = new THREE.Vector3().multiplyVectors(
      localDelta,
      this.stretchMask,
    );

    const globalPositionDelta = positionDelta
      .clone()
      .applyQuaternion(this.part.quaternion);

    const position = this.startPosition.clone().add(globalPositionDelta);
    const size = this.startSize.clone().add(stretchDelta);

    this.part.position = position;
    this.part.size = size;
  }
}
