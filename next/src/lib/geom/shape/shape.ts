import { TopoDS_Shape } from '@lib/opencascade.js';
import { RootShape } from './root-shape';

export function isRoot(shape: unknown): shape is RootShape {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  return !!shape && (shape as any).isRoot === true;
}

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

  getRoot(): RootShape {
    let parent: unknown = this;
    while (parent) {
      if (isRoot(parent)) {
        return parent;
      } else if (parent instanceof Shape) {
        parent = parent.parent;
      } else {
        parent = undefined;
      }
    }

    throw new Error('Root shape not found');
  }

  getRootGeometries() {
    return this.getRoot().geometries;
  }
}
