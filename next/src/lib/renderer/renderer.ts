import { Tool } from '@/components/toolbar';
import { Model } from '@/lib/model/model';
import { Part } from '@/lib/model/parts/part';
import { Pixels } from '@/lib/util/geometry';
import _ from 'lodash';
import * as THREE from 'three';
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

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private _camera: THREE.OrthographicCamera;
  private lighting: Lighting;
  private controls: OrbitControls;
  private axes: AxesHelper;

  private _partObjects: PartObject<Part>[] = [];
  private updatingObjects: UpdatingObject[] = [];
  private toolHandler?: ToolHandler;
  private mouseTarget?: THREE.Vector3;

  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private needsRender = true;

  public readonly groundPlaneSize = 20e3;
  private castShadows = false;

  constructor(canvas: HTMLCanvasElement, model: Model) {
    super();

    this._canvas = canvas;
    this._model = model;

    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this._camera = this.createCamera();

    this.axes = new AxesHelper(this.groundPlaneSize, settings.axesColors);
    this.add(this.axes);

    this.lighting = new Lighting(this.castShadows);
    this.addUpdating(this.lighting);

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
  get partObjects() {
    return this._partObjects;
  }

  setupListeners() {
    this.controls.addEventListener('change', this.onControlsChange);
    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.model.addEventListener('addPart', this.onAddPart);
    this.model.addEventListener('removePart', this.onRemovePart);
  }

  dispose() {
    this.removeAllParts();
    this.toolHandler?.dispose();

    this.controls.removeEventListener('change', this.onControlsChange);
    this.controls.dispose();
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('pointerdown', this.onPointerDown);
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

  public addUpdating(object: UpdatingObject) {
    this.updatingObjects.push(object);
    this.add(object);
  }

  public removeUpdating(object: UpdatingObject) {
    this.updatingObjects = _.remove(this.updatingObjects, object);
    this.remove(object);
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
        this.remove(partObject);
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

  public getRaycaster(event: MouseEvent) {
    return new Raycaster(this, event);
  }

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

    const raycaster = this.getRaycaster(event);
    const intersects = raycaster.intersectObjects(this.partObjects);
    if (intersects.length > 0) {
      return intersects[0].point;
    }

    return this.getSceneCenter();
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
    this.toolHandler?.dispose();
    this.toolHandler = createToolHandler(tool, this);
    this.dispatchEvent({ type: 'tool', tool });
  }
}
