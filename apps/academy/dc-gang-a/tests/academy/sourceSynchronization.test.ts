import {describe,expect,test} from 'bun:test';
import {SQL} from 'bun';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {SourceRefreshCoordinator} from '../../src/academy/refresh';
import {normalizeCohortDiscovery} from '../../src/academy/sourceBridge';
import {directScope as fixtureScope,directWitness as fixtureWitness} from './directSourceFixture';
import {planDayRecordEvidence} from '../../src/academy/sourceEvidence';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
const directScope={...fixtureScope,teacherKey:'99021'};
const directWitness=()=>{const value=fixtureWitness();value.authentication.principalKey=directScope.teacherKey;value.books.principalKey=directScope.teacherKey;return value;};

describe.skipIf(!socket)('student and source-area synchronization',()=>{
 test('one failed area retains prior evidence while a successful exact area commits and recovers without another read',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
  try{
   await store.migrate();const cohort=normalizeCohortDiscovery(directWitness().books,directScope.studentNames),student=cohort.students[0]!.registration;
   await store.registerStudent(student);const actor={ownerId:cohort.ownerId,actorId:'fixture-area-partial',role:'teacher' as const},date='2025-01-02';
   const day={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{teacherKey:directScope.teacherKey,date,groupId:'3',studentKey:student.sourceKey.literalKey,studentName:student.displayName,courseKey:'71001',recordKey:'41001',membershipKey:'81001',fields:{homework:'Invented retained homework'}}],requestedScope:{family:'day_record',teacherLabel:directScope.teacherLabel,date,groupIds:['3'],studentNames:[student.displayName]},observedAt:'2025-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false};
   const planned=planDayRecordEvidence(actor.ownerId,directScope.teacherKey,await store.students(actor.ownerId),[day])[0]!;
   await store.append({ownerId:actor.ownerId,studentId:student.id,entityId:planned.entityId,actorId:actor.actorId,idempotencyKey:'fixture-prior-day',expectedRevisionId:null,sourceObservedAt:planned.sourceObservedAt,payload:planned.payload});
   await store.append({ownerId:actor.ownerId,studentId:student.id,entityId:'fixture-teacher-original',actorId:actor.actorId,idempotencyKey:'fixture-teacher-original',expectedRevisionId:null,sourceObservedAt:'2025-01-02T00:00:00Z',payload:{kind:'teacher_reported_note',text:'Invented teacher original',directiveRef:'fixture-original'}});
   const before=await store.current(actor.ownerId,student.id),config={ownerId:actor.ownerId,...directScope};let reads=0;
   const read=async(request:unknown)=>{
    reads++;const input=request as {family:string;teacherLabel:string;studentKey:string;studentName:string};
    if(input.family==='day_record')return {status:'blocked' as const,reason:'fixture_area_outage'};
    const {family,...studentCourseScope}=input;
    return {status:'observed' as const,data:{schemaVersion:1,observedAt:'2025-01-03T00:00:00Z',authentication:directWitness().authentication,source:{schemaVersion:1,family:'student_course',status:'observed',records:[],dailyResults:[],dayRecords:[],studentCourses:[],studentCourseScope,observedAt:'2025-01-03T00:00:00Z',coverage:'observed_rows_not_all_assignments_or_pagination',unknownStates:[],nativePrintInvoked:false,automaticRetryAllowed:false},academyWrites:0,parentSends:0}};
   };
   const make=()=>new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:directWitness().books}),read);
   const coordinator=make(),requestId=crypto.randomUUID(),result=await coordinator.refresh(actor,student.id,requestId,date);
   expect(result.status).toBe('partial');
   if(!('areas' in result))throw Error('fixture_area_receipt_missing');
   expect(result.areas).toEqual(expect.arrayContaining([expect.objectContaining({family:'student_course',studentId:student.id,status:'observed'}),expect.objectContaining({family:'day_record',studentId:student.id,status:'blocked',reason:'fixture_area_outage'})]));
   const after=await store.current(actor.ownerId,student.id);
   for(const original of before)expect(after.find(row=>row.entityId===original.entityId)).toEqual(original);
   expect(after.some(row=>row.payload.kind==='source_audit'&&(row.payload.acquisition as {family:string}).family==='student_course')).toBe(true);
   expect(await make().refresh(actor,student.id,requestId,date)).toMatchObject({status:'partial',requestId});expect(reads).toBe(2);
   expect(await make().result({...actor,actorId:'foreign'},requestId)).toMatchObject({status:'not_found'});
   let deniedReads=0;
   const denied=new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:directWitness().books}),async()=>{deniedReads++;return {status:'blocked',reason:'source_login_challenge'};});
   const denial=await denied.refresh({...actor,actorId:'fixture-denied-area'},student.id,crypto.randomUUID(),date);
   expect(denial.status).toBe('partial');expect(deniedReads).toBe(1);
   // A later verification must not be regressed by an older response, even from another actor.
   const courseHead=(await store.current(actor.ownerId,student.id)).find(row=>row.payload.kind==='source_audit'&&(row.payload.acquisition as {family:string}).family==='student_course')!;
   const old=new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:directWitness().books}),async request=>{
    const outcome=await read(request);if(outcome.status==='observed'){outcome.data.observedAt='2025-01-01T00:00:00Z';outcome.data.source.observedAt='2025-01-01T00:00:00Z';}return outcome;
   });
   const stale=await old.refresh({...actor,actorId:'fixture-old-area'},student.id,crypto.randomUUID(),date);
   expect(stale).toMatchObject({status:'partial',areas:expect.arrayContaining([expect.objectContaining({family:'student_course',status:'failed',reason:'stale_source_capture'})])});
   expect((await store.current(actor.ownerId,student.id)).find(row=>row.entityId===courseHead.entityId)).toEqual(courseHead);
   // Proven base refusal must settle every planned area instead of leaving contradictory pending children.
   const refused=new SourceRefreshCoordinator(store,config,async()=>({status:'blocked',reason:'source_login_challenge'}),read);
   const stopped=await refused.refresh({...actor,actorId:'fixture-base-refused'},student.id,crypto.randomUUID(),date);
   expect(structuredClone(stopped)).toMatchObject({status:'blocked',areas:expect.arrayContaining([expect.objectContaining({family:'student_course',status:'blocked',reason:'source_login_challenge'})])});
   if(!('areas' in stopped))throw Error('fixture_area_receipt_missing');expect(stopped.areas?.every(area=>area.status!=='pending')).toBe(true);
   const dated=(clock:string,recordKey:string)=>new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:directWitness().books}),async request=>{
    if(request.family!=='day_record')return read(request);
    return {status:'observed',data:{schemaVersion:1,observedAt:clock,authentication:directWitness().authentication,source:{...day,observedAt:clock,dayRecords:[{...day.dayRecords[0]!,recordKey}]},academyWrites:0,parentSends:0}};
   });
   expect(await dated('2025-01-05T00:00:00Z','41002').refresh({...actor,actorId:'fixture-new-identity'},student.id,crypto.randomUUID(),date)).toMatchObject({status:'observed'});
   const advanced=await store.current(actor.ownerId,student.id);
   expect(await dated('2025-01-04T00:00:00Z','41003').refresh({...actor,actorId:'fixture-old-identity'},student.id,crypto.randomUUID(),date)).toMatchObject({status:'partial',areas:expect.arrayContaining([expect.objectContaining({family:'day_record',status:'failed',reason:'stale_source_capture'})])});
   expect((await store.current(actor.ownerId,student.id)).filter(row=>row.payload.kind==='source_audit'&&(row.payload.acquisition as {family:string}).family==='day_record')).toEqual(advanced.filter(row=>row.payload.kind==='source_audit'&&(row.payload.acquisition as {family:string}).family==='day_record'));
  }finally{await db.close();}
 });
});
