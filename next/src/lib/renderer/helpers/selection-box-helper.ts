import { Color4 } from '@/lib/util/color4';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { Renderer } from '../renderer';
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
    this.scale.set(
      (this.renderer.camera.right - this.renderer.camera.left) / 2,
      (this.renderer.camera.top - this.renderer.camera.bottom) / 2,
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
}
