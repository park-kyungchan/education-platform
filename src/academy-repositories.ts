import {readFile, realpath, lstat, open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative, isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';

export type RepositoryRole = 'maintained' | 'native-source' | 'retained' | 'governance' | 'archived-contract' | 'provider';
export interface RepositoryRoute {
  repository: string;
  role: RepositoryRole;
  sourceCommit: string;
  sourceEvidence: string[];
  routes: {scope: string; repository: string; path: string; relationship: 'maintained' | 'source-reference' | 'contract-successor'}[];
  check: {runtime: string; commands: string[]; mode: 'owner-only' | 'reference-only'};
  work: null | {domainId: string; projectId: string; workId: string};
}
export interface AcademyRepositories {
  schema: 'education.academy-repositories.v1';
  priority: ['common-workflow', 'repository-ownership'];
  featureImplementation: 'external-pr';
  provider: {repository: string; commit: string; entrypoint: string};
  dependencies: {consumer: string; provider: string; kind: 'common-work-reader' | 'research-context' | 'mcp-source-contract'; evidence: string; consumption: 'selected-source-workflow' | 'source-declared-only'}[];
  repositories: RepositoryRoute[];
}
const roles: RepositoryRole[] = ['maintained', 'native-source', 'retained', 'governance', 'archived-contract', 'provider'];
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const oid = /^[0-9a-f]{40}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid_repository_workflow');
  return value as Record<string, unknown>;
}
function localPath(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.split('/').some(p => !p || p === '..' || p === '.')) throw Error('invalid_repository_path');
}
/** Domain routing only. Common Work schemas and validation remain with agent-platform. */
export function validateRepositoryWorkflow(value: unknown): AcademyRepositories {
  const input = record(value);
  if (input.schema !== 'education.academy-repositories.v1' || JSON.stringify(input.priority) !== '["common-workflow","repository-ownership"]' || input.featureImplementation !== 'external-pr') throw Error('invalid_repository_workflow');
  const provider = record(input.provider);
  if (provider.repository !== 'agent-platform' || typeof provider.commit !== 'string' || !oid.test(provider.commit) || provider.entrypoint !== 'scripts/harness.ts') throw Error('invalid_common_provider');
  if (!Array.isArray(input.repositories) || !input.repositories.length || input.repositories.length > 32) throw Error('invalid_repository_count');
  const names = new Set<string>();
  for (const raw of input.repositories) {
    const row = record(raw);
    if (typeof row.repository !== 'string' || !identifier.test(row.repository) || names.has(row.repository)) throw Error('duplicate_or_invalid_repository');
    names.add(row.repository);
    if (!roles.includes(row.role as RepositoryRole) || typeof row.sourceCommit !== 'string' || !oid.test(row.sourceCommit)) throw Error('invalid_repository_source');
    if (!Array.isArray(row.sourceEvidence) || !row.sourceEvidence.length) throw Error('missing_source_evidence');
    for (const path of row.sourceEvidence) localPath(path);
    const check = record(row.check);
    if (typeof check.runtime !== 'string' || !check.runtime || !Array.isArray(check.commands) || check.commands.some(c => typeof c !== 'string' || !c.trim()) || !['owner-only', 'reference-only'].includes(String(check.mode))) throw Error('invalid_owner_checks');
    if (row.work !== null) {
      const work = record(row.work);
      for (const field of ['domainId', 'projectId', 'workId']) if (typeof work[field] !== 'string' || !identifier.test(work[field] as string)) throw Error('invalid_work_route');
      if (row.role !== 'maintained') throw Error('nonmaintained_work_route');
    }
    if (!Array.isArray(row.routes) || !row.routes.length) throw Error('missing_owner_routes');
    for (const rawRoute of row.routes) {
      const route = record(rawRoute);
      if (typeof route.scope !== 'string' || !route.scope || typeof route.repository !== 'string' || !identifier.test(route.repository) || !['maintained', 'source-reference', 'contract-successor'].includes(String(route.relationship))) throw Error('invalid_owner_route');
      if (route.path !== '.') localPath(route.path);
    }
  }
  for (const row of input.repositories as RepositoryRoute[]) for (const route of row.routes) if (!names.has(route.repository)) throw Error('missing_owner_repository');
  const providers = (input.repositories as RepositoryRoute[]).filter(r => r.role === 'provider');
  if (providers.length !== 1 || providers[0]!.repository !== provider.repository || providers[0]!.sourceCommit !== provider.commit) throw Error('provider_source_mismatch');
  if (!Array.isArray(input.dependencies)) throw Error('missing_source_dependencies');
  const edges = new Set<string>();
  for (const raw of input.dependencies) {
    const edge = record(raw);
    if (typeof edge.consumer !== 'string' || typeof edge.provider !== 'string' || !names.has(edge.consumer) || !names.has(edge.provider) || edge.consumer === edge.provider || !['common-work-reader', 'research-context', 'mcp-source-contract'].includes(String(edge.kind)) || !['selected-source-workflow', 'source-declared-only'].includes(String(edge.consumption))) throw Error('invalid_source_dependency');
    localPath(edge.evidence);
    const key = [edge.consumer, edge.provider, edge.kind].join(':');
    if (edges.has(key)) throw Error('duplicate_source_dependency');
    edges.add(key);
  }
  return value as AcademyRepositories;
}
export async function readRepositoryWorkflow(path = new URL('../architecture/academy-repositories.json', import.meta.url)): Promise<AcademyRepositories> {
  return validateRepositoryWorkflow(JSON.parse(await readFile(path, 'utf8')));
}
export function repositoryPlan(workflow: AcademyRepositories, repository?: string) {
  const selected = repository ? workflow.repositories.filter(r => r.repository === repository) : workflow.repositories;
  if (!selected.length) throw Error('unknown_repository');
  return {schema: 'education.academy-repository-plan.v1', priority: workflow.priority, featureImplementation: workflow.featureImplementation, execution: 'plan-only', runtimeActivation: false, dependencies: workflow.dependencies.filter(d => !repository || d.consumer === repository || d.provider === repository), repositories: selected};
}
/** Transport-local environment only; importing the provider to obtain it would precede qualification. */
export function commonGitEnvironment(input: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(input).filter(([key]) => !/^GIT_/i.test(key)));
  return {...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_ATTR_NOSYSTEM: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1'};
}
function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['--no-replace-objects', '--no-pager', '--literal-pathspecs', '-c', 'core.fsmonitor=false', '-C', root, ...args], {env: commonGitEnvironment(), encoding: 'utf8', maxBuffer: 1_048_576, timeout: 10_000});
  if (result.error || result.status !== 0) throw Error('common_provider_git_verification_failed');
  return result.stdout;
}
interface TrackedBlob {path: string; mode: string; oid: string; size: number}
function trackedTree(root: string, commit: string): TrackedBlob[] {
  const rows = git(root, ['ls-tree', '-r', '-z', '--long', commit]).split('\0').filter(Boolean);
  if (!rows.length || rows.length > 4096) throw Error('common_provider_source_limit');
  let total = 0;
  return rows.map(row => {
    const match = /^(100644|100755) blob ([0-9a-f]{40}|[0-9a-f]{64}) +([0-9]+)\t([^\0\r\n]+)$/.exec(row);
    if (!match) throw Error('common_provider_source_type');
    const [, mode, oid, length, path] = match;
    localPath(path);
    const size = Number(length); total += size;
    if (!Number.isSafeInteger(size) || size > 2_097_152 || total > 67_108_864) throw Error('common_provider_source_limit');
    return {path, mode: mode!, oid: oid!, size};
  });
}
function checkedIndex(root: string, tree: TrackedBlob[]): string {
  const raw = git(root, ['ls-files', '--stage', '-v', '-f', '-z']), rows = raw.split('\0').filter(Boolean);
  const expected = new Map(tree.map(row => [row.path, row]));
  for (const row of rows) {
    // Lowercase tags mean assume-unchanged/fsmonitor-valid; S means skip-worktree.
    const match = /^H (100644|100755) ([0-9a-f]{40}|[0-9a-f]{64}) 0\t([^\0\r\n]+)$/.exec(row);
    if (!match) throw Error('common_provider_index_flags_or_stage');
    const source = expected.get(match[3]!);
    if (!source || source.mode !== match[1] || source.oid !== match[2]) throw Error('common_provider_worktree_dirty');
    expected.delete(source.path);
  }
  if (expected.size) throw Error('common_provider_worktree_dirty');
  return raw;
}
/** Linux descriptor walk confines reads to regular tracked files, including import/package/lock sources. */
async function verifyPhysicalBlob(root: string, source: TrackedBlob): Promise<void> {
  const target = resolve(root, source.path);
  if (await realpath(target) !== target) throw Error('common_provider_source_escape');
  let directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    if (await realpath('/proc/self/fd/' + directory.fd) !== root) throw Error('common_provider_source_escape');
    const parts = source.path.split('/');
    for (const part of parts.slice(0, -1)) {
      const next = await open('/proc/self/fd/' + directory.fd + '/' + part, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      await directory.close(); directory = next;
    }
    const file = await open('/proc/self/fd/' + directory.fd + '/' + parts.at(-1), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat();
      if (!before.isFile() || before.size !== source.size || Boolean(before.mode & 0o111) !== (source.mode === '100755')) throw Error('common_provider_worktree_dirty');
      const bytes = Buffer.alloc(source.size + 1); let count = 0;
      while (count < bytes.length) { const next = await file.read(bytes, count, bytes.length - count, null); if (!next.bytesRead) break; count += next.bytesRead; }
      const after = await file.stat(), named = await lstat(target);
      if (count !== source.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || after.mode !== before.mode || named.dev !== before.dev || named.ino !== before.ino || await realpath(target) !== target) throw Error('common_provider_source_changed');
      const blob = createHash(source.oid.length === 40 ? 'sha1' : 'sha256').update('blob ' + count + '\0').update(bytes.subarray(0, count)).digest('hex');
      if (blob !== source.oid) throw Error('common_provider_worktree_dirty');
    } finally { await file.close(); }
  } finally { await directory.close(); }
}
/** Verify the entire tracked source tree without importing provider code. Installed dependencies and
 * the interval before native execution remain separate boundaries, not an immutable execution claim. */
