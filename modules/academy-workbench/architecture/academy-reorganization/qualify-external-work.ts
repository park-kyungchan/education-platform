/** Owner-local source qualification, not a scheduler, native receiver receipt or common validator fork. */
import type {GitWorkReader, GitWorkSelection, LogicalIdentity, SourceReference, TaskRecord} from './source-auditor.ts';
import {isDeepStrictEqual} from 'node:util';

export interface ProducerBinding {
  selection: GitWorkSelection;
  tree: string;
  logical: LogicalIdentity;
  resultEvidenceId: string;
  verificationEvidenceId: string;
  milestone: 'execution-and-verification';
}
export interface ExternalQualification {
  producer: ProducerBinding;
  consumer: {selection: GitWorkSelection; logical: LogicalIdentity; qualificationTaskId: string};
  receiverSource: SourceReference;
}
export interface CanonicalAudit {
  openGitWork(selection: GitWorkSelection): Promise<GitWorkReader>;
  validateGitWorkRecords(reader: GitWorkReader): Promise<{valid: boolean; findings: readonly string[]}>;
  taskVerificationTarget(task: TaskRecord): string;
  readTree(selection: GitWorkSelection): Promise<string>;
}
const same = isDeepStrictEqual;
function requireValue(value: unknown, code: string): asserts value {if (!value) throw Error(code);}
const qualifiedIdentity = (x: LogicalIdentity) => ({domainId:x.domainId,projectId:x.projectId,workId:x.workId,taskId:x.taskId});

export async function qualifyExternalWork(binding: ExternalQualification, api: CanonicalAudit) {
  const p = binding.producer, c = binding.consumer;
  requireValue(p.milestone === 'execution-and-verification','unsupported_external_milestone');
  const producer = await api.openGitWork(p.selection);
  requireValue(producer.commit === p.selection.commit && await api.readTree(p.selection) === p.tree,'producer_source_pin_mismatch');
  requireValue(producer.work.repositoryId === p.selection.repositoryId && producer.work.domainId === p.logical.domainId && producer.work.projectId === p.logical.projectId && producer.work.workId === p.logical.workId,'producer_work_mismatch');
  const task = await producer.readRecord({kind:'task',id:p.logical.taskId});
  requireValue(task.kind === 'task' && same(task.logical,p.logical),'producer_task_identity_mismatch');
  requireValue(task.executionClass === 'source-only','native_prerequisite_requires_native_contract');
  requireValue(task.state.execution === 'complete' && task.state.verification === 'passed' && task.state.localAudit === 'result-durable','producer_milestone_pending');
  const validity = await api.validateGitWorkRecords(producer);
  requireValue(validity.valid,'producer_work_invalid:'+validity.findings.join(','));
  requireValue(task.verificationEvidenceIds.includes(p.verificationEvidenceId),'producer_verification_not_bound');
  const verification = await producer.readRecord({kind:'evidence',id:p.verificationEvidenceId});
  const result = await producer.readRecord({kind:'evidence',id:p.resultEvidenceId});
  requireValue(verification.kind === 'evidence' && verification.evidenceKind === 'verification','producer_verification_missing');
  requireValue(result.kind === 'evidence' && result.evidenceKind === 'observation','producer_result_missing');
  const verified = await producer.readSource(verification.source), observed = await producer.readSource(result.source);
  const artifact = verified.value as any;
  requireValue(artifact?.kind === 'verification' && artifact.payload?.targetRefs?.includes(api.taskVerificationTarget(task)),'producer_verification_target_mismatch');
  requireValue(artifact.payload.criteria?.some((criterion: any)=>criterion.evidenceRefs?.includes(p.resultEvidenceId)) && artifact.payload.inputHashes?.some((pin: any)=>pin.path===observed.path && pin.sha256===observed.sha256),'producer_result_not_bound_to_verification');
  const consumer = await api.openGitWork(c.selection);
  requireValue(consumer.work.repositoryId === c.selection.repositoryId && consumer.work.domainId === c.logical.domainId && consumer.work.projectId === c.logical.projectId && consumer.work.workId === c.logical.workId,'consumer_work_mismatch');
  const receiver = await consumer.readSource(binding.receiverSource);
  const document = receiver.document as any, receipt = receiver.value as any;
  requireValue(receiver.repositoryId === c.selection.repositoryId && receiver.commit === c.selection.commit,'receiving_qualification_revision_mismatch');
  requireValue(document?.kind === 'input' && document.inputKind === 'source-owner-record' && document.domainId === c.logical.domainId && document.projectId === c.logical.projectId && document.workId === c.logical.workId,'receiving_qualification_source_scope_mismatch');
  const registeredInput = await consumer.readRecord({kind:'input',id:document.id});
  requireValue(registeredInput.kind === 'input' && same(registeredInput,document),'receiving_qualification_not_canonical_input');
  requireValue(receipt?.schema === 'academy.external-source-qualification/1' && receipt.disposition === 'qualified-source-only','receiving_qualification_missing');
  requireValue(same(receipt.producer, {logical:p.logical,repositoryId:p.selection.repositoryId,commit:p.selection.commit,tree:p.tree,resultEvidenceId:p.resultEvidenceId,verificationEvidenceId:p.verificationEvidenceId,resultSha256:observed.sha256,verificationSha256:verified.sha256}), 'receiving_producer_binding_mismatch');
  requireValue(same(receipt.consumer, {logical:c.logical,qualificationTaskId:c.qualificationTaskId}), 'receiving_consumer_binding_mismatch');
  // The existing GitWork validator checks a local qualification Task's own Verification.
  const gate = await consumer.readRecord({kind:'task',id:c.qualificationTaskId});
  requireValue(gate.kind === 'task' && gate.executionClass === 'source-only' && gate.state.execution === 'complete' && gate.state.verification === 'passed' && gate.state.localAudit === 'result-durable','receiving_qualification_pending');
  let receiptVerified = false;
  for (const id of gate.verificationEvidenceIds) {
    const e = await consumer.readRecord({kind:'evidence',id});
    if (e.kind !== 'evidence' || e.evidenceKind !== 'verification') continue;
    const v = (await consumer.readSource(e.source)).value as any;
    if (v.payload?.targetRefs?.includes(api.taskVerificationTarget(gate)) && v.payload?.inputHashes?.some((pin: any)=>pin.path===receiver.path && pin.sha256===receiver.sha256)) receiptVerified = true;
  }
  requireValue(receiptVerified,'receiving_qualification_verification_not_bound');
  const next = await consumer.readRecord({kind:'task',id:c.logical.taskId});
  requireValue(next.kind === 'task' && next.executionClass === 'source-only' && same(next.logical,c.logical) && next.dependsOn.some(d=>d.taskId===gate.id && d.milestone==='execution-and-verification'),'consumer_local_gate_not_bound');
  const consumerValidity = await api.validateGitWorkRecords(consumer);
  requireValue(consumerValidity.valid,'consumer_work_invalid:'+consumerValidity.findings.join(','));
  return {qualified:true as const,scope:'source-only-execution-and-verification' as const, producer:qualifiedIdentity(p.logical), consumer:qualifiedIdentity(c.logical), qualificationTaskId:gate.id, producerCommit:p.selection.commit, producerTree:p.tree, receiverSource:binding.receiverSource, nativeReceiverAuthenticated:false as const, sharedDeliveryEstablished:false as const, activationAuthorized:false as const};
}
