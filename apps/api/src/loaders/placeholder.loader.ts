export function createPlaceholderPort<T extends object>(portName: string): T {
  return new Proxy({} as T, {
    get(_target, property) {
      return () => Promise.reject(new Error(`${portName}.${String(property)} is not implemented yet.`));
    },
  });
}
