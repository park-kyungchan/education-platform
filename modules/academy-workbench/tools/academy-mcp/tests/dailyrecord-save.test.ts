import {expect,test} from 'bun:test';
import {DailyRecordService,type DailyRecordWriteBackend} from '../src/dailyrecord.ts';
import {createDailyRecordSaveAdmission,type DailyRecordSaveAdmission} from '../src/dailyrecord-save-admission.ts';
import {backend,clock,context,learningPolicy,proposal,safeguard,scope} from './dailyrecord-fixture.ts';

function writeBackend(calls:{field:string;value:string}[][]):DailyRecordWriteBackend{
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
  const calls:{field:string;value:string}[][]=[];
  const {service,c,proposals,intake,review}=await prepared(writeBackend(calls));
  const saved=await service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:review.reviewDigest,proposals});
  expect(saved).toMatchObject({status:'saved',academyWrites:1,execution:'owner_write_backend',
    fields:[{field:'progress',status:'persisted',dispatched:true}]});
  expect(calls).toEqual([[{field:'progress',value:'- 지정 문제 12문항 풀이 진행.'}]]);
});

test('unreviewed or drifted digests are held before any write',async()=>{
  const calls:{field:string;value:string}[][]=[];
  const {service,c,proposals,intake}=await prepared(writeBackend(calls));
  const saved=await service.save({context:c,observationHandle:intake.observationHandle!,reviewDigest:'9'.repeat(64),proposals});
  expect(saved).toMatchObject({status:'held',reasonCode:'reviewed_patch_required',academyWrites:0});
  expect(calls).toEqual([]);
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
