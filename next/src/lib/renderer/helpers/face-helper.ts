import { Face } from '@/lib/geom/shape';
import { Color4 } from '@/lib/util/color4';
import { THREE } from '@lib/three.js';

export class FaceHelper extends THREE.Group {
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;

  constructor() {
    super();
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.mesh = new THREE.Mesh(undefined, this.material);
    this.add(this.mesh);
  }

  dispose() {
    this.material.dispose();
  }

  setFace(face: Face) {
    this.mesh.geometry = face.getGeometry();
  }

  setColor(color: Color4) {
    this.material.color.set(color);
    this.material.opacity = color.a;
    this.material.needsUpdate = true;
  }
}
