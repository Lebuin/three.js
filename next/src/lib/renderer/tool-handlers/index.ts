import { Tool } from '@/components/toolbar';
import { Renderer } from '../renderer';
import { BoardToolHandler } from './board-tool-handler';
import { SelectToolHandler } from './select-tool-handler';
import { ToolHandler } from './tool-handler';

export function createToolHandler(tool: Tool, renderer: Renderer): ToolHandler {
  switch (tool) {
    case 'select':
      return new SelectToolHandler(renderer);
    case 'board':
      return new BoardToolHandler(renderer);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
