import { beforeAll, describe, expect, test } from 'bun:test';
import {ensureSyntheticStudentFixture} from './postgresFixture';
import { SourceRefreshCoordinator } from '../../src/academy/refresh';
import { SQL } from 'bun';
import { PostgresAcademyStore } from '../../src/academy/postgresStore';
import {normalizeCohortDiscovery} from '../../src/academy/sourceBridge';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {TeacherApplication} from '../../src/academy/application';
import {JSDOM} from 'jsdom';
import {teacherPage} from '../../src/academy/web/page';
function sourceCapture(progress='10 %'){
  return {schemaVersion:1,teacherLabel:'Invented Atomic Teacher',principalKey:'99011',collegeKey:'88011',observedAt:'2025-01-03T00:00:00Z',source:'direct_http_api',academyMutations:0,
    students:[{name:'Invented Atomic Learner',observedAt:'2025-01-03T00:00:00Z',courseRows:[{cells:['Invented grade','Invented Atomic Teacher','Invented Atomic Learner','Invented course','ver.fixture','Invented active','Non-invoked controls'],handlers:['onChangeStatus(0,88011,91011,71011,81011)','onResetCourse(71011,91011,88011)','onDeleteCourse(88011,91011,71011,81011)']}],
      bookRows:['61011','61012'].map(key=>({cells:['Invented Atomic Learner','Invented edition '+key,progress,'Non-invoked control','Non-invoked control'],bindings:[`createBookIncorrectPapers('71011','${key}','91011')`]}))}]};
}
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('source refresh failure recovery',()=>{
  beforeAll(ensureSyntheticStudentFixture);
  test('protected request history paginates every terminal receipt without crossing actors or reacquiring',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const actor={ownerId:'fixture-owner-a',actorId:'fixture-history-pages',role:'teacher' as const};let acquisitions=0;
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:actor.ownerId,teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{acquisitions++;return {status:'blocked',reason:'fixture_authentication_required'};});
    try{
      const ids=Array.from({length:23},()=>crypto.randomUUID());
      for(const id of ids)await coordinator.refresh(actor,'fixture-student-a',id);
      const first=await coordinator.history(actor);expect(first.rows).toHaveLength(20);expect(first.nextCursor).not.toBeNull();
      const second=await coordinator.history(actor,first.nextCursor);expect(second.rows).toHaveLength(3);expect(second.nextCursor).toBeNull();
      expect([...first.rows,...second.rows].map(row=>row.requestId)).toEqual(ids.sort());
      expect((await coordinator.history({...actor,actorId:'fixture-foreign-history'})).rows).toEqual([]);
      await expect(coordinator.history({...actor,ownerId:'foreign'})).rejects.toThrow('owner_scope_conflict');
      await expect(coordinator.history(actor,' malformed ')).rejects.toThrow('source_request_id_required');expect(acquisitions).toBe(23);
    }finally{await db.close();}
  });
  test('a late intake failure rolls back earlier heads and catalog writes together',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const capture=sourceCapture(),normalized=normalizeCohortDiscovery(capture,['Invented Atomic Learner']),registration=normalized.students[0]!.registration;
    await store.registerStudent(registration);
    const actor={ownerId:normalized.ownerId,actorId:'fixture-atomic-actor',role:'teacher' as const};
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:normalized.ownerId,teacherLabel:normalized.teacherLabel,teacherKey:normalized.teacherKey,collegeKey:normalized.collegeKey},async()=>({status:'observed',data:capture}));
    const beforeHeads=await store.current(actor.ownerId,registration.id),beforeCatalog=await store.catalog(actor.ownerId);
    // Real PostgreSQL rejection on the second book, after an otherwise valid first append.
    await db`ALTER TABLE academy.record_versions ADD CONSTRAINT fixture_source_second_book_failure CHECK(NOT (payload->>'sourceBookLabel'='Invented edition 61012'))`;
    try{
      await expect(coordinator.refresh(actor,registration.id)).rejects.toThrow();
      expect(await store.current(actor.ownerId,registration.id)).toEqual(beforeHeads);
      expect(await store.catalog(actor.ownerId)).toEqual(beforeCatalog);
    }finally{await db`ALTER TABLE academy.record_versions DROP CONSTRAINT fixture_source_second_book_failure`;await db.close();}
  });
  test('authentication failure leaves previous verified source heads untouched',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'});
    const store=new PostgresAcademyStore(db);
    const before=await store.current('fixture-owner-a','fixture-student-a');
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:'fixture-owner-a',teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>({status:'blocked',reason:'authentication_required'}));
    const result=await coordinator.refresh({ownerId:'fixture-owner-a',actorId:'fixture-user',role:'teacher'},'fixture-student-a');
    expect(result.status).toBe('blocked');expect(result.cacheRetained).toBe(true);
    expect(await store.current('fixture-owner-a','fixture-student-a')).toEqual(before);
    await db.close();
  });
  test('independent coordinators join a durable original request and recover its lost acknowledgement',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const capture=sourceCapture(),normalized=normalizeCohortDiscovery(capture,['Invented Atomic Learner']),student=normalized.students[0]!.registration;
    await store.registerStudent(student);
    const actor={ownerId:normalized.ownerId,actorId:'fixture-coalescing-actor',role:'teacher' as const},config={ownerId:normalized.ownerId,teacherLabel:normalized.teacherLabel,teacherKey:normalized.teacherKey,collegeKey:normalized.collegeKey};
    let release!:()=>void,started!:()=>void,calls=0;
    const held=new Promise<void>(r=>release=r),entered=new Promise<void>(r=>started=r);
    const acquire=async()=>{calls++;started();await held;return {status:'observed' as const,data:capture};};
    const first=new SourceRefreshCoordinator(store,config,acquire),second=new SourceRefreshCoordinator(new PostgresAcademyStore(db),config,acquire),requestId=crypto.randomUUID();
    const original=first.refresh(actor,student.id,requestId);await entered;
    const other=second.refresh(actor,student.id,crypto.randomUUID());
    try{
      const joined=await Promise.race([other,new Promise(resolve=>setTimeout(()=>resolve({status:'still_acquiring'}),100))]);
      expect(joined).toMatchObject({status:'pending',requestId});expect(calls).toBe(1);
      expect(await second.pending(actor)).toMatchObject({requestId,status:'pending'});
      expect(await second.pending({...actor,actorId:'fixture-foreign-actor'})).toBeNull();
      expect(await second.result({...actor,actorId:'fixture-foreign-actor'},requestId)).toMatchObject({status:'not_found'});
      release();await original; // Deliberately discard the original caller response.
      const reconstructed=new SourceRefreshCoordinator(new PostgresAcademyStore(db),config,acquire);
      expect(await reconstructed.result(actor,requestId)).toMatchObject({status:'observed',requestId,bookCount:2});
      expect(await reconstructed.refresh(actor,student.id,requestId)).toMatchObject({status:'observed',requestId});expect(calls).toBe(1);
    }finally{release();await Promise.allSettled([original,other]);await db.close();}
  });
  test('a late older capture cannot replace current source or move freshness backwards',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    let capture=sourceCapture('30 %');capture.observedAt=capture.students[0]!.observedAt='2025-01-04T00:00:00Z';
    const normalized=normalizeCohortDiscovery(capture,['Invented Atomic Learner']),student=normalized.students[0]!.registration;
    await store.registerStudent(student);
    const actor={ownerId:normalized.ownerId,actorId:'fixture-clock-actor',role:'teacher' as const};
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:normalized.ownerId,teacherLabel:normalized.teacherLabel,teacherKey:normalized.teacherKey,collegeKey:normalized.collegeKey},async()=>({status:'observed',data:capture}));
    try{
      expect((await coordinator.refresh(actor,student.id)).status).toBe('observed');
      const heads=await store.current(actor.ownerId,student.id),catalog=await store.catalog(actor.ownerId);
      capture=sourceCapture('5 %');
      await expect(coordinator.refresh(actor,student.id)).rejects.toThrow('stale_source_capture');
      expect(await store.current(actor.ownerId,student.id)).toEqual(heads);expect(await store.catalog(actor.ownerId)).toEqual(catalog);
    }finally{await db.close();}
  });
  test('authenticated HTTP restores the exact request through result and pending reads without acquiring again',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const actor={ownerId:'fixture-owner-a',actorId:'fixture-http-source',role:'teacher' as const};let acquisitions=0;
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:actor.ownerId,teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'},async()=>{acquisitions++;return {status:'blocked',reason:'authentication_required'};});
    const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
    const handler=createTeacherServerHandler({app:{ownerId:actor.ownerId} as TeacherApplication,origin,sessionKey,identity:{actorId:actor.actorId,username:'fixture',passwordHash:'not-live'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');},
      refresh:(context,input)=>coordinator.refresh(context,input.studentId,input.requestId),refreshResult:(context,id)=>coordinator.result(context,id),refreshPending:context=>coordinator.pending(context)});
    const headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,actor.ownerId,actor.actorId),Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':actor.ownerId,'X-Teacher-Actor':actor.actorId},requestId=crypto.randomUUID();
    try{
      const response=await handler(new Request(origin+'/api/refresh',{method:'POST',headers,body:JSON.stringify({studentId:'fixture-student-a',requestId})}));
      expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:'blocked',requestId});
      const recovered=await handler(new Request(origin+'/api/source-refresh-result?requestId='+requestId,{headers}));
      expect(recovered.status).toBe(200);expect(await recovered.json()).toMatchObject({ownerId:actor.ownerId,actorId:actor.actorId,requestId,status:'blocked'});
      const pending=await handler(new Request(origin+'/api/source-refresh-pending',{headers}));expect(pending.status).toBe(200);expect(await pending.json()).toBeNull();
      expect((await handler(new Request(origin+'/api/source-refresh-result?requestId='+requestId+'&actorId=foreign',{headers}))).status).toBe(400);
      expect(acquisitions).toBe(1);
    }finally{await db.close();}
  });
  test('historical browser provenance stays readable but cannot enter the current acquisition consumer',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const capture=sourceCapture('40 %');capture.source='native_browser_managed_auth';capture.observedAt=capture.students[0]!.observedAt='2025-01-06T00:00:00Z';
    const normalized=normalizeCohortDiscovery(capture,['Invented Atomic Learner']),student=normalized.students[0]!.registration;await store.registerStudent(student);
    const actor={ownerId:normalized.ownerId,actorId:'fixture-transport-actor',role:'teacher' as const};
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:normalized.ownerId,teacherLabel:normalized.teacherLabel,teacherKey:normalized.teacherKey,collegeKey:normalized.collegeKey},async()=>({status:'observed',data:capture}));
    try{
      const before=await store.current(actor.ownerId,student.id);
      await expect(coordinator.refresh(actor,student.id)).rejects.toThrow('source_transport_not_admitted');
      expect(await store.current(actor.ownerId,student.id)).toEqual(before);
    }finally{await db.close();}
  });
  test('a held older acquisition for another student cannot regress owner-shared catalog metadata',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const a=sourceCapture();a.observedAt=a.students[0]!.observedAt='2025-02-01T00:00:00Z';a.students[0]!.bookRows=a.students[0]!.bookRows.slice(0,1);
    const b=structuredClone(a);b.observedAt=b.students[0]!.observedAt='2025-02-03T00:00:00Z';b.students[0]!.name='Invented Shared Learner';
    b.students[0]!.courseRows[0]!.cells[2]='Invented Shared Learner';b.students[0]!.courseRows[0]!.handlers=b.students[0]!.courseRows[0]!.handlers.map(s=>s.replaceAll('91011','91012').replaceAll('81011','81012'));
    b.students[0]!.bookRows[0]!.cells[0]='Invented Shared Learner';b.students[0]!.bookRows[0]!.cells[1]='Invented newer shared label';b.students[0]!.bookRows[0]!.bindings=b.students[0]!.bookRows[0]!.bindings.map(s=>s.replaceAll('91011','91012'));
    const na=normalizeCohortDiscovery(a,[a.students[0]!.name]),nb=normalizeCohortDiscovery(b,[b.students[0]!.name]);
    await store.registerStudent(na.students[0]!.registration);await store.registerStudent(nb.students[0]!.registration);
    const actor={ownerId:na.ownerId,actorId:'fixture-shared-actor-a',role:'teacher' as const},other={...actor,actorId:'fixture-shared-actor-b'},config={ownerId:na.ownerId,teacherLabel:na.teacherLabel,teacherKey:na.teacherKey,collegeKey:na.collegeKey};
    let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
    try{
      await new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:a})).refresh(actor,na.students[0]!.registration.id);
      const aBefore=await store.current(actor.ownerId,na.students[0]!.registration.id);
      a.observedAt=a.students[0]!.observedAt='2025-02-02T00:00:00Z';
      const late=new SourceRefreshCoordinator(store,config,async()=>{entered();await gate;return {status:'observed',data:a};}).refresh(actor,na.students[0]!.registration.id);
      await started;
      try{
        expect((await new SourceRefreshCoordinator(store,config,async()=>({status:'observed',data:b})).refresh(other,nb.students[0]!.registration.id)).status).toBe('observed');
        const catalog=await store.catalog(actor.ownerId),bBefore=await store.current(actor.ownerId,nb.students[0]!.registration.id);release();
        await expect(late).rejects.toThrow('stale_shared_catalog_capture');
        expect(await store.catalog(actor.ownerId)).toEqual(catalog);expect(await store.current(actor.ownerId,na.students[0]!.registration.id)).toEqual(aBefore);expect(await store.current(actor.ownerId,nb.students[0]!.registration.id)).toEqual(bBefore);
      }finally{release();await Promise.allSettled([late]);}
    }finally{await db.close();}
  });
  test('reload after an undelivered committed receipt discovers the protected terminal result without a new POST',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const capture=sourceCapture();capture.observedAt=capture.students[0]!.observedAt='2025-03-01T00:00:00Z';
    const n=normalizeCohortDiscovery(capture,['Invented Atomic Learner']),student=n.students[0]!.registration;await store.registerStudent(student);
    const actor={ownerId:n.ownerId,actorId:'fixture-terminal-browser',role:'teacher' as const},app=new TeacherApplication(store,n.ownerId),requestId=crypto.randomUUID();
    const coordinator=new SourceRefreshCoordinator(store,{ownerId:n.ownerId,teacherLabel:n.teacherLabel,teacherKey:n.teacherKey,collegeKey:n.collegeKey},async()=>({status:'observed',data:capture}));
    const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
    let activeIdentity={actorId:actor.actorId,username:'fixture',passwordHash:await Bun.password.hash('invented-history-password')};
    const handler=createTeacherServerHandler({app,origin,sessionKey,identity:activeIdentity,currentAuthentication:()=>({identity:activeIdentity,sessionKey}),invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');},refresh:(context,input)=>coordinator.refresh(context,input.studentId,input.requestId),refreshResult:(context,id)=>coordinator.result(context,id),refreshPending:context=>coordinator.pending(context),refreshHistory:(context,cursor)=>coordinator.history(context,cursor)});
    const headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,actor.ownerId,actor.actorId),Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':actor.ownerId,'X-Teacher-Actor':actor.actorId};
    const dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});let browserPosts=0;
    try{
      // The server commits, but this response never reaches the browser which is then reconstructed.
      await handler(new Request(origin+'/api/refresh',{method:'POST',headers,body:JSON.stringify({studentId:student.id,requestId})}));
      expect(await coordinator.result(actor,requestId)).toMatchObject({status:'observed'});
      Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{if(options.method==='POST')browserPosts++;return handler(new Request(new URL(path,origin),{...options,headers:{...headers,...options.headers}}));}});
      const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});dom.window.eval(await build.outputs[0]!.text());
      for(let i=0;i<100&&!dom.window.document.getElementById('recover-source-refresh');i++)await Bun.sleep(10);
      const button=dom.window.document.getElementById('recover-source-refresh')!;button.dispatchEvent(new dom.window.Event('click'));
      const text=()=>dom.window.document.getElementById('refresh-status')!.textContent!;
      for(let i=0;i<100&&!dom.window.document.getElementById('source-refresh-history');i++)await Bun.sleep(10);
      const history=dom.window.document.getElementById('source-refresh-history');expect(history).not.toBeNull();
      expect(history!.textContent).toContain(requestId);expect(history!.textContent).toContain('observed');expect(history!.textContent).toContain(student.displayName);
      expect(text()).toContain('새 조회를 시작하지 않았습니다');expect(browserPosts).toBe(0);
      activeIdentity={...activeIdentity,actorId:'fixture-new-history-actor'};headers.Cookie='dc_teacher='+signTeacherSession(sessionKey,actor.ownerId,activeIdentity.actorId);
      (dom.window.document.getElementById('username') as HTMLInputElement).value='fixture';
      (dom.window.document.getElementById('password') as HTMLInputElement).value='invented-history-password';
      dom.window.document.getElementById('login-form')!.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
      for(let i=0;i<200&&!dom.window.document.getElementById('status')!.textContent!.includes('교사 계정으로 연결됐습니다');i++)await Bun.sleep(10);
      expect(dom.window.document.getElementById('status')!.textContent).toContain('교사 계정으로 연결됐습니다');
      expect(dom.window.document.getElementById('source-refresh-history')).toBeNull();
    }finally{dom.window.close();await db.close();}
  });
  test('actual browser bundle recovers server-owned pending work after reload when browser storage is unavailable',async()=>{
    const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
    const actor={ownerId:'fixture-owner-a',actorId:'fixture-browser-source',role:'teacher' as const},app=new TeacherApplication(store,actor.ownerId),requestId=crypto.randomUUID();
    await store.admitSourceRequest(actor.ownerId,actor.actorId,'fixture-student-a',requestId);
    const origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;let posts=0;
    const handler=createTeacherServerHandler({app,origin,sessionKey,identity:{actorId:actor.actorId,username:'fixture',passwordHash:'not-live'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');},refreshResult:(context,id)=>store.sourceRequestResult(context.ownerId,context.actorId,id),refreshPending:context=>store.pendingSourceRequest(context.ownerId,context.actorId)});
    const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});expect(build.success).toBe(true);
    try{for(let reload=0;reload<2;reload++){
      const dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
      try{
        for(const name of ['localStorage','sessionStorage'])Object.defineProperty(dom.window,name,{get(){throw Error('fixture_storage_denied');}});
        Object.assign(dom.window,{structuredClone,fetch:async(path:string,options:RequestInit={})=>{
          if(options.method==='POST')posts++;const headers=new Headers(options.headers);headers.set('Origin',origin);headers.set('Cookie','dc_teacher='+signTeacherSession(sessionKey,actor.ownerId,actor.actorId));
          return handler(new Request(new URL(path,origin),{...options,headers}));
        }});
        dom.window.eval(await build.outputs[0]!.text());
        for(let i=0;i<100&&!dom.window.document.getElementById('recover-source-refresh');i++)await Bun.sleep(10);
        const button=dom.window.document.getElementById('recover-source-refresh');expect(button).not.toBeNull();button!.dispatchEvent(new dom.window.Event('click'));
        const status=()=>dom.window.document.getElementById('refresh-status')!.textContent!;
        for(let i=0;i<100&&!status().includes('기존 갱신 요청');i++)await Bun.sleep(10);
        expect(status()).toContain('기존 갱신 요청');expect(status()).toContain('새 조회를 시작하지 않았습니다');
        expect((dom.window.document.getElementById('refresh-all') as HTMLButtonElement).disabled).toBe(true);
      }finally{dom.window.close();}
    }expect(posts).toBe(0);}finally{await db.close();}
  });
});
