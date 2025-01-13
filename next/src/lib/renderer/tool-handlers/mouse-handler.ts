import { mouseButtonPressed } from '@/lib/util';
import { Color } from '@/lib/util/color';
import {
  Axis,
  axisDirections,
  distanceBetweenLines,
  distanceToLine,
  intersectPlaneAndLine,
  intersectPlanes,
  isAxis,
} from '@/lib/util/geometry';
import * as THREE from 'three';
import {
  PartialPlaneHelper,
  PartialPlaneHelperColors,
} from '../helpers/partial-plane-helper';
import { PointHelper } from '../helpers/point-helper';
import { Renderer } from '../renderer';
import * as settings from '../settings';

type Pixels = number;

export interface MouseHandlerEvent {
  point: THREE.Vector3;
  ctrlPressed: boolean;
}
export interface MouseHandlerEvents {
  mousemove: MouseHandlerEvent;
  click: MouseHandlerEvent;
}

interface Target {
  target?: THREE.Vector3;
  snappedPoint?: THREE.Vector3;
  snappedLine?: THREE.Line3;
  plane?: THREE.Plane;
}

export class MouseHandler extends THREE.EventDispatcher<MouseHandlerEvents> {
  private renderer: Renderer;

  private mouseEvent?: MouseEvent;
  private ctrlPressed = false;
  private fixedAxis?: Axis;

  private _neighborPoint?: THREE.Vector3;
  private _constraintPlane?: THREE.Plane;
  private _constraintLine?: THREE.Line3;

  private preferredLines: THREE.Line3[] = [];
  private preferredPoints: THREE.Vector3[] = [];

  private planeHelper: PartialPlaneHelper;
  private pointHelper: PointHelper;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;
  private readonly snapThreshold: Pixels = 15;

  constructor(renderer: Renderer) {
    super();

    this.renderer = renderer;
    this.planeHelper = new PartialPlaneHelper();
    this.pointHelper = new PointHelper(12, 2, new Color(0.01, 0.01, 0.01));

    this.setupListeners();
    this.updatePreferredLines();
  }

  dispose() {
    this.hidePlaneHelper();
    this.planeHelper.dispose();
    this.removeListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.addEventListener('mousemove', this.onMouseMove);
    this.renderer.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.renderer.canvas.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.canvas.addEventListener('mouseleave', this.onMouseLeave);
    this.renderer.canvas.removeEventListener('click', this.onClick);
  }

  ///
  // Getters

  get neighborPoint() {
    return this._neighborPoint;
  }
  get constraintPlane() {
    return this._constraintPlane;
  }
  get constraintLine() {
    return this._constraintLine;
  }

  ///
  // Set constraints

  clearConstraints() {
    this._neighborPoint = undefined;
    this._constraintPlane = undefined;
    this._constraintLine = undefined;
    this.updatePreferredLines();
  }

  setNeighborPoint(point: THREE.Vector3) {
    this._neighborPoint = point;
    this.updatePreferredLines();
  }

