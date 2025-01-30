import {
  gp_Trsf,
  Handle_Poly_PolygonOnTriangulation,
  Handle_Poly_Triangulation,
  TopLoc_Location,
} from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { concatTypedArrays } from '../util/array';
import {
  createBufferGeometry,
  getGeometryLength,
  getIndexedAttribute3,
} from '../util/three';
import { getOC } from './oc';
import { Edge, Face, RootShape, Solid, Vertex, Wire } from './shape';
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
  faceMap?: Face[];
  edgeMap?: Edge[];
  vertexMap?: Vertex[];
}

export class OCGeometries extends Geometries {
  faceMap: Face[];
  edgeMap: Edge[];
  vertexMap: Vertex[];

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

  getVertexGeometry(vertex: Vertex) {
    const index = this.vertexMap.indexOf(vertex);
    if (index === -1) {
      throw new Error('Vertex not found in geometries');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.vertices.getAttribute('position'));
    geometry.setDrawRange(index, 1);

    return geometry;
  }

  getVertexPoint(vertex: Vertex) {
    const index = this.vertexMap.indexOf(vertex);
    if (index === -1) {
      throw new Error('Vertex not found in geometries');
    }

    const point = getIndexedAttribute3(this.vertices, 'position', index);
    return point;
  }

  getEdgeGeometry(edge: Edge) {
    const startIndex = this.edgeMap.indexOf(edge);
    const endIndex = this.edgeMap.lastIndexOf(edge) + 1;
    if (startIndex === -1) {
      throw new Error('Edge not found in geometries');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.edges.getAttribute('position'));
    geometry.setIndex(this.edges.index);
    geometry.setDrawRange(startIndex * 2, (endIndex - startIndex) * 2);

    return geometry;
  }

  getEdgePoints(edge: Edge) {
    const startIndex = this.edgeMap.indexOf(edge);
    const endIndex = this.edgeMap.lastIndexOf(edge) + 1;
    if (startIndex === -1) {
      throw new Error('Edge not found in geometries');
    }

    const points = [];
    for (let i = startIndex * 2; i < endIndex * 2; i++) {
      const point = getIndexedAttribute3(this.edges, 'position', i);
      points.push(point);
    }

    return points;
  }

  getFaceGeometry(face: Face) {
    const startIndex = this.faceMap.indexOf(face);
    const endIndex = this.faceMap.lastIndexOf(face) + 1;
    if (startIndex === -1) {
      throw new Error('Face not found in geometries');
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.faces.getAttribute('position'));
    geometry.setAttribute('normal', this.faces.getAttribute('normal'));
    geometry.setIndex(this.faces.index);
    geometry.setDrawRange(startIndex * 3, (endIndex - startIndex) * 3);

    return geometry;
  }
}

///
// Build an OCGeometries object from a TopoDS_Shape

interface FaceData {
  position: Float32Array;
  normal: Float32Array;
  index: Uint16Array;
  map: Face[];
  edgeIndex: Uint16Array;
  edgeMap: Edge[];
}
interface SolidEdgeData {
  index: Uint16Array;
  map: Edge[];
}
interface WireEdgeData {
  position: Float32Array;
  index: Uint16Array;
  map: Edge[];
}
interface VertexData {
  position: Float32Array;
  map: Vertex[];
}

enum FaceOrientation {
  BACKWARD,
  FORWARD,
}

