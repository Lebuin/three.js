import { Part } from '@/lib/model/parts/part';
import { Plank } from '@/lib/model/parts/plank';
import { PartObject } from './part-object';
import { PlankObject } from './plank-object';

export function createPartObject(part: Part): PartObject<Part> {
  if (part instanceof Plank) {
    return new PlankObject(part);
  } else {
    throw new Error(`Unknown part type: ${part.constructor.name}`);
  }
}
