import {readFile, realpath} from 'node:fs/promises';
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
function git(root: string, args: string[]): string {
  const result = spawnSync('git', ['-C', root, ...args], {encoding: 'utf8', maxBuffer: 1_048_576});
  if (result.error || result.status !== 0) throw Error('common_provider_git_verification_failed');
  return result.stdout.trim();
}
/** Pin transport source; never import/copy the canonical reader into this repository. */
export async function qualifyCommonProvider(workflow: AcademyRepositories, providerRoot: string): Promise<string> {
  const root = await realpath(providerRoot);
  if (await realpath(git(root, ['rev-parse', '--show-toplevel'])) !== root) throw Error('common_provider_root_mismatch');
  if (git(root, ['rev-parse', 'HEAD']) !== workflow.provider.commit) throw Error('common_provider_commit_mismatch');
  if (git(root, ['status', '--porcelain', '--untracked-files=normal'])) throw Error('common_provider_worktree_dirty');
  const entrypoint = resolve(root, workflow.provider.entrypoint);
  const target = await realpath(entrypoint);
  if (relative(root, target).startsWith('..') || isAbsolute(relative(root, target))) throw Error('common_provider_entrypoint_escape');
  return entrypoint;
}
export const commonCommands = ['validate', 'context', 'transition', 'start'] as const;
export async function commonInvocation(workflow: AcademyRepositories, providerRoot: string, command: string, requests: string[]): Promise<string[]> {
  if (!(commonCommands as readonly string[]).includes(command) || requests.length !== (command === 'transition' ? 2 : 1) || requests.some(p => !p || p.startsWith('-'))) throw Error('usage: work validate|context|start <request.json> --provider <root>; work transition <before.json> <after.json> --provider <root>');
  const entrypoint = await qualifyCommonProvider(workflow, providerRoot);
  return [process.execPath, '--no-env-file', entrypoint, command, ...requests.map(p => resolve(p))];
}
