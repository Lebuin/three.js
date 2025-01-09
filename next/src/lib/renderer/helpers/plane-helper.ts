import _ from 'lodash';
import * as THREE from 'three';
import { Color } from '../../util/color';
import { disposeMaterial } from '../../util/three';

interface GridColors {
  primary: Color;
  secondary: Color;
}

interface Colors {
  grid: GridColors;
  plane: Color;
}

const defaultColorRepresentations: Colors = {
  grid: {
    primary: new Color().setHSLA(0, 0, 0.3, 0.2),
    secondary: new Color().setHSLA(0, 0, 0.5, 0.2),
  },
  plane: new Color().setHSLA(0, 0, 0, 0.1),
} as const;

class GridHelper extends THREE.LineSegments {
  type = 'GridHelper';

  constructor(size = 10, divisions = 10, colors: GridColors) {
    const allColors = _.merge({}, defaultColorRepresentations.grid, colors);
    const threeColors = {
      primary: new Color(allColors.primary),
      secondary: new Color(allColors.secondary),
    };

    const center = divisions / 2;
    const step = size / divisions;
    const halfSize = size / 2;

    const vertices: number[] = [];
    const colorsArray: number[] = [];

    for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
      // Avoid drawing over the main axes
      if (k === 0) {
        continue;
      }

      vertices.push(-halfSize, 0, k, halfSize, 0, k);
      vertices.push(k, 0, -halfSize, k, 0, halfSize);

      const color = i === center ? threeColors.primary : threeColors.secondary;

      color.toArray4(colorsArray, j);
      j += 4;
      color.toArray4(colorsArray, j);
      j += 4;
      color.toArray4(colorsArray, j);
      j += 4;
      color.toArray4(colorsArray, j);
      j += 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colorsArray, 4),
    );

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      toneMapped: false,
      transparent: true,
    });

    super(geometry, material);
  }

  dispose() {
    this.geometry.dispose();
    disposeMaterial(this.material);
  }
}

export class PlaneHelper extends THREE.Group {
  private gridHelper: GridHelper;
  private mesh: THREE.Mesh;

  constructor(
    normal: THREE.Vector3,
    point: THREE.Vector3,
    size: number,
    divisions: number,
    colors: Partial<Colors> = {},
  ) {
    super();

    const allColors = _.merge({}, defaultColorRepresentations, colors);
    this.gridHelper = new GridHelper(size, divisions, allColors.grid);
    this.add(this.gridHelper);

    const planeGeometry = new THREE.PlaneGeometry(
      size,
      size,
      divisions,
      divisions,
    );
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: allColors.plane,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: allColors.plane.a,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
    this.mesh.rotation.x = Math.PI / 2;
    this.add(this.mesh);

    this.position.copy(point);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    this.quaternion.copy(quaternion);
  }

  dispose() {
    this.gridHelper.dispose();
    this.mesh.geometry.dispose();
    disposeMaterial(this.mesh.material);
  }
}
