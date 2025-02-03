import { TopoDS_Compound } from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { Edge } from './edge';
import { Face } from './face';
import { RootShapeWithFaces } from './root-shape';
import { Vertex } from './vertex';

export class Compound extends RootShapeWithFaces<
  TopoDS_Compound,
  Face<Compound>,
  Edge<Face<Compound> | Compound>,
  Vertex<Edge<Face<Compound> | Compound> | Compound>
> {
  protected exploreShapes() {
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

    const ocEdges = exploreEdges(this.shape);
    for (const ocEdge of ocEdges) {
      const existingEdge = this.getEdge(ocEdge);
      if (existingEdge) {
        continue;
      }
      const edge = this.addEdge(ocEdge, this);

      const ocVertices = exploreVertices(ocEdge);
      for (const ocVertex of ocVertices) {
        const vertex = this.addVertex(ocVertex, edge);
        edge.vertices.push(vertex);
      }
    }

    const ocVertices = exploreVertices(this.shape);
    for (const ocVertex of ocVertices) {
      const existingVertex = this.getVertex(ocVertex);
      if (existingVertex) {
        continue;
      }
      this.addVertex(ocVertex, this);
    }
  }
}
