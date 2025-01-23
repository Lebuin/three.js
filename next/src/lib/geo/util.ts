import { gp_Ax2, gp_Dir, gp_Pnt } from '@lib/opencascade.js';
import * as THREE from 'three';
import { axisDirections } from '../util/geometry';
import { withOC } from './oc';

export function pointFromVector(point: THREE.Vector3): gp_Pnt {
  return withOC((oc) => {
    return new oc.gp_Pnt_3(point.x, point.y, point.z);
  });
}

export function pointToVector(point: gp_Pnt): THREE.Vector3 {
  return new THREE.Vector3(point.X(), point.Y(), point.Z());
}

export function directionFromVector(direction: THREE.Vector3): gp_Dir {
  return withOC((oc) => {
    return new oc.gp_Dir_4(direction.x, direction.y, direction.z);
  });
}

export function directionToVector(direction: gp_Dir): THREE.Vector3 {
  return new THREE.Vector3(direction.X(), direction.Y(), direction.Z());
}

export function axesFromVectorQuaternion(
  point: THREE.Vector3,
  quaternion: THREE.Quaternion,
): gp_Ax2 {
  return withOC((oc) => {
    const origin = pointFromVector(point);
    const x = directionFromVector(
      axisDirections.x.clone().applyQuaternion(quaternion),
    );
    const z = directionFromVector(
      axisDirections.z.clone().applyQuaternion(quaternion),
    );
    const axes = new oc.gp_Ax2_2(origin, z, x);
    return axes;
  });
}
