import { TopoDS_Wire } from '@lib/opencascade.js';
import { RootShape } from './root-shape';

export class Wire extends RootShape<TopoDS_Wire> {}
