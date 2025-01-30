import { TopoDS_Edge } from '@lib/opencascade.js';
import { Face } from './face';
import { RootShape } from './root-shape';
import { Shape } from './shape';
import { Vertex } from './vertex';

export class Edge extends Shape<TopoDS_Edge, RootShape | Face> {
  vertices: Vertex[] = [];

  constructor(edge: TopoDS_Edge, parent?: RootShape | Face) {
    super(edge, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getEdgeGeometry(this);
  }

  getPoints() {
    return this.getRootGeometries().getEdgePoints(this);
  }
}
