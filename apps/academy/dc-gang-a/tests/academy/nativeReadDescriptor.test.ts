import {afterEach,beforeEach,describe,expect,spyOn,test} from 'bun:test';
import {TeacherApplication} from '../../src/academy/application';
import type {TeacherStore} from '../../src/academy/ports/teacherStore';
import {signTeacherSession} from '../../src/academy/auth';
import {createTeacherServerHandler,type LoginIdentity,type TeacherServerOptions} from '../../src/academy/server';
import type {NativeReadBuildDescriptor} from '../../src/academy/nativeReadDescriptor';

const origin='https://descriptor.example.invalid',route='/api/native-read-descriptor';
const ownerId='synthetic-descriptor-owner',actorId='synthetic-descriptor-teacher';
const sessionKey='synthetic-descriptor-signing-key',username='synthetic-descriptor-username',passwordHash='synthetic-descriptor-password-hash';
const operationId='aefca1f0-2b48-4da1-932b-f45dc765e681';
const identity=():LoginIdentity=>({actorId,username,passwordHash});
type Authentication=ReturnType<NonNullable<TeacherServerOptions['currentAuthentication']>>;
const forbiddenCalls:string[]=[];
const forbidden=(name:string):never=>{forbiddenCalls.push(name);throw Error('synthetic-private-error-detail');};
let transportSpy:ReturnType<typeof spyOn<typeof globalThis,'fetch'>>;
beforeEach(()=>{
  forbiddenCalls.length=0;
  transportSpy=spyOn(globalThis,'fetch').mockImplementation(Object.assign(
    ()=>forbidden('external transport'),{preconnect:()=>forbidden('external preconnect')},
  ));
});
afterEach(()=>{
  transportSpy.mockRestore();
  expect(forbiddenCalls).toEqual([]);
});

