import { mouseButtonPressed } from '@/lib/util';
import { distanceToLine, intersectPlanes } from '@/lib/util/geometry';
import * as THREE from 'three';
import { Renderer } from '../renderer';

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
  private readonly snapThreshold: Pixels = 10;

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 4;

  constructor(renderer: Renderer) {
    super();

    this.renderer = renderer;

    this.setupListeners();
  }

  dispose() {
    this.removeListeners();
  }

  private setupListeners() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.addEventListener('mousemove', this.onMouseMove);
    this.renderer.canvas.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.renderer.canvas.removeEventListener('mousemove', this.onMouseMove);
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
        return new THREE.Line3(this.neighborPoint, direction);
      });
    }
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

  ///
  // Raycasting

  private dispatchMouseEvent(type: 'mousemove' | 'click' = 'mousemove') {
    const point = this.getPointFromEvent(this.mouseEvent!);
    if (point) {
      this.dispatchEvent({ type, point, ctrlPressed: this.ctrlPressed });
    }
  }

  getPointFromEvent(event: MouseEvent) {
    if (this.constraintLine) {
      return this.getPointOnLine(event, this.constraintLine);
    } else if (this.constraintPlane) {
      return this.getPointOnPlane(event, this.constraintPlane);
    } else {
      return this.getPointNearPoint(event, this.neighborPoint);
    }
  }

  getPointOnLine(event: MouseEvent, line: THREE.Line3) {
    const raycaster = this.getRaycaster(event);
    const pointOnLine = new THREE.Vector3();
    distanceToLine(raycaster.ray, line, undefined, pointOnLine);
    return pointOnLine;
  }

  getPointOnPlane(event: MouseEvent, plane: THREE.Plane) {
    // TODO: use this.preferredLines
    const raycaster = this.getRaycaster(event);
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return point;
  }

  getPointNearPoint(event: MouseEvent, point: THREE.Vector3) {
    // TODO: use this.preferredLines
    const raycaster = this.getRaycaster(event);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      this.getDominantPlaneNormal(raycaster.ray.direction),
      point,
    );
    const pointOnPlane = raycaster.ray.intersectPlane(
      plane,
      new THREE.Vector3(),
    );
    return pointOnPlane;
  }

  private getRaycaster(event: MouseEvent) {
    return this.renderer.getRaycaster(event);
  }

  private getDominantPlaneNormal(direction: THREE.Vector3): THREE.Vector3 {
    const absDirection = new THREE.Vector3(
      Math.abs(direction.x),
      Math.abs(direction.y),
      Math.abs(direction.z),
    );
    if (
      absDirection.y * this.dominantPlaneYPreference >
      Math.max(absDirection.x, absDirection.z)
    ) {
      return new THREE.Vector3(0, 1, 0);
    } else if (absDirection.x > absDirection.z) {
      return new THREE.Vector3(1, 0, 0);
    } else {
      return new THREE.Vector3(0, 0, 1);
    }
  }
}
