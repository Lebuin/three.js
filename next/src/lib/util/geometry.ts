import * as THREE from 'three';

export function getQuaternionFromAxes(
  xAxis?: THREE.Vector3,
  yAxis?: THREE.Vector3,
  zAxis?: THREE.Vector3,
): THREE.Quaternion {
  if (!xAxis) {
    if (yAxis && zAxis) {
      xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    } else {
      throw new Error('At least two axes must be provided');
    }
  }
  if (!yAxis) {
    if (zAxis) {
      yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
    } else {
      throw new Error('At least two axes must be provided');
    }
  }
  if (!zAxis) {
    zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  }

  const matrix = new THREE.Matrix4().makeBasis(
    xAxis.clone().normalize(),
    yAxis.clone().normalize(),
    zAxis.clone().normalize(),
  );
  const quaternion = new THREE.Quaternion()
    .setFromRotationMatrix(matrix)
    .normalize();
  return quaternion;
}

/**
 * Calculate the intersection of two planes as a line, or undefined if the planes are parallel.
 *
 * Inspiration:
 * https://web.archive.org/web/20170325014231/http://geomalgorithms.com/a05-_intersect-1.html,
 * "Intersection of 2 Planes", method (C)
 */
export function intersectPlanes(
  plane1: THREE.Plane,
  plane2: THREE.Plane,
): THREE.Line3 | undefined {
  const direction = new THREE.Vector3().crossVectors(
    plane1.normal,
    plane2.normal,
  );
  if (direction.lengthSq() === 0) {
    return;
  }

  const point = plane1.normal
    .clone()
    .multiplyScalar(plane2.constant)
    .sub(plane2.normal.clone().multiplyScalar(plane1.constant))
    .cross(direction)
    .divideScalar(direction.lengthSq());
  const line = new THREE.Line3(point, point.clone().add(direction));
  return line;
}

/**
 * Calculate the distance between two lines.
 *
 * Inspiration: https://math.stackexchange.com/a/2217845
 */
export function distanceToLine(
  ray: THREE.Ray,
  line: THREE.Line3,
  closestPointOnRay: THREE.Vector3 = new THREE.Vector3(),
  closestPointOnLine: THREE.Vector3 = new THREE.Vector3(),
): number {
  const rayDirection = ray.direction;
  const lineDirection = line.delta(new THREE.Vector3());
  const directionCross = new THREE.Vector3().crossVectors(
    rayDirection,
    lineDirection,
  );
  const rayPoint = ray.origin;
  const linePoint = line.start;

  if (directionCross.lengthSq() === 0) {
    // The lines are parallel, we can use an arbitrary point on line1 to calculate the distance
    closestPointOnRay.copy(rayPoint);
    line.closestPointToPoint(rayPoint, false, closestPointOnLine);
  } else {
    const tRay =
      lineDirection
        .clone()
        .cross(directionCross)
        .dot(linePoint.clone().sub(rayPoint)) / directionCross.lengthSq();
    const tLine =
      rayDirection
        .clone()
        .cross(directionCross)
        .dot(linePoint.clone().sub(rayPoint)) / directionCross.lengthSq();
    closestPointOnRay
      .copy(rayPoint)
      .add(rayDirection.clone().multiplyScalar(tRay));
    closestPointOnLine
      .copy(linePoint)
      .add(lineDirection.clone().multiplyScalar(tLine));
  }

  const distance = closestPointOnRay.distanceTo(closestPointOnLine);
  return distance;
}

export function vectorsAreParallel(
  vector1: THREE.Vector3,
  vector2: THREE.Vector3,
  tolerance = 1e-6,
): boolean {
  const cross = new THREE.Vector3().crossVectors(vector1, vector2);
  return cross.lengthSq() < tolerance;
}
