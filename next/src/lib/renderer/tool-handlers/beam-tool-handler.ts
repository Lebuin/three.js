import { Beam } from '@/lib/model/parts/beam';
import { THREE } from '@lib/three.js';
import { BoxToolHandler } from './box-tool-handler';

export class BeamToolHandler extends BoxToolHandler<Beam> {
  readonly tool = 'beam';
  readonly fixedDimensions = [50, 100];

  protected getPart(
    size: THREE.Vector3,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ) {
    return new Beam(size, position, quaternion);
  }
}
