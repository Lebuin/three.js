import { MouseDrag, MouseTracker } from '@/lib/mouse-tracker';
import { platform } from '@/lib/util';
import _ from 'lodash';
import * as THREE from 'three';

interface MouseTrackerData {
  cameraPosition: THREE.Vector3;
}

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private lightHolder: THREE.Group;
  private cube: THREE.Mesh;
  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);
  private mouseTracker: MouseTracker<MouseTrackerData>;

  private showLightHelpers = false;

  constructor(private elem: HTMLElement) {
    this.scene = this.createScene();
    this.renderer = this.createRenderer();
    this.camera = this.createCamera();

    this.lightHolder = this.createLights();
    this.scene.add(this.lightHolder);

    if (this.showLightHelpers) {
      const lightHelperHolder = this.createLightHelpers(this.lightHolder);
      this.scene.add(lightHelperHolder);
    }

    this.cube = this.createCube();
    this.scene.add(this.cube);

    window.addEventListener('resize', this.onResizeThrottled);
    this.elem.addEventListener('wheel', this.onScroll);

    this.mouseTracker = new MouseTracker(
      this.renderer.domElement,
      this.onMouseDown,
      this.onMouseMove,
    );
    this.mouseTracker.start();
  }

  destroy() {
    this.pause();
    window.removeEventListener('resize', this.onResizeThrottled);
    this.elem.removeEventListener('wheel', this.onScroll);
    this.mouseTracker.stop();
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
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 5;
    return camera;
  }

  private createLights() {
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1);
    dirLight1.position.set(0, 1, 2);
    dirLight1.castShadow = true;
    this.setLightShadow(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight2.position.set(-2, 0, 0);
    this.setLightShadow(dirLight2);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.3);

    const holder = new THREE.Group();
    holder.add(dirLight1, dirLight2, ambLight);
    return holder;
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

  private setLightShadow(light: THREE.DirectionalLight) {
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

  private createCube() {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });

    const cube = new THREE.Mesh(geometry, material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    return cube;
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  animate = () => {
    this.lightHolder.quaternion.copy(this.camera.quaternion);
    this.renderer.render(this.scene, this.camera);
  };

  /// Mouse tracking

  private onMouseDown = () => {
    return {
      cameraPosition: this.camera.position.clone(),
    };
  };

  private onMouseMove = (data: MouseTrackerData, drag: MouseDrag) => {
    const deltaX = drag.x * 0.005;
    const deltaY = drag.y * 0.005;

    const spherical = new THREE.Spherical();
    spherical.setFromVector3(data.cameraPosition);

    spherical.theta -= deltaX;
    spherical.phi -= deltaY;
    spherical.phi = platform(0.2, spherical.phi, Math.PI - 0.2);

    this.camera.position.setFromSpherical(spherical);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
  };

  private onScroll = (event: Event) => {
    event.preventDefault();
    const delta = (event as WheelEvent).deltaY;
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(this.camera.position);

    spherical.radius *= 1 + delta * 0.001;
    spherical.radius = platform(0.1, spherical.radius, 50);

    this.camera.position.setFromSpherical(spherical);
  };
}
