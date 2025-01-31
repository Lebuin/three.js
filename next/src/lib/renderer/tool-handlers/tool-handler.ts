import { Renderer } from '../renderer';

export abstract class ToolHandler {
  constructor(protected renderer: Renderer) {}

  delete() {
    // Subclasses should override this method to clean up
  }

  get model() {
    return this.renderer.model;
  }
}
