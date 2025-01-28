import {
  gp_Ax2,
  gp_Dir,
  gp_Pnt,
  gp_Quaternion,
  gp_Vec,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { axisDirections } from '../util/geometry';
import { getOC } from './oc';
export function pointFromVector(point: THREE.Vector3): gp_Pnt {
  const oc = getOC();
  return new oc.gp_Pnt_3(point.x, point.y, point.z);
}

export function pointToVector(point: gp_Pnt): THREE.Vector3 {
  return new THREE.Vector3(point.X(), point.Y(), point.Z());
}

export function pointToArray(point: gp_Pnt): [number, number, number] {
  return [point.X(), point.Y(), point.Z()];
}

export function directionFromVector(direction: THREE.Vector3): gp_Dir {
  const oc = getOC();
  return new oc.gp_Dir_4(direction.x, direction.y, direction.z);
}

export function directionToVector(direction: gp_Dir): THREE.Vector3 {
  return new THREE.Vector3(direction.X(), direction.Y(), direction.Z());
}

export function directionToArray(direction: gp_Dir): [number, number, number] {
  return [direction.X(), direction.Y(), direction.Z()];
}

export function vectorFromVector(vector: THREE.Vector3): gp_Vec {
  const oc = getOC();
  return new oc.gp_Vec_4(vector.x, vector.y, vector.z);
}

export function vectorToVector(vector: gp_Vec): THREE.Vector3 {
  return new THREE.Vector3(vector.X(), vector.Y(), vector.Z());
}

export function vectorToArray(vector: gp_Vec): [number, number, number] {
  return [vector.X(), vector.Y(), vector.Z()];
}

export function vertexFromPoint(point: gp_Pnt): TopoDS_Vertex {
  const oc = getOC();
  const builder = new oc.BRepBuilderAPI_MakeVertex(point);
  return builder.Vertex();
}

export function vertexToPoint(vertex: TopoDS_Vertex): gp_Pnt {
  const oc = getOC();
  return oc.BRep_Tool.Pnt(vertex);
}

export function axesFromVectorQuaternion(
  point: THREE.Vector3,
  quaternion: THREE.Quaternion,
): gp_Ax2 {
  const oc = getOC();
  const origin = pointFromVector(point);
  const x = directionFromVector(
    axisDirections.x.clone().applyQuaternion(quaternion),
  );
  const z = directionFromVector(
    axisDirections.z.clone().applyQuaternion(quaternion),
  );
  const axes = new oc.gp_Ax2_2(origin, z, x);
  return axes;
}

export function quaternionFromQuaternion(
  quaternion: THREE.Quaternion,
): gp_Quaternion {
  const oc = getOC();
  return new oc.gp_Quaternion_2(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  );
}

export function quaternionToQuaternion(
  quaternion: gp_Quaternion,
): THREE.Quaternion {
  return new THREE.Quaternion(
    quaternion.X(),
    quaternion.Y(),
    quaternion.Z(),
    quaternion.W(),
  );
}
