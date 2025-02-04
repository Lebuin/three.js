import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { Board } from '@/lib/model/parts/board';
import { Part } from '@/lib/model/parts/part';
import { Target } from '../target-finder';
import { BoardStretcher } from './board-stretcher';

export function stretcherFactory(
  part: Part,
  subShape: Vertex | Edge | Face,
  target: Target,
) {
  if (part instanceof Board) {
    return new BoardStretcher(part, subShape, target);
  } else {
    throw new Error('Unsupported part type');
  }
}
