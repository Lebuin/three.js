import { Color } from '../util/color';

export const axesColors = {
  x: {
    primary: new Color().setHSL(0, 1, 0.5),
    secondary: new Color().setHSL(0, 1, 0.75),
    plane: new Color().setHSL(0, 1, 0.75),
  },
  y: {
    primary: new Color().setHSL(120 / 360, 1, 0.5),
    secondary: new Color().setHSL(120 / 360, 1, 0.75),
    plane: new Color().setHSL(120 / 360, 1, 0.75),
  },
  z: {
    primary: new Color().setHSL(240 / 360, 1, 0.5),
    secondary: new Color().setHSL(240 / 360, 1, 0.75),
    plane: new Color().setHSL(240 / 360, 1, 0.75),
  },
  default: {
    primary: new Color().setHSL(0, 0, 0.5),
    secondary: new Color().setHSL(0, 0, 0.75),
    plane: new Color().setHSL(0, 0, 0.5),
  },
} as const;
