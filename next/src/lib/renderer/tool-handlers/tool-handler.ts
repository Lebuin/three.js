import { Tool } from '@/components/toolbar';
import { Renderer } from '../renderer';

export abstract class ToolHandler {
  abstract readonly tool: Tool;

  constructor(protected renderer: Renderer) {}

  delete() {
    // Subclasses should override this method to clean up
  }

  get model() {
    return this.renderer.model;
  }
}
