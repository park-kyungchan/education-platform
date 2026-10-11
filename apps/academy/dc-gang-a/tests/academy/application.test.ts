import { beforeAll, describe, expect, test } from 'bun:test';
import {ensureSyntheticStudentFixture} from './postgresFixture';
import { SQL } from 'bun';
import { TeacherApplication } from '../../src/academy/application';
import { PostgresAcademyStore } from '../../src/academy/postgresStore';
import { randomUUID } from 'node:crypto';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('shared teacher/application query boundary',()=>{
  beforeAll(ensureSyntheticStudentFixture);
  test('existing student and date-class queries consume retained teacher completion without rewriting legacy records',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test',max:1});
    try{
      const store=new PostgresAcademyStore(db);await store.migrate();
      const owner='fixture-history-owner-'+randomUUID(),id='fixture-history-student';
      const sourceStudent={namespace:'academy_student',literalKey:'91001'};
      await store.registerStudent({ownerId:owner,id,displayName:'Invented History Learner',sourceKey:sourceStudent,proofRefs:['fixture']});
      await store.saveCatalog(owner,{id:'fixture-history-book',kind:'book_edition',sourceKey:{namespace:'academy_book',literalKey:'94001'},label:'Invented book',parent:{state:'unknown',reason:'root'}});
      const append=async(entityId:string,payload:any)=>store.append({ownerId:owner,studentId:id,entityId,actorId:'fixture-teacher',idempotencyKey:entityId,expectedRevisionId:null,sourceObservedAt:'2090-01-02T00:00:00Z',payload},'2090-01-02T00:00:01Z');
      await append('fixture-history-book-edge',{kind:'source_book_registration',sourceStudent,sourceCourse:{namespace:'academy_course',literalKey:'92001'},sourceUserCourse:{namespace:'academy_user_course',literalKey:'93001'},sourceBook:{namespace:'academy_book',literalKey:'94001'},catalogNodeId:'fixture-history-book',sourceCourseLabel:'Invented 가우스 course',sourceBookLabel:'Invented book',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:{state:'unknown',reason:'not_enrollment'},role:{state:'unknown',reason:'not_declared'},contractRef:'fixture',evidenceRefs:['fixture']});
      const payload={kind:'teacher_reported_note' as const,directiveRef:'fixture-directive',text:JSON.stringify({schemaVersion:1,kind:'teacher_confirmed_video_history_with_source_attachments',date:'2090-01-02',sourceStudentKey:'91001',directiveRef:'fixture-directive',sourceBookInventoryRefs:[{courseSourceKey:'92001',labelLiteral:'Invented book',units:[{unitSourceKey:'95001',labelLiteral:'1-1 Invented unit'}]}],completedUnits:[{courseSourceKey:'92001',unitSourceKey:'95001',labelLiteral:'1-1 Invented unit',videoState:'teacher_confirmed_resolved',basis:'explicit_teacher_historical_confirmation_list_retention_exception',videoSourceKeys:[],originalUploadIdentityInvented:false,problemSolvingEstablished:false}]})};
      await append('fixture-history-note',payload);
      const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{studentName:'Invented History Learner',date:'2090-01-02',groupId:'21001',teacherKey:'11001',studentKey:'91001',courseKey:'99001',recordKey:'41001',membershipKey:'81001',fields:{homework:'Invented assigned range'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:'2090-01-02',groupIds:['21001'],studentNames:['Invented History Learner']},observedAt:'2090-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['app_join_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false};
      await append('fixture-history-lesson',{kind:'source_audit',acquisition,contractRef:'fixture'});
      const app=new TeacherApplication(store,owner),context={ownerId:owner,actorId:'fixture-teacher',role:'teacher' as const};
      const scene=await app.student(context,id,'2090-01-02');
      expect(scene.preparation.books[0]!.units[0]!.video.state).toBe('teacher_confirmed_resolved');
      expect((await app.classPreparation(context,'2090-01-02')).rows[0]!.preparation).toEqual(scene.preparation);
      expect((await store.history(owner,id,'fixture-history-note'))).toHaveLength(1);
      expect((await store.current(owner,id)).find(h=>h.entityId==='fixture-history-note')!.payload).toEqual(payload);
      const activity={kind:'teacher_activity_revision' as const,sourceStudent,sourceCourse:{namespace:'academy_course',literalKey:'92001'},sourceBook:{namespace:'academy_book',literalKey:'94001'},sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'prestudy_review' as const,scope:'minor_unit' as const,decision:'accepted' as const,effectiveDate:'2090-01-02',authority:'explicit_teacher_report' as const,directiveRef:'fixture-explicit-review',evidenceRefs:['fixture-review']};
      const command={ownerId:owner,studentId:id,entityId:'fixture-teacher-activity',actorId:'fixture-teacher',idempotencyKey:'fixture-accept',expectedRevisionId:null,sourceObservedAt:'2090-01-02T00:00:02Z',payload:activity};
      await expect(store.append({...command,entityId:'fixture-foreign-book',idempotencyKey:'fixture-foreign-book',payload:{...activity,sourceBook:{namespace:'academy_book',literalKey:'94002'}}},'2090-01-02T00:00:03Z')).rejects.toThrow('preparation_book_binding_conflict');
      const accepted=await store.append(command,'2090-01-02T00:00:03Z');
      await expect(store.append({...command,idempotencyKey:'fixture-rebound-target',expectedRevisionId:accepted.revisionId,sourceObservedAt:'2090-01-03T00:00:00Z',payload:{...activity,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95002'}}},'2090-01-03T00:00:01Z')).rejects.toThrow('preparation_identity_changed');
      await store.append({...command,idempotencyKey:'fixture-reopen',expectedRevisionId:accepted.revisionId,sourceObservedAt:'2090-01-03T00:00:00Z',payload:{...activity,decision:'reopen',effectiveDate:'2090-01-03',directiveRef:'fixture-explicit-reinspection'}},'2090-01-03T00:00:01Z');
      const past=await app.student(context,id,'2090-01-02');
      expect(past.preparation.books[0]!.units[0]!.video.teacherRevisionRefs).toContain(accepted.revisionId);
      const latest=await app.student(context,id,'2090-01-03');
      expect(latest.preparation.books[0]!.units[0]!.video.state).toBe('teacher_reinspection_required');
      expect(latest.preparation.books[0]!.units[0]!.video.priorAcceptanceRevisionRefs).toContain(accepted.revisionId);
      expect((await store.history(owner,id,'fixture-teacher-activity'))).toHaveLength(2);
      const sessionKey=createAuthSecrets().sessionKey;
      let handler:ReturnType<typeof createTeacherServerHandler>|null=null;
      const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:request=>handler?handler(request):new Response(null,{status:503})});
      try{
        const origin='http://127.0.0.1:'+server.port;
        handler=createTeacherServerHandler({app,origin,sessionKey,identity:{actorId:'fixture-teacher',username:'fixture-only',passwordHash:'not-a-live-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('fixture_identity_write_denied');}});
        const headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,owner,'fixture-teacher')};
        const response=await fetch(origin+'/api/student?id='+id+'&date=2090-01-03',{headers});
        expect(response.status).toBe(200);
        expect((await response.json()).preparation).toEqual(latest.preparation);
        expect((await fetch(origin+'/api/student?id='+id+'&date=2090-01-03')).status).toBe(401);
      }finally{await server.stop(true);}
    }finally{await db.close();}
  });
  test('serves a date-first official-source scene without hiding another scheduled student or inventing preparation joins',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'});
    const store=new PostgresAcademyStore(db);await store.migrate();
    const owner='fixture-date-owner-'+randomUUID();
    for(const [index,name] of ['Invented Learner A','Invented Learner B'].entries()){
      const studentKey=String(91001+index),id='fixture-date-student-'+index;
      await store.registerStudent({ownerId:owner,id,displayName:name,sourceKey:{namespace:'academy_student',literalKey:studentKey},proofRefs:['fixture']});
      const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{studentName:name,date:'2090-01-02',groupId:'21001',teacherKey:'11001',studentKey,courseKey:'99001',recordKey:String(41001+index),membershipKey:String(81001+index),fields:{attendance:index?'N':'Y',progress:'Invented progress',homework:'Invented range'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:'2090-01-02',groupIds:['21001'],studentNames:[name]},observedAt:'2090-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['app_join_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false};
      await store.append({ownerId:owner,studentId:id,entityId:'fixture-lesson-'+index,actorId:'fixture-source-reader',idempotencyKey:'fixture-read-'+index,expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'fixture'}},'2090-01-02T00:00:01Z');
    }
    const app=new TeacherApplication(store,owner),context={ownerId:owner,actorId:'fixture-teacher',role:'teacher' as const};
    const result=await app.classPreparation(context,'2090-01-02');
    expect((await app.cohort(context)).availableLessonDates).toEqual(['2090-01-02']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.some(row=>row.fields.attendance==='N')).toBe(true);
    expect(result.rows.every(row=>row.knowledge.homeworkAttemptJoin==='unknown')).toBe(true);
    expect((await app.classPreparation(context,'2090-01-03')).rows).toHaveLength(0);
    await expect(app.classPreparation({...context,ownerId:'foreign'},'2090-01-02')).rejects.toThrow('owner_scope_conflict');
    await db.close();
  });
  test('serves the same bounded source-grounded scene and refuses caller-owned foreign partitions',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'});
    const store=new PostgresAcademyStore(db);
    const app=new TeacherApplication(store,'fixture-owner-a');
    const scene=await app.student({ownerId:'fixture-owner-a',actorId:'fixture-user',role:'teacher'},'fixture-student-a');
    expect(scene.student.displayName).toBe('Invented Learner');
    expect(scene.connection).toMatchObject({retainedQuery:'available',acquisition:{transport:'direct_http_api',state:'blocked',reason:'direct_http_authentication_not_qualified',browserFallback:false},officialJournalSave:'not_implemented',parentSend:'teacher_owned'});
    expect(scene.allowedOperations).not.toContain('refresh_selected_source');
    expect((await app.cohort({ownerId:'fixture-owner-a',actorId:'fixture-user',role:'teacher'})).connection).toEqual(scene.connection);
    expect((await app.classPreparation({ownerId:'fixture-owner-a',actorId:'fixture-user',role:'teacher'},'2090-01-02')).connection).toEqual(scene.connection);
    expect(scene.knowledge.mastery).toBe('not_established');
    await expect(app.student({ownerId:'fixture-owner-b',actorId:'foreign-user',role:'teacher'},'fixture-student-a')).rejects.toThrow('owner_scope_conflict');
    await db.close();
  });
});
