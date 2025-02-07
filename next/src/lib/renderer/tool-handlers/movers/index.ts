import { Tool } from '@/components/toolbar';
import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Beam } from '@/lib/model/parts/beam';
import { Board } from '@/lib/model/parts/board';
import { Part } from '@/lib/model/parts/part';
import { Target } from '../target-finder';
import { BeamStretcher } from './beam-stretcher';
import { BoardStretcher } from './board-stretcher';
import { Mover } from './mover';

export type MoveTool = Extract<Tool, 'move' | 'stretch'>;

export function moverFactory(
  tool: MoveTool,
  part: Part,
  subShape: Vertex | Edge | Face,
  target: Target,
) {
  if (tool === 'move') {
    return new Mover(part, subShape, target);
  } else if (part instanceof Beam) {
    return new BeamStretcher(part, subShape, target);
  } else if (part instanceof Board) {
    return new BoardStretcher(part, subShape, target);
  } else {
    throw new Error('Unsupported tool or part');
  }
}
