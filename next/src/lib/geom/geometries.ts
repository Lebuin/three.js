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
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { concatTypedArrays } from '../util/array';
import { getGeometryLength } from '../util/three';
import { exploreEdges, exploreFaces, exploreVertices } from './explore';
import { getOC } from './oc';
import { directionToArray, pointToArray } from './util';

export const STRIDE = 3;
const emptyGeometry = new THREE.BufferGeometry();
emptyGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array(), 3),
);

export interface GeometriesArgs {
  faces?: THREE.BufferGeometry;
  edges?: THREE.BufferGeometry;
  vertices?: THREE.BufferGeometry;
}

export class Geometries {
  faces: THREE.BufferGeometry;
  edges: THREE.BufferGeometry;
  vertices: THREE.BufferGeometry;

  constructor(args: GeometriesArgs) {
    this.faces = args.faces ?? emptyGeometry;
    this.edges = args.edges ?? emptyGeometry;
    this.vertices = args.vertices ?? emptyGeometry;
  }

  dispose() {
    this.faces.dispose();
    this.edges.dispose();
    this.vertices.dispose();
  }
}

export interface OCGeometriesArgs extends GeometriesArgs {
  faceMap?: TopoDS_Face[];
  edgeMap?: TopoDS_Edge[];
  vertexMap?: TopoDS_Vertex[];
}

export class OCGeometries extends Geometries {
  faceMap: TopoDS_Face[];
  edgeMap: TopoDS_Edge[];
  vertexMap: TopoDS_Vertex[];

  constructor(args: OCGeometriesArgs) {
    super(args);
    this.faceMap = args.faceMap ?? [];
    this.edgeMap = args.edgeMap ?? [];
    this.vertexMap = args.vertexMap ?? [];

    const numFacePositions = getGeometryLength(this.faces);
    const numEdgePositions = getGeometryLength(this.edges);
    const numVertexPositions = getGeometryLength(this.vertices);
    const numTriangles = numFacePositions / 3;
    const numEdges = numEdgePositions / 2;
    const numVertices = numVertexPositions;

    if (numTriangles !== this.faceMap.length) {
      throw new Error('Face map length does not match face position count');
    }
    if (numEdges !== this.edgeMap.length) {
      throw new Error('Edge map length does not match edge position count');
    }
    if (numVertices !== this.vertexMap.length) {
      throw new Error('Vertex map length does not match vertex position count');
    }
  }
}

///
// Build an OCGeometries object from a TopoDS_Shape

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
interface WireEdgeData {
  position: Float32Array;
  index: Uint16Array;
  map: TopoDS_Edge[];
}
interface VertexData {
  position: Float32Array;
  map: TopoDS_Vertex[];
}

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

export class OCGeometriesBuilder {
  build(shape: TopoDS_Shape) {
    const { faces, faceMap, edges, edgeMap } = this.buildFacesAndEdges(shape);
    const { vertices, vertexMap } = this.buildVertices(shape);
    const geometries = new OCGeometries({
      faces,
      faceMap,
      edges,
      edgeMap,
      vertices,
      vertexMap,
    });
    return geometries;
  }

  ///
  // Explore subshapes and merge them into a single BufferGeometry

  private buildFacesAndEdges(shape: TopoDS_Shape) {
    const faces = exploreFaces(shape);
    if (faces.length > 0) {
      return this.buildSolidFacesAndEdges(shape, faces);
    } else {
      return this.buildWireFacesAndEdges(shape);
    }
  }

  private buildSolidFacesAndEdges(shape: TopoDS_Shape, faces: TopoDS_Face[]) {
    this.mesh(shape);

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

    return {
      faces: faceGeometry,
      faceMap: faceData.map,
      edges: edgeGeometry,
      edgeMap: faceData.edgeMap,
    };
  }

  /**
   * This method currently only works for straight edges.
   */
  private buildWireFacesAndEdges(shape: TopoDS_Shape) {
    const edges = exploreEdges(shape);
    const allEdgeData = edges
      .map((edge) => this.getWireEdgeData(edge))
      .filter((edgeData) => edgeData !== undefined);
    const edgeData = this.mergeWireEdgeData(allEdgeData);

    const edgeGeometry = this.createBufferGeometry({
      position: edgeData.position,
      index: edgeData.index,
    });

    return {
      faces: new THREE.BufferGeometry(),
      faceMap: [],
      edges: edgeGeometry,
      edgeMap: edgeData.map,
    };
  }

  private buildVertices(shape: TopoDS_Shape) {
    const vertices = exploreVertices(shape);
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

    return {
      vertices: geometry,
      vertexMap: vertexData.map,
    };
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

  private mergeWireEdgeData(allEdgeData: WireEdgeData[]) {
    const position = concatTypedArrays(
      new Float32Array(),
      ..._.map(allEdgeData, 'position'),
    );
    const index = this.mergeIndex(
      _.map(allEdgeData, 'index'),
      _.map(allEdgeData, 'position'),
    );
    const map = _.flatten(_.map(allEdgeData, 'map'));
    return { position, index, map };
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
    const newEdges = edges.filter(
      (edge) => !this.isHandled(edge, handledEdges),
    );
    handledEdges.push(...newEdges);

    const allEdgeData = newEdges
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

    if (polygonHandle.IsNull()) {
      return;
    }

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

  private getWireEdgeData(edge: TopoDS_Edge): WireEdgeData | void {
    const vertices = exploreVertices(edge);
    if (vertices.length < 2) {
      return;
    }

    const position = this.getWireEdgePositionArray(edge, vertices);
    const index = this.getWireEdgeIndexArray(edge, vertices);
    const map = this.getWireEdgeMap(edge, vertices);
    return {
      position,
      index,
      map,
    };
  }

  private getWireEdgePositionArray(
    _edge: TopoDS_Edge,
    vertices: TopoDS_Vertex[],
  ) {
    const oc = getOC();
    const numNodes = vertices.length;
    const positionArray = new Float32Array(numNodes * 3);
    for (let i = 0; i < numNodes; i++) {
      const point = oc.BRep_Tool.Pnt(vertices[i]);
      const index = i * STRIDE;
      positionArray.set(pointToArray(point), index);
    }
    return positionArray;
  }

  private getWireEdgeIndexArray(_edge: TopoDS_Edge, vertices: TopoDS_Vertex[]) {
    const numNodes = vertices.length;
    const indexArray = new Uint16Array((numNodes - 1) * 2);
    for (let i = 0; i < numNodes - 1; i++) {
      const index = i * 2;
      indexArray.set([i, i + 1], index);
    }
    return indexArray;
  }

  private getWireEdgeMap(_edge: TopoDS_Edge, vertices: TopoDS_Vertex[]) {
    const numNodes = vertices.length;
    return _.times(numNodes - 1, () => _edge);
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

  private mesh(shape: TopoDS_Shape) {
    const oc = getOC();
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      shape,
      1,
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
