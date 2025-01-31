const finalizationRegistry = new FinalizationRegistry((disposable) => {
  disposable.dispose();
});

const disposableProxy = {};

export function gcDisposable(disposable) {
  const proxy = new Proxy(disposable, disposableProxy);
  finalizationRegistry.register(proxy, disposable, disposable);
  return proxy;
}
