import {expect,test} from 'bun:test';
import {commandBinding,requestDigest,type ReadAdmission} from '../../src/academy/contracts/prerequisiteRecords';
import {hash} from './nativePrerequisiteContracts.test';
import {scene} from './nativePrerequisitePort.test';
import {foundation} from './nativePrerequisiteStore.test';
import {actor,ingress,facadeApp,nativeContext,bindPayload} from './teacherBinding.test';

test('admitted read finalizes REFUSED after binding retirement with terminal lookup and unchanged business heads; ordinary facade COMPLETED is owner-witness-refused and cross-principal finalization refuses',async()=>{
  const f=await foundation();const app=facadeApp(f.store);
  const read:ReadAdmission={ownerId:actor.ownerId,actorId:actor.actorId,requestId:'ol-read-refused',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
  const second:ReadAdmission={...read,requestId:'ol-read-completed-after-retire'};
  await app.admitReadOccurrence(actor,read);await app.admitReadOccurrence(actor,second);
  await app.retireTeacher(actor,{command:ingress('ol-retire-during-read'),teacherKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...bindPayload(),state:'RETIRED' as const}});
  const heads=()=>JSON.stringify(['teacher','class','lesson','binding','activity_scope','student_record','record','approval','native_score_evidence'].map(t=>f.sql.rows(t+'_heads')));
  const before=heads();
  await expect(app.finalizeReadOccurrence({ownerId:actor.ownerId,actorId:'synthetic-other-actor',role:'teacher'},{request:read,status:'REFUSED',snapshotDigest:null,refusalCode:'teacher_binding_inactive'})).rejects.toThrow('teacher_attribution_conflict');
  const done=await app.finalizeReadOccurrence(actor,{request:read,status:'REFUSED',snapshotDigest:null,refusalCode:'teacher_binding_inactive'});
  expect(done.status).toBe('REFUSED');expect(done.partialDataDiscarded).toBe(true);
  expect((await app.readOccurrence(actor,read)).status).toBe('REFUSED');
  const stateBeforeRetiredCompleted=f.sql.state();
  await expect(app.finalizeReadOccurrence(actor,{request:second,status:'COMPLETED' as unknown as 'REFUSED',snapshotDigest:hash,refusalCode:null})).rejects.toThrow('read_completion_owner_witness_required');
  expect((await app.readOccurrence(actor,second)).status).toBe('PENDING');
  expect(f.sql.state()).toBe(stateBeforeRetiredCompleted);
  const unknown=await app.finalizeReadOccurrence(actor,{request:second,status:'UNKNOWN',snapshotDigest:null,refusalCode:null});
  expect(unknown.status).toBe('UNKNOWN');
  expect(heads()).toBe(before);
});

test('lost acknowledgement: facade commandOutcome returns the original committed result with no second mutation, and exact replay does not mutate',async()=>{
  const f=await scene();const app=facadeApp(f.store);
  const consumeKey='ol-consume';
  const closure=await app.previewApprovalClosure(actor,{command:ingress(consumeKey),draftRef:f.draftRef});
  const issuance=await app.issueApproval(actor,{command:ingress('ol-issue'),draftRef:f.draftRef,closure,validForSeconds:900});
  const consumeInput={command:ingress(consumeKey),draftRef:f.draftRef,approvalProofHandle:issuance.proofHandle};
  const result=await app.approveDraft(actor,consumeInput);
  const ctx=nativeContext(consumeKey);
  const request=commandBinding(ctx,requestDigest('consumeApprovalAndApproveDraft',{context:ctx,draftRef:f.draftRef,approvalProofHandle:issuance.proofHandle}));
  const stateBefore=f.sql.state();const queriesBefore=f.sql.queries.length;
  const looked=await app.commandOutcome(actor,{request});
  expect(looked.status).toBe('COMMITTED');
  if(looked.status==='COMMITTED'){expect(looked.result.receipt).toEqual(result.receipt);expect(looked.next).toBe('READBACK_NO_REPLAY');}
  expect(f.sql.state()).toBe(stateBefore);
  const replay=await app.approveDraft(actor,consumeInput);
  expect(replay.status).toBe('replay');expect(replay.receipt).toEqual(result.receipt);
  expect(f.sql.state()).toBe(stateBefore);
  expect(f.sql.queries.length).toBeGreaterThan(queriesBefore);
  await expect(app.commandOutcome({ownerId:actor.ownerId,actorId:'synthetic-other-actor',role:'teacher'},{request})).rejects.toThrow('teacher_attribution_conflict');
  await expect(app.commandOutcome({ownerId:'synthetic-other-owner',actorId:actor.actorId,role:'teacher'},{request})).rejects.toThrow('owner_scope_conflict');
  const unknown=await app.commandOutcome(actor,{request:{...request,idempotencyKey:'never-admitted'}});
  expect(unknown.status).toBe('UNKNOWN');expect(f.sql.state()).toBe(stateBefore);
});

