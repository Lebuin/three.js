import { TopoDS_Vertex } from '@lib/opencascade.js';
import { Compound } from './compound';
import { Edge } from './edge';
import { PointCloud } from './point-cloud';
import { Shape } from './shape';

export type VertexParent = Edge | PointCloud | Compound;

export class Vertex<P extends VertexParent = VertexParent> extends Shape<
  TopoDS_Vertex,
  P
> {
  constructor(vertex: TopoDS_Vertex, parent?: P) {
    super(vertex, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getVertexGeometry(this);
  }

  getPoint() {
    return this.getRootGeometries().getVertexPoint(this);
  }
}
