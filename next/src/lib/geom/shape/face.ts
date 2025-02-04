import { getIndexedAttribute3 } from '@/lib/util/three';
import { TopoDS_Face } from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
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

  /**
   * Get the normal of this face. Currently only works for planar faces.
   */
  getNormal() {
    const geometry = this.getGeometry();
    const points = [
      getIndexedAttribute3(geometry, 'position', geometry.drawRange.start + 0),
      getIndexedAttribute3(geometry, 'position', geometry.drawRange.start + 1),
      getIndexedAttribute3(geometry, 'position', geometry.drawRange.start + 2),
    ];
    const plane = new THREE.Plane().setFromCoplanarPoints(
      points[0],
      points[1],
      points[2],
    );
    return plane.normal;
  }
}
