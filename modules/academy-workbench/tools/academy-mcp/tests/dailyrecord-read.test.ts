import {expect,test} from 'bun:test';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {academyBusinessDate,dailyRecordGetSchema,readDailyRecordByName,type DailyRecordReadRoutePort} from '../src/dailyrecord-read.ts';
import {clock,observation} from './dailyrecord-fixture.ts';

const admission={sourceNamespace:'academy.lms.dayrecord' as const,teacherId:'99001',allowedFrom:'2040-01-15',allowedThrough:'2040-01-17'};
const request={displayName:'Invented Student',purpose:'Read today’s fictional DailyRecord',currentRequestRef:'synthetic-read-request'};
function fixture(){
  const calls:{names:string[];intakes:any[]}={names:[],intakes:[]};
  const service=new DailyRecordService({
    readRoutingAdmission:()=>admission,
    searchStudentsByName:async name=>{calls.names.push(name);return [{studentKey:'77001',studentName:name}];},
    readDailyRecord:async scope=>{
      const value=observation();value.scope={...scope};value.target={...value.target,...scope};
      value.previousTarget={...value.previousTarget!,sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId};
      value.toneSamples=[];return {status:'observed',observation:value};
    },
  },null,()=>clock);
  const port:DailyRecordReadRoutePort={resolveStudent:value=>service.resolveStudent(value),intake:async value=>{calls.intakes.push(value);return service.intake(value);}};
  return {service,port,calls};
}
test('name-only get resolves then calls qualified intake and returns fields despite authoring interview',async()=>{
  const f=fixture(),result=await readDailyRecordByName(request,f.port,admission,()=>clock);
  expect(result).toMatchObject({status:'observed',sourceAvailability:'observed',lessonDate:'2040-01-16',academyWrites:0,parentSends:0,
    route:['academy_student_resolve','academy_dailyrecord_intake'],preparation:{status:'interview_required',requiredOnlyForAuthoring:true}});
  expect(f.calls.names).toEqual([request.displayName]);expect(f.calls.intakes).toHaveLength(1);
  expect(f.calls.intakes[0].context.scope).toEqual({sourceNamespace:admission.sourceNamespace,teacherId:'99001',studentId:'77001',lessonDate:'2040-01-16'});
});
test('read defaults preserve absence of facts/memo and confer no proposal or review handle',async()=>{
  const f=fixture(),result=await f.service.get(request);
  expect(result.status).toBe('observed');expect(result).not.toHaveProperty('observationHandle');
  const routed=await readDailyRecordByName(request,f.port,admission,()=>clock);
  expect(f.calls.intakes[0]).toMatchObject({context:{scope:{sourceNamespace:admission.sourceNamespace,teacherId:'99001',studentId:'77001',lessonDate:'2040-01-16'},
    memoAnswer:{kind:'not_supplied'},facts:[],selectedFields:['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment']}});
  expect(f.calls.intakes[0]).not.toHaveProperty('suppliedValues');
  if(routed.status==='observed')expect(routed.fields.find(f=>f.field==='lessonMemo')?.before).toMatchObject({state:'known',value:'기존 준비물 안내'});
});
test('today is the academy date across UTC rollover, with exact real-date validation',async()=>{
  expect(academyBusinessDate(Date.parse('2040-01-16T14:59:59Z'))).toBe('2040-01-16');
  expect(academyBusinessDate(Date.parse('2040-01-16T15:00:00Z'))).toBe('2040-01-17');
  expect(dailyRecordGetSchema.parse(request).lessonDate).toBe('today');
  expect(()=>dailyRecordGetSchema.parse({...request,lessonDate:'2040-02-30'})).toThrow();
});
test('caller cannot inject keys, teacher, namespace, admission, facts, memo answers or approvals',async()=>{
  for(const extra of [{studentId:'77002'},{teacherId:'99002'},{sourceNamespace:'foreign'},{admission},{facts:[]},{memoAnswer:{kind:'no_addition'}},{approved:true},{suppliedValues:[]}]){
    const f=fixture();await expect(readDailyRecordByName({...request,...extra},f.port,admission,()=>clock)).rejects.toThrow();
    expect(f.calls.names).toEqual([]);expect(f.calls.intakes).toEqual([]);
  }
});
test('missing admission and dates outside it stop before name search',async()=>{
  const f=fixture();expect(await readDailyRecordByName(request,f.port,null,()=>clock)).toMatchObject({status:'unavailable',reasonCode:'dailyrecord_owner_read_admission_not_configured'});
  expect(await readDailyRecordByName({...request,lessonDate:'2040-01-18'},f.port,admission,()=>clock)).toMatchObject({reasonCode:'lesson_date_out_of_admitted_scope'});
  expect(f.calls.names).toEqual([]);expect(f.calls.intakes).toEqual([]);
});
test('unresolved, ambiguous and foreign names stop before intake without retry',async()=>{
  for(const resolution of [{status:'unavailable',reasonCode:'student_name_ambiguous'},{status:'unavailable',reasonCode:'student_name_not_found'},
    {status:'resolved',studentKey:'77001',displayName:'Other Invented Student'}]){
    let calls=0;const f=fixture();f.port.resolveStudent=async()=>{calls++;return resolution;};
    expect((await readDailyRecordByName(request,f.port,admission,()=>clock)).status).toBe('unavailable');
    expect(calls).toBe(1);expect(f.calls.intakes).toEqual([]);
  }
});
test('failed or malformed upstream intake cannot claim observed source or fall back to a snapshot',async()=>{
  for(const malformed of [null,{sourceAvailability:'observed',source:{},blockers:[],fields:[]}]){
    const f=fixture();let calls=0;f.port.intake=async()=>{calls++;return malformed;};
    expect(await readDailyRecordByName(request,f.port,admission,()=>clock)).toMatchObject({status:'unavailable',reasonCode:'dailyrecord_source_unqualified_no_automatic_retry'});
    expect(calls).toBe(1);
  }
  const f=fixture();f.port.resolveStudent=async()=>{throw Error('private backend detail');};
  expect(await readDailyRecordByName(request,f.port,admission,()=>clock)).toMatchObject({reasonCode:'student_resolve_unqualified_no_automatic_retry'});
  expect(f.calls.intakes).toEqual([]);
});
test('stale and foreign-scope intake cannot be reported as a current observed lookup',async()=>{
  for(const mutation of ['stale','scope'] as const){
    const f=fixture(),original=f.port.intake;
    f.port.intake=async input=>{const result:any=await original(input);if(mutation==='stale')result.source.observedAt='2040-01-15T00:00:00Z';else result.userContext.scope.teacherId='99002';return result;};
    expect((await readDailyRecordByName(request,f.port,admission,()=>clock)).status).toBe('unavailable');
  }
});
