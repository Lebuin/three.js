import { Color4 } from '@/lib/util/color4';
import { disposeMaterial } from '@/lib/util/three';
import { THREE } from '@lib/three.js';
import { Renderer } from '../renderer';
import { UpdatingObjectMixin } from './updating-object-mixin';
export class PointHelper extends UpdatingObjectMixin(THREE.Group) {
  private size: number;
  private sprite: THREE.Sprite;

  constructor(size: number, lineWidth: number, color: Color4 = new Color4()) {
    super();
    this.size = size;
    const texture = this.createTexture(size, lineWidth, color);
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
    });
    this.sprite = new THREE.Sprite(material);
    this.add(this.sprite);
  }

  dispose() {
    this.sprite.geometry.dispose();
    disposeMaterial(this.sprite.material);
  }

  private createTexture(size: number, lineWidth: number, color: Color4) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context');
    }

    context.beginPath();
    context.lineWidth = lineWidth;
    context.strokeStyle = color.getStyle();
    context.arc(
      size / 2,
      size / 2,
      size / 2 - lineWidth / 2,
      0,
      Math.PI * 2,
      false,
    );
    context.stroke();

    const canvasTexture = new THREE.CanvasTexture(canvas);
    return canvasTexture;
  }

  /**
   * Update the size of the point helper based on the pixel size of the renderer.
   */
  public update(renderer: Renderer) {
    const pixelSize = renderer.getPixelSize();
    this.scale.set(1, 1, 1).multiplyScalar(this.size / pixelSize);
  }
}
