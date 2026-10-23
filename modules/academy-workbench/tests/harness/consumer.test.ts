import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { loadPlatform, moduleRoot, sha256, verifyFilePins, verifyPlatform, readPin } from '../../scripts/agent-platform.ts';
import { checkHarness, validateModule, validateIdentity } from '../../scripts/check-harness.ts';
import { buildCheckpoint } from '../../scripts/work-context.ts';
const api = await loadPlatform();
const fixture = async (path: string) => JSON.parse(await readFile(resolve(moduleRoot, path), 'utf8'));

describe('canonical contracts through the pinned external provider', () => {
  test('consumer identity, local registration and unchanged historical gates pass', async () => expect((await checkHarness()).status).toBe('pass'));
  test('unknown or enabled capability fields cannot bypass the local manifest', async () => {
    const module = await fixture('harness/module.json');
    module.capability.sendEnabled = true;
    expect(await validateModule(module, api.source.root)).toBe(false);
    module.capability.sendEnabled = false; module.capability.executeAnything = true;
    expect(await validateModule(module, api.source.root)).toBe(false);
  });
  test('omitted false flags and wrong module schema cannot silently widen capability', async () => {
    const module = await fixture('harness/module.json'); delete module.capability.sendEnabled;
    expect(await validateModule(module, api.source.root)).toBe(false);
    module.capability.sendEnabled = false; module.schemaVersion = 'unknown';
    expect(await validateModule(module, api.source.root)).toBe(false);
  });
  test('local identity rejects wrong Task/Run IDs and registration claims', async () => {
    const identity = await fixture('harness/work/identity.json');
    identity.taskId += '-different'; expect(await validateIdentity(identity, api.source.root)).toBe(false);
    const second = await fixture('harness/work/identity.json'); second.runId += '-different';
    expect(await validateIdentity(second, api.source.root)).toBe(false);
    const third = await fixture('harness/work/identity.json'); third.globallyRegistered = true;
    expect(await validateIdentity(third, api.source.root)).toBe(false);
  });
  test('an existing checkpoint cannot be reset by a fresh context projection', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'academy-context-'));
    try {
      await mkdir(resolve(root, '.harness-runtime'));
      await writeFile(resolve(root, '.harness-runtime/checkpoint.json'), 'retained effects');
      await expect(buildCheckpoint(root)).rejects.toThrow('retained effects');
      expect(await readFile(resolve(root, '.harness-runtime/checkpoint.json'), 'utf8')).toBe('retained effects');
    } finally { await rm(root, { recursive: true }); }
  });
  test('canonical schema rejects malformed Artifact IDs', async () => {
    const p = await fixture('project.json'); p.id = 'academy:project:wrong';
    expect(api.validateArtifact(p).valid).toBe(false);
  });
  test('complete Task without Verification is rejected', async () => {
    const task = await fixture('harness/work/task.json'); task.payload.status = 'complete';
    expect(api.validateArtifact(task).valid).toBe(false);
  });
  test('Run references a real Task in the closed set', async () => {
    const records = await Promise.all(['project.json', 'harness/work/task.json', 'harness/work/run.json', 'harness/work/evidence.json', 'harness/work/verification.json'].map(fixture));
    expect(api.validateReferences(records).valid).toBe(true);
    records[2].payload.taskRef = 'academy-workbench:task:missing';
    expect(api.validateReferences(records).valid).toBe(false);
  });
  test('generated handoff summary is not an actual user decision', async () => {
    const cp = await buildCheckpoint();
    const source = cp.sourcePins.find(p => p.path.endsWith('business-decisions.json'))!;
    cp.userDecisions.push({ id: 'bad', answer: 'assumed acceptance', status: 'accepted', source: { ...source, kind: 'actual-user-answer', locator: '/decisions/0' } });
    expect(() => api.validateCheckpoint(cp)).toThrow('actual user answer');
  });
  test('capability or context never grants native permission', async () => {
    const cp = await buildCheckpoint();
    expect(() => api.validateCheckpoint({ ...cp, nativePermissionGranted: true })).toThrow();
  });
  test('completed effect cannot be queued again', async () => {
    const cp = await buildCheckpoint();
    cp.completed.push({ id: cp.pending[0].id, action: 'Synthetic observed effect', completedAt: cp.updatedAt,
      verificationRefs: [cp.evidenceRefs[0].path], replay: 'do-not-repeat' });
    expect(() => api.validateCheckpoint(cp)).toThrow('replay');
  });
  test('uncertain effect stays distinct and requires observation', async () => {
    const cp = await buildCheckpoint();
    cp.uncertainEffects.push({ id: 'ambiguous-submit', action: 'Synthetic submit', reason: 'No terminal receipt', requiredObservation: 'Inspect matching receipt before deciding retry' });
    expect(api.validateCheckpoint(cp).uncertainEffects.length).toBe(1);
    cp.pending.push({ id: 'ambiguous-submit', action: 'Retry', status: 'ready', dependsOn: [] });
    expect(() => api.validateCheckpoint(cp)).toThrow('distinct');
  });
  test('foreign WorkContext checkpoint path is rejected', () => {
    expect(() => api.validateWorkContextRequest({ schema: 'codex.work-context.request.v1', projectId: 'academy-workbench', workId: 'test', root: moduleRoot, cwd: moduleRoot, checkpointPath: '/tmp/foreign.json' })).toThrow('outside');
  });
  test('snapshot mode is explicit and not a claimed native provider closure', async () => {
    const s = await verifyPlatform(); expect(s.fullNativeProviderClosureVerified).toBe(false); expect(s.nativePermissionGranted).toBe(false);
  });
});

describe('fail-closed source pins', () => {
  test('rejects missing, changed and escaping sources, accepts exact bytes', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'academy-pin-'));
    try {
      await writeFile(resolve(root, 'sample.txt'), 'synthetic');
      const pin = { path: 'sample.txt', sha256: sha256('synthetic') };
      await verifyFilePins(root, [pin]);
      await expect(verifyFilePins(root, [{ ...pin, path: 'missing' }])).rejects.toThrow();
      await expect(verifyFilePins(root, [{ ...pin, path: '../outside' }])).rejects.toThrow();
      await writeFile(resolve(root, 'sample.txt'), 'drift');
      await expect(verifyFilePins(root, [pin])).rejects.toThrow('drift');
    } finally { await rm(root, { recursive: true }); }
  });
  test('rejects a source symlink even if bytes match', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'academy-pin-'));
    try {
      await writeFile(resolve(root, 'actual'), 'synthetic'); await symlink(resolve(root, 'actual'), resolve(root, 'link'));
      await expect(verifyFilePins(root, [{ path: 'link', sha256: sha256('synthetic') }])).rejects.toThrow('Unsafe');
    } finally { await rm(root, { recursive: true }); }
  });
});


describe('Bun relative import shadow protection', () => {
  for (const [shadow, content] of [
    ['packages/ontology/src/schema.js', 'export default {};'],
    ['packages/work-continuity/src/context/source', 'export const insideRoot = () => true;'],
    ['packages/work-continuity/src/context/source.json', '{}'],
  ]) {
    test(`reject or ignore unpinned shadow ${shadow}`, async () => {
      const root = await mkdtemp(resolve(tmpdir(), 'academy-shadow-'));
      try {
        const pin = await readPin();
        for (const file of pin.files) {
          const target = resolve(root, file.path); await mkdir(dirname(target), { recursive: true });
          await copyFile(resolve(api.source.root, file.path), target);
        }
        await symlink(resolve(api.source.root, 'node_modules'), resolve(root, 'node_modules'));
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
