import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { buildCheckpoint, inspectContext } from '../../scripts/work-context.ts';
import { moduleRoot } from '../../scripts/agent-platform.ts';
import { sha256 } from '../../scripts/agent-platform.ts';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'academy-onboarding-')); roots.push(root);
  for (const path of ['project.json', 'harness/work/identity.json', 'harness/work/identity.schema.json', 'harness/work/task.json', 'harness/work/run.json', 'migration/current-status.json', 'context/business-decisions.json', 'context/user-context/records.json', 'context/user-context/coverage.json', 'README.md', 'MIGRATION_PLAN.md', 'context/student-audit-20261014/lesson-batch/work-identity.json', 'harness/module.json', 'harness/continuation-source.json']) {
    await mkdir(dirname(resolve(root, path)), { recursive: true });
    if (['project.json', 'harness/work/identity.json', 'harness/work/identity.schema.json', 'harness/work/task.json', 'harness/work/run.json', 'harness/module.json', 'harness/continuation-source.json'].includes(path)) await copyFile(resolve(moduleRoot, path), resolve(root, path));
    else await writeFile(resolve(root, path), JSON.stringify({ synthetic: true, fixture: 'fictional-context-metadata' }));
  }
  await writeFile(resolve(root, '.gitignore'), '.harness-runtime/\n');
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
  git('init'); git('add', '.'); git('-c', 'user.name=Synthetic Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'Synthetic context fixture');
  const cp = await buildCheckpoint(root);
  await mkdir(resolve(root, '.harness-runtime'));
  return { root, cp, path: resolve(root, '.harness-runtime/checkpoint.json') };
}
test('current source is freshly observed while old publication pending stays explicitly historical', async () => {
  const { root, path } = await fixture();
  const first = await inspectContext({ root }), second = await inspectContext({ root });
  expect(first.currentSource.head).toBe(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  expect(first.continuation.status).toBe('no-current-checkpoint-observed');
  expect(first.historical.pending.some(row => row.id === 'publish-reviewed-patch')).toBe(true);
  expect(first.historical.publicationStateRevalidated).toBe(false);
  expect(first.invocation.id).not.toBe(second.invocation.id);
  expect(first.invocation.nativeRunId).toBeNull();
  expect(first.invocation.nativeAuthorshipVerified).toBe(false);
  expect(first.selectedWork.registration).toBe('local-module-record');
  expect(first.selectedWork.registrationEvidence.class).toBe('schema-valid-local-work-identity');
  await expect(readFile(path)).rejects.toThrow();
});

// Private fictional Git transport only. Production inspection has no timing hooks or injected test engine.
async function duringGit(root: string, trigger: 'status' | 'first-head', mutation: string, inspect: () => Promise<unknown>) {
  const realGit = Bun.which('git'); if (!realGit) throw Error('Git fixture dependency absent');
  const shim = await mkdtemp(resolve(tmpdir(), 'academy-git-shim-')); roots.push(shim);
  const marker = resolve(shim, 'fired');
  const script = `#!${process.execPath}\nimport {existsSync,writeFileSync} from 'node:fs';\nimport {execFileSync} from 'node:child_process';\nconst realGit=${JSON.stringify(realGit)},root=${JSON.stringify(root)},argv=process.argv.slice(2);\nconst child=Bun.spawnSync([realGit,...argv],{stdout:'pipe',stderr:'pipe'});\nconst trigger=${JSON.stringify(trigger)};\nconst matches=trigger==='status'?argv.includes('status'):argv.includes('rev-parse')&&argv.at(-1)==='HEAD';\nif(child.exitCode===0&&matches&&!existsSync(${JSON.stringify(marker)})){writeFileSync(${JSON.stringify(marker)},'fictional-once',{flag:'wx'});${mutation}}\nprocess.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exit(child.exitCode);\n`;
  await writeFile(resolve(shim, 'git'), script, { mode: 0o700 });
  const oldPath = process.env.PATH; process.env.PATH = `${shim}:${oldPath}`;
  try { return await inspect(); } finally { process.env.PATH = oldPath; }
}

test('an explicitly owned other Work checkpoint has unverified registration, not local/native/global registration', async () => {
  const { root, cp, path } = await fixture(); cp.workId = 'fictional-other-known-work';
  const bytes = JSON.stringify(cp); await writeFile(path, bytes);
  const context = await inspectContext({ root, workId: cp.workId });
  expect(context.continuation.status).toBe('known-checkpoint-read');
  expect(context.selectedWork.registration).toBe('unverified');
  expect(context.selectedWork.registrationEvidence.class).toBe('known-checkpoint-only');
  expect(context.selectedWork.registrationEvidence.sha256).toBe(sha256(bytes));
  expect(context.selectedWork.nativeBindingVerified).toBe(false);
  expect(context.selectedWork.globalRegistrationVerified).toBe(false);
  expect(await readFile(path, 'utf8')).toBe(bytes);
});

test('late checkpoint byte changes after Git status assembly hold without replacing newer owner bytes', async () => {
  const { root, cp, path } = await fixture(); await writeFile(path, JSON.stringify(cp));
  const newer = JSON.stringify({ ...cp, version: cp.version + 1 });
  const mutation = `writeFileSync(${JSON.stringify(path)},${JSON.stringify(newer)});`;
  await expect(duringGit(root, 'status', mutation, () => inspectContext({ root }))).rejects.toThrow('checkpoint bytes changed');
  expect(await readFile(path, 'utf8')).toBe(newer);
});

test('a checkpoint appearing after initial absence holds instead of returning no-current-checkpoint', async () => {
  const { root, cp, path } = await fixture(); const bytes = JSON.stringify(cp);
  await expect(duringGit(root, 'status', `writeFileSync(${JSON.stringify(path)},${JSON.stringify(bytes)});`, () => inspectContext({ root }))).rejects.toThrow('checkpoint presence changed');
  expect(await readFile(path, 'utf8')).toBe(bytes);
});

test('late checkpoint-only source drift is rechecked after Git/status assembly', async () => {
  const { root, cp, path } = await fixture(), extra = resolve(root, '.harness-runtime/fictional-extra-source.json');
  const before = '{"fictional":"before"}', after = '{"fictional":"after"}'; await writeFile(extra, before);
  cp.sourcePins.push({ path: extra, sha256: sha256(before), role: 'context' }); await writeFile(path, JSON.stringify(cp));
  await expect(duringGit(root, 'status', `writeFileSync(${JSON.stringify(extra)},${JSON.stringify(after)});`, () => inspectContext({ root }))).rejects.toThrow('checkpoint source status changed');
  expect(await readFile(extra, 'utf8')).toBe(after);
});

test('a late context edit after its bytes were assembled holds without returning a stale hash', async () => {
  const { root } = await fixture(), path = resolve(root, 'README.md'), newer = 'Fictional late context edit';
  await expect(duringGit(root, 'status', `writeFileSync(${JSON.stringify(path)},${JSON.stringify(newer)});`, () => inspectContext({ root }))).rejects.toThrow('context source changed');
  expect(await readFile(path, 'utf8')).toBe(newer);
});

test('a concurrent commit with unchanged source files is caught by final pinned Git identity', async () => {
  const { root } = await fixture(); const previous = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const mutation = `execFileSync(realGit,['-C',root,'-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Fictional concurrent commit'],{stdio:'ignore'});`;
  await expect(duringGit(root, 'status', mutation, () => inspectContext({ root }))).rejects.toThrow('Git source identity');
  expect(execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()).not.toBe(previous);
});

test('an identity change after semantic use cannot be masked by a later source hash', async () => {
  const { root } = await fixture(), path = resolve(root, 'harness/work/identity.json');
  const identity = JSON.parse(await readFile(path, 'utf8')); identity.workId = 'fictional-late-identity';
  const newer = JSON.stringify(identity);
  await expect(duringGit(root, 'first-head', `writeFileSync(${JSON.stringify(path)},${JSON.stringify(newer)});`, () => inspectContext({ root }))).rejects.toThrow('initial identity proof changed');
  expect(await readFile(path, 'utf8')).toBe(newer);
});
test('known checkpoint preserves completed and uncertain effects and exact bytes without replay', async () => {
  const { root, cp, path } = await fixture();
  cp.completed.push({ id: 'synthetic-completed-effect', action: 'Synthetic completed observation', completedAt: cp.updatedAt, verificationRefs: [cp.evidenceRefs[0]!.path], replay: 'do-not-repeat' });
  cp.uncertainEffects.push({ id: 'synthetic-uncertain-effect', action: 'Synthetic unknown response', reason: 'No terminal readback', requiredObservation: 'Read original owner receipt' });
  const bytes = JSON.stringify(cp); await writeFile(path, bytes);
  const context = await inspectContext({ root });
  expect(context.continuation.status).toBe('known-checkpoint-read');
  expect(context.retainedCheckpoint!.checkpoint.completed).toEqual(cp.completed);
  expect(context.retainedCheckpoint!.checkpoint.uncertainEffects).toEqual(cp.uncertainEffects);
  expect(await readFile(path, 'utf8')).toBe(bytes);
  await expect(buildCheckpoint(root)).rejects.toThrow('retained effects');
});
test('drift holds continuation, foreign Work and checkpoint symlinks fail without replacement', async () => {
  const { root, cp, path } = await fixture(); const bytes = JSON.stringify(cp); await writeFile(path, bytes);
  await writeFile(resolve(root, 'context/business-decisions.json'), '{"synthetic":"drift"}');
  expect((await inspectContext({ root })).continuation.status).toBe('held-source-repair-required');
  await expect(inspectContext({ root, workId: 'foreign-work' })).rejects.toThrow('mismatch');
  expect(await readFile(path, 'utf8')).toBe(bytes);
  const link = resolve(root, '.harness-runtime/linked-checkpoint.json'); await symlink(path, link);
  await expect(inspectContext({ root, checkpointPath: link })).rejects.toThrow('canonical');
  await expect(inspectContext({ root, checkpointPath: '/tmp/foreign.json' })).rejects.toThrow('outside');
});
