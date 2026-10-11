import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {learningFixture,exactAttemptFixture} from './learningWorkFixtures';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {teacherPage} from '../../src/academy/web/page';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
const wait=async(check:()=>boolean)=>{for(let i=0;i<150;i++){if(check())return;await Bun.sleep(10);}throw Error('clinic_ui_timeout');};
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('UNRESOLVED final-review blockers — expected RED until repaired',()=>{
  test('R10: offered reconciliation must refresh the policy without manual student reselection',async()=>{
    const f=await learningFixture(),origin='https://synthetic.example.invalid',dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
    const policy=classroomCyclePolicy as unknown as {operationalContextRevision:string},old=policy.operationalContextRevision;
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const sessionKey=createAuthSecrets().sessionKey;let posts=0,lastResponse:any;
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:{actorId:f.actor.actorId,username:'fixture',passwordHash:'not-a-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId));const response=await handler(new Request(new URL(path,origin),{...options,headers}));if(options.method==='POST'){posts++;lastResponse=await response.clone().json();}return response;}});
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});dom.window.eval(await build.outputs[0]!.text());
      await wait(()=>!!dom.window.document.querySelector('#students button'));dom.window.document.querySelector('#students button')!.dispatchEvent(new dom.window.Event('click'));
      const el=(role:string)=>dom.window.document.querySelector<HTMLInputElement>('[data-clinic-item="assigned-1"] [data-role="'+role+'"]')!;
      await wait(()=>!!el('note'));el('note').value='Invented policy-drift original';el('note').dispatchEvent(new dom.window.Event('input'));el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));
      policy.operationalContextRevision='synthetic-policy-P2';el('save').dispatchEvent(new dom.window.Event('click'));
      await wait(()=>posts===1);expect(lastResponse).toMatchObject({error:'stale_clinic_policy',originalRetained:true});await wait(()=>el('status').textContent!.includes('stale_clinic_policy'));
      expect(el('note').readOnly).toBe(false);expect(el('note').value).toBe('Invented policy-drift original');expect(el('save').disabled).toBe(true);
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02');expect(scene.clinicRecovery[0]).toMatchObject({resolution:'rejected',refusal:'stale_clinic_policy',input:{note:'Invented policy-drift original',expectedPolicyRevision:old}});
      el('reconcile').dispatchEvent(new dom.window.Event('click'));expect(el('save').disabled).toBe(true);
      await wait(()=>el('status')?.textContent?.includes('현재 조회 근거를 선택했습니다')??false);
      expect(el('confirm').checked).toBe(false);expect(el('note').value).toBe('Invented policy-drift original');
      el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));el('save').dispatchEvent(new dom.window.Event('click'));
      await wait(()=>posts===2);console.log(JSON.stringify({finding:'R10',secondSubmissionError:lastResponse.error??null}));expect(lastResponse.record?.payload.policyRevision).toBe('synthetic-policy-P2');
    }finally{policy.operationalContextRevision=old;dom.window.close();await f.db.close();}
  });
  test('R12: valid refused observation originals must remain retrievable after a new scene query',async()=>{
    const f=await learningFixture();try{
      const occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
      const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{...occurrence,teacherKey:'11001',studentKey:f.assignment.sourceStudent.literalKey,studentName:'Invented Learner',fields:{attendance:'N'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:occurrence.date,groupIds:[occurrence.groupId],studentNames:['Invented Learner']},observedAt:'2025-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false};
      const basis=await f.store.append({ownerId:f.owner,studentId:f.studentId,entityId:'source-observation',actorId:f.actor.actorId,idempotencyKey:crypto.randomUUID(),expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'synthetic-source-contract'}});
      const input={studentId:f.studentId,occurrence,basisRevisionId:basis.revisionId,expectedRevisionId:null,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',text:'Invented accepted observation'};
      await f.app.saveObservation(f.actor,input);
      const refused={...input,idempotencyKey:crypto.randomUUID(),text:'Invented unique refused original R12'};
      const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:{actorId:f.actor.actorId,username:'fixture',passwordHash:'not-a-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      const response=await handler(new Request(origin+'/api/teacher-observation',{method:'POST',headers:{Origin:origin,Cookie:'dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId),'Content-Type':'application/json','X-Teacher-Owner':f.owner,'X-Teacher-Actor':f.actor.actorId},body:JSON.stringify(refused)}));
      const body=await response.json(),scene=await f.app.student(f.actor,f.studentId,'2025-01-02'),visible=JSON.stringify(scene).includes(refused.text);
      console.log(JSON.stringify({finding:'R12',http:response.status,originalRetainedClaim:body.originalRetained,originalVisible:visible}));expect(visible).toBe(true);
    }finally{await f.db.close();}
  });
  test('R13: a changed authenticated actor must not propose or commit the displayed actors draft',async()=>{
    const f=await learningFixture(),origin='https://synthetic.example.invalid',dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const sessionKey=createAuthSecrets().sessionKey,tools=new Map<string,any>();let actorId=f.actor.actorId,posts=0;
      const identity=()=>({actorId,username:'fixture',passwordHash:'not-a-credential'});
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:identity(),currentAuthentication:()=>({identity:identity(),sessionKey}),invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      Object.defineProperty(dom.window.HTMLElement.prototype,'focus',{value:()=>{}});
      Object.defineProperty(dom.window.document,'modelContext',{value:{registerTool:(t:any)=>tools.set(t.name,t)}});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,actorId));const response=await handler(new Request(new URL(path,origin),{...options,headers}));if(options.method==='POST')posts++;return response;}});
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});dom.window.eval(await build.outputs[0]!.text());await wait(()=>tools.has('propose_clinic_review'));
      dom.window.document.querySelector('#students button')!.dispatchEvent(new dom.window.Event('click'));const el=(r:string)=>dom.window.document.querySelector<HTMLInputElement>('[data-clinic-item="assigned-1"] [data-role="'+r+'"]')!;await wait(()=>!!el('note'));
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02'),attempt=scene.workContext.data.exactWork.assignments[0]!.attempts[0]!;actorId='fixture-teacher-B';
      let proposalRefused=false;try{await tools.get('propose_clinic_review').execute({studentId:f.studentId,date:'2025-01-02',sceneRevision:scene.sceneRevision,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.record.revisionId,assignedItemId:'assigned-1',expectedRevisionId:null,decision:'review_pending'});}catch{proposalRefused=true;}
      el('note').value='Invented actor A draft';el('note').dispatchEvent(new dom.window.Event('input'));el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));el('save').dispatchEvent(new dom.window.Event('click'));await wait(()=>posts===1);
      const records=(await f.store.current(f.owner,f.studentId)).filter(row=>row.payload.kind==='teacher_clinic_revision');console.log(JSON.stringify({finding:'R13',proposalRefused,committedActor:records[0]?.actorId??null,displayedActor:f.actor.actorId}));expect({proposalRefused,committed:records.length}).toEqual({proposalRefused:true,committed:0});
    }finally{dom.window.close();await f.db.close();}
  });
});
