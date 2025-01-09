import * as THREE from 'three';

export function forMaterial(
  material: THREE.Material | THREE.Material[],
  callback: (material: THREE.Material) => void,
) {
  if (Array.isArray(material)) {
    material.forEach(callback);
  } else {
    callback(material);
  }
}

export function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  forMaterial(material, (material) => {
    material.dispose();
  });
}
