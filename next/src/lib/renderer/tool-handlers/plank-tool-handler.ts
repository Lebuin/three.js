import { Plank } from '@/lib/model/parts/plank';
import { mouseButtonPressed } from '@/lib/util';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Renderer } from '../renderer';
import { ToolHandler } from './tool-handler';

type Axis = 'x' | 'y' | 'z';

interface PlankPoint {
  point: Vector3;
  centerAligned: boolean;
}

export class PlankToolHandler extends ToolHandler {
  private mouseEvent?: MouseEvent;
  private ctrlPressed = false;

  private fixedAxis?: Axis;
  private points: PlankPoint[] = [];
  private fleetingPoint?: PlankPoint;
  private fleetingPlank?: Plank;

  constructor(renderer: Renderer) {
    super(renderer);

    this.setupListeners();
  }

  dispose() {
    super.dispose();
    this.removeFleetingPlank();
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

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = true;
    } else if (event.key === 'ArrowRight') {
      this.fixedAxis = this.fixedAxis === 'x' ? undefined : 'x';
    } else if (event.key === 'ArrowUp') {
      this.fixedAxis = this.fixedAxis === 'y' ? undefined : 'y';
    } else if (event.key === 'ArrowLeft') {
      this.fixedAxis = this.fixedAxis === 'z' ? undefined : 'z';
    }

