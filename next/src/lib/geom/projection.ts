import { gp_Pnt } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { getOC } from './oc';
import { RootShape, Shape } from './shape';
import { pointFromVector, pointToVector } from './util';

export interface ShapeIntersection {
  point: gp_Pnt;
  support1: Shape;
  support2: Shape;
}

export function getIntersections(
  shape1: RootShape,
  shape2: RootShape,
  tolerance = 1e-6,
): ShapeIntersection[] {
  const oc = getOC();

  const progressRange = new oc.Message_ProgressRange_1();
  const distanceTool = new oc.BRepExtrema_DistShapeShape_1();
  distanceTool.LoadS1(shape1.shape);
  distanceTool.LoadS2(shape2.shape);
  distanceTool.Perform(progressRange);
  if (!distanceTool.IsDone()) {
    throw new Error('Distance calculation failed');
  }

  const distance = distanceTool.Value();
  if (distance > tolerance) {
    return [];
  }

  const numSolutions = distanceTool.NbSolution();
  const intersections: ShapeIntersection[] = [];
  for (let i = 0; i < numSolutions; i++) {
    const point = distanceTool.PointOnShape1(i + 1);
    const point2 = distanceTool.PointOnShape2(i + 1);
    if (!point.IsEqual(point2, tolerance)) {
      throw new Error('Points are not equal');
    }
    const ocSupport1 = distanceTool.SupportOnShape1(i + 1);
    const ocSupport2 = distanceTool.SupportOnShape2(i + 1);
    const support1 = shape1.map(ocSupport1);
    const support2 = shape2.map(ocSupport2);
    if (!support1 || !support2) {
      throw new Error('Support not found');
    }
    intersections.push({
      point,
      support1,
      support2,
    });
  }

  return intersections;
}

export function projectOnto(point: THREE.Vector3, shape: Shape) {
  const oc = getOC();
  const ocPoint = pointFromVector(point);
  const vertexMaker = new oc.BRepBuilderAPI_MakeVertex(ocPoint);
  const vertex = vertexMaker.Vertex();

  const progressRange = new oc.Message_ProgressRange_1();
  const distanceTool = new oc.BRepExtrema_DistShapeShape_1();
  distanceTool.LoadS1(shape.shape);
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
