import { THREE } from '@lib/three.js';
import { GeometriesObject } from './part-objects/geometries-object';

const _point1 = new THREE.Vector3();
const _point2 = new THREE.Vector3();
const _line = new THREE.Line3();
const _intersection = new THREE.Vector3();

export class Frustum {
  private frustum: THREE.Frustum;

  constructor(frustum: THREE.Frustum) {
    this.frustum = frustum;
  }

  static createFromSelection(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    start: THREE.Vector2,
    end: THREE.Vector2,
  ) {
    const frustum = Frustum.getSubFrustumFromSelection(camera, start, end);
    return new Frustum(frustum);
  }

  private static getSubFrustumFromSelection(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    start: THREE.Vector2,
    end: THREE.Vector2,
    deep = Number.MAX_VALUE,
  ) {
    const startPoint = start.clone();
    const endPoint = end.clone();

    if (startPoint.x === endPoint.x) {
      endPoint.x += Number.EPSILON;
    }
    if (startPoint.y === endPoint.y) {
      endPoint.y += Number.EPSILON;
    }

    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if (camera instanceof THREE.PerspectiveCamera) {
      return Frustum.getPerspectiveSubFrustum(
        camera,
        startPoint,
        endPoint,
        deep,
      );
    } else {
      return Frustum.getOrthographicSubFrustum(camera, startPoint, endPoint);
    }
  }

  private static getPerspectiveSubFrustum(
    camera: THREE.PerspectiveCamera,
    startPoint: THREE.Vector2,
    endPoint: THREE.Vector2,
    deep: number,
  ) {
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.max(startPoint.y, endPoint.y);
    const right = Math.max(startPoint.x, endPoint.x);
    const bottom = Math.min(startPoint.y, endPoint.y);

    const vecNear = new THREE.Vector3().setFromMatrixPosition(
      camera.matrixWorld,
    );
    const vecTopLeft = new THREE.Vector3(left, top, 0.5).unproject(camera);
    const vecTopRight = new THREE.Vector3(right, top, 0).unproject(camera);
    const vecBottomRight = new THREE.Vector3(right, bottom, 0.5).unproject(
      camera,
    );
    const vecBottomLeft = new THREE.Vector3(left, bottom, 0).unproject(camera);

    const vecTmp1 = new THREE.Vector3()
      .copy(vecTopLeft)
      .sub(vecNear)
      .normalize()
      .multiplyScalar(deep)
      .add(vecNear);
    const vecTmp2 = new THREE.Vector3()
      .copy(vecTopRight)
      .sub(vecNear)
      .normalize()
      .multiplyScalar(deep)
      .add(vecNear);
    const vecTmp3 = new THREE.Vector3()
      .copy(vecBottomRight)
      .sub(vecNear)
      .normalize()
      .multiplyScalar(deep)
      .add(vecNear);

    const frustum = new THREE.Frustum();
    const planes = frustum.planes;
    planes[0].setFromCoplanarPoints(vecNear, vecTopLeft, vecTopRight);
    planes[1].setFromCoplanarPoints(vecNear, vecTopRight, vecBottomRight);
    planes[2].setFromCoplanarPoints(vecBottomRight, vecBottomLeft, vecNear);
    planes[3].setFromCoplanarPoints(vecBottomLeft, vecTopLeft, vecNear);
    planes[4].setFromCoplanarPoints(vecTopRight, vecBottomRight, vecBottomLeft);
    planes[5].setFromCoplanarPoints(vecTmp3, vecTmp2, vecTmp1);
    planes[5].normal.multiplyScalar(-1);

    return frustum;
  }

