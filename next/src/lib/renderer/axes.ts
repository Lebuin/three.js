import * as THREE from 'three';

export class Axes extends THREE.LineSegments {
  override readonly type = 'Axes';

  constructor(size = 1) {
    // prettier-ignore
    const vertices = [
      0, 0, 0, size, 0, 0,
      0, 0, 0, 0, size, 0,
      0, 0, 0, 0, 0, size,
      0, 0, 0, -size, 0, 0,
      0, 0, 0, 0, -size, 0,
      0, 0, 0, 0, 0, -size,
    ];

    // prettier-ignore
    const colors = [
      1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0,
      0, 0, 1, 0, 0, 1,
      1, 0.6, 0.6, 1, 0.6, 0.6,
      0.6, 1, 0.6, 0.6, 1, 0.6,
      0.6, 0.6, 1, 0.6, 0.6, 1,
    ];

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
    });

    super(geometry, material);

    this.computeLineDistances();
  }

  dispose() {
    this.geometry.dispose();
    if (Array.isArray(this.material)) {
      this.material.forEach((m) => m.dispose());
    } else {
      this.material.dispose();
    }
  }
}
