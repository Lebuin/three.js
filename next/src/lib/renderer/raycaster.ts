import { Pixels } from '@/lib/util/geometry';
import * as THREE from 'three';
import { Renderer } from './renderer';

export default class Raycaster {
  private renderer: Renderer;
  private event: MouseEvent;
  private raycaster: THREE.Raycaster;
  private pixelThreshold: Pixels = 15;
  constructor(renderer: Renderer, event: MouseEvent) {
    this.renderer = renderer;
    this.event = event;
    this.raycaster = this.createRaycaster();
  }

  get threshold() {
    const pixelSize = this.renderer.getPixelSize();
    const threshold = this.pixelThreshold / pixelSize;
    return threshold;
  }

  get ray() {
    return this.raycaster.ray;
  }

  private createRaycaster() {
    const boundingRect = this.renderer.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2();
    pointer.x =
      ((this.event.clientX - boundingRect.left) / boundingRect.width) * 2 - 1;
    pointer.y = -(
      ((this.event.clientY - boundingRect.top) / boundingRect.height) * 2 -
      1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.renderer.camera);
    raycaster.params.Points.threshold = this.threshold;
    raycaster.params.Line.threshold = this.threshold;

    return raycaster;
  }

  intersectObjects(objects: THREE.Object3D[]): THREE.Intersection[] {
    const intersects = this.raycaster.intersectObjects(objects, true);
    return intersects;
  }
}
