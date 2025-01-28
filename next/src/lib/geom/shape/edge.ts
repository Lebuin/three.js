import { TopoDS_Edge } from '@lib/opencascade.js';
import { Shape } from './shape';
import { Vertex } from './vertex';

export class Edge extends Shape<TopoDS_Edge, Shape> {
  vertices: Vertex[] = [];

  constructor(edge: TopoDS_Edge, parent?: Shape) {
    super(edge, parent);
  }
}
