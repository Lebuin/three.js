import { TopoDS_Edge, TopoDS_Vertex, TopoDS_Wire } from '@lib/opencascade.js';
import { exploreEdges, exploreVertices } from '../explore';
import { Edge } from './edge';
import { RootShape } from './root-shape';
import { Vertex } from './vertex';

export class Wire extends RootShape<TopoDS_Wire> {
  edges: Edge[] = [];
  edgeMap = new Map<TopoDS_Edge, Edge>();
  vertices: Vertex[] = [];
  vertexMap = new Map<TopoDS_Vertex, Vertex>();

  constructor(solid: TopoDS_Wire) {
    super(solid);
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
