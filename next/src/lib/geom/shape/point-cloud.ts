import { getOC, TopoDS_Shape, TopoDS_Vertex } from '@lib/opencascade.js';
import { RootShape } from './root-shape';
import { Vertex } from './vertex';

/**
 * A collection of vertices. This is a shape type that does not exist in OpenCascade, hence
 * `PointCloud.shape` is a dummy TopoDS_Shape.
 */
export class PointCloud extends RootShape<TopoDS_Shape, Vertex<PointCloud>> {
  private ocVertices: TopoDS_Vertex[] = [];

  constructor(ocVertices: TopoDS_Vertex[]) {
    const oc = getOC();
    const shape = new oc.TopoDS_Shape();
    super(shape);
    this.ocVertices = ocVertices;
  }

  protected exploreShapes(): void {
    for (const ocVertex of this.ocVertices) {
      const vertex = this.addVertex(ocVertex, this);
      vertex.parent = this;
    }
  }
}
