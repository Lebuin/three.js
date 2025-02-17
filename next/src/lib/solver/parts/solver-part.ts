import { Part, PartVertex } from '@/lib/model/parts';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import { Solver } from '../solver';
import { SolverWorkplane } from '../solver-workplane';
import { SolverVertex } from './solver-vertex';

export abstract class SolverPart<T extends Part = Part> {
  public readonly solver: Solver;
  public readonly part: T;
  private _workplanes?: SolverWorkplane[];
  private _vertices?: SolverVertex<T>[];

  constructor(solver: Solver, part: T) {
    this.solver = solver;
    this.part = part;
  }

  get vertices() {
    return this._vertices;
  }

  addToSolver() {
    this._workplanes = this.createWorkplanes();
    this._vertices = this.createVertices(this._workplanes);
    this.addConstraints(this._vertices);
    this.update();
  }

  protected abstract addConstraints(vertices: SolverVertex<T>[]): void;

  setDragged(vertex: PartVertex<T>, dragged = true) {
    if (!this.vertices) {
      throw new Error('Solver part not added to solver');
    }

    const solverVertex = this.vertices[vertex.index];
    if (solverVertex.vertex !== vertex) {
      throw new Error('Solver vertex does not match part vertex');
    }

    solverVertex.dragged = dragged;
    this.solver.slvs.dragged(
      this.solver.groupSolve,
      solverVertex.point,
      solverVertex.workplane.workplane,
    );
  }

  /**
   * Update the position and size of the part based on the model part.
   */
  update() {
    if (!this._workplanes || !this.vertices) {
      throw new Error('Solver part not added to solver');
    }

    // The start and end point of the part, in local uvn coordinates.
    const start = this.part.position
      .clone()
      .applyQuaternion(this.part.quaternion.clone().invert());
    const end = start.clone().add(this.part.size);
    const points = [start, end];

    for (const i of [0, 1]) {
      this.solver.slvs.setParamValue(
        this._workplanes[i].origin.param[0],
        points[i].z,
      );
    }

    for (const solverVertex of this.vertices) {
      const pointU = points[solverVertex.vertex.localPosition.x];
      const pointV = points[solverVertex.vertex.localPosition.y];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (pointU == null || pointV == null) {
        throw new Error(
          `Vertex has an illegal local position: ${solverVertex.vertex.localPosition.toArray()}`,
        );
      }

      this.solver.slvs.setParamValue(solverVertex.point.param[0], pointU.x);
      this.solver.slvs.setParamValue(solverVertex.point.param[1], pointV.y);
    }
  }

  private createWorkplanes() {
    // In order to be able to use the relative z position, we need to create 3 workplanes:
    // - One for the z start position. This has a normal that coincides with the local X axis.
    // - One for the bottom plane. This has a normal that coincides with the local Z axis.
    // - One for the top plane. This is coplanar with the bottom plane, but at a different offset.
    const zQuaternion = getQuaternionFromAxes(
      new THREE.Vector3(0, 0, 1).applyQuaternion(this.part.quaternion),
      new THREE.Vector3(1, 0, 0).applyQuaternion(this.part.quaternion),
    );
    const zWorkplane = this.solver.slvs.addWorkplane(
      this.solver.groupConstant,
      this.solver.slvs.addPoint3D(this.solver.groupConstant, 0, 0, 0),
      this.solver.slvs.addNormal3D(
        this.solver.groupConstant,
        zQuaternion.w,
        zQuaternion.x,
        zQuaternion.y,
        zQuaternion.z,
      ),
    );

    // Some of the parameters below will be set later in `{@link update}`. This variable documents
    // those parameters. It's actual value is not important.
    const VARIABLE = 0;

    // We put the origins of our workplanes at the projection of the global origin onto the
    // workplane. This way, the start and end point of the part will be equivalent, each with its
    // own nonzero u and v coordinates.
    const origin = this.solver.slvs.addPoint2D(
      this.solver.groupConstant,
      0,
      0,
      zWorkplane,
    );
    const startOrigin = this.solver.slvs.addPoint2D(
      this.solver.groupSolve,
      VARIABLE,
      0,
      zWorkplane,
    );
    const endOrigin = this.solver.slvs.addPoint2D(
      this.solver.groupSolve,
      VARIABLE,
      0,
      zWorkplane,
    );
    this.solver.slvs.horizontal(
      this.solver.groupSolve,
      origin,
      zWorkplane,
      startOrigin,
    );
    this.solver.slvs.horizontal(
      this.solver.groupSolve,
      origin,
      zWorkplane,
      endOrigin,
    );

    const quaternion = this.solver.slvs.addNormal3D(
      this.solver.groupConstant,
      this.part.quaternion.w,
      this.part.quaternion.x,
      this.part.quaternion.y,
      this.part.quaternion.z,
    );
    const startWorkplane = this.solver.slvs.addWorkplane(
      this.solver.groupSolve,
      startOrigin,
      quaternion,
    );
    const endWorkplane = this.solver.slvs.addWorkplane(
      this.solver.groupSolve,
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

  private createVertices(workplanes: SolverWorkplane[]) {
    // Some of the parameters below will be set later in `{@link update}`. This variable documents
    // those parameters. It's actual value is not important.
    const VARIABLE = 0;

    const solverVertices: SolverVertex<T>[] = [];
    for (const vertex of this.part.vertices) {
      const workplane = workplanes[vertex.localPosition.z];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (workplane == null) {
        throw new Error(
          `Vertex has an illegal local position: ${vertex.localPosition.toArray()}`,
        );
      }

      const point = this.solver.slvs.addPoint2D(
        this.solver.groupSolve,
        VARIABLE,
        VARIABLE,
        workplane.workplane,
      );

      const solverVertex = new SolverVertex(this, vertex, workplane, point);
      solverVertices.push(solverVertex);
    }

    for (const i of [0, 2]) {
      this.solver.slvs.horizontal(
        this.solver.groupSolve,
        solverVertices[i].point,
        solverVertices[i].workplane.workplane,
        solverVertices[i + 1].point,
      );
    }

    for (const i of [0, 1]) {
      this.solver.slvs.vertical(
        this.solver.groupSolve,
        solverVertices[i].point,
        solverVertices[i].workplane.workplane,
        solverVertices[i + 2].point,
      );
    }

    for (const i of [0, 1, 2, 3]) {
      this.solver.slvs.coincident(
        this.solver.groupSolve,
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
