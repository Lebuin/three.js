import {
  getOC,
  TopAbs_ShapeEnum,
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Vertex,
} from '@lib/opencascade.js';

export type ShapeType =
  | { name: 'face'; type: TopoDS_Face }
  | { name: 'edge'; type: TopoDS_Edge }
  | { name: 'vertex'; type: TopoDS_Vertex };

export function explore<T extends ShapeType>(
  shape: TopoDS_Shape,
  toFind: T['name'],
): T['type'][] {
  const oc = getOC();
  let createCallback: (shape: TopoDS_Shape) => T['type'],
    toFindEnum: TopAbs_ShapeEnum;
  switch (toFind) {
    case 'face':
      createCallback = (shape: TopoDS_Shape) => oc.TopoDS.Face_1(shape);
      toFindEnum = oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum;
      break;
    case 'edge':
      createCallback = (shape: TopoDS_Shape) => oc.TopoDS.Edge_1(shape);
      toFindEnum = oc.TopAbs_ShapeEnum.TopAbs_EDGE as TopAbs_ShapeEnum;
      break;
    case 'vertex':
      createCallback = (shape: TopoDS_Shape) => oc.TopoDS.Vertex_1(shape);
      toFindEnum = oc.TopAbs_ShapeEnum.TopAbs_VERTEX as TopAbs_ShapeEnum;
      break;
    default:
      throw new Error(`Unknown shape type: ${toFind}`);
  }

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    toFindEnum,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum,
  );
  const shapes: T['type'][] = [];
  while (explorer.More()) {
    const current = explorer.Current();
    const shape = createCallback(current);
    shapes.push(shape);
    explorer.Next();
  }
  return shapes;
}

export function exploreFaces(shape: TopoDS_Shape): TopoDS_Face[] {
  return explore(shape, 'face');
}

export function exploreEdges(shape: TopoDS_Shape): TopoDS_Edge[] {
  return explore(shape, 'edge');
}

export function exploreVertices(shape: TopoDS_Shape): TopoDS_Vertex[] {
  return explore(shape, 'vertex');
}
