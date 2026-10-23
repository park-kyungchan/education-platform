/** Module-owned onboarding checks; canonical Artifact/WorkContext validation remains upstream. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadPlatform, moduleRoot, readPin } from './agent-platform.ts';

export function validateHandoff(handoff: any, records: any[], sourceCommit: string) {
  const project = records.find(r => r.kind === 'project');
  const task = records.find(r => r.id === handoff.historicalWork?.taskId);
  const run = records.find(r => r.id === handoff.historicalWork?.runId);
  if (handoff.schemaVersion !== 'module.current-handoff/1' || !project ||
      handoff.projectId !== project.projectId || handoff.domainId !== project.domainId || handoff.projectArtifactId !== project.id ||
      records.some(r => r.projectId !== project.projectId || r.domainId !== project.domainId) ||
      task?.kind !== 'task' || run?.kind !== 'run' || run.payload.taskRef !== task.id ||
      task.payload.details?.workId !== handoff.historicalWork.workId || run.payload.details?.workId !== handoff.historicalWork.workId)
    throw Error('Current handoff identity does not match canonical module records');
  if (handoff.canonicalSourceCommit !== sourceCommit) throw Error('Current handoff source pin mismatch');
  if (handoff.registration !== 'local-module-record' || handoff.globallyRegistered !== false || handoff.authority !== 'none' ||
      handoff.nativePermissionGranted !== false || handoff.acceptanceDecisionObserved !== false)
    throw Error('Current handoff cannot grant registration, authority or acceptance');
  const publication = handoff.lastObservedPublication;
  if (!publication || publication.repository !== `park-kyungchan/${project.projectId}` || publication.branch !== 'main' ||
      !/^[0-9a-f]{40}$/.test(publication.commit) || publication.url !== `https://github.com/${publication.repository}/commit/${publication.commit}` ||
      !Number.isFinite(Date.parse(publication.observedAt)) || !Number.isFinite(Date.parse(publication.mergedAt)) ||
      Date.parse(publication.observedAt) < Date.parse(publication.mergedAt))
    throw Error('Invalid dated publication evidence');
  return {projectId: project.projectId, domainId: project.domainId, historicalWork: handoff.historicalWork,
    lastObservedPublication: publication, registration: handoff.registration, nativeRegistrationPerformed: false, acceptanceDecisionObserved: false};
}

export async function checkOnboarding() {
  const [major, minor, patch] = Bun.version.split('.').map(Number);
  if (major < 1 || (major === 1 && (minor < 4 || (minor === 4 && patch < 2))))
    throw Error('Use the documented Bun 1.4.2+ toolchain');
  const nodeVersion = execFileSync('node', ['--version'], {encoding: 'utf8'}).trim();
  if (Number(nodeVersion.replace(/^v/, '').split('.')[0]) < 24) throw Error('Node 24+ is required for the documented tests/runtime');
  const api = await loadPlatform();
  const json = async (path: string) => JSON.parse(await readFile(resolve(moduleRoot, path), 'utf8'));
  const records = await json('harness/records.json');
  const canonical = api.validateReferences(records);
  if (!canonical.valid) throw Error(JSON.stringify(canonical.issues));
  const result = validateHandoff(await json('harness/current-handoff.json'), records, (await readPin()).commit);
  console.log(JSON.stringify({status: 'pass', toolchain: {bun: Bun.version, node: nodeVersion}, source: api.source, ...result,
    next: 'Read docs/CONTINUE.ko.md before selecting or creating a Work. Checks never register a native session or replay publication.'}, null, 2));
  return result;
}
if (import.meta.main) await checkOnboarding();
