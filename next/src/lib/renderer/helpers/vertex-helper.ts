import { Vertex } from '@/lib/geom/shape';
import { PointHelper } from './point-helper';

export class VertexHelper extends PointHelper {
  setVertex(vertex: Vertex) {
    this.setPoint(vertex.getPoint());
  }
}
