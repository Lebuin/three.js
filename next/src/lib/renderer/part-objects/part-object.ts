import { Part } from '@/lib/model/parts/part';
import { disposeObject } from '@/lib/util/three';
import * as THREE from 'three';

export abstract class PartObject<T extends Part> extends THREE.Group {
  protected _part: T;

  constructor(part: T) {
    super();
    this._part = part;

    this.part.addEventListener('change', this.onPartChange);
    this.createChildren();
  }

  get part() {
    return this._part;
  }

  protected onPartChange = () => {
    this.dispose();
    this.createChildren();
  };

  public dispose() {
    // We're assuming the geometry is managed externally, i.e. by the model part. This may not
    // be true in the future if we created derived geometries.
    disposeObject(this, { geometry: false });
  }

  protected createChildren() {
    const children = this.getChildren();
    this.add(...children);
  }

  protected getChildren(): THREE.Object3D[] {
    const meshGeometry = this.getMeshGeometry();
    const meshMaterial = this.getMeshMaterial();

    const mesh = new THREE.Mesh(meshGeometry, meshMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgesGeometry = this.getEdgesGeometry(meshGeometry);
    const edgesMaterial = this.getEdgesMaterial();
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);

    return [mesh, edges];
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

  private getMeshGeometry() {
    return this.part.getGeometry();
  }

  private getEdgesGeometry(_meshGeometry: THREE.BufferGeometry) {
    // TODO
    return new THREE.BufferGeometry();
  }
}
