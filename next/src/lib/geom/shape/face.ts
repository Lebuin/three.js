import { TopoDS_Face } from '@lib/opencascade.js';
import { Collection } from './collection';
import { Edge } from './edge';
import { Shape } from './shape';
import { Solid } from './solid';
import { Vertex } from './vertex';

export class Face extends Shape<TopoDS_Face, Solid | Collection> {
  edges: Edge[] = [];
  vertices: Vertex[] = [];

  constructor(face: TopoDS_Face, parent?: Solid | Collection) {
    super(face, parent);
  }
}
