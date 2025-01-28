import { TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { getOC } from './oc';
import { pointFromVector, pointToVector } from './util';

export function getIntersections(
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape,
  tolerance = 1e-6,
): THREE.Vector3[] {
  const oc = getOC();

  const progressRange = new oc.Message_ProgressRange_1();
  const distanceTool = new oc.BRepExtrema_DistShapeShape_1();
  distanceTool.LoadS1(shape1);
  distanceTool.LoadS2(shape2);
  distanceTool.Perform(progressRange);
  if (!distanceTool.IsDone()) {
    throw new Error('Distance calculation failed');
  }

  const distance = distanceTool.Value();
  if (distance > tolerance) {
    return [];
  }

  const numSolutions = distanceTool.NbSolution();
  const intersections = [];
  for (let i = 0; i < numSolutions; i++) {
    const ocPoint1 = distanceTool.PointOnShape1(i + 1);
    const ocPoint2 = distanceTool.PointOnShape2(i + 1);
    if (!ocPoint1.IsEqual(ocPoint2, tolerance)) {
      throw new Error('Points are not equal');
    }
    const point1 = pointToVector(ocPoint1);
    intersections.push(point1);
  }

  return intersections;
}

export function projectOnto(point: THREE.Vector3, shape: TopoDS_Shape) {
  const oc = getOC();
  const ocPoint = pointFromVector(point);
  const vertexMaker = new oc.BRepBuilderAPI_MakeVertex(ocPoint);
  const vertex = vertexMaker.Vertex();

  const progressRange = new oc.Message_ProgressRange_1();
  const distanceTool = new oc.BRepExtrema_DistShapeShape_1();
  distanceTool.LoadS1(shape);
  distanceTool.LoadS2(vertex);
  distanceTool.Perform(progressRange);
  if (!distanceTool.IsDone()) {
    throw new Error('Distance calculation failed');
  }

  const numSolutions = distanceTool.NbSolution();
  if (numSolutions === 0) {
    throw new Error('No solution found');
  } else if (numSolutions > 1) {
    throw new Error('More than one solution found');
  }

  const ocPointOnShape = distanceTool.PointOnShape1(1);
  const pointOnShape = pointToVector(ocPointOnShape);
  return pointOnShape;
}
