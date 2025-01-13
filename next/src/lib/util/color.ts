import * as THREE from 'three';

export type ColorRepresentation = string | number | Color;

export class Color extends THREE.Color {
  public r = 1;
  public g = 1;
  public b = 1;
  public a = 1;
  public readonly isColor = true;

  constructor();
  constructor(value: ColorRepresentation);
  constructor(r: number, g: number, b: number);
  constructor(r: number, g: number, b: number, opacity: number);

  constructor(
    ...args:
      | []
      | [THREE.ColorRepresentation]
      | [number, number, number]
      | [number, number, number, number]
  ) {
    super();

    if (args.length === 0) {
      this.set();
    } else if (args.length === 1) {
      this.set(...args);
    } else if (args.length === 3) {
      this.set(...args);
    } else {
      this.set(...args);
    }
  }

  set(): this;
  set(value: THREE.ColorRepresentation): this;
  set(r: number, g: number, b: number): this;
  set(r: number, g: number, b: number, a: number): this;

  set(
    ...args:
      | []
      | [THREE.ColorRepresentation]
      | [number, number, number]
      | [number, number, number, number]
  ): this {
    if (args.length === 0) {
      // Do nothing, the default values are already set.
    } else if (args.length === 1) {
      const value = args[0];
      if (value instanceof Color) {
        this.copy(value);
      } else if (typeof value === 'number') {
        this.setHex(value);
      } else if (typeof value === 'string') {
        this.setStyle(value);
      }
    } else if (args.length === 3) {
      this.setRGB(...args);
    } else {
      this.setRGBA(...args);
    }

    return this;
  }

  clone(): this {
    // Ugly type casting here to make Typescript happy, there is probably a better way.
    return new (this.constructor as typeof Color)(
      this.r,
      this.g,
      this.b,
      this.a,
    ) as this;
  }

  copy(color: Color) {
    super.copy(color);
    this.a = color.a;
    return this;
  }

  setHex(hex: number, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    let intHex = Math.floor(hex);

    if (intHex > 0xffffff) {
      this.a = (intHex & 255) / 255;
      intHex = intHex >> 8;
    } else {
      this.a = 1;
    }

    this.r = ((intHex >> 16) & 255) / 255;
    this.g = ((intHex >> 8) & 255) / 255;
    this.b = (intHex & 255) / 255;

    THREE.ColorManagement.toWorkingColorSpace(this, colorSpace);

    return this;
  }

  setStyle(style: string, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    let m;

    if ((m = /^(\w+)\(([^)]*)\)/.exec(style))) {
      // rgb / hsl

      let color;
      const name = m[1];
      const components = m[2];

      switch (name) {
        case 'rgb':
        case 'rgba':
          if (
            (color =
              /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                components,
              ))
          ) {
            // rgb(255,0,0) rgba(255,0,0,0.5)
            return this.setRGBA(
              Math.min(255, parseInt(color[1], 10)) / 255,
              Math.min(255, parseInt(color[2], 10)) / 255,
              Math.min(255, parseInt(color[3], 10)) / 255,
              (color[4] as string | undefined) === undefined
                ? 1
                : parseFloat(color[4]),
              colorSpace,
            );
          }

          if (
            (color =
              /^\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                components,
              ))
          ) {
            // rgb(100%,0%,0%) rgba(100%,0%,0%,0.5)

            return this.setRGBA(
              Math.min(100, parseInt(color[1], 10)) / 100,
              Math.min(100, parseInt(color[2], 10)) / 100,
              Math.min(100, parseInt(color[3], 10)) / 100,
              (color[4] as string | undefined) === undefined
                ? 1
                : parseFloat(color[4]),
              colorSpace,
            );
          }

          break;

