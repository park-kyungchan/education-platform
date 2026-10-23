import {expect,test} from 'bun:test';
import {NativeDailyRecordBackend,nativeDailyRecordConfigSchema,nativeDailyRecordConfiguration} from '../src/native-dailyrecord-backend.ts';

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
