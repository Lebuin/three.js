import {
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Solid,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { Edge } from './edge';
import { Face } from './face';
import { RootShape } from './root-shape';
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
    const existingFace = this.getSubShape(ocFace);
    if (existingFace) {
      return existingFace as Face;
    }

    const face = new Face(ocFace, parent);
    this.faces.push(face);
    this.faceMap.set(ocFace, face);
    return face;
  }
}
