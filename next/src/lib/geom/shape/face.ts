import { TopoDS_Face } from '@lib/opencascade.js';
import { Compound } from './compound';
import { Edge } from './edge';
import { Shape } from './shape';
import { Shell } from './shell';
import { Solid } from './solid';
import { Vertex } from './vertex';

export type FaceParent = Shell | Solid | Compound;

export class Face<P extends FaceParent = FaceParent> extends Shape<
  TopoDS_Face,
  P
> {
  edges: Edge[] = [];
  vertices: Vertex[] = [];

  constructor(face: TopoDS_Face, parent?: P) {
    super(face, parent);
  }

  getGeometry() {
    return this.getRootGeometries().getFaceGeometry(this);
  }
}
