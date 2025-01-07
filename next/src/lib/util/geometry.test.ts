import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import * as geometry from './geometry';
import { expectToBeDefined, expectVectorsToBeClose } from './test';

describe('getQuaternionFromAxes', () => {
  const xAxis = new THREE.Vector3(1, 0, 0);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);

  test('the quaternion of the unit axes is the unit quaternion', () => {
    const quaternion = geometry.getQuaternionFromAxes(xAxis, yAxis);
    expect(xAxis.clone().applyQuaternion(quaternion)).toEqual(xAxis);
    expect(yAxis.clone().applyQuaternion(quaternion)).toEqual(yAxis);
    expect(zAxis.clone().applyQuaternion(quaternion)).toEqual(zAxis);
  });

  test('the quaternion of rotated unit axes correctly rotates', () => {
    const quaternion = geometry.getQuaternionFromAxes(yAxis, zAxis);
    expect(xAxis.clone().applyQuaternion(quaternion)).toEqual(yAxis);
    expect(yAxis.clone().applyQuaternion(quaternion)).toEqual(zAxis);
    expect(zAxis.clone().applyQuaternion(quaternion)).toEqual(xAxis);
  });

  test('the quaternion of arbitrary axes correctly rotate the unit axes', () => {
    const myXAxis = new THREE.Vector3(1, 2, 3).normalize();
    const myYAxis = new THREE.Vector3(4, 5, 6).cross(myXAxis).normalize();
    const quaternion = geometry.getQuaternionFromAxes(myXAxis, myYAxis);
    expectVectorsToBeClose(xAxis.clone().applyQuaternion(quaternion), myXAxis);
    expectVectorsToBeClose(yAxis.clone().applyQuaternion(quaternion), myYAxis);
  });
});

describe('intersectPlanes', () => {
  function expectToBeCoplanar(plane: THREE.Plane, line: THREE.Line3) {
    expect(plane.distanceToPoint(line.start)).toBeCloseTo(0);
    expect(plane.distanceToPoint(line.end)).toBeCloseTo(0);
  }

  test('the XZ and YZ planes intersect at the X axis', () => {
    const xz = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const yz = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const xAxis = new THREE.Line3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1),
    );
    const intersection = geometry.intersectPlanes(yz, xz);

    expectToBeDefined(intersection);
    expect(intersection).toEqual(xAxis);
  });

  test('the intersection of arbitrary planes is coplanar with those planes', () => {
    const plane1 = new THREE.Plane(new THREE.Vector3(3, 4, 5), 6);
    const plane2 = new THREE.Plane(new THREE.Vector3(8, 9, 10), 11);
    const intersection = geometry.intersectPlanes(plane1, plane2);
    expectToBeDefined(intersection);
    expectToBeCoplanar(plane1, intersection);
    expectToBeCoplanar(plane2, intersection);
  });

  test('should be undefined for coinciding planes', () => {
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const intersection = geometry.intersectPlanes(plane, plane);
    expect(intersection).toBeUndefined();
  });

  test('should be undefined for parallel planes', () => {
    const plane1 = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const plane2 = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1);
    const intersection = geometry.intersectPlanes(plane1, plane2);
    expect(intersection).toBeUndefined();
  });
});

describe('distanceToLine', () => {
  test('should return the distance to a non-parallel line', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    );
    const line = new THREE.Line3(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 1, 1),
    );

    const distance = geometry.distanceToLine(ray, line);
    expect(distance).toBeCloseTo(1);
  });

  test('should return the distance to a parallel line', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    );
    const line = new THREE.Line3(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(1, 1, 0),
    );

    const distance = geometry.distanceToLine(ray, line);
    expect(distance).toBeCloseTo(1);
  });

  test('the distance to an intersecting line is 0', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    );
    const line = new THREE.Line3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 1, 0),
    );
    const distance = geometry.distanceToLine(ray, line);
    expect(distance).toBeCloseTo(0);
  });

  test('the distance to a coinciding line is 0', () => {
    const ray = new THREE.Ray(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
    );
    const line = new THREE.Line3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    );
    const distance = geometry.distanceToLine(ray, line);
    expect(distance).toBeCloseTo(0);
  });
});
