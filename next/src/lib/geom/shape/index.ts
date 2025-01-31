import { TopoDS_Shape } from '@lib/opencascade.js';
import { Compound } from './compound';
import { getShapeType, ShapeType } from './shape-type';
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

export { getOCShapeType, getShapeType, ShapeType } from './shape-type';

export function shapeFactory(shape: TopoDS_Shape) {
  const shapeType = getShapeType(shape);

  switch (shapeType) {
    case ShapeType.COMPOUND:
      return new Compound(shape);
    case ShapeType.SOLID:
      return new Solid(shape);
    case ShapeType.SHELL:
      return new Shell(shape);
    case ShapeType.WIRE:
      return new Wire(shape);
    default:
      throw new Error(`Unsupported shape type: ${shapeType}`);
  }
}
