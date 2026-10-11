import {describe, expect, test} from 'bun:test';
import {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication} from '../../src/academy/application';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets, signTeacherSession} from '../../src/academy/auth';

const socket=process.env.DC_ACADEMY_TEST_SOCKET;
test('exported observation ingress rejects nested accessors before any store call',async()=>{
  let calls=0,accessed=false;
  const store={students:async()=>{calls++;return [];}} as unknown as PostgresAcademyStore;
  const app=new TeacherApplication(store,'fixture-owner');
  const occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
  Object.defineProperty(occurrence,'date',{enumerable:true,get(){accessed=true;return '2025-01-02';}});
  await expect(app.saveObservation({ownerId:'fixture-owner',actorId:'fixture-teacher',role:'teacher'},{studentId:'fixture',occurrence,basisRevisionId:'fixture-basis',expectedRevisionId:null,idempotencyKey:'fixture-note',reportedAt:'2025-01-02T01:00:00Z',text:'Invented observation'})).rejects.toThrow('accessors are not JSON data');
  expect(calls).toBe(0);expect(accessed).toBe(false);
});
test('valid maximal Korean observations cross HTTP byte ingress and oversized bodies refuse before application calls',async()=>{
  let calls=0;
  const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey,ownerId='fixture-byte-owner',actorId='fixture-byte-teacher';
  // Transport boundary only; persisted maximal text is exercised by the existing browser/HTTP/PostgreSQL suite.
  const app={ownerId,saveObservation:async(_context:unknown,input:{text:string})=>{calls++;return {retainedCharacters:input.text.length};}} as unknown as TeacherApplication;
  const handler=createTeacherServerHandler({app,origin,sessionKey,identity:{actorId,username:'fixture-only',passwordHash:'not-a-real-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
  const body=JSON.stringify({text:'가'.repeat(16000)}),headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId),Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':ownerId,'X-Teacher-Actor':actorId};
  const response=await handler(new Request(origin+'/api/teacher-observation',{method:'POST',headers:{...headers,'Content-Length':String(Buffer.byteLength(body))},body}));
  expect(response.status).toBe(200);expect((await response.json()).retainedCharacters).toBe(16000);expect(calls).toBe(1);
  const oversized=' '.repeat(128001);
  const refused=await handler(new Request(origin+'/api/teacher-observation',{method:'POST',headers,body:oversized}));
  expect(refused.status).toBe(400);expect(await refused.json()).toEqual({error:'input_too_large'});expect(calls).toBe(1);
});
describe.skipIf(!socket)('source-bound teacher observation through the actual HTTP/application/PostgreSQL path',()=>{
  test('fresh identical observation requests retain their own revisions, predecessors and actor-bound recovery',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
    const store=new PostgresAcademyStore(db);await store.migrate();
    const owner='fixture-identical-observation-'+randomUUID(),studentId='fixture-identical-student';
    const occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
    try{
      await store.registerStudent({ownerId:owner,id:studentId,displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['synthetic-binding']});
      const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{...occurrence,teacherKey:'11001',studentKey:'91001',studentName:'Invented Learner',fields:{attendance:'N'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:occurrence.date,groupIds:[occurrence.groupId],studentNames:['Invented Learner']},observedAt:'2025-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false};
      const basis=await store.append({ownerId:owner,studentId,entityId:'fixture-identical-source',actorId:'fixture-reader',idempotencyKey:'fixture-identical-read',expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'synthetic-source-contract'}});
      const app=new TeacherApplication(store,owner),context={ownerId:owner,actorId:'fixture-teacher-a',role:'teacher' as const};
      const input={studentId,occurrence,basisRevisionId:basis.revisionId,expectedRevisionId:null,idempotencyKey:'fixture-identical-a',reportedAt:'2025-01-02T10:00:00+09:00',text:'Invented identical observation'};
      const first=await app.saveObservation(context,input);
      const next={...input,expectedRevisionId:first.revisionId,idempotencyKey:'fixture-identical-b'};
      const second=await app.saveObservation(context,next);
      expect(second.status).toBe('saved');expect(second.revisionId).not.toBe(first.revisionId);
      expect(second.record.idempotencyKey).toBe(next.idempotencyKey);expect(second.record.previousRevisionId).toBe(first.revisionId);
      expect(second.record.payload).toEqual(first.record.payload);
      expect((await app.observationResult(context,studentId,next.idempotencyKey)).record).toEqual(second.record);
      expect((await app.saveObservation(context,next)).record).toEqual(second.record);
      const other={...context,actorId:'fixture-teacher-b'},thirdInput={...next,expectedRevisionId:second.revisionId,idempotencyKey:'fixture-identical-c'};
      const third=await app.saveObservation(other,thirdInput);
      expect(third.record.actorId).toBe(other.actorId);expect(third.record.previousRevisionId).toBe(second.revisionId);
      expect((await app.observationResult(other,studentId,thirdInput.idempotencyKey)).record).toEqual(third.record);
      await expect(app.observationResult(context,studentId,thirdInput.idempotencyKey)).rejects.toThrow('observation_result_not_found');
      expect((await store.history(owner,studentId,first.record.entityId))).toHaveLength(3);
    }finally{await db.close();}
  });
  test('saves an original, replays its exact request, appends a correction and reads persisted revisions after reopen',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:3});
    const store=new PostgresAcademyStore(db);await store.migrate();
    const owner='fixture-observation-'+randomUUID(),studentId='fixture-observation-student',actorId='fixture-teacher';
    const occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
    await store.registerStudent({ownerId:owner,id:studentId,displayName:'Invented Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['synthetic-binding']});
    const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{...occurrence,teacherKey:'11001',studentKey:'91001',studentName:'Invented Learner',fields:{attendance:'N',homework:'Invented range'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:occurrence.date,groupIds:[occurrence.groupId],studentNames:['Invented Learner']},observedAt:'2025-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false};
    const sourceCommand={ownerId:owner,studentId,entityId:'fixture-source',actorId:'fixture-reader',idempotencyKey:'fixture-read',expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit' as const,acquisition,contractRef:'synthetic-source-contract'}};
    const basis=await store.append(sourceCommand);
    const app=new TeacherApplication(store,owner),sessionKey=createAuthSecrets().sessionKey;
    const origin='https://synthetic.example.invalid';
    const handler=createTeacherServerHandler({app,origin,sessionKey,identity:{actorId,username:'fixture-only',passwordHash:'not-a-real-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
    const headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,owner,actorId),Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':owner,'X-Teacher-Actor':actorId};
    const post=(value:unknown,requestHeaders:Record<string,string>=headers)=>handler(new Request(origin+'/api/teacher-observation',{method:'POST',headers:requestHeaders,body:JSON.stringify(value)}));
    const request={studentId,occurrence,basisRevisionId:basis.revisionId,expectedRevisionId:null,idempotencyKey:'fixture-note-original',reportedAt:'2025-01-02T01:00:00Z',text:'Invented teacher observation, not an approval.'};
    try{
      expect((await post(request,{'Content-Type':'application/json',Origin:origin})).status).toBe(401);
      expect((await post(request,{...headers,Origin:'https://foreign.example.invalid'})).status).toBe(403);
      const saved=await post(request);expect(saved.status).toBe(200);
      const first=await saved.json();
      expect(first).toMatchObject({status:'saved',officialSaved:false,parentSent:false});
      expect(first.record.payload).toMatchObject({kind:'teacher_observation',occurrence,text:request.text,basisRevisionId:basis.revisionId});
      expect(first.record.actorId).toBe(actorId);
      const recovery=await handler(new Request(origin+'/api/teacher-observation-result?studentId='+studentId+'&requestId='+request.idempotencyKey,{headers}));
      expect(recovery.status).toBe(200);
      expect((await recovery.json()).record.revisionId).toBe(first.revisionId);
      expect((await handler(new Request(origin+'/api/teacher-observation-result?studentId=foreign&requestId='+request.idempotencyKey,{headers}))).status).toBe(403);
      expect((await (await post(request)).json()).revisionId).toBe(first.revisionId);
      expect((await post({...request,text:'Different intent with the same request ID'})).status).toBe(409);
      const correction={...request,expectedRevisionId:first.revisionId,idempotencyKey:'fixture-note-correction',reportedAt:'2025-01-02T02:00:00Z',text:'Invented corrected observation; source score unchanged.'};
      const corrected=await post(correction);expect(corrected.status).toBe(200);
      const second=await corrected.json();
      expect(second.record.previousRevisionId).toBe(first.revisionId);
      expect((await post({...correction,idempotencyKey:'fixture-stale',expectedRevisionId:null})).status).toBe(409);
      const history=await store.history(owner,studentId,first.record.entityId);
      expect(history.map(v=>v.payload)).toEqual([first.record.payload,second.record.payload]);
      expect((await store.current(owner,studentId)).find(v=>v.entityId==='fixture-source')!.revisionId).toBe(basis.revisionId);
      const read=await handler(new Request(origin+'/api/student?id='+studentId+'&date='+occurrence.date,{headers}));
      const scene=await read.json();
      expect(scene.evidence.some((v:any)=>v.revisionId===second.revisionId)).toBe(true);
      expect(scene.knowledge.teacherInspection).toBe('unknown');
      expect(scene.teacherObservationPolicy.originalObservation).toBe('preserve_as_report_without_required_approval');
      // A changed official source invalidates a NEW write but not recovery of a committed original request.
      const lateAcquisition={...acquisition,observedAt:'2025-01-03T00:00:00Z',dayRecords:[{...acquisition.dayRecords[0]!,fields:{attendance:'N',homework:'Invented changed range'}}]};
      await store.append({...sourceCommand,idempotencyKey:'fixture-late-source',expectedRevisionId:basis.revisionId,sourceObservedAt:lateAcquisition.observedAt,payload:{...sourceCommand.payload,acquisition:lateAcquisition}});
      expect((await post({...correction,idempotencyKey:'fixture-stale-evidence',expectedRevisionId:second.revisionId})).status).toBe(409);
      expect((await (await post(correction)).json()).revisionId).toBe(second.revisionId);
      expect((await post({...request,idempotencyKey:'fixture-forged',studentId:'foreign-student'})).status).toBe(403);
      expect((await post({...request,idempotencyKey:'fixture-extra',officialSaved:true})).status).toBe(400);
      expect((await store.history(owner,studentId,first.record.entityId))).toHaveLength(2);
      await db.close();
      const reopened=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'});
      try{expect((await new PostgresAcademyStore(reopened).history(owner,studentId,first.record.entityId)).map(v=>v.revisionId)).toEqual([first.revisionId,second.revisionId]);}
      finally{await reopened.close();}
    }finally{await db.close();}
  });
});
