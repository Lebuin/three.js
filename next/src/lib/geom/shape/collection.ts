import { TopoDS_Shape } from '@lib/opencascade.js';
import { OCGeometries } from '../geometries';
import { getOC } from '../oc';
import { RootShape } from './root-shape';

export class Collection extends RootShape<TopoDS_Shape> {
  constructor(geometries: OCGeometries) {
    const oc = getOC();
    const shape = new oc.TopoDS_Shape();
    super(shape);
    this._geometries = geometries;
    this.addShapesFromGeometries(geometries);
  }

  private addShapesFromGeometries(geometries: OCGeometries) {
    for (const face of geometries.faceMap) {
      this.addShapeToMap(face.shape, face);
      face.parent = this;
    }
    for (const edge of geometries.edgeMap) {
      this.addShapeToMap(edge.shape, edge);
      edge.parent = this;
    }
    for (const vertex of geometries.vertexMap) {
      this.addShapeToMap(vertex.shape, vertex);
      vertex.parent = this;
    }
  }
}
