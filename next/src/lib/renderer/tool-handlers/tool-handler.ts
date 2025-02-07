import { Tool } from '@/components/toolbar';
import { THREE } from '@lib/three.js';
import { PartObject } from '../part-objects/part-object';
import { Renderer } from '../renderer';
import { Target } from './target-finder';

export abstract class ToolHandler {
  abstract readonly tool: Tool;

  constructor(protected renderer: Renderer) {}

  delete() {
    this.renderer.setRotateTarget();
  }

  get model() {
    return this.renderer.model;
  }

  protected updateRenderer(target: Optional<Target>) {
    const mouseTarget = target ? this.getOrbitTarget(target) : null;
    const zoomTarget = target ? this.getZoomTarget(target) : null;
    this.renderer.setRotateTarget(mouseTarget);
    this.renderer.setZoomTarget(zoomTarget);
    this.renderer.render();
  }

  protected getOrbitTarget(target: Target): Nullable<THREE.Vector3> {
    if (target.object && target.object instanceof PartObject) {
      return target.point;
    } else {
      return null;
    }
  }

  protected getZoomTarget(target: Target): Nullable<THREE.Vector3> {
    return target.point;
  }
}
