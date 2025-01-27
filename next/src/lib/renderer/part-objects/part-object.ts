import { Part } from '@/lib/model/parts/part';
import { disposeMaterial } from '@/lib/util/three';
import * as THREE from 'three';

interface TypedChildren {
  faces: THREE.Mesh;
  edges: THREE.LineSegments;
  vertices: THREE.Points;
}

export abstract class PartObject<T extends Part> extends THREE.Group {
  protected _part: T;

  protected typedChildren: TypedChildren;

  constructor(part: T) {
    super();
    this._part = part;

    this.typedChildren = this.createChildren();
    this.add(
      this.typedChildren.faces,
      this.typedChildren.edges,
      this.typedChildren.vertices,
    );

    this.part.addEventListener('change', this.onPartChange);
    this.onPartChange();
  }

  dispose() {
    disposeMaterial(this.typedChildren.faces.material);
    disposeMaterial(this.typedChildren.edges.material);
    this.part.removeEventListener('change', this.onPartChange);
  }

  get part() {
    return this._part;
  }

  protected onPartChange = () => {
    this.updateChildren();
  };

  protected createChildren(): TypedChildren {
    const faceMaterial = this.getMeshMaterial();
    const faces = new THREE.Mesh(undefined, faceMaterial);
    faces.castShadow = true;
    faces.receiveShadow = true;

    const edgesMaterial = this.getEdgesMaterial();
    const edges = new THREE.LineSegments(undefined, edgesMaterial);

    // Vertices are not rendered, but used for raycasting
    const vertices = new THREE.Points<THREE.BufferGeometry>(
      undefined,
      undefined,
    );
    vertices.visible = false;

    return { faces, edges, vertices };
  }

  protected updateChildren() {
    const geometry = this.part.getGeometry();
    this.typedChildren.faces.geometry = geometry.faces;
    this.typedChildren.edges.geometry = geometry.edges;
    this.typedChildren.vertices.geometry = geometry.vertices;
  }

  protected getMeshMaterial() {
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: 'hsl(38, 70%, 78%)',
      roughness: 0.6,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      side: THREE.DoubleSide,
    });
    return meshMaterial;
  }

  protected getEdgesMaterial() {
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 'hsl(38, 70%, 15%)',
      linewidth: 1.5,
    });
    return edgesMaterial;
  }
}
