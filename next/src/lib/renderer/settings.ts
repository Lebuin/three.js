import { Color4 } from '../util/color4';

const baseColors = {
  x: new Color4('#D95A4E'),
  y: new Color4('#24B362'),
  z: new Color4('#5793D9'),
};

export const axesColors = {
  x: {
    primary: baseColors.x.clone(),
    secondary: baseColors.x.clone().lerp(new Color4(), 0.5),
    plane: baseColors.x.clone().lerp(new Color4(), 0.5),
  },
  y: {
    primary: baseColors.y.clone(),
    secondary: baseColors.y.clone().lerp(new Color4(), 0.35),
    plane: baseColors.y.clone().lerp(new Color4(), 0.5),
  },
  z: {
    primary: baseColors.z.clone(),
    secondary: baseColors.z.clone().lerp(new Color4(), 0.5),
    plane: baseColors.z.clone().lerp(new Color4(), 0.5),
  },
  default: {
    primary: new Color4().setHSL(0, 0, 0.5),
    secondary: new Color4().setHSL(0, 0, 0.75),
    plane: new Color4().setHSL(0, 0, 0.5),
  },
} as const;
