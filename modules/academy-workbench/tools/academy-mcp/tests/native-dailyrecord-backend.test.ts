import {expect,test} from 'bun:test';
import {NativeDailyRecordBackend,nativeDailyRecordConfigSchema,nativeDailyRecordConfiguration} from '../src/native-dailyrecord-backend.ts';
import {DailyRecordService} from '../src/dailyrecord.ts';
import type {OwnerAdmission} from '../src/owner-admission.ts';

const scope={sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',studentId:'77001',lessonDate:'2040-01-04'};
const admission={teacherId:scope.teacherId,teacherLabel:'Invented Teacher',date:scope.lessonDate,
  students:[{studentId:scope.studentId,displayName:'Invented Student'}],sourceBundleSha256:'b'.repeat(64)};
const target={studentName:'Invented Student',date:scope.lessonDate,groupId:'3',teacherKey:scope.teacherId,studentKey:scope.studentId,courseKey:'5',recordKey:'13',membershipKey:'8'};
const row={...target,fields:{progress:'Current progress',homework:'Current homework',lessonMemo:'Current memo',attendance:'Y',persistentMemo:'Unselected private note'}};
const prior={...row,date:'2040-01-02',recordKey:'12',fields:{...row.fields,progress:'Previous teacher wording'}};
function fixture(){
 const calls:{auth:number;requests:any[]}={auth:0,requests:[]};
 const port={authenticate:async(_:unknown)=>{calls.auth++;},discoverDayRecordGroups:async()=>({groups:[{groupId:'3'}]}),
  execute:async(input:any)=>{calls.requests.push(input);return {dayRecords:[input.date===target.date?row:prior]};},
  journalState:async()=>({target,fields:{...row.fields,dailyTestAssessment:'0',previousHomeworkAssessment:'3'},previousRecordKey:'12',previousDate:prior.date,wireDigest:'a'.repeat(64)}),close:()=>{}};
 return {calls,port,backend:new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}))};
}
const range:OwnerAdmission={schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-04',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
 allowedFrom:'2040-01-03',allowedThrough:'2040-01-05',failClosedDefault:'2026-10-23'};
