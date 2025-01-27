import _ from 'lodash';

type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;
type TypedArrayConstructor<T> = new (size: number) => T;

export function concatTypedArrays<T extends TypedArray>(...arrays: T[]): T {
  if (arrays.length === 0) {
    throw new Error('No arrays to concatenate');
  }

  const totalLength = _.sumBy(arrays, 'length');
  const constructor = arrays[0].constructor as TypedArrayConstructor<T>;
  const result = new constructor(totalLength);

  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }

  return result;
}
