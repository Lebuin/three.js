import { Tool } from '@/components/toolbar';
import { Model } from '@/lib/model/model';
import { Part } from '@/lib/model/parts/part';
import { Pixels } from '@/lib/util/geometry';
import { initOC } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { AxesHelper } from './helpers/axes-helper';
import { UpdatingObject } from './helpers/updating-object-mixin';
import { Lighting } from './lighting';
import { OrbitControls } from './orbit-controls';
import { createPartObject } from './part-objects';
import { PartObject } from './part-objects/part-object';
import Raycaster from './raycaster';
import * as settings from './settings';
import { createToolHandler } from './tool-handlers';
import { ToolHandler } from './tool-handlers/tool-handler';
interface RendererEvents {
  tool: { tool: Tool };
}

export class Renderer extends THREE.EventDispatcher<RendererEvents> {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _model: Model;
  private _raycaster: Raycaster;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private _camera: THREE.OrthographicCamera;
  private lighting: Lighting;
  private controls: OrbitControls;
  private axes: AxesHelper;

  private _partObjects: PartObject[] = [];
  private updatingObjects: UpdatingObject[] = [];
  private toolHandler: ToolHandler;
  private mouseTarget?: THREE.Vector3;

  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private needsRender = true;

  public readonly groundPlaneSize = 20e3;
  private castShadows = false;

  constructor(canvas: HTMLCanvasElement, model: Model) {
    super();

    this._canvas = canvas;
    this._model = model;
    this._raycaster = new Raycaster(this);

    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this._camera = this.createCamera();

    this.axes = new AxesHelper(this.groundPlaneSize, settings.axesColors);
    this.add(this.axes);

    this.lighting = new Lighting(this.castShadows);
    this.addUpdating(this.lighting);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.toolHandler = createToolHandler('select', this);

    initOC()
      .then(() => {
        this.loadModel();
      })
      .catch((e) => {
        // TODO: show error to the user
        console.error(e);
      });

    this.setupListeners();
  }

  get canvas() {
    return this._canvas;
  }
  get model() {
    return this._model;
  }
  get raycaster() {
    return this._raycaster;
  }
  get camera() {
    return this._camera;
  }
  get partObjects() {
    return this._partObjects;
  }

  setupListeners() {
    this.controls.addEventListener('change', this.onControlsChange);
    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  delete() {
    this.removeAllParts();
    this.toolHandler.delete();

    this.controls.removeEventListener('change', this.onControlsChange);
    this.controls.disconnect();
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.model.removeEventListener('addPart', this.onAddPart);
    this.model.removeEventListener('removePart', this.onRemovePart);
    window.removeEventListener('keydown', this.onKeyDown);
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
    camera.layers.enable(1);
    return camera;
  }

  public add(...objects: THREE.Object3D[]) {
    for (const object of objects) {
      this.scene.add(object);
    }
    this.render();
  }

  public remove(...objects: THREE.Object3D[]) {
    for (const object of objects) {
      this.scene.remove(object);
    }
    this.render();
  }

  public addUpdating(object: UpdatingObject) {
    this.updatingObjects.push(object);
    this.add(object);
  }

  public removeUpdating(object: UpdatingObject) {
    _.pull(this.updatingObjects, object);
    this.remove(object);
  }

  private loadModel() {
    this.addPart(...this.model.parts);
    this.model.addEventListener('addPart', this.onAddPart);
    this.model.addEventListener('removePart', this.onRemovePart);
    this.resetToolHandler();
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
      const index = this.partObjects.findIndex(
        (partObject) => partObject.part === part,
      );
      if (index > -1) {
        const partObject = this.partObjects[index];
        this.partObjects.splice(index, 1);
        this.remove(partObject);
        partObject.delete();
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
    this.updatingObjects.forEach((object) => object.update(this));
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get the size in screen pixels of 1 unit in the world.
   */
  public getPixelSize(): Pixels {
    const pixelSize =
      (this.camera.zoom * this.canvas.clientHeight) /
      (this.camera.top - this.camera.bottom);
    return pixelSize;
  }

  ///
  // Events

  private onControlsChange = () => {
    this.render();
  };

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

  /**
   * Cancel the default browser context menu
   */
  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

  private onAddPart = ({ part }: { part: Part }) => {
    this.addPart(part);
  };

  private onRemovePart = ({ part }: { part: Part }) => {
    this.removePart(part);
  };

  ///
  /// Controls

  /**
   * Set the target of the currently ongoing mouse interaction (e.g. drawing a new part). This
   * point will be used as the target of the controls.
   */
  public setMouseTarget(target?: THREE.Vector3) {
    this.mouseTarget = target;
  }

  /**
   * Update the target of the controls to the point where the user clicked.
   */
  private onPointerDown = (event: PointerEvent) => {
    this.controls.target = this.getControlsTarget(event);
  };

  private getControlsTarget(event: PointerEvent) {
    if (this.mouseTarget) {
      return this.mouseTarget;
    }
    if (this.partObjects.length === 0) {
      return new THREE.Vector3();
    }

    // TODO: avoid raycasting twice: just make sure MouseHandle is always active regardless of the
    // tool.
    this.raycaster.setFromEvent(event);
    const intersection = this.raycaster.cast(this.partObjects);
    if (intersection) {
      return intersection.point;
    } else {
      return this.getSceneCenter();
    }
  }

  /**
   * Get the center of the objects in the scene that are at least partly visible in the camera
   * frustrum.
   */
  private getSceneCenter() {
    const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse,
    );
    const frustrum = new THREE.Frustum().setFromProjectionMatrix(
      projectionMatrix,
    );

    const objectsInViewBB = new THREE.Box3();
    for (const partObject of this.partObjects) {
      const objectBB = new THREE.Box3().setFromObject(partObject);
      if (frustrum.intersectsBox(objectBB)) {
        objectsInViewBB.union(objectBB);
      }
    }

    const center = objectsInViewBB.getCenter(new THREE.Vector3());
    return center;
  }

  ///
  /// Tools

  setTool(tool: Tool) {
    this.toolHandler.delete();
    this.toolHandler = createToolHandler(tool, this);
    if (this.toolHandler.tool !== tool) {
      throw new Error(
        `Unexpected tool: ${this.toolHandler.tool} instead of ${tool}`,
      );
    }
    this.dispatchEvent({ type: 'tool', tool });
  }

  resetToolHandler() {
    this.toolHandler.delete();
    this.toolHandler = createToolHandler(this.toolHandler.tool, this);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.resetToolHandler();
    }
  };
}
