import { Geometries } from '@/lib/geom/geometries';
import { disposeMaterial } from '@/lib/util/three';
import { THREE } from '@lib/three.js';
import { GeometriesObject } from './geometries-object';
interface TypedChildren {
  faces: THREE.Mesh;
  edges: THREE.LineSegments;
  vertices: THREE.Points;
}

export class MaterialObject<
  T extends Geometries = Geometries,
> extends GeometriesObject<T> {
  dispose() {
    super.dispose();
    disposeMaterial(this.typedChildren.faces.material);
    disposeMaterial(this.typedChildren.edges.material);
  }

  protected createChildren(): TypedChildren {
    const { faces, edges, vertices } = super.createChildren();

    faces.material = this.getMeshMaterial();
    faces.castShadow = true;
    faces.receiveShadow = true;

    edges.material = this.getEdgesMaterial();

    // Vertices are not rendered, but used for raycasting
    vertices.visible = false;

    return { faces, edges, vertices };
  }

  protected getMeshMaterial() {
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: 'hsl(38, 70%, 78%)',
      roughness: 0.6,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
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
