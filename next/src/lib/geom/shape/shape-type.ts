import { getOC, TopAbs_ShapeEnum, TopoDS_Shape } from '@lib/opencascade.js';

export enum ShapeType {
  COMPOUND = 'COMPOUND',
  COMPSOLID = 'COMPSOLID',
  SOLID = 'SOLID',
  SHELL = 'SHELL',
  FACE = 'FACE',
  WIRE = 'WIRE',
  EDGE = 'EDGE',
  VERTEX = 'VERTEX',
  SHAPE = 'SHAPE',
}
interface OCShapeEnum extends TopAbs_ShapeEnum {
  value: number;
}

let ocToType: Map<number, ShapeType> | undefined;
let typeToOC: Map<ShapeType, TopAbs_ShapeEnum> | undefined;

function getMaps() {
  if (!ocToType || !typeToOC) {
    const oc = getOC();
    const pairs: [object, ShapeType][] = [
      [oc.TopAbs_ShapeEnum.TopAbs_COMPOUND, ShapeType.COMPOUND],
      [oc.TopAbs_ShapeEnum.TopAbs_COMPSOLID, ShapeType.COMPSOLID],
      [oc.TopAbs_ShapeEnum.TopAbs_SOLID, ShapeType.SOLID],
      [oc.TopAbs_ShapeEnum.TopAbs_SHELL, ShapeType.SHELL],
      [oc.TopAbs_ShapeEnum.TopAbs_FACE, ShapeType.FACE],
      [oc.TopAbs_ShapeEnum.TopAbs_WIRE, ShapeType.WIRE],
      [oc.TopAbs_ShapeEnum.TopAbs_EDGE, ShapeType.EDGE],
      [oc.TopAbs_ShapeEnum.TopAbs_VERTEX, ShapeType.VERTEX],
      [oc.TopAbs_ShapeEnum.TopAbs_SHAPE, ShapeType.SHAPE],
    ];

    ocToType = new Map();
    typeToOC = new Map();
    for (const [_ocShapeType, shapeType] of pairs) {
      const ocShapeType = _ocShapeType as OCShapeEnum;
      ocToType.set(ocShapeType.value, shapeType);
      typeToOC.set(shapeType, ocShapeType);
    }
  }

  return { ocToType, typeToOC };
}

export function getShapeType(
  shapeOrType: TopoDS_Shape | TopAbs_ShapeEnum,
): ShapeType {
  const oc = getOC();
  const ocShapeType = (
    shapeOrType instanceof oc.TopoDS_Shape
      ? shapeOrType.ShapeType()
      : shapeOrType
  ) as OCShapeEnum;
  const { ocToType } = getMaps();
  const shapeType = ocToType.get(ocShapeType.value);
  if (shapeType == null) {
    throw new Error(`Invalid shape type: ${JSON.stringify(ocShapeType)}`);
  }
  return shapeType;
}

export function getOCShapeType(shapeType: ShapeType): TopAbs_ShapeEnum {
  const { typeToOC } = getMaps();
  const ocShapeType = typeToOC.get(shapeType);
  if (ocShapeType == null) {
    throw new Error(`Invalid shape type: ${shapeType}`);
  }
  return ocShapeType;
}
