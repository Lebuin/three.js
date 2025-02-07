import { THREE } from '@lib/three.js';
import { axisDirections } from '../util/geometry';
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _EPS = 0.000001;

// Add internal properties that we need in our overriden methods
declare module 'three/examples/jsm/Addons.js' {
  interface OrbitControls {
    _lastPosition: THREE.Vector3;
    _lastQuaternion: THREE.Quaternion;
    _lastTargetPosition: THREE.Vector3;

    _panOffset: THREE.Vector3;
    _sphericalDelta: THREE.Spherical;
    _scale: number;

    _mouse: THREE.Vector2;
    _performCursorZoom: boolean;

    object: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  }
}

/**
 * A version of {@link THREE.OrbitControls} that supports an off-center target and 360° tilting.
 *
 * We reuse all event handling in OrbitControls, but reimplement the actual algorithm for
 * calculating a new camera position and angle. We don't support most of the options for tweaking
 * the original algorithm, like min/maxDistance, min/maxZoom,...
 */
export class OrbitControls extends THREE.OrbitControls {
  mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  zoomToCursor = true;
  zoomSpeed = 3;
  minZoom = 0.05;
  minDistance = 100;

  rotateTarget = new THREE.Vector3();
  zoomTarget = new THREE.Vector3();

  _lastZoom = 1;

  constructor(
    object: THREE.OrthographicCamera | THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
  ) {
    super(object, canvas);
    this.update();
  }

  update() {
    // The parent class calls this.update() in its constructor, but at that point our custom
    // properties have not been initialized yet, so we do an early return in that case, and call
    // this.update() again in our own constructor.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.rotateTarget == null) {
      return false;
    }

    this.updatePan();
    this.updateRotate();
    this.updateZoom();
    return this.emitChange();
  }

  /**
   * Pan the camera in its own plane.
   */
  private updatePan() {
    this.object.position.add(this._panOffset);
    this._panOffset.set(0, 0, 0);
  }

  /**
   * Update the angle of the camera. Also updates the position, so that {@link .target} stays in
   * the same position on the screen.
   */
  private updateRotate() {
    this.object.updateWorldMatrix(true, false);
    const targetBefore = _v;
    const cameraY = _v2;
    const cameraZ = _v3;
    targetBefore.copy(this.rotateTarget).project(this.object);

    this.object.rotateOnWorldAxis(
      new THREE.Vector3(0, 1, 0),
      this._sphericalDelta.theta,
    );

    // Calculate the angle between the world direction and the ground plane. We never want this
    // angle to exceed Math.PI, i.e. the camera should never be upside down.
    cameraY.set(0, 1, 0).applyQuaternion(this.object.quaternion);
    cameraZ.set(0, 0, 1).applyQuaternion(this.object.quaternion);
    const isLookingDown = cameraZ.y > 0;
    const currentAngle =
      (isLookingDown ? 1 : -1) * cameraY.angleTo(axisDirections.y);

    this._sphericalDelta.phi = -THREE.MathUtils.clamp(
      -this._sphericalDelta.phi,
      -Math.PI / 2 - currentAngle,
      Math.PI / 2 - currentAngle,
    );
    this.object.rotateOnAxis(
      new THREE.Vector3(1, 0, 0),
      this._sphericalDelta.phi,
    );

    this.object.updateWorldMatrix(true, false);
    targetBefore.unproject(this.object);
    this.object.position.add(this.rotateTarget).sub(targetBefore);

    this._sphericalDelta.set(0, 0, 0);
  }

  /**
   * Update the zoom level of the camera.
   *
   * Based on the original update method. Currently only supports the orthographic camera.
   */
  private updateZoom() {
    if (!this._performCursorZoom) {
      return;
    }

    if (this.object instanceof THREE.OrthographicCamera) {
      const mouseBefore = new THREE.Vector3(
        this._mouse.x,
        this._mouse.y,
        0,
      ).unproject(this.object);

      this.object.zoom = THREE.MathUtils.clamp(
        this.object.zoom / this._scale,
        this.minZoom,
        this.maxZoom,
      );

      this.object.updateProjectionMatrix();

      const mouseAfter = new THREE.Vector3(
        this._mouse.x,
        this._mouse.y,
        0,
      ).unproject(this.object);

      this.object.position.sub(mouseAfter).add(mouseBefore);
    } else {
      const dollyDirection = new THREE.Vector3(this._mouse.x, this._mouse.y, 1)
        .unproject(this.object)
        .sub(this.object.position)
        .normalize();

      const distance = this.object.position.distanceTo(this.zoomTarget);
      const newDistance = THREE.MathUtils.clamp(
        distance * this._scale,
        this.minDistance,
        this.maxDistance,
      );
      const distanceDelta = distance - newDistance;
      this.object.position.addScaledVector(dollyDirection, distanceDelta);
    }

    this.object.updateMatrixWorld();

    this._scale = 1;
    this._performCursorZoom = false;
  }

  /**
   * Emit an event if the view of the camera changed.
   *
   * Based on the original update function.
   */
  private emitChange() {
    // update condition is:
    // min(camera displacement, camera rotation in radians)^2 > EPS
    // using small-angle approximation cos(x/2) = 1 - x^2 / 8

    const changed =
      Math.abs(this.object.zoom / this._lastZoom - 1) > _EPS ||
      this._lastPosition.distanceToSquared(this.object.position) > _EPS ||
      8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > _EPS;

    if (changed) {
      this.dispatchEvent({ type: 'change' });

      this._lastZoom = this.object.zoom;
      this._lastPosition.copy(this.object.position);
      this._lastQuaternion.copy(this.object.quaternion);
    }

    return changed;
  }
}
