import {describe, expect, test} from 'bun:test';
import {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication} from '../../src/academy/application';
import type {AcademyRecord} from '../../src/academy/records';
import type {CatalogNode} from '../../src/academy/domain';
import {known, unknown} from '../../src/learning/model';
import {JSDOM} from 'jsdom';
import {resolve} from 'node:path';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {teacherPage} from '../../src/academy/web/page';
import {learningWorkView} from '../../src/academy/web/learningWorkView';
import {buildTeacherWorkContext} from '../../src/academy/teacherWorkContext';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';

const socket=process.env.DC_ACADEMY_TEST_SOCKET;
async function fixture(){
  if(!socket)throw Error('synthetic_test_socket_required');
  const db=new SQL({adapter:'postgres',path:socket,username:'hermes',database:'dc_academy_test',max:2});
  const store=new PostgresAcademyStore(db);await store.migrate();
  const owner='fixture-context-'+randomUUID(),studentId='fixture-context-student',date='2025-01-02';
  const student={namespace:'academy_student',literalKey:'91001'},book={namespace:'academy_book',literalKey:'94001'},course={namespace:'academy_course',literalKey:'92001'};
  const actor={ownerId:owner,actorId:'fixture-teacher',role:'teacher' as const};
  await store.registerStudent({ownerId:owner,id:studentId,displayName:'Invented Context Learner',sourceKey:student,proofRefs:['fixture-binding']});
  const catalog:CatalogNode[]=[
    {id:'book',kind:'book_edition',sourceKey:book,label:'Invented source book',parent:unknown('root')},
    {id:'major',kind:'major_unit',sourceKey:{namespace:'academy_major_unit',literalKey:'96001'},label:'Invented major',parent:known('book',['fixture'])},
    {id:'middle',kind:'middle_unit',sourceKey:{namespace:'academy_middle_unit',literalKey:'96501'},label:'Invented middle',parent:known('major',['fixture'])},
    {id:'minor',kind:'minor_unit',sourceKey:{namespace:'academy_minor_unit',literalKey:'95001'},label:'Invented minor',parent:known('middle',['fixture'])},
    {id:'section',kind:'learning_section',sourceKey:{namespace:'fixture_section',literalKey:'97001'},label:'필수예제',parent:known('minor',['fixture'])},
    {id:'assessment',kind:'learning_section',sourceKey:{namespace:'fixture_section',literalKey:'97002'},label:'대단원 총괄평가',parent:known('major',['fixture'])},
  ];
  for(const node of catalog)await store.saveCatalog(owner,node);
  const append=async(entityId:string,payload:AcademyRecord)=>store.append({ownerId:owner,studentId,entityId,actorId:actor.actorId,idempotencyKey:entityId,expectedRevisionId:null,sourceObservedAt:'2025-01-02T00:00:00Z',payload},'2025-01-02T00:00:01Z');
  await append('registration',{kind:'source_book_registration',sourceStudent:student,sourceCourse:course,sourceUserCourse:{namespace:'academy_user_course',literalKey:'93001'},sourceBook:book,catalogNodeId:'book',sourceCourseLabel:'Invented 가우스 course',sourceBookLabel:'Invented source book',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:unknown('not_enrollment'),role:unknown('not_declared'),contractRef:'fixture',evidenceRefs:['fixture-binding']});
  return {db,store,owner,studentId,date,student,book,course,actor,catalog,append,app:new TeacherApplication(store,owner)};
}

