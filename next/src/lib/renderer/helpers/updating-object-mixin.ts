import { THREE } from '@lib/three.js';
import { Renderer } from '../renderer';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Object3DConstructor = new (...args: any[]) => THREE.Object3D;

export function UpdatingObjectMixin<TBase extends Object3DConstructor>(
  Base: TBase,
) {
  abstract class UpdatingObject extends Base {
    abstract update(renderer: Renderer): void;
  }
  return UpdatingObject;
}

export type UpdatingObject = InstanceType<
  ReturnType<typeof UpdatingObjectMixin>
>;
