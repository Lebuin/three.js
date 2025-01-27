import {
  gp_Trsf,
  Handle_Poly_PolygonOnTriangulation,
  Handle_Poly_Triangulation,
  TopLoc_Location,
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import _ from 'lodash';
import * as THREE from 'three';
import { concatTypedArrays } from '../util/array';
import { exploreEdges, exploreFaces, exploreVertices } from './explore';
import { getOC } from './oc';
import { directionToArray, pointToArray } from './util';

interface FaceData {
  position: Float32Array;
  normal: Float32Array;
  index: Uint16Array;
  map: TopoDS_Face[];
  edgeIndex: Uint16Array;
  edgeMap: TopoDS_Edge[];
}
interface EdgeData {
  index: Uint16Array;
  map: TopoDS_Edge[];
}
interface VertexData {
  position: Float32Array;
  map: TopoDS_Vertex[];
}
const STRIDE = 3;

enum FaceOrientation {
  BACKWARD,
  FORWARD,
}

type GeometryAttribute = 'position' | 'normal' | 'uv' | 'index';
const geometryAttributeStride: Record<GeometryAttribute, number> = {
  position: 3,
  normal: 3,
  uv: 2,
  index: 1,
} as const;

export class ShapeGeometry {
  private shape: TopoDS_Shape;

  private _faces?: THREE.BufferGeometry;
  private _edges?: THREE.BufferGeometry;
  private _vertices?: THREE.BufferGeometry;
  private _faceMap?: TopoDS_Face[];
  private _edgeMap?: TopoDS_Edge[];
  private _vertexMap?: TopoDS_Vertex[];

  constructor(shape: TopoDS_Shape) {
    this.shape = shape;
  }

  dispose() {
    if (this._faces) {
      this._faces.dispose();
    }
    if (this._edges) {
      this._edges.dispose();
    }
    if (this._vertices) {
      this._vertices.dispose();
    }
  }

  get faces() {
    if (!this._faces) {
      this.build();
    }
    return this._faces!;
  }
  getFace(index: number) {
    if (!this._faceMap) {
      this.build();
    }
    return this._faceMap![index];
  }

  get edges() {
    if (!this._edges) {
      this.build();
    }
    return this._edges!;
  }
  getEdge(index: number) {
    if (!this._edgeMap) {
      this.build();
    }
    return this._edgeMap![index];
  }

  get vertices() {
    if (!this._vertices) {
      this.build();
    }
    return this._vertices!;
  }
  getVertex(index: number) {
    if (!this._vertexMap) {
      this.build();
    }
    return this._vertexMap![index];
  }

  ///
  // Explore subshapes and merge them into a single BufferGeometry

  private build() {
    this.buildFacesAndEdges();
    this.buildVertices();
  }

  private buildFacesAndEdges() {
    this.mesh();

    const faces = exploreFaces(this.shape);
    const handledEdges: TopoDS_Edge[] = [];
    const allFaceData = faces
      .map((face) => this.getFaceData(face, handledEdges))
      .filter((faceData) => faceData !== undefined);
    const faceData = this.mergeFaceData(allFaceData);

    const faceGeometry = this.createBufferGeometry({
      position: faceData.position,
      normal: faceData.normal,
      index: faceData.index,
    });
    const edgeGeometry = this.createBufferGeometry({
      position: faceData.position,
      index: faceData.edgeIndex,
    });

    this._faces = faceGeometry;
    this._edges = edgeGeometry;
    this._faceMap = faceData.map;
    this._edgeMap = faceData.edgeMap;
  }

  private buildVertices() {
    const vertices = exploreVertices(this.shape);
    const uniqueVertices = [];
    for (const vertex of vertices) {
      if (!this.isHandled(vertex, uniqueVertices)) {
        uniqueVertices.push(vertex);
      }
    }
    const vertexData = this.getVertexData(uniqueVertices);

    const geometry = this.createBufferGeometry({
      position: vertexData.position,
    });

    this._vertices = geometry;
    this._vertexMap = vertexData.map;
  }

  private mergeFaceData(allFaceData: FaceData[]) {
    const position = concatTypedArrays(
      new Float32Array(),
      ..._.map(allFaceData, 'position'),
    );
    const normal = concatTypedArrays(
      new Float32Array(),
      ..._.map(allFaceData, 'normal'),
    );
    const index = this.mergeIndex(
      _.map(allFaceData, 'index'),
      _.map(allFaceData, 'position'),
    );
    const map = _.flatten(_.map(allFaceData, 'map'));
    const edgeIndex = this.mergeIndex(
      _.map(allFaceData, 'edgeIndex'),
      _.map(allFaceData, 'position'),
    );
    const edgeMap = _.flatten(_.map(allFaceData, 'edgeMap'));

    return {
      position,
      normal,
      index,
      map,
      edgeIndex,
      edgeMap,
    };
  }

  private mergeEdgeData(allEdgeData: EdgeData[]) {
    const index = concatTypedArrays(
      new Uint16Array(),
      ..._.map(allEdgeData, 'index'),
    );
    const map = _.flatten(_.map(allEdgeData, 'map'));
    return { index, map };
  }

  private mergeIndex(
    indexArrays: Uint16Array[],
    positionArrays: Float32Array[],
  ) {
    const indexLength = _.sumBy(indexArrays, 'length');
    const index = new Uint16Array(indexLength);
    let offset = 0;
    let indexOffset = 0;
    for (let i = 0; i < indexArrays.length; i++) {
      const array = indexArrays[i];
      const positionArray = positionArrays[i];

      index.set(array, offset);
      for (let j = offset; j < offset + array.length; j++) {
        index[j] += indexOffset;
      }

      offset += array.length;
      indexOffset += positionArray.length / STRIDE;
    }
    return index;
  }

  ///
  // Build the geometry data for a single subshape

  private getFaceData(
    face: TopoDS_Face,
    handledEdges: TopoDS_Edge[],
  ): FaceData | void {
    const oc = getOC();
    const location = new oc.TopLoc_Location_1();
    const triangulationHandle = oc.BRep_Tool.Triangulation(face, location, 0);
    if (triangulationHandle.IsNull()) {
      return;
    }

    const transformation = location.Transformation();

    const position = this.getFacePositionArray(
      face,
      triangulationHandle,
      transformation,
    );
    const normal = this.getFaceNormalArray(
      face,
      triangulationHandle,
      transformation,
    );
    const index = this.getFaceIndexArray(face, triangulationHandle);
    const map = this.getFaceMap(face, triangulationHandle);

    const edges = exploreEdges(face);
    const newEdges = edges.filter((edge) => this.isHandled(edge, handledEdges));
    handledEdges.push(...newEdges);

    const allEdgeData = exploreEdges(face)
      .map((edge) => this.getEdgeData(edge, triangulationHandle, location))
      .filter((edgeData) => edgeData !== undefined);
    const edgeData = this.mergeEdgeData(allEdgeData);

    return {
      position,
      normal,
      index,
      map,
      edgeIndex: edgeData.index,
      edgeMap: edgeData.map,
    };
  }

  private getFacePositionArray(
    _face: TopoDS_Face,
    triangulationHandle: Handle_Poly_Triangulation,
    transformation: gp_Trsf,
  ): Float32Array {
    const triangulation = triangulationHandle.get();
    const numNodes = triangulation.NbNodes();
    const position = new Float32Array(numNodes * 3);
    for (let i = 0; i < numNodes; i++) {
      const point = triangulation.Node(i + 1).Transformed(transformation);
      const index = i * STRIDE;
      position.set(pointToArray(point), index);
    }
    return position;
  }

  private getFaceNormalArray(
    face: TopoDS_Face,
    triangulationHandle: Handle_Poly_Triangulation,
    transformation: gp_Trsf,
  ): Float32Array {
    const oc = getOC();

    const triangulation = triangulationHandle.get();
    const numNodes = triangulation.NbNodes();

    const normals = new oc.TColgp_Array1OfDir_2(1, numNodes);
    const polyConnect = new oc.Poly_Connect_2(triangulationHandle);
    oc.StdPrs_ToolTriangulatedShape.Normal(face, polyConnect, normals);

    const normalArray = new Float32Array(numNodes * 3);
    for (let i = 0; i < numNodes; i++) {
      const normal = normals.Value(i + 1).Transformed(transformation);
      const index = i * STRIDE;
      normalArray.set(directionToArray(normal), index);
    }
    return normalArray;
  }

  private getFaceIndexArray(
    face: TopoDS_Face,
    triangulationHandle: Handle_Poly_Triangulation,
  ) {
    const triangulation = triangulationHandle.get();
    const numTriangles = triangulation.NbTriangles();
    const indexArray = new Uint16Array(numTriangles * 3);
    const orientation = this.getFaceOrientation(face);
    for (let i = 0; i < numTriangles; i++) {
      const t = triangulation.Triangle(i + 1);
      const n1 = t.Value(orientation == FaceOrientation.FORWARD ? 1 : 2) - 1;
      const n2 = t.Value(orientation == FaceOrientation.FORWARD ? 2 : 1) - 1;
      const n3 = t.Value(3) - 1;
      const index = i * STRIDE;
      indexArray.set([n1, n2, n3], index);
    }
    return indexArray;
  }

  private getFaceOrientation(face: TopoDS_Face): FaceOrientation {
    const oc = getOC();
    return face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_FORWARD
      ? FaceOrientation.FORWARD
      : FaceOrientation.BACKWARD;
  }

  private getFaceMap(
    face: TopoDS_Face,
    triangulationHandle: Handle_Poly_Triangulation,
  ): TopoDS_Face[] {
    const triangulation = triangulationHandle.get();
    const numTriangles = triangulation.NbTriangles();
    return _.times(numTriangles, () => face);
  }

  private getEdgeData(
    edge: TopoDS_Edge,
    triangulationHandle: Handle_Poly_Triangulation,
    location: TopLoc_Location,
  ): EdgeData | void {
    const oc = getOC();
    const polygonHandle = oc.BRep_Tool.PolygonOnTriangulation_1(
      edge,
      triangulationHandle,
      location,
    );

    const index = this.getEdgeIndexArray(edge, polygonHandle);
    const map = this.getEdgeMap(edge, polygonHandle);

    return { index, map };
  }

  private getEdgeIndexArray(
    _edge: TopoDS_Edge,
    polygonHandle: Handle_Poly_PolygonOnTriangulation,
  ) {
    const polygon = polygonHandle.get();
    const numNodes = polygon.NbNodes();
    const indexArray = new Uint16Array((numNodes - 1) * 2);
    for (let i = 0; i < numNodes - 1; i++) {
      const n1 = polygon.Node(i + 1) - 1;
      const n2 = polygon.Node(i + 2) - 1;
      const index = i * 2;
      indexArray.set([n1, n2], index);
    }
    return indexArray;
  }

  private getEdgeMap(
    edge: TopoDS_Edge,
    polygonHandle: Handle_Poly_PolygonOnTriangulation,
  ): TopoDS_Edge[] {
    const polygon = polygonHandle.get();
    const numNodes = polygon.NbNodes();
    return _.times(numNodes - 1, () => edge);
  }

  private getVertexData(vertices: TopoDS_Vertex[]): VertexData {
    const oc = getOC();
    const position = new Float32Array(vertices.length * STRIDE);
    const map = vertices;

    for (let i = 0; i < vertices.length; i++) {
      const point = oc.BRep_Tool.Pnt(vertices[i]);
      position.set(pointToArray(point), i * STRIDE);
    }

    return {
      position,
      map,
    };
  }

  ///
  // Utils

  private mesh() {
    const oc = getOC();
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      this.shape,
      0.01,
      false,
      0.5,
      true,
    );
    if (!mesher.IsDone()) {
      throw new Error('Mesher did not finish');
    }
  }

  private isHandled<T extends TopoDS_Shape>(shape: T, handledShapes: T[]) {
    for (const handledShape of handledShapes) {
      if (handledShape.IsSame(shape)) {
        return true;
      }
    }
    return false;
  }

  private createBufferGeometry(
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
}
