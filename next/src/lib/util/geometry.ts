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
