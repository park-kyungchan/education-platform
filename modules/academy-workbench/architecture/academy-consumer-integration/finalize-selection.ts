/** Finish the remaining small checks after the saved SDK failure. Never repeats the heavy check. */
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';

const root = resolve(import.meta.dir, '../..');
const arc = import.meta.dir;
const work = resolve(root, 'work/academy-workbench/academy-consumer-integration-20261021');
const commonRoot = '/home/palantirkc/projects/agent-platform';
const commonPin = '712f90deac0676e662dc5d75d88d89f7b6773bfe';
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const load = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const writeNew = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const command = async (args: string[], cwd = root) => {
  const child = Bun.spawn(args, {cwd, stdout: 'pipe', stderr: 'pipe'});
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return {command: args, cwd, stdout, stderr, exitCode};
};
const git = async (cwd: string, args: string[]) => {
  const r = await command(['git', ...args], cwd); assert.equal(r.exitCode, 0, r.stderr); return r.stdout.trim();
};
const now = new Date().toISOString();
const prior = await load(resolve(arc, 'observations/CON-01-CHECKS-R1.json'));
assert.equal(prior.passed.length, 2);
assert.equal(prior.failed.length, 1);
const selectedTransport = await load(resolve(arc, 'observations/CON-01-SAVED-TRANSPORT-R1.json'));
assert.equal(selectedTransport.exitCode, 1);
assert.ok(selectedTransport.stderr.includes('7 pass') && selectedTransport.stderr.includes('2 fail'));

