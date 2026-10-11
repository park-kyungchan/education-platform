import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {learningFixture,exactAttemptFixture} from './learningWorkFixtures';
import {clinicWorkView} from '../../src/academy/web/clinicWorkView';
import type {ClinicDecisionInput,TeacherApplication} from '../../src/academy/application';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
type Scene=Awaited<ReturnType<TeacherApplication['student']>>;
const wait=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await Bun.sleep(10);}throw Error('clinic_editor_timeout');};
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('clinic editor asynchronous exact receipt adoption',()=>{
  for(const dirty of [false,true])test('new attempt evidence requires renewed inspection '+(dirty?'after reconciliation':'after clean advancement'),async()=>{
    const f=await learningFixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;let lifetime=new AbortController();
    try{
      const work=await f.append('work',f.assignment),attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const read=async()=>f.app.student(f.actor,f.studentId,'2025-01-02'),write=async(_path:string,input:unknown)=>f.app.saveClinicDecision(f.actor,input);
      const mount=(scene:Scene)=>{lifetime.abort();lifetime=new AbortController();document.body.replaceChildren(clinicWorkView(scene,read as never,write as never,lifetime.signal,fresh=>{if(fresh)mount(fresh);}));};
      const el=(role:string)=>document.querySelector<HTMLInputElement>('[data-clinic-item="assigned-1"] [data-role="'+role+'"]')!;
      const change=(role:string)=>el(role).dispatchEvent(new dom.window.Event('change'));
      mount(await read());el('note').value='Invented original inspection';el('note').dispatchEvent(new dom.window.Event('input'));el('decision').value='completed';change('decision');for(const role of ['written','explanation','confirm']){el(role).checked=true;change(role);}el('save').click();await wait(()=>el('status').textContent!.includes('저장 확인'));
      if(dirty){el('note').value='Invented preserved proposed revision';el('note').dispatchEvent(new dom.window.Event('input'));}
      const note=el('note').value;await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId,evidenceRefs:['fixture-revised-evidence']},attempt.revisionId);
      mount(await read());if(dirty){el('reconcile').click();await wait(()=>el('status').textContent!.includes('현재 조회 근거를 선택했습니다'));}
      expect(el('note').value).toBe(note);expect(el('decision').value).toBe('completed');expect(el('written').checked).toBe(false);expect(el('explanation').checked).toBe(false);expect(el('confirm').checked).toBe(false);
      expect(document.body.textContent).toContain('기존 근거 교사 완료');expect(document.body.textContent).toContain('Invented original inspection');
      el('confirm').checked=true;change('confirm');expect(el('save').disabled).toBe(true);
      for(const role of ['written','explanation','confirm']){el(role).checked=true;change(role);}expect(el('save').disabled).toBe(false);
    }finally{lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('R7: prior assignment histories remain readable in the shipped view without old-target write controls',async()=>{
    const f=await learningFixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document,lifetime=new AbortController();globalThis.document=dom.window.document;
    try{
      const work=await f.append('work',f.assignment),attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      await f.app.saveClinicDecision(f.actor,{studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-02',expectedRevisionId:null,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented original preserved with superseded target'});
      await f.append('work',{...f.assignment,status:'withdrawn'},work.revisionId);
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02');document.body.append(clinicWorkView(scene,(async()=>{}) as never,(async()=>{}) as never,lifetime.signal,()=>{}));
      const historical=document.querySelector('[data-archived-assignment]');expect(historical?.textContent).toContain('Invented original preserved with superseded target');expect(historical?.textContent).toContain('issuance-1');expect(historical!.querySelectorAll('button')).toHaveLength(0);
    }finally{lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('R3: an existing dirty draft adopts the cross-tab pending barrier without losing its own text and exposes the protected original',async()=>{
    const f=await learningFixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;let lifetime=new AbortController();
    try{
      const work=await f.append('work',f.assignment),attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const mount=(scene:Scene)=>{lifetime.abort();lifetime=new AbortController();document.body.replaceChildren(clinicWorkView(scene,(async()=>{throw Error('unused');}) as never,(async()=>{throw Error('unused');}) as never,lifetime.signal,()=>{}));};
      const field=(role:string)=>document.querySelector<HTMLInputElement>('[data-clinic-item="assigned-1"] [data-role="'+role+'"]')!;
      mount(await f.app.student(f.actor,f.studentId,'2025-01-02'));field('note').value='Invented unsaved tab B text';field('note').dispatchEvent(new dom.window.Event('input'));field('confirm').checked=true;field('confirm').dispatchEvent(new dom.window.Event('change'));expect(field('save').disabled).toBe(false);
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_clinic_revision')throw Error('fixture_held');return append(...args);};
      const input={studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-02',expectedRevisionId:null,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented original from tab A'};
      await expect(f.app.saveClinicDecision(f.actor,input)).rejects.toThrow('fixture_held');
      const pendingScene=await f.app.student(f.actor,f.studentId,'2025-01-02');mount(pendingScene);
      expect(field('note').value).toBe('Invented unsaved tab B text');expect(field('save').disabled).toBe(true);
      expect(document.querySelectorAll('[data-recovery-request]')).toHaveLength(1);expect(document.querySelector('[data-recovery-request]')!.textContent).toContain(input.note);
      f.store.append=append;const saved=await f.app.saveClinicDecision(f.actor,input);
      mount(await f.app.student(f.actor,f.studentId,'2025-01-02'));
      expect(field('note').readOnly).toBe(false);expect(field('note').value).toBe('Invented unsaved tab B text');expect(field('status').textContent).toContain(saved.revisionId);
      mount(pendingScene);expect(field('note').readOnly).toBe(false);expect(document.querySelectorAll('[data-recovery-request]')).toHaveLength(0);
    }finally{lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('a protected pending original remains recoverable even when its old assignment is no longer the selected revision',async()=>{
    const f=await learningFixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document,lifetime=new AbortController();globalThis.document=dom.window.document;
    try{
      const work=await f.append('work',f.assignment),attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const input:ClinicDecisionInput={studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-02',expectedRevisionId:null,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',decision:'completed',inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented orphaned pending original'};
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_clinic_revision')throw Error('fixture_interrupted');return append(...args);};
      await expect(f.app.saveClinicDecision(f.actor,input)).rejects.toThrow('fixture_interrupted');f.store.append=append;
      await f.append('work',{...f.assignment,status:'withdrawn'},work.revisionId);
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02');let reads=0,posts=0;
      const read=async()=>{reads++;throw Error('clinic_result_not_found');},write=async()=>{posts++;throw Error('not_admitted');};
      document.body.append(clinicWorkView(scene,read as never,write as never,lifetime.signal,()=>{}));
      expect(document.querySelector('[data-recovery-request]')?.textContent).toContain(input.note);
      document.querySelector('[data-recovery-request] [data-role="recover"]')!.dispatchEvent(new dom.window.Event('click'));
      await wait(()=>reads===1);expect(posts).toBe(0);
    }finally{lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  for(const lose of [false,true])test('pending remount and precommit snapshot retain original request '+(lose?'after lost acknowledgement':'after confirmation'),async()=>{
    const f=await learningFixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;
    let lifetime=new AbortController();
    try{
      const work=await f.append('work',f.assignment);await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      const initial=await f.app.student(f.actor,f.studentId,'2025-01-02'),held=deferred<any>();let input!:ClinicDecisionInput,posts=0;
      const read=async(path:string)=>{const url=new URL(path,'https://synthetic.invalid');return f.app.clinicResult(f.actor,url.searchParams.get('studentId')!,url.searchParams.get('requestId')!);};
      const write=async(_path:string,value:unknown)=>{posts++;input=value as ClinicDecisionInput;return held.promise;};
      const mount=(scene:Scene)=>{lifetime.abort();lifetime=new AbortController();document.body.replaceChildren(clinicWorkView(scene,read as never,write as never,lifetime.signal,()=>{}));};
      const el=<T extends HTMLElement>(role:string)=>document.querySelector<T>('[data-clinic-item="assigned-1"] [data-role="'+role+'"]')!;
      const click=(role:string)=>el(role).dispatchEvent(new dom.window.Event('click',{bubbles:true}));
      mount(initial);el<HTMLTextAreaElement>('note').value='Invented retained editor text';el('note').dispatchEvent(new dom.window.Event('input'));
      el<HTMLSelectElement>('decision').value='completed';el('decision').dispatchEvent(new dom.window.Event('change'));
      for(const role of ['written','explanation','confirm']){el<HTMLInputElement>(role).checked=true;el(role).dispatchEvent(new dom.window.Event('change'));}
      click('save');await wait(()=>posts===1);mount(initial);
      expect(el<HTMLButtonElement>('save').disabled).toBe(true);
      const saved=await f.app.saveClinicDecision(f.actor,input);
      if(lose)held.reject(Error('fixture_lost_ack'));else held.resolve(saved);
      await wait(()=>el('status').textContent!.includes(lose?'확인하지 못했습니다':'저장 확인'));
      if(lose){const changedPolicy=structuredClone(initial);Object.assign(changedPolicy.workContext.logic,{policyRevision:'synthetic-policy-next-revision'});mount(changedPolicy);click('recover');await wait(()=>el('status').textContent!.includes('저장 확인'));}
      mount(initial);expect(el('status').textContent).toContain(saved.revisionId);expect(posts).toBe(1);
      expect(el<HTMLTextAreaElement>('note').value).toBe(input.note);
      const current=await f.app.student(f.actor,f.studentId,'2025-01-02');mount(current);
      expect(el<HTMLTextAreaElement>('note').value).toBe(input.note);
    }finally{lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
});
