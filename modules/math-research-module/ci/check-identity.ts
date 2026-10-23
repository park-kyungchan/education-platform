/** Module linkage only. Canonical Artifact semantics stay with pinned agent-platform. */
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { loadPlatform, moduleRoot, readJson } from '../scripts/agent-platform.ts';
export async function validateCiIdentity(identity:any, project:any, task:any, run:any) {
  const api = await loadPlatform();
  const checked = api.validateReferences([project,task,run]);
  if (!checked.valid) throw Error(JSON.stringify(checked.issues));
  if (identity.projectId !== project.projectId || identity.domainId !== project.domainId ||
      identity.projectArtifactId !== project.id || identity.taskId !== task.id || identity.runId !== run.id ||
      task.projectId !== project.projectId || run.projectId !== project.projectId ||
      task.domainId !== project.domainId || run.domainId !== project.domainId ||
      task.payload.details?.workId !== identity.workId || run.payload.details?.workId !== identity.workId ||
      run.payload.taskRef !== task.id || identity.registration !== 'local-module-record' ||
      identity.globallyRegistered !== false || identity.authority !== 'none' || identity.nativePermissionGranted !== false ||
      identity.acceptanceDecisionObserved !== false) throw Error('CI Work/Task/Run linkage or authority mismatch');
  return {status:'pass',scope:'ci-record-linkage-only',workId:identity.workId,source:api.source.commit,
    executionId:`math-research-module:ci-check:${randomUUID()}`,implementationRunId:run.id,
    recordedRunModified:false,hostedWorkflowResult:'not-inferred',nativePermissionGranted:false};
}
export async function checkCiIdentity() {
  const project = await readJson(resolve(moduleRoot,'project.json'));
  const checks=[];
  for(const directory of ['harness/ci','harness/ci/successor-20261017','harness/ci/importer-closure-20261017']) {
    const values=await Promise.all(['identity.json','task.json','run.json'].map(path=>readJson(resolve(moduleRoot,directory,path))));
    checks.push(await validateCiIdentity(values[0],project,values[1],values[2]));
  }
  return {...checks[0]!,checks,recordedRunsModified:false};
}
if (import.meta.main) console.log(JSON.stringify(await checkCiIdentity()));
