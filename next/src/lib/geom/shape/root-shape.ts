import {
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { exploreEdges, exploreFaces, exploreVertices } from '../explore';
import { OCGeometries, OCGeometriesBuilder } from '../geometries';
import { getShapeId } from '../util';
import { Edge } from './edge';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';

export abstract class RootShape<
  T extends TopoDS_Shape = TopoDS_Shape,
> extends Shape<T, void> {
  faces: Face[] = [];
  edges: Edge[] = [];
  vertices: Vertex[] = [];
  shapeMap = new Map<number, Shape>();

  isRoot = true;
  _geometries?: OCGeometries;

  constructor(shape: T) {
    super(shape);
    this.explore();
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
  getFace(ocFace: TopoDS_Face): Face | null {
    return this.getSubShape(ocFace) as Face | null;
  }
  getEdge(ocEdge: TopoDS_Edge): Edge | null {
    return this.getSubShape(ocEdge) as Edge | null;
  }
  getVertex(ocVertex: TopoDS_Vertex): Vertex | null {
    return this.getSubShape(ocVertex) as Vertex | null;
  }

  protected explore() {
    const ocFaces = exploreFaces(this.shape);
    if (ocFaces.length > 0) {
      for (const ocFace of ocFaces) {
        const face = this.addFace(ocFace, this);
        this.exploreEdges(face);
      }
    } else {
      this.exploreEdges(this);
    }
  }

  protected exploreEdges(parent: RootShape | Face) {
    const ocEdges = exploreEdges(parent.shape);
    for (const ocEdge of ocEdges) {
      const edge = this.addEdge(ocEdge, parent);
      if (parent instanceof Face) {
        parent.edges.push(edge);
      }

      const ocVertices = exploreVertices(ocEdge);
      for (const ocVertex of ocVertices) {
        const vertex = this.addVertex(ocVertex, edge);
        edge.vertices.push(vertex);
        if (parent instanceof Face) {
          parent.vertices.push(vertex);
        }
      }
    }
  }

  protected addFace(ocFace: TopoDS_Face, parent: RootShape): Face {
    const existingFace = this.getFace(ocFace);
    if (existingFace) {
      return existingFace;
    }

    const face = new Face(ocFace, parent);
    this.faces.push(face);
    this.addShapeToMap(ocFace, face);
    return face;
  }

  protected addEdge(ocEdge: TopoDS_Edge, parent: RootShape | Face): Edge {
    const existingEdge = this.getEdge(ocEdge);
    if (existingEdge) {
      return existingEdge;
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
    const existingVertex = this.getVertex(ocVertex);
    if (existingVertex) {
      return existingVertex;
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
