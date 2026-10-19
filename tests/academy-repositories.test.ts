import {test, expect} from 'bun:test';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readRepositoryWorkflow, validateRepositoryWorkflow, repositoryPlan, qualifyCommonProvider, commonInvocation} from '../src/academy-repositories.ts';

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