describe.skipIf(!socket)('typed teacher work context in the existing PostgreSQL/application consumer',()=>{
  test('projects exact retained source grades for both UI and agent without a label-based section or completion join',async()=>{
    const f=await fixture();
    try{
      const record={studentKey:f.student.literalKey,studentName:'Invented Context Learner',courseKey:f.course.literalKey,bookNo:f.book.literalKey,paperKey:'51001',attemptKey:'41001',sourceTitle:'필수예제',score:100,items:[{originalOrdinal:'1',lectureKey:'31001',outerLectureKey:'21001',scoring:'O'}],sourceDate:{literal:'01-02',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}};
      const saved=await f.append('source-grade',{kind:'source_audit',contractRef:'fixture',acquisition:{schemaVersion:1,family:'textbook',status:'observed',records:[record],dailyResults:[],dayRecords:[],observedAt:'2025-01-02T00:00:00Z',coverage:'exact_selected_existing_records_not_whole_book',unknownStates:['teacher_acceptance_unknown'],nativePrintInvoked:false,automaticRetryAllowed:false}});
      const scene=await f.app.student(f.actor,f.studentId,f.date);
      expect(scene.workContext.data.sourceResults).toHaveLength(1);
      expect(scene.workContext.data.sourceResults[0]).toMatchObject({revisionRef:saved.revisionId,record,bookBinding:'current_registration',sectionBinding:'unknown',teacherCompletion:'not_inferred'});
      expect(scene.workContext.data.exactWork.assignments).toHaveLength(0);
      expect(scene.workContext.data.sectionAssignments.state).toBe('unknown');
      expect((await f.store.history(f.owner,f.studentId,'source-grade'))).toHaveLength(1);
    }finally{await f.db.close();}
  });
  test('retained minor-unit completion stays scoped and cannot certify section, paper or item completion',async()=>{
    const f=await fixture();
    try{
      await f.append('inventory',{kind:'source_course_inventory',sourceStudent:f.student,sourceCourse:f.course,sourceUserCourse:{namespace:'academy_user_course',literalKey:'93001'},sourceBook:f.book,bookLabelLiteral:'Invented source book',courseVersionLiteral:'fixture-version',coverage:'all_returned_course_units',evidenceRefs:['fixture-inventory'],units:[{sunitKey:'95001',bunitKey:'96001',sourceOrder:0,labelLiteral:'Invented minor',progressCells:[]}]});
      await f.append('scope',{kind:'teacher_preparation_assignment',sourceStudent:f.student,sourceCourse:f.course,sourceBook:f.book,start:'book_beginning',upperBound:known('95001',['fixture-assignment']),series:'gauss',teacherBookAliasLiteral:'Invented alias',directiveRef:'fixture-assignment',effectiveDate:f.date});
      const accepted=await f.append('clinic',{kind:'teacher_activity_revision',sourceStudent:f.student,sourceCourse:f.course,sourceBook:f.book,sourceMinorUnit:{namespace:'academy_minor_unit',literalKey:'95001'},activity:'wrong_clinic',scope:'minor_unit',decision:'accepted',effectiveDate:f.date,authority:'explicit_teacher_report',directiveRef:'fixture-teacher',evidenceRefs:['fixture-review']});
      const scene=await f.app.student(f.actor,f.studentId,f.date),work=scene.workContext;
      expect(work.data.unitWork[0]!.evidenceGrain).toBe('minor_unit_not_section_paper_or_item');
      expect(work.data.unitWork[0]!.teacherActivities.find(row=>row.activity==='wrong_clinic')!.currentRevisionRefs).toContain(accepted.revisionId);
      expect(work.data.sectionAssignments.state).toBe('unknown');expect(work.data.paperIssuance.state).toBe('unknown');
      expect(work.action.operations.find(row=>row.operation==='record_clinic_completion')!.availability).toBe('requires_exact_work_and_teacher_confirmation');
      expect(work.data.exactWork.assignments).toHaveLength(0);
      expect(work.action.operations.find(row=>row.operation==='refresh_academy')!.availability).toBe('source_not_qualified');
      expect((await f.store.current(f.owner,f.studentId)).filter(row=>row.payload.kind==='teacher_activity_revision')).toHaveLength(1);
    }finally{await f.db.close();}
  });
  test('shared query refuses foreign scope and renderer refuses another scene without treating source text as markup',async()=>{
    const f=await fixture(),dom=new JSDOM('<!doctype html><body></body>'),previous=globalThis.document;
    try{
      await f.store.saveCatalog(f.owner,{...f.catalog.find(row=>row.id==='section')!,label:'<img src=x onerror=alert(1)> Invented section'});
      const scene=await f.app.student(f.actor,f.studentId,f.date);globalThis.document=dom.window.document;
      const panel=learningWorkView(scene.workContext,scene.workContext.scene);
      expect(panel.querySelector('img')).toBeNull();expect(panel.textContent).toContain('<img src=x onerror=alert(1)>');
      for(const mismatch of [{studentId:'foreign'},{date:'2025-01-03'},{revision:'stale'}])expect(()=>learningWorkView(scene.workContext,{...scene.workContext.scene,...mismatch})).toThrow('work_context_scene_conflict');
      await expect(f.app.student({...f.actor,ownerId:'foreign'},f.studentId,f.date)).rejects.toThrow('owner_scope_conflict');
      await expect(f.app.student(f.actor,'foreign',f.date)).rejects.toThrow('student_scope_conflict');
      const origin='https://synthetic.example.invalid',handler=createTeacherServerHandler({app:f.app,origin,sessionKey:createAuthSecrets().sessionKey,identity:{actorId:f.actor.actorId,username:'fixture-only',passwordHash:'not-a-real-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('fixture_no_identity_write');}});
      expect((await handler(new Request(origin+'/api/student?id='+f.studentId+'&date='+f.date))).status).toBe(401);
    }finally{globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('actual client and semantic callback consume the same context through synthetic DOM registration, not native WebMCP',async()=>{
    const f=await fixture(),origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
    const dom=new JSDOM(teacherPage,{url:origin+'/?date='+f.date,runScripts:'outside-only'});
    let writes=0;
    const tools=new Map<string,{execute:(input:unknown)=>Promise<{content:{type:string;text:string}[]}>}>();
    const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:{actorId:f.actor.actorId,username:'fixture-only',passwordHash:'not-a-real-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('fixture_no_identity_write');}});
    const wait=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await Bun.sleep(10);}throw Error('synthetic_context_ui_timeout');};
    try{
      await f.store.saveCatalog(f.owner,{...f.catalog[0]!,bookIdentity:{series:'gauss',schoolStage:'elementary',grade:5,term:2,volume:2,evidenceRefs:['fixture-metadata']}});
      Object.defineProperty(dom.window.document,'modelContext',{value:{registerTool:(tool:{name:string;execute:(input:unknown)=>Promise<{content:{type:string;text:string}[]}>})=>{tools.set(tool.name,tool);}}});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{
        if(options.method==='POST')writes++;
        const headers=new Headers(options.headers);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId));headers.set('Origin',origin);
        return handler(new Request(new URL(path,origin),{...options,headers}));
      }});
      const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'../../src/academy/web/client.ts')],target:'browser',format:'iife'});expect(build.success).toBe(true);
      dom.window.eval(await build.outputs[0]!.text());
      await wait(()=>tools.has('query_student_learning'));
      dom.window.document.querySelector('#students button')!.dispatchEvent(new dom.window.Event('click',{bubbles:true}));
      await wait(()=>dom.window.document.getElementById('status')!.textContent!.includes('보존된 학생 전체 근거'));
      const tree=dom.window.document.getElementById('learning-workbench');
      const hierarchy=dom.window.document.querySelector<HTMLDetailsElement>('#scene > details.hierarchy-scope');
      expect(hierarchy).not.toBeNull();expect(hierarchy!.open).toBe(false);
      expect(hierarchy!.querySelector('summary')!.textContent).toContain('목차 연결 범위');
      expect(hierarchy!.textContent).toContain('대단원');expect(hierarchy!.textContent).not.toContain('major_unit');
      expect(tree).not.toBeNull();
      expect(tree!.textContent).toContain('가우스 5-2-2');
      const section=tree!.querySelector('[data-catalog-id="section"]')!;
      expect(section.parentElement!.closest('[data-catalog-id]')!.getAttribute('data-catalog-id')).toBe('minor');
      expect(tree!.querySelector('[data-catalog-id="assessment"]')!.parentElement!.closest('[data-catalog-id]')!.getAttribute('data-catalog-id')).toBe('major');
      expect(section.getAttribute('data-work-state')).toBe('source_unknown');
      const returned=await tools.get('query_student_learning')!.execute({studentId:f.studentId,date:f.date});
      const result=JSON.parse(returned.content[0]!.text);
      expect(result.workContext).toEqual((await f.app.student(f.actor,f.studentId,f.date)).workContext);
      expect(writes).toBe(0);
    }finally{dom.window.close();await f.db.close();}
  });
  test('the existing query consumes compact identity metadata and changes scene revision without rewriting source records',async()=>{
    const f=await fixture();
    try{
      const before=await f.app.student(f.actor,f.studentId,f.date);
      await f.store.saveCatalog(f.owner,{...f.catalog[0]!,bookIdentity:{series:'gauss',schoolStage:'elementary',grade:5,term:2,volume:2,evidenceRefs:['fixture-cover-binding']}});
      const after=await f.app.student(f.actor,f.studentId,f.date);
      expect(after.workContext.data.books[0]!.displayName).toBe('가우스 5-2-2');
      expect(after.books[0]).toMatchObject({displayName:'가우스 5-2-2'});
      expect(after.books[0]!.source).toEqual(before.books[0]!.source);
      expect(after.sceneRevision).not.toBe(before.sceneRevision);
    }finally{await f.db.close();}
  });
  test('returns scoped DATA/LOGIC/ACTION/GOVERNANCE without converting a section into assigned or completed work',async()=>{
    const f=await fixture();
    try{
      const before=await f.store.current(f.owner,f.studentId);
      const scene=await f.app.student(f.actor,f.studentId,f.date);
      expect(scene).toMatchObject({workContext:{
        schemaVersion:1,purpose:'teacher_student_learning_review',
        scene:{studentId:f.studentId,date:f.date,revision:scene.sceneRevision},
        logic:{sectionWork:{catalogEntryImpliesAssignment:false,expectedWork:'assigned_section_and_item_range'},clinicWorkflow:{automaticCompletion:false,completionTrigger:'explicit_teacher_record_after_correction_and_explanation'}},
        governance:{contextGrantsEffects:false,recordDestinations:{teacherClinic:'protected_product_history',officialDayRecord:'separately_approved_academy_projection',parentDelivery:'teacher_final_send'}},
      }});
      expect(await f.store.current(f.owner,f.studentId)).toEqual(before);
    }finally{await f.db.close();}
  });
});

test('context projection refuses mismatched dates and cannot mutate its shared policy owner',()=>{
  const studentKey={namespace:'academy_student',literalKey:'91001'},date='2025-01-02';
  const input={studentId:'fixture-pure',studentKey,date,revision:'fixture-revision',catalog:[],preparation:buildStudentPreparation(studentKey,[],date),versions:[]};
  expect(()=>buildTeacherWorkContext({...input,date:'2025-01-03'})).toThrow('work_context_scope_conflict');
  const first=buildTeacherWorkContext(input);
  expect(()=>{(first.logic.sectionWork as any).catalogEntryImpliesAssignment=true;}).toThrow();
  expect(buildTeacherWorkContext(input).logic.sectionWork.catalogEntryImpliesAssignment).toBe(false);
});
