import { TopoDS_Wire } from '@lib/opencascade.js';
import { exploreEdges, exploreVertices } from '../explore';
import { Edge } from './edge';
import { RootShapeWithEdges } from './root-shape';
import { Vertex } from './vertex';

export class Wire extends RootShapeWithEdges<
  TopoDS_Wire,
  Edge<Wire>,
  Vertex<Edge<Wire>>
> {
  protected exploreShapes() {
    const ocEdges = exploreEdges(this.shape);
    for (const ocEdge of ocEdges) {
      const edge = this.addEdge(ocEdge, this);

      const ocVertices = exploreVertices(ocEdge);
      for (const ocVertex of ocVertices) {
        const vertex = this.addVertex(ocVertex, edge);
        edge.vertices.push(vertex);
      }
    }
  }
}
