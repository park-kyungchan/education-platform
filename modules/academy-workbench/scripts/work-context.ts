import { realpath, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import type { ContinuityCheckpoint } from '../harness/contracts.ts';
import type { SourceStatus } from '@agent-platform/work-context-types';
import { loadPlatform, moduleRoot, sha256 } from './agent-platform.ts';
import { validateConsumerSchema } from './consumer-validation.ts';

type Platform = Awaited<ReturnType<typeof loadPlatform>>;
type LocalIdentity = { projectId: string; workId: string; taskId: string; registration: 'local-module-record' };
async function present(path: string) {
  try { await lstat(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function capture(path: string, root: string, api: Platform) {
  const bytes = await api.readExact(path, root, api.localContextIo) as Uint8Array;
  return { path, bytes, sha256: sha256(bytes) };
}
const jsonBytes = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));

export async function buildCheckpoint(root = moduleRoot): Promise<ContinuityCheckpoint> {
  if (await present(resolve(root, '.harness-runtime/checkpoint.json'))) throw Error('Existing checkpoint must be resumed by its owner; a fresh projection will not reset retained effects.');
  return (await historicalProjection(root, await loadPlatform())).checkpoint;
}
/** Historical contract projection only; never current execution state or a saved checkpoint. */
async function historicalProjection(root: string, api: Platform) {
  // Pin the very bytes used for semantic identity before interpreting them. A later hash cannot replace this proof.
  const identityRead = await capture(resolve(root, 'harness/work/identity.json'), root, api);
  const schemaRead = await capture(resolve(root, 'harness/work/identity.schema.json'), root, api);
  const identityValue = jsonBytes(identityRead.bytes);
  if (!await validateConsumerSchema(identityValue, jsonBytes(schemaRead.bytes), api.source.root)) throw Error('Invalid local Work identity evidence.');
  const identity = identityValue as LocalIdentity;
  const sourcePins: ContinuityCheckpoint['sourcePins'] = [identityRead, schemaRead].map(({ path, sha256 }) => ({ path, sha256, role: 'context' }));
  for (const [name, recordKind] of [['project.json', 'project'], ['harness/work/task.json', 'task'], ['harness/work/run.json', 'run'], ['migration/current-status.json', null], ['context/business-decisions.json', null], ['context/user-context/records.json', null], ['context/user-context/coverage.json', null]] as const) {
    const path = resolve(root, name);
    sourcePins.push({ path, sha256: (await capture(path, root, api)).sha256, role: 'context', ...(recordKind ? { recordKind } : {}) });
  }
  const checkpoint: ContinuityCheckpoint = {
    schema: 'codex.continuity.checkpoint.v1', projectId: identity.projectId, workId: identity.workId, root,
    owner: { agentId: 'repository-consumer', threadId: 'local-unregistered-context' }, version: 1,
    updatedAt: '2026-10-13T23:11:05Z',
    purpose: {
      objective: 'Apply and review the pinned shared harness consumer without activating academy operations.',
      successCriteria: ['Pinned upstream validators pass', 'Local bounded contract checks pass', 'Existing operational gates remain open'],
      inScope: ['Consumer documentation, types, bootstrap and synthetic checks'],
      outOfScope: ['Real student reads', 'Academy writes, print and send', 'Credentials', 'Deployment', 'Native registration and user acceptance'],
    },
    // Generalized historical summaries are deliberately NOT actual-user-answer pins.
    userDecisions: [], completed: [],
    pending: [
      { id: identity.taskId, action: 'Review the implementation and its verification evidence.', dependsOn: [], status: 'ready' },
      { id: 'publish-reviewed-patch', action: 'Publish only the reviewed changed-file overlay and verify the remote result.', dependsOn: [identity.taskId], status: 'blocked' },
    ],
    nextAction: { taskId: identity.taskId, action: 'Review the consumer patch and verification scope.' },
    nativeThreads: [], evidenceRefs: sourcePins.map(pin => ({ ...pin, kind: 'source' as const })), sourcePins,
    uncertainEffects: [], uninterpretedInputs: [], authority: 'none', nativePermissionGranted: false,
  };
  return { checkpoint, identity, identityPin: { path: relative(root, identityRead.path), sha256: identityRead.sha256 } };
}

export function inspectionInvocation(operation: 'context-inspection' | 'harness-check') {
  return { id: `academy-invocation:${randomUUID()}`, operation, observedAt: new Date().toISOString(),
    identityClass: 'local-check-invocation' as const, nativeRunId: null, nativeAuthorshipVerified: false as const };
}

/** Read-only continuation. Native owners retain checkpoint/session custody and execution. */
export async function inspectContext(options: { root?: string; workId?: string; checkpointPath?: string } = {}) {
  const root = await realpath(options.root ?? moduleRoot), api = await loadPlatform();
  const invocation = inspectionInvocation('context-inspection');
  const history = await historicalProjection(root, api);
  const historical = api.validateCheckpoint(history.checkpoint) as ContinuityCheckpoint;
  const historicalStatus = await api.checkSources(historical.sourcePins, root, api.localContextIo) as SourceStatus;
  if (historicalStatus.status !== 'current') throw Error('Inspection held: historical source evidence changed or requires repair.');
  const checkpointPath = resolve(root, options.checkpointPath ?? '.harness-runtime/checkpoint.json');
  const selectedWorkId = options.workId ?? historical.workId;
  api.validateWorkContextRequest({ schema: 'codex.work-context.request.v1', projectId: historical.projectId,
    workId: selectedWorkId, root, cwd: root, checkpointPath, maxChars: 24000 });
  let retained: null | { checkpoint: ContinuityCheckpoint; sha256: string; sourceStatus: SourceStatus } = null;
  const checkpointPresent = await present(checkpointPath);
  if (checkpointPresent) {
    const bytes = await api.readExact(checkpointPath, root, api.localContextIo);
    const checkpoint = api.validateCheckpoint(jsonBytes(bytes)) as ContinuityCheckpoint;
    if (checkpoint.root !== root || checkpoint.projectId !== historical.projectId || checkpoint.workId !== selectedWorkId) throw Error('Checkpoint owner/project/Work mismatch; select the known Work explicitly without overwriting it.');
    const sourceStatus = await api.checkSources(checkpoint.sourcePins, root, api.localContextIo) as SourceStatus;
    retained = { checkpoint, sha256: sha256(bytes), sourceStatus };
  } else if (options.checkpointPath || selectedWorkId !== historical.workId) throw Error('Explicit or selected Work checkpoint is absent; inspection will not create or reset it.');
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' } }).trim();
  function gitIdentity() {
    const head = git('rev-parse', 'HEAD'), tree = git('rev-parse', `${head}^{tree}`);
    if (!/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(tree)) throw Error('Inspection held: invalid Git source identity.');
    const branch = git('branch', '--show-current') || null;
    let observedOriginMain: string | null = null;
    try { observedOriginMain = git('rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'); }
    catch (error) { if ((error as { status?: number }).status !== 1) throw error; }
    return { head, tree, branch, observedOriginMain };
  }
  const gitBefore = gitIdentity();
  const contextReads = [];
  // Metadata and hashes only. Do not emit private student values or user source bodies.
  for (const path of ['README.md', 'MIGRATION_PLAN.md', 'migration/current-status.json', 'context/user-context/coverage.json', 'context/student-audit-20261014/lesson-batch/work-identity.json', 'harness/module.json', 'harness/continuation-source.json']) {
    contextReads.push(await capture(resolve(root, path), root, api));
  }
  const statusBefore = git('status', '--porcelain', '--untracked-files=normal');
  const localStatus = statusBefore.split('\n').filter(Boolean);
  const identityProvesSelectedWork = history.identity.registration === 'local-module-record' && history.identity.projectId === historical.projectId && history.identity.workId === selectedWorkId;
  const result = { schema: 'academy.context-inspection.v1', invocation,
    governingSourceWork: jsonBytes(contextReads.find(row => row.path.endsWith('/harness/continuation-source.json'))!.bytes),
    currentSource: { ...gitBefore,
      trackedChangesPresent: localStatus.some(line => !line.startsWith('??')), untrackedChangesPresent: localStatus.some(line => line.startsWith('??')),
      remoteFreshness: 'not-revalidated-by-inspection', contextSources: contextReads.map(row => ({ path: relative(root, row.path), sha256: row.sha256 })),
      currentness: 'bounded-source-revalidation', atomicSnapshotClaimed: false },
    selectedWork: { projectId: historical.projectId, workId: selectedWorkId,
      registration: identityProvesSelectedWork ? 'local-module-record' : 'unverified',
      registrationEvidence: identityProvesSelectedWork ? { class: 'schema-valid-local-work-identity', ...history.identityPin }
        : { class: 'known-checkpoint-only', path: relative(root, checkpointPath), sha256: retained!.sha256 },
      nativeBindingVerified: false, globalRegistrationVerified: false },
    retainedCheckpoint: retained,
    continuation: retained ? { status: retained.sourceStatus.status === 'current' ? 'known-checkpoint-read' : 'held-source-repair-required',
      nextAction: retained.checkpoint.nextAction, checkpointSaved: false, nativeOwnerContinuationRequired: true }
      : { status: 'no-current-checkpoint-observed', nextAction: null, checkpointSaved: false, nativeOwnerContinuationRequired: true },
    historical: { classification: 'historical-consumer-contract-not-current-checkpoint', projectId: historical.projectId,
      workId: historical.workId, templateUpdatedAt: historical.updatedAt, purpose: historical.purpose,
      pending: historical.pending, nextAction: historical.nextAction, publicationStateRevalidated: false },
    boundaries: { sourceServerAccess: 'none', academyWrites: false, generatedAssessmentPaper: false,
      realQuestionSelection: false, nativeRegistrationPerformed: false, acceptanceInferred: false },
    authority: 'none', executionReady: false };
  if (JSON.stringify(result, null, 2).length > 24000) throw Error('Context exceeds bounded inspection budget; use the native owner bounded reader.');
  // Close the assembled observation after ALL initial source/Git/status reads. This is bounded revalidation, not a lock.
  if (await present(checkpointPath) !== checkpointPresent) throw Error('Inspection held: checkpoint presence changed during assembly; reobserve.');
  if (retained) {
    if ((await capture(checkpointPath, root, api)).sha256 !== retained.sha256) throw Error('Inspection held: checkpoint bytes changed during assembly; reobserve.');
    if (JSON.stringify(await api.checkSources(retained.checkpoint.sourcePins, root, api.localContextIo)) !== JSON.stringify(retained.sourceStatus)) throw Error('Inspection held: checkpoint source status changed during assembly; reobserve.');
  }
  if (JSON.stringify(await api.checkSources(historical.sourcePins, root, api.localContextIo)) !== JSON.stringify(historicalStatus)) throw Error('Inspection held: historical source or initial identity proof changed during assembly; reobserve.');
  for (const row of contextReads) if ((await capture(row.path, root, api)).sha256 !== row.sha256) throw Error('Inspection held: context source changed during assembly; reobserve.');
  const gitAfter = gitIdentity(), statusAfter = git('status', '--porcelain', '--untracked-files=normal');
  if (JSON.stringify(gitAfter) !== JSON.stringify(gitBefore) || statusAfter !== statusBefore) throw Error('Inspection held: Git source identity or status changed during assembly; reobserve.');
  return result;
}
if (import.meta.main) {
  const options: { workId?: string; checkpointPath?: string } = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i], value = process.argv[i + 1];
    if (!value || !['--work-id', '--checkpoint'].includes(flag!)) throw Error('Usage: context:inspect [--work-id KNOWN_WORK] [--checkpoint OWNED_PATH]');
    if (flag === '--work-id') { if (options.workId) throw Error('Duplicate Work selection'); options.workId = value; }
    else { if (options.checkpointPath) throw Error('Duplicate checkpoint selection'); options.checkpointPath = value; }
  }
  console.log(JSON.stringify(await inspectContext(options), null, 2));
}
