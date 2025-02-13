import { getSolvespace, initSolveSpace } from '@lib/solvespace';

export { SolverConstraint } from './parts/solver-constraint';
export { SolverPart } from './parts/solver-part';
export { SolverVertex } from './parts/solver-vertex';
export { Solver } from './solver';

export async function test() {
  await initSolveSpace();
  const slvs = getSolvespace();

  slvs.clearSketch();
  const groupConstant = 1;
  const groupSolve = 2;

  const workplane = slvs.addBase2D(groupConstant);
  // const zero = slvs.addParam(groupConstant, 0);
  // const zero2 = slvs.addParam(groupConstant, 0);
  // const u1 = slvs.addParam(groupSolve, 10);
  // const u2 = slvs.addParam(groupSolve, 20);
  const point1 = slvs.addPoint2D(groupSolve, 0, 0, workplane);
  const point2 = slvs.addPoint2D(groupSolve, 10, 10, workplane);
  slvs.distance(groupSolve, point1, point2, 15, workplane);

  const result = slvs.solveSketch(groupSolve, false);
  const paramVal = {
    point1: {
      u: slvs.getParamValue(point1.param[0]),
      v: slvs.getParamValue(point1.param[1]),
    },
    point2: {
      u: slvs.getParamValue(point2.param[0]),
      v: slvs.getParamValue(point2.param[1]),
    },
  };
  console.log(paramVal);

  // const ox = slvs.addParam(groupConstant, 0);
  // const oy = slvs.addParam(groupConstant, 0);
  // const oz = slvs.addParam(groupConstant, 0);
  // const origin = slvs.addPoint3D(groupConstant, zero, zero, zero);

  // const qw = slvs.addParam(groupConstant, 1);
  // const qx = slvs.addParam(groupConstant, 0);
  // const qy = slvs.addParam(groupConstant, 0);
  // const qz = slvs.addParam(groupConstant, 0);
  // const normal = slvs.addNormal3D(groupConstant, qw, qx, qy, qz);

  // const workplane = slvs.addWorkplane(groupConstant, origin, normal);

  // const p0x = slvs.addParam(groupSolve, 0);
  // const p0y = slvs.addParam(groupSolve, 0);
  // const p0 = slvs.addPoint2D(groupSolve, p0x, p0y, workplane);
  // slvs.dragged(groupSolve, p0, workplane);

  // const p1x = slvs.addParam(groupSolve, 10);
  // const p1y = slvs.addParam(groupSolve, 5);
  // const p1 = slvs.addPoint2D(groupSolve, p1x, p1y, workplane);
  // slvs.distance(groupSolve, p0, p1, 20, workplane);

  // const result = slvs.solveSketch(groupSolve, false);
  // const p1Val = {
  //   x: slvs.getParamValue(p1.param[0]),
  //   y: slvs.getParamValue(p1.param[1]),
  // };

  // console.log(result, p1Val);
}
