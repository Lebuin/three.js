import { Tool } from '@/components/toolbar';
import { Renderer } from '../renderer';
import { BeamToolHandler } from './beam-tool-handler';
import { BoardToolHandler } from './board-tool-handler';
import { MoveToolHandler } from './move-tool-handler';
import { SelectToolHandler } from './select-tool-handler';
import { StretchToolHandler } from './stretch-tool-handler';
import { ToolHandler } from './tool-handler';

export function createToolHandler(tool: Tool, renderer: Renderer): ToolHandler {
  switch (tool) {
    case 'select':
      return new SelectToolHandler(renderer);
    case 'board':
      return new BoardToolHandler(renderer);
    case 'beam':
      return new BeamToolHandler(renderer);
    case 'move':
      return new MoveToolHandler(renderer);
    case 'stretch':
      return new StretchToolHandler(renderer);
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}
