import { TopoDS_Vertex } from '@lib/opencascade.js';
import { Edge } from './edge';
import { Shape } from './shape';

export class Vertex extends Shape<TopoDS_Vertex, Edge> {
  constructor(vertex: TopoDS_Vertex, parent?: Edge) {
    super(vertex, parent);
  }
}
