import { Board } from '@/lib/model/parts/board';
import { disposeMaterial } from '@/lib/util/three';
import * as THREE from 'three';
import { PartObject } from './part-object';

export class BoardObject extends PartObject<Board> {
  private typedChildren: [THREE.Mesh, THREE.LineSegments];

  constructor(part: Board) {
    super(part);

    this.typedChildren = this.createChildren();
    this.add(...this.typedChildren);

    this.part.addEventListener('change', this.updateFromPart);
    this.updateFromPart();
  }

  dispose() {
    this.typedChildren.forEach((child) => {
      child.geometry.dispose();
      disposeMaterial(child.material);
    });
  }

  private createGeometry() {
    const geometry = new THREE.BoxGeometry(
      this.part.size.x,
      this.part.size.y,
      this.part.size.z,
    );
    return geometry;
  }

  private createEdgesGeometry(geometry: THREE.BoxGeometry) {
    const size = new THREE.Vector3(
      geometry.parameters.width,
      geometry.parameters.height,
      geometry.parameters.depth,
    );
    const numNonZero = [size.x, size.y, size.z].filter(
      (value) => value !== 0,
    ).length;

    if (numNonZero <= 1) {
      const edgesGeometry = new THREE.BufferGeometry().setFromPoints([
        size.clone().multiplyScalar(-0.5),
        size.clone().multiplyScalar(0.5),
      ]);
      return edgesGeometry;
    } else {
      const edgesGeometry = new THREE.EdgesGeometry(geometry);
      return edgesGeometry;
    }
  }

  private createChildren(): [THREE.Mesh, THREE.LineSegments] {
    const meshMaterial = this.getMeshMaterial();

    const mesh = new THREE.Mesh(undefined, meshMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const edgesMaterial = this.getEdgesMaterial();
    const wireframe = new THREE.LineSegments(undefined, edgesMaterial);

    return [mesh, wireframe];
  }

  private getMeshMaterial() {
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: 'hsl(38, 86%, 78%)',
      roughness: 0.6,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    return meshMaterial;
  }

  private getEdgesMaterial() {
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: 'hsl(38, 86%, 15%)',
      linewidth: 1.5,
    });
    return edgesMaterial;
  }

  private updateFromPart = () => {
    this.updateGeometry();
    this.updateTransform();
  };

  private updateGeometry() {
    this.typedChildren.forEach((child) => {
      child.geometry.dispose();
    });

    const geometry = this.createGeometry();
    this.typedChildren[0].geometry = geometry;
    const edgesGeometry = this.createEdgesGeometry(geometry);
    this.typedChildren[1].geometry = edgesGeometry;

    // Offset the box by half its size so that a corner is placed at `this.position`
    const position = this.part.size.clone().multiplyScalar(0.5);
    this.typedChildren.forEach((child) => {
      child.position.copy(position);
    });
  }

  private updateTransform() {
    this.position.copy(this.part.position);
    this.quaternion.copy(this.part.quaternion);
  }
}