        case 'hsl':
        case 'hsla':
          if (
            (color =
              /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)%\s*,\s*(\d*\.?\d+)%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(
                components,
              ))
          ) {
            // hsl(120,50%,50%) hsla(120,50%,50%,0.5)

            return this.setHSLA(
              parseFloat(color[1]) / 360,
              parseFloat(color[2]) / 100,
              parseFloat(color[3]) / 100,
              (color[4] as string | undefined) === undefined
                ? 1
                : parseFloat(color[4]),
              colorSpace,
            );
          }

          break;

        default:
          console.warn('THREE.Color: Unknown color model ' + style);
      }
    } else if ((m = /^#([A-Fa-f\d]+)$/.exec(style))) {
      // hex color

      const hex = m[1];
      const size = hex.length;

      if (size === 3) {
        // #ff0
        return this.setRGB(
          parseInt(hex.charAt(0), 16) / 15,
          parseInt(hex.charAt(1), 16) / 15,
          parseInt(hex.charAt(2), 16) / 15,
          colorSpace,
        );
      } else if (size === 4) {
        // #ff0f
        return this.setRGBA(
          parseInt(hex.charAt(0), 16) / 15,
          parseInt(hex.charAt(1), 16) / 15,
          parseInt(hex.charAt(2), 16) / 15,
          parseInt(hex.charAt(3), 16) / 15,
          colorSpace,
        );
      } else if (size === 6 || size === 8) {
        // #ff0000 or #ff0000ff
        return this.setHex(parseInt(hex, 16), colorSpace);
      } else {
        console.warn('THREE.Color: Invalid hex color ' + style);
      }
    } else if (style && style.length > 0) {
      return this.setColorName(style, colorSpace);
    }

    return this;
  }

  setA(a: number) {
    this.a = a;
    return this;
  }

  setRGBA(r: number, g: number, b: number, a: number, colorSpace?: string) {
    this.setRGB(r, g, b, colorSpace);
    this.a = a;
    return this;
  }

  setHSLA(h: number, s: number, l: number, a: number, colorSpace?: string) {
    this.setHSL(h, s, l, colorSpace);
    this.a = a;
    return this;
  }

  setScalar(scalar: number) {
    super.setScalar(scalar);
    this.a = 1;
    return this;
  }

  setRGB(r: number, g: number, b: number, colorSpace?: string) {
    super.setRGB(r, g, b, colorSpace);
    this.a = 1;
    return this;
  }

  setHSL(h: number, s: number, l: number, colorSpace?: string) {
    super.setHSL(h, s, l, colorSpace);
    this.a = 1;
    return this;
  }

  setColorName(style: string, colorSpace?: string) {
    super.setColorName(style, colorSpace);
    this.a = 1;
    return this;
  }

  copySRGBToLinear(color: Color) {
    super.copySRGBToLinear(color);
    this.a = color.a;
    return this;
  }

  copyLinearToSRGB(color: Color) {
    super.copyLinearToSRGB(color);
    this.a = color.a;
    return this;
  }

  convertSRGBToLinear() {
    super.convertSRGBToLinear();
    return this;
  }

  convertLinearToSRGB() {
    super.convertLinearToSRGB();
    return this;
  }

  toArray4(array: number[] = [], offset = 0): number[] {
    array[offset] = this.r;
    array[offset + 1] = this.g;
    array[offset + 2] = this.b;
    array[offset + 3] = this.a;

    return array;
  }

  getHex(colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    return super.getHex(colorSpace) << (8 + Math.floor(this.a * 255));
  }

  getHexString(colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    return ('000000' + this.getHex(colorSpace).toString(16)).slice(-8);
  }

  getStyle(colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
    const color = new Color().copy(this);
    THREE.ColorManagement.fromWorkingColorSpace(color, colorSpace);

    const r = color.r;
    const g = color.g;
    const b = color.b;

    if (colorSpace !== THREE.SRGBColorSpace) {
      // Requires CSS Color Module Level 4 (https://www.w3.org/TR/css-color-4/).
      // prettier-ignore
      return `color(${colorSpace} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} / ${this.a})`;
    }

    // prettier-ignore
    return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${this.a})`;
  }
}