export class OCGeometriesBuilder {
  build(shape: RootShape) {
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

  private buildFacesAndEdges(shape: RootShape) {
    if (shape instanceof Solid) {
      return this.buildSolidFacesAndEdges(shape);
    } else if (shape instanceof Wire) {
      return this.buildWireFacesAndEdges(shape);
    } else {
      throw new Error('Unsupported shape type');
    }
  }

  private buildSolidFacesAndEdges(solid: Solid) {
    this.mesh(solid);

    const allFaceData = solid.faces
      .map((face) => this.getFaceData(face))
      .filter((faceData) => faceData !== undefined);
    const faceData = this.mergeFaceData(allFaceData);

    const faceGeometry = createBufferGeometry({
      position: faceData.position,
      normal: faceData.normal,
      index: faceData.index,
    });
    const edgeGeometry = createBufferGeometry({
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
  private buildWireFacesAndEdges(shape: Wire) {
    const allEdgeData = shape.edges
      .map((edge) => this.getWireEdgeData(edge))
      .filter((edgeData) => edgeData !== undefined);
    const edgeData = this.mergeWireEdgeData(allEdgeData);

    const edgeGeometry = createBufferGeometry({
      position: edgeData.position,
      index: edgeData.index,
    });

    return {
      faces: emptyGeometry,
      faceMap: [],
      edges: edgeGeometry,
      edgeMap: edgeData.map,
    };
  }

  private buildVertices(shape: RootShape) {
    const vertexData = this.getVertexData(shape.vertices);

    const geometry = createBufferGeometry({
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

  private mergeSolidEdgeData(allEdgeData: SolidEdgeData[]) {
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

  private getFaceData(face: Face): FaceData | void {
    const oc = getOC();
    const location = new oc.TopLoc_Location_1();
    const triangulationHandle = oc.BRep_Tool.Triangulation(
      face.shape,
      location,
      0,
    );
    if (triangulationHandle.IsNull()) {
      throw new Error('Triangulation failed');
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

    // Multiple faces can share the same edge. That's why we don't directly access face.edges,
    // but use solid.edges, which is guaranteed to only contain every edge once.
    const edges = face.parent!.edges.filter((edge) => edge.parent === face);
    const allEdgeData = edges
      .map((edge) => this.getSolidEdgeData(edge, triangulationHandle, location))
      .filter((edgeData) => edgeData !== undefined);
    const edgeData = this.mergeSolidEdgeData(allEdgeData);

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
    _face: Face,
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
    face: Face,
    triangulationHandle: Handle_Poly_Triangulation,
    transformation: gp_Trsf,
  ): Float32Array {
    const oc = getOC();

    const triangulation = triangulationHandle.get();
    const numNodes = triangulation.NbNodes();

    const normals = new oc.TColgp_Array1OfDir_2(1, numNodes);
    const polyConnect = new oc.Poly_Connect_2(triangulationHandle);
    oc.StdPrs_ToolTriangulatedShape.Normal(face.shape, polyConnect, normals);

    const normalArray = new Float32Array(numNodes * 3);
    for (let i = 0; i < numNodes; i++) {
      const normal = normals.Value(i + 1).Transformed(transformation);
      const index = i * STRIDE;
      normalArray.set(directionToArray(normal), index);
    }
    return normalArray;
  }

  private getFaceIndexArray(
    face: Face,
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

  private getFaceOrientation(face: Face): FaceOrientation {
    const oc = getOC();
    return face.shape.Orientation_1() === oc.TopAbs_Orientation.TopAbs_FORWARD
      ? FaceOrientation.FORWARD
      : FaceOrientation.BACKWARD;
  }

  private getFaceMap(
    face: Face,
    triangulationHandle: Handle_Poly_Triangulation,
  ): Face[] {
    const triangulation = triangulationHandle.get();
    const numTriangles = triangulation.NbTriangles();
    return _.times(numTriangles, () => face);
  }

  private getSolidEdgeData(
    edge: Edge,
    triangulationHandle: Handle_Poly_Triangulation,
    location: TopLoc_Location,
  ): SolidEdgeData | void {
    if (!edge.parent) {
      throw new Error('Edge in solid has no parent');
    }

    const oc = getOC();
    const polygonHandle = oc.BRep_Tool.PolygonOnTriangulation_1(
      edge.shape,
      triangulationHandle,
      location,
    );

    if (polygonHandle.IsNull()) {
      throw new Error('Failed to build edge polygon');
    }

    const index = this.getEdgeIndexArray(edge, polygonHandle);
    const map = this.getEdgeMap(edge, polygonHandle);

    return { index, map };
  }

  private getEdgeIndexArray(
    _edge: Edge,
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
    edge: Edge,
    polygonHandle: Handle_Poly_PolygonOnTriangulation,
  ): Edge[] {
    const polygon = polygonHandle.get();
    const numNodes = polygon.NbNodes();
    return _.times(numNodes - 1, () => edge);
  }

  private getWireEdgeData(edge: Edge): WireEdgeData | void {
    const vertices = edge.vertices;
    if (vertices.length < 2) {
      throw new Error('Edge has less than 2 vertices');
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

  private getWireEdgePositionArray(_edge: Edge, vertices: Vertex[]) {
    const oc = getOC();
    const numNodes = vertices.length;
    const positionArray = new Float32Array(numNodes * 3);
    for (let i = 0; i < numNodes; i++) {
      const point = oc.BRep_Tool.Pnt(vertices[i].shape);
      const index = i * STRIDE;
      positionArray.set(pointToArray(point), index);
    }
    return positionArray;
  }

  private getWireEdgeIndexArray(_edge: Edge, vertices: Vertex[]) {
    const numNodes = vertices.length;
    const indexArray = new Uint16Array((numNodes - 1) * 2);
    for (let i = 0; i < numNodes - 1; i++) {
      const index = i * 2;
      indexArray.set([i, i + 1], index);
    }
    return indexArray;
  }

  private getWireEdgeMap(_edge: Edge, vertices: Vertex[]) {
    const numNodes = vertices.length;
    return _.times(numNodes - 1, () => _edge);
  }

  private getVertexData(vertices: Vertex[]): VertexData {
    const oc = getOC();
    const position = new Float32Array(vertices.length * STRIDE);
    const map = vertices;

    for (let i = 0; i < vertices.length; i++) {
      const point = oc.BRep_Tool.Pnt(vertices[i].shape);
      position.set(pointToArray(point), i * STRIDE);
    }

    return {
      position,
      map,
    };
  }

  ///
  // Utils

  private mesh(solid: Solid) {
    const oc = getOC();
    const mesher = new oc.BRepMesh_IncrementalMesh_2(
      solid.shape,
      1,
      false,
      0.5,
      true,
    );
    if (!mesher.IsDone()) {
      throw new Error('Mesher did not finish');
    }
  }
}
