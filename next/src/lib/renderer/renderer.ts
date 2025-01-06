import { Model } from '@/lib/model/model';
import _ from 'lodash';
import * as THREE from 'three';
import { Part } from '../model/parts/part';
import { Axes } from './axes';
import { Lighting } from './lighting';
import { OrbitControls } from './orbit-controls';
import { createPartObject } from './part-objects';
import { PartObject } from './part-objects/part-object';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private lighting: THREE.Group;
  private controls: OrbitControls;
  private axes: Axes;
  private partObjects: PartObject<Part>[] = [];

  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private readonly groundPlaneSize = 20e3;

  private castShadows = false;

  constructor(private canvas: HTMLCanvasElement, private model: Model) {
    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this.camera = this.createCamera();

    this.axes = new Axes(this.groundPlaneSize * 1.2);
    this.scene.add(this.axes);

    this.lighting = new Lighting(this.castShadows);
    this.scene.add(this.lighting);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.addPart(...model.parts);

    this.setupListeners();

    this.render();
  }

  setupListeners() {
    this.controls.addEventListener('change', this.render);
    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  destroy() {
    this.removeAllParts();
    this.controls.dispose();
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  private createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    return scene;
  }

  /**
   * Create a WebGL renderer.
   */
  private createRenderer(canvas: HTMLCanvasElement) {
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    this.setRendererSize(renderer);
    return renderer;
  }

  /**
   * Set the size of the renderer to match the size of the canvas.
   */
  private setRendererSize(renderer: THREE.WebGLRenderer) {
    const pixelRatio = window.devicePixelRatio;
    const width = Math.floor(this.canvas.clientWidth * pixelRatio);
    const height = Math.floor(this.canvas.clientHeight * pixelRatio);
    renderer.setSize(width, height, false);
    return renderer.getSize(new THREE.Vector2());
  }

  /**
   * Create an orthographic camera.
   */
  private createCamera() {
    const frustrum = 1e3;
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
      -frustrum * aspect,
      frustrum * aspect,
      frustrum,
      -frustrum,
      0,
      this.groundPlaneSize * 2,
    );
    camera.position.set(
      this.groundPlaneSize * 0.6,
      this.groundPlaneSize * 0.6,
      this.groundPlaneSize * 0.9,
    );
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    return camera;
  }

  private addPart(...parts: Part[]) {
    parts.forEach((part) => {
      const partObject = createPartObject(part);
      this.partObjects.push(partObject);
      this.scene.add(partObject);
      part.addEventListener('change', this.render);
    });
  }

  private removePart(...parts: Part[]) {
    parts.forEach((part) => {
      const partObject = this.partObjects.find(
        (partObject) => partObject.part === part,
      );
      if (partObject) {
        this.scene.remove(partObject);
        partObject.dispose();
        part.removeEventListener('change', this.render);
      }
    });
  }

  private removeAllParts() {
    this.removePart(...this.partObjects.map((partObject) => partObject.part));
  }

  /**
   * Update the size of the renderer and the camera aspect ratio when the window is resized.
   */
  onResize() {
    const size = this.setRendererSize(this.renderer);
    const aspect = size.width / size.height;
    this.camera.left = this.camera.bottom * aspect;
    this.camera.right = this.camera.top * aspect;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  /**
   * Render the scene.
   */
  render = () => {
    this.lighting.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  };

  ///
  /// Controls

  /**
   * Cancel the default browser context menu
   */
  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  /**
   * Update the target of the controls to the point where the user clicked.
   */
  private onMouseDown = (event: MouseEvent) => {
    const size = this.renderer.getSize(new THREE.Vector2());
    const pointer = new THREE.Vector2();
    pointer.x = (event.clientX / size.width) * 2 - 1;
    pointer.y = -((event.clientY / size.height) * 2 - 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const intersects = raycaster.intersectObjects(this.scene.children);

    const targetObjectPoint =
      intersects.length > 0 ? intersects[0].point : new THREE.Vector3(0, 0, 0);

    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    const cameraPosition = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPosition);
    const target = cameraPosition
      .clone()
      .add(
        cameraDirection
          .clone()
          .multiplyScalar(cameraPosition.distanceTo(targetObjectPoint)),
      );

    this.controls.target = target;
    this.controls.update();
  };
}
