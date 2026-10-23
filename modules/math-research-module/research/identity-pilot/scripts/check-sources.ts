import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { assertValid } from '../src/validation.ts';
import { verifySourcePins } from '../src/source-checks.ts';
import { findMathModuleRoot } from '../src/paths.ts';
const base = resolve(import.meta.dirname, '..');
const allowedRoots = await Promise.all([base, findMathModuleRoot(base)].map(path => realpath(path)));
const bundle = JSON.parse(await readFile(resolve(base, 'samples/research-bundle.json'), 'utf8'));
assertValid(bundle);
const issues = await verifySourcePins(bundle, async sourcePath => {
  const path = await realpath(resolve(base, sourcePath));
  if (!allowedRoots.some(root => { const rel = relative(root, path); return !rel.startsWith('..') && !rel.startsWith('/'); })) throw new Error('Source outside explicitly allowed pilot/module roots');
  return readFile(path);
});
if (issues.length) throw new Error(JSON.stringify(issues, null, 2));
console.log('PASS pinned source bytes, actual Artifact IDs/kinds, Work pair, legacy locators. Canonical common contract validation remains math-research-module check:harness; no actual acceptance admitted.');
