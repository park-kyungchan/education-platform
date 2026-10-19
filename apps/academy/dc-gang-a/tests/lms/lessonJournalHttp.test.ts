import {expect,test} from 'bun:test';
import type {JournalHttpAction} from '../../src/lms/lessonJournalHttp';
const target={studentName:'Invented Learner',date:'2099-01-05',groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'88001'};
const state={target,fields:{progress:'',homework:'',lessonMemo:'',attendance:'Y',persistentMemo:'keep',dailyTestAssessment:'-1',previousHomeworkAssessment:'-1'},previousRecordKey:'12',previousDate:'2099-01-02',wireDigest:'a'.repeat(64)};
const action={attemptId:'invented-once',target,field:'progress' as const,effectRecordKey:'13',before:'',after:'Invented mapped unit inspection.',wireDigest:state.wireDigest};
test('official HTTP action requires exact trusted admission and fresh independent readback',async()=>{
  const module=await import('../../src/lms/lessonJournalHttp');expect(typeof module.applyJournalHttpAction).toBe('function');
  let writes=0;let consumes=0;
  const port={read:async()=>structuredClone(state),write:async()=>{writes++;state.fields.progress=action.after;},consumeApproval:async(a:JournalHttpAction)=>{consumes++;expect(a).toEqual(action);return {status:'verified' as const,actionDigest:module.journalHttpActionDigest(a)};}};
  const result=await module.applyJournalHttpAction!(action,port);
  expect(result.status).toBe('persisted');expect(writes).toBe(1);expect(consumes).toBe(1);expect(result.parentSends).toBe(0);state.fields.progress='';
});
test('before drift, wrong-record homework, missing or mismatched approval never dispatch a write',async()=>{
  const {applyJournalHttpAction}=await import('../../src/lms/lessonJournalHttp');let writes=0;
  const port={read:async()=>structuredClone(state),write:async()=>{writes++;},consumeApproval:async()=>({status:'rejected' as const})};
  await expect(applyJournalHttpAction({...action,before:'foreign'},port)).rejects.toThrow('journal_http_before_drift');
  await expect(applyJournalHttpAction({...action,field:'previousHomeworkAssessment',before:'-1',after:'5'},port)).rejects.toThrow('journal_http_effect_record_conflict');
  await expect(applyJournalHttpAction(action,port)).rejects.toThrow('journal_http_approval_rejected');
  await expect(applyJournalHttpAction(action,{...port,consumeApproval:async()=>({status:'verified',actionDigest:'wrong'})})).rejects.toThrow('journal_http_approval_rejected');expect(writes).toBe(0);
});
test('uncertain dispatch is read back exactly once and never retried; collateral drift is a conflict',async()=>{
  const {applyJournalHttpAction,journalHttpActionDigest}=await import('../../src/lms/lessonJournalHttp');let writes=0;let reads=0;
  const port={read:async()=>{reads++;return structuredClone(state);},write:async()=>{writes++;state.fields.progress=action.after;throw Error('synthetic-timeout');},consumeApproval:async()=>({status:'verified' as const,actionDigest:journalHttpActionDigest(action)})};
  const result=await applyJournalHttpAction(action,port);expect(result.status).toBe('persisted');expect(result.transport).toBe('uncertain');expect(writes).toBe(1);expect(reads).toBe(2);state.fields.progress='';
  const conflict=await applyJournalHttpAction(action,{...port,write:async()=>{state.fields.progress=action.after;state.fields.persistentMemo='foreign drift';}});expect(conflict.status).toBe('conflict');state.fields.progress='';state.fields.persistentMemo='keep';
});
test('native approval consumption identity is independent of an output namespace',async()=>{
  const module=await import('../../src/lms/lessonJournalHttp');
  expect(typeof module.journalApprovalReceiptName).toBe('function');
  const name=module.journalApprovalReceiptName('20990105_000000_abcdef',1,module.journalHttpActionDigest(action));
  expect(name).toMatch(/^journal-approval-20990105_000000_abcdef-1-[a-f0-9]{64}\.json$/);
  expect(()=>module.journalApprovalReceiptName('../foreign',1,module.journalHttpActionDigest(action))).toThrow();
});
test('effect-owner native approval requires an exact affirmative response, never a prefix or environment assertion',async()=>{
  const module=await import('../../src/lms/lessonJournalHttp');expect(typeof module.acceptNativeJournalDecision).toBe('function');const hash='b'.repeat(64);
  const decision={outcome:'submitted',responses:[{question:'Exact reviewed fields [review:'+hash+']',status:'answered',choices_offered:['표시된 일지 입력을 승인합니다. 전송은 직접 합니다.'],user_response:'표시된 일지 입력을 승인합니다. 전송은 직접 합니다.'}]};
  expect(module.acceptNativeJournalDecision(decision,hash)).toBe(true);
  for(const answer of ['A로 진행해, 저장은 하지 마.','수정사항을 반영한 후 저장','',null])expect(module.acceptNativeJournalDecision({...decision,responses:[{...decision.responses[0],user_response:answer}]},hash)).toBe(false);
  expect(module.acceptNativeJournalDecision(decision,'c'.repeat(64))).toBe(false);
});
test('source wire must match the independently qualified field contract, not merely a new hash',async()=>{
  const module=await import('../../src/lms/lessonJournalHttp');expect(typeof module.assertJournalWireQualified).toBe('function');
  expect(()=>module.assertJournalWireQualified(module.JOURNAL_HTTP_SOURCE_CONTRACT.staticWireDigest)).not.toThrow();
  expect(()=>module.assertJournalWireQualified('a'.repeat(64))).toThrow('journal_mutation_wire_not_qualified');
});
test('dated source qualification retains the historical fixture and rejects unreviewed neighboring digests',async()=>{
 const m=await import('../../src/lms/lessonJournalHttp');
 expect(m.JOURNAL_HTTP_SOURCE_QUALIFICATIONS.map(source=>source.observedOn)).toEqual(['2026-10-06','2026-10-19']);
 expect(m.JOURNAL_HTTP_SOURCE_CONTRACT.staticWireDigest).toBe('c7afa7e2975397c54801af3a417c44caeb7850de70e67a6806f61da8c97d5b4b');
 const current=m.JOURNAL_HTTP_SOURCE_QUALIFICATIONS[1];
 expect(Object.isFrozen(m.JOURNAL_HTTP_SOURCE_QUALIFICATIONS)).toBe(true);expect(Object.isFrozen(current)).toBe(true);
 expect(current.sourceResponseSha256).toBe('f1cb526392572ecb4e9ee82bab80d499c41f68c291054e5d1ca9558b41b21ef9');
 expect(()=>m.assertJournalWireQualified(current.wireDigest)).not.toThrow();
 expect(()=>m.assertJournalWireQualified(current.wireDigest.slice(0,-1)+'3')).toThrow('journal_mutation_wire_not_qualified');
 expect(()=>m.assertJournalWireQualified(' '+current.wireDigest)).toThrow('journal_mutation_wire_not_qualified');
});
test('observed passive control syntax binds literal current and previous roles without handler execution',async()=>{
 const {parseDayRecordHandlerAttribute:parse}=await import('../../src/lms/dayRecordDomBinding');
 const calls=[
  {source:"javascript:onAttn('0', '4', '77001', '13', '88001' );",event:'onchange' as const,handler:'onAttn'},
  ...['onFoPrg','onFoHw','onFoMm'].map(handler=>({source:`javascript:${handler}('0', '4', '77001', '13','88001');`,event:'onfocusout' as const,handler})),
 ];
 for(const call of calls){const parsed=parse({...call,columnGroup:'current_progress'});expect(parsed.status).toBe('parsed');if(parsed.status!=='parsed')throw Error('synthetic_literal_unresolved');expect(parsed.handler).toBe(call.handler);expect(parsed.bindings).toEqual({i:'0',course_seq:'4',stu_pri_no:'77001',record_seq:'13',cm_seq:'88001'});}
 const daily=parse({source:'setDailyTest(13,88001,0)',event:'onclick',columnGroup:'current_progress'});
 const previous=parse({source:'openHomeWorkRate(12,88001,0)',event:'onclick',columnGroup:'previous_progress'});
 expect(daily.status).toBe('parsed');expect(previous.status).toBe('parsed');
 if(daily.status!=='parsed'||previous.status!=='parsed')throw Error('synthetic_assessment_unresolved');
 expect(daily.bindings).toEqual({record_seq:'13',cm_seq:'88001',count:'0'});
 expect(previous.bindings).toEqual({record_seq:'12',cm_seq:'88001',count:'0'});
 expect(parse({source:'setDailyTest(13,88001,0); foreignWrite()',event:'onclick',columnGroup:'current_progress'}).status).toBe('unresolved');
 expect(parse({source:'openHomeWorkRate(12,88001,0)',event:'onclick',columnGroup:'current_progress'}).status).toBe('unresolved');
});
test('assessment literal value-label drift fails the field-specific qualification',async()=>{
 const m=await import('../../src/lms/lessonJournalHttp');expect(typeof m.assertJournalAssessmentOptions).toBe('function');
 const options=Object.entries(m.JOURNAL_HTTP_SOURCE_CONTRACT.assessmentLabels).flatMap(([field,values])=>Object.entries(values).map(([value,label])=>({field,value,label})));
 expect(()=>m.assertJournalAssessmentOptions(options)).not.toThrow();expect(()=>m.assertJournalAssessmentOptions(options.map(o=>o.field==='daily_test_radio'&&o.value==='9'?{...o,label:'Unqualified different score'}:o))).toThrow('journal_assessment_options_drift');
});
