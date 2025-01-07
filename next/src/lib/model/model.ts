import { EventDispatcher } from 'three';
import { Part } from './parts/part';

interface ModelEvents {
  addPart: { part: Part };
  removePart: { part: Part };
}

export class Model extends EventDispatcher<ModelEvents> {
  parts: Part[] = [];

  addPart(...parts: Part[]) {
    this.parts.push(...parts);
    for (const part of parts) {
      this.dispatchEvent({ type: 'addPart', part });
    }
  }

  removePart(...parts: Part[]) {
    for (const part of parts) {
      const index = this.parts.indexOf(part);
      if (index !== -1) {
        this.parts.splice(index, 1);
        this.dispatchEvent({ type: 'removePart', part });
      }
    }
  }
}