function fixture(options:Partial<Pick<TeacherServerOptions,'identity'|'currentAuthentication'|'buildDescriptor'>>={}){
  const state:Authentication={identity:options.identity===undefined?identity():options.identity,sessionKey};
  let authenticationReads=0;
  const store=new Proxy({}, {get:(_,key)=>forbidden('store.'+String(key))}) as TeacherStore;
  const app=new Proxy(new TeacherApplication(store,ownerId),{get(target,key){
    return key==='ownerId'?target.ownerId:forbidden('application.'+String(key));
  }});
  const handler=createTeacherServerHandler({app,origin,sessionKey,identity:state.identity,invitationDigest:null,
    currentAuthentication:()=>{authenticationReads++;return options.currentAuthentication?options.currentAuthentication():state;},
    saveIdentity:async()=>forbidden('auth writer'),consumeInvitation:async()=>forbidden('invitation writer'),
    passwordRecovery:{claim:async()=>forbidden('recovery claim'),status:async()=>forbidden('recovery status'),complete:async()=>forbidden('recovery writer')},
    refresh:async()=>forbidden('source acquirer'),refreshResult:async()=>forbidden('source result'),
    refreshPending:async()=>forbidden('source pending'),refreshHistory:async()=>forbidden('source history'),
    privateArtifacts:{list:async()=>forbidden('private artifact list'),read:async()=>forbidden('private artifact read')},
    curatedConceptCandidates:{read:()=>forbidden('curated source read')},
    ...(options.buildDescriptor===undefined?{}:{buildDescriptor:options.buildDescriptor}),
  });
  const request=(input:RequestInit&{path?:string;cookie?:string|null;operationId?:string|null}={})=>{
    const {path=route,cookie='dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId),operationId:op=operationId,...init}=input;
    const headers=new Headers(init.headers);
    if(cookie!==null)headers.set('Cookie',cookie);
    if(op!==null)headers.set('X-Native-Metadata-Operation-Id',op);
    if(!headers.has('Origin'))headers.set('Origin',origin);
    return new Request(origin+path,{...init,headers});
  };
  const send=async(req=request())=>{
    const response=await handler(req),text=await response.clone().text();
    expect(Buffer.byteLength(text,'utf8')).toBeLessThanOrEqual(4096);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    const output=text+JSON.stringify([...response.headers]);
    for(const secret of [ownerId,actorId,username,passwordHash,sessionKey,'dc_teacher=','synthetic-private-error-detail'])expect(output).not.toContain(secret);
    expect(forbiddenCalls).toEqual([]);
    return response;
  };
  return {request,send,state,authenticationReads:()=>authenticationReads};
}

test('authenticated descriptor has the exact technical allowlist and explicit unqualified fields',async()=>{
  const f=fixture(),before=Date.now(),response=await f.send(),after=Date.now();
  expect(response.status).toBe(200);
  const value=await response.json();
  expect(value).toEqual({schema:'academy.native-read-descriptor/1',operationId,observedAtUtc:expect.any(String),
    sourceSetSha256:null,serviceInstanceRef:null,principal:{authenticated:true,role:'teacher',ownerBindingMatched:true},
    nativeReadInterface:null,syntheticTestAdmission:null,retentionQualification:'UNVERIFIED'});
  expect(new Date(value.observedAtUtc).toISOString()).toBe(value.observedAtUtc);
  expect(Date.parse(value.observedAtUtc)).toBeGreaterThanOrEqual(before);
  expect(Date.parse(value.observedAtUtc)).toBeLessThanOrEqual(after);
  expect(f.authenticationReads()).toBe(2);
});

describe('existing authentication gates',()=>{
  const tokens:{name:string;cookie:()=>string|null}[]=[
    {name:'absent',cookie:()=>null},
    {name:'expired',cookie:()=>'dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId,Math.floor(Date.now()/1000)-60,1)},
    {name:'wrong owner',cookie:()=>'dc_teacher='+signTeacherSession(sessionKey,'synthetic-other-owner',actorId)},
    {name:'wrong actor',cookie:()=>'dc_teacher='+signTeacherSession(sessionKey,ownerId,'synthetic-other-actor')},
    {name:'wrong key',cookie:()=>'dc_teacher='+signTeacherSession('synthetic-other-key',ownerId,actorId)},
    {name:'tampered',cookie:()=>'dc_teacher=invalid-token'},
    {name:'duplicate',cookie:()=>Array(2).fill('dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId)).join('; ')},
  ];
  for(const row of tokens)test(row.name,async()=>{
    const f=fixture(),response=await f.send(f.request({cookie:row.cookie()}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error:'teacher_authentication_required'});
    expect(f.authenticationReads()).toBe(1);
  });
  test('current identity absent',async()=>{
    const f=fixture({identity:null});
    expect((await f.send()).status).toBe(401);
  });
});

describe('authentication at emission',()=>{
  const changes:[string,(state:Authentication)=>void][]=[
    ['revoked',state=>{state.identity=null;}],
    ['rotated session key',state=>{state.sessionKey='synthetic-rotated-key';}],
    ['changed actor',state=>{state.identity={...identity(),actorId:'synthetic-replacement-actor'};}],
    ['changed username',state=>{state.identity={...identity(),username:'synthetic-replacement-username'};}],
    ['changed password hash',state=>{state.identity={...identity(),passwordHash:'synthetic-replacement-hash'};}],
    ['mutated identity object',state=>{Object.assign(state.identity!,{passwordHash:'synthetic-replacement-hash'});} ],
  ];
  for(const [name,change] of changes)test(name,async()=>{
    const state:Authentication={identity:identity(),sessionKey};let reads=0;
    const f=fixture({currentAuthentication:()=>{if(++reads===2)change(state);return state;}});
    const response=await f.send();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({error:'teacher_authentication_required'});
    expect(reads).toBe(2);
  });
  test('changed current owner',async()=>{
    // Mutate the exact synthetic application binding when the second authentication read occurs.
    let reads=0,currentOwner=ownerId;
    const app=new Proxy({},{get:(_,key)=>key==='ownerId'?currentOwner:forbidden('application.'+String(key))}) as TeacherApplication;
    const handler=createTeacherServerHandler({app,origin,sessionKey,identity:identity(),invitationDigest:null,
      saveIdentity:async()=>forbidden('auth writer'),currentAuthentication:()=>{if(++reads===2)currentOwner='synthetic-other-owner';return {identity:identity(),sessionKey};}});
    const response=await handler(new Request(origin+route,{headers:{Cookie:'dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId),'X-Native-Metadata-Operation-Id':operationId}}));
    expect(response.status).toBe(401);expect(await response.json()).toEqual({error:'teacher_authentication_required'});
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });
  test('session expires before output',async()=>{
    const start=2_000_000_000_000,clock=spyOn(Date,'now').mockReturnValue(start);let reads=0;
    try{
      const f=fixture({currentAuthentication:()=>{if(++reads===2)clock.mockReturnValue(start+1000);return {identity:identity(),sessionKey};}});
      const response=await f.send(f.request({cookie:'dc_teacher='+signTeacherSession(sessionKey,ownerId,actorId,start/1000,1)}));
      expect(response.status).toBe(401);
    }finally{clock.mockRestore();}
  });
  for(const occurrence of [1,2])test('authentication callback failure '+occurrence+' has no error detail',async()=>{
    let reads=0;
    const f=fixture({currentAuthentication:()=>{if(++reads===occurrence)throw Error('synthetic-private-error-detail');return {identity:identity(),sessionKey};}});
    const response=await f.send();expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:'native_dependency_failed',automaticRetry:false,...(occurrence===2?{readResolution:'UNRESOLVED_READ'}:{})});
  });
});

describe('closed request envelope',()=>{
  for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])test('rejects '+method,async()=>{
    const f=fixture();expect((await f.send(f.request({method}))).status).toBe(405);
  });
  test('existing POST origin refusal still applies',async()=>{
    const f=fixture();expect((await f.send(f.request({method:'POST',headers:{Origin:'https://other.example.invalid'}}))).status).toBe(403);
  });
  for(const query of ['?studentId=synthetic-forbidden','?x=1&x=2','?','?&','?%73tudentId=x'])test('rejects query '+query,async()=>{
    const f=fixture();expect((await f.send(f.request({path:route+query}))).status).toBe(400);
  });
  const invalidIds=[null,'','not-a-uuid','00000000-0000-0000-0000-000000000000',operationId.replace('-4da1','-1da1'),operationId.replace('-932b','-732b'),operationId+', '+operationId,'a'.repeat(5000)];
  for(const [i,id] of invalidIds.entries())test('rejects missing/malformed operation ID '+i,async()=>{
    const f=fixture(),response=await f.send(f.request({operationId:id}));
    expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'native_metadata_operation_id_required'});
  });
  test('echoes a caller-generated UUIDv4, including uppercase',async()=>{
    for(const id of [crypto.randomUUID(),operationId.toUpperCase()]){
      const f=fixture(),response=await f.send(f.request({operationId:id,headers:{'Content-Length':'0'}}));
      expect(response.status).toBe(200);expect((await response.json()).operationId).toBe(id);
    }
  });
  test('rejects duplicate operation headers',async()=>{
    const f=fixture(),req=f.request();req.headers.append('X-Native-Metadata-Operation-Id',operationId);
    expect((await f.send(req)).status).toBe(400);
  });
  for(const [name,value] of [['Content-Length','1'],['Content-Length','00'],['Content-Length','invalid'],['Transfer-Encoding','chunked'],['Transfer-Encoding','']])test('rejects body framing '+name+'='+value,async()=>{
    const f=fixture();expect((await f.send(f.request({headers:{[name!]:value!}}))).status).toBe(400);
  });
  test('rejects a supplied GET stream even with Content-Length zero without reading it',async()=>{
    const f=fixture(),req=f.request({headers:{'Content-Length':'0'}});
    const stream=new ReadableStream({pull:()=>forbidden('body stream read')},{highWaterMark:0});
    Object.defineProperty(req,'body',{value:stream});
    expect((await f.send(req)).status).toBe(400);expect(stream.locked).toBe(false);expect(req.bodyUsed).toBe(false);
  });
  test('POST with a body is rejected without parsing or retaining it',async()=>{
    const f=fixture(),req=f.request({method:'POST',body:'synthetic-forbidden-body',headers:{'Content-Type':'application/json'}});
    const parse=spyOn(req,'json').mockImplementation(()=>forbidden('body parse'));
    try{expect((await f.send(req)).status).toBe(405);expect(req.bodyUsed).toBe(false);expect(parse).not.toHaveBeenCalled();}
    finally{parse.mockRestore();}
  });
});

describe('cancellation',()=>{
  test('already aborted request refuses',async()=>{
    const controller=new AbortController();controller.abort();
    const f=fixture(),response=await f.send(f.request({signal:controller.signal}));
    expect(response.status).toBe(499);expect(await response.json()).toEqual({error:'request_aborted'});
    expect(f.authenticationReads()).toBe(1);
  });
  test('abort during output authorization refuses',async()=>{
    const controller=new AbortController();let reads=0;
    const f=fixture({currentAuthentication:()=>{if(++reads===2)controller.abort();return {identity:identity(),sessionKey};}});
    const response=await f.send(f.request({signal:controller.signal}));
    expect(response.status).toBe(499);expect(await response.json()).toEqual({error:'request_aborted'});expect(reads).toBe(2);
  });
});

describe('owner-supplied build metadata',()=>{
  test('maximal admitted metadata stays below the byte cap and cannot qualify a native reader',async()=>{
    const buildDescriptor={sourceSetSha256:'a'.repeat(64),serviceInstanceRef:'S'.repeat(128)},f=fixture({buildDescriptor});
    const response=await f.send(),value=await response.json();
    expect(response.status).toBe(200);expect(value).toMatchObject({...buildDescriptor,nativeReadInterface:null,syntheticTestAdmission:null,retentionQualification:'UNVERIFIED'});
    expect(Buffer.byteLength(JSON.stringify(value),'utf8')).toBeLessThanOrEqual(4096);
  });
  for(const buildDescriptor of [{},{sourceSetSha256:null},{serviceInstanceRef:null},{sourceSetSha256:undefined}])test('missing metadata remains null '+JSON.stringify(buildDescriptor),async()=>{
    const response=await fixture({buildDescriptor}).send();expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({sourceSetSha256:null,serviceInstanceRef:null});
  });
  const invalid:unknown[]=[null,[],true,'metadata',42,{sourceSetSha256:42},{sourceSetSha256:'A'.repeat(64)},
    {sourceSetSha256:'a'.repeat(63)},{sourceSetSha256:'a'.repeat(65)},{serviceInstanceRef:''},{serviceInstanceRef:'S'.repeat(129)},
    {serviceInstanceRef:'x'.repeat(4097)},{serviceInstanceRef:'한글'},{serviceInstanceRef:'/private/synthetic/path'},
    {serviceInstanceRef:'https://synthetic.invalid'},{serviceInstanceRef:'session=synthetic'},{serviceInstanceRef:'synthetic\nsecret'},
    {serviceInstanceRef:{}},{actorId},{nativeReadInterface:'invented'},{syntheticTestAdmission:true},{retentionQualification:'VERIFIED'},
    {sourceSetSha256:'a'.repeat(64),extra:'forbidden'},Object.create({serviceInstanceRef:'inherited'}),{[Symbol('private')]:true}];
  // JavaScript's dollar regex anchor can match before a final line terminator.
  for(const suffix of ['\n','\r','\u2028','\u2029'])invalid.push(
    {sourceSetSha256:'a'.repeat(64)+suffix},{serviceInstanceRef:'synthetic-instance'+suffix},
  );
  for(const [i,buildDescriptor] of invalid.entries())test('rejects invalid/extra metadata '+i,()=>{
    expect(()=>fixture({buildDescriptor:buildDescriptor as NativeReadBuildDescriptor})).toThrow('native_read_build_descriptor_invalid');
  });
  test('accessors and serialization hooks are rejected without invocation',()=>{
    let invoked=0;
    const accessor=Object.defineProperty({},'serviceInstanceRef',{get(){invoked++;return 'forbidden';}});
    const hook={toJSON(){invoked++;return {serviceInstanceRef:'forbidden'};}};
    for(const buildDescriptor of [accessor,hook])expect(()=>fixture({buildDescriptor})).toThrow('native_read_build_descriptor_invalid');
    expect(invoked).toBe(0);
  });
  test('accepted metadata is copied and remains stable after caller mutation',async()=>{
    const buildDescriptor={sourceSetSha256:'a'.repeat(64),serviceInstanceRef:'synthetic-instance-1'},f=fixture({buildDescriptor});
    buildDescriptor.sourceSetSha256='invalid';buildDescriptor.serviceInstanceRef='/private/synthetic/path';
    const response=await f.send();expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({sourceSetSha256:'a'.repeat(64),serviceInstanceRef:'synthetic-instance-1'});
  });
});

test('adjacent public health and protected unknown routes retain existing behavior',async()=>{
  const f=fixture();
  const health=await f.send(f.request({path:'/health',cookie:null}));expect(health.status).toBe(200);
  expect(await health.json()).toEqual({status:'running',studentDisclosure:false});
  expect((await f.send(f.request({path:'/api/unknown',cookie:null}))).status).toBe(401);
  const unknown=await f.send(f.request({path:'/api/unknown'}));expect(unknown.status).toBe(404);
  expect(await unknown.json()).toEqual({error:'unknown_operation'});
});
