import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { loadPlatform, verifyPlatform, readPin } from '../../scripts/agent-platform';
import { materializeCanonicalTestFixture } from '../../ci/materialize-canonical-fixture';
const api = await loadPlatform();
// The original physical import-shadow oracle remains unchanged. Compiled CI
// supplies only an exclusive generated test fixture, never a claimed checkout.
const generated = api.source.mode === 'compiled-canonical-ci-projection' ? await materializeCanonicalTestFixture() : undefined;
const physicalSourceRoot=generated?.root??api.source.root;
afterAll(async()=>{await generated?.cleanup();});
describe('Bun relative import shadow protection', () => {
  for (const [shadow, content] of [
    ['packages/ontology/src/schema.js', 'export default {};'],
    ['packages/work-continuity/src/context/source', 'export const insideRoot = () => true;'],
    ['packages/work-continuity/src/context/source.json', '{}'],
  ]) {
    test(`reject or ignore unpinned shadow ${shadow}`, async () => {
      const root = await mkdtemp(resolve(tmpdir(), 'math-shadow-'));
      try {
        const pin = await readPin();
        for (const file of pin.files) {
          const target = resolve(root, file.path); await mkdir(dirname(target), { recursive: true });
          await copyFile(resolve(physicalSourceRoot, file.path), target);
        }
        await symlink(resolve(physicalSourceRoot, 'node_modules'), resolve(root, 'node_modules'));
        await writeFile(resolve(root, shadow), content);
        const importer = shadow.includes('ontology') ? 'packages/ontology/src/validation.ts' : 'packages/work-continuity/src/context/validation.ts';
        const specifier = shadow.includes('ontology') ? './schema.js' : './source';
        const expected = shadow.includes('ontology') ? 'packages/ontology/src/schema.ts' : 'packages/work-continuity/src/context/source.ts';
        const actual = Bun.resolveSync(specifier, dirname(resolve(root, importer)));
        if (actual === resolve(root, expected)) {
          // A lower-priority candidate cannot shadow the pinned source on this Bun version.
          expect((await verifyPlatform({ root, snapshot: true })).mode).toBe('pinned-snapshot');
        } else await expect(verifyPlatform({ root, snapshot: true })).rejects.toThrow('Import shadow');
      } finally { await rm(root, { recursive: true }); }
    });
  }
});
