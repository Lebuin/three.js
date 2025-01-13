import { getQuaternionFromAxes, vectorsAreParallel } from '@/lib/util/geometry';
import _ from 'lodash';
import * as THREE from 'three';
import { Color } from '../../util/color';
import { disposeMaterial } from '../../util/three';
import * as settings from '../settings';

export interface PartialPlaneHelperColors {
  plane: Color;
  edgeX: Color;
  edgeZ: Color;
}

const defaultColorRepresentations: PartialPlaneHelperColors = {
  plane: settings.axesColors.default.plane.clone().setA(0.15),
  edgeX: settings.axesColors.default.primary.clone().setA(0.5),
  edgeZ: settings.axesColors.default.primary.clone().setA(0.5),
} as const;

export class PartialPlaneHelper extends THREE.Group {
  private meshMaterial: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;
  private lineSegmentsMaterial: THREE.LineBasicMaterial;
  private lineSegments: THREE.LineSegments;

  private point = new THREE.Vector3(0, 0, 0);
  private colors: PartialPlaneHelperColors = defaultColorRepresentations;

  constructor(
    quaternion: THREE.Quaternion = new THREE.Quaternion(),
    origin: THREE.Vector3 = new THREE.Vector3(),
    point: THREE.Vector3 = new THREE.Vector3(),
    colors: Partial<PartialPlaneHelperColors> = {},
  ) {
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

    this.setColors(colors);
    this.setOrigin(origin);
    this.setQuaternion(quaternion);
    this.setPoint(point);
  }

  setOrigin(origin: THREE.Vector3) {
    this.position.copy(origin);
    this.setPoint(this.point);
  }

  setQuaternion(quaternion: THREE.Quaternion) {
    this.quaternion.copy(quaternion);
    this.setPoint(this.point);
  }

  setNormal(normal: THREE.Vector3) {
    const axisToConstructX = vectorsAreParallel(
      normal,
      new THREE.Vector3(0, 1, 0),
    )
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);

    const axisX = new THREE.Vector3().crossVectors(normal, axisToConstructX);
    const quaternion = getQuaternionFromAxes(axisX, normal, undefined);
    this.setQuaternion(quaternion);
  }

  setPoint(point: THREE.Vector3) {
    this.scale.set(1, 1, 1);
    const projectedPoint = this.worldToLocal(point.clone());
    this.scale.set(projectedPoint.x, 1, projectedPoint.z);
  }

  setColors(colors: Partial<PartialPlaneHelperColors>) {
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

  dispose() {
    this.mesh.geometry.dispose();
    disposeMaterial(this.mesh.material);
    this.lineSegments.geometry.dispose();
    disposeMaterial(this.lineSegments.material);
  }
}
