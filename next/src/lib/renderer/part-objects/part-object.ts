import { Part } from '@/lib/model/parts/part';
import * as THREE from 'three';

export abstract class PartObject<T extends Part> extends THREE.Group {
  protected _part: T;

  constructor(part: T) {
    super();
    this._part = part;
  }

  get part() {
    return this._part;
  }

  dispose() {
    // Subclasses should override this method to clean up resources.
  }
}
