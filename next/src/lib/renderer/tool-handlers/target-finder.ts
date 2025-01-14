import {
  axisDirections,
  distanceBetweenLines,
  distanceToLine,
  intersectPlaneAndLine,
  intersectPlanes,
  Pixels,
} from '@/lib/util/geometry';
import * as THREE from 'three';

interface PreferredPoint {
  point: THREE.Vector3;
  lines?: THREE.Line3[];
}

export interface Target {
  target?: THREE.Vector3;
  snappedPoint?: PreferredPoint;
  snappedLine?: THREE.Line3;
  plane?: THREE.Plane;
}

/**
 * Find a target point in the scene based on a ray (typically from a mouse event), optionally
 * constrained to a plane or line.
 *
 * - When no constraints are set, the target point will lie on one of the primary planes. It will
 *   snap to the axes, and to points and lines in the scene (TODO).
 * - When a neighbour point is set, the target point will lie in a plane that is parallel to the
 *   primary planes and that goes through the neighbour point, unless the target point is snapping
 *   to another point or line.
 * - When a plane constraint is set, the target point is guaranteed to lie in that plane. It will
 *   still snap to lines and points in the scene that intersect this plane.
 * - When a line constraint is set, the target point is guaranteed to lie on that line. It will
 *   still snap to points and lines in the scene that intersect this line.
 */
export class TargetFinder {
  private _neighborPoint?: THREE.Vector3;
  private _constraintPlane?: THREE.Plane;
  private _constraintLine?: THREE.Line3;

  private preferredLines: THREE.Line3[] = [];
  private preferredPoints: PreferredPoint[] = [];

  // When determining the plane to constrain to, the XZ plane is given a preference, meaning that
  // if the camera is rotated equally towards all planes, the XZ plane will be chosen. This number
  // determines how significant this preference is. 1 = no preference, higher number = higher
  // preference.
  private readonly dominantPlaneYPreference = 2.5;
  private readonly snapThreshold: Pixels = 15;

  constructor() {
    this.updatePreferred();
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
    this.updatePreferred();
  }

  setNeighborPoint(point: THREE.Vector3) {
    this._neighborPoint = point;
    this.updatePreferred();
  }

