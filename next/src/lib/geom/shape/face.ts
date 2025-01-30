import { TopoDS_Face } from '@lib/opencascade.js';
import { Edge } from './edge';
import { RootShape } from './root-shape';
import { Shape } from './shape';
import { Vertex } from './vertex';

export class Face extends Shape<TopoDS_Face, RootShape> {
  edges: Edge[] = [];
  vertices: Vertex[] = [];

  constructor(face: TopoDS_Face, parent?: RootShape) {
    super(face, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getFaceGeometry(this);
  }
}
