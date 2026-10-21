/** Descriptor-safe plain record boundary shared by source and application consumers. */
export function readInputRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_read_request');
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.values(descriptors).some(value => !Object.hasOwn(value, 'value'))) throw new Error('accessor_read_request');
  return Object.fromEntries(Object.entries(descriptors).map(([name,value])=>[name,value.value]));
}
