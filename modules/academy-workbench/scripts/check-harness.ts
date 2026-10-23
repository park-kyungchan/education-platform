import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { ModuleManifest } from '../harness/contracts.ts';
import { loadPlatform, moduleRoot, readJson, sha256 } from './agent-platform.ts';
import { inspectContext, inspectionInvocation } from './work-context.ts';
import { validateModule, validateIdentity } from './consumer-validation.ts';
export { validateLocalSchema, validateModule, validateIdentity } from './consumer-validation.ts';
export async function checkHarness() {
  const invocation = inspectionInvocation('harness-check');
  const api = await loadPlatform();
  const artifacts = await Promise.all(['project.json', 'harness/work/task.json', 'harness/work/run.json', 'harness/work/evidence.json', 'harness/work/verification.json'].map(p => readJson(resolve(moduleRoot, p))));
  for (const record of artifacts) {
    const result = api.validateArtifact(record);
    if (!result.valid) throw Error(JSON.stringify(result.issues));
  }
  const references = api.validateReferences(artifacts);
  if (!references.valid) throw Error(JSON.stringify(references.issues));
  const module = await readJson(resolve(moduleRoot, 'harness/module.json')) as ModuleManifest;
  if (!await validateModule(module, api.source.root)) throw Error('Invalid bounded module manifest');
  const project = artifacts[0] as { id: string; projectId: string; domainId: string };
  if (module.moduleId !== project.projectId || module.projectRef !== project.id) throw Error('Module/project identity mismatch');
  if (module.registration.status !== 'local-module-record' || module.registration.globallyRegistered !== false || module.registration.centralIssuer !== 'not-established') throw Error('Unverified registration claim');
  if (module.acceptance.status !== 'not-observed' || module.acceptance.inferredFromTests !== false) throw Error('Tests do not establish user acceptance');
  if (module.canonicalDependency.copiedImplementation !== false || module.canonicalDependency.consumption !== 'pinned-source') throw Error('Canonical source must remain externally owned');
  if (module.capability.authority !== 'none' || Object.entries(module.capability).some(([key, value]) => (key.endsWith('Enabled') || key.endsWith('Granted') || key.endsWith('Performed')) && value !== false)) throw Error('Capability declaration must not grant authority or enable execution');
  if (module.relationships.some(x => x.automaticDataTransfer !== false)) throw Error('Module relation does not authorize data transfer');
  const context = await inspectContext();
  const checkpoint = context.historical;
  if (context.continuation.status === 'held-source-repair-required') throw Error('Retained checkpoint sources require owner review; no reset was performed.');
  const identity = await readJson(resolve(moduleRoot, 'harness/work/identity.json')) as Record<string, unknown>;
  if (!await validateIdentity(identity, api.source.root)) throw Error('Invalid local work identity');
  for (const record of artifacts.slice(1, 3) as Array<{ payload: { details?: { workId?: string } } }>) if (record.payload.details?.workId !== identity.workId) throw Error('Task/Run Work relation mismatch');
  if (identity.taskId !== (artifacts[1] as { id: string }).id || identity.runId !== (artifacts[2] as { id: string }).id) throw Error('Task/Run identity mismatch');
  if (identity.projectId !== project.projectId || identity.domainId !== project.domainId || identity.workId !== checkpoint.workId || identity.globallyRegistered !== false) throw Error('Work identity mismatch');
  const baseline = await readJson(resolve(moduleRoot, 'harness/preservation-baseline.json')) as { sourceFiles: Array<{ path: string; sha256: string }> };
  for (const pin of baseline.sourceFiles) if (sha256(await readFile(resolve(moduleRoot, pin.path))) !== pin.sha256) throw Error(`Historical source changed: ${pin.path}`);
  return { status: 'pass', invocation, source: api.source, artifactCount: artifacts.length, closedReferences: 'pass', checkpoint: context.continuation.status,
    identity: { projectId: project.projectId, workId: checkpoint.workId, registration: module.registration.status },
    historicalRun: { id: identity.runId, classification: 'retained-source-record', currentInvocation: false, nativeAuthorshipVerified: false },
    historicalGateBytes: 'unchanged', archiveContentsRechecked: false, runtimeActivated: false, actualUserAcceptance: 'not-observed' };
}
if (import.meta.main) console.log(JSON.stringify(await checkHarness(), null, 2));
