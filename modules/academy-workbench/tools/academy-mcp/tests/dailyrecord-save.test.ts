import {expect,test} from 'bun:test';
import {DailyRecordService,type DailyRecordWriteBackend} from '../src/dailyrecord.ts';
import {createDailyRecordSaveAdmission,type DailyRecordSaveAdmission} from '../src/dailyrecord-save-admission.ts';
import {backend,clock,context,learningPolicy,proposal,safeguard,scope} from './dailyrecord-fixture.ts';

function writeBackend(calls:{field:string;value:string;before:string;wireDigest:string}[][]):DailyRecordWriteBackend{
  return {saveConfigured:()=>true,
    saveDailyRecord:async(_scope,patches)=>{calls.push(patches.map(p=>({...p})));return patches.map(p=>({field:p.field,status:'persisted' as const,dispatched:true}));}};
}
async function prepared(write:DailyRecordWriteBackend|null){
  const service=new DailyRecordService(backend(),safeguard,()=>clock,learningPolicy,write);
  const c=context(),proposals=[proposal('progress','지정 문제 12문항 풀이 진행.')];
  const intake=await service.intake({context:c});
  const review=await service.review({context:c,observationHandle:intake.observationHandle!,proposals});
  return {service,c,proposals,intake,review};
}

test('save without an owner write backend is fail-closed and writes nothing',async()=>{
  const {service,c,proposals,intake,review}=await prepared(null);
  expect(review.status).toBe('prepared');
  const saved=await service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:review.reviewDigest,proposals});
  expect(saved).toMatchObject({status:'unavailable',reasonCode:'dailyrecord_save_backend_not_configured',academyWrites:0,execution:'not_supported'});
});

test('reviewed patch saves exactly once through the write backend',async()=>{
  const calls:{field:string;value:string;before:string;wireDigest:string}[][]=[];
  const {service,c,proposals,intake,review}=await prepared(writeBackend(calls));
  const saved=await service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:review.reviewDigest,proposals});
  expect(saved).toMatchObject({status:'saved',academyWrites:1,execution:'owner_write_backend',
    fields:[{field:'progress',status:'persisted',dispatched:true}]});
  expect(calls).toEqual([[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.',before:'기존 사용자 진도 문안',wireDigest:'2'.repeat(64)}]]);
});

test('unreviewed or drifted digests are held before any write',async()=>{
  const calls:{field:string;value:string;before:string;wireDigest:string}[][]=[];
  const {service,c,proposals,intake}=await prepared(writeBackend(calls));
  const saved=await service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:'9'.repeat(64),proposals});
  expect(saved).toMatchObject({status:'held',reasonCode:'reviewed_patch_required',academyWrites:0});
  expect(calls).toEqual([]);
});

test('live request evidence is re-read per consumption and stale files reject',async()=>{
  const {writeFileSync,mkdtempSync}=await import('node:fs');
  const {join}=await import('node:path');
  const {tmpdir}=await import('node:os');
  const {liveSaveRequestEvidence,createDailyRecordSaveAdmission}=await import('../src/dailyrecord-save-admission.ts');
  const dir=mkdtempSync(join(tmpdir(),'save-evidence-'));
  const path=join(dir,'current-request.json');
  const evidence={runtime:'synthetic-runtime',requestRef:'synthetic-request',requestTextSha256:'a'.repeat(64),currentUserEventRef:'event-1'};
  writeFileSync(path,JSON.stringify(evidence));
  const admission:DailyRecordSaveAdmission={schemaVersion:'academy.dailyrecord-save-admission/1',...evidence,
    admitted:[{studentId:scope.studentId,lessonDate:scope.lessonDate,field:'progress',effectRecordKey:'current-record-synthetic',after:'- 새 진도 문안'}]};
  const approval=createDailyRecordSaveAdmission(admission,{readCurrentRequest:liveSaveRequestEvidence(path),consumeOnce:async()=>true});
  const action={target:{studentKey:scope.studentId,date:scope.lessonDate},field:'progress',effectRecordKey:'current-record-synthetic',after:'- 새 진도 문안'};
  expect((await approval.consumeApproval(action)).status).toBe('verified');
  writeFileSync(path,JSON.stringify({...evidence,currentUserEventRef:'event-2'}));
  expect((await approval.consumeApproval(action)).status).toBe('rejected');
});

