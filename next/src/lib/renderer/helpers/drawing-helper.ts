import { LineHelper } from '@/lib/renderer/helpers/line-helper';
import {
  PlaneHelper,
  PlaneHelperColors,
} from '@/lib/renderer/helpers/plane-helper';
import { PointHelper } from '@/lib/renderer/helpers/point-helper';
import { UpdatingObjectMixin } from '@/lib/renderer/helpers/updating-object-mixin';
import { Renderer } from '@/lib/renderer/renderer';
import * as settings from '@/lib/renderer/settings';
import { Color } from '@/lib/util/color';
import { Axis, isAxis } from '@/lib/util/geometry';
import * as THREE from 'three';

/**
 * A collection of a PlaneHelper, PointHelper and LineHelpers that aid in drawing.
 *
 * Each helper can be shown or hidden, and can be individually moved.
 */
export class DrawingHelper extends UpdatingObjectMixin(THREE.Group) {
  private planeHelper: PlaneHelper;
  private lineHelpers: LineHelper[] = [];
  private pointHelper: PointHelper;

  constructor() {
    super();
    this.planeHelper = new PlaneHelper();
    this.pointHelper = new PointHelper(12, 2, new Color(0.01, 0.01, 0.01));
    this.add(this.planeHelper, this.pointHelper);
  }

  dispose() {
    this.planeHelper.dispose();
    this.pointHelper.dispose();
    this.lineHelpers.forEach((lineHelper) => lineHelper.dispose());
  }

  update(renderer: Renderer) {
    this.pointHelper.update(renderer);
  }

  private helperIsVisible(helper: THREE.Object3D) {
    return helper.parent !== null;
  }

  ///
  // Plane helper

  hidePlane() {
    this.planeHelper.visible = false;
  }

  setPlanePosition(
    origin: THREE.Vector3,
    target: THREE.Vector3,
    plane: THREE.Plane,
  ) {
    this.planeHelper.visible = true;
    this.planeHelper.setOrigin(origin);
    this.planeHelper.setNormal(plane.normal);
    this.planeHelper.setPoint(target);

    const colors = this.getPlaneColors(this.planeHelper.quaternion);
    this.planeHelper.setColors(colors);
  }

  private getPlaneColors(quaternion: THREE.Quaternion): PlaneHelperColors {
    const planeAxesWorldDirection = {
      x: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
      z: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
    };

    const planeAxesToWorldAxes = {
      x: isAxis(planeAxesWorldDirection.x),
      z: isAxis(planeAxesWorldDirection.z),
    };

    const colors: PlaneHelperColors = {
      edgeX: this.getPlaneEdgeColor(planeAxesToWorldAxes.x),
      edgeZ: this.getPlaneEdgeColor(planeAxesToWorldAxes.z),
      plane: this.getPlaneColor(planeAxesToWorldAxes.x, planeAxesToWorldAxes.z),
    };
    return colors;
  }

  private getPlaneEdgeColor(axis: Axis | null) {
    if (axis == null) {
      return settings.axesColors.default.primary.clone().setA(0.5);
    } else {
      return settings.axesColors[axis].primary.clone().setA(0.5);
    }
  }

  private getPlaneColor(axisX: Axis | null, axisZ: Axis | null) {
    if (axisX == null || axisZ == null) {
      return settings.axesColors.default.plane.clone().setA(0.15);
    } else {
      return settings.axesColors[axisX].plane
        .clone()
        .lerp(settings.axesColors[axisZ].plane, 0.5)
        .setA(0.15);
    }
  }

  ///
  // Point helper

  hidePoint() {
    this.pointHelper.visible = false;
  }

  setPointPosition(position: THREE.Vector3) {
    this.pointHelper.visible = true;
    this.pointHelper.position.copy(position);
  }

  ///
  // Line helpers

  hideLines() {
    for (const lineHelper of this.lineHelpers) {
      this.remove(lineHelper);
      lineHelper.dispose();
    }
    this.lineHelpers = [];
  }

  setLines(lines: THREE.Line3[], target: THREE.Vector3) {
    while (lines.length > this.lineHelpers.length) {
      const lineHelper = new LineHelper(3);
      this.lineHelpers.push(lineHelper);
      this.add(lineHelper);
    }
    while (this.lineHelpers.length > lines.length) {
      const lineHelper = this.lineHelpers.pop();
      if (lineHelper) {
        this.remove(lineHelper);
        lineHelper.dispose();
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineHelper = this.lineHelpers[i];
      lineHelper.setPoints(line.start, target);
      const color = this.getLineColor(line);
      lineHelper.setColor(color);
    }
  }

  private getLineColor(line: THREE.Line3) {
    const direction = line.end.clone().sub(line.start);
    const axis = isAxis(direction);
    console.log(direction, axis);
    if (axis == null) {
      return new Color(0, 0, 0);
    } else {
      return settings.axesColors[axis].primary;
    }
  }
}
