import { getQuaternionFromNormal } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { Color4 } from '../../util/color4';
import { disposeObject } from '../../util/three';
import * as settings from '../settings';

export interface PlaneHelperRect {
  start: THREE.Vector3;
  end: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface PlaneHelperColors {
  plane: Color4;
  edgeX: Color4;
  edgeZ: Color4;
}

const defaultColorRepresentations: PlaneHelperColors = {
  plane: settings.axesColors.default.plane.clone().setA(0.15),
  edgeX: settings.axesColors.default.primary.clone().setA(0.5),
  edgeZ: settings.axesColors.default.primary.clone().setA(0.5),
} as const;

export class PlaneHelper extends THREE.Group {
  private meshMaterial: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;
  private lineSegmentsMaterial: THREE.LineBasicMaterial;
  private lineSegments: THREE.LineSegments;

  private colors: PlaneHelperColors = defaultColorRepresentations;

  constructor() {
    super();

    const group = new THREE.Group();
    group.rotation.x = Math.PI / 2;
    group.position.set(0.5, 0, 0.5);
    this.add(group);

    const planeGeometry = new THREE.PlaneGeometry();

    this.meshMaterial = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    });
    this.mesh = new THREE.Mesh(planeGeometry, this.meshMaterial);
    group.add(this.mesh);

    const edgesGeometry = new THREE.EdgesGeometry(planeGeometry);
    this.lineSegmentsMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      vertexColors: true,
    });
    this.lineSegments = new THREE.LineSegments(
      edgesGeometry,
      this.lineSegmentsMaterial,
    );
    group.add(this.lineSegments);
  }

  dispose() {
    disposeObject(this.mesh);
    disposeObject(this.lineSegments);
  }

  setRect(rect: PlaneHelperRect) {
    this.position.copy(rect.start);

    const quaternion = getQuaternionFromNormal(rect.normal);
    this.quaternion.copy(quaternion);

    this.scale.set(1, 1, 1);
    const projectedPoint = this.worldToLocal(rect.end.clone());
    this.scale.set(projectedPoint.x, 1, projectedPoint.z);
  }

  setColors(colors: Partial<PlaneHelperColors>) {
    this.colors = _.merge({}, this.colors, colors);

    this.meshMaterial.color = this.colors.plane;
    this.meshMaterial.opacity = this.colors.plane.a;
    this.meshMaterial.needsUpdate = true;

    const edgeColors = [
      ...this.colors.edgeZ.toArray4(),
      ...this.colors.edgeZ.toArray4(),
      ...this.colors.edgeX.toArray4(),
      ...this.colors.edgeX.toArray4(),
      ...this.colors.edgeX.toArray4(),
      ...this.colors.edgeX.toArray4(),
      ...this.colors.edgeZ.toArray4(),
      ...this.colors.edgeZ.toArray4(),
    ];
    this.lineSegments.geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(edgeColors, 4),
    );
  }
}
