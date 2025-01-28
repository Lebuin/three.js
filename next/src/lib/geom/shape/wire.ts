import { TopoDS_Wire } from '@lib/opencascade.js';
import { exploreEdges, exploreVertices } from '../explore';
import { RootShape } from './root-shape';

export class Wire extends RootShape<TopoDS_Wire> {
  constructor(wire: TopoDS_Wire) {
    super(wire);
    this.explore();
  }

  private explore() {
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
