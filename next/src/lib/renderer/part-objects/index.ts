export { GeometriesObject } from './geometries-object';
export type { OCGeometriesObject } from './geometries-object';
export { MaterialObject } from './material-object';
export { BasePartObject, PartObject } from './part-object';

import { BasePart } from '@/lib/model/parts';
import { BasePartObject } from './part-object';

export function createPartObject<T extends BasePart>(
  part: T,
): BasePartObject<T> {
  return new BasePartObject(part);
}
