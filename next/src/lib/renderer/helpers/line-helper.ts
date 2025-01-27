import { Color4 } from '@/lib/util/color4';
import { disposeMaterial } from '@/lib/util/three';
import { THREE } from '@lib/three.js';
import {
  Line2,
  LineGeometry,
  LineMaterial,
} from 'three/examples/jsm/Addons.js';
export class LineHelper extends THREE.Group {
  private material: LineMaterial;
  private line: Line2;

  constructor(lineWidth: number, color = new Color4()) {
    super();
    const geometry = new LineGeometry();
    geometry.setPositions([0, 0, 0, 0, 0, 1]);
    this.material = new LineMaterial({
      color: color,
      linewidth: lineWidth,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.line = new Line2(geometry, this.material);
    this.add(this.line);
  }

  dispose() {
    this.line.geometry.dispose();
    disposeMaterial(this.line.material);
  }

  public setPoints(start: THREE.Vector3, end: THREE.Vector3): void {
    this.position.copy(start);
    this.scale.setZ(start.distanceTo(end));
    this.lookAt(end);
  }

  public setColor(color: Color4) {
    this.material.color = color;
    this.material.opacity = color.a;
    this.material.needsUpdate = true;
  }
}
