import { THREE } from '@lib/three.js';
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

export function getIndexedAttribute(
  geometry: THREE.BufferGeometry,
  attribute: string,
  index: number,
  stride: number,
): THREE.Vector2 | THREE.Vector3 | THREE.Quaternion {
  const geomIndex = geometry.getIndex();
  const attrIndex = geomIndex ? geomIndex.array[index] : index;
  const geomAttribute = geometry.getAttribute(attribute);

  if (stride !== geomAttribute.itemSize) {
    throw new Error(
      `Stride "${stride}" does not match itemSize "${geomAttribute.itemSize}"`,
    );
  }

  if (stride === 2) {
    return new THREE.Vector2(
      geomAttribute.getX(attrIndex),
      geomAttribute.getY(attrIndex),
    );
  } else if (stride === 3) {
    return new THREE.Vector3(
      geomAttribute.getX(attrIndex),
      geomAttribute.getY(attrIndex),
      geomAttribute.getZ(attrIndex),
    );
  } else if (stride === 4) {
    return new THREE.Quaternion(
      geomAttribute.getX(attrIndex),
      geomAttribute.getY(attrIndex),
      geomAttribute.getZ(attrIndex),
      geomAttribute.getW(attrIndex),
    );
  } else {
    throw new Error(`Invalid stride: ${stride}`);
  }
}

export function getIndexedAttribute2(
  geometry: THREE.BufferGeometry,
  attribute: string,
  index: number,
): THREE.Vector2 {
  return getIndexedAttribute(geometry, attribute, index, 2) as THREE.Vector2;
}

export function getIndexedAttribute3(
  geometry: THREE.BufferGeometry,
  attribute: string,
  index: number,
): THREE.Vector3 {
  return getIndexedAttribute(geometry, attribute, index, 3) as THREE.Vector3;
}

export function getIndexedAttribute4(
  geometry: THREE.BufferGeometry,
  attribute: string,
  index: number,
): THREE.Quaternion {
  return getIndexedAttribute(geometry, attribute, index, 4) as THREE.Quaternion;
}

export function getGeometryLength(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count;
  } else {
    const attribute = geometry.getAttribute('position') as
      | THREE.BufferAttribute
      | undefined;
    if (attribute) {
      return attribute.count;
    } else {
      return 0;
    }
  }
}

type GeometryAttribute = 'position' | 'normal' | 'uv' | 'index';
const geometryAttributeStride: Record<GeometryAttribute, number> = {
  position: 3,
  normal: 3,
  uv: 2,
  index: 1,
} as const;

export function createBufferGeometry(
  data: Partial<Record<GeometryAttribute, THREE.TypedArray>>,
) {
  const geometry = new THREE.BufferGeometry();
  for (const [key, array] of Object.entries(data)) {
    const stride = geometryAttributeStride[key as GeometryAttribute];
    const bufferAttribute = new THREE.BufferAttribute(array, stride);
    if (key === 'index') {
      geometry.setIndex(bufferAttribute);
    } else {
      geometry.setAttribute(key, bufferAttribute);
    }
  }
  return geometry;
}
