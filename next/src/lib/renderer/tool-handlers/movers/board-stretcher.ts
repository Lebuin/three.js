import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Board } from '@/lib/model/parts/board';
import { intersectPlanes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Constraint } from './base-mover';
import { Stretcher } from './stretcher';

export class BoardStretcher extends Stretcher<Board> {
  isMovable() {
    if (this.subShape instanceof Face) {
      const plane = this.getBoardConstraintPlane(this.startPoint);
      const faceNormal = this.subShape.getNormal();
      const projectedFaceNormal = faceNormal
        .clone()
        .projectOnPlane(plane.normal);
      return projectedFaceNormal.length() >= 1e-6;
    } else {
      return true;
    }
  }

  getConstraint(): Nullable<Constraint> {
    if (this.subShape instanceof Vertex) {
      return this.getVertexConstraints(this.subShape, this.startPoint);
    } else if (this.subShape instanceof Edge) {
      return this.getEdgeConstraints(this.subShape, this.startPoint);
    } else if (this.subShape instanceof Face) {
      return this.getFaceConstraints(this.subShape, this.startPoint);
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

  private getFaceConstraints(
    face: Face,
    point: THREE.Vector3,
  ): Nullable<Constraint> {
    const plane = this.getBoardConstraintPlane(point);
    const faceNormal = face.getNormal();
    const projectedFaceNormal = faceNormal
      .clone()
      .projectOnPlane(plane.normal)
      .normalize();
    const line = new THREE.Line3(point, point.clone().add(projectedFaceNormal));
    return line;
  }

  private getBoardConstraintPlane(point: THREE.Vector3): THREE.Plane {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.part.quaternion,
    );
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      point,
    );
    return plane;
  }
}
