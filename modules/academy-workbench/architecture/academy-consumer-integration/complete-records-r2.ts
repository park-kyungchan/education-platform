/** Targeted canonical record repair only. No repeated transport, context or report checks. */
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {createHash} from 'node:crypto';
import {strict as assert} from 'node:assert';
const root = resolve(import.meta.dir, '../..'), arc = import.meta.dir;
const work = resolve(root, 'work/academy-workbench/academy-consumer-integration-20261021');
const commonRoot = '/home/palantirkc/projects/agent-platform';
const pin = '712f90deac0676e662dc5d75d88d89f7b6773bfe';
const {assertRecord, taskVerificationTarget} = await import(resolve(commonRoot, 'packages/work-continuity/src/git-work/index.ts'));
const {validateArtifact} = await import(resolve(commonRoot, 'packages/ontology/src/index.ts'));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const load = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const fresh = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const taskPath = resolve(work, 'tasks/academy-workbench%3Atask%3Aacademy-consumer-integration-20261021-con-01.json');
const task = await load(taskPath);
assert.equal(task.state.execution, 'planned');
assert.equal(task.executionClass, 'source-only');
assert.equal(task.executionEvidenceId, undefined);
const target = taskVerificationTarget(task);
const first = await load(resolve(work, 'inputs/CON-01-RESULT-R1.json'));
const firstVerification = await load(resolve(work, 'inputs/CON-01-VERIFICATION-R1.json'));
assert.equal(sha(await readFile(resolve(work, 'inputs/CON-01-RESULT-R1.json'))), firstVerification.content.verification.payload.inputHashes[0].sha256);
const report = await load(resolve(arc, 'observations/CON-01-REPORT-TYPECHECK-R1.json'));
assert.equal(report.exitCode, 0);
const continuation = await load(resolve(arc, 'observations/CON-01-CHECK-CONTINUATION-R1.json'));
assert.equal(continuation.canonicalBase.valid, true);
assert.equal(continuation.commonPin, pin);
assert.equal(continuation.taskVerificationTarget, target);
const observationId = 'academy-workbench:evidence:con-01-result-observation-r2';
const verificationEvidenceId = 'academy-workbench:evidence:con-01-verification-r2';
const entry = await load(resolve(arc, 'entrypoint.json'));
entry.resultInput = 'CON-01-RESULT-R2'; entry.verificationInput = 'CON-01-VERIFICATION-R2';
entry.resultEvidenceId = observationId; entry.verificationEvidenceId = verificationEvidenceId;
entry.localRecordCheck = 'observations/CON-01-LOCAL-RECORD-CHECK-R2.json';
entry.retainedAssembly = {resultInput: 'CON-01-RESULT-R1', verificationInput: 'CON-01-VERIFICATION-R1', failure: 'observations/CON-01-LOCAL-ASSEMBLY-FAILURE-R1.json', status: 'superseded local assembly; never final checkpoint'};
await writeFile(resolve(arc, 'entrypoint.json'), JSON.stringify(entry, null, 2) + '\n');
const paths = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  for (const item of await readdir(dir, {withFileTypes: true})) {
    if (item.isDirectory()) out.push(...await paths(resolve(dir, item.name)));
    else {assert.ok(item.isFile() && /\.(ts|json)$/.test(item.name)); out.push(resolve(dir, item.name));}
  }
  return out;
};
const artifacts = [];
for (const path of [...await paths(arc), resolve(work, 'inputs/CON-01-EXECUTION-R1.json')].sort()) {
  const bytes = await readFile(path), text = bytes.toString('utf8');
  assert.ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-proj-[A-Za-z0-9]{16}|AKIA[A-Z0-9]{16}/.test(text));
  assert.ok(!/https?:\/\/[^\s"<>]+/.test(text));
  if (path.endsWith('.json')) JSON.parse(text);
  artifacts.push({path: relative(root, path), sha256: sha(bytes), byteLength: bytes.length});
}
const result = {...first, id: 'CON-01-RESULT-R2', origin: {...first.origin, locator: `native-thread:${process.env.CODEX_THREAD_ID}:CON-01-RESULT-R2`},
  content: {...first.content, artifacts, resultEvidenceId: observationId, verificationEvidenceId,
    supersedesLocalAssembly: {resultInput: 'CON-01-RESULT-R1', reason: 'canonical rejection of source-only Task executionEvidenceId before Task write; no native effect or old Input mutation'},
    nativeThreadId: process.env.CODEX_THREAD_ID}};
assertRecord(result);
const resultPath = resolve(work, 'inputs/CON-01-RESULT-R2.json');
await fresh(resultPath, result);
const resultHash = sha(await readFile(resultPath));
const verification = structuredClone(firstVerification);
verification.id = 'CON-01-VERIFICATION-R2';
verification.origin.locator = `native-thread:${process.env.CODEX_THREAD_ID}:CON-01-VERIFICATION-R2`;
verification.content.verification.id = 'academy-workbench:verification:con-01-r2';
verification.content.verification.createdAt = new Date().toISOString();
verification.content.verification.payload.targetRefs = [target];
verification.content.verification.payload.inputHashes = [{path: relative(root, resultPath), sha256: resultHash}];
for (const row of verification.content.verification.payload.criteria) row.evidenceRefs = [observationId];
assertRecord(verification);
const validated = validateArtifact(verification.content.verification);
assert.equal(validated.valid, true, JSON.stringify(validated));
const verificationPath = resolve(work, 'inputs/CON-01-VERIFICATION-R2.json');
await fresh(verificationPath, verification);
const verificationHash = sha(await readFile(verificationPath));
const identity = {schema: 'common.git-work.v1', domainId: 'academy-operations', projectId: 'academy-workbench', workId: 'academy-consumer-integration-20261021'};
const observation = {...identity, kind: 'evidence', id: observationId, evidenceKind: 'observation', source: {kind: 'snapshot', path: relative(root, resultPath), sha256: resultHash, fragment: '#/content'}};
const proof = {...identity, kind: 'evidence', id: verificationEvidenceId, evidenceKind: 'verification', source: {kind: 'snapshot', path: relative(root, verificationPath), sha256: verificationHash, fragment: '#/content/verification'}};
for (const record of [observation, proof]) {assertRecord(record); await fresh(resolve(work, `evidence/${encodeURIComponent(record.id)}.json`), record);}
task.state = {...task.state, execution: 'complete', verification: 'passed', localAudit: 'result-durable'};
task.verificationEvidenceIds = [verificationEvidenceId];
task.nextAction = 'WAIT for Root exact CON-01 source checkpoint and explicit CON-02 admission. SDK stdio 2-test failure remains an adoption gap; CON-03 holds on VER-02. Shared/native/formal acceptance remains pending.';
assertRecord(task);
assert.equal(taskVerificationTarget(task), target);
for (const file of artifacts) assert.equal(sha(await readFile(resolve(root, file.path))), file.sha256);
assert.equal(sha(await readFile(resultPath)), verification.content.verification.payload.inputHashes[0].sha256);
await writeFile(taskPath, JSON.stringify(task, null, 2) + '\n');
await fresh(resolve(arc, 'observations/CON-01-LOCAL-RECORD-CHECK-R2.json'), {
  schema: 'academy.consumer-local-record-check.v1', createdAt: new Date().toISOString(), nativeThreadId: process.env.CODEX_THREAD_ID,
  commonPin: pin, apis: ['assertRecord', 'taskVerificationTarget', 'validateArtifact'],
  priorCanonicalBase: {path: 'observations/CON-01-CHECK-CONTINUATION-R1.json', status: 'passed; no unchanged graph rerun'},
  target, resultInputId: result.id, resultInputSha256: resultHash, verificationInputId: verification.id, verificationInputSha256: verificationHash,
  observationEvidenceId: observationId, verificationEvidenceId, exactResultHashBound: true,
  artifactCount: artifacts.length, allArtifactHashesMatch: true, localRecordsValid: true, verificationArtifactValid: true,
  sourceOnlyTaskHasNoNativeExecutionField: true, sourceSelectionVerified: true,
  selectedSdkAcceptance: 'failed: 7 pass / 2 fail; not relabeled by selection Verification',
  retainedFirstAssembly: 'CON-01-RESULT-R1/CON-01-VERIFICATION-R1 unchanged; failure recorded; R2 is final',
  committedSnapshot: 'pending Root exact commit', committedTransition: 'pending Root exact commit',
  sharedAudit: 'pending', formalCompletion: 'pending', nativeAuthorshipAuthenticated: false,
});
console.log(JSON.stringify({state: 'READY_FOR_ROOT_SOURCE_CHECKPOINT', target, resultInputId: result.id, resultHash, verificationInputId: verification.id, verificationHash, artifactCount: artifacts.length, sdkTests: '7 pass / 2 fail'}));
