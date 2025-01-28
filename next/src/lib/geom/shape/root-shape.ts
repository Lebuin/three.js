import { TopoDS_Edge, TopoDS_Shape, TopoDS_Vertex } from '@lib/opencascade.js';
import { OCGeometries, OCGeometriesBuilder } from '../geometries';
import { getShapeId } from '../util';
import { Edge } from './edge';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';
import { Wire } from './wire';

export abstract class RootShape<
  T extends TopoDS_Shape = TopoDS_Shape,
> extends Shape<T, void> {
  edges: Edge[] = [];
  vertices: Vertex[] = [];
  shapeMap = new Map<number, Shape>();

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

  get geometries() {
    if (!this._geometries) {
      const builder = new OCGeometriesBuilder();
      this._geometries = builder.build(this);
    }
    return this._geometries;
  }

  protected addShapeToMap(ocShape: TopoDS_Shape, shape: Shape) {
    const id = getShapeId(ocShape);
    this.shapeMap.set(id, shape);
  }

  getSubShape(ocShape: TopoDS_Shape): Shape | undefined {
    const id = getShapeId(ocShape);
    return this.shapeMap.get(id);
  }

  protected addEdge(ocEdge: TopoDS_Edge, parent: Face | Wire): Edge {
    const existingEdge = this.getSubShape(ocEdge);
    if (existingEdge) {
      return existingEdge as Edge;
    }

    let edge = this.edges.find((edge) => {
      return edge.shape.IsSame(ocEdge);
    });
    if (!edge) {
      edge = new Edge(ocEdge, parent);
      this.edges.push(edge);
    }
    this.addShapeToMap(ocEdge, edge);
    return edge;
  }

  protected addVertex(ocVertex: TopoDS_Vertex, parent: Edge) {
    const existingVertex = this.getSubShape(ocVertex);
    if (existingVertex) {
      return existingVertex as Vertex;
    }

    let vertex = this.vertices.find((vertex) => {
      return vertex.shape.IsEqual(ocVertex);
    });
    if (!vertex) {
      vertex = new Vertex(ocVertex, parent);
      this.vertices.push(vertex);
    }
    this.addShapeToMap(ocVertex, vertex);
    return vertex;
  }
}
