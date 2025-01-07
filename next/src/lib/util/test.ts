import * as THREE from 'three';
import { expect } from 'vitest';

/**
 * Identical in functionality to `expect(val).toBeDefined()`, but adds type narrowing.
 */
export function expectToBeDefined<T>(val?: T): asserts val is NonNullable<T> {
  expect(val).toBeDefined();
}

export function expectVectorsToBeClose(
  actual: THREE.Vector3,
  expected: THREE.Vector3,
  precision: number | undefined = undefined,
) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}
