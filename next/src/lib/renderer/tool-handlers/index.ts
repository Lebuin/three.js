import { Tool } from '@/components/toolbar';
import { Model } from '@/lib/model/model';
import { Renderer } from '../renderer';
import { PlankToolHandler } from './plank-tool-handler';
import { SelectToolHandler } from './select-tool-handler';
import { ToolHandler } from './tool-handler';

export function createToolHandler(
  tool: Tool,
  renderer: Renderer,
  model: Model,
): ToolHandler {
  switch (tool) {
    case 'select':
      return new SelectToolHandler(renderer, model);
    case 'plank':
      return new PlankToolHandler(renderer, model);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