  setConstraintPlane(normal: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      point,
    );
    this._constraintLine = undefined;
    this.updatePreferred();
  }

  setConstraintLine(direction: THREE.Vector3, point: THREE.Vector3) {
    this._neighborPoint = point;
    this._constraintLine = new THREE.Line3(point, point.clone().add(direction));
    this._constraintPlane = undefined;
    this.updatePreferred();
  }

  private updatePreferred() {
    this.updatePreferredLines();
    this.updatePreferredPoints();
  }

  private updatePreferredLines() {
    this.preferredLines = [];

    if (this.constraintLine) {
      // Do nothing
    } else if (this.constraintPlane) {
      if (!this.neighborPoint) {
        throw new Error('Neighbor point is not set');
      }

      // Add the lines that are parallel to the axis planes
      for (const axisDirection of Object.values(axisDirections)) {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          axisDirection,
          this.neighborPoint,
        );
        const intersection = intersectPlanes(this.constraintPlane, plane);
        if (intersection) {
          const line = new THREE.Line3(
            this.neighborPoint,
            this.neighborPoint
              .clone()
              .add(intersection.delta(new THREE.Vector3())),
          );
          this.preferredLines.push(line);
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
          this.addPreferredPoint(intersection, [this.constraintLine, line]);
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
          const secondLine = new THREE.Line3(this.neighborPoint, intersection);
          this.addPreferredPoint(intersection, [line, secondLine]);
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
          this.addPreferredPoint(point, [
            this.preferredLines[i],
            this.preferredLines[j],
          ]);
        }
      }
    }
  }

  private addPreferredPoint(point: THREE.Vector3, lines?: THREE.Line3[]) {
    if (!(this.neighborPoint && point.distanceTo(this.neighborPoint) < 1e-6)) {
      this.preferredPoints.push({ point, lines });
    }
  }

  ///
  // Find targets

  findTarget(ray: THREE.Ray, pixelSize: Pixels): Target {
    if (this.constraintLine) {
      return this.getTargetOnLine(ray, this.constraintLine, pixelSize);
    } else if (this.constraintPlane) {
      return this.getTargetOnPlane(ray, this.constraintPlane, pixelSize);
    } else {
      return this.getTargetNearPoint(
        ray,
        this.neighborPoint ?? new THREE.Vector3(),
        pixelSize,
      );
    }
  }

  getTargetNearPoint(
    ray: THREE.Ray,
    point: THREE.Vector3,
    pixelSize: Pixels,
  ): Target {
    const pointTarget = this.snapToPoints(ray, this.preferredPoints, pixelSize);
    if (pointTarget) {
      // TODO: try to match to an axis plane?
      return {
        target: pointTarget.point,
        snappedPoint: pointTarget,
      };
    }

    const { target: lineTarget, line } = this.snapToLines(
      ray,
      this.preferredLines,
      pixelSize,
    );
    if (lineTarget) {
      return {
        target: lineTarget,
        snappedLine: line,
      };
    }

    const planeNormal = this.getDominantPlaneNormal(ray.direction);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      point,
    );
    const target = ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  getTargetOnPlane(
    ray: THREE.Ray,
    plane: THREE.Plane,
    pixelSize: Pixels,
  ): Target {
    const pointTarget = this.snapToPoints(ray, this.preferredPoints, pixelSize);
    if (pointTarget) {
      return {
        target: pointTarget.point,
        snappedPoint: pointTarget,
        plane,
      };
    }

    const { target: lineTarget, line } = this.snapToLines(
      ray,
      this.preferredLines,
      pixelSize,
    );
    if (lineTarget) {
      return {
        target: lineTarget,
        snappedLine: line,
        plane,
      };
    }

    const target = ray.intersectPlane(plane, new THREE.Vector3()) ?? undefined;
    return {
      target,
      plane,
    };
  }

  getTargetOnLine(
    ray: THREE.Ray,
    line: THREE.Line3,
    pixelSize: Pixels,
  ): Target {
    const pointTarget = this.snapToPoints(ray, this.preferredPoints, pixelSize);
    if (pointTarget) {
      return {
        target: pointTarget.point,
        snappedPoint: pointTarget,
      };
    }

    const target = new THREE.Vector3();
    distanceToLine(ray, line, undefined, target);
    return {
      target,
    };
  }

  private snapToPoints(
    ray: THREE.Ray,
    points: PreferredPoint[],
    pixelSize: Pixels,
  ): PreferredPoint | undefined {
    for (const point of points) {
      const target = this.snapToPoint(ray, point, pixelSize);
      if (target) {
        return target;
      }
    }
  }

  private snapToPoint(
    ray: THREE.Ray,
    point: PreferredPoint,
    pixelSize: Pixels,
  ): PreferredPoint | undefined {
    const distance = ray.distanceToPoint(point.point);
    const snapDistance = this.getSnapDistance(pixelSize);
    if (distance < snapDistance) {
      return point;
    }
  }

  private snapToLines(
    ray: THREE.Ray,
    lines: THREE.Line3[],
    pixelSize: Pixels,
  ): { target?: THREE.Vector3; line?: THREE.Line3 } {
    for (const line of lines) {
      const target = this.snapToLine(ray, line, pixelSize);
      if (target) {
        return { target, line };
      }
    }
    return {};
  }

  private snapToLine(
    ray: THREE.Ray,
    line: THREE.Line3,
    pixelSize: Pixels,
  ): THREE.Vector3 | undefined {
    const target = new THREE.Vector3();
    const distance = distanceToLine(ray, line, undefined, target);
    const snapDistance = this.getSnapDistance(pixelSize);
    if (distance < snapDistance) {
      return target;
    }
  }

  private getSnapDistance(pixelSize: Pixels) {
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
