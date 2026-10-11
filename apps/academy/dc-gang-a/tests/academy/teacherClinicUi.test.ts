import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {learningFixture,exactAttemptFixture} from './learningWorkFixtures';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {teacherPage} from '../../src/academy/web/page';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
const wait=async(check:()=>boolean)=>{for(let i=0;i<150;i++){if(check())return;await Bun.sleep(10);}throw Error('clinic_ui_timeout');};
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('actual teacher clinic UI and shared semantic proposal',()=>{
  for(const family of ['observation','clinic'] as const)test('forward device clock retains editable '+family+' draft and permits a newly confirmed corrected request',async()=>{
    const f=await learningFixture(),origin='https://synthetic.example.invalid',dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const row={date:'2025-01-02',groupId:'21001',courseKey:'92001',recordKey:'41001',membershipKey:'81001',teacherKey:'11001',studentKey:'91001',studentName:'Invented Exact Learner',fields:{attendance:'N'}};
      await f.append('clock-source',{kind:'source_audit',acquisition:{schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[row],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:row.date,groupIds:[row.groupId],studentNames:[row.studentName]},observedAt:'2025-01-02T01:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false},contractRef:'synthetic-clock-contract'});
      const sessionKey=createAuthSecrets().sessionKey,identity={actorId:f.actor.actorId,username:'fixture',passwordHash:'not-a-real-credential'};
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity,invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}}),posts:{input:any;status:number;body:any}[]=[];
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{
        const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId));
        const response=await handler(new Request(new URL(path,origin),{...options,headers}));if(options.method==='POST')posts.push({input:JSON.parse(options.body as string),status:response.status,body:await response.clone().json()});return response;
      }});
      dom.window.eval("window.__realDate=Date;window.__deviceDate=class extends Date{constructor(...args){super(...(args.length?args:['2099-01-01T00:00:00.000Z']));}};");
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});dom.window.eval('{let Date=window.__deviceDate;window.__restoreDeviceClock=()=>{Date=window.__realDate;};'+await build.outputs[0]!.text()+'}');
      const el=(role:string)=>dom.window.document.querySelector<HTMLInputElement>(family==='clinic'?'[data-clinic-item="assigned-1"] [data-role="'+role+'"]':'#teacher-observation-'+(role==='note'?'text':role))!;
      await wait(()=>!!el('note'));el('note').value='Invented clock-skew draft';el('note').dispatchEvent(new dom.window.Event('input'));
      if(family==='clinic'){el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));}
      el('save').dispatchEvent(new dom.window.Event('click'));await wait(()=>posts.length===1);await Bun.sleep(0);
      expect(posts[0]!.input.reportedAt).toBe('2099-01-01T00:00:00.000Z');expect(posts[0]!.body).toMatchObject({error:'future_reported_at',originalRetained:false,automaticRetry:false});
      expect(el('note').readOnly).toBe(false);expect(el('note').value).toBe('Invented clock-skew draft');expect(el('recover').hidden).toBe(true);expect(el('status').textContent).toContain('기기 시각');
      const before=await f.app.student(f.actor,f.studentId,'2025-01-02');expect(before.observationRecovery).toHaveLength(0);expect(before.clinicRecovery).toHaveLength(0);
      const query=family==='clinic'?f.app.clinicResult.bind(f.app):f.app.observationResult.bind(f.app);await expect(query(f.actor,f.studentId,posts[0]!.input.idempotencyKey)).rejects.toThrow(family+'_result_not_found');
      dom.window.__restoreDeviceClock();
      if(family==='clinic'){expect(el('confirm').checked).toBe(false);expect(el('save').disabled).toBe(true);el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));}
      el('save').dispatchEvent(new dom.window.Event('click'));await wait(()=>!!el('status')?.textContent?.includes('저장 확인'));
      expect(posts).toHaveLength(2);expect(posts[1]!.status).toBe(200);expect(posts[1]!.input.idempotencyKey).not.toBe(posts[0]!.input.idempotencyKey);expect(posts[1]!.input.reportedAt).not.toBe(posts[0]!.input.reportedAt);
      const saved=await query(f.actor,f.studentId,posts[1]!.input.idempotencyKey);expect(saved.record.payload.kind).toBe(family==='clinic'?'teacher_clinic_revision':'teacher_observation');
    }finally{dom.window.close();await f.db.close();}
  });
  for(const selection of ['actor','occurrence'] as const)test('held reconciliation cannot overtake newer '+selection+' selection',async()=>{
    const f=await learningFixture(),origin='https://synthetic.example.invalid',dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
    const policy=classroomCyclePolicy as unknown as {operationalContextRevision:string},old=policy.operationalContextRevision;
    let releaseOld=()=>{},releaseNew=()=>{};
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      for(const recordKey of ['41001','41002']){
        const row={date:'2025-01-02',groupId:'21001',courseKey:'92001',recordKey,membershipKey:'81001',teacherKey:'11001',studentKey:'91001',studentName:'Invented Exact Learner',fields:{attendance:'N'}};
        const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[row],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:row.date,groupIds:[row.groupId],studentNames:[row.studentName]},observedAt:'2025-01-02T01:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false};
        await f.append('source-'+recordKey,{kind:'source_audit',acquisition,contractRef:'synthetic-source-contract'});
      }
      const sessionKey=createAuthSecrets().sessionKey;let actorId=f.actor.actorId,hold:'none'|'old'|'new'='none',oldHeld=false,newHeld=false,posts=0;
      const identity=()=>({actorId,username:'fixture',passwordHash:'not-a-real-credential'});
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:identity(),currentAuthentication:()=>({identity:identity(),sessionKey}),invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{
        const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,actorId));
        const response=await handler(new Request(new URL(path,origin),{...options,headers}));
        if(options.method==='POST')posts++;
        if(path.startsWith('/api/student?')&&hold!=='none'){
          const selected=hold;hold='none';
          if(selected==='old'){oldHeld=true;await new Promise<void>(resolve=>{releaseOld=resolve;});}else{newHeld=true;await new Promise<void>(resolve=>{releaseNew=resolve;});}
        }
        return response;
      }});
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});dom.window.eval(await build.outputs[0]!.text());
      const el=(role:string)=>dom.window.document.querySelector<HTMLInputElement>('[data-clinic-item="assigned-1"] [data-role="'+role+'"]')!;
      await wait(()=>!!el('note'));el('note').value='Invented actor A reconciliation draft';el('note').dispatchEvent(new dom.window.Event('input'));el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));
      policy.operationalContextRevision='synthetic-policy-next';el('save').dispatchEvent(new dom.window.Event('click'));await wait(()=>posts===1&&el('status').textContent!.includes('stale_clinic_policy'));
      hold='old';el('reconcile').dispatchEvent(new dom.window.Event('click'));await wait(()=>oldHeld);
      if(selection==='actor')actorId='fixture-teacher-B';hold='new';
      dom.window.document.querySelector(selection==='actor'?'#students button':'#class-list [data-record-key="41002"]')!.dispatchEvent(new dom.window.Event('click'));await wait(()=>newHeld);
      releaseOld();await Bun.sleep(30);
      expect(dom.window.document.getElementById('clinic-work')).toBeNull();
      releaseNew();await wait(()=>!!el('note'));
      if(selection==='actor')expect(el('note').value).toBe('');else expect(dom.window.document.getElementById('occurrence-context')!.textContent).toContain('record 41002');
      expect(posts).toBe(1);
    }finally{releaseOld();releaseNew();policy.operationalContextRevision=old;dom.window.close();await f.db.close();}
  });
  test('R10: policy drift before first submission retains the refused original and requires fresh visible reconciliation',async()=>{
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
      dom.window.document.querySelector('#students button')!.dispatchEvent(new dom.window.Event('click'));await wait(()=>!!dom.window.document.querySelector('[data-recovery-request]'));
      el('reconcile').dispatchEvent(new dom.window.Event('click'));expect(el('save').disabled).toBe(true);
      await wait(()=>el('status')?.textContent?.includes('현재 조회 근거를 선택했습니다')??false);
      el('confirm').checked=true;el('confirm').dispatchEvent(new dom.window.Event('change'));el('save').dispatchEvent(new dom.window.Event('click'));
      await wait(()=>posts===2&&el('status')?.textContent?.includes('저장 확인')===true);expect(lastResponse.record.payload.policyRevision).toBe('synthetic-policy-P2');
    }finally{policy.operationalContextRevision=old;dom.window.close();await f.db.close();}
  });
  test('proposal opens exact item without a write; explicit teacher controls save and reopen the same target',async()=>{
    const f=await learningFixture();const origin='https://synthetic.example.invalid',dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const sessionKey=createAuthSecrets().sessionKey,tools=new Map<string,any>();let posts=0,focused:HTMLElement|null=null;
      let queryGate:Promise<void>|null=null,queryHeld=false;
      // JSDOM 30/Bun rejects its own FocusEvent Window. Observe the requested focus target here; native focus is a separate gate.
      Object.defineProperty(dom.window.HTMLElement.prototype,'focus',{value:function(this:HTMLElement){focused=this;}});
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:{actorId:f.actor.actorId,username:'fixture',passwordHash:'not-a-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      Object.defineProperty(dom.window.document,'modelContext',{value:{registerTool:(tool:any)=>tools.set(tool.name,tool)}});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{if(queryGate&&path.startsWith('/api/student?')){queryHeld=true;await queryGate;}if(options.method==='POST')posts++;const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId));return handler(new Request(new URL(path,origin),{...options,headers}));}});
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});expect(build.success).toBe(true);dom.window.eval(await build.outputs[0]!.text());
      await wait(()=>tools.has('query_student_learning'));
      dom.window.document.querySelector<HTMLButtonElement>('#students button')!.dispatchEvent(new dom.window.Event('click',{bubbles:true}));
      await wait(()=>!!dom.window.document.getElementById('learning-workbench'));
      expect(dom.window.document.querySelector<HTMLElement>('[data-catalog-id="section"]')!.dataset.workState).toBe('assigned_exact');
      expect(tools.has('propose_clinic_review')).toBe(true);
      expect(tools.get('propose_clinic_review').annotations.readOnlyHint).toBe(false);
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02'),attempt=scene.workContext.data.exactWork.assignments[0]!.attempts[0]!;
      const proposal={studentId:f.studentId,date:'2025-01-02',sceneRevision:scene.sceneRevision,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.record.revisionId,assignedItemId:'assigned-1',expectedRevisionId:null,decision:'completed'};
      let release!:()=>void;queryGate=new Promise<void>(resolve=>{release=resolve;});
      const inFlight=tools.get('propose_clinic_review').execute({...proposal,assignedItemId:'assigned-2'});await wait(()=>queryHeld);
      const edited=dom.window.document.querySelector('[data-clinic-item="assigned-2"]')!,humanDecision=edited.querySelector<HTMLSelectElement>('[data-role="decision"]')!,humanNote=edited.querySelector<HTMLTextAreaElement>('[data-role="note"]')!;
      humanDecision.value='reopened';humanDecision.dispatchEvent(new dom.window.Event('change'));humanNote.value='Invented edit during proposal lookup';humanNote.dispatchEvent(new dom.window.Event('input'));
      queryGate=null;release();await expect(inFlight).rejects.toThrow('clinic_proposal_dirty_draft');expect(humanDecision.value).toBe('reopened');expect(humanNote.value).toBe('Invented edit during proposal lookup');expect(posts).toBe(0);
      const response=await tools.get('propose_clinic_review').execute(proposal);expect(JSON.parse(response.content[0].text).status).toBe('awaiting_teacher_confirmation');expect(posts).toBe(0);
      const item=dom.window.document.querySelector<HTMLElement>('[data-clinic-item="assigned-1"]')!;
      expect(focused as HTMLElement|null).toBe(item.querySelector<HTMLElement>('[data-role="note"]'));
      const input=(role:string)=>item.querySelector<HTMLInputElement>('[data-role="'+role+'"]')!;
      input('note').value='Invented teacher verified correction';input('note').dispatchEvent(new dom.window.Event('input'));
      await expect(tools.get('propose_clinic_review').execute({...proposal,decision:'reopened'})).rejects.toThrow('clinic_proposal_dirty_draft');
      expect(input('decision').value).toBe('completed');expect(input('note').value).toBe('Invented teacher verified correction');
      expect(input('save').disabled).toBe(true);
      for(const role of ['written','explanation','confirm']){input(role).checked=true;input(role).dispatchEvent(new dom.window.Event('change'));}
      input('save').dispatchEvent(new dom.window.Event('click',{bubbles:true}));await wait(()=>posts===1&&item.textContent!.includes('저장 확인'));
      const records=(await f.store.current(f.owner,f.studentId)).filter(v=>v.payload.kind==='teacher_clinic_revision');expect(records).toHaveLength(1);expect(records[0]!.payload).toMatchObject({assignedItemId:'assigned-1',decision:'completed'});
      await expect(tools.get('propose_clinic_review').execute({...proposal,studentId:'foreign'})).rejects.toThrow('clinic_proposal_scene_conflict');
      await expect(tools.get('propose_clinic_review').execute(proposal)).rejects.toThrow('clinic_proposal_scene_conflict');
      expect(posts).toBe(1);
      await wait(()=>dom.window.document.querySelector('[data-clinic-item="assigned-1"] summary')?.textContent?.includes('교사 완료')??false);
      const reopened=dom.window.document.querySelector<HTMLElement>('[data-clinic-item="assigned-1"]')!;
      const select=reopened.querySelector<HTMLSelectElement>('[data-role="decision"]')!;select.value='reopened';select.dispatchEvent(new dom.window.Event('change'));
      const note=reopened.querySelector<HTMLTextAreaElement>('[data-role="note"]')!;note.value='Invented explicit new correction request';note.dispatchEvent(new dom.window.Event('input'));
      const confirm=reopened.querySelector<HTMLInputElement>('[data-role="confirm"]')!;confirm.checked=true;confirm.dispatchEvent(new dom.window.Event('change'));
      reopened.querySelector('[data-role="save"]')!.dispatchEvent(new dom.window.Event('click',{bubbles:true}));
      await wait(()=>posts===2&&reopened.textContent!.includes('저장 확인'));
      const history=await f.store.history(f.owner,f.studentId,records[0]!.entityId);expect(history).toHaveLength(2);expect(history[1]!.payload).toMatchObject({decision:'reopened',note:note.value});expect(history[1]!.previousRevisionId).toBe(history[0]!.revisionId);
      await wait(()=>dom.window.document.querySelector('[data-clinic-item="assigned-1"] summary')?.textContent?.includes('다시 점검')??false);
      const current=await f.app.student(f.actor,f.studentId,'2025-01-02'),append=f.store.append.bind(f.store);
      f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_clinic_revision')throw Error('fixture_pending_proposal');return append(...args);};
      await expect(f.app.saveClinicDecision(f.actor,{studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.record.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-03',expectedRevisionId:history[1]!.revisionId,expectedPolicyRevision:current.workContext.logic.policyRevision,idempotencyKey:crypto.randomUUID(),reportedAt:new Date().toISOString(),decision:'review_pending',inspection:{writtenSolution:false,correctionExplanation:false},note:'Invented other-tab original on another lesson date'})).rejects.toThrow('fixture_pending_proposal');
      expect((await f.app.student(f.actor,f.studentId,'2025-01-02')).sceneRevision).toBe(current.sceneRevision);
      await expect(tools.get('propose_clinic_review').execute({...proposal,sceneRevision:current.sceneRevision,expectedRevisionId:history[1]!.revisionId})).rejects.toThrow('clinic_proposal_pending_request');
      expect(dom.window.document.querySelector<HTMLSelectElement>('[data-clinic-item="assigned-1"] [data-role="decision"]')!.value).toBe('reopened');expect(posts).toBe(2);f.store.append=append;
    }finally{dom.window.close();await f.db.close();}
  });
});
