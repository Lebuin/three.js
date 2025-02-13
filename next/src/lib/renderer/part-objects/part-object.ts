import { OCGeometries } from '@/lib/geom/geometries';
import { Part } from '@/lib/model/parts';
import { BasePart } from '@/lib/model/parts/base-part';
import { UpdatingObjectMixin } from '../helpers/updating-object-mixin';
import { MaterialObject } from './material-object';

export class BasePartObject<
  T extends BasePart = BasePart,
> extends UpdatingObjectMixin(MaterialObject<OCGeometries>) {
  protected _part: T;

  constructor(part: T) {
    super(part.shape.geometries);
    this._part = part;
  }

  get part() {
    return this._part;
  }

  update() {
    if (this.geometries !== this.part.shape.geometries) {
      this.setGeometries(this.part.shape.geometries);
    }
  }
}

export class PartObject<T extends Part = Part> extends BasePartObject<T> {}
