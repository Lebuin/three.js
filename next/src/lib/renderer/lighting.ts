import { THREE } from '@lib/three.js';
import { UpdatingObjectMixin } from './helpers/updating-object-mixin';
import { Renderer } from './renderer';
export class Lighting extends UpdatingObjectMixin(THREE.Group) {
  constructor(private castShadows = false) {
    super();

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 2.5);
    this.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
    directionalLight.position.set(5, 2, 10);
    this.setLightShadow(directionalLight);
    this.add(directionalLight);
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

  public update(renderer: Renderer) {
    this.quaternion.copy(renderer.camera.quaternion);
  }
}
