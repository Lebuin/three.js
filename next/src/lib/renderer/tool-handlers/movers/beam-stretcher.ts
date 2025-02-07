import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Beam } from '@/lib/model/parts/beam';
import { vectorsAreParallel } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';
import { BaseMover, Constraint } from './base-mover';

export class BeamStretcher extends BaseMover<Beam> {
  private startPosition: THREE.Vector3;
  private startSize: THREE.Vector3;
  private stretchMask: THREE.Vector3;
  private moveMask: THREE.Vector3;

  constructor(part: Beam, subShape: Vertex | Edge | Face, target: Target) {
    super(part, subShape, target);
    this.startPosition = this.beam.position.clone();
    this.startSize = this.beam.size.clone();
    this.stretchMask = this.getStretchMask();
    this.moveMask = this.stretchMask.clone().addScalar(-1).divideScalar(-2);
  }

  get beam() {
    return this.part;
  }

  private getStretchMask(): THREE.Vector3 {
    const localTarget = this.startPoint
      .clone()
      .sub(this.beam.position)
      .applyQuaternion(this.beam.quaternion.clone().invert());
    const stretchMask = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      if (localTarget.getComponent(i) < 1e-6) {
        stretchMask.setComponent(i, -1);
      }
    }
    return stretchMask;
  }

  isMovable() {
    const beamDirection = this.getBeamDirection();

    if (this.subShape instanceof Edge) {
      const isParallel = vectorsAreParallel(
        beamDirection,
        this.subShape.getDirection(),
      );
      return !isParallel;
    } else if (this.subShape instanceof Face) {
      const faceNormal = this.subShape.getNormal();
      const isPerpendicular = vectorsAreParallel(beamDirection, faceNormal);
      return isPerpendicular;
    } else {
      return true;
    }
  }

  getConstraint(): Nullable<Constraint> {
    const beamDirection = this.getBeamDirection();
    return new THREE.Line3(
      this.startPoint.clone(),
      this.startPoint.clone().add(beamDirection),
    );
  }

  private getBeamDirection() {
    const beamDirection = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.beam.quaternion)
      .normalize();
    return beamDirection;
  }

  move(delta: THREE.Vector3) {
    const localDelta = delta
      .clone()
      .applyQuaternion(this.beam.quaternion.clone().invert());
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
      .applyQuaternion(this.beam.quaternion);

    const position = this.startPosition.clone().add(globalPositionDelta);
    const size = this.startSize.clone().add(stretchDelta);

    for (let i = 0; i < 3; i++) {
      const length = size.getComponent(i);
      if (length < 0) {
        size.setComponent(i, -length);
        const globalDirection = new THREE.Vector3()
          .setComponent(i, 1)
          .applyQuaternion(this.beam.quaternion);
        position.add(globalDirection.clone().multiplyScalar(length));
      }
    }

    this.beam.position = position;
    this.beam.size = size;
  }

  cancel() {
    this.beam.position = this.startPosition;
    this.beam.size = this.startSize;
  }
}
