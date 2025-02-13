export * from './slvs';

import _ from 'lodash';
import Solvespace, { SlvsModule } from './slvs';

let slvs: SlvsModule | undefined;

export const initSolveSpace = _.once(async () => {
  slvs = await Solvespace();
});

export function getSolvespace() {
  if (!slvs) {
    throw new Error('SolveSpace not initialized');
  }
  return slvs;
}
