import { TopoDS_Edge, TopoDS_Shape, TopoDS_Vertex } from '@lib/opencascade.js';
import { OCGeometries, OCGeometriesBuilder } from '../geometries';
import { Edge } from './edge';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';
import { Wire } from './wire';

export abstract class RootShape<
  T extends TopoDS_Shape = TopoDS_Shape,
> extends Shape<T, void> {
  edges: Edge[] = [];
  edgeMap = new Map<TopoDS_Edge, Edge>();
  vertices: Vertex[] = [];
  vertexMap = new Map<TopoDS_Vertex, Vertex>();

  _geometries?: OCGeometries;

  constructor(shape: T) {
    super(shape);
  }

  dispose() {
    if (this._geometries) {
      this._geometries.dispose();
      this._geometries = undefined;
    }
  }

  map(ocShape: TopoDS_Shape): Shape | undefined {
    if (ocShape instanceof TopoDS_Edge) {
      return this.edgeMap.get(ocShape);
    } else if (ocShape instanceof TopoDS_Vertex) {
      return this.vertexMap.get(ocShape);
    } else {
      throw new Error(`Invalid shape type: ${ocShape.constructor.name}`);
    }
  }

  get geometries() {
    if (!this._geometries) {
      const builder = new OCGeometriesBuilder();
      this._geometries = builder.build(this);
    }
    return this._geometries;
  }

  protected addEdge(ocEdge: TopoDS_Edge, parent: Face | Wire) {
    let edge = this.edgeMap.get(ocEdge);
    if (edge) {
      return edge;
    }

    edge = this.edges.find((edge) => {
      return edge.shape.IsSame(ocEdge);
    });
    if (!edge) {
      edge = new Edge(ocEdge, parent);
      this.edges.push(edge);
    }
    this.edgeMap.set(ocEdge, edge);
    return edge;
  }

  protected addVertex(ocVertex: TopoDS_Vertex, parent: Edge) {
    let vertex = this.vertexMap.get(ocVertex);
    if (vertex) {
      return vertex;
    }

    vertex = this.vertices.find((vertex) => {
      return vertex.shape.IsEqual(ocVertex);
    });
    if (!vertex) {
      vertex = new Vertex(ocVertex, parent);
      this.vertices.push(vertex);
    }
    this.vertexMap.set(ocVertex, vertex);
    return vertex;
  }
}