const reportCheck = await command([process.execPath, 'node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'esnext', '--module', 'esnext', '--skipLibCheck', 'architecture/academy-consumer-integration/report-contract.ts']);
await writeNew(resolve(arc, 'observations/CON-01-REPORT-TYPECHECK-R1.json'), reportCheck);
assert.equal(reportCheck.exitCode, 0, reportCheck.stderr);
assert.equal(await git(commonRoot, ['rev-parse', 'HEAD']), commonPin);
assert.equal(await git(commonRoot, ['status', '--porcelain']), '');
const common = await import(resolve(commonRoot, 'packages/work-continuity/src/git-work/index.ts'));
const {validateArtifact} = await import(resolve(commonRoot, 'packages/ontology/src/index.ts'));
const selection = await load(resolve(arc, 'source-selection.json'));
const reader = await common.openGitWork({repositoryRoot: root, repositoryId: 'park-kyungchan/academy-workbench', commit: selection.sourceHead, projectId: 'academy-workbench', workId: 'academy-consumer-integration-20261021'});
const baseCheck = await common.validateGitWorkRecords(reader);
assert.equal(baseCheck.valid, true, JSON.stringify(baseCheck.findings));
const taskPath = resolve(work, 'tasks/academy-workbench%3Atask%3Aacademy-consumer-integration-20261021-con-01.json');
const task = await load(taskPath);
const target = common.taskVerificationTarget(task);
const executionInput = await load(resolve(work, 'inputs/CON-01-EXECUTION-R1.json'));
common.assertRecord(executionInput); common.assertRecord(task);

const supplement = {
  schema: 'academy.consumer-selection-check-continuation.v1', createdAt: now,
  reason: 'Complete only checks not reached after selected SDK failure; original failure receipt is immutable.',
  heavyChecksRepeated: 0,
  passed: ['report design typecheck', 'clean external common712f90de APIs and canonical existing Work snapshot', 'actual taskVerificationTarget', 'authored artifact minimization/format review'],
  failed: ['saved SDK stdio: 2 failed / 7 passed in original single heavy run; CONNECTION_CLOSED cause unresolved'],
  notRun: prior.notRun,
  canonicalBase: {commit: selection.sourceHead, ...baseCheck}, commonPin, taskVerificationTarget: target,
  realOriginalsRead: false, sourceEffects: false,
};
await writeNew(resolve(arc, 'observations/CON-01-CHECK-CONTINUATION-R1.json'), supplement);

const entry = await load(resolve(arc, 'entrypoint.json'));
entry.state = 'READY_FOR_ROOT_SOURCE_CHECKPOINT';
entry.checkContinuation = 'observations/CON-01-CHECK-CONTINUATION-R1.json';
entry.sdkTransport = '7 passed / 2 failed; exact current adoption gap, no transport acceptance';
entry.canonicalCheckpoint = {auditorRoot: commonRoot, pin: commonPin, taskVerificationTarget: target,
  local: 'assertRecord + canonical Artifact validation + result hash binding',
  committedSnapshotAndTransition: 'pending Root exact source commit; no future self-commit embedded'};
await writeFile(resolve(arc, 'entrypoint.json'), JSON.stringify(entry, null, 2) + '\n');

const allFiles = async (dir: string): Promise<string[]> => {
  const result: string[] = [];
  for (const item of await readdir(dir, {withFileTypes: true})) {
    if (item.isDirectory()) result.push(...await allFiles(resolve(dir, item.name)));
    else { assert.ok(item.isFile() && /\.(ts|json)$/.test(item.name)); result.push(resolve(dir, item.name)); }
  }
  return result;
};
const artifacts = [];
for (const path of [...await allFiles(arc), resolve(work, 'inputs/CON-01-EXECUTION-R1.json')].sort()) {
  const bytes = await readFile(path), text = bytes.toString('utf8');
  // Only authored selection files are inspected; no private source body or credential discovery.
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-proj-[A-Za-z0-9]{16}|AKIA[A-Z0-9]{16}/.test(text));
  assert.ok(!/https?:\/\/[^\s"<>]+/.test(text));
  if (path.endsWith('.json')) JSON.parse(text);
  artifacts.push({path: relative(root, path), sha256: sha(bytes), byteLength: bytes.length});
}
const identity = {schema: 'common.git-work.v1', domainId: 'academy-operations', projectId: 'academy-workbench', workId: 'academy-consumer-integration-20261021'};
const input = (id: string, content: unknown) => ({...identity, kind: 'input', id, inputKind: 'source-owner-record',
  origin: {ownerId: 'accountable-consumer-subLead', locator: `native-thread:${process.env.CODEX_THREAD_ID}:${id}`, kind: 'source-owner-capture'}, content});
const resultId = 'CON-01-RESULT-R1';
const verificationId = 'CON-01-VERIFICATION-R1';
const resultEvidenceId = 'academy-workbench:evidence:con-01-result-observation-r1';
const verificationEvidenceId = 'academy-workbench:evidence:con-01-verification-r1';
const resultPath = resolve(work, `inputs/${resultId}.json`);
const result = input(resultId, {
  schema: 'academy.consumer-selection-result.v1', taskId: task.id, nativeThreadId: process.env.CODEX_THREAD_ID,
  runId: executionInput.content.runId, registration: executionInput.content.runRegistration,
  sourceHead: selection.sourceHead, disposition: 'READY_FOR_ROOT_SOURCE_CHECKPOINT',
  outcome: 'Bounded current-versus-selected consumer contract selection complete with explicit SDK adoption gap; no production adapter implemented.',
  sources: {query: selection.sources[2].commit, savedMcp: selection.sources[0].commit, context: selection.sources[1].commit, installedSkillSha256: selection.installedSkill.sha256},
  artifacts, selectedEntrypoint: 'architecture/academy-consumer-integration/entrypoint.json',
  sourceSelection: 'architecture/academy-consumer-integration/source-selection.json',
  adoptionPlan: 'architecture/academy-consumer-integration/adoption-plan.json',
  resultEvidenceId, verificationEvidenceId,
  checks: {passed: [`${prior.exactSourceFiles} exact selected/support source files and predecessor/skill hashes`, '14 context selections, 98 pages exhausted with exact byte counts and required references', '7 selected saved MCP tests', 'report design typecheck', 'canonical existing Work snapshot and local record/artifact hash bindings'],
    failed: ['2 selected SDK stdio tests: CONNECTION_CLOSED, cause unresolved'],
    notRun: prior.notRun},
  remainingGaps: selection.remainingGaps,
  currentTeacherContext: 'Oct19 applicability metadata only; facts remain with private owner/conversation',
  originalDailyReport: 'outstanding; older report never represented as current',
  next: 'WAIT for Root exact source checkpoint and explicit CON-02 admission; CON-03 holds on VER-02',
  sharedDelivery: false, nativeAdoption: false, teacherAcceptance: false, formalAcceptance: false,
  ownersUnchanged: true, commonConsumerPinChanged: false, productionEffects: false,
});
common.assertRecord(result);
await writeNew(resultPath, result);
const resultHash = sha(await readFile(resultPath));
const verification = {schemaVersion: '1.0.0', kind: 'verification', id: 'academy-workbench:verification:con-01-r1',
  domainId: identity.domainId, projectId: identity.projectId, createdAt: now,
  payload: {targetRefs: [target], criteria: [
    {id: 'exact-qualified-source-selection', status: 'pass', message: 'Exact admission sources, predecessor bytes, installed skill and received QRY qualification identified without source/body custody change.', evidenceRefs: [resultEvidenceId]},
    {id: 'bounded-caller-coverage-and-adoption-plan', status: 'pass', message: 'Actual callers, omissions, clocks, separate budgets and finite owner-local adoption steps recorded; all context pages consumed.', evidenceRefs: [resultEvidenceId]},
    {id: 'honest-check-and-hold-accounting', status: 'pass', message: '7 saved tests pass; 2 SDK tests fail and remain adoption gaps. CON-01 selection is verified; SDK acceptance, production integration and downstream task admission are not claimed.', evidenceRefs: [resultEvidenceId]},
  ], inputHashes: [{path: relative(root, resultPath), sha256: resultHash}], runtime: {name: 'Bun canonical external source APIs + bounded selection checks', version: Bun.version}}};
const checkedArtifact = validateArtifact(verification);
assert.equal(checkedArtifact.valid, true, JSON.stringify(checkedArtifact));
const verificationInput = input(verificationId, {verification});
common.assertRecord(verificationInput);
await writeNew(resolve(work, `inputs/${verificationId}.json`), verificationInput);
const verificationHash = sha(await readFile(resolve(work, `inputs/${verificationId}.json`)));
const evidence = (id: string, evidenceKind: string, path: string, sha256: string, fragment: string) => ({...identity, kind: 'evidence', id, evidenceKind, source: {kind: 'snapshot', path, sha256, fragment}});
const observation = evidence(resultEvidenceId, 'observation', relative(root, resultPath), resultHash, '#/content');
const proof = evidence(verificationEvidenceId, 'verification', relative(root, resolve(work, `inputs/${verificationId}.json`)), verificationHash, '#/content/verification');
for (const record of [observation, proof]) {common.assertRecord(record); await writeNew(resolve(work, `evidence/${encodeURIComponent(record.id)}.json`), record);}
task.state = {...task.state, execution: 'complete', verification: 'passed', localAudit: 'result-durable'};
task.executionEvidenceId = resultEvidenceId;
task.verificationEvidenceIds = [verificationEvidenceId];
task.nextAction = 'WAIT for Root exact CON-01 source checkpoint and explicit CON-02 admission. SDK stdio 2-test failure remains an adoption gap; CON-03 holds on VER-02. Shared/native/formal acceptance remains pending.';
common.assertRecord(task);
assert.equal(common.taskVerificationTarget(task), target);
await writeFile(taskPath, JSON.stringify(task, null, 2) + '\n');

for (const record of [result, verificationInput, observation, proof, task]) common.assertRecord(record);
for (const artifact of artifacts) assert.equal(sha(await readFile(resolve(root, artifact.path))), artifact.sha256);
assert.equal(sha(await readFile(resultPath)), verification.payload.inputHashes[0].sha256);
assert.ok(verification.payload.criteria.every(row => row.evidenceRefs.includes(observation.id)));
await writeNew(resolve(arc, 'observations/CON-01-LOCAL-RECORD-CHECK-R1.json'), {
  schema: 'academy.consumer-local-record-check.v1', createdAt: now, nativeThreadId: process.env.CODEX_THREAD_ID,
  commonPin, apis: ['assertRecord', 'taskVerificationTarget', 'openGitWork', 'validateGitWorkRecords', 'validateArtifact'],
  target, resultInputId: resultId, resultInputSha256: resultHash,
  verificationInputId: verificationId, verificationInputSha256: verificationHash,
  observationEvidenceId: resultEvidenceId, verificationEvidenceId,
  artifactCount: artifacts.length, allArtifactHashesMatch: true, exactResultHashBound: true,
  localRecordsValid: true, verificationArtifactValid: true, sourceSelectionVerified: true,
  selectedSdkAcceptance: 'failed: 7 pass / 2 fail; not relabeled by CON-01 selection Verification',
  committedSnapshot: 'pending Root exact commit', committedTransition: 'pending Root exact commit',
  sharedAudit: 'pending', formalCompletion: 'pending', nativeAuthorshipAuthenticated: false,
});
console.log(JSON.stringify({state: 'READY_FOR_ROOT_SOURCE_CHECKPOINT', target, resultInputId: resultId, resultHash,
  verificationInputId: verificationId, verificationHash, artifactCount: artifacts.length, sdkTests: '7 pass / 2 fail'}));
