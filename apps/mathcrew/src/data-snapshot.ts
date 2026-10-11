// Finite ordinary JavaScript data ingress, not a Proxy/OS/global sandbox.
// Capture descriptors and all own dense indices before traversing children;
// never read caller properties, invoke caller methods, accessors or iterators.
export function snapshotData(value: unknown): unknown {
  const active = new WeakSet<object>();
  let nodes = 0;
  function capture(input: unknown, depth: number): unknown {
    if (++nodes > 10000 || depth > 32) throw new Error('Data budget exceeded');
    if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
    if (typeof input === 'number' && Number.isFinite(input)) return input;
    if (!input || typeof input !== 'object') throw new Error('Expected ordinary JSON data');
    if (active.has(input)) throw new Error('Cyclic data');
    const array = Array.isArray(input);
    if (Object.getPrototypeOf(input) !== (array ? Array.prototype : Object.prototype)) throw new Error('Custom data prototype');
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const keys = Reflect.ownKeys(descriptors);
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('Symbol data');
      const descriptor = descriptors[key];
      if (!Object.hasOwn(descriptor, 'value') || (!descriptor.enumerable && !(array && key === 'length'))) throw new Error('Accessor or hidden data');
    }
    active.add(input);
    try {
      if (array) {
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || length < 0 || length > 10000 || keys.length !== length + 1) throw new Error('Sparse or decorated list');
        const captured: unknown[] = [];
        for (let index = 0; index < length; index++) {
          const descriptor = descriptors[String(index)];
          if (!descriptor) throw new Error('Missing own list index');
          captured.push(descriptor.value);
        }
        const result: unknown[] = [];
        for (let index = 0; index < length; index++) result.push(capture(captured[index], depth + 1));
        return Object.freeze(result);
      }
      const result: Record<string, unknown> = {};
      for (const key of keys as string[]) Object.defineProperty(result, key, { value: capture(descriptors[key].value, depth + 1), enumerable: true });
      return Object.freeze(result);
    } finally { active.delete(input); }
  }
  return capture(value, 0);
}