test('facade fence makes a delayed original refuse, and read-occurrence metadata lifecycle is principal-bound',async()=>{
  const f=await scene();const app=facadeApp(f.store);
  const ctx=nativeContext('ol-delayed-class');
  const command={context:ctx,entityKey:null,expectedRevisionId:null,payload:{kind:'class_group' as const,displayName:{state:'known' as const,value:'Invented Delayed Class',evidence:[{sourceRef:ctx.scopeRef,sourceRevision:'synthetic-evidence-r1',locator:'synthetic-scoped-evidence',observedAt:ctx.sourceObservedAt}]},businessTimezone:{state:'known' as const,value:'Asia/Seoul',evidence:[{sourceRef:ctx.scopeRef,sourceRevision:'synthetic-evidence-r1',locator:'synthetic-scoped-evidence',observedAt:ctx.sourceObservedAt}]},classState:{state:'known' as const,value:'ACTIVE' as const,evidence:[{sourceRef:ctx.scopeRef,sourceRevision:'synthetic-evidence-r1',locator:'synthetic-scoped-evidence',observedAt:ctx.sourceObservedAt}]},synthetic:true}};
  const request=await f.store.admitCommand({context:ctx,requestDigest:requestDigest('append:class',command)});
  expect((await app.commandOutcome(actor,{request})).status).toBe('PENDING');
  const fenced=await app.fenceCommand(actor,{request,fenceOccurrenceId:'synthetic-fence-occurrence',reason:'CANCEL'});
  expect(fenced.status).toBe('NOT_COMMITTED_FENCED');
  const classesBefore=f.sql.rows('class_versions').length;
  await expect(f.store.appendClassGroup(command as never)).rejects.toThrow('original_occurrence_fenced');
  expect(f.sql.rows('class_versions')).toHaveLength(classesBefore);
  const read:ReadAdmission={ownerId:actor.ownerId,actorId:actor.actorId,requestId:'ol-read-1',runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
  expect((await app.admitReadOccurrence(actor,read)).status).toBe('PENDING');
  expect((await app.readOccurrence(actor,read)).status).toBe('PENDING');
  const stateBeforeActiveCompleted=f.sql.state();
  await expect(app.finalizeReadOccurrence(actor,{request:read,status:'COMPLETED' as unknown as 'REFUSED',snapshotDigest:hash,refusalCode:null})).rejects.toThrow('read_completion_owner_witness_required');
  expect((await app.readOccurrence(actor,read)).status).toBe('PENDING');
  expect(f.sql.state()).toBe(stateBeforeActiveCompleted);
  await expect(app.finalizeReadOccurrence(actor,{request:read,status:'COMPLETED' as unknown as 'REFUSED',snapshotDigest:hash,refusalCode:null})).rejects.toThrow('read_completion_owner_witness_required');
  await expect(app.readOccurrence({ownerId:actor.ownerId,actorId:'synthetic-other-actor',role:'teacher'},read)).rejects.toThrow('teacher_attribution_conflict');
});

test('SC3 owner-only fence: forged authority fields never authorize facade COMPLETED; REFUSED/UNKNOWN flows unchanged',async()=>{
  const f=await scene();const app=facadeApp(f.store);
  const mk=(requestId:string):ReadAdmission=>({ownerId:actor.ownerId,actorId:actor.actorId,requestId,runId:'synthetic-run',requestDigest:hash,selectorDigest:hash,processEpoch:'synthetic-process-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'});
  const forged=mk('ol-forged-authority');await app.admitReadOccurrence(actor,forged);
  const stateBefore=f.sql.state();
  const forgeries:Record<string,unknown>[]=[{owner:true},{capability:'owner'},{ownerWitness:true},{trusted:'commitReadOutput'},{owner:true,capability:'owner',ownerWitness:true,trusted:'commitReadOutput'}];
  for(const extra of forgeries){
    await expect(app.finalizeReadOccurrence(actor,{request:forged,status:'COMPLETED' as unknown as 'REFUSED',snapshotDigest:hash,refusalCode:null,...extra})).rejects.toThrow('read_completion_owner_witness_required');
  }
  expect((await app.readOccurrence(actor,forged)).status).toBe('PENDING');
  expect(f.sql.state()).toBe(stateBefore);
  expect((app as unknown as Record<string,unknown>).commitReadOutput).toBeUndefined();
  const refused=mk('ol-fence-refused');await app.admitReadOccurrence(actor,refused);
  const refusedDone=await app.finalizeReadOccurrence(actor,{request:refused,status:'REFUSED',snapshotDigest:null,refusalCode:'synthetic-fence-denied'});
  expect(refusedDone.status).toBe('REFUSED');expect(refusedDone.partialDataDiscarded).toBe(true);
  const unknowned=mk('ol-fence-unknown');await app.admitReadOccurrence(actor,unknowned);
  const unknownDone=await app.finalizeReadOccurrence(actor,{request:unknowned,status:'UNKNOWN',snapshotDigest:null,refusalCode:null});
  expect(unknownDone.status).toBe('UNKNOWN');
});
