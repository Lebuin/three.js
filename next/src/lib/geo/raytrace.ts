import { TopoDS_Shape } from 'opencascade.js';
import * as THREE from 'three';
import { withOC } from './oc';
import { directionFromVector, pointFromVector } from './util';

export interface Intersection {
  pointOnRay: THREE.Vector3;
  shape: TopoDS_Shape;
  distance: number;

  pointOnEdge?: THREE.Vector3;
  distanceToEdge?: number;
}

export function raytrace(
  ray: THREE.Ray,
  shapes: TopoDS_Shape[],
): Intersection[] {
  return withOC((oc, gc) => {
    const line = new oc.gp_Lin_3(
      pointFromVector(ray.origin),
      directionFromVector(ray.direction),
    );
    const intersector = gc(new oc.IntCurvesFace_ShapeIntersector());
    const intersections: Intersection[] = [];
    for (const shape of shapes) {
      intersector.Load(shape, 0);
      intersector.Perform_1(line, 0, Infinity);
      if (!intersector.IsDone()) {
        throw new Error('Intersector did not finish');
      }
      const numPoints = intersector.NbPnt();
      for (let i = 0; i < numPoints; i++) {
        const point = intersector.Pnt(i + 1);
        const distance = point.Distance(line.Location());
        intersections.push({
          pointOnRay: new THREE.Vector3(point.X(), point.Y(), point.Z()),
          shape,
          distance,
        });
      }
    }
    return intersections;
  });
}
