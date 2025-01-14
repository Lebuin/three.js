import { Board } from '@/lib/model/parts/board';
import { Part } from '@/lib/model/parts/part';
import { BoardObject } from './board-object';
import { PartObject } from './part-object';

export function createPartObject(part: Part): PartObject<Part> {
  if (part instanceof Board) {
    return new BoardObject(part);
  } else {
    throw new Error(`Unknown part type: ${part.constructor.name}`);
  }
}
