import { Board } from '@/lib/model/parts/board';
import { THREE } from '@lib/three.js';
import { BoxToolHandler } from './box-tool-handler';

export class BoardToolHandler extends BoxToolHandler<Board> {
  readonly tool = 'board';
  readonly fixedDimensions = [18];

  protected getPart(
    size: THREE.Vector3,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ) {
    return new Board(size, position, quaternion);
  }
}