test('owner-pinned range is discoverable and admitted dates reach the source without widening teacher or student',async()=>{
 const f=fixture(),backend=new NativeDailyRecordBackend(f.port,admission,()=>({username:'fictional',password:'fictional'}),range);
 expect(backend.readRoutingAdmission()).toEqual({sourceNamespace:range.sourceNamespace,teacherId:range.teacherId,allowedFrom:range.allowedFrom,allowedThrough:range.allowedThrough});
 // Exact requested date reaches the source; a foreign returned date still fails identity qualification.
 await expect(backend.readDailyRecord({...scope,lessonDate:'2040-01-05'})).rejects.toThrow('native_dailyrecord_identity_conflict');
 expect(f.calls.auth).toBe(1);expect(f.calls.requests[0].date).toBe('2040-01-05');
 for(const changed of [{teacherId:'99002'},{studentId:'77002'},{lessonDate:'2040-01-06'}]){
  const fresh=fixture(),held=new NativeDailyRecordBackend(fresh.port,admission,()=>({username:'fictional',password:'fictional'}),range);
  await expect(held.readDailyRecord({...scope,...changed})).rejects.toThrow('native_dailyrecord_scope_refused');expect(fresh.calls.auth).toBe(0);
 }
});
test('missing range retains the exact launch date and foreign or incompatible owner admission is refused',()=>{
 const f=fixture();expect(f.backend.readRoutingAdmission()).toMatchObject({allowedFrom:scope.lessonDate,allowedThrough:scope.lessonDate});
 for(const changed of [{teacherId:'99002'},{allowedFrom:'2040-01-05'}])
  expect(()=>new NativeDailyRecordBackend(f.port,admission,()=>({username:'fictional',password:'fictional'}),{...range,...changed})).toThrow('native_dailyrecord_owner_admission_mismatch');
});
test('explicit open bounds are preserved at discovery and allow a qualified historical date',async()=>{
 const f=fixture(),open={...range,schemaVersion:'academy.owner-admission/2' as const,allowedFrom:null,allowedThrough:null};
 const backend=new NativeDailyRecordBackend(f.port,admission,()=>({username:'fictional',password:'fictional'}),open);
 expect(backend.readRoutingAdmission()).toMatchObject({allowedFrom:null,allowedThrough:null});
 await expect(backend.readDailyRecord({...scope,lessonDate:'2040-01-01'})).rejects.toThrow('native_dailyrecord_identity_conflict');
 expect(f.calls.requests[0].date).toBe('2040-01-01');
});
test('the native source port rereads current/prior occurrences, exports only six selected fields and keeps source revision independent of read time',async()=>{
 const {backend,calls}=fixture();const a=await backend.readDailyRecord(scope),b=await backend.readDailyRecord(scope);
 expect(calls.auth).toBe(1);expect(calls.requests).toHaveLength(4);
 expect(a.observation.target.recordId).toBe('13');expect(a.observation.previousTarget?.recordId).toBe('12');
 expect(Object.keys(a.observation.fields).sort()).toEqual(['attendance','dailyTestAssessment','homework','lessonMemo','previousHomeworkAssessment','progress']);
 expect(JSON.stringify(a)).not.toContain('Unselected private note');expect(JSON.stringify(a)).not.toContain('password');
 expect(a.observation.toneSamples[0]!.text).toContain('Previous teacher wording');
 expect(a.observation.sourceRevision).toBe(b.observation.sourceRevision);
 expect(a.observation.fields.progress).toMatchObject({state:'known',value:'Current progress'});
});
test('unadmitted namespace, teacher, student and date are refused before authentication',async()=>{
 for(const changed of [{sourceNamespace:'foreign'},{teacherId:'99002'},{studentId:'77002'},{lessonDate:'2040-01-05'}]){
  const {backend,calls}=fixture();await expect(backend.readDailyRecord({...scope,...changed})).rejects.toThrow('native_dailyrecord_scope_refused');expect(calls.auth).toBe(0);
 }
});
test('a matching name cannot substitute for current native student identity',async()=>{
 const f=fixture();f.port.execute=async()=>({dayRecords:[{...row,studentKey:'77002'}]});
 await expect(f.backend.readDailyRecord(scope)).rejects.toThrow('native_dailyrecord_identity_conflict');
});
test('source-verified student scope needs explicit owner policy, exact name and the same request',async()=>{
 const f=fixture(),newTarget={...target,studentName:'Second Invented Student',studentKey:'77002'};
 const newRow={...row,...newTarget},newPrior={...newRow,date:'2040-01-02',recordKey:'12'};
 const port={...f.port,searchStudentsByName:async()=>[{studentName:newTarget.studentName,studentKey:newTarget.studentKey}],
  execute:async(input:any)=>({dayRecords:[input.date===newTarget.date?newRow:newPrior]}),
  journalState:async()=>({target:newTarget,fields:{...row.fields,dailyTestAssessment:'0',previousHomeworkAssessment:'3'},previousRecordKey:'12',previousDate:newPrior.date,wireDigest:'a'.repeat(64)})};
 const open={...range,schemaVersion:'academy.owner-admission/2' as const,allowedFrom:null,allowedThrough:null,studentScope:'source_verified' as const};
 const managed=new Set(['Invented Student','Second Invented Student']);
 const backend=new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}),open,managed);
 await expect(backend.searchStudentsByName('Foreign Student','foreign-request')).rejects.toThrow();
 expect(f.calls.auth).toBe(0);
 await backend.searchStudentsByName(newTarget.studentName,'same-request');
 const newScope={...scope,studentId:'77002'};
 await expect(backend.readDailyRecord(newScope,'other-request')).rejects.toThrow('native_dailyrecord_scope_refused');
 expect((await backend.readDailyRecord(newScope,'same-request')).status).toBe('observed');
 const configured=new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}),{...open,studentScope:'configured'});
 await configured.searchStudentsByName(newTarget.studentName,'same-request');
 await expect(configured.readDailyRecord(newScope,'same-request')).rejects.toThrow('native_dailyrecord_scope_refused');
 const service=new DailyRecordService(new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}),open,managed));
 expect(await service.get({displayName:newTarget.studentName,lessonDate:scope.lessonDate,purpose:'Synthetic lesson read',currentRequestRef:'composed-request'}))
  .toMatchObject({status:'observed',sourceAvailability:'observed',academyWrites:0,parentSends:0});
 const ambiguous=new NativeDailyRecordBackend({...port,searchStudentsByName:async()=>[
  {studentName:newTarget.studentName,studentKey:'77002'},{studentName:newTarget.studentName,studentKey:'77003'}]},admission,()=>({username:'fictional',password:'fictional'}),open,managed);
 await ambiguous.searchStudentsByName(newTarget.studentName,'same-request');
 await expect(ambiguous.readDailyRecord(newScope,'same-request')).rejects.toThrow('native_dailyrecord_scope_refused');
});
test('date-qualified lookup uses the exact dated lesson row instead of a recent-test search',async()=>{
 const f=fixture(),events:string[]=[];
 const port={...f.port,searchStudentsByName:async()=>{events.push('recent-test');return [];},
  discoverDayRecordGroups:async(input:any)=>{events.push('groups:'+input.date);return {groups:[{groupId:'3'}]};},
  execute:async(input:any)=>{events.push('day:'+input.date);return {dayRecords:[input.date===target.date?row:prior]};}};
 const open={...range,schemaVersion:'academy.owner-admission/2' as const,allowedFrom:null,allowedThrough:null,studentScope:'source_verified' as const};
 const service=new DailyRecordService(new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}),open));
 const result=await service.get({displayName:'Invented Student',lessonDate:scope.lessonDate,purpose:'Synthetic dated read',currentRequestRef:'dated-request'});
 expect(result).toMatchObject({status:'observed',sourceAvailability:'observed'});
 expect(events).toEqual(['groups:2040-01-04','day:2040-01-04','groups:2040-01-04','day:2040-01-04','day:2040-01-02']);
 expect(events).not.toContain('recent-test');
});
test('date-qualified lookup never substitutes a foreign source row or falls back after a miss',async()=>{
 for(const rows of [[],[{...row,teacherKey:'99002'}],[row,{...row,recordKey:'14'}]]){
  let recent=0;const f=fixture(),port={...f.port,searchStudentsByName:async()=>{recent++;return [];},execute:async()=>({dayRecords:rows})};
  const open={...range,schemaVersion:'academy.owner-admission/2' as const,allowedFrom:null,allowedThrough:null,studentScope:'source_verified' as const};
  const service=new DailyRecordService(new NativeDailyRecordBackend(port,admission,()=>({username:'fictional',password:'fictional'}),open));
  const result=await service.get({displayName:'Invented Student',lessonDate:scope.lessonDate,purpose:'Synthetic dated read',currentRequestRef:'dated-request'});
  expect(result.status).toBe('unavailable');expect(recent).toBe(0);
 }
});
test('a foreign previous occurrence cannot supply homework assessment or a tone sample',async()=>{
 const f=fixture();f.port.execute=async(input:any)=>({dayRecords:[input.date===target.date?row:{...prior,recordKey:'11'}]});
 await expect(f.backend.readDailyRecord(scope)).rejects.toThrow('native_dailyrecord_previous_conflict');
});
test('authentication failure is retained, without automatically issuing another login',async()=>{
 const f=fixture();f.port.authenticate=async()=>{f.calls.auth++;throw Error('source_login_challenge');};
 await expect(f.backend.readDailyRecord(scope)).rejects.toThrow('source_login_challenge');
 await expect(f.backend.readDailyRecord(scope)).rejects.toThrow('source_login_challenge');expect(f.calls.auth).toBe(1);
});
test('native configuration rejects caller authority fields, duplicates and non-native launch',async()=>{
 const v={schemaVersion:'academy.native-dailyrecord-read/1',sourceBundlePath:'/explicit/bundle.mjs',sourceBundleSha256:'b'.repeat(64),date:scope.lessonDate,students:admission.students};
 expect(nativeDailyRecordConfigSchema.parse(v).students).toHaveLength(1);
 expect(()=>nativeDailyRecordConfigSchema.parse({...v,approved:true})).toThrow();
 expect(()=>nativeDailyRecordConfigSchema.parse({...v,students:[...v.students,...v.students]})).toThrow();
 await expect(nativeDailyRecordConfiguration(['--dailyrecord-native','/missing/config.json','b'.repeat(64)])).rejects.toThrow('native_dailyrecord_owner_required');
});
