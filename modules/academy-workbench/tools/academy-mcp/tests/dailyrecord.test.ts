import {expect,test} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {dailyRecordToolConfiguration} from '../src/dailyrecord-tools.ts';
import {backend,clock,context,fact,observation,proposal,safeguard,learningPolicy} from './dailyrecord-fixture.ts';

async function setup(){const service=new DailyRecordService(backend(),safeguard,()=>clock,learningPolicy);const c=context();const intake=await service.intake({context:c});return {service,c,handle:intake.observationHandle!};}
test('missing context and caller authority/source flags fail before any backend call',async()=>{
  let calls=0;const service=new DailyRecordService(backend(()=>{calls++;return observation();}),safeguard,()=>clock,learningPolicy);
  for(const input of [{},{context:{...context(),approved:true}},{context:{...context(),verified:true}},{context:{...context(),scope:{...context().scope,studentId:''}}},{context:{...context(),selectedFields:['progress','progress']}}])await expect(service.intake(input)).rejects.toThrow();
  expect(calls).toBe(0);
});
test('unconfigured intake performs useful missing-only interview without inventing source success',async()=>{
  const service=new DailyRecordService(null,null,()=>clock,learningPolicy),c=context();c.memoAnswer={kind:'not_supplied'};
  const result=await service.intake({context:c});
  expect(result).toMatchObject({status:'held',sourceAvailability:'unavailable',observationHandle:null,academyWrites:0,parentSends:0});
  expect(result.interviews.map(v=>v.field)).toEqual(['homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment']);
  expect(result.toneSamples).toEqual([]);expect(result.fields.find(f=>f.field==='progress')?.disposition).toBe('user_facts_available');
});
test('qualified existing assessments/attendance stay preserved and previous target stays independent',async()=>{
  const service=new DailyRecordService(backend(),safeguard,()=>clock,learningPolicy),c=context();const result=await service.intake({context:c});
  expect(result.status).toBe('ready_for_review');expect(result.interviews).toEqual([]);
  for(const field of ['attendance','dailyTestAssessment','previousHomeworkAssessment'])expect(result.fields.find(f=>f.field===field)?.disposition).toBe('preserve_existing');
  expect(result.fields.find(f=>f.field==='previousHomeworkAssessment')?.target?.recordId).toBe('previous-record-synthetic');
  expect(result.fields.find(f=>f.field==='dailyTestAssessment')?.target?.recordId).toBe('current-record-synthetic');
});
test('caller mutation of returned context cannot retarget an issued source handle',async()=>{
  const service=new DailyRecordService(backend(),safeguard,()=>clock,learningPolicy),c=context(),intake=await service.intake({context:c});
  intake.userContext.scope.studentId='foreign-mutated';
  await expect(service.review({context:intake.userContext,observationHandle:intake.observationHandle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]})).rejects.toThrow('exact_backend_observation_handle_required');
  const result=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});expect(result.status).toBe('prepared');
});
test('unknown assessments need explicit field values; activity prose does not establish scores or attendance',async()=>{
  const o=observation();o.fields.attendance={state:'unknown',reasonCode:'no-attendance'};o.fields.dailyTestAssessment={state:'known',value:'-1',evidenceRefs:['synthetic']};o.fields.previousHomeworkAssessment={state:'unknown',reasonCode:'no-rate'};
  const service=new DailyRecordService(backend(()=>o),safeguard,()=>clock,learningPolicy),c=context();c.facts.push(fact('dailyTestAssessment','총 12문항 실시. 정답률 80%.'));
  const result=await service.intake({context:c});expect(result.interviews.map(q=>q.field)).toEqual(['attendance','dailyTestAssessment','previousHomeworkAssessment']);
  c.selectedFields.push('dailyTestAssessment');const unsupported=await service.intake({context:c,suppliedValues:[proposal('dailyTestAssessment','8')]});
  expect(unsupported.blockers).toContain('dailyTestAssessment:explicit_user_source_option_fact_required');expect(unsupported.interviews.map(q=>q.field)).toContain('dailyTestAssessment');
  c.facts[c.facts.length-1]={...c.facts[c.facts.length-1],explicitValue:'8'};const supplied=await service.intake({context:c,suppliedValues:[proposal('dailyTestAssessment','8')]});
  expect(supplied.interviews.map(q=>q.field)).not.toContain('dailyTestAssessment');
  const guessed=await service.intake({context:c,suppliedValues:[proposal('dailyTestAssessment','80')]});expect(guessed.blockers).toContain('dailyTestAssessment:invalid_explicit_field_value');
});
test('qualified blank attendance/text remains missing information, not recorded attendance or activity',async()=>{
  const o=observation();o.fields.attendance={state:'known',value:' ',evidenceRefs:['synthetic']};o.fields.homework={state:'known',value:'',evidenceRefs:['synthetic']};
  const result=await new DailyRecordService(backend(()=>o),safeguard,()=>clock,learningPolicy).intake({context:context()});expect(result.interviews.map(q=>q.field)).toEqual(['homework','attendance']);
  expect(result.fields.find(f=>f.field==='attendance')?.before).toMatchObject({state:'known',value:' '});
});
test('contradictory typed deadline rendering is rejected before backend reads',async()=>{
  let calls=0;const service=new DailyRecordService(backend(()=>{calls++;return observation();}),safeguard,()=>clock,learningPolicy),c=context();
  c.facts=[{...fact('homework','1월 19일까지 지정 문제 풀어오기.'),deadlines:[{date:'2040-01-19',rendering:'1월 20일'}]}];
  await expect(service.intake({context:c})).rejects.toThrow('deadline_rendering_must_preserve_date');expect(calls).toBe(0);
});
test('today memo is always interviewed when absent; no-addition never authorizes deletion',async()=>{
  const {service,c,handle}=await setup();c.selectedFields=['lessonMemo'];c.facts=[fact('lessonMemo','추가 메모 없음')];
  const review=await service.review({context:c,observationHandle:handle,proposals:[{...proposal('lessonMemo',''),decision:{kind:'clear',requestRef:c.currentRequestRef}}]});
  expect(review.rows[0].blockers).toContain('no_addition_preserves_existing_memo');expect(review.patch).toEqual([]);
  c.memoAnswer={kind:'not_supplied'};const intake=await service.intake({context:c});expect(intake.interviews).toEqual([{field:'lessonMemo',reasonCode:'today_student_specific_memo_required'}]);
});
test('exact handles reject foreign task/student before source reads; before drift and staleness block patch',async()=>{
  let calls=0;const service=new DailyRecordService(backend(()=>{calls++;const o=observation();if(calls>1)o.fields.homework={state:'known',value:'사용자가 방금 수정한 숙제',evidenceRefs:['synthetic-fresh']};return o;}),safeguard,()=>clock,learningPolicy);
  const c=context(),intake=await service.intake({context:c}),handle=intake.observationHandle!;
  await expect(service.review({context:{...c,scope:{...c.scope,studentId:'foreign'}},observationHandle:handle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]})).rejects.toThrow('exact_backend_observation_handle_required');expect(calls).toBe(1);
  const review=await service.review({context:c,observationHandle:handle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});expect(review.rows[0].blockers).toContain('source_before_or_contract_drift');expect(review.patch).toEqual([]);
  const stale=new DailyRecordService(backend(),safeguard,()=>clock+300001);const result=await stale.intake({context:c});expect(result.blockers).toContain('stale_source');expect(result.observationHandle).toBeNull();
});
test('foreign current/prior/tone target, invalid date, and unbound previous value are unqualified',async()=>{
  for(const mutate of [(o:ReturnType<typeof observation>)=>{o.target.teacherId='foreign';},(o:ReturnType<typeof observation>)=>{o.previousTarget!.recordId=o.target.recordId;},(o:ReturnType<typeof observation>)=>{o.toneSamples[0].target.studentId='foreign';},(o:ReturnType<typeof observation>)=>{o.previousTarget=null;}]){
    const o=observation();mutate(o);let calls=0;const service=new DailyRecordService(backend(()=>{calls++;return o;}),safeguard,()=>clock,learningPolicy);const result=await service.intake({context:context()});expect(result.sourceAvailability).toBe('unavailable');expect(result.observationHandle).toBeNull();await service.intake({context:context()});expect(calls).toBe(1);
  }
  await expect(new DailyRecordService().intake({context:{...context(),scope:{...context().scope,lessonDate:'2040-02-30'}}})).rejects.toThrow();
});
test('completed solving/grading cannot justify completed unconfirmed correction',async()=>{
  const {service,c,handle}=await setup();c.facts=[{...fact('progress','풀이·채점 완료. 오답 수정 진행.'),stageClaims:[{activity:'지정 문제',stage:'grading',status:'complete',rendering:'풀이·채점 완료'},{activity:'지정 문제',stage:'correction',status:'unconfirmed',rendering:'오답 수정 진행'}]}];
  const result=await service.review({context:c,observationHandle:handle,proposals:[proposal('progress','풀이·채점 완료. 오답 수정 완료.')]});
  expect(result.rows[0].blockers).toContain('stage_completion_mismatch:correction');expect(result.rows[0].blockers).toContain('unsupported_stage_completion_claim:correction');expect(result.patch).toEqual([]);
});
test('review preserves counts, deadlines, stages and existing edits; canonical blockers are field-local',async()=>{
  const {service,c,handle}=await setup();c.selectedFields=['progress','homework'];
  c.facts=[{...fact('progress','지정 문제 12문항 풀이·채점까지 완료. 오답 수정 진행.'),requiredFragments:['오답 수정 진행'],questionCounts:[{count:12,rendering:'12문항'}],stageClaims:[{activity:'지정 문제',stage:'grading',status:'complete',rendering:'풀이·채점까지 완료'}]},
    {...fact('homework','1월 19일까지 지정 7문항 풀어오기.'),questionCounts:[{count:7,rendering:'7문항'}],deadlines:[{date:'2040-01-19',rendering:'1월 19일'}]}];
  const good=await service.review({context:c,observationHandle:handle,proposals:[proposal('progress','지정 문제 12문항 풀이·채점까지 완료. 오답 수정 진행.'),proposal('homework','1월 19일까지 지정 7문항 풀어오기.')]});expect(good.status).toBe('prepared');expect(good.patch).toHaveLength(2);expect(good.academyWrites).toBe(0);expect(good.parentSends).toBe(0);
  const bad=await service.review({context:c,observationHandle:handle,proposals:[proposal('progress','교사 최종 완료판정. 15문항 오답 수정 완료.'),{...proposal('homework','1월 20일까지 지정 7문항 풀어오기.'),decision:{kind:'set',requestRef:c.currentRequestRef}}]});
  expect(bad.rows[0].blockers).toContain('parent_internal_language_excluded');expect(bad.rows[0].blockers).toContain('unsupported_question_count');expect(bad.rows[0].blockers).toContain('supplied_fact_fragment_missing');
  expect(bad.rows[1].blockers).toContain('unsupported_deadline');expect(bad.rows[1].blockers).toContain('existing_value_requires_explicit_replace');expect(bad.patch).toEqual([]);
});
test('missing canonical safeguard holds text review and no-op remains nonwriting',async()=>{
  const c=context(),service=new DailyRecordService(backend(),null,()=>clock,learningPolicy),intake=await service.intake({context:c});
  const held=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});expect(held.rows[0].blockers).toContain('canonical_parent_safeguard_not_connected');
  const ready=await setup();const noop=await ready.service.review({context:ready.c,observationHandle:ready.handle,proposals:[{...proposal('progress','기존 사용자 진도 문안'),value:'기존 사용자 진도 문안'}]});expect(noop.rows[0].disposition).toBe('noop');expect(noop.patch).toEqual([]);
});
test('pure parent-text review works without source and emits substantive blockers without a patch',async()=>{
  const c=context(),service=new DailyRecordService(null,safeguard,()=>clock,learningPolicy);
  const result=await service.review({context:c,proposals:[proposal('progress','교사 최종 완료판정. 19문항 풀이 완료.')]});
  expect(result.observationHandle).toBeNull();expect(result.sourceRevision).toBeNull();expect(result.status).toBe('held');expect(result.patch).toEqual([]);
  for(const blocker of ['qualified_before_source_unavailable','parent_internal_language_excluded','unsupported_question_count','unsupported_completion_claim'])expect(result.rows[0].blockers).toContain(blocker);
});
test('review digest binds full current context, canonical pins and exact CISM source identity',async()=>{
  const {service,c,handle}=await setup(),args={context:c,observationHandle:handle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]};
  const first=await service.review(args);c.purpose='Additional teacher-provided purpose.';const second=await service.review(args);expect(second.rows).toEqual(first.rows);expect(second.reviewDigest).not.toBe(first.reviewDigest);expect(second.userContextDigest).not.toBe(first.userContextDigest);
  c.facts[0].text+=' 사용자 근거 설명 추가.';const third=await service.review(args);expect(third.rows).toEqual(second.rows);expect(third.reviewDigest).not.toBe(second.reviewDigest);
  const other=new DailyRecordService(null,{...safeguard,policySha256:'9'.repeat(64)},()=>clock,learningPolicy);
  const pure1=await new DailyRecordService(null,safeguard,()=>clock,learningPolicy).review({context:c,proposals:args.proposals}),pure2=await other.review({context:c,proposals:args.proposals});
  expect(pure1.rows).toEqual(pure2.rows);expect(pure1.reviewDigest).not.toBe(pure2.reviewDigest);
});
test('new read evidence refs preserve value comparisons and transmission state remains observational',async()=>{
  let calls=0;const service=new DailyRecordService(backend(()=>{const o=observation();calls++;o.fields.progress={...o.fields.progress,state:'known',value:'기존 사용자 진도 문안',evidenceRefs:['synthetic-query-'+calls]};o.transmissionState='already_sent';return o;}),safeguard,()=>clock,learningPolicy);
  const c=context(),intake=await service.intake({context:c});
  const result=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[proposal('progress','지정 문제 12문항 풀이 진행.')]});expect(result.status).toBe('prepared');expect(result.transmissionState).toBe('already_sent');expect(result.parentSends).toBe(0);
});
test('read failures latch and serialize; no automatic retry or leaked backend error',async()=>{
  let calls=0,active=0,max=0;const service=new DailyRecordService({async readDailyRecord(){calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;throw Error('SECRET_MUST_NOT_LEAK');}},safeguard,()=>clock,learningPolicy);
  const results=await Promise.all([service.intake({context:context()}),service.intake({context:context()})]);expect(calls).toBe(1);expect(max).toBe(1);expect(JSON.stringify(results)).not.toContain('SECRET');
});
test('CISM is unavailable by default; exact period/student/section and bound source handles are required',async()=>{
  const c=context(),selection={reportId:'report-synthetic',periodStart:'2040-01-08',periodEnd:'2040-01-14',section:'learning_support' as const};
  expect(await new DailyRecordService().cism({context:c,selection})).toMatchObject({status:'unavailable',observationHandle:null,parentSends:0});
  const cism={scope:c.scope,selection,observedAt:new Date(clock).toISOString(),sourceRevision:'5'.repeat(64),sourceReferenceDate:'2040-01-12',sectionLabel:'학습부진아 지도' as const,text:'매일 짧게 복습하는 습관을 안내합니다.',evidenceRefs:['synthetic-cism-section']};
  const port=backend();port.readCismSection=async()=>({status:'observed',observation:cism});const service=new DailyRecordService(port,safeguard,()=>clock,learningPolicy);
  const result=await service.cism({context:c,selection});expect(result.status).toBe('observed');
  const intake=await service.intake({context:c});c.selectedFields=['lessonMemo'];c.memoAnswer={kind:'content',requestRef:c.currentRequestRef,text:cism.text};c.facts=[{...fact('lessonMemo',cism.text),ref:'synthetic-cism-section',origin:'cism_section'}];
  const p={...proposal('lessonMemo',cism.text),factRefs:['synthetic-cism-section']};
  const unbound=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[p]});expect(unbound.rows[0].blockers).toContain('cism_fact_not_bound_to_exact_observed_section');
  const bound=await service.review({context:c,observationHandle:intake.observationHandle,cismObservationHandle:result.observationHandle,proposals:[p]});expect(bound.status).toBe('prepared');
  cism.sourceRevision='6'.repeat(64);const next=await service.cism({context:c,selection});
  const rebound=await service.review({context:c,observationHandle:intake.observationHandle,cismObservationHandle:next.observationHandle,proposals:[p]});expect(rebound.rows).toEqual(bound.rows);expect(rebound.reviewDigest).not.toBe(bound.reviewDigest);expect(rebound.cismSource?.sourceRevision).toBe('6'.repeat(64));
  port.readCismSection=async()=>({status:'observed',observation:{...cism,selection:{...selection,periodStart:'2040-01-01'}}});expect(await service.cism({context:c,selection})).toMatchObject({status:'unavailable'});
  await expect(service.cism({context:c,selection:{...selection,section:'other'}})).rejects.toThrow();
});
test('CISM rejects an outside-period source reference date and latches qualification failures',async()=>{
  const c=context(),selection={reportId:'report-synthetic',periodStart:'2040-01-08',periodEnd:'2040-01-14',section:'learning_support' as const};let calls=0;
  const service=new DailyRecordService({...backend(),async readCismSection(){calls++;return {status:'observed',observation:{scope:c.scope,selection,observedAt:new Date(clock).toISOString(),sourceRevision:'5'.repeat(64),sourceReferenceDate:'2040-01-16',sectionLabel:'학습부진아 지도',text:'합성 내용',evidenceRefs:['synthetic']}};}},safeguard,()=>clock,learningPolicy);
  expect(await service.cism({context:c,selection})).toMatchObject({status:'unavailable'});expect(await service.cism({context:c,selection})).toMatchObject({status:'unavailable'});expect(calls).toBe(1);
});
test('launch configuration reuses hash-pinned canonical regex bytes without importing source',async()=>{
  const dir=await mkdtemp(resolve(tmpdir(),'synthetic-dailyrecord-policy-'));
  try{const policy=resolve(dir,'policy.md'),source=resolve(dir,'source.ts'),policyBytes='# DailyRecord authoring policy\nSynthetic test policy only.',sourceBytes="export const parentDailyRecordLines=/^- [^\\r\\n]+(?:\\n- [^\\r\\n]+)*$/;\nexport const parentInternalLanguage=/교사\\s*(?:최종\\s*)?완료\\s*판정/i;\nthrow Error('must-never-run');\n";
    await writeFile(policy,policyBytes);await writeFile(source,sourceBytes);const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
    const config=await dailyRecordToolConfiguration(['--dailyrecord-policy',policy,sha(policyBytes),source,sha(sourceBytes),'--label-snapshot','synthetic']);expect(config.remainingArgs).toEqual(['--label-snapshot','synthetic']);expect(config.parentSafeguard?.check('교사 최종 완료판정')).toBe(true);
    await expect(dailyRecordToolConfiguration(['--dailyrecord-policy',policy,'0'.repeat(64),source,sha(sourceBytes)])).rejects.toThrow();
  }finally{await rm(dir,{recursive:true,force:true});}
});
