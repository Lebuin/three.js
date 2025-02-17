import { getOC, TopoDS_Vertex } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import {
  Edge,
  Face,
  RootShape,
  RootShapeWithEdges,
  RootShapeWithFaces,
  Shape,
  shapeFactory,
  Vertex,
} from './shape';
import { PointCloud } from './shape/point-cloud';
import { pointFromVector, pointToVector, vertexFromPoint } from './util';

export type EdgeSupport = Face;
export type VertexSupport = Face | Edge | Vertex;
export interface ShapeIntersection {
  shape: RootShape;
  edgeSupportMap1?: EdgeSupport[];
  edgeSupportMap2?: EdgeSupport[];
  vertexSupportMap1?: VertexSupport[];
  vertexSupportMap2?: VertexSupport[];
}

export function getIntersections(
  shape1: RootShapeWithEdges,
  shape2: RootShapeWithEdges,
): ShapeIntersection {
  if (
    shape1 instanceof RootShapeWithFaces &&
    shape2 instanceof RootShapeWithFaces
  ) {
    return makeIntersectionWithSolid(
      shape1 as RootShapeWithFaces,
      shape2 as RootShapeWithFaces,
    );
  } else if (shape1 instanceof RootShapeWithFaces) {
    const intersection = makeIntersectionWithWire(shape2, shape1);
    return {
      shape: intersection.shape,
      vertexSupportMap1: intersection.vertexSupportMap2,
      vertexSupportMap2: intersection.vertexSupportMap1,
    };
  } else {
    return makeIntersectionWithWire(shape1, shape2);
  }
}

/**
 * Get a list of edges where 2 shapes intersect. Both shapes must be solids or shells.
 */
export function makeIntersectionWithSolid(
  shape1: RootShapeWithFaces,
  shape2: RootShapeWithFaces,
): ShapeIntersection {
  const oc = getOC();
  const section = new oc.BRepAlgoAPI_Section_3(
    shape1.shape,
    shape2.shape,
    true,
  );
  if (!section.IsDone()) {
    throw new Error('Intersection failed');
  }
  const ocShape = section.Shape();
  const shape = shapeFactory(ocShape);

  const edgeSupportMap1: EdgeSupport[] = [];
  const edgeSupportMap2: EdgeSupport[] = [];
  const vertexSupportMap1: VertexSupport[] = [];
  const vertexSupportMap2: VertexSupport[] = [];
  const ocFace = new oc.TopoDS_Face();

  for (const edge of shape.edges) {
    const hasFace1 = section.HasAncestorFaceOn1(edge.shape, ocFace);
    if (hasFace1) {
      const face1 = shape1.getFace(ocFace);
      if (!face1) {
        throw new Error('Face not found on shape 1');
      }
      edgeSupportMap1.push(face1);
    }

    const hasFace2 = section.HasAncestorFaceOn2(edge.shape, ocFace);
    if (hasFace2) {
      const face2 = shape2.getFace(ocFace);
      if (!face2) {
        throw new Error('Face not found on shape 2');
      }
      edgeSupportMap2.push(face2);
    }
  }

  for (const vertex of shape.vertices) {
    const edge = vertex.parent;
    if (edge == null) {
      throw new Error('Vertex has no parent edge');
    } else if (!(edge instanceof Edge)) {
      throw new Error('Parent is not an edge');
    }
    const index1 = shape1.getEdgeIndex(edge);
    const index2 = shape2.getEdgeIndex(edge);

    const support1 = edgeSupportMap1[index1];
    const support2 = edgeSupportMap2[index2];

    vertexSupportMap1.push(support1);
    vertexSupportMap2.push(support2);
  }

  return {
    shape,
    edgeSupportMap1,
    edgeSupportMap2,
    vertexSupportMap1,
    vertexSupportMap2,
  };
}

/**
 * Get the points where 2 shapes intersect. The first shape must be a wire, while the other may be
 * wire, shell or solid.
 */
export function makeIntersectionWithWire(
  shape1: RootShapeWithEdges,
  shape2: RootShapeWithEdges,
  tolerance = 1e-6,
): ShapeIntersection {
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
  if (distance >= tolerance) {
    const shape = new PointCloud([]);
    return { shape, vertexSupportMap1: [], vertexSupportMap2: [] };
  }

  const numSolutions = distanceTool.NbSolution();
  const vertices: TopoDS_Vertex[] = [];
  const vertexSupportMap1: VertexSupport[] = [];
  const vertexSupportMap2: VertexSupport[] = [];

  for (let i = 0; i < numSolutions; i++) {
    const ocPoint1 = distanceTool.PointOnShape1(i + 1);
    const ocPoint2 = distanceTool.PointOnShape2(i + 1);
    if (!ocPoint1.IsEqual(ocPoint2, tolerance)) {
      throw new Error('Points are not equal');
    }
    const vertex = vertexFromPoint(ocPoint2);
    vertices[i] = vertex;

    const ocSupport1 = distanceTool.SupportOnShape1(i + 1);
    const ocSupport2 = distanceTool.SupportOnShape2(i + 1);
    const support1 = shape1.getSubShape(ocSupport1);
    const support2 = shape2.getSubShape(ocSupport2);

    if (!support1) {
      throw new Error('Support 1 not found');
    } else if (
      !(
        support1 instanceof Face ||
        support1 instanceof Edge ||
        support1 instanceof Vertex
      )
    ) {
      throw new Error('Support 1 is not a face or edge');
    }
    if (!support2) {
      throw new Error('Support 2 not found');
    } else if (
      !(
        support2 instanceof Face ||
        support2 instanceof Edge ||
        support2 instanceof Vertex
      )
    ) {
      throw new Error('Support 2 is not a face or edge');
    }

    vertexSupportMap1[i] = support1;
    vertexSupportMap2[i] = support2;
  }

  const shape = new PointCloud(vertices);

  return { shape, vertexSupportMap1, vertexSupportMap2 };
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
