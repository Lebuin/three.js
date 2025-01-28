import { TopoDS_Vertex } from '@lib/opencascade.js';
import { Shape } from './shape';

export class Vertex extends Shape<TopoDS_Vertex, Shape> {
  constructor(vertex: TopoDS_Vertex, parent?: Shape) {
    super(vertex, parent);
  }
}
