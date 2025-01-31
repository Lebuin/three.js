import { Color4 } from '@/lib/util/color4';
import { THREE } from '@lib/three.js';
import { Renderer } from '../renderer';
import { UpdatingObjectMixin } from './updating-object-mixin';

export interface BasePointHelperOptions {
  size: number;
}

export abstract class BasePointHelper<
  T extends BasePointHelperOptions,
> extends UpdatingObjectMixin(THREE.Group) {
  private size: number;
  private sprite: THREE.Sprite;

  constructor(options: T) {
    super();
    this.size = options.size;
    const texture = this.createTexture(options);
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
    });
    this.sprite = new THREE.Sprite(material);
    this.add(this.sprite);
  }

  setPoint(point: THREE.Vector3) {
    this.position.copy(point);
  }

  private createTexture(options: T) {
    const canvas = document.createElement('canvas');
    canvas.width = options.size;
    canvas.height = options.size;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context');
    }

    this.drawTexture(context, options);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    return canvasTexture;
  }

  protected abstract drawTexture(
    context: CanvasRenderingContext2D,
    options: T,
  ): void;

  /**
   * Update the size of the point helper based on the pixel size of the renderer.
   */
  public update(renderer: Renderer) {
    const pixelSize = renderer.getPixelSize();
    this.scale.set(1, 1, 1).multiplyScalar(this.size / pixelSize);
  }
}

export interface PointHelperOptions extends BasePointHelperOptions {
  size: number;
  fillColor: Color4;
  strokeColor: Color4;
}

export class PointHelper extends BasePointHelper<PointHelperOptions> {
  protected drawTexture(
    context: CanvasRenderingContext2D,
    options: PointHelperOptions,
  ) {
    const lineWidth = 1;
    context.beginPath();
    context.lineWidth = lineWidth;
    context.strokeStyle = options.strokeColor.getStyle();
    context.fillStyle = options.fillColor.getStyle();
    context.arc(
      options.size / 2,
      options.size / 2,
      (options.size - lineWidth) / 2,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.fill();
  }
}
