import _ from 'lodash';
import * as THREE from 'three';
import { Axes } from './axes';
import { Lighting } from './lighting';
import { OrbitControls } from './orbit-controls';

export class Renderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private lighting: THREE.Group;
  private controls: OrbitControls;
  private axes: Axes;
  private objects: THREE.Object3D[];

  private onResizeThrottled = _.throttle(this.onResize.bind(this), 100);

  private readonly groundPlaneSize = 200;

  private castShadows = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.scene = this.createScene();
    this.renderer = this.createRenderer(this.canvas);
    this.camera = this.createCamera();

    this.axes = new Axes(this.groundPlaneSize * 1.2);
    this.scene.add(this.axes);

    this.lighting = new Lighting(this.castShadows);
    this.scene.add(this.lighting);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.addEventListener('change', this.render);

    this.objects = this.createObjects();
    this.scene.add(...this.objects);

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

  private createObjects() {
    const objects = [0, 5].map((x) => {
      const geometry = new THREE.BoxGeometry();
      const meshMaterial = new THREE.MeshStandardMaterial({
        color: 'hsl(38, 86%, 78%)',
        roughness: 0.6,
        metalness: 0.2,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      const mesh = new THREE.Mesh(geometry, meshMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const edgesGeometry = new THREE.EdgesGeometry(geometry);
      const edgesMaterial = new THREE.LineBasicMaterial({
        color: 'hsl(38, 86%, 15%)',
        linewidth: 1.5,
      });
      const wireframe = new THREE.LineSegments(edgesGeometry, edgesMaterial);

      const group = new THREE.Group();
      group.add(mesh, wireframe);
      group.position.set(x + 0.5, 1, 0.5);

      return group;
    });

    return objects;
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
