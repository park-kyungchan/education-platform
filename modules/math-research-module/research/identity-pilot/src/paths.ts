import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
/** Supports a sibling pilot or a pilot nested within the owning module. */
export function findMathModuleRoot(pilotRoot: string): string {
  if (process.env.MATH_MODULE_ROOT) return resolve(process.env.MATH_MODULE_ROOT);
  let parent = pilotRoot;
  for (let depth = 0; depth < 5; depth++) {
    parent = resolve(parent, '..');
    if (existsSync(resolve(parent, 'harness/records.json')) && existsSync(resolve(parent, 'source/archive'))) return parent;
  }
  return resolve(pilotRoot, '../math-research-module');
}
