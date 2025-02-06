import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Beam } from '@/lib/model/parts/beam';
import { vectorsAreParallel } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';
import { Constraint, Stretcher } from './stretcher';

export class BeamStretcher extends Stretcher<Beam> {
  private startPosition: THREE.Vector3;
  private startSize: THREE.Vector3;
  private stretchMask: THREE.Vector3;
  private moveMask: THREE.Vector3;

  constructor(part: Beam, subShape: Vertex | Edge | Face, target: Target) {
    super(part, subShape, target);
    this.startPosition = this.beam.position.clone();
    this.startSize = this.beam.size.clone();
    this.stretchMask = this.getStretchMask(target);
    this.moveMask = this.stretchMask.clone().addScalar(-1).divideScalar(-2);
  }

  get beam() {
    return this.part;
  }

  private getStretchMask(target: Target): THREE.Vector3 {
    const localTarget = target.constrainedPoint
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

  stretch(delta: THREE.Vector3) {
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

  getConstraint(point: THREE.Vector3): Nullable<Constraint> {
    const beamDirection = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(this.beam.quaternion)
      .normalize();

    if (this.subShape instanceof Edge) {
      const isParallel = vectorsAreParallel(
        beamDirection,
        this.subShape.getDirection(),
      );
      if (isParallel) {
        return null;
      }
    } else if (this.subShape instanceof Face) {
      const faceNormal = this.subShape.getNormal();
      const isPerpendicular = vectorsAreParallel(beamDirection, faceNormal);
      if (!isPerpendicular) {
        return null;
      }
    }

    return new THREE.Line3(point.clone(), point.clone().add(beamDirection));
  }
}
