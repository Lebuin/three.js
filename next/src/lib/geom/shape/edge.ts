import { TopoDS_Edge } from '@lib/opencascade.js';
import { Face } from './face';
import { Shape } from './shape';
import { Vertex } from './vertex';
import { Wire } from './wire';

export class Edge extends Shape<TopoDS_Edge, Face | Wire> {
  vertices: Vertex[] = [];

  constructor(edge: TopoDS_Edge, parent?: Face | Wire) {
    super(edge, parent);
  }
}
