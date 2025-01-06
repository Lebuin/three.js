import _ from 'lodash';
import * as THREE from 'three';
import { Axes } from './axes';
import { OrbitControls } from './orbit-controls';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private lightHolder: THREE.Group;
  private controls: OrbitControls;
  private axes: Axes;
  private objects: THREE.Mesh[];
  private debugSphere: THREE.Mesh;
  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private readonly groundPlaneSize = 200;

  private showLightHelpers = false;
  private castShadows = false;
  private showDebugSphere = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this.camera = this.createCamera();

    this.axes = this.createAxes();
    this.scene.add(this.axes);

    this.lightHolder = this.createLights();
    this.scene.add(this.lightHolder);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', this.render);

    if (this.showLightHelpers) {
      const lightHelperHolder = this.createLightHelpers(this.lightHolder);
      this.scene.add(lightHelperHolder);
    }

    this.objects = this.createObjects();
    this.scene.add(...this.objects);

    this.debugSphere = this.createDebugSphere();
    if (this.showDebugSphere) {
      this.scene.add(this.debugSphere);
    }

    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);

    this.render();
  }

  destroy() {
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }

  get domElement() {
    return this.renderer.domElement;
  }

  private createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    return scene;
  }

  private createRenderer(canvas: HTMLCanvasElement) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    this.setRendererSize(renderer);
    return renderer;
  }

  private setRendererSize(renderer: THREE.WebGLRenderer) {
    const pixelRatio = window.devicePixelRatio;
    const width = Math.floor(this.canvas.clientWidth * pixelRatio);
    const height = Math.floor(this.canvas.clientHeight * pixelRatio);
    renderer.setSize(width, height, false);
    return renderer.getSize(new THREE.Vector2());
  }

  private createCamera() {
    const frustrum = 2;
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

  private createLights() {
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x888888, 1);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(5, 2, 10);
    this.setLightShadow(directionalLight);

    const holder = new THREE.Group();
    holder.add(hemisphereLight, directionalLight);
    return holder;
  }

  private setLightShadow(light: THREE.DirectionalLight) {
    if (!this.castShadows) {
      return;
    }

    light.castShadow = true;
    light.shadow.mapSize.width = 256;
    light.shadow.mapSize.height = 256;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 100;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.radius = 3;
    light.shadow.blurSamples = 16;
  }

  private createLightHelpers(lightHolder: THREE.Group) {
    const holder = new THREE.Group();
    for (const light of lightHolder.children) {
      if (light instanceof THREE.DirectionalLight) {
        const helper = new THREE.DirectionalLightHelper(light, 1, 0x555555);
        holder.add(helper);
      }
    }
    return holder;
  }

  private createAxes() {
    const axes = new Axes(this.groundPlaneSize);
    return axes;
  }

  private createObjects() {
    const objects = [0, 5].map((x) => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.6,
        metalness: 0.4,
      });

      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(x + 0.5, 1, 0.5);
      cube.castShadow = true;
      cube.receiveShadow = true;

      return cube;
    });

    return objects;
  }

  createDebugSphere() {
    const sphere = new THREE.SphereGeometry(0.1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const object = new THREE.Mesh(sphere, material);
    return object;
  }

  onResize() {
    const size = this.setRendererSize(this.renderer);
    const aspect = size.width / size.height;
    this.camera.left = this.camera.bottom * aspect;
    this.camera.right = this.camera.top * aspect;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render = () => {
    this.lightHolder.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  };

  ///
  /// Controls

  private onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
  };

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
