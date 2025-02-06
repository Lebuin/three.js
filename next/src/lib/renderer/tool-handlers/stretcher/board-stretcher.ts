import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Board } from '@/lib/model/parts/board';
import { intersectPlanes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Target } from '../target-finder';
import { Constraint, Stretcher } from './stretcher';

export class BoardStretcher extends Stretcher<Board> {
  private startPosition: THREE.Vector3;
  private startSize: THREE.Vector3;
  private stretchMask: THREE.Vector3;
  private moveMask: THREE.Vector3;

  constructor(part: Board, subShape: Vertex | Edge | Face, target: Target) {
    super(part, subShape, target);
    this.startPosition = this.board.position.clone();
    this.startSize = this.board.size.clone();
    this.stretchMask = this.getStretchMask(target);
    this.moveMask = this.stretchMask.clone().addScalar(-1).divideScalar(-2);
  }

  get board() {
    return this.part;
  }

  private getStretchMask(target: Target): THREE.Vector3 {
    const localTarget = target.constrainedPoint
      .clone()
      .sub(this.board.position)
      .applyQuaternion(this.board.quaternion.clone().invert());
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
      .applyQuaternion(this.board.quaternion.clone().invert());
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
      .applyQuaternion(this.board.quaternion);

    const position = this.startPosition.clone().add(globalPositionDelta);
    const size = this.startSize.clone().add(stretchDelta);

    for (let i = 0; i < 3; i++) {
      const length = size.getComponent(i);
      if (length < 0) {
        size.setComponent(i, -length);
        const globalDirection = new THREE.Vector3()
          .setComponent(i, 1)
          .applyQuaternion(this.board.quaternion);
        position.add(globalDirection.clone().multiplyScalar(length));
      }
    }

    this.board.position = position;
    this.board.size = size;
  }

  cancel() {
    this.board.position = this.startPosition;
    this.board.size = this.startSize;
  }

  getConstraint(point: THREE.Vector3): Constraint {
    if (this.subShape instanceof Vertex) {
      return this.getVertexConstraints(this.subShape, point);
    } else if (this.subShape instanceof Edge) {
      return this.getEdgeConstraints(this.subShape, point);
    } else if (this.subShape instanceof Face) {
      return this.getFaceConstraints(this.subShape, point);
    } else {
      throw new Error('Invalid subShape');
    }
  }

  private getVertexConstraints(
    vertex: Vertex,
    point: THREE.Vector3,
  ): Constraint {
    const plane = this.getBoardConstraintPlane(point);
    return plane;
  }

  private getEdgeConstraints(edge: Edge, point: THREE.Vector3): Constraint {
    const plane = this.getBoardConstraintPlane(point);
    const edgeDirection = edge.getDirection();
    const edgePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      edgeDirection,
      point,
    );
    const intersection = intersectPlanes(plane, edgePlane);
    if (intersection) {
      return intersection;
    } else {
      return plane;
    }
  }

  private getFaceConstraints(face: Face, point: THREE.Vector3): Constraint {
    const plane = this.getBoardConstraintPlane(point);
    const faceNormal = face.getNormal();
    const projectedFaceNormal = faceNormal.clone().projectOnPlane(plane.normal);
    if (projectedFaceNormal.length() < 1e-6) {
      const line = new THREE.Line3(point, point.clone().add(faceNormal));
      return line;
    } else {
      projectedFaceNormal.normalize();
      const line = new THREE.Line3(
        point,
        point.clone().add(projectedFaceNormal),
      );
      return line;
    }
  }

  private getBoardConstraintPlane(point: THREE.Vector3): THREE.Plane {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.board.quaternion,
    );
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      point,
    );
    return plane;
  }
}