  private static getOrthographicSubFrustum(
    camera: THREE.OrthographicCamera,
    startPoint: THREE.Vector2,
    endPoint: THREE.Vector2,
  ) {
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.max(startPoint.y, endPoint.y);
    const right = Math.max(startPoint.x, endPoint.x);
    const bottom = Math.min(startPoint.y, endPoint.y);

    const vTopLeft = new THREE.Vector3(left, top, -1).unproject(camera);
    const vTopRight = new THREE.Vector3(right, top, -1).unproject(camera);
    const vBottomRight = new THREE.Vector3(right, bottom, -1).unproject(camera);
    const vBottomLeft = new THREE.Vector3(left, bottom, -1).unproject(camera);

    const vFarTopLeft = new THREE.Vector3(left, top, 1).unproject(camera);
    const vFarTopRight = new THREE.Vector3(right, top, 1).unproject(camera);
    const vFarBottomRight = new THREE.Vector3(right, bottom, 1).unproject(
      camera,
    );
    const vecFarBottomLeft = new THREE.Vector3(left, bottom, 1).unproject(
      camera,
    );

    const frustum = new THREE.Frustum();
    const planes = frustum.planes;
    planes[0].setFromCoplanarPoints(vTopLeft, vFarTopLeft, vFarTopRight);
    planes[1].setFromCoplanarPoints(vTopRight, vFarTopRight, vFarBottomRight);
    planes[2].setFromCoplanarPoints(
      vFarBottomRight,
      vecFarBottomLeft,
      vBottomLeft,
    );
    planes[3].setFromCoplanarPoints(vecFarBottomLeft, vFarTopLeft, vTopLeft);
    planes[4].setFromCoplanarPoints(vTopRight, vBottomRight, vBottomLeft);
    planes[5].setFromCoplanarPoints(vFarBottomRight, vFarTopRight, vFarTopLeft);
    planes[5].normal.multiplyScalar(-1);

    return frustum;
  }

  getContained<T extends GeometriesObject>(objects: T[]): T[] {
    return objects.filter((object) => this.containsObject(object));
  }

  getIntersecting<T extends GeometriesObject>(objects: T[]): T[] {
    return objects.filter((object) => this.intersectsObject(object));
  }

  intersectsObject<T extends GeometriesObject>(object: T): boolean {
    const vertices = object.geometries.vertices;
    const vertexPositions = vertices.getAttribute('position');
    for (let i = 0; i < vertexPositions.count; i++) {
      _point1.fromBufferAttribute(vertexPositions, i);
      if (this.containsPoint(_point1)) {
        return true;
      }
    }

    const edges = object.geometries.edges;
    const index = edges.getIndex();
    const edgePositions = edges.getAttribute('position');
    const count = (index ? index.count : edgePositions.count) / 2;
    for (let i = 0; i < count; i++) {
      _point1.fromBufferAttribute(
        edgePositions,
        index ? index.array[i * 2] : i * 2,
      );
      _point2.fromBufferAttribute(
        edgePositions,
        index ? index.array[i * 2 + 1] : i * 2 + 1,
      );
      _line.set(_point1, _point2);
      if (this.intersectsLine(_line)) {
        return true;
      }
    }

    return false;
  }

  containsObject<T extends GeometriesObject>(object: T): boolean {
    const vertices = object.geometries.vertices;
    const vertexPositions = vertices.getAttribute('position');
    for (let i = 0; i < vertexPositions.count; i++) {
      _point1.fromBufferAttribute(vertexPositions, i);
      if (!this.containsPoint(_point1)) {
        return false;
      }
    }
    return true;
  }

  containsPoint(point: THREE.Vector3) {
    // We ignore the final 2 planes, these are the near and far planes
    for (let i = 0; i < 4; i++) {
      if (this.frustum.planes[i].distanceToPoint(point) < 0) {
        return false;
      }
    }

    return true;
  }

  intersectsLine(line: THREE.Line3) {
    // We ignore the final 2 planes, these are the near and far planes
    for (let i = 0; i < 4; i++) {
      const intersection = this.frustum.planes[i].intersectLine(
        line,
        _intersection,
      );
      if (intersection && this.containsPoint(intersection)) {
        return true;
      }
    }
    return false;
  }
}
