import { Edge } from '@/lib/geom/shape';
import { THREE } from '@lib/three.js';
import { LineHelper } from './line-helper';

export class EdgeHelper extends LineHelper {
  protected getMaterial() {
    return new THREE.LineMaterial({
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  public setEdge(edge: Edge) {
    this.setPoints(edge.getPoints());
  }
}
