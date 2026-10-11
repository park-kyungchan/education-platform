import {describe,expect,test} from 'bun:test';
import {SQL} from 'bun';
import {readFileSync} from 'node:fs';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import {normalizeCohortDiscovery} from '../../src/academy/sourceBridge';
import {createTeacherServerHandler} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import {directScope,directWitness,syntheticHttpDiscovery,syntheticHttpRead} from './directSourceFixture';
import {connectionView} from '../../src/academy/web/connectionView';
import {createTeacherSourceRuntime} from '../../src/academy/sourceRuntime';
import {JSDOM} from 'jsdom';
import {teacherPage} from '../../src/academy/web/page';

const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('selected source runtime with synthetic HTTP and isolated PostgreSQL',()=>{
 test('uncertain process termination keeps the durable actor request pending and blocks redispatch',async()=>{
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
  try{
   await store.migrate();const normalized=normalizeCohortDiscovery(directWitness().books,directScope.studentNames),student=normalized.students[0]!.registration;await store.registerStudent(student);
   let calls=0;const runtime=createTeacherSourceRuntime(store,{ownerId:normalized.ownerId,...directScope,username:'fixture-user'},async()=>{calls++;throw Error('source_group_termination_unverified');});
   const actor={ownerId:normalized.ownerId,actorId:'fixture-uncertain-source',role:'teacher' as const},requestId=crypto.randomUUID();
   expect(await runtime.coordinator.refresh(actor,student.id,requestId)).toMatchObject({status:'pending',requestId});
   expect(await runtime.coordinator.refresh(actor,student.id,crypto.randomUUID())).toMatchObject({status:'pending',requestId,coalesced:true});
   expect(await runtime.coordinator.pending(actor)).toMatchObject({status:'pending',requestId});expect(calls).toBe(1);
  }finally{await db.close();}
 });
 test('main-selected runtime connects protected refresh, atomic store, shared teacher/agent context and receipt readback',async()=>{
  const module=await import('../../src/academy/sourceRuntime').catch(()=>({createTeacherSourceRuntime:undefined}));
  expect(typeof module.createTeacherSourceRuntime).toBe('function');
  const db=new SQL({adapter:'postgres',path:socket!,username:'hermes',database:'dc_academy_test'}),store=new PostgresAcademyStore(db);
  try{
   await store.migrate();const normalized=normalizeCohortDiscovery(directWitness().books,directScope.studentNames),student=normalized.students[0]!.registration;
   await store.registerStudent(student);let acquisitions=0,areaReads=0;
   const runtime=module.createTeacherSourceRuntime!(store,{ownerId:normalized.ownerId,...directScope,username:'fixture-user'},async input=>{acquisitions++;return syntheticHttpDiscovery(input);},async input=>{areaReads++;return syntheticHttpRead(input);});
   const actor={ownerId:normalized.ownerId,actorId:'fixture-source-runtime',role:'teacher' as const},origin='https://synthetic.example.invalid',sessionKey=createAuthSecrets().sessionKey;
   const {app,coordinator}=runtime;
   const handler=createTeacherServerHandler({app,origin,sessionKey,identity:{actorId:actor.actorId,username:'fixture',passwordHash:'not-live'},invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');},refresh:(context,selection)=>coordinator.refresh(context,selection.studentId,selection.requestId,selection.date),refreshResult:(context,id)=>coordinator.result(context,id),refreshPending:context=>coordinator.pending(context)});
   const headers={Cookie:'dc_teacher='+signTeacherSession(sessionKey,actor.ownerId,actor.actorId),Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':actor.ownerId,'X-Teacher-Actor':actor.actorId};
   const before=await app.cohort(actor);expect(connectionView(before.connection).refreshDisabled).toBe(false);expect(before.connection.acquisition.lastObservedAt).toBeNull();expect(acquisitions).toBe(0);
   const requestId=crypto.randomUUID(),body=JSON.stringify({studentId:student.id,requestId});
   expect((await handler(new Request(origin+'/api/refresh',{method:'POST',body}))).status).toBe(403);
   expect(acquisitions).toBe(0);
   const response=await handler(new Request(origin+'/api/refresh',{method:'POST',headers,body}));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({status:'observed',requestId,bookCount:1});
   const readback=await handler(new Request(origin+'/api/source-refresh-result?requestId='+requestId,{headers}));expect(await readback.json()).toMatchObject({status:'observed',requestId,ownerId:actor.ownerId,actorId:actor.actorId});
   const scene=await app.student(actor,student.id,'2025-01-02');expect(scene.books).toHaveLength(1);
   const book=scene.books[0]!.source;if(book.kind!=='source_book_registration')throw Error('fixture_book_missing');
   expect(book.evidenceRefs[0]).toStartWith('direct-http-field-proof:');
   expect(scene.workContext.action.sourceAcquisition).toEqual(scene.connection.acquisition);
   expect(scene.workContext.action.operations.find(row=>row.operation==='refresh_academy')!.availability).toBe('requires_current_source_qualification');
   expect(connectionView(scene.connection).acquisitionLabel).toContain('등록·교재');expect(scene.officialSaved).toBe(false);expect(scene.parentSent).toBe(false);
   expect((await coordinator.refresh(actor,student.id,requestId)).status).toBe('observed');expect(acquisitions).toBe(1);
   const dom=new JSDOM(teacherPage,{url:origin+'/?date=2025-01-02',runScripts:'outside-only'});
   const tools=new Map<string,{execute:(input:unknown)=>Promise<{content:{text:string}[]}>}>();
   const wait=async(predicate:()=>boolean)=>{for(let i=0;i<200;i++){if(predicate())return;await Bun.sleep(10);}throw Error('fixture_runtime_ui_timeout');};
   try{
    for(const key of ['localStorage','sessionStorage'])Object.defineProperty(dom.window,key,{get(){throw Error('fixture_storage_denied');}});
    Object.defineProperty(dom.window.document,'modelContext',{value:{registerTool:(tool:{name:string;execute:(input:unknown)=>Promise<{content:{text:string}[]}>})=>tools.set(tool.name,tool)}});
    Object.assign(dom.window,{structuredClone,fetch:(path:string,options:RequestInit={})=>handler(new Request(new URL(path,origin),{...options,headers:{...headers,...options.headers}}))});
    const build=await Bun.build({entrypoints:['src/academy/web/client.ts'],target:'browser',format:'iife'});expect(build.success).toBe(true);dom.window.eval(await build.outputs[0]!.text());
    await wait(()=>tools.has('query_student_learning'));
    dom.window.document.querySelector('#students button')!.dispatchEvent(new dom.window.Event('click'));
    const refresh=dom.window.document.getElementById('refresh-student') as HTMLButtonElement;
    await wait(()=>!refresh.disabled);refresh.dispatchEvent(new dom.window.Event('click'));
    await wait(()=>dom.window.document.getElementById('refresh-status')!.textContent!.includes('갱신 요청 결과: observed'));
    expect(acquisitions).toBe(2);
    const result=JSON.parse((await tools.get('query_student_learning')!.execute({studentId:student.id,date:'2025-01-02'})).content[0]!.text);
    expect(result.workContext.action.sourceAcquisition).toEqual(result.connection.acquisition);expect(result.connection.acquisition.scope).toBe('registered_books_and_retained_exact_scopes');expect(areaReads).toBe(1);
    expect(dom.window.document.getElementById('source-area-results')?.textContent).toContain('수강 등록');
   }finally{dom.window.close();}
   const main=readFileSync(new URL('../../src/academy/main.ts',import.meta.url),'utf8');expect(main).toContain('createTeacherSourceRuntime');expect(main).not.toContain('nativeBookAcquirer');
  }finally{await db.close();}
 });
});
