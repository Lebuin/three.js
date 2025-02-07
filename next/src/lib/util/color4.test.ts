import { THREE } from '@lib/three.js';
import { describe, expect, test } from 'vitest';
import { Color4 } from './color4';

describe('color', () => {
  function expectColorToBe(
    color4: Color4,
    color: THREE.Color,
    opacity: number,
  ) {
    expect(color4.r).toBeCloseTo(color.r);
    expect(color4.g).toBeCloseTo(color.g);
    expect(color4.b).toBeCloseTo(color.b);
    expect(color4.a).toBeCloseTo(opacity);
  }

  test('should construct a color from a 3-hex string', () => {
    const color = new Color4('#123');
    const reference = new THREE.Color('#123');
    expectColorToBe(color, reference, 1);
  });

  test('should construct a color from a 6-hex string', () => {
    const color = new Color4('#123456');
    const reference = new THREE.Color('#123456');
    expectColorToBe(color, reference, 1);
  });

  test('should construct a color from a 4-hex string', () => {
    const color = new Color4('#6789');
    const reference = new THREE.Color('#678');
    expectColorToBe(color, reference, 0.6);
  });

  test('should construct a color from a 8-hex string', () => {
    const color = new Color4('#12345680');
    const reference = new THREE.Color('#123456');
    expectColorToBe(color, reference, 0.5);
  });

  test('should construct a color from a 6-hex number', () => {
    const color = new Color4(0x123456);
    const reference = new THREE.Color(0x123456);
    expectColorToBe(color, reference, 1);
  });

  test('should construct a color from a 8-hex number', () => {
    const color = new Color4(0x12345680);
    const reference = new THREE.Color(0x123456);
    expectColorToBe(color, reference, 0.5);
  });

  test('should construct a color from a rgb string', () => {
    const color = new Color4('rgb(12, 34, 56)');
    const reference = new THREE.Color('rgb(12, 34, 56)');
    expectColorToBe(color, reference, 1);
  });

  test('should construct a color from a rgba string', () => {
    const color = new Color4('rgba(12, 34, 56, 0.5)');
    const reference = new THREE.Color('rgb(12, 34, 56)');
    expectColorToBe(color, reference, 0.5);
  });

  test('should construct a color from a hsl string', () => {
    const color = new Color4('hsl(120, 100%, 50%)');
    const reference = new THREE.Color('hsl(120, 100%, 50%)');
    expectColorToBe(color, reference, 1);
  });

  test('should construct a color from a hsla string', () => {
    const color = new Color4('hsla(120, 100%, 50%, 0.5)');
    const reference = new THREE.Color('hsl(120, 100%, 50%)');
    expectColorToBe(color, reference, 0.5);
  });

  test('should construct a color from a named color', () => {
    const color = new Color4('red');
    const reference = new THREE.Color('red');
    expectColorToBe(color, reference, 1);
  });

  test('should correctly build a hex number', () => {
    const color = new Color4('rgba(255, 0, 0, 0.6)');
    expect(color.getHex()).toBe(0xff000099);
  });

  test('should correctly build a hex string', () => {
    const color = new Color4('rgba(255, 0, 0, 0.5)');
    expect(color.getHexString()).toBe('ff00007f');
  });

  test('should correctly build a rgba string', () => {
    const color = new Color4('rgba(255, 0, 0, 0.5)');
    expect(color.getStyle()).toBe('rgba(255,0,0,0.5)');
  });
});
