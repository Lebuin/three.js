import { Color4 } from '@/lib/util/color4';
import { THREE } from '@lib/three.js';
import * as settings from '../settings';

export interface GroundPlaneColors {
  xAxis: Color4;
  yAxis: Color4;
  majorDivision: Color4;
  minorDivision: Color4;
  plane: Color4;
}

export interface GroundPlaneOptions {
  minorDivision: number;
  majorDivision: number;
  colors: GroundPlaneColors;
}

const defaultGroundPlaneOptions = {
  majorDivision: 100,
  minorDivision: 10,
  colors: {
    xAxis: settings.axesColors.x.primary,
    yAxis: settings.axesColors.z.primary,
    majorDivision: new Color4().setHSLA(186 / 360, 28 / 100, 16 / 100, 0.2),
    minorDivision: new Color4().setHSLA(186 / 360, 28 / 100, 16 / 100, 0.1),
    plane: new Color4().setHSLA(186 / 360, 28 / 100, 16 / 100, 0.05),
  },
};

export class GroundPlaneHelper extends THREE.Group {
  constructor(
    start: THREE.Vector2,
    end: THREE.Vector2,
    options: Partial<GroundPlaneOptions> = {},
  ) {
    super();

    const fullOptions = { ...defaultGroundPlaneOptions, ...options };
    const grid = this.createGrid(start, end, fullOptions);
    const plane = this.createPlane(start, end, fullOptions.colors.plane);
    this.add(grid, plane);

    this.rotation.x = -Math.PI / 2;
    this.renderOrder = -100;
  }

  createGrid(
    start: THREE.Vector2,
    end: THREE.Vector2,
    options: GroundPlaneOptions,
  ) {
    if (options.majorDivision % options.minorDivision !== 0) {
      throw new Error('Major division must be a multiple of minor division');
    }

    const roundedStart = new THREE.Vector2(
      Math.floor(start.x / options.majorDivision) * options.majorDivision,
      Math.floor(start.y / options.majorDivision) * options.majorDivision,
    );
    const roundedEnd = new THREE.Vector2(
      Math.ceil(end.x / options.majorDivision) * options.majorDivision,
      Math.ceil(end.y / options.majorDivision) * options.majorDivision,
    );

    const numXLines =
      (roundedEnd.x - roundedStart.x) / options.minorDivision + 1;
    const numYLines =
      (roundedEnd.y - roundedStart.y) / options.minorDivision + 1;
    const numLines = numXLines + numYLines;
    const vertices = new Float32Array(numLines * 2 * 3);
    const colors = new Float32Array(numLines * 2 * 4);
    const minorTicks = options.majorDivision / options.minorDivision;

    let vertexIndex = 0;
    let colorIndex = 0;
    for (let i = 0; i < numXLines; i++) {
      const x = roundedStart.x + i * options.minorDivision;
      const color =
        x === 0
          ? options.colors.yAxis
          : i % minorTicks === 0
          ? options.colors.majorDivision
          : options.colors.minorDivision;
      vertices.set([x, roundedStart.y, 0, x, roundedEnd.y, 0], vertexIndex);
      colors.set([...color.toArray4(), ...color.toArray4()], colorIndex);
      vertexIndex += 2 * 3;
      colorIndex += 2 * 4;
    }

    for (let i = 0; i < numYLines; i++) {
      const y = roundedStart.y + i * options.minorDivision;
      const color =
        y === 0
          ? options.colors.xAxis
          : i % minorTicks === 0
          ? options.colors.majorDivision
          : options.colors.minorDivision;
      vertices.set([roundedStart.x, y, 0, roundedEnd.x, y, 0], vertexIndex);
      colors.set([...color.toArray4(), ...color.toArray4()], colorIndex);
      vertexIndex += 2 * 3;
      colorIndex += 2 * 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    const material = new THREE.LineBasicMaterial({
      transparent: true,
      vertexColors: true,
    });
    return new THREE.LineSegments(geometry, material);
  }

  createPlane(start: THREE.Vector2, end: THREE.Vector2, color: Color4) {
    const geometry = new THREE.PlaneGeometry(end.x - start.x, end.y - start.y);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      color: color,
      opacity: color.a,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.set((end.x + start.x) / 2, 0, (end.y + start.y) / 2);
    return plane;
  }
}
