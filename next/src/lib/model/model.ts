import { THREE } from '@lib/three.js';
import { EventDispatcher } from '../util/event-dispatcher';
import { Beam } from './parts/beam';
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
  const boardThickness = 18;
  const beamThickness = [50, 100];
  const parts = [
    new Board(
      new THREE.Vector3(size.x, size.z, boardThickness),
      new THREE.Vector3(0, boardThickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.x, size.z, boardThickness),
      new THREE.Vector3(0, size.y, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.z, size.y - 2 * boardThickness, boardThickness),
      new THREE.Vector3(boardThickness, boardThickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(size.z, size.y - 2 * boardThickness, boardThickness),
      new THREE.Vector3(size.x, boardThickness, 0),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        -Math.PI / 2,
      ),
    ),
    new Board(
      new THREE.Vector3(
        size.x - 2 * boardThickness,
        size.y - 2 * boardThickness,
        boardThickness,
      ),
      new THREE.Vector3(boardThickness, boardThickness, 0),
    ),
    new Beam(
      new THREE.Vector3(size.x, beamThickness[0], beamThickness[0]),
      new THREE.Vector3(0, size.y, size.z - beamThickness[0]),
    ),
  ];
  // model.addPart(...parts);
}
