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

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      (child.geometry as THREE.BufferGeometry).dispose();
      disposeMaterial(child.material as THREE.Material | THREE.Material[]);
    } else {
      throw new Error(
        `Not implemented: disposeObject(object: ${child.constructor.name})`,
      );
    }
  });
}