  setConstraintPlane(normal: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      point,
    );
    this._constraintLine = undefined;
    this.updatePreferredLines();
  }

  setConstraintLine(direction: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintLine = new THREE.Line3(point, point.clone().add(direction));
    this._constraintPlane = undefined;
    this.updatePreferredLines();
  }

  private updatePreferredLines() {
    this.preferredLines = [];

    if (this.constraintLine) {
      // Do nothing
    } else if (this.constraintPlane) {
      if (!this.neighborPoint) {
        throw new Error('Neighbor point is not set');
      }

      // Add the lines that are parallel the axis planes
      for (const axisDirection of Object.values(axisDirections)) {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          axisDirection,
          this.neighborPoint,
        );
        const intersection = intersectPlanes(this.constraintPlane, plane);
        if (intersection) {
          this.preferredLines.push(intersection);
        }
      }

      // Add the line that points mostly upwards
      const YPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        this.neighborPoint,
      );
      const intersection = intersectPlanes(this.constraintPlane, YPlane);
      if (intersection) {
        const upDirection = intersection
          .delta(new THREE.Vector3())
          .cross(this.constraintPlane.normal);
        const upLine = new THREE.Line3(
          this.neighborPoint,
          this.neighborPoint.clone().add(upDirection),
        );
        this.preferredLines.push(upLine);
      }

      // Check if there are any axes that are coplanar with the constraint plane
      for (const axisDirection of Object.values(axisDirections)) {
        const line = new THREE.Line3(new THREE.Vector3(), axisDirection);
        if (
          Math.abs(this.constraintPlane.distanceToPoint(line.start)) < 1e-6 &&
          Math.abs(this.constraintPlane.distanceToPoint(line.end)) < 1e-6
        ) {
          this.preferredLines.push(line);
        }
      }
    } else {
      for (const axisDirection of Object.values(axisDirections)) {
        this.preferredLines.push(
          new THREE.Line3(new THREE.Vector3(), axisDirection.clone()),
        );
        if (this.neighborPoint) {
          this.preferredLines.push(
            new THREE.Line3(
              this.neighborPoint.clone(),
              this.neighborPoint.clone().add(axisDirection),
            ),
          );
        }
      }
    }
    this.updatePreferredPoints();
  }

  private updatePreferredPoints() {
    this.preferredPoints = [];

    const origin = new THREE.Vector3();
    if (this.constraintLine) {
      for (const axisDirection of Object.values(axisDirections)) {
        const line = new THREE.Line3(origin, axisDirection);
        const intersection = new THREE.Vector3();
        const distance = distanceBetweenLines(
          this.constraintLine,
          line,
          intersection,
        );
        if (distance < 1e-6) {
          this.addPreferredPoint(intersection);
        }
      }
    } else if (this.constraintPlane) {
      for (const axisDirection of Object.values(axisDirections)) {
        // TODO: check if line and plane are coplanar
        const line = new THREE.Line3(origin, axisDirection);
        const intersection = intersectPlaneAndLine(
          this.constraintPlane,
          line,
          new THREE.Vector3(),
        );
        if (intersection) {
          this.addPreferredPoint(intersection);
        }
      }
    }

    for (let i = 0; i < this.preferredLines.length; i++) {
      for (let j = i + 1; j < this.preferredLines.length; j++) {
        const point = new THREE.Vector3();
        const distance = distanceBetweenLines(
          this.preferredLines[i],
          this.preferredLines[j],
          point,
        );
        if (distance < 1e-6) {
          this.addPreferredPoint(point);
        }
      }
    }
  }

  private addPreferredPoint(point: THREE.Vector3) {
    if (!(this.neighborPoint && point.distanceTo(this.neighborPoint) < 1e-6)) {
      this.preferredPoints.push(point);
    }
  }

  ///
  // Plane helper

  private get planeHelperIsVisible() {
    return this.planeHelper.parent !== null;
  }

  private showPlaneHelper() {
    if (!this.planeHelperIsVisible) {
      this.renderer.add(this.planeHelper);
    }
  }

  private hidePlaneHelper() {
    if (this.planeHelperIsVisible) {
      this.renderer.remove(this.planeHelper);
    }
  }

  private setPlaneHelperTarget(target: THREE.Vector3, plane: THREE.Plane) {
    this.planeHelper.setOrigin(this.neighborPoint ?? new THREE.Vector3());
    this.planeHelper.setNormal(plane.normal);
    this.planeHelper.setPoint(target);

    const colors = this.getPlaneHelperColors(this.planeHelper.quaternion);
    this.planeHelper.setColors(colors);
  }

  private getPlaneHelperColors(
    quaternion: THREE.Quaternion,
  ): PartialPlaneHelperColors {
    const planeAxesWorldDirection = {
      x: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
      z: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
    };

    const planeAxesToWorldAxes = {
      x: isAxis(planeAxesWorldDirection.x),
      z: isAxis(planeAxesWorldDirection.z),
    };

    const colors: PartialPlaneHelperColors = {
      edgeX: this.getPlaneHelperEdgeColor(planeAxesToWorldAxes.x),
      edgeZ: this.getPlaneHelperEdgeColor(planeAxesToWorldAxes.z),
      plane: this.getPlaneHelperPlaneColor(
        planeAxesToWorldAxes.x,
        planeAxesToWorldAxes.z,
      ),
    };
    return colors;
  }

  private getPlaneHelperEdgeColor(axis: Axis | null) {
    if (axis == null) {
      return settings.axesColors.default.primary.clone().setA(0.5);
    } else {
      return settings.axesColors[axis].primary.clone().setA(0.5);
    }
  }

  private getPlaneHelperPlaneColor(axisX: Axis | null, axisZ: Axis | null) {
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

  private get pointHelperIsVisible() {
    return this.pointHelper.parent !== null;
  }

  showPointHelper() {
    if (!this.pointHelperIsVisible) {
      this.renderer.addUpdating(this.pointHelper);
    }
  }

  hidePointHelper() {
    if (this.pointHelperIsVisible) {
      this.renderer.removeUpdating(this.pointHelper);
    }
  }

  setPointHelperPosition(position: THREE.Vector3) {
    this.pointHelper.position.copy(position);
  }

  ///
  // Handle events

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = true;
    } else if (event.key === 'ArrowRight') {
      this.fixedAxis = this.fixedAxis === 'x' ? undefined : 'x';
    } else if (event.key === 'ArrowUp') {
      this.fixedAxis = this.fixedAxis === 'y' ? undefined : 'y';
    } else if (event.key === 'ArrowLeft') {
      this.fixedAxis = this.fixedAxis === 'z' ? undefined : 'z';
    } else {
      return;
    }

    this.dispatchMouseEvent();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = false;
    } else {
      return;
    }

    this.dispatchMouseEvent();
  };

  private onMouseMove = (event: MouseEvent) => {
    // Don't handle mouse events while the user is orbiting
    if (
      mouseButtonPressed(event, 'right') ||
      mouseButtonPressed(event, 'middle')
    ) {
      return;
    }

    this.mouseEvent = event;
    this.ctrlPressed = event.ctrlKey;

    this.dispatchMouseEvent();
  };

  private onClick = (event: MouseEvent) => {
    this.mouseEvent = event;
    this.ctrlPressed = event.ctrlKey;

    this.dispatchMouseEvent('click');
  };

  private onMouseLeave = () => {
    this.hidePlaneHelper();
  };

  ///
  // Raycasting

  private dispatchMouseEvent(type: 'mousemove' | 'click' = 'mousemove') {
    if (!this.mouseEvent) {
      return;
    }

    const { target, plane, snappedPoint } = this.getTargetFromEvent(
      this.mouseEvent,
    );
    if (target) {
      this.dispatchEvent({
        type,
        point: target,
        ctrlPressed: this.ctrlPressed,
      });
    }

    if (target && snappedPoint) {
      this.showPointHelper();
      this.setPointHelperPosition(snappedPoint);
    } else {
      this.hidePointHelper();
    }

    if (target && plane) {
      this.showPlaneHelper();
      this.setPlaneHelperTarget(target, plane);
    } else {
      this.hidePlaneHelper();
    }
  }

  getTargetFromEvent(event: MouseEvent): Target {
    if (this.constraintLine) {
      return this.getTargetOnLine(event, this.constraintLine);
    } else if (this.constraintPlane) {
      return this.getTargetOnPlane(event, this.constraintPlane);
    } else {
      return this.getTargetNearPoint(event, this.neighborPoint);
    }
  }

  getTargetNearPoint(event: MouseEvent, point = new THREE.Vector3()): Target {
    const raycaster = this.getRaycaster(event);

    const pointTarget = this.snapToPoints(event, this.preferredPoints);
    if (pointTarget) {
      // TODO: try to match to an axis plane?
      return {
        target: pointTarget,
        snappedPoint: pointTarget,
      };
    }

    const { target: lineTarget, line } = this.snapToLines(
      event,
      this.preferredLines,
    );
    if (lineTarget) {
      return {
        target: lineTarget,
        snappedLine: line,
      };
    }

    const planeNormal = this.getDominantPlaneNormal(raycaster.ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  getTargetOnPlane(event: MouseEvent, plane: THREE.Plane): Target {
    const pointTarget = this.snapToPoints(event, this.preferredPoints);
    if (pointTarget) {
      return {
        target: pointTarget,
        snappedPoint: pointTarget,
        plane,
      };
    }

    const { target: lineTarget, line } = this.snapToLines(
      event,
      this.preferredLines,
    );
    if (lineTarget) {
      return {
        target: lineTarget,
        snappedLine: line,
        plane,
      };
    }

    const raycaster = this.getRaycaster(event);
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  getTargetOnLine(event: MouseEvent, line: THREE.Line3): Target {
    const pointTarget = this.snapToPoints(event, this.preferredPoints);
    if (pointTarget) {
      return {
        target: pointTarget,
        snappedPoint: pointTarget,
      };
    }

    const raycaster = this.getRaycaster(event);
    const target = new THREE.Vector3();
    distanceToLine(raycaster.ray, line, undefined, target);
    return {
      target,
      snappedLine: line,
    };
  }

  private getRaycaster(event: MouseEvent) {
    return this.renderer.getRaycaster(event);
  }

  private snapToPoints(
    event: MouseEvent,
    points: THREE.Vector3[],
  ): THREE.Vector3 | undefined {
    for (const point of points) {
      const target = this.snapToPoint(event, point);
      if (target) {
        return target;
      }
    }
  }

  private snapToPoint(
    event: MouseEvent,
    point: THREE.Vector3,
  ): THREE.Vector3 | undefined {
    const raycaster = this.getRaycaster(event);
    const distance = raycaster.ray.distanceToPoint(point);
    const snapDistance = this.getSnapDistance();
    if (distance < snapDistance) {
      return point;
    }
  }

  private snapToLines(
    event: MouseEvent,
    lines: THREE.Line3[],
  ): { target?: THREE.Vector3; line?: THREE.Line3 } {
    for (const line of lines) {
      const target = this.snapToLine(event, line);
      if (target) {
        return { target, line };
      }
    }
    return {};
  }

  private snapToLine(
    event: MouseEvent,
    line: THREE.Line3,
  ): THREE.Vector3 | undefined {
    const raycaster = this.getRaycaster(event);
    const target = new THREE.Vector3();
    const distance = distanceToLine(raycaster.ray, line, undefined, target);
    const snapDistance = this.getSnapDistance();
    if (distance < snapDistance) {
      return target;
    }
  }

  private getSnapDistance() {
    return this.snapThreshold * this.renderer.getPixelSize();
  }

  private getDominantPlaneNormal(
    direction: THREE.Vector3,
    normals: THREE.Vector3[] = Object.values(axisDirections),
  ): THREE.Vector3 {
    if (normals.length === 0) {
      throw new Error('No normals provided');
    } else if (normals.length === 1) {
      return normals[0];
    }

    const absDirection = new THREE.Vector3(
      Math.abs(direction.x),
      Math.abs(direction.y) * this.dominantPlaneYPreference,
      Math.abs(direction.z),
    );
    const absNormals = normals.map((normal) => {
      return new THREE.Vector3(
        Math.abs(normal.x),
        Math.abs(normal.y),
        Math.abs(normal.z),
      );
    });

    const angles = absNormals.map((normal) => {
      return normal.angleTo(absDirection);
    });

    const minAngle = Math.min(...angles);
    return normals[angles.indexOf(minAngle)];
  }
}
