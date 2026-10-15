import {test,expect} from 'bun:test';
import {createTeacherServerHandler} from '../../src/academy/server';
import type {TeacherApplication} from '../../src/academy/application';
import type {PrivateArtifactAccess} from '../../src/academy/privateArtifactCatalog';
import {archiveActor,archivedFixture,fakeArchive} from './preservedHistoryFixtures';
import {preservedNamespace} from '../../src/academy/preservedHistory';
async function loggedIn(access:PrivateArtifactAccess){
 const origin='https://synthetic-archived-history.test',password='synthetic-history-password',key='synthetic-history-session-key-012345678901234567890',identity={actorId:archiveActor.actorId,username:'synthetic-archive-teacher',passwordHash:await Bun.password.hash(password,{algorithm:'bcrypt',cost:4})};let revoked=false;
 const handler=createTeacherServerHandler({app:{ownerId:archiveActor.ownerId} as TeacherApplication,origin,sessionKey:key,identity,invitationDigest:null,currentAuthentication:()=>({identity:revoked?null:identity,sessionKey:key}),saveIdentity:async()=>{throw Error('unexpected_auth_write');},privateArtifacts:access});
 const login=await handler(new Request(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:identity.username,password})}));expect(login.status).toBe(200);const cookie=login.headers.get('Set-Cookie')!.split(';')[0]!;
 return {origin,handler,cookie,revoke:()=>{revoked=true;},request:(path:string,method='GET')=>handler(new Request(origin+path,{method,headers:{Cookie:cookie,...(method==='POST'?{Origin:origin}:{})}}))};
}
const query=(snapshot:string)=>new URLSearchParams({namespace:preservedNamespace,scope:'student',studentId:'synthetic-archived-a',snapshot});
test('real password login gates archive API, exact details and original attachments, with strict GET-only selectors',async()=>{
 const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original),f=await loggedIn(source.access);
 for(const path of ['/api/preserved-history','/api/preserved-history-records','/api/preserved-history-record','/api/preserved-history-artifact'])expect((await f.handler(new Request(f.origin+path))).status).toBe(401);expect(source.reads()).toBe(0);
 const index=await (await f.request('/api/preserved-history')).json(),q=query(index.snapshotSha256),page=await (await f.request('/api/preserved-history-records?'+q)).json();expect(page.records).toHaveLength(20);expect(page.currentStudentBinding).toBeNull();q.set('recordId','archived-1');const detail=await f.request('/api/preserved-history-record?'+q);expect(detail.status).toBe(200);expect((await detail.json()).record.data.correctionScope).toBe('book_label_and_attribution_only');
 const download=await f.request('/api/preserved-history-artifact?'+new URLSearchParams({id:dataset.artifacts[0]!.id,snapshot:index.snapshotSha256}));expect(download.status).toBe(200);expect(Buffer.from(await download.arrayBuffer()).equals(original)).toBe(true);expect(download.headers.get('Content-Security-Policy')).toContain('sandbox');expect(download.headers.get('Content-Disposition')).toContain('Invented%20original.json');expect(download.headers.get('Cache-Control')).toBe('private, no-store');
 for(const path of ['/api/preserved-history?path=/etc/passwd','/api/preserved-history-records?'+query(index.snapshotSha256)+'&studentId=foreign','/api/preserved-history-record?'+query(index.snapshotSha256)+'&recordId=a&recordId=b'])expect((await f.request(path)).status).toBe(400);
 const foreign=query(index.snapshotSha256);foreign.set('studentId','synthetic-current-student');expect((await f.request('/api/preserved-history-records?'+foreign)).status).toBe(403);const wrongNamespace=query(index.snapshotSha256);wrongNamespace.set('namespace','academy_student');expect((await f.request('/api/preserved-history-records?'+wrongNamespace)).status).toBe(403);
 const reads=source.reads();expect((await f.request('/api/preserved-history','POST')).status).toBe(405);expect(source.reads()).toBe(reads);
});
test('post-await auth revocation refuses archive index, page, detail and artifact bytes without secret error reflection',async()=>{
 for(const phase of ['index','page','detail','artifact'] as const){
  const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original);let release!:()=>void,entered!:()=>void,armed=false;
  const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
  const access:PrivateArtifactAccess={list:source.access.list,async read(context,id){if(armed){entered();await gate;}return source.access.read(context,id);}};
  const f=await loggedIn(access),index=await (await f.request('/api/preserved-history')).json(),q=query(index.snapshotSha256);q.set('recordId','archived-1');const paths={index:'/api/preserved-history',page:'/api/preserved-history-records?'+query(index.snapshotSha256),detail:'/api/preserved-history-record?'+q,artifact:'/api/preserved-history-artifact?'+new URLSearchParams({id:dataset.artifacts[0]!.id,snapshot:index.snapshotSha256})};
  armed=true;const pending=f.request(paths[phase]);await started;f.revoke();release();const result=await pending;expect(result.status).toBe(401);expect(await result.json()).toEqual({error:'teacher_authentication_required'});
 }
});
test('an unavailable or damaged private dataset has a fixed bounded refusal, never private error strings',async()=>{
 const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original);source.access.read=async()=>{throw Error('SYNTHETIC_PRIVATE_PAYLOAD_DO_NOT_REFLECT');};const f=await loggedIn(source.access);const result=await f.request('/api/preserved-history');expect(result.status).toBe(503);expect(await result.json()).toEqual({error:'preserved_history_unavailable'});
});
