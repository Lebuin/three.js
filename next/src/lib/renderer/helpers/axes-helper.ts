import { disposeMaterial } from '@/lib/util/three';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { Color4 } from '../../util/color4';
interface AxisColors {
  primary: Color4;
  secondary: Color4;
}
interface AxesColors {
  x: AxisColors;
  y: AxisColors;
  z: AxisColors;
}

const defaultColors: AxesColors = {
  x: {
    primary: new Color4().setHSL(0, 1, 0.5),
    secondary: new Color4().setHSL(0, 1, 0.75),
  },
  y: {
    primary: new Color4().setHSL(120 / 360, 1, 0.5),
    secondary: new Color4().setHSL(120 / 360, 1, 0.75),
  },
  z: {
    primary: new Color4().setHSL(240 / 360, 1, 0.5),
    secondary: new Color4().setHSL(240 / 360, 1, 0.75),
  },
};

export class AxesHelper extends THREE.LineSegments {
  override readonly type = 'Axes';

  constructor(size = 1, colors: Partial<AxesColors> = {}) {
    const allColors = _.merge({}, defaultColors, colors);

    // prettier-ignore
    const vertices = [
      0, 0, 0, size, 0, 0,
      0, 0, 0, 0, size, 0,
      0, 0, 0, 0, 0, size,
      0, 0, 0, -size, 0, 0,
      0, 0, 0, 0, -size, 0,
      0, 0, 0, 0, 0, -size,
    ];

    // prettier-ignore
    const colorsArray = [
      ...allColors.x.primary.toArray4(), ...allColors.x.primary.toArray4(),
      ...allColors.y.primary.toArray4(), ...allColors.y.primary.toArray4(),
      ...allColors.z.primary.toArray4(), ...allColors.z.primary.toArray4(),
      ...allColors.x.secondary.toArray4(), ...allColors.x.secondary.toArray4(),
      ...allColors.y.secondary.toArray4(), ...allColors.y.secondary.toArray4(),
      ...allColors.z.secondary.toArray4(), ...allColors.z.secondary.toArray4(),
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colorsArray, 4),
    );

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
    });

    super(geometry, material);

    this.computeLineDistances();
  }

  dispose() {
    this.geometry.dispose();
    disposeMaterial(this.material);
  }
}
