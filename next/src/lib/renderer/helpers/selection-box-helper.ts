import { Color4 } from '@/lib/util/color4';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { Renderer } from '../renderer';
import { SelectionFrustum } from '../selection-frustum';
import { UpdatingObjectMixin } from './updating-object-mixin';

export enum Direction {
  TO_RIGHT,
  TO_LEFT,
}

export interface SelectionBoxColor {
  border: Color4;
  fill: Color4;
}
export type SelectionBoxColors = Record<Direction, SelectionBoxColor>;

const defaultColors: SelectionBoxColors = {
  [Direction.TO_RIGHT]: {
    border: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 0.5),
    fill: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 0.15),
  },
  [Direction.TO_LEFT]: {
    border: new Color4().setHSLA(323 / 360, 57 / 100, 51 / 100, 0.5),
    fill: new Color4().setHSLA(323 / 360, 57 / 100, 51 / 100, 0.15),
  },
};

/**
 * Render a semi-transparent selection box.
 */
export class SelectionBoxHelper extends UpdatingObjectMixin(THREE.Group) {
  private renderer: Renderer;
  /**
   * The boundaries of the selection box, in relative screen coordinates (-1 is top/left of the
   * screen, 1 is bottom/right of the screen)
   */
  private _start = new THREE.Vector2();
  private _end = new THREE.Vector2();
  private colors = defaultColors;

  private group: THREE.Group;
  private meshMaterial: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;
  private lineSegmentsMaterial: THREE.LineBasicMaterial;
  private lineSegments: THREE.LineSegments;

  constructor(renderer: Renderer, colors: Partial<SelectionBoxColors> = {}) {
    super();
    this.renderer = renderer;

    this.group = new THREE.Group();
    this.add(this.group);

    const planeGeometry = new THREE.PlaneGeometry();
    this.meshMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(planeGeometry, this.meshMaterial);
    this.group.add(this.mesh);

    const edgesGeometry = new THREE.EdgesGeometry(planeGeometry);
    this.lineSegmentsMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      depthTest: false,
    });
    this.lineSegments = new THREE.LineSegments(
      edgesGeometry,
      this.lineSegmentsMaterial,
    );
    this.group.add(this.lineSegments);

    this.setColors(colors);
  }

  get direction() {
    return this._end.x >= this._start.x
      ? Direction.TO_RIGHT
      : Direction.TO_LEFT;
  }

  setColors(colors: Partial<SelectionBoxColors>) {
    this.colors = _.merge({}, defaultColors, colors);
    this.updateColor();
  }

  updateColor() {
    const color = this.colors[this.direction];
    this.meshMaterial.color = color.fill;
    this.meshMaterial.opacity = color.fill.a;
    this.meshMaterial.needsUpdate = true;
    this.lineSegmentsMaterial.color = color.border;
    this.lineSegmentsMaterial.opacity = color.border.a;
    this.lineSegmentsMaterial.needsUpdate = true;
  }

  get start() {
    return this._start;
  }
  set start(corner: THREE.Vector2) {
    const oldDirection = this.direction;
    this._start.copy(corner);
    const newDirection = this.direction;
    if (oldDirection !== newDirection) {
      this.updateColor();
    }
  }

  get end() {
    return this._end;
  }
  set end(corner: THREE.Vector2) {
    const oldDirection = this.direction;
    this._end.copy(corner);
    const newDirection = this.direction;
    if (oldDirection !== newDirection) {
      this.updateColor();
    }
  }

  update() {
    // Get the coordinates of the screen center on the plane perpendicular to the camera direction
    // and through the origin.
    const screenCenter = this.renderer.camera.position
      .clone()
      .projectOnPlane(
        this.renderer.camera.getWorldDirection(new THREE.Vector3()),
      );

    this.position.copy(screenCenter);
    this.quaternion.copy(this.renderer.camera.quaternion);

    // Set the scale to match the mouse coordinates: [-1, -1] is top-left, [1, 1] is bottom-right
    const pixelSize = this.renderer.getPixelSize(this.position);
    this.scale.set(
      (pixelSize * this.renderer.canvas.clientWidth) / 2,
      (pixelSize * this.renderer.canvas.clientHeight) / 2,
      1,
    );
    this.group.scale.set(
      this.end.x - this.start.x,
      this.end.y - this.start.y,
      1,
    );
    this.group.position.set(
      (this.start.x + this.end.x) / 2,
      (this.start.y + this.end.y) / 2,
      0,
    );
  }

  ///
  // Build a frustum

  getSelectionFrustum(
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
  ) {
    const frustum = this.getSubFrustum(camera);
    return new SelectionFrustum(frustum);
  }

  /**
   * Get a frustum that represents the part of the camera frustum that is visible in the selection.
   *
   * Based on three.js/examples/jsm/interactive/SelectionBox.js
   */
  private getSubFrustum(
    camera: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    deep = this.renderer.camera.far,
  ) {
    const startPoint = this.start.clone();
    const endPoint = this.end.clone();

    if (startPoint.x === endPoint.x) {
      endPoint.x += Number.EPSILON;
    }
    if (startPoint.y === endPoint.y) {
      endPoint.y += Number.EPSILON;
    }

    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    if (camera instanceof THREE.PerspectiveCamera) {
      return this.getPerspectiveSubFrustum(camera, startPoint, endPoint, deep);
    } else {
      return this.getOrthographicSubFrustum(camera, startPoint, endPoint);
    }
  }

  private getPerspectiveSubFrustum(
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

  private getOrthographicSubFrustum(
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
}
