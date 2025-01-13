import { Color } from '../util/color';

const baseColors = {
  x: new Color('#D95A4E'),
  y: new Color('#24B362'),
  z: new Color('#5793D9'),
};

export const axesColors = {
  x: {
    primary: baseColors.x.clone(),
    secondary: baseColors.x.clone().lerp(new Color(), 0.5),
    plane: baseColors.x.clone().lerp(new Color(), 0.5),
  },
  y: {
    primary: baseColors.y.clone(),
    secondary: baseColors.y.clone().lerp(new Color(), 0.35),
    plane: baseColors.y.clone().lerp(new Color(), 0.5),
  },
  z: {
    primary: baseColors.z.clone(),
    secondary: baseColors.z.clone().lerp(new Color(), 0.5),
    plane: baseColors.z.clone().lerp(new Color(), 0.5),
  },
  default: {
    primary: new Color().setHSL(0, 0, 0.5),
    secondary: new Color().setHSL(0, 0, 0.75),
    plane: new Color().setHSL(0, 0, 0.5),
  },
} as const;
