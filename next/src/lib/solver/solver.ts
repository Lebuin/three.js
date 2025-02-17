import { Model } from '@/lib/model/model';
import { Part, PartVertex } from '@/lib/model/parts';
import { getSolvespace, SlvsModule } from '@lib/solvespace';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { CoincidentConstraint } from '../model/constraints';
import { solverPartFactory } from './parts';
import { SolverPart } from './parts/solver-part';
import { SolverVertex } from './parts/solver-vertex';
import { SolverConstraint } from './solver-constraint';

export class Solver {
  public readonly slvs: SlvsModule;
  public solverParts = new Map<Part, SolverPart>();
  public solverConstraints = new Map<CoincidentConstraint, SolverConstraint>();

  public readonly groupConstant = 1;
  public readonly groupSolve = 2;

  constructor() {
    this.slvs = getSolvespace();
  }

  buildSketch(model: Model, draggedVertices: Iterable<PartVertex> = []) {
    this.slvs.clearSketch();

    this.solverParts = this.createSolverParts(model);
    for (const solverPart of this.solverParts.values()) {
      this.addSolverPart(solverPart);
    }

    for (const vertex of draggedVertices) {
      const part = vertex.part;
      const solverPart = this.solverParts.get(part);
      if (solverPart == null) {
        throw new Error('Solver part not found');
      }
      solverPart.setDragged(vertex);
    }

    this.solverConstraints = this.createSolverConstraints(this.solverParts);
    for (const solverConstraint of this.solverConstraints.values()) {
      this.addSolverConstraint(solverConstraint);
    }
  }

  update() {
    for (const solverPart of this.solverParts.values()) {
      solverPart.update();
    }
  }

  getParamValue(param: number) {
    if (param === 0) {
      throw new Error('Parameter value is not set');
    }
    return this.slvs.getParamValue(param);
  }

  private createSolverParts(model: Model) {
    const parts = new Map<Part, SolverPart>();
    for (const part of model.parts) {
      const solverPart = this.createSolverPart(part);
      parts.set(part, solverPart);
    }
    return parts;
  }

  private createSolverPart(part: Part) {
    const solverPart = solverPartFactory(this, part);
    return solverPart;
  }

  private addSolverPart(solverPart: SolverPart) {
    solverPart.addToSolver();
  }

  private createSolverConstraints(solverParts: Map<Part, SolverPart>) {
    interface ConstraintInfo {
      solverVertex1?: SolverVertex;
      solverVertex2?: SolverVertex;
    }
    const constraintsInfo = new Map<CoincidentConstraint, ConstraintInfo>();

    for (const solverPart of solverParts.values()) {
      if (solverPart.vertices == null) {
        throw new Error('Solver part not added to solver');
      }
      for (const solverVertex of solverPart.vertices) {
        for (const constraint of solverVertex.vertex.constraints) {
          let info = constraintsInfo.get(constraint);
          if (info == null) {
            info = {};
            constraintsInfo.set(constraint, info);
          }
          if (constraint.vertex1 === solverVertex.vertex) {
            info.solverVertex1 = solverVertex;
          } else {
            info.solverVertex2 = solverVertex;
          }
        }
      }
    }

    const solverConstraints = new Map(
      constraintsInfo.entries().map(([constraint, info]) => {
        if (info.solverVertex1 == null || info.solverVertex2 == null) {
          throw new Error(
            'One or more constraint vertices are not yet added to the solver',
          );
        }
        const solverConstraint = this.createSolverConstraint(
          constraint,
          info.solverVertex1,
          info.solverVertex2,
        );
        return [constraint, solverConstraint];
      }),
    );
    return solverConstraints;
  }

  private createSolverConstraint(
    constraint: CoincidentConstraint,
    solverVertex1: SolverVertex,
    solverVertex2: SolverVertex,
  ) {
    const solverConstraint = new SolverConstraint(
      constraint,
      solverVertex1,
      solverVertex2,
    );
    return solverConstraint;
  }

  private addSolverConstraint(solverConstraint: SolverConstraint) {
    solverConstraint.addToSolver(this);
  }

  solve() {
    const result = this.slvs.solveSketch(this.groupSolve, false);
    return result;
  }

  private printParams() {
    function getVertexIndex(u: number, v: number, n: number) {
      return u + v * 2 + n * 4;
    }

    for (const solverPart of this.solverParts.values()) {
      if (solverPart.vertices == null) {
        throw new Error('Solver part not added to solver');
      }
      console.log('Part:');
      for (const solverVertex of solverPart.vertices) {
        const position = this.getGlobalPosition(solverVertex);
        const positionRounded = position
          .toArray()
          .map((x) => _.padStart(x.toFixed(2), 6));
        console.log(`  ${positionRounded.join(', ')}`);
      }

      // prettier-ignore
      const us = [
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 0, 0)].point.param[0]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 0, 0)].point.param[0]),
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 1, 0)].point.param[0]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 1, 0)].point.param[0]),
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 0, 1)].point.param[0]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 0, 1)].point.param[0]),
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 1, 1)].point.param[0]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 1, 1)].point.param[0]),
      ];
      // prettier-ignore
      const vs = [
        this.getParamValue(solverPart.vertices[getVertexIndex(0, 1, 0)].point.param[1]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 0, 0)].point.param[1]),
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 1, 0)].point.param[1]) - this.getParamValue(solverPart.vertices[getVertexIndex(1, 0, 0)].point.param[1]),
        this.getParamValue(solverPart.vertices[getVertexIndex(0, 1, 1)].point.param[1]) - this.getParamValue(solverPart.vertices[getVertexIndex(0, 0, 1)].point.param[1]),
        this.getParamValue(solverPart.vertices[getVertexIndex(1, 1, 1)].point.param[1]) - this.getParamValue(solverPart.vertices[getVertexIndex(1, 0, 1)].point.param[1]),
      ];
      console.log(
        '[' + us.map((x) => x.toFixed(2)).join(', ') + ']',
        '[' + vs.map((x) => x.toFixed(2)).join(', ') + ']',
      );
    }
  }

  private getGlobalPosition(solverVertex: SolverVertex) {
    const localPosition = new THREE.Vector3(
      this.getParamValue(solverVertex.point.param[0]),
      this.getParamValue(solverVertex.point.param[1]),
      this.getParamValue(solverVertex.workplane.origin.param[0]),
    );
    const part = solverVertex.vertex.part;
    const globalPosition = localPosition
      .clone()
      .applyQuaternion(part.quaternion);
    return globalPosition;
  }

  apply() {
    this.solverParts.forEach((solverPart) => {
      solverPart.apply(this);
    });
  }
}
