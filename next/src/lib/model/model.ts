import { Part } from './parts/part';

export class Model {
  parts: Part[] = [];

  addPart(...parts: Part[]) {
    this.parts.push(...parts);
  }
}
