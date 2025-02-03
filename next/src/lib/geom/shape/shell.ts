import { TopoDS_Solid } from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { Edge } from './edge';
import { Face } from './face';
import { RootShapeWithFaces } from './root-shape';
import { Vertex } from './vertex';

export class Shell extends RootShapeWithFaces<
  TopoDS_Solid,
  Face<Shell>,
  Edge<Face<Shell>>,
  Vertex<Edge<Face<Shell>>>
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
  }
}
