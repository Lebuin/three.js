import { OpenCascadeInstance } from '@lib/opencascade.js';
import ocJS from '@lib/opencascade.js/maqet-occt.js';
import ocWasm from '@lib/opencascade.js/maqet-occt.wasm';
import _ from 'lodash';
// Sometimes it's useful to debug a problem with our custom build by importing the full build.
// import ocJS from 'opencascade.js/dist/opencascade.full.js';
// import ocWasm from 'opencascade.js/dist/opencascade.full.wasm';

let oc: OpenCascadeInstance | undefined;
let ocError: unknown;

export const initOC = _.once(async () => {
  const options = {
    locateFile() {
      return ocWasm;
    },
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
    oc = await new (ocJS as any)(options);
  } catch (e: unknown) {
    ocError = e;
    throw e;
  }
});

interface Deletable {
  delete: () => void;
}
export type GarbageCollector = <D extends Deletable>(deletable: D) => D;

export function withOC<T>(
  callback: (oc: OpenCascadeInstance, gc: GarbageCollector) => T,
): T {
  if (ocError) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw ocError;
  } else if (!oc) {
    throw new Error('OpenCascade not initialized');
  }

  const deletables: Deletable[] = [];
  function gc<D extends Deletable>(deletable: D): D {
    deletables.push(deletable);
    return deletable;
  }

  try {
    return callback(oc, gc);
  } catch (e) {
    const ocE = parseError(e);
    throw ocE;
  } finally {
    for (const deletable of deletables) {
      deletable.delete();
    }
  }
}

export class OCError extends Error {}

export function parseError(e: unknown): unknown {
  if (!oc) {
    throw new Error('OpenCascade not initialized');
  }

  if (typeof e === 'number') {
    const exceptionData = oc.OCJS.getStandard_FailureData(e);
    const message = exceptionData.GetMessageString();
    return new OCError(message);
  } else {
    return e;
  }
}
