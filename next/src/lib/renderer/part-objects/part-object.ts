import { Part } from '@/lib/model/parts/part';
import { disposeMaterial } from '@/lib/util/three';
import * as THREE from 'three';

export abstract class PartObject<T extends Part> extends THREE.Group {
  protected _part: T;

  protected typedChildren: [THREE.Mesh, THREE.LineSegments];

  constructor(part: T) {
    super();
    this._part = part;

    this.typedChildren = this.createChildren();
    this.add(...this.typedChildren);

    this.part.addEventListener('change', this.onPartChange);
    this.onPartChange();
  }

  dispose() {
    disposeMaterial(this.typedChildren[0].material);
    disposeMaterial(this.typedChildren[1].material);
    this.typedChildren[1].geometry.dispose();
    this.part.removeEventListener('change', this.onPartChange);
  }

  get part() {
    return this._part;
  }

  protected onPartChange = () => {
    this.updateChildren();
  };

  protected createChildren(): [THREE.Mesh, THREE.LineSegments] {
    const meshMaterial = this.getMeshMaterial();
    const mesh = new THREE.Mesh(undefined, meshMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgesMaterial = this.getEdgesMaterial();
    const edges = new THREE.LineSegments(undefined, edgesMaterial);

    return [mesh, edges];
  }

  protected updateChildren() {
    // We assume the mesh geometry is managed by the part itself. This may change in the future.
    this.typedChildren[1].geometry.dispose();

    const meshGeometry = this.getMeshGeometry();
    const edgesGeometry = this.getEdgesGeometry(meshGeometry);
    this.typedChildren[0].geometry = meshGeometry;
    this.typedChildren[1].geometry = edgesGeometry;
  }

  protected getMeshMaterial() {
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: 'hsl(38, 86%, 78%)',
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
      color: 'hsl(38, 86%, 15%)',
      linewidth: 1.5,
    });
    return edgesMaterial;
  }

  protected getMeshGeometry() {
    return this.part.getGeometry();
  }

  protected getEdgesGeometry(meshGeometry: THREE.BufferGeometry) {
    const edgesGeometry = new THREE.EdgesGeometry(meshGeometry);
    return edgesGeometry;
  }
}
