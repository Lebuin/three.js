import { TopoDS_Face } from '@lib/opencascade.js';
import { Edge } from './edge';
import { Shape } from './shape';
import { Vertex } from './vertex';

export class Face extends Shape<TopoDS_Face, Shape> {
  edges: Edge[] = [];
  vertices: Vertex[] = [];

  constructor(face: TopoDS_Face, parent?: Shape) {
    super(face, parent);
  }
}
