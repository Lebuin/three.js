import { THREE } from '@lib/three.js';
import { EventDispatcher } from '../util/event-dispatcher';
import { Board } from './parts/board';
import { Part } from './parts/part';

interface ModelEvents {
  addPart: { part: Part };
  removePart: { part: Part };
}

export class Model extends EventDispatcher()<ModelEvents> {
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

/**
 * Prepopulate the model during development.
 */
export function initModel(model: Model) {
  const size = new THREE.Vector3(800, 500, 300);
  const thickness = 18;
  const parts = [
    new Board(
      new THREE.Vector3(size.x, size.z, thickness),
      new THREE.Vector3(0, thickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.x, size.z, thickness),
      new THREE.Vector3(0, size.y, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.z, size.y - 2 * thickness, thickness),
      new THREE.Vector3(thickness, thickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.z, size.y - 2 * thickness, thickness),
      new THREE.Vector3(size.x, thickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(
        size.x - 2 * thickness,
        size.y - 2 * thickness,
        thickness,
      ),
      new THREE.Vector3(thickness, thickness, 0),
    ),
  ];
  model.addPart(...parts);
}
