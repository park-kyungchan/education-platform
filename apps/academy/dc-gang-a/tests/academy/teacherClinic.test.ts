import {describe,expect,test} from 'bun:test';
import {exactAttemptFixture,learningFixture} from './learningWorkFixtures';
import type {AcademyRecord} from '../../src/academy/records';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication} from '../../src/academy/application';
import {SQL} from 'bun';
import {classroomCyclePolicy} from '../../src/academy/classroomCyclePolicy';
export async function clinicFixture(){
  const f=await learningFixture(),work=await f.append('work',f.assignment);
  const attempt=await f.append('attempt',{...exactAttemptFixture(),assignmentRevisionId:work.revisionId} as unknown as AcademyRecord);
  const input={studentId:f.studentId,assignmentRevisionId:work.revisionId,attemptEntityId:'attempt',attemptRevisionId:attempt.revisionId,assignedItemId:'assigned-1',effectiveDate:'2025-01-02',expectedRevisionId:null as string|null,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:00:00Z',decision:'completed' as const,inspection:{writtenSolution:true,correctionExplanation:true},note:'Invented explicit teacher inspection, not official finalization.'};
  return {...f,work,attempt,input:{...input,expectedPolicyRevision:classroomCyclePolicy.operationalContextRevision}};
}
describe.skipIf(!process.env.DC_ACADEMY_TEST_SOCKET)('exact teacher clinic decisions',()=>{
  test('a clock refusal cannot discard a previously protected pending clinic command',async()=>{
    const f=await clinicFixture();try{
      const append=f.store.append.bind(f.store);f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_clinic_revision')throw Error('fixture_interrupted');return append(...args);};
      await expect(f.app.saveClinicDecision(f.actor,f.input)).rejects.toThrow('fixture_interrupted');
      f.store.append=async()=>{throw Error('future_source_observation');};await expect(f.app.saveClinicDecision(f.actor,f.input)).rejects.toThrow('future_source_observation');
      const scene=await f.app.student(f.actor,f.studentId,'2025-01-02');expect(scene.clinicRecovery).toEqual([expect.objectContaining({input:f.input,resolution:'pending'})]);
    }finally{await f.db.close();}
  });
  test('attempt revision drift preserves prior completion without asserting inspection of the new evidence',async()=>{
    const f=await clinicFixture();try{
      const first=await f.app.saveClinicDecision(f.actor,f.input);
      await f.app.saveClinicDecision(f.actor,{...f.input,assignedItemId:'assigned-2',idempotencyKey:crypto.randomUUID()});
      const attempt=exactAttemptFixture();attempt.assignmentRevisionId=f.work.revisionId;attempt.evidenceRefs=['fixture-changed-attempt-evidence'];
      const changed={...attempt,itemResults:attempt.itemResults.map((value,index)=>index?value:{...value,grade:{state:'known',value:'incorrect',evidenceRefs:['fixture-corrected-grade']}})} as unknown as AcademyRecord;
      const revised=await f.append('attempt',changed,f.attempt.revisionId);
      const current=async()=>(await f.app.student(f.actor,f.studentId,'2025-01-02')).workContext.data.exactWork.assignments[0]!.attempts[0]!;
      const view=await current();expect(view.record.revisionId).toBe(revised.revisionId);expect(view.completed).toBe(false);
      const item=view.items[0] as any;expect(item.state).toBe('prior_revision_completed');expect(item.completion).toBeNull();expect(item.retainedCompletion.revisionId).toBe(first.revisionId);expect(item.inspectionBasis).toBe('prior_attempt_revision');expect(item.history.map((row:any)=>row.revisionId)).toContain(first.revisionId);
      const renewed=await f.app.saveClinicDecision(f.actor,{...f.input,attemptRevisionId:revised.revisionId,expectedRevisionId:first.revisionId,idempotencyKey:crypto.randomUUID(),note:'Invented explicit inspection of revised evidence'});
      const accepted=(await current()).items[0] as any;expect(accepted.state).toBe('completed');expect(accepted.inspectionBasis).toBe('current_attempt_revision');expect(accepted.completion.revisionId).toBe(renewed.revisionId);expect(accepted.history.map((row:any)=>row.revisionId)).toContain(first.revisionId);
    }finally{await f.db.close();}
  });
  test('R8: a regressing report clock retains a terminal refusal instead of stranding the target pending',async()=>{
    const f=await clinicFixture();try{
      const saved=await f.app.saveClinicDecision(f.actor,f.input),older={...f.input,expectedRevisionId:saved.revisionId,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T02:59:00Z'};
      await expect(f.app.saveClinicDecision(f.actor,older)).rejects.toThrow('invalid_revision_transition');
      const next=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner);
      expect((await next.student(f.actor,f.studentId,'2025-01-02')).clinicRecovery).toContainEqual(expect.objectContaining({input:older,resolution:'rejected',refusal:'invalid_revision_transition'}));
      const fixed=await next.saveClinicDecision(f.actor,{...older,idempotencyKey:crypto.randomUUID(),reportedAt:'2025-01-02T03:01:00Z'});expect(fixed.record.previousRevisionId).toBe(saved.revisionId);
    }finally{await f.db.close();}
  });
  test('R7: same-effective-date replacement retains prior exact assignment attempts and teacher histories read-only',async()=>{
    const f=await clinicFixture();try{
      const completed=await f.app.saveClinicDecision(f.actor,f.input);
      await f.app.saveClinicDecision(f.actor,{...f.input,expectedRevisionId:completed.revisionId,idempotencyKey:crypto.randomUUID(),decision:'reopened',note:'Invented earlier target reopen'});
      const replacement=await f.append('work',{...f.assignment,status:'withdrawn'},f.work.revisionId);
      const work=(await f.app.student(f.actor,f.studentId,'2025-01-02')).workContext.data.exactWork.assignments[0] as any;
      expect(work.record.revisionId).toBe(replacement.revisionId);expect(work.attempts).toHaveLength(0);
      expect(work.archived).toHaveLength(1);const prior=work.archived[0];expect(prior.record.revisionId).toBe(f.work.revisionId);expect(prior.writable).toBe(false);
      expect(prior.attempts[0].record.revisionId).toBe(f.attempt.revisionId);expect(prior.attempts[0].items[0].history.map((v:any)=>v.payload.decision)).toEqual(['completed','reopened']);expect(prior.attempts[0].items[0].writable).toBe(false);
    }finally{await f.db.close();}
  });
  test('R6: rejected originals and exact refusals remain actor-scoped and visible after reconnection',async()=>{
    const f=await clinicFixture();try{
      await f.app.saveClinicDecision(f.actor,f.input);
      const stale={...f.input,idempotencyKey:crypto.randomUUID(),note:'Invented rejected original retained across reload'};
      await expect(f.app.saveClinicDecision(f.actor,stale)).rejects.toThrow('stale_base');
      const next=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner),scene=await next.student(f.actor,f.studentId,'2025-01-02');
      expect(scene.clinicRecovery).toHaveLength(1);expect(scene.clinicRecovery[0]).toMatchObject({resolution:'rejected',refusal:'stale_base',input:stale});
      expect((await next.student({...f.actor,actorId:'other'},f.studentId,'2025-01-02')).clinicRecovery).toEqual([]);
    }finally{await f.db.close();}
  });
  test('R4: policy drift rejects an unresolved original without rewriting its policy or teacher text',async()=>{
    const f=await clinicFixture(),policy=classroomCyclePolicy as unknown as {operationalContextRevision:string},prior=policy.operationalContextRevision;
    try{
      const append=f.store.append.bind(f.store);let held=true;f.store.append=async(...args)=>{if(held&&args[0].payload.kind==='teacher_clinic_revision'){held=false;throw Error('fixture_interrupted');}return append(...args);};
      await expect(f.app.saveClinicDecision(f.actor,f.input)).rejects.toThrow('fixture_interrupted');
      policy.operationalContextRevision='synthetic-policy-next-revision';
      const next=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner),scene=await next.student(f.actor,f.studentId,'2025-01-02');
      await expect(next.saveClinicDecision(f.actor,scene.clinicRecovery[0]!.input)).rejects.toThrow('stale_clinic_policy');
      const after=await next.student(f.actor,f.studentId,'2025-01-02');
      expect(after.clinicRecovery).toContainEqual(expect.objectContaining({input:f.input,resolution:'rejected',refusal:'stale_clinic_policy'}));
      expect(await f.store.clinicResult(f.owner,f.studentId,f.actor.actorId,f.input.idempotencyKey)).toBeNull();
      const original=await f.store.clinicRequest(f.owner,f.studentId,f.actor.actorId,f.input.idempotencyKey);
      expect(original!.payload).toMatchObject({decision:{policyRevision:prior,note:f.input.note},resolution:'rejected',refusal:'stale_clinic_policy'});
    }finally{policy.operationalContextRevision=prior;await f.db.close();}
  });
  test('R4: policy drift still permits exact readback and replay of an already committed outcome',async()=>{
    const f=await clinicFixture(),policy=classroomCyclePolicy as unknown as {operationalContextRevision:string},prior=policy.operationalContextRevision;
    try{
      const saved=await f.app.saveClinicDecision(f.actor,f.input);policy.operationalContextRevision='synthetic-policy-next-revision';
      const next=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner);
      expect((await next.saveClinicDecision(f.actor,f.input)).revisionId).toBe(saved.revisionId);
      expect((await next.clinicResult(f.actor,f.studentId,f.input.idempotencyKey)).record.payload).toMatchObject({policyRevision:prior,note:f.input.note});
      await expect(next.saveClinicDecision(f.actor,{...f.input,idempotencyKey:crypto.randomUUID(),expectedRevisionId:saved.revisionId})).rejects.toThrow('stale_clinic_policy');
      expect(await f.store.history(f.owner,f.studentId,saved.record.entityId)).toHaveLength(1);
    }finally{policy.operationalContextRevision=prior;await f.db.close();}
  });
  test('R3: an unresolved protected original blocks a fresh same-actor target across connections but permits exact retry',async()=>{
    const f=await clinicFixture();try{
      const append=f.store.append.bind(f.store);let hold=true;
      f.store.append=async(...args)=>{if(hold&&args[0].payload.kind==='teacher_clinic_revision'){hold=false;throw Error('fixture_interrupted');}return append(...args);};
      await expect(f.app.saveClinicDecision(f.actor,f.input)).rejects.toThrow('fixture_interrupted');
      const other=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner);
      const secondTab={...f.input,idempotencyKey:crypto.randomUUID(),note:'Invented second tab'};
      await expect(other.saveClinicDecision(f.actor,secondTab)).rejects.toThrow('unresolved_clinic_request');
      expect((await other.student(f.actor,f.studentId,'2025-01-02')).clinicRecovery).toContainEqual(expect.objectContaining({input:secondTab,resolution:'rejected',refusal:'unresolved_clinic_request'}));
      const saved=await other.saveClinicDecision(f.actor,f.input);expect(saved.record.idempotencyKey).toBe(f.input.idempotencyKey);
      const next=await other.saveClinicDecision(f.actor,{...f.input,idempotencyKey:crypto.randomUUID(),expectedRevisionId:saved.revisionId,note:'Invented reconciled new intent'});expect(next.record.previousRevisionId).toBe(saved.revisionId);
    }finally{await f.db.close();}
  });
  test('R2: informational teacher grading retains completion until an explicit correction, explanation or reopen instruction',async()=>{
    const f=await clinicFixture();try{
      let last=await f.app.saveClinicDecision(f.actor,f.input);
      const state=async()=>(await f.app.student(f.actor,f.studentId,'2025-01-02')).workContext.data.exactWork.assignments[0]!.attempts[0]!.items[0]!.state;
      for(const decision of ['grading','review_pending'] as const){last=await f.app.saveClinicDecision(f.actor,{...f.input,decision,expectedRevisionId:last.revisionId,idempotencyKey:crypto.randomUUID()});expect(await state()).toBe('completed');}
      for(const decision of ['correction_required','explanation_required','reopened'] as const){
        last=await f.app.saveClinicDecision(f.actor,{...f.input,decision,expectedRevisionId:last.revisionId,idempotencyKey:crypto.randomUUID()});expect(await state()).toBe(decision);
        last=await f.app.saveClinicDecision(f.actor,{...f.input,expectedRevisionId:last.revisionId,idempotencyKey:crypto.randomUUID()});expect(await state()).toBe('completed');
      }
    }finally{await f.db.close();}
  });
  test('protected original intent survives an interrupted commit and is recovered without browser persistence',async()=>{
    const f=await clinicFixture();try{
      const original=f.store.append.bind(f.store);let interrupted=true;
      f.store.append=async(...args)=>{if(args[0].payload.kind==='teacher_clinic_revision'&&interrupted){interrupted=false;throw Error('fixture_commit_interrupted');}return original(...args);};
      await expect(f.app.saveClinicDecision(f.actor,f.input)).rejects.toThrow('fixture_commit_interrupted');
      const reconnected=new TeacherApplication(new PostgresAcademyStore(f.db),f.owner);
      const scene=await reconnected.student(f.actor,f.studentId,'2025-01-02') as any;
      expect(scene.clinicRecovery).toHaveLength(1);expect(scene.clinicRecovery[0].input).toEqual(f.input);
      const foreign=await reconnected.student({...f.actor,actorId:'other-teacher'},f.studentId,'2025-01-02') as any;expect(foreign.clinicRecovery).toEqual([]);
      const saved=await reconnected.saveClinicDecision(f.actor,scene.clinicRecovery[0].input);
      expect(saved.record.idempotencyKey).toBe(f.input.idempotencyKey);
      expect((await reconnected.student(f.actor,f.studentId,'2025-01-02') as any).clinicRecovery).toEqual([]);
    }finally{await f.db.close();}
  });
  test('shared query folds only exact item decisions; grades, other attempts and later effective corrections cannot fabricate completion',async()=>{
    const f=await clinicFixture();try{
      const view=async(date='2025-01-02')=>(await f.app.student(f.actor,f.studentId,date)).workContext.data as any;
      const before=(await view()).exactWork.assignments[0];expect(before.attempts[0].completed).toBe(false);
      const first=await f.app.saveClinicDecision(f.actor,f.input);
      expect((await view()).exactWork.assignments[0].attempts[0].completed).toBe(false);
      await f.app.saveClinicDecision(f.actor,{...f.input,assignedItemId:'assigned-2',idempotencyKey:crypto.randomUUID()});
      expect((await view()).exactWork.assignments[0].attempts[0].completed).toBe(true);
      const attempt2=await f.append('attempt-2',{...exactAttemptFixture(),attemptKey:{namespace:'fixture_attempt',literalKey:'attempt-2'},assignmentRevisionId:f.work.revisionId,previousAttemptRevisionId:f.attempt.revisionId});
      const attempts=(await view()).exactWork.assignments[0].attempts;
      expect(attempts.find((row:any)=>row.record.revisionId===attempt2.revisionId).completed).toBe(false);
      await f.app.saveClinicDecision(f.actor,{...f.input,expectedRevisionId:first.revisionId,idempotencyKey:crypto.randomUUID(),effectiveDate:'2025-01-03',reportedAt:'2025-01-03T03:00:00Z',decision:'reopened',note:'Invented next-day correction'});
      expect((await view()).exactWork.assignments[0].attempts.find((row:any)=>row.record.entityId==='attempt').completed).toBe(true);
      expect((await view('2025-01-03')).exactWork.assignments[0].attempts.find((row:any)=>row.record.entityId==='attempt').completed).toBe(false);
      await f.append('work',{...f.assignment,effectiveDate:'2025-01-04',status:'withdrawn'},f.work.revisionId);
      const historical=(await view()).exactWork.assignments[0];expect(historical.record.revisionId).toBe(f.work.revisionId);expect(historical.writable).toBe(false);
      expect((await view('2025-01-04')).exactWork.assignments[0].record.payload.status).toBe('withdrawn');
    }finally{await f.db.close();}
  });
  test('protected HTTP refuses forged scope and stale binding; concurrent writers have one winner and recovery survives reconnection',async()=>{
    const f=await clinicFixture();try{
      const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
      const handler=createTeacherServerHandler({app:f.app,origin,sessionKey,identity:{actorId:f.actor.actorId,username:'fixture',passwordHash:'not-a-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');}});
      const headers={Origin:origin,'Content-Type':'application/json',Cookie:'dc_teacher='+signTeacherSession(sessionKey,f.owner,f.actor.actorId),'X-Teacher-Owner':f.owner,'X-Teacher-Actor':f.actor.actorId};
      const post=(input:unknown,h=headers)=>handler(new Request(origin+'/api/teacher-clinic',{method:'POST',headers:h,body:JSON.stringify(input)}));
      expect((await post(f.input,{...headers,Cookie:''})).status).toBe(401);
      expect((await post(f.input,{...headers,Origin:'https://foreign.example.invalid'})).status).toBe(403);
      expect((await post({...f.input,actorId:'forged'})).status).toBe(400);
      expect((await post({...f.input,inspection:{writtenSolution:false,correctionExplanation:true}})).status).toBe(400);
      expect((await post({...f.input,studentId:'foreign'})).status).toBe(403);
      expect((await post({...f.input,assignedItemId:'foreign'})).status).toBe(409);
      const inputs=[f.input,{...f.input,idempotencyKey:crypto.randomUUID(),note:'Invented conflicting teacher intent'}];
      const responses=await Promise.all(inputs.map(input=>post(input)));expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
      const winner=responses.findIndex(r=>r.status===200),saved=await responses[winner]!.json();
      const uri=origin+'/api/teacher-clinic-result?studentId='+f.studentId+'&requestId='+inputs[winner]!.idempotencyKey;
      expect((await (await handler(new Request(uri,{headers}))).json()).record.revisionId).toBe(saved.revisionId);
      await f.append('work',{...f.assignment,status:'withdrawn'},f.work.revisionId);
      expect((await post({...f.input,idempotencyKey:crypto.randomUUID(),expectedRevisionId:saved.revisionId})).status).toBe(409);
      expect((await post(inputs[winner])).status).toBe(200);
      await f.db.close();
      const reopened=new SQL({adapter:'postgres',path:process.env.DC_ACADEMY_TEST_SOCKET!,username:'hermes',database:'dc_academy_test'});
      try{const app=new TeacherApplication(new PostgresAcademyStore(reopened),f.owner);expect((await app.clinicResult(f.actor,f.studentId,inputs[winner]!.idempotencyKey)).record.revisionId).toBe(saved.revisionId);}finally{await reopened.close();}
    }finally{await f.db.close();}
  });
  test('teacher completes one item, preserves identical fresh intent and reopens with exact original-request recovery',async()=>{
    const f=await clinicFixture();try{
      const app=f.app as any;
      const first=await app.saveClinicDecision(f.actor,f.input);
      expect(first).toMatchObject({status:'saved',officialSaved:false,parentSent:false});
      expect(first.record).toMatchObject({actorId:f.actor.actorId,studentId:f.studentId,payload:{kind:'teacher_clinic_revision',assignedItemId:'assigned-1',decision:'completed'}});
      expect((await app.saveClinicDecision(f.actor,f.input)).revisionId).toBe(first.revisionId);
      const next={...f.input,expectedRevisionId:first.revisionId,idempotencyKey:crypto.randomUUID()};
      const second=await app.saveClinicDecision(f.actor,next);expect(second.revisionId).not.toBe(first.revisionId);
      expect(second.record.previousRevisionId).toBe(first.revisionId);
      const reopened=await app.saveClinicDecision(f.actor,{...next,idempotencyKey:crypto.randomUUID(),expectedRevisionId:second.revisionId,decision:'reopened',note:'Invented new correction request'});
      expect(reopened.record.previousRevisionId).toBe(second.revisionId);
      expect((await app.clinicResult(f.actor,f.studentId,next.idempotencyKey)).record).toEqual(second.record);
      await expect(app.clinicResult({...f.actor,actorId:'foreign'},f.studentId,next.idempotencyKey)).rejects.toThrow('clinic_result_not_found');
      await expect(app.saveClinicDecision(f.actor,{...f.input,note:'changed'})).rejects.toThrow('idempotency_reuse');
      expect(await f.store.history(f.owner,f.studentId,first.record.entityId)).toHaveLength(3);
    }finally{await f.db.close();}
  });
});
