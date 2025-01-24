import { TopoDS_Shape } from '@lib/opencascade.js';
import { exploreEdges } from './explore';
import { withOC } from './oc';

export function makeWire(shape: TopoDS_Shape) {
  // TODO: this works, but it returns an inefficient representation: e.g. in a cube every edge is
  // represented twice.
  return withOC((oc, gc) => {
    const builder = gc(new oc.BRepBuilderAPI_MakeWire_1());
    const edges = gc(exploreEdges(shape));
    for (const edge of edges) {
      builder.Add_1(edge);
    }
    const wire = builder.Wire();
    return wire;
  });
}
