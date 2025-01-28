import { Geometries } from '@/lib/geom/geometries';
import { THREE } from '@lib/three.js';
interface TypedChildren {
  faces: THREE.Mesh;
  edges: THREE.LineSegments;
  vertices: THREE.Points;
}

export class GeometriesObject<
  T extends Geometries = Geometries,
> extends THREE.Group {
  protected _geometries: T;
  protected typedChildren: TypedChildren;

  constructor(geometries: T) {
    super();

    this._geometries = geometries;
    this.typedChildren = this.createChildren();
    this.add(
      this.typedChildren.faces,
      this.typedChildren.edges,
      this.typedChildren.vertices,
    );

    this.onGeometriesChange();
  }

  dispose() {
    this._geometries.dispose();
  }

  get faces() {
    return this.typedChildren.faces;
  }
  get edges() {
    return this.typedChildren.edges;
  }
  get vertices() {
    return this.typedChildren.vertices;
  }

  get geometries() {
    return this._geometries;
  }
  setGeometries(geometries: T) {
    this._geometries = geometries;
    this.onGeometriesChange();
  }

  protected onGeometriesChange = () => {
    this.updateChildren();
  };

  protected createChildren(): TypedChildren {
    const faces = new THREE.Mesh(undefined, undefined);
    const edges = new THREE.LineSegments(undefined, undefined);
    const vertices = new THREE.Points<THREE.BufferGeometry>(
      undefined,
      undefined,
    );

    return { faces, edges, vertices };
  }

  protected updateChildren() {
    this.typedChildren.faces.geometry = this.geometries.faces;
    this.typedChildren.edges.geometry = this.geometries.edges;
    this.typedChildren.vertices.geometry = this.geometries.vertices;
  }
}

export type OCGeometriesObject = GeometriesObject<Geometries>;
