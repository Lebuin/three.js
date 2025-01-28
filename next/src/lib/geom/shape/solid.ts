import {
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Solid,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { Edge } from './edge';
import { Face } from './face';
import { RootShape } from './root-shape';
import { Shape } from './shape';
import { Vertex } from './vertex';

export class Solid extends RootShape<TopoDS_Solid> {
  faces: Face[] = [];
  faceMap = new Map<TopoDS_Face, Face>();
  edges: Edge[] = [];
  edgeMap = new Map<TopoDS_Edge, Edge>();
  vertices: Vertex[] = [];
  vertexMap = new Map<TopoDS_Vertex, Vertex>();

  constructor(solid: TopoDS_Solid) {
    super(solid);
    this.explore();
  }

  override map(ocShape: TopoDS_Shape): Shape | undefined {
    if (ocShape instanceof TopoDS_Face) {
      return this.faceMap.get(ocShape);
    } else {
      return super.map(ocShape);
    }
  }

  private explore() {
    const ocFaces = exploreFaces(this.shape);
    for (const ocFace of ocFaces) {
      const face = this.addFace(ocFace, this);

      const ocEdges = exploreEdges(ocFace);
      for (const ocEdge of ocEdges) {
        const edge = this.addEdge(ocEdge, face);
        face.edges.push(edge);

        const ocVertices = exploreVertices(ocEdge);
        for (const ocVertex of ocVertices) {
          const vertex = this.addVertex(ocVertex, edge);
          edge.vertices.push(vertex);
          face.vertices.push(vertex);
        }
      }
    }
  }

  private addFace(ocFace: TopoDS_Face, parent: Solid): Face {
    let face = this.faceMap.get(ocFace);
    if (face) {
      return face;
    }

    face = new Face(ocFace, parent);
    this.faces.push(face);
    this.faceMap.set(ocFace, face);
    return face;
  }
}
