import {
  TopoDS_Edge,
  TopoDS_Face,
  TopoDS_Shape,
  TopoDS_Vertex,
} from '@lib/opencascade.js';
import { THREE } from '@lib/three.js';
import { explore, ShapeType } from './explore';
import { getOC } from './oc';
import { pointFromVector, pointToVector } from './util';
export interface Intersection {
  shape: TopoDS_Shape;
  distance: number;
  distanceToRay: number;
  pointOnRay: THREE.Vector3;
  pointOnShape: THREE.Vector3;

  face?: TopoDS_Face;
  edge?: TopoDS_Edge;
  vertex?: TopoDS_Vertex;
}

export function raytraceSnapping(
  ray: THREE.Line3,
  shapes: TopoDS_Shape[],
  tolerance: number,
): Intersection | undefined {
  const intersections = raytrace(ray, shapes, tolerance);
  if (intersections.length === 0) {
    return;
  }

  const snappedIntersection = snapToIntersections(
    ray,
    intersections[0],
    intersections.slice(1),
    tolerance,
  );
  return snappedIntersection;
}

function snapToIntersections(
  ray: THREE.Line3,
  closestIntersection: Intersection,
  intersections: Intersection[],
  tolerance: number,
): Intersection {
  if (closestIntersection.vertex) {
    return closestIntersection;
  }

  const nearbyVertexIntersection = snapToIntersectionsOfType(
    ray,
    closestIntersection,
    intersections,
    tolerance,
    'vertex',
  );
  if (nearbyVertexIntersection) {
    return nearbyVertexIntersection;
  }

  if (closestIntersection.face) {
    const closerEdgeIntersection = snapToIntersectionsOfType(
      ray,
      closestIntersection,
      intersections,
      tolerance,
      'edge',
    );
    if (closerEdgeIntersection) {
      return closerEdgeIntersection;
    }
  }

  return closestIntersection;
}

function snapToIntersectionsOfType(
  ray: THREE.Line3,
  closestIntersection: Intersection,
  intersections: Intersection[],
  tolerance: number,
  type: 'edge' | 'vertex',
): Intersection | undefined {
  const shapesToCheckForVisibility = new Set([closestIntersection.shape]);
  for (const intersection of intersections) {
    shapesToCheckForVisibility.add(intersection.shape);
    if (intersection.distance - closestIntersection.distance > tolerance) {
      return;
    }
    if (!intersection[type]) {
      continue;
    }
    if (isVisible(intersection.pointOnShape, ray, shapesToCheckForVisibility)) {
      return intersection;
    }
  }
}

function isVisible(
  point: THREE.Vector3,
  ray: THREE.Line3,
  shapes: Set<TopoDS_Shape>,
): boolean {
  const faceIntersections = raytraceFaces(
    new THREE.Line3(ray.start, point),
    shapes,
  );

  for (const faceIntersection of faceIntersections) {
    // If the face intersection coincides with the point, this means the point is a corner of this
    // face, and therefore not obscured by this face.
    if (faceIntersection.pointOnRay.distanceTo(point) > 1e-6) {
      return false;
    }
  }

  return true;
}

export function raytrace(
  ray: THREE.Line3,
  shapes: Iterable<TopoDS_Shape>,
  tolerance: number,
): Intersection[] {
  const faceIntersections = raytraceFaces(ray, shapes);
  const edgeIntersections = raytraceEdges(ray, shapes, tolerance);
  const vertexIntersections = raytraceVertices(ray, shapes, tolerance);
  const intersections = [
    ...faceIntersections,
    ...edgeIntersections,
    ...vertexIntersections,
  ];
  intersections.sort((a, b) => a.distance - b.distance);
  return intersections;
}

export function raytraceFaces(
  ray: THREE.Line3,
  shapes: Iterable<TopoDS_Shape>,
): Intersection[] {
  return raytraceShapeType(ray, shapes, 'face', 0);
}

export function raytraceEdges(
  ray: THREE.Line3,
  shapes: Iterable<TopoDS_Shape>,
  tolerance: number,
): Intersection[] {
  return raytraceShapeType(ray, shapes, 'edge', tolerance);
}

export function raytraceVertices(
  ray: THREE.Line3,
  shapes: Iterable<TopoDS_Shape>,
  tolerance: number,
): Intersection[] {
  return raytraceShapeType(ray, shapes, 'vertex', tolerance);
}

export function raytraceShapeType<T extends ShapeType>(
  ray: THREE.Line3,
  shapes: Iterable<TopoDS_Shape>,
  shapeType: T['name'],
  tolerance: number,
): Intersection[] {
  const oc = getOC();
  const rayStart = pointFromVector(ray.start);
  const rayEnd = pointFromVector(ray.end);
  const rayEdgeBuilder = new oc.BRepBuilderAPI_MakeEdge_3(rayStart, rayEnd);
  const rayEdge = rayEdgeBuilder.Edge();

  const intersections: Intersection[] = [];
  const distTool = new oc.BRepExtrema_DistShapeShape_1();
  distTool.LoadS1(rayEdge);
  const progressRange = new oc.Message_ProgressRange_1();

  for (const shape of shapes) {
    const subShapes = explore(shape, shapeType);
    for (const subShape of subShapes) {
      distTool.LoadS2(subShape);

      const isDone = distTool.Perform(progressRange);
      if (!isDone) {
        throw new Error('Distance calculation failed');
      }
      const distanceToRay = distTool.Value();
      if (distanceToRay <= tolerance) {
        const numPoints = distTool.NbSolution();
        for (let i = 0; i < numPoints; i++) {
          const pointOnRay = distTool.PointOnShape1(i + 1);
          const pointOnShape = distTool.PointOnShape2(i + 1);
          const distance = rayStart.Distance(pointOnShape);
          intersections.push({
            shape,
            distance,
            distanceToRay,
            pointOnRay: pointToVector(pointOnRay),
            pointOnShape: pointToVector(pointOnShape),
            [shapeType]: subShape,
          });
        }
      }
    }
  }
  return intersections;
}