    if (this.mouseEvent) {
      this.updateFleetingPoint(this.mouseEvent);
      this.updateFleetingPlank();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control') {
      this.ctrlPressed = false;
    }
    if (this.mouseEvent) {
      this.updateFleetingPoint(this.mouseEvent);
      this.updateFleetingPlank();
    }
  };

  private onMouseMove = (event: MouseEvent) => {
    // Don't update the plank while the user is orbiting
    if (
      mouseButtonPressed(event, 'right') ||
      mouseButtonPressed(event, 'middle')
    ) {
      return;
    }

    this.ctrlPressed = event.ctrlKey;
    this.mouseEvent = event;

    this.updateFleetingPoint(event);
    this.updateFleetingPlank();
  };

  private onClick = (event: MouseEvent) => {
    this.ctrlPressed = event.ctrlKey;
    this.mouseEvent = event;

    this.updateFleetingPoint(event);
    if (!this.fleetingPoint) {
      return;
    }

    this.points.push(this.fleetingPoint);
    this.fleetingPoint = undefined;

    this.updateFleetingPlank();
    if (this.points.length === 4) {
      this.confirmPlank();
    }
  };

  private updateFleetingPoint(event: MouseEvent) {
    const plankPoint = this.getPointFromMouseEvent(event);
    if (plankPoint == null) {
      return;
    }
    this.fleetingPoint = plankPoint;
  }

  private isCenterAligned(_event: MouseEvent) {
    // We don't currently use _event, since we always copy event.ctrlKey into this.ctrlPressed. But
    // we may change this implementation in the future.
    return this.ctrlPressed;
  }

  private getPointFromMouseEvent(event: MouseEvent): PlankPoint | undefined {
    if (this.points.length === 0) {
      return this.getFirstPointFromMouseEvent(event);
    } else if (this.points.length === 1) {
      return this.getSecondPointFromMouseEvent(event);
    } else if (this.points.length === 2) {
      return this.getThirdPointFromMouseEvent(event);
    } else if (this.points.length === 3) {
      return this.getFourthPointFromMouseEvent(event);
    } else {
      throw new Error('Too many points');
    }
  }

  private getFirstPointFromMouseEvent(
    event: MouseEvent,
  ): PlankPoint | undefined {
    // TODO: make plane depend on camera direction
    const raycaster = this.renderer.getRaycaster(event);
    const plane = new THREE.Plane(
      this.getDominantPlaneNormal(raycaster.ray.direction),
      0,
    );
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (point == null) {
      return;
    }

    return {
      point: point,
      centerAligned: this.isCenterAligned(event),
    };
  }

  private getSecondPointFromMouseEvent(
    event: MouseEvent,
  ): PlankPoint | undefined {
    // TODO: make plane depend on camera direction
    const raycaster = this.renderer.getRaycaster(event);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      this.getDominantPlaneNormal(raycaster.ray.direction),
      this.points[0].point,
    );
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (point == null) {
      return;
    }

    return {
      point: point,
      centerAligned: this.isCenterAligned(event),
    };
  }

  private getThirdPointFromMouseEvent(
    event: MouseEvent,
  ): PlankPoint | undefined {
    const raycaster = this.renderer.getRaycaster(event);
    const normal = this.points[1].point
      .clone()
      .sub(this.points[0].point)
      .normalize();

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      this.points[1].point,
    );
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (point == null) {
      return;
    }

    return {
      point: point,
      centerAligned: this.isCenterAligned(event),
    };
  }

  private getFourthPointFromMouseEvent(
    event: MouseEvent,
  ): PlankPoint | undefined {
    const raycaster = this.renderer.getRaycaster(event);
    const materialThickness = 18;

    const intersectionPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      this.points[1].point.clone().sub(this.points[0].point).normalize(),
      this.points[1].point,
    );
    const intersection = raycaster.ray.intersectPlane(
      intersectionPlane,
      new THREE.Vector3(),
    );
    if (intersection == null) {
      return;
    }

    const plankPlane = new THREE.Plane().setFromCoplanarPoints(
      this.points[0].point,
      this.points[1].point,
      this.points[2].point,
    );
    const plankZAxis = plankPlane.normal.clone().normalize();
    const plankZLine = new THREE.Line3(
      this.points[2].point,
      this.points[2].point.clone().add(plankZAxis),
    );

    const signedDistance = plankZLine.closestPointToPointParameter(
      intersection,
      false,
    );

    if (
      Math.abs(signedDistance) < materialThickness ||
      this.isCenterAligned(event)
    ) {
      const point = this.points[2].point
        .clone()
        .add(plankZAxis.multiplyScalar(materialThickness / 2));
      return {
        point: point,
        centerAligned: true,
      };
    } else {
      const point = this.points[2].point
        .clone()
        .add(
          plankZAxis.multiplyScalar(
            Math.sign(signedDistance) * materialThickness,
          ),
        );
      return {
        point: point,
        centerAligned: false,
      };
    }
  }

  private getDominantPlaneNormal(direction: THREE.Vector3): THREE.Vector3 {
    const absDirection = new THREE.Vector3(
      Math.abs(direction.x),
      Math.abs(direction.y),
      Math.abs(direction.z),
    );
    const yPreference = 4;
    if (
      absDirection.y * yPreference >
      Math.max(absDirection.x, absDirection.z)
    ) {
      return new THREE.Vector3(0, 1, 0);
    } else if (absDirection.x > absDirection.z) {
      return new THREE.Vector3(1, 0, 0);
    } else {
      return new THREE.Vector3(0, 0, 1);
    }
  }

  private createFleetingPlank() {
    if (!this.fleetingPlank) {
      this.fleetingPlank = new Plank();
      this.model.addPart(this.fleetingPlank);
    }
    return this.fleetingPlank;
  }

  private removeFleetingPlank() {
    if (this.fleetingPlank) {
      this.model.removePart(this.fleetingPlank);
      this.fleetingPlank = undefined;
    }
  }

  private updateFleetingPlank() {
    const points = [...this.points];
    if (this.fleetingPoint) {
      points.push(this.fleetingPoint);
    }

    if (points.length === 0) {
      return;
    }
    while (points.length < 4) {
      points.push({
        point: points[points.length - 1].point.clone(),
        centerAligned: false,
      });
    }

    const plankSides = {
      x: points[1].point.clone().sub(points[0].point),
      y: points[2].point.clone().sub(points[1].point),
      z: points[3].point.clone().sub(points[2].point),
    };

    const position = points[0].point.clone();
    const size = new THREE.Vector3(
      points[0].point.distanceTo(points[1].point),
      points[1].point.distanceTo(points[2].point),
      points[2].point.distanceTo(points[3].point),
    );
    const quaternion = getQuaternionFromAxes(plankSides.x, plankSides.y);

    for (let i = 0; i < 3; i++) {
      const centerAligned = points[i + 1].centerAligned;
      if (centerAligned) {
        position.add(points[i].point.clone().sub(points[i + 1].point));
        const dimension = (['x', 'y', 'z'] as const)[i];
        size[dimension] *= 2;
      }
    }

    const plankZAxis = plankSides.x.clone().cross(plankSides.y).normalize();
    const zIsInverted = plankZAxis.dot(plankSides.z) < 0;
    if (zIsInverted) {
      position.add(points[3].point.clone().sub(points[2].point));
    }

    const fleetingPlank = this.createFleetingPlank();
    fleetingPlank.position = position;
    fleetingPlank.size = size;
    fleetingPlank.quaternion = quaternion;
  }

  private confirmPlank() {
    this.points = [];
    this.fleetingPoint = undefined;
    this.fleetingPlank = undefined;
  }
}
