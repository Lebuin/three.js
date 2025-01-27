import { TopoDS_Shape } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { exploreVertices } from './explore';
import { getOC } from './oc';
import { pointFromVector, pointToVector } from './util';

export function projectOnto(point: THREE.Vector3, shape: TopoDS_Shape) {
  const oc = getOC();

  const vertices = exploreVertices(shape);
  for (const vertex of vertices) {
    const point = pointToVector(oc.BRep_Tool.Pnt(vertex));
    console.log(point);
  }

  const ocPoint = pointFromVector(point);
  const vertexMaker = new oc.BRepBuilderAPI_MakeVertex(ocPoint);
  const vertex = vertexMaker.Vertex();

  const progressRange = new oc.Message_ProgressRange_1();
  const distance = new oc.BRepExtrema_DistShapeShape_1();
  distance.LoadS1(shape);
  distance.LoadS2(vertex);
  distance.Perform(progressRange);
  if (!distance.IsDone()) {
    throw new Error('Distance calculation failed');
  }

  const numSolutions = distance.NbSolution();
  if (numSolutions === 0) {
    throw new Error('No solution found');
  } else if (numSolutions > 1) {
    throw new Error('More than one solution found');
  }

  const ocPointOnShape = distance.PointOnShape1(1);
  const pointOnShape = pointToVector(ocPointOnShape);
  return pointOnShape;
}
