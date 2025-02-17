import { initSolveSpace } from '@lib/solvespace';
import { THREE } from '@lib/three.js';
import { Solver } from '../solver';
import { EventDispatcher } from '../util/event-dispatcher';
import { CoincidentConstraint } from './constraints';
import { Beam } from './parts';
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
export async function initModel(model: Model) {
  const size = new THREE.Vector3(800, 500, 300);
  const boardThickness = 18;
  const beamThickness = [50, 100];

  function getVertexIndex(u: 0 | 1, v: 0 | 1, n: 0 | 1) {
    return u + v * 2 + n * 4;
  }

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

  const constraints = [
    new CoincidentConstraint(
      parts[0].vertices[getVertexIndex(0, 0, 0)],
      parts[2].vertices[getVertexIndex(0, 0, 1)],
    ),
    new CoincidentConstraint(
      parts[0].vertices[getVertexIndex(0, 1, 0)],
      parts[2].vertices[getVertexIndex(1, 0, 1)],
    ),

    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(0, 0, 1)],
      parts[2].vertices[getVertexIndex(0, 1, 1)],
    ),
    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(0, 1, 1)],
      parts[2].vertices[getVertexIndex(1, 1, 1)],
    ),

    new CoincidentConstraint(
      parts[0].vertices[getVertexIndex(1, 0, 0)],
      parts[3].vertices[getVertexIndex(0, 0, 0)],
    ),
    new CoincidentConstraint(
      parts[0].vertices[getVertexIndex(1, 1, 0)],
      parts[3].vertices[getVertexIndex(1, 0, 0)],
    ),

    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(1, 0, 1)],
      parts[3].vertices[getVertexIndex(0, 1, 0)],
    ),
    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(1, 1, 1)],
      parts[3].vertices[getVertexIndex(1, 1, 0)],
    ),

    new CoincidentConstraint(
      parts[2].vertices[getVertexIndex(0, 0, 0)],
      parts[4].vertices[getVertexIndex(0, 0, 0)],
    ),
    new CoincidentConstraint(
      parts[2].vertices[getVertexIndex(0, 1, 0)],
      parts[4].vertices[getVertexIndex(0, 1, 0)],
    ),
    new CoincidentConstraint(
      parts[3].vertices[getVertexIndex(0, 0, 1)],
      parts[4].vertices[getVertexIndex(1, 0, 0)],
    ),
    new CoincidentConstraint(
      parts[3].vertices[getVertexIndex(0, 1, 1)],
      parts[4].vertices[getVertexIndex(1, 1, 0)],
    ),

    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(0, 1, 0)],
      parts[5].vertices[getVertexIndex(0, 0, 1)],
    ),
    new CoincidentConstraint(
      parts[1].vertices[getVertexIndex(1, 1, 0)],
      parts[5].vertices[getVertexIndex(1, 0, 1)],
    ),
  ];

  model.addPart(...parts);
  constraints.forEach((constraint) => {
    constraint.add();
  });

  parts[0].size.x = 1500;
  const draggedVertex = parts[0].vertices[1];

  await initSolveSpace();
  const solver = new Solver();
  solver.buildSketch(model, [draggedVertex]);

  solver.solve();
  solver.apply();
}
