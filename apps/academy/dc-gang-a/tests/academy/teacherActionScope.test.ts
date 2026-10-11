import {describe,expect,test} from 'bun:test';
import {createTeacherServerHandler,type LoginIdentity} from '../../src/academy/server';
import {createAuthSecrets,signTeacherSession} from '../../src/academy/auth';
import type {TeacherApplication} from '../../src/academy/application';

const origin='https://synthetic.example.invalid',ownerId='fixture-owner',actorId='fixture-teacher';
const expectation={'X-Teacher-Owner':ownerId,'X-Teacher-Actor':actorId};
function fixture(){
  const sessionKey=createAuthSecrets().sessionKey;let currentActor=actorId,writes=0;
  const identity=()=>({actorId:currentActor,username:'fixture',passwordHash:'not-a-real-credential'});
  const app={ownerId,saveObservation:async()=>{writes++;return {saved:true};},saveClinicDecision:async()=>{writes++;return {saved:true};}} as unknown as TeacherApplication;
  const handler=createTeacherServerHandler({app,origin,sessionKey,identity:identity(),currentAuthentication:()=>({identity:identity(),sessionKey}),invitationDigest:null,saveIdentity:async()=>{throw Error('not_admitted');},refresh:async()=>{writes++;return {saved:true};}});
  const request=(path:string,scope:Record<string,string>=expectation,body:BodyInit=path==='/api/refresh'?JSON.stringify({studentId:null,requestId:crypto.randomUUID()}):'{}')=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'dc_teacher='+signTeacherSession(sessionKey,ownerId,currentActor),...scope},body});
  return {handler,request,writes:()=>writes,changeActor:()=>{currentActor='fixture-teacher-B';}};
}
describe('teacher action scope at authenticated HTTP ingress',()=>{
  function bootstrapFixture(){
    let identity:LoginIdentity|null=null,sessionKey=createAuthSecrets().sessionKey,writes=0;
    const handler=createTeacherServerHandler({app:{ownerId} as TeacherApplication,origin,sessionKey,identity:null,invitationDigest:null,currentAuthentication:()=>({identity,sessionKey}),saveIdentity:async value=>{writes++;identity=value;}});
    const hold=()=>{
      let release!:()=>void;const stream=new ReadableStream<Uint8Array>({start(controller){release=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({username:'invented-'+crypto.randomUUID(),password:crypto.randomUUID()})));controller.close();};}});
      const request=new Request(origin+'/api/setup-user',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:'dc_setup='+signTeacherSession(sessionKey,ownerId,'bootstrap-owner')},body:stream});
      return {release:()=>release(),response:handler(request)};
    };
    return {hold,writes:()=>writes,installIdentity:()=>{identity={actorId:'fixture-installed-teacher',username:'fixture-existing',passwordHash:'not-a-live-credential'};},rotateKey:()=>{sessionKey=createAuthSecrets().sessionKey;}};
  }
  test('concurrent held bootstrap bodies can register exactly one teacher',async()=>{
    const f=bootstrapFixture(),a=f.hold(),b=f.hold();await Bun.sleep(0);a.release();b.release();
    const results=await Promise.all([a.response,b.response]);expect(results.map(row=>row.status).sort()).toEqual([200,403]);expect(f.writes()).toBe(1);
    expect(await results.find(row=>row.status===403)!.json()).toEqual({error:'setup_not_admitted'});
  });
  for(const change of ['installIdentity','rotateKey'] as const)test('held setup rechecks authoritative '+change+' before replacing identity',async()=>{
    const f=bootstrapFixture(),held=f.hold();await Bun.sleep(0);f[change]();held.release();expect((await held.response).status).toBe(403);expect(f.writes()).toBe(0);
  });
  for(const path of ['/api/teacher-clinic','/api/teacher-observation','/api/refresh']){
    for(const expected of [{},{...expectation,'X-Teacher-Actor':'another-actor'},{...expectation,'X-Teacher-Owner':'another-owner'}])test(path+' refuses absent or foreign displayed scope before a write '+JSON.stringify(expected),async()=>{
      const f=fixture(),response=await f.handler(f.request(path,expected));
      expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:'teacher_scene_actor_conflict',originalRetained:false,automaticRetry:false});expect(f.writes()).toBe(0);
    });
    test(path+' compares the displayed scope to current authentication, not submitted authority',async()=>{
      const f=fixture();f.changeActor();const response=await f.handler(f.request(path));expect(response.status).toBe(409);expect(f.writes()).toBe(0);
    });
    test(path+' allows a matching current authenticated scope',async()=>{
      const f=fixture();const response=await f.handler(f.request(path));expect(response.status).toBe(200);expect(f.writes()).toBe(1);
    });
    test(path+' rechecks authentication after asynchronous body intake',async()=>{
      const f=fixture();let release!:(bytes:Uint8Array)=>void;
      const stream=new ReadableStream<Uint8Array>({start(controller){release=bytes=>{controller.enqueue(bytes);controller.close();};}});
      const response=f.handler(f.request(path,expectation,stream));await Bun.sleep(0);f.changeActor();release(new TextEncoder().encode('{}'));
      expect((await response).status).toBe(401);expect(f.writes()).toBe(0);
    });
  }
});
