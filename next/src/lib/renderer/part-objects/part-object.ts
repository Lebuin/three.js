import { OCGeometries } from '@/lib/geom/geometries';
import { Part } from '@/lib/model/parts/part';
import { MaterialObject } from './material-object';

export class PartObject<
  T extends Part = Part,
> extends MaterialObject<OCGeometries> {
  protected _part: T;

  constructor(part: T) {
    super(part.shape.geometries);
    this._part = part;

    this.part.addEventListener('change', this.onPartChange);
  }

  delete() {
    this.part.removeEventListener('change', this.onPartChange);
  }

  get part() {
    return this._part;
  }

  protected onPartChange = () => {
    this.setGeometries(this.part.shape.geometries);
  };
}
