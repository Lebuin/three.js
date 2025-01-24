import {
  OpenCascadeInstance,
  TopoDS_Face,
  TopoDS_Shape,
} from '@lib/opencascade.js';
import * as THREE from 'three';
import { concatTypedArrays } from '../util/array';
import { exploreFaces } from './explore';
import { getOC } from './oc';

/**
 * Based on https://github.com/polygonjs/polygonjs/blob/4260474f58715fab90a5a6c171cc86ee883b924e/src/core/geometry/modules/cad/toObject3D/CadShape.ts#L184
 */
export function buildFaceGeometry(shape: TopoDS_Shape): THREE.BufferGeometry {
  meshShape(shape);
  const faceGeometry = buildFaceGeometryForMeshed(shape);
  return faceGeometry;
}

function meshShape(shape: TopoDS_Shape) {
  const oc = getOC();
  const mesher = new oc.BRepMesh_IncrementalMesh_2(
    shape,
    0.01,
    false,
    0.5,
    true,
  );
  if (!mesher.IsDone()) {
    throw new Error('Mesher did not finish');
  }
}

interface FaceData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}
const STRIDE = 3;

/**
 * Based on https://github.com/polygonjs/polygonjs/blob/4260474f58715fab90a5a6c171cc86ee883b924e/src/core/geometry/modules/cad/CadTraverse.ts#L3
 */
function buildFaceGeometryForMeshed(shape: TopoDS_Shape): THREE.BufferGeometry {
  let index = 0;
  const allFaceData: FaceData[] = [];
  const faces = exploreFaces(shape);
  for (const face of faces) {
    const faceData = getFaceData(face, index);
    if (faceData) {
      allFaceData.push(faceData);
      index += faceData.positions.length / STRIDE;
    }
  }

  const faceData: FaceData = {
    positions: concatTypedArrays(...allFaceData.map((fd) => fd.positions)),
    normals: concatTypedArrays(...allFaceData.map((fd) => fd.normals)),
    indices: concatTypedArrays(...allFaceData.map((fd) => fd.indices)),
  };
  const geometry = createFaceBufferGeometry(faceData);
  return geometry;
}

/**
 * Based on https://github.com/polygonjs/polygonjs/blob/4260474f58715fab90a5a6c171cc86ee883b924e/src/core/geometry/modules/cad/toObject3D/CadTriangulationFaceUtils.ts#L14
 */
export function getFaceData(face: TopoDS_Face, index0 = 0): FaceData | void {
  const oc = getOC();
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);

  if (triangulation.IsNull()) {
    return;
  }

  const transformation = location.Transformation();
  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();

  // init
  const normalsArray = new oc.TColgp_Array1OfDir_2(1, nbNodes);
  const pc = new oc.Poly_Connect_2(triangulation);
  oc.StdPrs_ToolTriangulatedShape.Normal(face, pc, normalsArray);
  const nbTriangles = tri.NbTriangles();
  const faceData: FaceData = {
    positions: new Float32Array(nbNodes * 3),
    normals: new Float32Array(normalsArray.Length() * 3),
    indices: new Uint16Array(nbTriangles * 3),
  };

  // positions
  for (let i = 1; i <= nbNodes; i++) {
    const p = tri.Node(i).Transformed(transformation);
    const index = (i - 1) * STRIDE;
    faceData.positions[index] = p.X();
    faceData.positions[index + 1] = p.Y();
    faceData.positions[index + 2] = p.Z();
  }

  // normals
  for (let i = normalsArray.Lower(); i <= normalsArray.Upper(); i++) {
    const d = normalsArray.Value(i).Transformed(transformation);
    const index = (i - 1) * STRIDE;
    faceData.normals[index] = d.X();
    faceData.normals[index + 1] = d.Y();
    faceData.normals[index + 2] = d.Z();
  }

  // indices
  let trisCount = 0;
  const orientation = getFaceOrientation(oc, face);
  for (let nt = 1; nt <= nbTriangles; nt++) {
    const t = tri.Triangle(nt);
    let n1 = t.Value(1);
    let n2 = t.Value(2);
    const n3 = t.Value(3);
    if (orientation == FaceOrientation.BACKWARD) {
      const tmp = n1;
      n1 = n2;
      n2 = tmp;
    }
    const index = trisCount * STRIDE;
    faceData.indices[index] = n1 - 1 + index0;
    faceData.indices[index + 1] = n2 - 1 + index0;
    faceData.indices[index + 2] = n3 - 1 + index0;
    trisCount++;
  }

  return faceData;
}

enum FaceOrientation {
  BACKWARD,
  FORWARD,
}

function getFaceOrientation(
  oc: OpenCascadeInstance,
  face: TopoDS_Face,
): FaceOrientation {
  return face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_FORWARD
    ? FaceOrientation.FORWARD
    : FaceOrientation.BACKWARD;
}

function createFaceBufferGeometry(faceData: FaceData) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(faceData.positions, STRIDE),
  );
  geometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(faceData.normals, STRIDE),
  );
  geometry.setIndex(new THREE.BufferAttribute(faceData.indices, 1));
  return geometry;
}
