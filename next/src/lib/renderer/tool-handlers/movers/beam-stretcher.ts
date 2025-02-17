import { Edge, Face } from '@/lib/geom/shape';
import { Beam } from '@/lib/model/parts/beam';
import { vectorsAreParallel } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Constraint } from './base-mover';
import { Stretcher } from './stretcher';

export class BeamStretcher extends Stretcher<Beam> {
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
      .applyQuaternion(this.part.quaternion)
      .normalize();
    return beamDirection;
  }
}
