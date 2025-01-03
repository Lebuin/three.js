import { platform } from '@/lib/util';
import _ from 'lodash';
import * as THREE from 'three';
import { Axes } from './axes';
import { OrbitControls } from './orbit-controls';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private lightHolder: THREE.Group;
  private groundPlane: THREE.Mesh;
  private controls: OrbitControls;
  private axes: Axes;
  private objects: THREE.Mesh[];
  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private showLightHelpers = false;
  private readonly groundPlaneSize = 100;

  constructor(private elem: HTMLElement) {
    this.scene = this.createScene();
    this.renderer = this.createRenderer();
    this.camera = this.createCamera();

    this.axes = this.createAxes();
    this.scene.add(this.axes);

    this.groundPlane = this.createGroundPlane();
    this.scene.add(this.groundPlane);

    this.lightHolder = this.createLights();
    this.scene.add(this.lightHolder);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    if (this.showLightHelpers) {
      const lightHelperHolder = this.createLightHelpers(this.lightHolder);
      this.scene.add(lightHelperHolder);
    }

    this.objects = this.createObjects();
    this.scene.add(...this.objects);

    window.addEventListener('resize', this.onResizeThrottled);
    window.addEventListener('mousedown', this.onMouseDown);
    this.elem.addEventListener('contextmenu', this.onContextMenu);
    this.elem.addEventListener('wheel', this.onWheel);

    // this.mouseTracker = new MouseTracker({
    //   elem: this.renderer.domElement,
    //   onMouseDown: this.onMouseDown,
    //   onMouseMove: this.onMouseMove,
    //   filter: this.filterMouseEvent,
    // });
    // this.mouseTracker.start();
  }

  destroy() {
    this.pause();
    window.removeEventListener('resize', this.onResizeThrottled);
    window.removeEventListener('mousedown', this.onMouseDown);
    this.elem.removeEventListener('contextmenu', this.onContextMenu);
    this.elem.removeEventListener('wheel', this.onWheel);
    // this.mouseTracker.stop();
  }

  get domElement() {
    return this.renderer.domElement;
  }

  start() {
    this.renderer.setAnimationLoop(this.animate);
  }

  pause() {
    this.renderer.setAnimationLoop(null);
  }

  private createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    return scene;
  }

  private createRenderer() {
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    return renderer;
  }

  private createCamera() {
    const frustrum = 2;
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
      -frustrum * aspect,
      frustrum * aspect,
      frustrum,
      -frustrum,
      -1000,
      1000,
    );
    camera.position.set(3, 3, 5);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    return camera;
  }

  private createLights() {
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2);
    dirLight1.position.set(0, 1, 2);
    this.setLightShadow(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight2.position.set(-2, 0, 0);
    this.setLightShadow(dirLight2);

    const ambLight = new THREE.AmbientLight(0xffffff, 1);

    const holder = new THREE.Group();
    holder.add(dirLight1, dirLight2, ambLight);
    return holder;
  }

  private setLightShadow(light: THREE.DirectionalLight) {
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
        const helper = new THREE.DirectionalLightHelper(light, 1);
        holder.add(helper);
      }
    }
    return holder;
  }

  private createAxes() {
    const axes = new Axes(this.groundPlaneSize / 2);
    return axes;
  }

  private createGroundPlane() {
    const geometry = new THREE.PlaneGeometry(
      this.groundPlaneSize,
      this.groundPlaneSize,
    );
    const material = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.01;
    plane.receiveShadow = true;

    return plane;
  }

  private createObjects() {
    const objects = [0, 5].map((x) => {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });

      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(x + 0.5, 1, 0.5);
      cube.castShadow = true;
      cube.receiveShadow = true;

      return cube;
    });

    return objects;
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = this.camera.bottom * aspect;
    this.camera.right = this.camera.top * aspect;
    this.camera.updateProjectionMatrix();
  }

  animate = () => {
    this.lightHolder.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  };

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

  private onWheel = (event: Event) => {
    // TODO: zoom to mouse position
    event.preventDefault();
    const delta = (event as WheelEvent).deltaY;
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position);

    spherical.radius *= 1 + delta * 0.002;
    spherical.radius = platform(0.1, spherical.radius, 50);

    this.camera.position.setFromSpherical(spherical);
  };
}
