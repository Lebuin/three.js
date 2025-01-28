import { TopoDS_Vertex } from '@lib/opencascade.js';
import { Collection } from './collection';
import { Edge } from './edge';
import { Shape } from './shape';

export class Vertex extends Shape<TopoDS_Vertex, Edge | Collection> {
  constructor(vertex: TopoDS_Vertex, parent?: Edge | Collection) {
    super(vertex, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getVertexGeometry(this);
  }

  getPoint() {
    return this.getRootGeometries().getVertexPoint(this);
  }
}
