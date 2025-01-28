import { TopoDS_Shape } from '@lib/opencascade.js';

export abstract class Shape<
  T extends TopoDS_Shape = TopoDS_Shape,
  P = unknown,
> {
  public shape: T;
  public parent?: P;

  constructor(shape: T, parent?: P) {
    this.shape = shape;
    this.parent = parent;
  }
}
