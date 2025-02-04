import { Edge, Face, Vertex } from '@/lib/geom/shape';
import { LineHelper } from '@/lib/renderer/helpers/line-helper';
import {
  PlaneHelper,
  PlaneHelperColors,
  PlaneHelperRect,
} from '@/lib/renderer/helpers/plane-helper';
import { PointHelper } from '@/lib/renderer/helpers/point-helper';
import { UpdatingObjectMixin } from '@/lib/renderer/helpers/updating-object-mixin';
import { Renderer } from '@/lib/renderer/renderer';
import * as settings from '@/lib/renderer/settings';
import { Color4 } from '@/lib/util/color4';
import { Axis, isAxis } from '@/lib/util/geometry';
import { THREE } from '@lib/three.js';
import _ from 'lodash';
import { EdgeHelper } from './edge-helper';
import { FaceHelper } from './face-helper';
import { VertexHelper } from './vertex-helper';

type Helper =
  | PointHelper
  | LineHelper
  | PlaneHelper
  | VertexHelper
  | EdgeHelper
  | FaceHelper;
interface Helpers {
  point: PointHelper[];
  line: LineHelper[];
  plane: PlaneHelper[];

  vertex: VertexHelper[];
  edge: EdgeHelper[];
  face: FaceHelper[];
}

/**
 * A collection of a helpers that aid in drawing.
 */
export class DrawingHelper extends UpdatingObjectMixin(THREE.Group) {
  private helpers: Helpers = {
    point: [],
    line: [],
    plane: [],

    vertex: [],
    edge: [],
    face: [],
  };

  constructor() {
    super();
  }

  update(renderer: Renderer) {
    this.helpers.point.forEach((pointHelper) => {
      pointHelper.update(renderer);
    });
    this.helpers.vertex.forEach((vertexHelper) => {
      vertexHelper.update(renderer);
    });
  }

  private resizeHelpers<T extends Helper>(
    helpers: T[],
    length: number,
    createCallback: () => T,
  ): T[] {
    while (helpers.length > length) {
      const helper = helpers.pop()!;
      this.remove(helper);
    }
    while (helpers.length < length) {
      const helper = createCallback();
      this.add(helper);
      helpers.push(helper);
    }

    this.children = _.sortBy(this.children, (child) => {
      if (child instanceof PointHelper) {
        return 0;
      } else if (child instanceof LineHelper) {
        return 1;
      } else {
        return 2;
      }
    });

    return helpers;
  }

  ///
  // Point helper

  setPoints(points: THREE.Vector3[]) {
    const pointHelperOptions = {
      size: 10,
      strokeColor: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 1),
      fillColor: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 0.8),
    };
    const helpers = this.resizeHelpers(
      this.helpers.point,
      points.length,
      () => new PointHelper(pointHelperOptions),
    );

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const pointHelper = helpers[i];
      pointHelper.setPoint(point);
    }
  }

  ///
  // Vertex helper

  setVertices(vertices: Vertex[]) {
    const vertexHelperOptions = {
      size: 10,
      strokeColor: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 1),
      fillColor: new Color4().setHSLA(186 / 360, 94 / 100, 26 / 100, 0.8),
    };
    const helpers = this.resizeHelpers(
      this.helpers.vertex,
      vertices.length,
      () => new VertexHelper(vertexHelperOptions),
    );

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const vertexHelper = helpers[i];
      vertexHelper.setVertex(vertex);
    }
  }

  ///
  // Line helpers

  setLines(lines: THREE.Line3[]) {
    const helpers = this.resizeHelpers(
      this.helpers.line,
      lines.length,
      () => new LineHelper(),
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineHelper = helpers[i];

      const points = this.getLinePoints(line);
      const color = this.getLineColor(line);
      const lineWidth = this.getLineWidth(line);

      lineHelper.setPoints(points);
      lineHelper.setColor(color);
      lineHelper.setLineWidth(lineWidth);
    }
  }

  private getLinePoints(line: THREE.Line3): THREE.Vector3[] {
    return [line.start, line.end];
  }

  private getLineColor(line: THREE.Line3) {
    const direction = line.delta(new THREE.Vector3());
    const axis = isAxis(direction);
    if (axis == null) {
      return new Color4(0, 0, 0);
    } else {
      return settings.axesColors[axis].primary;
    }
  }

  private getLineWidth(line: THREE.Line3) {
    const defaultLineWidth = 2;
    const axisLineWidth = 2.5;

    const direction = line.delta(new THREE.Vector3());
    const axis = isAxis(direction);
    if (axis == null) {
      return defaultLineWidth;
    } else {
      const origin = new THREE.Vector3();
      const projectedOrigin = line.closestPointToPoint(
        origin,
        false,
        new THREE.Vector3(),
      );
      const distance = projectedOrigin.distanceTo(origin);
      if (distance < 1e-6) {
        return axisLineWidth;
      } else {
        return defaultLineWidth;
      }
    }
  }

  ///
  // Edge helpers

  setEdges(edges: Edge[]) {
    const helpers = this.resizeHelpers(
      this.helpers.edge,
      edges.length,
      () => new EdgeHelper(),
    );

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const edgeHelper = helpers[i];

      const color = this.getEdgeColor(edge);
      const lineWidth = this.getEdgeWidth(edge);

      edgeHelper.setEdge(edge);
      edgeHelper.setColor(color);
      edgeHelper.setLineWidth(lineWidth);
    }
  }

  private getEdgeColor(_edge: Edge) {
    const defaultColor = new Color4().setHSLA(
      186 / 360,
      90 / 100,
      40 / 100,
      0.6,
    );
    return defaultColor;
  }

  private getEdgeWidth(_edge: Edge) {
    return 3;
  }

  ///
  // Plane helper

  setPlanes(planes: PlaneHelperRect[]) {
    const helpers = this.resizeHelpers(
      this.helpers.plane,
      planes.length,
      () => new PlaneHelper(),
    );

    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      const planeHelper = helpers[i];
      planeHelper.setRect(plane);

      const colors = this.getPlaneColors(planeHelper.quaternion);
      planeHelper.setColors(colors);
    }
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
  // Face helpers

  setFaces(faces: Face[]) {
    const helpers = this.resizeHelpers(
      this.helpers.face,
      faces.length,
      () => new FaceHelper(),
    );

    for (let i = 0; i < faces.length; i++) {
      const face = faces[i];
      const faceHelper = helpers[i];

      const color = this.getFaceColor(face);

      faceHelper.setFace(face);
      faceHelper.setColor(color);
    }
  }

  private getFaceColor(_face: Face) {
    const defaultColor = new Color4().setHSLA(
      186 / 360,
      90 / 100,
      40 / 100,
      0.1,
    );
    return defaultColor;
  }
}
