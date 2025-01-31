/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as env from '@/lib/env';
import ocJS from '@lib/opencascade.js/maqet-occt.js';
import ocWasm from '@lib/opencascade.js/maqet-occt.wasm';
import _ from 'lodash';
import { OpenCascadeInstance } from './maqet-occt.d';
export * from './maqet-occt';
// Sometimes it's useful to debug a problem with our custom build by importing the full build.
// import ocJS from 'opencascade.js/dist/opencascade.full.js';
// import ocWasm from 'opencascade.js/dist/opencascade.full.wasm';

let oc: OpenCascadeInstance | undefined;
let ocError: unknown;
const ENABLE_GC = env.getBoolean('NEXT_PUBLIC_ENABLE_OPENCASCADE_GC', true);

///
// Initialize OC

export const initOC = _.once(async () => {
  const options = {
    locateFile() {
      return ocWasm;
    },
  };
  try {
    const _oc = (await new (ocJS as any)(options)) as OpenCascadeInstance;
    oc = wrapOC(_oc);
  } catch (e: unknown) {
    ocError = e;
    throw e;
  }
});

export function getOC(): OpenCascadeInstance {
  if (!oc) {
    throw new Error('OpenCascade not initialized');
  } else if (ocError) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw ocError;
  }
  return oc;
}

///
// Wrap OC
//
// Wrap OpenCascade objects to make them garbage collectable and to handle errors.

function wrapOC(object: OpenCascadeInstance): OpenCascadeInstance {
  const wrapped: Record<string, any> = {};
  wrapOCTo(object, wrapped);
  return wrapped as OpenCascadeInstance;
}

function wrapOCTo(
  object: Record<string, any>,
  target: Record<string, any>,
): void {
  for (const [key, value] of Object.entries(object)) {
    if (typeof value === 'function') {
      const proxied = new Proxy(value, ocFunctionProxyHandler);
      wrapOCTo(value as object, proxied as object);
      target[key] = proxied;
    } else {
      target[key] = value;
    }
  }
}

type AnyFunction = (...args: any[]) => any;

const ocFunctionProxyHandler: ProxyHandler<AnyFunction> = {
  apply(target: any, thisArg: any, args: any[]): any {
    try {
      const value = Reflect.apply(target, thisArg, args);
      return proxyValue(value);
    } catch (e: unknown) {
      throw parseError(e);
    }
  },

  construct(target: any, args: any[]): any {
    try {
      const value = Reflect.construct(target, args);
      return proxyValue(value);
    } catch (e: unknown) {
      throw parseError(e);
    }
  },
};

const ocInstanceProxyHandler: ProxyHandler<any> = {
  get(target: Deletable, prop: string): any {
    const value = Reflect.get(target, prop);

    const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
    if (descriptor && !descriptor.configurable) {
      if (descriptor.set && !descriptor.get) {
        return undefined;
      }
      if (descriptor.writable === false) {
        return value;
      }
    }

    if (prop === 'delete' && typeof value === 'function') {
      return () => {
        unregisterDeletable(target);
        target.delete();
      };
    } else {
      return proxyValue(value);
    }
  },
};

function proxyFunction<T extends AnyFunction>(value: T): T {
  return new Proxy<T>(value, ocFunctionProxyHandler);
}

function proxyInstance<T extends object>(instance: T): T {
  const proxy = new Proxy<T>(instance, ocInstanceProxyHandler);
  if (isDeletable(instance)) {
    registerDeletable(proxy as Deletable, instance);
  }
  return proxy;
}

function proxyValue<T extends any>(value: T): T {
  if (typeof value === 'function') {
    return proxyFunction(value as AnyFunction) as T;
  } else if (typeof value === 'object' && value != null) {
    return proxyInstance(value);
  }
  return value;
}

///
// Garbage collect OpenCascade objects

interface Deletable {
  delete: () => void;
}
const finalizationRegistry = new FinalizationRegistry<Deletable>(
  (deletable) => {
    deletable.delete();
  },
);

function isDeletable(value: unknown): value is Deletable {
  return !!value && typeof (value as Deletable).delete === 'function';
}

function registerDeletable(proxy: Deletable, deletable: Deletable) {
  if (ENABLE_GC) {
    finalizationRegistry.register(proxy, deletable, deletable);
  }
}

function unregisterDeletable(deletable: Deletable) {
  finalizationRegistry.unregister(deletable);
}

///
// Error handling

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
