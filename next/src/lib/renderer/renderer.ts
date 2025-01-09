import { Tool } from '@/components/toolbar';
import { Model } from '@/lib/model/model';
import _ from 'lodash';
import * as THREE from 'three';
import { Part } from '../model/parts/part';
import { AxesHelper } from './helpers/axes-helper';
import { PlaneHelper } from './helpers/plane-helper';
import { Lighting } from './lighting';
import { OrbitControls } from './orbit-controls';
import { createPartObject } from './part-objects';
import { PartObject } from './part-objects/part-object';
import * as settings from './settings';
import { createToolHandler } from './tool-handlers';
import { ToolHandler } from './tool-handlers/tool-handler';

export class Renderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _model: Model;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private _camera: THREE.OrthographicCamera;
  private lighting: THREE.Group;
  private controls: OrbitControls;
  private axes: AxesHelper;
  private planeHelper?: PlaneHelper;

  private partObjects: PartObject<Part>[] = [];
  private toolHandler?: ToolHandler;

  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private needsRender = true;

  private readonly groundPlaneSize = 20e3;
  private castShadows = false;

  constructor(canvas: HTMLCanvasElement, model: Model) {
    this._canvas = canvas;
    this._model = model;

    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this._camera = this.createCamera();

    this.axes = new AxesHelper(this.groundPlaneSize, settings.axesColors);
    this.add(this.axes);

    this.lighting = new Lighting(this.castShadows);
    this.add(this.lighting);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.addPart(...model.parts);

    this.setupListeners();
  }

  get canvas() {
    return this._canvas;
  }
  get model() {
    return this._model;
  }
  get camera() {
    return this._camera;
  }

  setupListeners() {
    this.controls.addEventListener('change', this.render);
    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.model.addEventListener('addPart', this.onAddPart);
    this.model.addEventListener('removePart', this.onRemovePart);
  }

  dispose() {
    this.removeAllParts();
    this.toolHandler?.dispose();

    this.controls.dispose();
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.model.removeEventListener('addPart', this.onAddPart);
    this.model.removeEventListener('removePart', this.onRemovePart);
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
    renderer.setAnimationLoop(this.renderLoop);
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
      this.groundPlaneSize * 3,
    );
    camera.position.set(
      this.groundPlaneSize * 0.6,
      this.groundPlaneSize * 0.6,
      this.groundPlaneSize * 0.9,
    );
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    return camera;
  }

  public add(object: THREE.Object3D) {
    this.scene.add(object);
    this.render();
  }

  public remove(object: THREE.Object3D) {
    this.scene.remove(object);
    this.render();
  }

  private addPart(...parts: Part[]) {
    parts.forEach((part) => {
      const partObject = createPartObject(part);
      this.partObjects.push(partObject);
      this.add(partObject);
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
   * Render the scene.
   */
  render = () => {
    this.needsRender = true;
  };

  private renderLoop = () => {
    if (this.needsRender) {
      this.needsRender = false;
      this.renderFrame();
    }
  };

  private renderFrame() {
    this.lighting.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  }

  ///
  // Show a plane helper to aid drawing

  public showPlaneHelper(normal: THREE.Vector3, point: THREE.Vector3) {
    this.hidePlaneHelper();

    const colors = this.getPlaneHelperColors(normal);
    this.planeHelper = new PlaneHelper(
      normal,
      point,
      this.groundPlaneSize * 2,
      80,
      {
        grid: {
          primary: colors.primary,
          secondary: colors.secondary,
        },
        plane: colors.plane,
      },
    );
    this.add(this.planeHelper);
  }

  public hidePlaneHelper() {
    if (!this.planeHelper) {
      return;
    }

    this.scene.remove(this.planeHelper);
    this.planeHelper.dispose();
  }

  private getPlaneHelperColors(normal: THREE.Vector3) {
    let axesColors = settings.axesColors.default;
    if (normal.angleTo(new THREE.Vector3(1, 0, 0)) === 0) {
      axesColors = settings.axesColors.x;
    } else if (normal.angleTo(new THREE.Vector3(0, 1, 0)) === 0) {
      axesColors = settings.axesColors.y;
    } else if (normal.angleTo(new THREE.Vector3(0, 0, 1)) === 0) {
      axesColors = settings.axesColors.z;
    }

    axesColors = {
      primary: axesColors.primary.clone().setA(0.5),
      secondary: axesColors.secondary.clone().setA(0.5),
      plane: axesColors.plane.clone().setA(0.15),
    };
    return axesColors;
  }

  ///
  // Events

  /**
   * Update the size of the renderer and the camera aspect ratio when the window is resized.
   */
  private onResize() {
    const size = this.setRendererSize(this.renderer);
    const aspect = size.width / size.height;
    this.camera.left = this.camera.bottom * aspect;
    this.camera.right = this.camera.top * aspect;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  private onAddPart = ({ part }: { part: Part }) => {
    this.addPart(part);
  };

  private onRemovePart = ({ part }: { part: Part }) => {
    this.removePart(part);
  };

  ///
  /// Controls

  public getRaycaster(event: MouseEvent) {
    const boundingRect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2();
    pointer.x =
      ((event.clientX - boundingRect.left) / boundingRect.width) * 2 - 1;
    pointer.y = -(
      ((event.clientY - boundingRect.top) / boundingRect.height) * 2 -
      1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);

    return raycaster;
  }

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
    const raycaster = this.getRaycaster(event);
    const intersects = raycaster.intersectObjects(this.partObjects);

    const targetObjectPoint =
      intersects.length > 0 ? intersects[0].point : new THREE.Vector3(0, 0, 0);

    const cameraDirection = this.camera.getWorldDirection(new THREE.Vector3());
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    const distance = cameraPosition.distanceTo(targetObjectPoint);
    const target = cameraPosition
      .clone()
      .add(cameraDirection.clone().multiplyScalar(distance));

    this.controls.target = target;
    this.controls.update();
  };

  ///
  /// Tools

  setTool(tool: Tool) {
    this.toolHandler?.dispose();
    this.toolHandler = createToolHandler(tool, this, this.model);
  }
}
