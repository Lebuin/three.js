import { Plank } from '@/lib/model/parts/plank';
import { getQuaternionFromAxes } from '@/lib/util/geometry';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Renderer } from '../renderer';
import { MouseHandler, MouseHandlerEvent } from './mouse-handler';
import { ToolHandler } from './tool-handler';

interface PlankPoint {
  point: Vector3;
  centerAligned: boolean;
}

export class PlankToolHandler extends ToolHandler {
  private mouseHandler: MouseHandler;

  private points: PlankPoint[] = [];
  private fleetingPoint?: PlankPoint;
  private fleetingPlank?: Plank;

  constructor(renderer: Renderer) {
    super(renderer);

    this.mouseHandler = new MouseHandler(renderer);

    this.setupListeners();
  }

  dispose() {
    super.dispose();
    this.mouseHandler.dispose();
    this.removeFleetingPlank();
    this.removeListeners();
  }

  private setupListeners() {
    this.mouseHandler.addEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.addEventListener('click', this.onClick);
  }

  private removeListeners() {
    this.mouseHandler.removeEventListener('mousemove', this.onMouseMove);
    this.mouseHandler.removeEventListener('click', this.onClick);
  }

  private onMouseMove = (event: MouseHandlerEvent) => {
    this.fleetingPoint = this.createPlankPoint(event);
    this.updateFleetingPlank();
  };

  private onClick = (event: MouseHandlerEvent) => {
    const plankPoint = this.createPlankPoint(event);
    this.points.push(plankPoint);
    this.fleetingPoint = undefined;

    this.updateFleetingPlank();
    this.mouseHandler.setNeighborPoint(plankPoint.point);

    if (this.points.length === 2) {
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        this.points[1].point.clone().sub(this.points[0].point).normalize(),
        this.points[1].point,
      );
      this.mouseHandler.setConstraintPlane(plane);
    } else if (this.points.length === 3) {
      const plankPlane = new THREE.Plane().setFromCoplanarPoints(
        this.points[0].point,
        this.points[1].point,
        this.points[2].point,
      );
      const line = new THREE.Line3(
        this.points[2].point,
        this.points[2].point.clone().add(plankPlane.normal),
      );
      this.mouseHandler.setConstraintLine(line);
    } else if (this.points.length === 4) {
      this.mouseHandler.clearConstraints();
      this.confirmPlank();
    }
  };

  private createPlankPoint(event: MouseHandlerEvent) {
    if (this.points.length < 3) {
      return {
        point: event.point,
        centerAligned: this.isCenterAligned(event),
      };
    } else {
      return this.getFourthPoint(event);
    }
  }

  /**
   * Get the line on which the 3rd and 4th points of the plank must lie. This can only be
   * calculated once the first 3 points are set.
   */
  private getZLine() {
    if (this.points.length < 3) {
      throw new Error(
        "The plank's Z line is only defined when the first 3 points are set",
      );
    }

    const plankPlane = new THREE.Plane().setFromCoplanarPoints(
      this.points[0].point,
      this.points[1].point,
      this.points[2].point,
    );
    const zLine = new THREE.Line3(
      this.points[2].point,
      this.points[2].point.clone().add(plankPlane.normal),
    );
    return zLine;
  }

  private getFourthPoint(event: MouseHandlerEvent) {
    const materialThickness = 18;
    const zLine = this.getZLine();
    const zAxis = zLine.delta(new THREE.Vector3());
    const signedDistance = zLine.closestPointToPointParameter(
      event.point,
      false,
    );

    if (
      Math.abs(signedDistance) < materialThickness ||
      this.isCenterAligned(event)
    ) {
      const point = this.points[2].point
        .clone()
        .add(zAxis.clone().multiplyScalar(materialThickness / 2));
      return {
        point: point,
        centerAligned: true,
      };
    } else {
      const point = this.points[2].point
        .clone()
        .add(
          zAxis
            .clone()
            .multiplyScalar(Math.sign(signedDistance) * materialThickness),
        );
      return {
        point: point,
        centerAligned: false,
      };
    }
  }

  private isCenterAligned(event: MouseHandlerEvent) {
    return event.ctrlPressed;
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
    this.renderer.setTool('select');
  }
}
