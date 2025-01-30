import { TopoDS_Shape } from '@lib/opencascade.js';
import { getOC } from '../oc';
import { Compound } from './compound';
import { Shell } from './shell';
import { Solid } from './solid';
import { Wire } from './wire';

export { Edge } from './edge';
export { Face } from './face';
export { RootShape } from './root-shape';
export { Shape } from './shape';
export { Solid } from './solid';
export { Vertex } from './vertex';
export { Wire } from './wire';

export function shapeFactory(shape: TopoDS_Shape) {
  const oc = getOC();
  const shapeType = shape.ShapeType();
  if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_SOLID) {
    return new Solid(shape);
  } else if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_SHELL) {
    return new Shell(shape);
  } else if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_WIRE) {
    return new Wire(shape);
  } else if (shapeType === oc.TopAbs_ShapeEnum.TopAbs_COMPOUND) {
    return new Compound(shape);
  } else {
    throw new Error(`Unsupported shape type: ${shapeType.constructor.name}`);
  }
}
