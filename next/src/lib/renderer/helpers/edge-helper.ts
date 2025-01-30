import { Edge } from '@/lib/geom/shape';
import { LineHelper } from './line-helper';

export class EdgeHelper extends LineHelper {
  public setEdge(edge: Edge) {
    this.setPoints(edge.getPoints());
  }
}
