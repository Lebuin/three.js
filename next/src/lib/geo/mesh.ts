import {
  OpenCascadeInstance,
  TopAbs_ShapeEnum,
  TopoDS_Face,
  TopoDS_Shape,
} from '@lib/opencascade.js';
import * as THREE from 'three';
import { concatTypedArrays } from '../util/array';
import { GarbageCollector, withOC } from './oc';

/**
 * Based on https://github.com/polygonjs/polygonjs/blob/master/src/core/geometry/modules/cad/toObject3D/CadShape.ts#L184
 */
export function buildGeometry(shape: TopoDS_Shape): THREE.BufferGeometry {
  return withOC((oc, gc) => {
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      shape,
      0.01,
      false,
      0.5,
      true,
    );

    const done = mesher.IsDone();
    mesher.delete();
    if (!done) {
      throw new Error('Mesher did not finish');
    }

    const faceGeometry = buildFacesGeometry(oc, gc, shape);
    return faceGeometry;
  });
}

interface FaceData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}
const STRIDE = 3;

function buildFacesGeometry(
  oc: OpenCascadeInstance,
  gc: GarbageCollector,
  shape: TopoDS_Shape,
): THREE.BufferGeometry {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE as TopAbs_ShapeEnum,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as TopAbs_ShapeEnum,
  );

  let index = 0;
  const allFaceData: FaceData[] = [];
  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const faceData = getFaceData(oc, gc, face, index);
    if (faceData) {
      allFaceData.push(faceData);
      index += faceData.positions.length / STRIDE;
    }
    explorer.Next();
  }

  const faceData: FaceData = {
    positions: concatTypedArrays(...allFaceData.map((fd) => fd.positions)),
    normals: concatTypedArrays(...allFaceData.map((fd) => fd.normals)),
    indices: concatTypedArrays(...allFaceData.map((fd) => fd.indices)),
  };
  const geometry = createBufferGeometry(faceData);
  return geometry;
}

/**
 * Based on https://github.com/polygonjs/polygonjs/blob/4260474f58715fab90a5a6c171cc86ee883b924e/src/core/geometry/modules/cad/toObject3D/CadTriangulationFaceUtils.ts#L14
 */
export function getFaceData(
  oc: OpenCascadeInstance,
  gc: GarbageCollector,
  face: TopoDS_Face,
  index0 = 0,
): FaceData | void {
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location, 0);

  if (triangulation.IsNull()) {
    return;
  }

  const transformation = location.Transformation();
  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();

  // init
  const normalsArray = gc(new oc.TColgp_Array1OfDir_2(1, nbNodes));
  const pc = gc(new oc.Poly_Connect_2(triangulation));
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

function createBufferGeometry(faceData: FaceData) {
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
