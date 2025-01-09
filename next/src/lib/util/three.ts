import * as THREE from 'three';

export function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    material.forEach((material) => material.dispose());
  } else {
    material.dispose();
  }
}
