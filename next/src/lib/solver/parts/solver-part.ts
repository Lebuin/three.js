import { Part } from '@/lib/model/parts';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Solver } from '../solver';
import { SolverVertex } from './solver-vertex';
import { SolverWorkplane } from './solver-workplane';

export class SolverPart<T extends Part = Part> {
  public readonly part: T;
  private _vertices?: SolverVertex<T>[];

  constructor(part: T) {
    this.part = part;
  }

  get vertices() {
    return this._vertices;
  }

  addToSolver(solver: Solver) {
    const workplanes = this.createWorkplanes(solver);
    this._vertices = this.createVertices(solver, workplanes);
  }

  private createWorkplanes(solver: Solver) {
    // The start point of the part, in local uvn coordinates.
    const start = this.part.position
      .clone()
      .applyQuaternion(this.part.quaternion.clone().invert());

    // In order to be able to use the relative z position, we need to create 3 workplanes:
    // - One for the z start position. This has a normal that coincides with the local X axis.
    // - One for the bottom plane. This has a normal that coincides with the local Z axis.
    // - One for the top plane. This is coplanar with the bottom plane, but at a different offset.
    const zQuaternion = getQuaternionFromAxes(
      new THREE.Vector3(0, 0, 1).applyQuaternion(this.part.quaternion),
      new THREE.Vector3(1, 0, 0).applyQuaternion(this.part.quaternion),
    );
    const zWorkplane = solver.slvs.addWorkplane(
      solver.groupConstant,
      solver.slvs.addPoint3D(solver.groupConstant, 0, 0, 0),
      solver.slvs.addNormal3D(
        solver.groupConstant,
        zQuaternion.w,
        zQuaternion.x,
        zQuaternion.y,
        zQuaternion.z,
      ),
    );

    // We put the origins of our workplanes at the projection of the global origin onto the
    // workplane. This way, the start and end point of the part will be equivalent, each with its
    // own nonzero u and v coordinates.
    const origin = solver.slvs.addPoint2D(
      solver.groupConstant,
      0,
      0,
      zWorkplane,
    );
    const startOrigin = solver.slvs.addPoint2D(
      solver.groupSolve,
      start.z,
      0,
      zWorkplane,
    );
    const endOrigin = solver.slvs.addPoint2D(
      solver.groupSolve,
      start.z + this.part.size.z,
      0,
      zWorkplane,
    );
    solver.slvs.horizontal(solver.groupSolve, origin, zWorkplane, startOrigin);
    solver.slvs.horizontal(solver.groupSolve, origin, zWorkplane, endOrigin);
    solver.slvs.distance(
      solver.groupSolve,
      startOrigin,
      endOrigin,
      this.part.size.z,
      zWorkplane,
    );

    const quaternion = solver.slvs.addNormal3D(
      solver.groupConstant,
      this.part.quaternion.w,
      this.part.quaternion.x,
      this.part.quaternion.y,
      this.part.quaternion.z,
    );
    const startWorkplane = solver.slvs.addWorkplane(
      solver.groupSolve,
      startOrigin,
      quaternion,
    );
    const endWorkplane = solver.slvs.addWorkplane(
      solver.groupSolve,
      endOrigin,
      quaternion,
    );

    const startSolverWorkplane = new SolverWorkplane(
      startWorkplane,
      startOrigin,
      quaternion,
    );
    const endSolverWorkplane = new SolverWorkplane(
      endWorkplane,
      endOrigin,
      quaternion,
    );
    return [startSolverWorkplane, endSolverWorkplane];
  }

  private createVertices(solver: Solver, workplanes: SolverWorkplane[]) {
    // The start and end point of the part, in local uvn coordinates.
    const start = this.part.position
      .clone()
      .applyQuaternion(this.part.quaternion.clone().invert());
    const end = start.clone().add(this.part.size);
    const points = [start, end];

    const solverVertices: SolverVertex<T>[] = [];
    for (const vertex of this.part.vertices) {
      const u = points[vertex.localPosition.x]?.x;
      const v = points[vertex.localPosition.y]?.y;
      const workplane = workplanes[vertex.localPosition.z];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (u == null || v == null || workplane == null) {
        throw new Error(
          `Vertex has an illegal local position: ${vertex.localPosition.toArray()}`,
        );
      }

      const point = solver.slvs.addPoint2D(
        solver.groupSolve,
        u,
        v,
        workplane.workplane,
      );
      const solverVertex = new SolverVertex(this, vertex, workplane, point);
      solverVertices.push(solverVertex);
    }

    for (const i of [0, 2]) {
      solver.slvs.horizontal(
        solver.groupSolve,
        solverVertices[i].point,
        solverVertices[i].workplane.workplane,
        solverVertices[i + 1].point,
      );
    }

    for (const i of [0, 1]) {
      solver.slvs.vertical(
        solver.groupSolve,
        solverVertices[i].point,
        solverVertices[i].workplane.workplane,
        solverVertices[i + 2].point,
      );
    }

    for (const i of [0, 1, 2, 3]) {
      solver.slvs.coincident(
        solver.groupSolve,
        solverVertices[i].point,
        solverVertices[i + 4].point,
        solverVertices[i].workplane.workplane,
      );
    }

    return solverVertices;
  }

  apply(solver: Solver) {
    if (!this.vertices) {
      throw new Error('Solver part not added to solver');
    }

    const localStart = new THREE.Vector3(
      solver.getParamValue(this.vertices[0].point.param[0]),
      solver.getParamValue(this.vertices[0].point.param[1]),
      solver.getParamValue(this.vertices[0].workplane.origin.param[0]),
    );
    const localEnd = new THREE.Vector3(
      solver.getParamValue(this.vertices[7].point.param[0]),
      solver.getParamValue(this.vertices[7].point.param[1]),
      solver.getParamValue(this.vertices[7].workplane.origin.param[0]),
    );

    const position = localStart.clone().applyQuaternion(this.part.quaternion);
    const size = localEnd.clone().sub(localStart);

    this.part.position = position;
    this.part.size = size;
  }
}
