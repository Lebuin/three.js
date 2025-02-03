import { TopoDS_Edge } from '@lib/opencascade.js';
import { Compound } from './compound';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';
import { Wire } from './wire';

export type EdgeParent = Face | Wire | Compound;

export class Edge<P extends EdgeParent = EdgeParent> extends Shape<
  TopoDS_Edge,
  P
> {
  vertices: Vertex[] = [];

  constructor(edge: TopoDS_Edge, parent?: P) {
    super(edge, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getEdgeGeometry(this);
  }

  getPoints() {
    return this.getRootGeometries().getEdgePoints(this);
  }
}
