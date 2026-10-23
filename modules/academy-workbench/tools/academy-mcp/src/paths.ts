import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = resolve(packageRoot, '../..');
export const resultRoot = resolve(repoRoot, '.local/rea-api');
export const reaEntry = resolve(packageRoot, 'node_modules/rea-agents/scripts/rea.mjs');
