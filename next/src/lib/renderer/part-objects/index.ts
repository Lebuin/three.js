import { Part } from '@/lib/model/parts/part';
import { PartObject } from './part-object';

export function createPartObject<T extends Part>(part: T): PartObject<T> {
  return new PartObject(part);
}
