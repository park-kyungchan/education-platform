import {describe,expect,test} from 'bun:test';
import {SQL} from 'bun';
import {JSDOM} from 'jsdom';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {TeacherApplication} from '../../src/academy/application';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {teacherPage} from '../../src/academy/web/page';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
const until=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await Bun.sleep(20);}throw Error('synthetic_ui_timeout');};

describe.skipIf(!socket)('actual teacher client + loopback HTTP + PostgreSQL, synthetic DOM not native Screen',()=>{
 test('retains a failed-save draft, recovers the exact committed request and appends a user correction',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);await store.migrate();
  const owner='fixture-ui-'+randomUUID(),id='fixture-ui-student',actor='fixture-ui-teacher';
  await store.registerStudent({ownerId:owner,id,displayName:'Invented UI Learner',sourceKey:{namespace:'academy_student',literalKey:'91001'},proofRefs:['fixture']});
  const occurrence={date:'2025-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
  const acquisition={schemaVersion:1,family:'day_record',status:'observed',records:[],dailyResults:[],dayRecords:[{...occurrence,teacherKey:'11001',studentKey:'91001',studentName:'Invented UI Learner',fields:{attendance:'N',homework:'Invented range'}}],requestedScope:{family:'day_record',teacherLabel:'Invented Teacher',date:occurrence.date,groupIds:['21001'],studentNames:['Invented UI Learner']},observedAt:'2025-01-02T00:00:00Z',coverage:'requested_date_groups_students_not_cohort_completeness',unknownStates:['synthetic'],nativePrintInvoked:false,automaticRetryAllowed:false};
  await store.append({ownerId:owner,studentId:id,entityId:'fixture-ui-source',actorId:'fixture-reader',idempotencyKey:'fixture-ui-source-read',expectedRevisionId:null,sourceObservedAt:acquisition.observedAt,payload:{kind:'source_audit',acquisition,contractRef:'fixture'}});
  const build=await Bun.build({entrypoints:[resolve(import.meta.dir,'../../src/academy/web/client.ts')],target:'browser',format:'iife'});expect(build.success).toBe(true);
  let handler:ReturnType<typeof createTeacherServerHandler>|undefined;
  const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch:request=>handler?handler(request):new Response(null,{status:503})});
  const origin='http://127.0.0.1:'+server.port,sessionKey=createAuthSecrets().sessionKey;
  handler=createTeacherServerHandler({app:new TeacherApplication(store,owner),origin,sessionKey,identity:{actorId:actor,username:'synthetic-only',passwordHash:'not-a-real-credential'},invitationDigest:null,saveIdentity:async()=>{throw Error('fixture_no_identity_write');},page:teacherPage,script:await build.outputs[0]!.text()});
  const dom=new JSDOM(await (await fetch(origin+'/')).text(),{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
  let loseAcknowledgement=true,posts=0;
  Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{
    const headers=new Headers(options.headers);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,owner,actor));headers.set('Origin',origin);
    const response=await fetch(new URL(path,origin),{...options,headers});
    if(path==='/api/teacher-observation'&&options.method==='POST'){posts++;if(loseAcknowledgement){loseAcknowledgement=false;await response.text();throw Error('synthetic_lost_acknowledgement');}}
    return response;
  }});
  const el=(key:string)=>dom.window.document.getElementById(key)!;
  // Bun/jsdom's PointerEvent Window check is not a browser pixel/input qualification.
  const click=(key:string)=>el(key).dispatchEvent(new dom.window.Event('click',{bubbles:true}));
  try{
    dom.window.eval(await (await fetch(origin+'/client.js')).text());
    await until(()=>!!el('teacher-observation-text'));
    const textarea=()=>el('teacher-observation-text') as HTMLTextAreaElement;
    textarea().value='Invented UI observation';textarea().dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    click('teacher-observation-save');
    await until(()=>el('teacher-observation-status').textContent!.includes('확인하지 못했습니다'));
    expect(textarea().value).toBe('Invented UI observation');expect(posts).toBe(1);
    expect((el('teacher-observation-save') as HTMLButtonElement).disabled).toBe(true);
    click('teacher-observation-recover');
    await until(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));
    expect(posts).toBe(1);
    textarea().value='Invented UI corrected observation';textarea().dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    click('teacher-observation-save');await until(()=>el('teacher-observation-status').textContent!.includes('저장 확인')&&posts===2);
    const current=(await store.current(owner,id)).filter(v=>v.payload.kind==='teacher_observation');expect(current).toHaveLength(1);
    const history=await store.history(owner,id,current[0]!.entityId);
    expect(history.map(v=>v.payload.kind==='teacher_observation'?v.payload.text:null)).toEqual(['Invented UI observation','Invented UI corrected observation']);
    expect(el('teacher-observation-status').textContent).toContain(current[0]!.revisionId);
    expect(dom.window.document.body.textContent).toContain('공식 기록 저장·승인·부모 전송이 아닙니다');
    expect((await fetch(origin+'/api/cohort')).status).toBe(401);
    // A transport failure before commit is not a stored note. Only an explicit same-request retry follows a readback.
    const nativeFetch=dom.window.fetch;
    let rejectBeforeCommit=true;
    dom.window.fetch=async(...args:Parameters<typeof nativeFetch>)=>{
      if(String(args[0])==='/api/teacher-observation'&&rejectBeforeCommit){rejectBeforeCommit=false;throw Error('synthetic_before_commit_failure');}
      return nativeFetch(...args);
    };
    textarea().value='Invented explicitly retried observation';textarea().dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    click('teacher-observation-save');await until(()=>el('teacher-observation-status').textContent!.includes('확인하지 못했습니다'));
    click('teacher-observation-recover');await until(()=>el('teacher-observation-status').textContent!.includes('아직 확인되지'));
    expect(el('teacher-observation-retry')).not.toBeNull();
    click('teacher-observation-retry');await until(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));
    expect(posts).toBe(3);
    expect((await store.history(owner,id,current[0]!.entityId))).toHaveLength(3);
  }finally{dom.window.close();await server.stop(true);await db.close();}
 });
});
