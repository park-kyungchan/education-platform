import {test, expect} from 'bun:test';
import {mkdtemp, mkdir, writeFile, rm, readFile, symlink, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readRepositoryWorkflow, validateRepositoryWorkflow, repositoryPlan, qualifyCommonProvider, commonInvocation, commonGitEnvironment} from '../src/academy-repositories.ts';

test('the plan routes all source families without executing owner checks or feature work', async () => {
  const workflow = await readRepositoryWorkflow();
  const plan = repositoryPlan(workflow);
  expect(plan.repositories).toHaveLength(15);
  expect(plan.execution).toBe('plan-only');
  expect(plan.featureImplementation).toBe('external-pr');
  expect(workflow.repositories.filter(r => r.work).map(r => r.repository)).toEqual(['education-platform', 'academy-workbench', 'math-research-module']);
  expect(repositoryPlan(workflow, 'gang-a').repositories[0]!.routes[0]!.repository).toBe('education-platform');
  expect(() => repositoryPlan(workflow, 'unknown')).toThrow('unknown_repository');
});

function fixtureGit(root: string, args: string[], input?: string, replacements = false): string {
  const env = commonGitEnvironment();
  if (replacements) delete env.GIT_NO_REPLACE_OBJECTS;
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', '-C', root, ...args], {env, input, encoding: 'utf8', timeout: 10_000});
  if (result.error || result.status !== 0) throw Error('synthetic_git_failed:' + args[0]);
  return result.stdout.trim();
}
async function providerFixture(run: (root: string, workflow: Awaited<ReturnType<typeof readRepositoryWorkflow>>) => Promise<void>, entrypoint = 'import "../src/reader.ts";\n') {
  const root = await mkdtemp(join(tmpdir(), 'academy-provider-regression-'));
  try {
    fixtureGit(root, ['init', '--initial-branch=main', '-q']);
    await mkdir(join(root, 'scripts')); await mkdir(join(root, 'src'));
    await writeFile(join(root, 'scripts/harness.ts'), entrypoint);
    await writeFile(join(root, 'src/reader.ts'), 'export const value = 1;\n');
    await writeFile(join(root, 'package.json'), '{"type":"module"}\n');
    await writeFile(join(root, 'bun.lock'), 'synthetic locked dependency metadata\n');
    fixtureGit(root, ['add', '.']);
    fixtureGit(root, ['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'Synthetic immutable provider']);
    const workflow = await readRepositoryWorkflow(); workflow.provider.commit = fixtureGit(root, ['rev-parse', 'HEAD']);
    await run(root, workflow);
  } finally { await rm(root, {recursive: true, force: true}); }
}
async function withGitEnvironment(values: NodeJS.ProcessEnv, run: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try { for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await run(); }
  finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

test('hidden assume-unchanged and skip-worktree bytes cannot qualify executable or imported source', async () => {
  for (const flag of ['--assume-unchanged', '--skip-worktree']) for (const path of ['scripts/harness.ts', 'src/reader.ts']) await providerFixture(async (root, workflow) => {
    fixtureGit(root, ['update-index', flag, path]);
    await writeFile(join(root, path), 'throw Error("unqualified fixture source");\n');
    expect(fixtureGit(root, ['status', '--porcelain'])).toBe('');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('index_flags_or_stage');
  });
});

test('ordinary stage-zero physical source is checked even when Git trusts unchanged stat metadata', async () => {
  await providerFixture(async (root, workflow) => {
    const path = join(root, 'src/reader.ts'), timestamp = new Date('2000-01-01T00:00:00Z');
    fixtureGit(root, ['config', 'core.trustctime', 'false']); fixtureGit(root, ['config', 'core.checkStat', 'minimal']);
    // Keep the cached timestamp older than the index so Git's racy-timestamp fallback cannot mask this case.
    await utimes(path, timestamp, timestamp); fixtureGit(root, ['update-index', '--refresh']);
    await writeFile(path, 'export const value = 2;\n'); await utimes(path, timestamp, timestamp);
    expect(fixtureGit(root, ['ls-files', '-v', 'src/reader.ts']).startsWith('H ')).toBeTrue();
    expect(fixtureGit(root, ['status', '--porcelain'])).toBe('');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('worktree_dirty');
  });
});

test('replacement-backed apparently clean checkout cannot substitute the pinned provider tree', async () => {
  await providerFixture(async (root, workflow) => {
    const original = workflow.provider.commit;
    await writeFile(join(root, 'scripts/harness.ts'), 'throw Error("replacement fixture");\n');
    fixtureGit(root, ['add', '.']); fixtureGit(root, ['-c', 'user.name=Synthetic Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '-qm', 'Synthetic replacement']);
    const replacement = fixtureGit(root, ['rev-parse', 'HEAD']);
    fixtureGit(root, ['update-ref', 'refs/heads/main', original]); fixtureGit(root, ['replace', original, replacement]);
    expect(fixtureGit(root, ['rev-parse', 'HEAD'], undefined, true)).toBe(original);
    expect(fixtureGit(root, ['status', '--porcelain'], undefined, true)).toBe('');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('worktree_dirty');
  });
});

test('import/package/lock drift, unmerged stages and symlink source escapes are refused', async () => {
  for (const path of ['src/reader.ts', 'package.json', 'bun.lock']) await providerFixture(async (root, workflow) => {
    await writeFile(join(root, path), 'changed fixture bytes\n');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('worktree_dirty');
  });
  await providerFixture(async (root, workflow) => {
    const oid = fixtureGit(root, ['rev-parse', 'HEAD:src/reader.ts']);
    fixtureGit(root, ['update-index', '--index-info'], '0 ' + '0'.repeat(40) + '\tsrc/reader.ts\n100644 ' + oid + ' 1\tsrc/reader.ts\n100644 ' + oid + ' 2\tsrc/reader.ts\n');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('index_flags_or_stage');
  });
  await providerFixture(async (root, workflow) => {
    const outside = await mkdtemp(join(tmpdir(), 'academy-outside-source-'));
    try {
      await writeFile(join(outside, 'reader.ts'), 'export const value = 1;\n');
      await rm(join(root, 'src/reader.ts')); await symlink(join(outside, 'reader.ts'), join(root, 'src/reader.ts'));
      await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('source_escape');
    } finally { await rm(outside, {recursive: true, force: true}); }
  });
});

test('qualification and actual forwarded child discard inherited Git redirection/config/object flags', async () => {
  const entrypoint = 'console.log(JSON.stringify({leaked:Object.keys(process.env).filter(key=>["GIT_DIR","GIT_WORK_TREE","GIT_INDEX_FILE","GIT_COMMON_DIR","GIT_OBJECT_DIRECTORY","GIT_ALTERNATE_OBJECT_DIRECTORIES","GIT_CONFIG_COUNT","GIT_CONFIG_KEY_0","GIT_CONFIG_VALUE_0","GIT_CONFIG_PARAMETERS","GIT_REPLACE_REF_BASE","GIT_EXEC_PATH"].includes(key)),replacementsDisabled:process.env.GIT_NO_REPLACE_OBJECTS==="1",args:process.argv.slice(2)}));\n';
  await providerFixture(async (root, workflow) => {
    const app = await mkdtemp(join(tmpdir(), 'academy-transport-fixture-'));
    try {
      for (const directory of ['src', 'scripts', 'architecture']) await mkdir(join(app, directory));
      for (const path of ['src/academy-repositories.ts', 'scripts/academy-repositories.ts']) await writeFile(join(app, path), await readFile(new URL('../' + path, import.meta.url)));
      workflow.repositories.find(row => row.role === 'provider')!.sourceCommit = workflow.provider.commit;
      await writeFile(join(app, 'architecture/academy-repositories.json'), JSON.stringify(workflow));
      const hostile = {GIT_DIR: '/synthetic/missing.git', GIT_WORK_TREE: '/synthetic/missing', GIT_INDEX_FILE: '/synthetic/index', GIT_COMMON_DIR: '/synthetic/common', GIT_OBJECT_DIRECTORY: '/synthetic/objects', GIT_ALTERNATE_OBJECT_DIRECTORIES: '/synthetic/alternate', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: '/synthetic/worktree', GIT_CONFIG_PARAMETERS: "'core.worktree=/synthetic/parameters'", GIT_REPLACE_REF_BASE: 'refs/synthetic/', GIT_EXEC_PATH: '/synthetic/git-exec'};
      await withGitEnvironment(hostile, async () => {
        expect(await qualifyCommonProvider(workflow, root)).toBe(join(root, 'scripts/harness.ts'));
        const child = Bun.spawn([process.execPath, '--no-env-file', join(app, 'scripts/academy-repositories.ts'), 'work', 'validate', 'request.json', '--provider', root], {env: process.env, stdout: 'pipe', stderr: 'pipe'});
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
        expect(stderr).toBe(''); expect(code).toBe(0);
        expect(JSON.parse(stdout)).toEqual({leaked: [], replacementsDisabled: true, args: ['validate', join(process.cwd(), 'request.json')]});
      });
    } finally { await rm(app, {recursive: true, force: true}); }
  }, entrypoint);
});
test('routing rejects missing owners, duplicate repositories, traversal, and a changed provider pin', async () => {
  const source = await readRepositoryWorkflow();
  for (const change of [
    (w: any) => w.repositories.push(w.repositories[0]),
    (w: any) => w.repositories[0].routes[0].repository = 'absent',
    (w: any) => w.repositories[0].routes[0].path = '../native',
    (w: any) => w.provider.commit = 'f'.repeat(40),
    (w: any) => w.repositories.find((r: any) => r.role === 'retained').work = source.repositories[0]!.work,
    (w: any) => w.dependencies[0].provider = 'absent',
    (w: any) => w.dependencies.push(w.dependencies[0]),
  ]) {
    const input = structuredClone(source); change(input);
    expect(() => validateRepositoryWorkflow(input)).toThrow();
  }
});
test('canonical command transport rejects arbitrary commands and wrong request arity before dispatch', async () => {
  const workflow = await readRepositoryWorkflow();
  for (const [command, paths] of [['run', ['x']], ['validate', ['x', 'y']], ['transition', ['x']], ['context', ['--eval']]] as const) await expect(commonInvocation(workflow, '/does-not-exist', command, [...paths])).rejects.toThrow('usage:');
  await expect(commonInvocation(workflow, '/does-not-exist', 'source', ['request.json', '../native.json'])).rejects.toThrow('invalid_repository_path');
});
test('provider qualification binds the exact Git root, commit and clean source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'academy-provider-'));
  function git(...args: string[]) {
    const result = spawnSync('git', ['-C', root, ...args], {encoding: 'utf8'});
    if (result.status !== 0) throw Error('test_git_failed');
    return result.stdout.trim();
  }
  try {
    git('init', '-q'); git('config', 'user.name', 'Synthetic Test'); git('config', 'user.email', 'synthetic@example.invalid');
    await mkdir(join(root, 'scripts'));
    await writeFile(join(root, 'scripts/harness.ts'), 'export {};\n');
    git('add', '.'); git('-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Synthetic provider fixture');
    const workflow = await readRepositoryWorkflow(); workflow.provider.commit = git('rev-parse', 'HEAD');
    expect(await qualifyCommonProvider(workflow, root)).toBe(join(root, 'scripts/harness.ts'));
    const argv = await commonInvocation(workflow, root, 'validate', ['request.json']);
    expect(argv.slice(1, 4)).toEqual(['--no-env-file', join(root, 'scripts/harness.ts'), 'validate']);
    const sourceArgv = await commonInvocation(workflow, root, 'source', ['request.json', 'work/project/selected/inputs/original.json']);
    expect(sourceArgv.at(-1)).toBe('work/project/selected/inputs/original.json');
    await expect(qualifyCommonProvider(workflow, join(root, 'scripts'))).rejects.toThrow('root_mismatch');
    await writeFile(join(root, 'untracked.ts'), 'export {};\n');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('worktree_dirty');
    await rm(join(root, 'untracked.ts'));
    await writeFile(join(root, 'scripts/harness.ts'), 'throw Error("changed");\n');
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('worktree_dirty');
    workflow.provider.commit = 'f'.repeat(40);
    await expect(qualifyCommonProvider(workflow, root)).rejects.toThrow('commit_mismatch');
  } finally { await rm(root, {recursive: true, force: true}); }
});
