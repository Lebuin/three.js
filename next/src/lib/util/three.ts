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

interface DisposeOptions {
  material: boolean;
  geometry: boolean;
}
const defaultDisposeOptions: DisposeOptions = {
  material: true,
  geometry: true,
};

export function disposeObject(
  object: THREE.Object3D,
  options: Partial<DisposeOptions> = {},
) {
  const disposeOptions = {
    ...defaultDisposeOptions,
    ...options,
  };

  object.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      if (disposeOptions.geometry) {
        (child.geometry as THREE.BufferGeometry).dispose();
      }
      if (disposeOptions.material) {
        disposeMaterial(child.material as THREE.Material | THREE.Material[]);
      }
    } else if (child instanceof THREE.Group) {
      // Do nothing
    } else {
      throw new Error(
        `Not implemented: disposeObject(object: ${child.constructor.name})`,
      );
    }
  });
}
