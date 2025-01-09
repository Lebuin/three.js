import { mouseButtonPressed } from '@/lib/util';
import { distanceToLine, intersectPlanes } from '@/lib/util/geometry';
import * as THREE from 'three';
import {
  PartialPlaneHelper,
  PartialPlaneHelperColors,
} from '../helpers/partial-plane-helper';
import { Renderer } from '../renderer';
import * as settings from '../settings';

type Pixels = number;

const axisDirections = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const;
type Axis = keyof typeof axisDirections;

export interface MouseHandlerEvent {
  point: THREE.Vector3;
  ctrlPressed: boolean;
}
export interface MouseHandlerEvents {
  mousemove: MouseHandlerEvent;
  click: MouseHandlerEvent;
}

export class MouseHandler extends THREE.EventDispatcher<MouseHandlerEvents> {
  private renderer: Renderer;

  private mouseEvent?: MouseEvent;
  private ctrlPressed = false;
  private fixedAxis?: Axis;

  private _neighborPoint = new THREE.Vector3();
  private _constraintPlane?: THREE.Plane;
  private _constraintLine?: THREE.Line3;

  private preferredLines: THREE.Line3[] = [];
  private readonly snapThreshold: Pixels = 20;

  private planeHelper: PartialPlaneHelper;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;

  constructor(renderer: Renderer) {
    super();

    this.renderer = renderer;
    this.planeHelper = new PartialPlaneHelper();

    this.setupListeners();
    this.updatePreferredAxes();
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
    this._neighborPoint = new THREE.Vector3();
    this._constraintPlane = undefined;
    this._constraintLine = undefined;
    this.updatePreferredAxes();
  }

  setNeighborPoint(point: THREE.Vector3) {
    this._neighborPoint = point;
    this.updatePreferredAxes();
  }

  setConstraintPlane(plane: THREE.Plane) {
    this._constraintPlane = plane;
    this._constraintLine = undefined;
    this.updatePreferredAxes();
  }

  setConstraintLine(line: THREE.Line3) {
    this._constraintLine = line;
    this._constraintPlane = undefined;
    this.updatePreferredAxes();
  }

  private updatePreferredAxes() {
    if (this.constraintLine) {
      this.preferredLines = [];
    } else if (this.constraintPlane) {
      this.preferredLines = [];
      for (const axisDirection of Object.values(axisDirections)) {
        const axisPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          axisDirection,
          this.neighborPoint,
        );
        const intersection = intersectPlanes(this.constraintPlane, axisPlane);
        if (intersection) {
          this.preferredLines.push(intersection);
        }
      }
    } else {
      this.preferredLines = Object.values(axisDirections).map((direction) => {
        return new THREE.Line3(
          this.neighborPoint,
          this.neighborPoint.clone().add(direction),
        );
      });
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
    this.planeHelper.setOrigin(this.neighborPoint);
    this.planeHelper.setNormal(plane.normal);
    this.planeHelper.setPoint(target);
    const colors = this.getPlaneHelperColors(plane);
    this.planeHelper.setColors(colors);
  }

  private getPlaneHelperColors(plane: THREE.Plane): PartialPlaneHelperColors {
    let colorSettings = settings.axesColors.default;
    const normal = plane.normal;
    const absNormal = new THREE.Vector3(
      Math.abs(normal.x),
      Math.abs(normal.y),
      Math.abs(normal.z),
    );
    if (absNormal.angleTo(new THREE.Vector3(1, 0, 0)) < 1e-6) {
      colorSettings = settings.axesColors.x;
    } else if (absNormal.angleTo(new THREE.Vector3(0, 1, 0)) < 1e-6) {
      colorSettings = settings.axesColors.y;
    } else if (absNormal.angleTo(new THREE.Vector3(0, 0, 1)) < 1e-6) {
      colorSettings = settings.axesColors.z;
    }

    return {
      edge: colorSettings.primary.setA(0.5),
      plane: colorSettings.plane.setA(0.15),
    };
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

    const [target, plane] = this.getTargetFromEvent(this.mouseEvent);
    if (target) {
      this.dispatchEvent({
        type,
        point: target,
        ctrlPressed: this.ctrlPressed,
      });
    }
    if (target && plane) {
      this.showPlaneHelper();
      this.setPlaneHelperTarget(target, plane);
    } else {
      this.hidePlaneHelper();
    }
  }

  getTargetFromEvent(
    event: MouseEvent,
  ): [THREE.Vector3 | undefined, THREE.Plane | undefined] {
    if (this.constraintLine) {
      return this.getTargetOnLine(event, this.constraintLine);
    } else if (this.constraintPlane) {
      return this.getTargetOnPlane(event, this.constraintPlane);
    } else {
      return this.getTargetNearPoint(event, this.neighborPoint);
    }
  }

  getTargetOnLine(
    event: MouseEvent,
    line: THREE.Line3,
  ): [THREE.Vector3 | undefined, THREE.Plane | undefined] {
    const raycaster = this.getRaycaster(event);
    const target = new THREE.Vector3();
    distanceToLine(raycaster.ray, line, undefined, target);
    return [target, undefined];
  }

  getTargetOnPlane(
    event: MouseEvent,
    plane: THREE.Plane,
  ): [THREE.Vector3 | undefined, THREE.Plane | undefined] {
    const lineTarget = this.snapToLines(event, this.preferredLines);
    if (lineTarget) {
      return [lineTarget, plane];
    }

    const raycaster = this.getRaycaster(event);
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return [target, plane];
  }

  getTargetNearPoint(
    event: MouseEvent,
    point: THREE.Vector3,
  ): [THREE.Vector3 | undefined, THREE.Plane | undefined] {
    const raycaster = this.getRaycaster(event);

    const lineTarget = this.snapToLines(event, this.preferredLines);
    if (lineTarget) {
      return [lineTarget, undefined];
    }

    const planeNormal = this.getDominantPlaneNormal(raycaster.ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target =
      raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return [target, plane];
  }

  private getRaycaster(event: MouseEvent) {
    return this.renderer.getRaycaster(event);
  }

  private snapToLines(
    event: MouseEvent,
    lines: THREE.Line3[],
  ): THREE.Vector3 | undefined {
    for (const line of lines) {
      const target = this.snapToLine(event, line);
      if (target) {
        return target;
      }
    }
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
    // The size in pixels of 1 unit in the world
    const pixelSize =
      (this.renderer.camera.top - this.renderer.camera.bottom) /
      this.renderer.canvas.clientHeight /
      this.renderer.camera.zoom;
    return this.snapThreshold * pixelSize;
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
