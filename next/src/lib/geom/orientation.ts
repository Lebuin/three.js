import { getOC, TopAbs_Orientation, TopoDS_Shape } from '@lib/opencascade.js';

export enum Orientation {
  FORWARD = 'FORWARD',
  REVERSED = 'REVERSED',
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}
interface OCOrientationEnum extends TopAbs_Orientation {
  value: number;
}

let ocToOrientation: Map<number, Orientation> | undefined;
let orientationToOC: Map<Orientation, TopAbs_Orientation> | undefined;

function getMaps() {
  if (!ocToOrientation || !orientationToOC) {
    const oc = getOC();
    const pairs: [object, Orientation][] = [
      [oc.TopAbs_Orientation.TopAbs_FORWARD, Orientation.FORWARD],
      [oc.TopAbs_Orientation.TopAbs_REVERSED, Orientation.REVERSED],
      [oc.TopAbs_Orientation.TopAbs_INTERNAL, Orientation.INTERNAL],
      [oc.TopAbs_Orientation.TopAbs_EXTERNAL, Orientation.EXTERNAL],
    ];

    ocToOrientation = new Map();
    orientationToOC = new Map();
    for (const [_ocOrientation, orientation] of pairs) {
      const ocOrientation = _ocOrientation as OCOrientationEnum;
      ocToOrientation.set(ocOrientation.value, orientation);
      orientationToOC.set(orientation, ocOrientation);
    }
  }

  return { ocToOrientation, orientationToOC };
}

export function getOrientation(
  shapeOrOrientation: TopoDS_Shape | TopAbs_Orientation,
): Orientation {
  const oc = getOC();
  const ocOrientation = (
    shapeOrOrientation instanceof oc.TopoDS_Shape
      ? shapeOrOrientation.Orientation_1()
      : shapeOrOrientation
  ) as OCOrientationEnum;
  const { ocToOrientation } = getMaps();
  const orientation = ocToOrientation.get(ocOrientation.value);
  if (orientation == null) {
    throw new Error(`Invalid orientation: ${JSON.stringify(ocOrientation)}`);
  }
  return orientation;
}

export function getOCShapeType(orientation: Orientation): TopAbs_Orientation {
  const { orientationToOC } = getMaps();
  const ocOrientation = orientationToOC.get(orientation);
  if (ocOrientation == null) {
    throw new Error(`Invalid orientation: ${orientation}`);
  }
  return ocOrientation;
}
