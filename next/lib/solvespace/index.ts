import Solvespace, { SlvsModule } from './slvs';

let slvs: SlvsModule | undefined;

export async function initSolveSpace() {
  slvs = await Solvespace();
}

export function getSolvespace() {
  if (!slvs) {
    throw new Error('SolveSpace not initialized');
  }
  return slvs;
}
