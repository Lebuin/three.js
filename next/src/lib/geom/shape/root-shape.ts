import {
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { OCGeometries, OCGeometriesBuilder } from '../geometries';
import { getShapeId } from '../util';
import { Edge } from './edge';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';

export abstract class RootShape<
  T extends TopoDS_Shape = TopoDS_Shape,
  V extends Vertex = Vertex,
> extends Shape<T, void> {
  protected _vertices?: V[];
  protected _shapeMap?: Map<number, Shape>;

  isRoot = true;
  _geometries?: OCGeometries;

  get vertices() {
    if (!this._vertices) {
      this.explore();
    }
    return this._vertices!;
  }
  get shapeMap() {
    if (!this._shapeMap) {
      this.explore();
    }
    return this._shapeMap!;
  }

  get geometries() {
    if (!this._geometries) {
      const builder = new OCGeometriesBuilder();
      this._geometries = builder.build(this);
    }
    return this._geometries;
  }

  protected explore() {
    this._vertices = [];
    this._shapeMap = new Map();
    this.exploreShapes();
  }

  protected abstract exploreShapes(): void;

  protected addShapeToMap(ocShape: TopoDS_Shape, shape: Shape) {
    const id = getShapeId(ocShape);
    if (id == null) {
      throw new Error('Shape is null');
    }
    this.shapeMap.set(id, shape);
  }

  getSubShape(ocShape: TopoDS_Shape): Shape | null {
    const id = getShapeId(ocShape);
    if (id == null) {
      return null;
    }
    return this.shapeMap.get(id) ?? null;
  }
  getVertex(ocVertex: TopoDS_Vertex): V | null {
    return this.getSubShape(ocVertex) as V | null;
  }

  protected addVertex(
    ocVertex: TopoDS_Vertex,
    parent: NonNullable<V['parent']>,
  ): V {
    const existingVertex = this.getVertex(ocVertex);
    if (existingVertex) {
      return existingVertex;
    }

    let vertex = this.vertices.find((vertex) => {
      return vertex.shape.IsEqual(ocVertex);
    });
    if (!vertex) {
      vertex = new Vertex(ocVertex, parent) as V;
      this.vertices.push(vertex);
    }
    this.addShapeToMap(ocVertex, vertex);
    return vertex;
  }
}

export abstract class RootShapeWithEdges<
  T extends TopoDS_Shape = TopoDS_Shape,
  E extends Edge = Edge,
  V extends Vertex = Vertex,
> extends RootShape<T, V> {
  _edges?: E[];

  get edges() {
    if (!this._edges) {
      this.explore();
    }
    return this._edges!;
  }
  getEdge(ocEdge: TopoDS_Edge): E | null {
    return this.getSubShape(ocEdge) as E | null;
  }
  getEdgeIndex(edge: Edge): number {
    return this.edges.indexOf(edge as E);
  }

  protected explore(): void {
    this._edges = [];
    super.explore();
  }

  protected addEdge(ocEdge: TopoDS_Edge, parent: NonNullable<E['parent']>): E {
    const existingEdge = this.getEdge(ocEdge);
    if (existingEdge) {
      return existingEdge;
    }

    let edge = this.edges.find((edge) => {
      return edge.shape.IsSame(ocEdge);
    });
    if (!edge) {
      edge = new Edge(ocEdge, parent) as E;
      this.edges.push(edge);
    }
    this.addShapeToMap(ocEdge, edge);
    return edge;
  }
}

export abstract class RootShapeWithFaces<
  T extends TopoDS_Shape = TopoDS_Shape,
  F extends Face = Face,
  E extends Edge = Edge,
  V extends Vertex = Vertex,
> extends RootShapeWithEdges<T, E, V> {
  _faces?: F[];

  get faces() {
    if (!this._faces) {
      this.explore();
    }
    return this._faces!;
  }
  getFace(ocFace: TopoDS_Face): F | null {
    return this.getSubShape(ocFace) as F | null;
  }
  getFaceIndex(face: Face): number {
    return this.faces.indexOf(face as F);
  }

  protected explore() {
    this._faces = [];
    super.explore();
  }

  protected addFace(ocFace: TopoDS_Face, parent: NonNullable<F['parent']>): F {
    const existingFace = this.getFace(ocFace);
    if (existingFace) {
      return existingFace;
    }

    const face = new Face(ocFace, parent) as F;
    this.faces.push(face);
    this.addShapeToMap(ocFace, face);
    return face;
  }
}
