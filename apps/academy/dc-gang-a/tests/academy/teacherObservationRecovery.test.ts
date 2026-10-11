import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {learningFixture,exactAttemptFixture} from './learningWorkFixtures';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
import {TeacherApplication} from '../../src/academy/application';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {observationEditor} from '../../src/academy/web/teacherObservationEditor';

async function fixture(){
  const f=await learningFixture(),occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
  const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{...occurrence,teacherKey:'11001',studentKey:'91001',studentName:'Invented Exact Learner',fields:{attendance:'N'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:occurrence.date,groupIds:[occurrence.groupId],studentNames:['Invented Exact Learner']},observedAt:'2025-01-02T01:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic_not_source_qualification'],nativePrintInvoked:false,automaticRetryAllowed:false};
  const basis=await f.append('observation-source',{kind:'source_audit',acquisition,contractRef:'synthetic-source-contract'});
  const input={studentId:f.studentId,occurrence,basisRevisionId:basis.revisionId,expectedRevisionId:null as string|null,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',text:'Invented protected observation original'};
  return {...f,input,next:()=>new TeacherApplication(new PostgresAcademyStore(f.db),f.owner)};
}
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('protected observation original recovery',()=>{
  test('a late pending scene cannot resurrect recovery controls after exact acknowledgement',async()=>{
    const f=await fixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;let release=()=>{},lifetime=new AbortController();
    try{
      const append=f.store.append.bind(f.store);let held=false;
      f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_observation'){held=true;await new Promise<void>(resolve=>{release=resolve;});}return append(...args);};
      const row=(await f.app.classPreparation(f.actor,'2025-01-02')).rows[0]!,read=async()=>{throw Error('unused');},write=async(_path:string,input:unknown)=>f.app.saveObservation(f.actor,input);
      const mount=(scene:Awaited<ReturnType<TeacherApplication['student']>>)=>{lifetime.abort();lifetime=new AbortController();document.body.replaceChildren(observationEditor(scene,row,read as never,write as never,lifetime.signal));};
      mount(await f.app.student(f.actor,f.studentId,'2025-01-02'));
      const el=(name:string)=>document.getElementById('teacher-observation-'+name) as HTMLInputElement;
      el('text').value=f.input.text;el('text').dispatchEvent(new dom.window.Event('input'));el('save').click();for(let n=0;n<100&&!held;n++)await Bun.sleep(10);expect(held).toBe(true);
      const delayed=await f.app.student(f.actor,f.studentId,'2025-01-02');expect(delayed.observationRecovery).toHaveLength(1);
      release();for(let n=0;n<100&&!el('status').textContent!.includes('저장 확인');n++)await Bun.sleep(10);expect(el('status').textContent).toContain('저장 확인');
      mount(delayed);expect(el('text').readOnly).toBe(false);expect(document.querySelectorAll('[data-observation-request]')).toHaveLength(0);
    }finally{release();lifetime.abort();globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('a clock refusal cannot discard a previously protected pending observation',async()=>{
    const f=await fixture();try{
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_observation')throw Error('fixture_interrupted');return append(...args);};
      await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('fixture_interrupted');
      f.store.append=async()=>{throw Error('future_source_observation');};await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('future_source_observation');
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02');expect(scene.observationRecovery).toEqual([expect.objectContaining({input:f.input,resolution:'pending'})]);
    }finally{await f.db.close();}
  });
  test('cross-family command key collision rejects the staged original instead of stranding the occurrence',async()=>{
    const f=await fixture();try{
      const work=await f.append('work',f.assignment),attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId});
      await f.app.saveClinicDecision(f.actor,{studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-02',expectedRevisionId:null,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision,idempotencyKey:f.input.idempotencyKey,reportedAt:f.input.reportedAt,decision:'review_pending',inspection:{writtenSolution:false,correctionExplanation:false},note:'Invented unrelated clinic command'});
      await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('idempotency_reuse');
      const next=f.next(),scene=await next.student(f.actor,f.studentId,'2025-01-02');
      expect(scene.observationRecovery).toEqual([expect.objectContaining({input:f.input,resolution:'rejected',refusal:'idempotency_reuse'})]);
      await expect(next.saveObservation(f.actor,f.input)).rejects.toThrow('idempotency_reuse');
      const saved=await next.saveObservation(f.actor,{...f.input,idempotencyKey:crypto.randomUUID()});expect(saved.record.payload.kind).toBe('teacher_observation');
    }finally{await f.db.close();}
  });
  test('rejected originals survive application reconstruction without becoming accepted evidence or leaking to another actor',async()=>{
    const f=await fixture();try{
      const first=await f.app.saveObservation(f.actor,f.input),refused={...f.input,idempotencyKey:crypto.randomUUID(),text:'Invented unique rejected original'};
      await expect(f.app.saveObservation(f.actor,refused)).rejects.toThrow('stale_base');
      const next=f.next(),scene=await next.student(f.actor,f.studentId,'2025-01-02');
      expect(scene.observationRecovery).toEqual([{ownerId:f.owner,actorId:f.actor.actorId,input:refused,resolution:'rejected',refusal:'stale_base'}]);
      expect(JSON.stringify(scene.evidence)).not.toContain(refused.text);
      expect((await next.student({...f.actor,actorId:'fixture-other'},f.studentId,'2025-01-02')).observationRecovery).toEqual([]);
      await expect(next.saveObservation(f.actor,refused)).rejects.toThrow('stale_base');
      await expect(next.saveObservation(f.actor,{...refused,text:'Invented attempted replacement'})).rejects.toThrow('idempotency_reuse');
      expect(await f.store.history(f.owner,f.studentId,first.record.entityId)).toHaveLength(1);
      const dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;
      try{
        const panel=observationEditor(scene,null,(async()=>{throw Error('unused');}) as never,(async()=>{throw Error('unused');}) as never);
        expect(panel.textContent).toContain(refused.text);expect(panel.textContent).toContain('stale_base');
        expect(panel.querySelectorAll('[data-observation-request] button')).toHaveLength(0);
      }finally{globalThis.document=previous;dom.window.close();}
    }finally{await f.db.close();}
  });
  for(const drift of ['head','source'] as const)test('visible observation reconciliation fetches current '+drift+' without manual reselection',async()=>{
    const f=await fixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;
    try{
      const first=await f.app.saveObservation(f.actor,f.input),scene=await f.app.student(f.actor,f.studentId,'2025-01-02'),row=(await f.app.classPreparation(f.actor,'2025-01-02')).rows[0]!;
      let posts=0,reads=0,last:any;
      const read=async(path:string)=>{reads++;return path.startsWith('/api/class?')?f.app.classPreparation(f.actor,'2025-01-02'):f.app.student(f.actor,f.studentId,'2025-01-02');};
      const write=async(_path:string,input:unknown)=>{posts++;last=input;return f.app.saveObservation(f.actor,input);};
      document.body.append(observationEditor(scene,row,read as never,write as never));
      let currentHead=first.revisionId,currentBasis=f.input.basisRevisionId;
      if(drift==='head')currentHead=(await f.app.saveObservation({...f.actor,actorId:'fixture-other-teacher'},{...f.input,expectedRevisionId:first.revisionId,idempotencyKey:crypto.randomUUID(),text:'Invented intervening accepted observation'})).revisionId;
      else{
        const prior=(await f.store.current(f.owner,f.studentId)).find(value=>value.entityId==='observation-source')!;
        if(prior.payload.kind!=='source_audit')throw Error('fixture_source_required');
        const acquisition=structuredClone(prior.payload.acquisition) as any;acquisition.observedAt='2025-01-02T02:00:00Z';acquisition.dayRecords[0].fields.homework='Invented changed source range';
        currentBasis=(await f.store.append({ownerId:f.owner,studentId:f.studentId,actorId:f.actor.actorId,entityId:prior.entityId,expectedRevisionId:prior.revisionId,idempotencyKey:crypto.randomUUID(),sourceObservedAt:acquisition.observedAt,payload:{...prior.payload,acquisition}})).revisionId;
      }
      const el=(suffix:string)=>document.getElementById('teacher-observation-'+suffix) as HTMLInputElement;
      el('text').value='Invented preserved local correction';el('text').dispatchEvent(new dom.window.Event('input'));el('save').click();
      for(let n=0;n<100&&!el('status').textContent!.includes('저장 거부');n++)await Bun.sleep(10);
      expect(el('status').textContent).toContain(drift==='head'?'stale_base':'stale_evidence_basis');
      el('reconcile').click();expect(el('save').disabled).toBe(true);
      for(let n=0;n<100&&el('save').disabled;n++)await Bun.sleep(10);
      expect(reads).toBeGreaterThan(0);expect(el('text').value).toBe('Invented preserved local correction');expect(el('save').disabled).toBe(false);
      el('save').click();for(let n=0;n<100&&!el('status').textContent!.includes('저장 확인');n++)await Bun.sleep(10);
      expect(el('status').textContent).toContain('저장 확인');expect(posts).toBe(2);expect(last.expectedRevisionId).toBe(currentHead);expect(last.basisRevisionId).toBe(currentBasis);
    }finally{globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('interrupted intent is recoverable and excludes a new same-target request across application instances',async()=>{
    const f=await fixture();try{
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_observation')throw Error('fixture_precommit_interruption');return append(...args);};
      await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('fixture_precommit_interruption');
      const next=f.next(),scene=await next.student(f.actor,f.studentId,'2025-01-02');
      expect(scene.observationRecovery[0]).toMatchObject({input:f.input,resolution:'pending',refusal:null});
      const second={...f.input,idempotencyKey:crypto.randomUUID(),text:'Invented second-tab original'};
      await expect(next.saveObservation(f.actor,second)).rejects.toThrow('unresolved_observation_request');
      const blocked=await next.student(f.actor,f.studentId,'2025-01-02');expect(blocked.observationRecovery).toHaveLength(2);
      const saved=await next.saveObservation(f.actor,f.input);expect(saved.record.idempotencyKey).toBe(f.input.idempotencyKey);
      expect((await next.student(f.actor,f.studentId,'2025-01-02')).observationRecovery).toEqual([expect.objectContaining({input:second,resolution:'rejected'})]);
      expect((await next.saveObservation(f.actor,f.input)).record.revisionId).toBe(saved.revisionId);
    }finally{await f.db.close();}
  });
  test('a reloaded pending original can query then retry its exact request from the visible recovery control',async()=>{
    const f=await fixture(),dom=new JSDOM('<body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;
    try{
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_observation')throw Error('fixture_precommit_interruption');return append(...args);};
      await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('fixture_precommit_interruption');
      const next=f.next(),scene=await next.student(f.actor,f.studentId,'2025-01-02');let posts=0;
      const read=async()=>next.observationResult(f.actor,f.studentId,f.input.idempotencyKey);
      const write=async(_path:string,input:unknown)=>{expect(input).toEqual(f.input);posts++;return next.saveObservation(f.actor,input);};
      const panel=observationEditor(scene,null,read as never,write as never);document.body.append(panel);
      const recover=panel.querySelector<HTMLButtonElement>('[data-observation-request] [data-role="recover"]');
      const retry=panel.querySelector<HTMLButtonElement>('[data-observation-request] [data-role="retry"]');
      expect(recover).not.toBeNull();expect(retry?.hidden).toBe(true);
      recover!.click();for(let n=0;n<100&&retry!.hidden;n++)await Bun.sleep(10);
      expect(retry!.hidden).toBe(false);expect(posts).toBe(0);retry!.click();
      for(let n=0;n<100&&!panel.textContent!.includes('원본 요청 저장 확인');n++)await Bun.sleep(10);
      expect(panel.textContent).toContain('원본 요청 저장 확인');expect(posts).toBe(1);
      const saved=await next.observationResult(f.actor,f.studentId,f.input.idempotencyKey);expect(saved.record.idempotencyKey).toBe(f.input.idempotencyKey);
    }finally{globalThis.document=previous;dom.window.close();await f.db.close();}
  });
  test('a lost committed acknowledgement resolves the original request without another observation revision',async()=>{
    const f=await fixture();try{
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{const result=await append(...args);if(args[0].payload.kind==='teacher_observation')throw Error('fixture_after_commit_interruption');return result;};
      await expect(f.app.saveObservation(f.actor,f.input)).rejects.toThrow('fixture_after_commit_interruption');
      const next=f.next(),receipt=await next.observationResult(f.actor,f.studentId,f.input.idempotencyKey);
      expect(receipt.record.payload).toMatchObject({kind:'teacher_observation',text:f.input.text});
      expect((await next.student(f.actor,f.studentId,'2025-01-02')).observationRecovery).toEqual([]);
      expect((await next.saveObservation(f.actor,f.input)).record.revisionId).toBe(receipt.revisionId);
      expect(await f.store.history(f.owner,f.studentId,receipt.record.entityId)).toHaveLength(1);
    }finally{await f.db.close();}
  });
});
