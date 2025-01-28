import { TopoDS_Solid } from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { RootShape } from './root-shape';

export class Solid extends RootShape<TopoDS_Solid> {
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
}
