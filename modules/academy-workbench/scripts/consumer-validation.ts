/** Academy-owned schema transport only; AJV and shared semantics stay in the pinned provider. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { moduleRoot, readJson } from './agent-platform.ts';

export async function validateConsumerSchema(value: unknown, schema: unknown, dependencyRoot: string): Promise<boolean> {
  const importer = pathToFileURL(resolve(dependencyRoot, 'packages/ontology/src/validation.ts')).href;
  const { default: Ajv2020 } = await import(import.meta.resolve('ajv/dist/2020.js', importer));
  const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: false });
  return Boolean(ajv.compile(schema)(value));
}
export async function validateLocalSchema(value: unknown, dependencyRoot: string, schemaPath: string): Promise<boolean> {
  return validateConsumerSchema(value, await readJson(resolve(moduleRoot, schemaPath)), dependencyRoot);
}
export const validateModule = (value: unknown, dependencyRoot: string) => validateLocalSchema(value, dependencyRoot, 'harness/module.schema.json');
export const validateIdentity = (value: unknown, dependencyRoot: string) => validateLocalSchema(value, dependencyRoot, 'harness/work/identity.schema.json');