export async function qualifyCommonProvider(workflow: AcademyRepositories, providerRoot: string): Promise<string> {
  const root = await realpath(providerRoot);
  if (await realpath(git(root, ['rev-parse', '--show-toplevel']).trim()) !== root) throw Error('common_provider_root_mismatch');
  if (git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim() !== workflow.provider.commit) throw Error('common_provider_commit_mismatch');
  const tree = trackedTree(root, workflow.provider.commit), index = checkedIndex(root, tree);
  if (git(root, ['ls-files', '--others', '--exclude-standard', '-z'])) throw Error('common_provider_worktree_dirty');
  if (!tree.some(row => row.path === workflow.provider.entrypoint)) throw Error('common_provider_entrypoint_untracked');
  for (const source of tree) await verifyPhysicalBlob(root, source);
  if (checkedIndex(root, tree) !== index || git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim() !== workflow.provider.commit || git(root, ['ls-files', '--others', '--exclude-standard', '-z'])) throw Error('common_provider_source_changed');
  const entrypoint = resolve(root, workflow.provider.entrypoint);
  const target = await realpath(entrypoint);
  if (relative(root, target).startsWith('..') || isAbsolute(relative(root, target))) throw Error('common_provider_entrypoint_escape');
  return entrypoint;
}
export const commonCommands = ['validate', 'context', 'transition', 'start', 'source'] as const;
export async function commonInvocation(workflow: AcademyRepositories, providerRoot: string, command: string, requests: string[]): Promise<string[]> {
  if (!(commonCommands as readonly string[]).includes(command) || requests.length !== (command === 'transition' || command === 'source' ? 2 : 1) || requests.some(p => !p || p.startsWith('-'))) throw Error('usage: work validate|context|start <request.json> --provider <root>; work transition <before.json> <after.json> --provider <root>; work source <snapshot.json> <repository-relative-path> --provider <root>');
  if (command === 'source') localPath(requests[1]);
  const entrypoint = await qualifyCommonProvider(workflow, providerRoot);
  return [process.execPath, '--no-env-file', entrypoint, command, ...(command === 'source' ? [resolve(requests[0]!), requests[1]!] : requests.map(p => resolve(p)))];
}