test('native backend refuses drifted before-state before any write and reports client throws as unresolved',async()=>{
  const {NativeDailyRecordBackend}=await import('../src/native-dailyrecord-backend.ts');
  const nativeScope={sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',studentId:'77001',lessonDate:'2040-01-04'};
  const nativeAdmission={teacherId:'99001',teacherLabel:'Invented Teacher',date:'2040-01-04',
    students:[{studentId:'77001',displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
  const target={studentName:'Invented Student',date:'2040-01-04',groupId:'3',teacherKey:'99001',studentKey:'77001',courseKey:'5',recordKey:'13',membershipKey:'8'};
  const row={...target,fields:{progress:'Current progress',homework:'Current homework',lessonMemo:'Current memo',attendance:'Y'}};
  let writes=0,mode:'persist'|'throw'='persist';
  const port={authenticate:async()=>{},discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
    execute:async()=>({dayRecords:[row]}),
    journalState:async()=>({target,fields:{...row.fields,dailyTestAssessment:'0',previousHomeworkAssessment:'3'},previousRecordKey:'12',previousDate:'2040-01-02',wireDigest:'a'.repeat(64)}),
    applyJournalAction:async()=>{writes++;if(mode==='throw')throw Error('transport_uncertain');return {status:'persisted' as const,transport:'returned' as const};},close:()=>{}};
  const approval={consumeApproval:async()=>({status:'verified' as const,actionDigest:'c'.repeat(64)})};
  const backend=new NativeDailyRecordBackend(port as never,nativeAdmission,()=>({username:'fictional',password:'fictional'}),null,new Set(['Invented Student']),null,approval as never);
  expect(backend.saveConfigured()).toBe(true);
  const drifted=await backend.saveDailyRecord(nativeScope,[{field:'progress',value:'- 새 문안',before:'다른 기존 문안',wireDigest:'a'.repeat(64)}]);
  expect(drifted).toEqual([{field:'progress',status:'before_drift',dispatched:false}]);expect(writes).toBe(0);
  const saved=await backend.saveDailyRecord(nativeScope,[{field:'progress',value:'- 새 문안',before:'Current progress',wireDigest:'a'.repeat(64)}]);
  expect(saved).toEqual([{field:'progress',status:'persisted',dispatched:true}]);expect(writes).toBe(1);
  mode='throw';
  const uncertain=await backend.saveDailyRecord(nativeScope,[{field:'progress',value:'- 새 문안',before:'Current progress',wireDigest:'a'.repeat(64)}]);
  expect(uncertain).toEqual([{field:'progress',status:'unresolved',dispatched:true}]);
});

test('save admission consumes an exact admitted action once and rejects foreign scope',async()=>{
  const evidence={runtime:'synthetic-runtime',requestRef:'synthetic-request',requestTextSha256:'a'.repeat(64),currentUserEventRef:'synthetic-event'};
  const admission:DailyRecordSaveAdmission={schemaVersion:'academy.dailyrecord-save-admission/1',...evidence,
    admitted:[{studentId:scope.studentId,lessonDate:scope.lessonDate,field:'progress',effectRecordKey:'current-record-synthetic',after:'- 새 진도 문안'}]};
  const consumed:string[]=[];
  const approval=createDailyRecordSaveAdmission(admission,{
    readCurrentRequest:async()=>evidence,
    consumeOnce:async key=>{if(consumed.includes(key))return false;consumed.push(key);return true;},
  });
  const action={target:{studentKey:scope.studentId,date:scope.lessonDate},field:'progress',effectRecordKey:'current-record-synthetic',after:'- 새 진도 문안'};
  expect((await approval.consumeApproval(action)).status).toBe('verified');
  expect((await approval.consumeApproval(action)).status).toBe('rejected');
  expect((await approval.consumeApproval({...action,after:'- 다른 문안'})).status).toBe('rejected');
  const foreign=createDailyRecordSaveAdmission(admission,{
    readCurrentRequest:async()=>({...evidence,currentUserEventRef:'foreign-event'}),
    consumeOnce:async()=>true,
  });
  expect((await foreign.consumeApproval(action)).status).toBe('rejected');
});
