import { THREE } from '@lib/three.js';
import { describe, expect, it } from 'vitest';
import { GeometriesObject } from './part-objects/geometries-object';
import { SelectionFrustum } from './selection-frustum';

describe('SelectionFrustum', () => {
  // A box with a side length of 2 centered at the origin
  const frustum = new THREE.Frustum(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 1),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 1),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 1),
  );
  const selectionFrustum = new SelectionFrustum(frustum);

  const emptyGeometry = new THREE.BufferGeometry();
  const createGeometriesObject = (vertices: number[], edgeIndex: number[]) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(edgeIndex);
    return new GeometriesObject({
      vertices: geometry,
      edges: geometry,
      faces: emptyGeometry,
    });
  };

  it('should contain points within the frustum', () => {
    const point = new THREE.Vector3(0, 0, 0);
    const isContained = selectionFrustum.containsPoint(point);
    expect(isContained).toBe(true);
  });

  it('should not contain points outside the frustum', () => {
    const point = new THREE.Vector3(2, 2, 2);
    const isContained = selectionFrustum.containsPoint(point);
    expect(isContained).toBe(false);
  });

  it('should contain objects within the frustum', () => {
    const object = createGeometriesObject([0, 0, 0, 0.5, 0.5, 0.5], [0, 1]);
    const containedObjects = selectionFrustum.getContained([object]);
    expect(containedObjects).toContain(object);
  });

  it('should not contain objects outside the frustum', () => {
    const object = createGeometriesObject([2, 2, 2, 3, 3, 3], [0, 1]);
    const containedObjects = selectionFrustum.getContained([object]);
    expect(containedObjects).not.toContain(object);
  });

  it('should intersect objects within the frustum planes', () => {
    const object = createGeometriesObject([0, 0, 0, 0.5, 0.5, 0.5], [0, 1]);
    const intersectingObjects = selectionFrustum.getIntersecting([object]);
    expect(intersectingObjects).toContain(object);
  });

  it('should intersect objects crossing the frustum planes', () => {
    const object = createGeometriesObject([0, 0, 0, 2, 2, 2], [0, 1]);
    const intersectingObjects = selectionFrustum.getIntersecting([object]);
    expect(intersectingObjects).toContain(object);
  });

  it('should not intersect objects completely outside the frustum', () => {
    const object = createGeometriesObject([2, 2, 2, 3, 3, 3], [0, 1]);
    const intersectingObjects = selectionFrustum.getIntersecting([object]);
    expect(intersectingObjects).not.toContain(object);
  });
});
