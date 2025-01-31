import { Color4 } from '@/lib/util/color4';
import { disposeObject } from '@/lib/util/three';
import { THREE } from '@lib/three.js';

export class LineHelper extends THREE.Group {
  private material: THREE.LineMaterial;
  private lineSegments: THREE.LineSegments2;

  constructor() {
    super();
    const geometry = new THREE.LineGeometry();
    this.material = new THREE.LineMaterial({
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.lineSegments = new THREE.LineSegments2(geometry, this.material);
    this.add(this.lineSegments);
  }

  dispose() {
    disposeObject(this.lineSegments);
  }

  public setPoints(points: THREE.Vector3[]): void {
    const numSegments = points.length - 1;
    const positions = new Float32Array(numSegments * 2 * 3);
    for (let i = 0; i < numSegments; i++) {
      const start = points[i];
      const end = points[i + 1];
      positions[i * 2 * 3 + 0] = start.x;
      positions[i * 2 * 3 + 1] = start.y;
      positions[i * 2 * 3 + 2] = start.z;
      positions[i * 2 * 3 + 3] = end.x;
      positions[i * 2 * 3 + 4] = end.y;
      positions[i * 2 * 3 + 5] = end.z;
    }
    this.lineSegments.geometry.setPositions(positions);
  }

  public setColor(color: Color4) {
    this.material.color = color;
    this.material.opacity = color.a;
    this.material.needsUpdate = true;
  }

  public setLineWidth(lineWidth: number) {
    this.material.linewidth = lineWidth;
    this.material.needsUpdate = true;
  }
}
