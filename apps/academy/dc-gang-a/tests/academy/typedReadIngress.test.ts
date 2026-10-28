import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {foundation,admitted} from './nativePrerequisiteStore.test';
import {context as commandFixture,progress,draft,assessment,closure} from './nativePrerequisiteContracts.test';
import {describe,expect,test} from 'bun:test';
import {signTeacherSession} from '../../src/academy/auth';
import {createTeacherServerHandler,nativePrerequisiteHttpInputs,parseTeacherHttpFields,type TeacherHttpField,type TeacherHttpFields,type TeacherHttpRoute,declaredRefusalStatus,inputRefusals,prerequisiteRefusalStatus,nativePrerequisiteOperations,nativePrereqRouteAliases,type LoginIdentity} from '../../src/academy/server';
import {TeacherApplication} from '../../src/academy/application';
import {ctx,FakePrerequisiteStore,fictionalGrantVerifier,knownK,mapFixtureViews,nativeRef,objectRef,withOutputLabel,registeredRequest,request,testFunctionRequest,TEST_REGISTRY_SHA256,testTemporal,version} from './typedRead.test';
import {TypedReadRefusal,createSnapshotGrantVerifier} from '../../src/academy/nativeTypedRead';
import {r6OwnerFixture} from './nativePrerequisitePort.test';
import {r7RevisionFixture} from './typedReadSnapshot.test';

describe('ORDINARY-R7-F1 real owner in-process revision response',()=>{
  for(const control of ['revision','expired','retired','unchanged','policy'] as const)test(control+' cookie response and audit',async()=>{
    const now=Date.parse('2026-10-25T09:00:00.000Z'),clock=Date.now,encode=TextEncoder.prototype.encode;
    const f=await r7RevisionFixture(control),encoded:Uint8Array<ArrayBuffer>[]=[];
    const signed='dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,Math.floor(now/1000),1);
    const handler=createTeacherServerHandler({app:{ownerId:OWNER} as unknown as TeacherApplication,origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
      saveIdentity:async()=>{throw Error('no auth writer');},curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never,
      typedRead:{store:f.store,processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,
        snapshotGrantVerifier:createSnapshotGrantVerifier(f.secret,{ownerId:OWNER,processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256}),
        outputLease:async use=>{f.state.leaseHeld=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{f.state.leaseHeld=false;}}},
    });
    Date.now=()=>f.state.sessionActive?now:now+2000;
    TextEncoder.prototype.encode=function(input?:string){const bytes=encode.call(this,input);if(f.state.triggered&&input?.startsWith('{"kind":"ERROR"')){expect(f.state.leaseHeld&&f.state.gateHeld).toBe(true);expect(f.state.commitKnown).toBe(false);expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)?.status).toBe('PENDING');encoded.push(bytes);}return bytes;};
    let response:Response;
    try{response=await handler(post(f.input,{cookie:signed}));}finally{Date.now=clock;TextEncoder.prototype.encode=encode;}
    const code=control==='expired'||control==='retired'||control==='policy'?'PERMISSION_DENIED':control==='unchanged'?'CONTRACT_UNVERIFIABLE':'REVISION_STALE';
    expect(f.state.callbackReady&&f.state.triggered&&f.state.commitKnown).toBe(true);expect(f.state.transactions).toBe(2);expect(f.state.ownerCalls).toBe(1);expect(f.state.leaseHeld).toBe(false);
    expect(f.correction.count).toBe(control==='unchanged'||control==='policy'?0:1);expect(f.state.sessionActive).toBe(control!=='expired');
    expect((await f.store.teacherBindingByActor(ctx.ownerId,ctx.actorId))?.payload.state).toBe(control==='retired'?'RETIRED':'ACTIVE');
    expect(response!.status).toBe(control==='expired'?401:control==='retired'||control==='policy'?403:409);expect(encoded.length).toBeGreaterThan(0);
    const prepared=JSON.parse(new TextDecoder().decode(encoded.at(-1)!));expect(prepared.error.code).toBe(code);expect(prepared.items).toBeUndefined();expect(prepared.nextCursor).toBeUndefined();
    if(control==='expired')expect(await response!.json()).toEqual({error:'teacher_authentication_required'});
    else expect(new Uint8Array(await response!.arrayBuffer())).toEqual(encoded.at(-1)!);
    expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:code,snapshot_digest:null});
    expect(f.sql.queries.filter(q=>q.text.startsWith('UPDATE academy.read_occurrences'))).toHaveLength(1);
  });
});

describe('ORDINARY-R6-F1 real owner and in-process cookie handler',()=>{
  for(const phase of ['late-binding','late-horizon','cleanup','cleanup-expiry'] as const){
    for(const expire of [false,true])test(phase+' '+(expire?'cookie expires':'active cookie'),async()=>{
      let now=Date.parse('2026-10-25T09:00:00.000Z');const clock=Date.now,encode=TextEncoder.prototype.encode;
      const f=await r6OwnerFixture(phase,expire),encoded:Uint8Array<ArrayBuffer>[]=[];
      const signed='dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,Math.floor(now/1000),1);
      const handler=createTeacherServerHandler({app:{ownerId:OWNER} as unknown as TeacherApplication,origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
        saveIdentity:async()=>{throw Error('no auth writer');},curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never,
        typedRead:{store:f.store,processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,
          snapshotGrantVerifier:createSnapshotGrantVerifier(f.secret,{ownerId:OWNER,processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256}),
          outputLease:async use=>{f.state.leaseHeld=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{f.state.leaseHeld=false;}}},
      });
      Date.now=()=>f.state.sessionActive?now:now+2000;
      TextEncoder.prototype.encode=function(input?:string){const bytes=encode.call(this,input);if(f.state.triggered&&input?.startsWith('{"kind":"ERROR"')){expect(f.state.leaseHeld&&f.state.gateHeld).toBe(true);expect(f.state.commitKnown).toBe(false);encoded.push(bytes);}return bytes;};
      let response:Response;
      try{response=await handler(post(f.input,{cookie:signed}));}finally{Date.now=clock;TextEncoder.prototype.encode=encode;}
      const code=expire?'PERMISSION_DENIED':'CONTRACT_UNVERIFIABLE';
      expect(f.state.triggered&&f.state.commitKnown).toBe(true);expect(f.state.ownerCalls).toBe(1);expect(f.state.leaseHeld).toBe(false);
      expect(response!.status).toBe(expire?401:409);expect(encoded.length).toBeGreaterThan(0);
      const prepared=JSON.parse(new TextDecoder().decode(encoded.at(-1)!));expect(prepared.error.code).toBe(code);expect(prepared.items).toBeUndefined();expect(prepared.nextCursor).toBeUndefined();
      if(expire)expect(await response!.json()).toEqual({error:'teacher_authentication_required'});
      else expect(new Uint8Array(await response!.arrayBuffer())).toEqual(encoded.at(-1)!);
      expect(f.sql.rows('read_occurrences').find(r=>r.request_id===f.input.requestId)).toMatchObject({status:'REFUSED',refusal_code:code,snapshot_digest:null});
    });
  }
});

/* IG-3 Q/source evidence only: handler invoked in-process via Request/Response.
 * No listen, DB, real auth store or network. Principal comes solely from the
 * existing dc_teacher session cookie; header/body teacher claims are ignored. */
const ORIGIN='https://typed-read.example.invalid',OWNER='synthetic-owner',ACTOR='synthetic-actor';
const SESSION_KEY='synthetic-signing-key';
const identity:LoginIdentity={actorId:ACTOR,username:'synthetic-username',passwordHash:'synthetic-password-hash'};
const cookie=()=>'dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR);

function makeHandler(opts:{store?:FakePrerequisiteStore;typedRead?:boolean;currentAuthentication?:()=>{identity:LoginIdentity|null;sessionKey:string};outputLease?:(<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>)=>Promise<T>)|null;verifier?:'fictional'|'real'}={}){
  const store=opts.store??new FakePrerequisiteStore();
  const passthroughLease=async<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>):Promise<T>=>use({sessionKey:SESSION_KEY,identity});
  const lease=Object.hasOwn(opts,'outputLease')?(opts.outputLease??undefined):passthroughLease;
  const handler=createTeacherServerHandler({
    app:{ownerId:OWNER} as unknown as TeacherApplication,origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
    saveIdentity:async()=>{throw Error('auth writer must not run');},
    curatedConceptCandidates:{read:()=>{throw Error('unused in typed-read tests');}} as never,
    ...(opts.currentAuthentication?{currentAuthentication:opts.currentAuthentication}:{}),
    ...(opts.typedRead===false?{}:{typedRead:{store:store.asStore(),processEpoch:'epoch-1',registrySha256:TEST_REGISTRY_SHA256,...(opts.verifier==='real'?{}:{snapshotGrantVerifier:fictionalGrantVerifier,now:()=>Date.parse('2026-10-24T00:00:00.000Z')}),...(lease?{outputLease:lease}:{})}}),
  });
  return {handler,store};
}
function post(body:unknown,opts:{cookie?:string|null;headers?:Record<string,string>;path?:string;method?:string;rawBody?:string}={}){
  const headers=new Headers({Origin:ORIGIN,'Content-Type':'application/json',...(opts.headers??{})});
  const c=opts.cookie===undefined?cookie():opts.cookie;
  if(c!==null)headers.set('Cookie',c);
  return new Request(ORIGIN+(opts.path??'/api/typed-read'),{method:opts.method??'POST',headers,body:opts.rawBody??JSON.stringify(body)});
}

test('valid session cookie admits typed read in-process; no cookie is set by the reply',async()=>{
  const {handler,store}=makeHandler();
  const res=await handler(post(request({pageSize:100})));
  expect(res.status).toBe(200);expect(res.headers.get('Set-Cookie')).toBeNull();
  const body=await res.json();
  expect(body.kind).toBe('OK');expect(body.items.length).toBeGreaterThan(0);
  expect([...store.admissions.values()][0]?.actorId).toBe(ACTOR);
});

describe('missing, expired and wrong-principal cookies refuse 401 before projection',()=>{
  const now=Math.floor(Date.now()/1000);
  const cases:[string,string|null][]=[
    ['absent',null],['expired','dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,now-7200,3600)],
    ['wrong owner','dc_teacher='+signTeacherSession(SESSION_KEY,'synthetic-other-owner',ACTOR)],
    ['wrong actor','dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,'synthetic-other-actor')],
    ['wrong key','dc_teacher='+signTeacherSession('synthetic-other-key',OWNER,ACTOR)],
    ['tampered','dc_teacher=invalid-token'],
  ];
  for(const [name,c] of cases)test(name,async()=>{
    const {handler,store}=makeHandler();
    const res=await handler(post(request(),{cookie:c}));
    expect(res.status).toBe(401);expect(await res.json()).toEqual({error:'teacher_authentication_required'});
    expect(store.admissions.size).toBe(0);expect(store.projectionCalls).toBe(0);
  });
});

describe('fake/header teacher claims are ignored',()=>{
  test('header claims without a cookie still refuse 401',async()=>{
    const {handler,store}=makeHandler();
    const res=await handler(post(request(),{cookie:null,headers:{'X-Teacher-Id':'teacher-a','X-Actor-Id':ACTOR,'X-Owner-Id':OWNER}}));
    expect(res.status).toBe(401);expect(store.admissions.size).toBe(0);
  });
  test('header claims naming another actor do not change the cookie principal',async()=>{
    const {handler,store}=makeHandler();
    const res=await handler(post(request(),{headers:{'X-Teacher-Id':'attacker','X-Actor-Id':'synthetic-attacker'}}));
    expect(res.status).toBe(200);
    expect([...store.admissions.values()][0]?.actorId).toBe(ACTOR);
    expect(ctx.actorId).toBe(ACTOR);
  });
  test('teacher claims inside the closed body refuse as INVALID_REQUEST, never as identity',async()=>{
    const {handler,store}=makeHandler();
    const res=await handler(post({...request(),actorId:'synthetic-attacker',teacherId:'teacher-a'}));
    expect(res.status).toBe(400);
    const body=await res.json();
    expect(body.kind).toBe('ERROR');expect(body.error.code).toBe('INVALID_REQUEST');expect(body.error.retryable).toBe(false);
    expect(store.projectionCalls).toBe(0);
  });
});

describe('closed ingress envelope',()=>{
  test('GET, query scope, malformed JSON and unconfigured typed read refuse without projection',async()=>{
    const {handler,store}=makeHandler();
    expect((await handler(post(request(),{method:'GET'}))).status).toBe(405);
    expect((await handler(post(request(),{path:'/api/typed-read?studentId=x'}))).status).toBe(400);
    const bad=await handler(post(null,{rawBody:'{not json'}));
    expect(bad.status).toBe(400);expect((await bad.json()).error).toBe('INVALID_REQUEST');
    expect(store.projectionCalls).toBe(0);
    const unconfigured=makeHandler({typedRead:false});
    const res=await unconfigured.handler(post(request()));
    expect(res.status).toBe(503);expect((await res.json()).error).toBe('typed_read_unavailable');
  });
  test('descriptor route on the same handler carries zero business payload fields',async()=>{
    const {handler}=makeHandler();
    const req=new Request(ORIGIN+'/api/native-read-descriptor',{headers:{Cookie:cookie(),Origin:ORIGIN,'X-Native-Metadata-Operation-Id':'aefca1f0-2b48-4da1-932b-f45dc765e681'}});
    const res=await handler(req);expect(res.status).toBe(200);
    const body=await res.json();
    expect(Object.keys(body).sort()).toEqual(['nativeReadInterface','observedAtUtc','operationId','principal','retentionQualification','schema','serviceInstanceRef','sourceSetSha256','syntheticTestAdmission'].sort());
    expect(body.nativeReadInterface).toBeNull();
    expect(JSON.stringify(body)).not.toContain('displayName');expect(JSON.stringify(body)).not.toContain('Invented');
  });
});

describe('grammar and wire normalization (IG3-REV-07/08)',()=>{
  test('nested invalid public grammar returns INVALID_REQUEST 400, never 503',async()=>{
    const {handler,store}=makeHandler();
    const cases=[
      {...request(),temporalSelection:{...testTemporal(),businessDate:'not-a-date'}},
      {...request(),snapshot:{...request().snapshot,unexpected:'field'}},
      registeredRequest('Student'),
    ];
    // Extra selector claim is a closed-grammar failure.
    const extraSelector=request();(extraSelector.selector as unknown as Record<string,unknown>).query={baseType:'ALL',teacherId:'fictional-claim'};
    cases[2]=extraSelector;
    for(const body of cases){
      const res=await handler(post(body));
      expect(res.status).toBe(400);
      const parsed=await res.json();
      expect(parsed.kind).toBe('ERROR');expect(parsed.error.code).toBe('INVALID_REQUEST');
    }
    expect(store.projectionCalls).toBe(0);
    // The old string-baseType dialect is grammar, not the pinned contract.
    const oldDialect=await handler(post({...request(),selector:{kind:'REGISTERED_QUERY',query:{baseType:'ALL'}}}));
    expect(oldDialect.status).toBe(400);
    // A well-formed but unregistered plan fails as CONTRACT_UNVERIFIABLE.
    const unsupported=await handler(post(registeredRequest('Teacher',{temporalSelection:testTemporal({functionName:'ListClassDailyStatus',studentRef:null,occurrence:{mode:'ENUMERATE_SEPARATELY'}})})));
    expect(unsupported.status).toBe(409);
    expect((await unsupported.json()).error.code).toBe('CONTRACT_UNVERIFIABLE');
  });
});

describe('revocation',()=>{
  test('binding revocation at output refuses 403 PERMISSION_DENIED with no business payload',async()=>{
    const {handler,store}=makeHandler();
    const original=store.readSnapshot.bind(store);
    store.readSnapshot=(async(read:any)=>{const reply=await original(read);store.binding=version('teacher-a','rev-teacher-2',{...store.binding!.payload,state:'RETIRED' as const,assignmentState:knownK('INACTIVE' as const)});return reply;}) as typeof store.readSnapshot;
    const res=await handler(post(request()));
    expect(res.status).toBe(403);
    const body=await res.json();
    expect(body.kind).toBe('ERROR');expect(body.error.code).toBe('PERMISSION_DENIED');
    expect(body.items).toBeUndefined();
    expect(store.finalizations.at(-1)).toMatchObject({status:'REFUSED'});
  });
  test('session revocation at emission refuses 401 even after a successful projection',async()=>{
    let reads=0;
    const {handler,store}=makeHandler({currentAuthentication:()=>{reads++;return reads>=3?{identity:null,sessionKey:SESSION_KEY}:{identity,sessionKey:SESSION_KEY};}});
    const res=await handler(post(request()));
    expect(res.status).toBe(401);expect(await res.json()).toEqual({error:'teacher_authentication_required'});
    expect(store.admissions.size).toBe(1); // projection ran; emission gate still refused
  });
});

describe('auth output lease handoff (C4/W2)',()=>{
  test('lease is held across the awaited output commit and released before the reply',async()=>{
    const events:string[]=[];
    const lease=async<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>):Promise<T>=>{
      events.push('lease-acquire');
      try{return await use({sessionKey:SESSION_KEY,identity});}finally{events.push('lease-release');}
    };
    const {handler,store}=makeHandler({outputLease:lease});
    const originalCommit=store.commitReadOutput.bind(store);
    store.commitReadOutput=(async(r:never,prepare:never)=>{events.push('commit');return originalCommit(r,prepare);}) as typeof store.commitReadOutput;
    const res=await handler(post(request()));
    expect(res.status).toBe(200);
    expect(events).toEqual(['lease-acquire','commit','lease-release']);
    expect(store.directFinalizeCalls).toBe(0);
  });
  test('leased state naming another key or actor suppresses egress as 401 with no payload',async()=>{
    const lease=async<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>):Promise<T>=>use({sessionKey:'synthetic-other-key',identity});
    const {handler}=makeHandler({outputLease:lease});
    const res=await handler(post(request()));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({error:'teacher_authentication_required'});
  });
  test('busy lease fails closed as READ_UNRESOLVED 503 with no payload',async()=>{
    const lease=async<T>(_use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>):Promise<T>=>{throw Error('private_auth_lock_required');};
    const {handler,store}=makeHandler({outputLease:lease});
    const res=await handler(post(request()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('READ_UNRESOLVED');
    expect(store.commitCalls).toBe(0);
  });
});

describe('authenticated prerequisite wrapper (IG3-REV-09)',()=>{
  type Call={method:string;actor:string;input:unknown};
  function fakeApp(calls:Call[],overrides:Record<string,(context:unknown,input:unknown)=>unknown>={}){
    const app:Record<string,unknown>={ownerId:OWNER};
    for(const method of nativePrerequisiteOperations){
      app[method]=overrides[method]??(async(context:{actorId:string},input:unknown)=>{calls.push({method,actor:context.actorId,input});return {operation:method,status:'saved'};});
    }
    return app as unknown as TeacherApplication;
  }
  function prerequisiteHandler(calls:Call[],overrides:Record<string,(context:unknown,input:unknown)=>unknown>={},currentAuthentication?:()=>{identity:LoginIdentity|null;sessionKey:string}){
    return createTeacherServerHandler({
      app:fakeApp(calls,overrides),origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
      saveIdentity:async()=>{throw Error('auth writer must not run');},
      curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never,
      ...(currentAuthentication?{currentAuthentication}:{}),
    });
  }
  function prereq(operation:string,input:unknown,opts:{cookie?:string|null;headers?:Record<string,string>;path?:string;origin?:string}={}){
    const headers=new Headers({Origin:opts.origin??ORIGIN,'Content-Type':'application/json',...(opts.headers??{})});
    const c=opts.cookie===undefined?cookie():opts.cookie;
    if(c!==null)headers.set('Cookie',c);
    return new Request(ORIGIN+(opts.path??'/api/native-prerequisite'),{method:'POST',headers,body:JSON.stringify({operation,input})});
  }
  const sampleInput=(operation:string):unknown=>httpSchemaInput(nativePrerequisiteHttpInputs[operation as keyof typeof nativePrerequisiteHttpInputs]);
  test('all 44 closed operations dispatch to the facade with the cookie principal only',async()=>{
    expect(nativePrerequisiteOperations).toHaveLength(44);
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    for(const operation of nativePrerequisiteOperations){
      const res=await handler(prereq(operation,sampleInput(operation),{headers:{'X-Actor-Id':'synthetic-attacker'}}));
      expect(res.status).toBe(200);
      expect((await res.json()).operation).toBe(operation);
    }
    expect(calls.map(c=>c.method)).toEqual([...nativePrerequisiteOperations]);
    expect(calls.every(c=>c.actor===ACTOR)).toBe(true);
  });
  test('unknown, reflected and non-facade operations refuse 400 without dispatch',async()=>{
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    for(const operation of ['cohort','constructor','__proto__','bindTeacher2','']){
      const res=await handler(prereq(operation,{}));
      expect(res.status).toBe(400);
    }
    expect(calls).toHaveLength(0);
  });
  test('missing, expired and foreign cookies refuse 401; origin gate refuses 403; no dispatch',async()=>{
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    const now=Math.floor(Date.now()/1000);
    for(const c of [null,'dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,now-7200,3600),'dc_teacher='+signTeacherSession(SESSION_KEY,'synthetic-other-owner',ACTOR),'dc_teacher='+signTeacherSession('other-key',OWNER,ACTOR)]){
      expect((await handler(prereq('prerequisiteTeachers',{},{cookie:c}))).status).toBe(401);
    }
    expect((await handler(prereq('prerequisiteTeachers',{},{origin:'https://evil.example.invalid'}))).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  test('first self BindTeacher dispatches without a prior binding while gated reads keep facade refusal',async()=>{
    const calls:Call[]=[];
    const handler=prerequisiteHandler(calls,{
      prerequisiteTeachers:async()=>{throw Error('teacher_binding_required');},
    });
    const bound=await handler(prereq('bindTeacher',{...sampleInput('bindTeacher') as object,payload:{actorId:ACTOR}}));
    expect(bound.status).toBe(200);expect(calls.map(c=>c.method)).toEqual(['bindTeacher']);
    const gated=await handler(prereq('prerequisiteTeachers',{}));
    expect(gated.status).toBe(403);expect((await gated.json()).error).toBe('teacher_binding_required');
    const uncertain=prerequisiteHandler([],{updateTeacher:async()=>{throw Error('committed_outcome_uncertain');}});
    const res=await uncertain(prereq('updateTeacher',sampleInput('updateTeacher')));
    expect(res.status).toBe(503);const body=await res.json();
    expect(body.automaticRetry).toBe(false);expect(body.readOriginalRequestBeforeNewIntent).toBe(true);
  });
  test('W12-F1 fence: ordinary transport cannot mark a read COMPLETED; REFUSED cleanup still dispatches',async()=>{
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    const admission={ownerId:OWNER,actorId:ACTOR,requestId:'req-fence',runId:'req-fence',requestDigest:'a'.repeat(64),selectorDigest:'b'.repeat(64),processEpoch:'epoch-1',registryContractVersion:'1.1.0',consumerProfile:'CURRENT_1_1',consumerProfileDigest:'223dbc1a1517671bcf8b1bdf77072ae6f9fb7d0c1858f7976ab2ebe4166e560e'};
    const forged=await handler(prereq('finalizeReadOccurrence',{request:admission,status:'COMPLETED',snapshotDigest:'c'.repeat(64),refusalCode:null}));
    expect(forged.status).toBe(403);
    expect((await forged.json()).error).toBe('read_completion_owner_witness_required');
    expect(calls).toHaveLength(0);
    const refused=await handler(prereq('finalizeReadOccurrence',{request:admission,status:'REFUSED',snapshotDigest:null,refusalCode:'PERMISSION_DENIED'}));
    expect(refused.status).toBe(200);
    expect(calls.map(c=>c.method)).toEqual(['finalizeReadOccurrence']);
  });
  test('RC4: exactly 17 named aliases dispatch their operation; teachers/update stays outside the 17',async()=>{
    const entries=Object.entries(nativePrereqRouteAliases);
    expect(entries).toHaveLength(17);
    expect(Object.keys(nativePrereqRouteAliases)).not.toContain('/api/native-prereq/teachers/update');
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    for(const [path,operation] of entries){
      const res=await handler(new Request(ORIGIN+path,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify(sampleInput(operation))}));
      expect(res.status).toBe(200);
    }
    expect(calls.map(c=>c.method)).toEqual(entries.map(([,operation])=>operation));
    expect(calls.every(c=>c.actor===ACTOR)).toBe(true);
    const unknown=await handler(new Request(ORIGIN+'/api/native-prereq/bogus-alias',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify({})}));
    expect(unknown.status).toBe(400);
    expect(calls).toHaveLength(17);
  });
  test('RC5: named aliases share the generic 512 KiB body limit; stale source revisions are 409 conflicts',async()=>{
    const path='/api/native-prereq/progress';
    expect(nativePrereqRouteAliases[path]).toBe('createProgress');
    const post=(body:string)=>new Request(ORIGIN+path,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body});
    const calls:Call[]=[];const handler=prerequisiteHandler(calls,{createProgress:()=>{throw Error('stale_source_revision');}});
    const stale=await handler(post(JSON.stringify(sampleInput('createProgress'))));
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toBe('stale_source_revision');
    // Body rejections share one public error; the closed rejection code says which limit applied.
    const rejected=async(bytes:number):Promise<{status:number;codes:string[]}>=>{
      const codes:string[]=[],original=console.error;
      console.error=(line:unknown)=>{try{const v=JSON.parse(String(line));if(v.status==='NATIVE_PREREQUISITE_INPUT_REJECTED')codes.push(v.code);}catch{}};
      try{return {status:(await handler(post(JSON.stringify({pad:'x'.repeat(bytes)})))).status,codes};}finally{console.error=original;}
    };
    expect((await rejected(30_000)).codes).not.toContain('input_too_large');
    expect(await rejected(530_000)).toEqual({status:400,codes:['input_too_large']});
  });
  test('RC6: refusal statuses declared by the activity-scope action contract reach HTTP unchanged',async()=>{
    expect(Object.fromEntries(declaredRefusalStatus)).toMatchObject({activity_scope_terminal:409,activity_scope_terminal_payload_changed:409,activity_scope_action_version:409,stale_base:409,invalid_activity_scope:400});
    for(const [code,status] of [...declaredRefusalStatus,...[...inputRefusals].map(code=>[code,400] as const)]){
      const calls:Call[]=[];const handler=prerequisiteHandler(calls,{attachActivityScope:()=>{throw Error(code);}});
      const res=await handler(new Request(ORIGIN+'/api/native-prereq/activity-scopes',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify(sampleInput('attachActivityScope'))}));
      expect([code,res.status]).toEqual([code,status]);
      expect((await res.json()).error).toBe(code);
    }
  });
  test('RC7: every refusal code the prerequisite store, application and contract validators throw has a deliberate HTTP class',()=>{
    const unclassified:string[]=[];
    // Domain validators reached by prerequisite calls. Authentication dependencies
    // have a separate real-handler sweep below; legacy-only imports are not inputs.
    for(const file of ['academy/nativePrerequisiteStore.ts','academy/prerequisiteApplication.ts','academy/contracts/prerequisiteRecords.ts','academy/contracts/storageRecords.ts','academy/contracts/teacherOperations.ts','academy/domain.ts','academy/records.ts','academy/nativeCompleteness.ts','academy/usecases/requestRecovery.ts','learning/model.ts']){
      for(const [,,code] of readFileSync(new URL('../../src/'+file,import.meta.url),'utf8').matchAll(/Error\((['"])([^'"`$]{3,100})\1\)/g))if(prerequisiteRefusalStatus(code!)===null)unclassified.push(file+':'+code);
    }
    expect([...new Set(unclassified)]).toEqual([]);
  });
  test('RC8: identity changes are 409, invalid timezones 400, internal integrity failures stay 503',async()=>{
    const status=async(code:string)=>{const calls:Call[]=[];const handler=prerequisiteHandler(calls,{createProgress:()=>{throw Error(code);}});
      return (await handler(new Request(ORIGIN+'/api/native-prereq/progress',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify(sampleInput('createProgress'))}))).status;};
    for(const code of ['teacher_identity_changed','lesson_identity_changed','binding_identity_changed','progress_identity_changed','assessment_identity_changed'])expect([code,await status(code)]).toEqual([code,409]);
    expect(await status('invalid_business_timezone')).toBe(400);
    expect(await status('invalid timestamp with timezone')).toBe(400);
    expect(await status('invalid calendar date')).toBe(400);
    expect(await status('stored_revision_integrity')).toBe(503);
  });
  test('closed teachers/update alias dispatches update and retire by payload state',async()=>{
    const calls:Call[]=[];const handler=prerequisiteHandler(calls);
    const update=await handler(new Request(ORIGIN+'/api/native-prereq/teachers/update',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify({...sampleInput('updateTeacher') as object,payload:{state:'ACTIVE'}})}));
    expect(update.status).toBe(200);
    const retire=await handler(new Request(ORIGIN+'/api/native-prereq/teachers/update',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify({...sampleInput('retireTeacher') as object,payload:{state:'RETIRED'}})}));
    expect(retire.status).toBe(200);
    expect(calls.map(c=>c.method)).toEqual(['updateTeacher','retireTeacher']);
    expect((await handler(new Request(ORIGIN+'/api/native-prereq/teachers/update',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({})}))).status).toBe(401);
  });
});

describe('NG-A lease ingress and snapshot acquisition (W3-E2/E3, SC1)',()=>{
  test('configured handler without the mandatory output lease refuses OUTPUT_ADMISSION_BLOCKED (W3-E2)',async()=>{
    const {handler,store}=makeHandler({outputLease:null});
    const res=await handler(post(request()));
    expect(res.status).toBe(409);
    const body=await res.json();
    expect(body.error.code).toBe('OUTPUT_ADMISSION_BLOCKED');expect(body.items).toBeUndefined();
    expect(store.commitCalls).toBe(0);expect(store.admissions.size).toBe(0);
  });
  test('buffered Response is prepared while the lease is held (W3-E3)',async()=>{
    const {handler}=makeHandler();let held=false,heldAtResponse:boolean|undefined;const RealResponse=globalThis.Response;
    const lease=async<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>):Promise<T>=>{held=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{held=false;}};
    const probed=makeHandler({outputLease:lease});
    globalThis.Response=class extends RealResponse{constructor(body?:BodyInit|null,init?:ResponseInit){heldAtResponse=held;super(body,init);}} as typeof Response;
    let status:number;
    try{status=(await probed.handler(post(request()))).status;}finally{globalThis.Response=RealResponse;}
    expect(status).toBe(200);expect(heldAtResponse).toBe(true);
    void handler;
  });
  test('snapshot acquisition over HTTP: CURRENT, HISTORICAL, and grant round-trip (SC1)',async()=>{
    const {handler,store}=makeHandler({verifier:'real'});
    const acquireBody={schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'acquire-http-1',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(testTemporal())};
    const acquiredRes=await handler(post(acquireBody,{path:'/api/native-read-snapshot'}));
    expect(acquiredRes.status).toBe(200);
    const acquired=await acquiredRes.json();
    expect(acquired.schema).toBe('native-read-acquire-result.v2');
    expect(acquired.snapshot.registryVersion).toBe('1.1.0');
    expect(acquired.items).toBeUndefined();
    const readRes=await handler(post(request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:acquired.snapshotAdmission})));
    expect(readRes.status).toBe(200);
    expect((await readRes.json()).kind).toBe('OK');
    const histRes=await handler(post({...acquireBody,requestId:'acquire-http-hist',time:{mode:'HISTORICAL',asOf:'2026-10-24T00:00:00.000Z'}},{path:'/api/native-read-snapshot'}));
    expect(histRes.status).toBe(409);
    expect((await histRes.json()).error.code).toBe('SNAPSHOT_UNAVAILABLE');
    const forgedProof=acquired.snapshotAdmission.proof.slice(0,-1)+(acquired.snapshotAdmission.proof.endsWith('A')?'B':'A');
    const forgedRes=await handler(post(request({snapshot:acquired.snapshot,asOf:acquired.snapshot.asOf,snapshotAdmission:{...acquired.snapshotAdmission,proof:forgedProof}})));
    expect(forgedRes.status).toBe(409);
    expect((await forgedRes.json()).error.code).toBe('OBJECTSET_CURSOR_STALE');
    expect((await handler(post(acquireBody,{path:'/api/native-read-snapshot',cookie:null}))).status).toBe(401);
    void store;
  });
});


describe('F2 prepared wire bytes under both output fences',()=>{
  test('serialization/encoding precede terminal commit under both fences; handoff uses the exact bytes with no await or reserialization',async()=>{
    let leaseHeld=false,gateHeld=false,committed=false,afterExpiryMicrotask=false;
    let encoded:Uint8Array<ArrayBuffer>|undefined,responseBody:BodyInit|null|undefined;
    const events:string[]=[],RealResponse=globalThis.Response,encode=TextEncoder.prototype.encode;
    const lease=async<T>(use:(s:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>)=>{
      leaseHeld=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{events.push('lease-release');leaseHeld=false;}
    };
    const {handler,store}=makeHandler({outputLease:lease,currentAuthentication:()=>{
      if(committed){events.push('expiry-check');queueMicrotask(()=>{afterExpiryMicrotask=true;});}
      return {sessionKey:SESSION_KEY,identity};
    }});
    const commit=store.commitReadOutput.bind(store),req=post(request());
    store.commitReadOutput=async(r,prepare)=>{
      const result=await commit(r,async view=>{gateHeld=true;try{return await prepare(view);}finally{gateHeld=false;}});
      expect(store.finalizations.at(-1)?.status).toBe('COMPLETED');events.push('commit-known');committed=true;
      // The DTO is no longer the wire source once final bytes are prepared.
      if(result.value)Object.defineProperty(result.value,'toJSON',{value:()=>{throw Error('post-commit reserialization');}});
      return result;
    };
    TextEncoder.prototype.encode=function(input?:string){
      const body=encode.call(this,input);
      if(input?.startsWith('{"kind":"OK","contractVersion":"3.0.0"')){
        expect(leaseHeld).toBe(true);expect(gateHeld).toBe(true);expect(committed).toBe(false);
        expect(store.finalizations).toEqual([]);events.push('encode');encoded=body;
      }
      return body;
    };
    globalThis.Response=class extends RealResponse{constructor(body?:BodyInit|null,init?:ResponseInit){
      expect(leaseHeld).toBe(true);expect(gateHeld).toBe(false);expect(committed).toBe(true);expect(afterExpiryMicrotask).toBe(false);
      responseBody=body;events.push('response');super(body,init);
    }} as typeof Response;
    let res:Response;
    try{res=await handler(req);}finally{TextEncoder.prototype.encode=encode;globalThis.Response=RealResponse;}
    expect(responseBody).toBe(encoded);expect(encoded).toBeDefined();expect(res!.status).toBe(200);
    expect(new Uint8Array(await res!.arrayBuffer())).toEqual(encoded!);
    expect(events).toEqual(['encode','commit-known','expiry-check','response','lease-release']);
    expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
  });
  test('known business refusal is encoded in the owner gate before its terminal audit',async()=>{
    const {handler,store}=makeHandler(),commit=store.commitReadOutput.bind(store),read=store.readSnapshot.bind(store);
    let inGate=false,encoded=false;const encode=TextEncoder.prototype.encode;
    store.readSnapshot=async cb=>{const result=await read(cb);store.binding=null;return result;};
    store.commitReadOutput=async(r,prepare)=>commit(r,async view=>{inGate=true;try{return await prepare(view);}finally{inGate=false;}});
    const req=post(request());
    TextEncoder.prototype.encode=function(input?:string){
      if(input?.startsWith('{"kind":"ERROR"')){expect(inGate).toBe(true);expect(store.finalizations).toEqual([]);encoded=true;}
      return encode.call(this,input);
    };
    let res:Response;
    try{res=await handler(req);}finally{TextEncoder.prototype.encode=encode;}
    expect(encoded).toBe(true);expect(res!.status).toBe(403);
    expect((await res!.json()).error.code).toBe('PERMISSION_DENIED');
    expect(store.finalizations.map(x=>x.status)).toEqual(['REFUSED']);
  });
  test('a large fictional multibyte output refuses before COMPLETED even though request ingress is small',async()=>{
    const {handler,store}=makeHandler();withOutputLabel(store,{text:'가'.repeat(360000)});
    const req=post(registeredRequest('Student',{linkMask:[]}));
    expect(Number(req.headers.get('Content-Length')??0)).toBeLessThan(65536);
    const res=await handler(req);expect(res.status).toBe(409);
    const body=await res.json();expect(body.error.code).toBe('OUTPUT_ADMISSION_BLOCKED');expect(body.items).toBeUndefined();
    expect(store.finalizations.map(x=>x.status)).toEqual(['REFUSED']);
  });
  test('UNKNOWN commit emits only unresolved metadata and never a prepared business page',async()=>{
    const {handler,store}=makeHandler();store.commitTerminal='UNKNOWN';
    const res=await handler(post(request()));expect(res.status).toBe(503);
    const body=await res.json();expect(body.error.code).toBe('READ_UNRESOLVED');expect(body.items).toBeUndefined();
    expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);expect(store.finalizations).toEqual([]);
  });
  for(const phase of ['during-encode','after-commit'] as const)test('actual expiry '+phase+' suppresses prepared output without replay',async()=>{
    let now=Date.parse('2026-10-25T07:00:00.000Z');const clock=Date.now,encode=TextEncoder.prototype.encode;
    Date.now=()=>now;
    const {handler,store}=makeHandler(),commit=store.commitReadOutput.bind(store);
    const req=post(request(),{cookie:'dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,Math.floor(now/1000),1)});
    if(phase==='after-commit')store.commitReadOutput=async(r,prepare)=>{const result=await commit(r,prepare);now+=2000;return result;};
    TextEncoder.prototype.encode=function(input?:string){const b=encode.call(this,input);if(phase==='during-encode'&&input?.startsWith('{"kind":"OK","contractVersion":"3.0.0"'))now+=2000;return b;};
    let res:Response;
    try{res=await handler(req);}finally{Date.now=clock;TextEncoder.prototype.encode=encode;}
    expect(res!.status).toBe(401);expect(await res!.json()).toEqual({error:'teacher_authentication_required'});
    expect(store.finalizations.map(x=>x.status)).toEqual([phase==='after-commit'?'COMPLETED':'REFUSED']);
    expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
  });
  test('session revocation after known COMMIT suppresses output while retaining COMPLETED',async()=>{
    let active=true;const {handler,store}=makeHandler({currentAuthentication:()=>({identity:active?identity:null,sessionKey:SESSION_KEY})});
    const commit=store.commitReadOutput.bind(store);
    store.commitReadOutput=async(r,prepare)=>{const result=await commit(r,prepare);active=false;return result;};
    const res=await handler(post(request()));expect(res.status).toBe(401);expect(await res.json()).toEqual({error:'teacher_authentication_required'});
    expect(store.finalizations.map(x=>x.status)).toEqual(['COMPLETED']);expect(store.directFinalizeCalls).toBe(0);
  });
});

describe('ORDINARY-R5-F1 actual cookie expiry before the final refusal audit',()=>{
  for(const preparation of ['revision-stale','data-error'] as const){
    for(const phase of ['binding','page','error-encode'] as const){
      for(const expire of [false,true])test(preparation+' '+phase+' '+(expire?'cookie expires':'cookie remains active'),async()=>{
        let now=Date.parse('2026-10-25T08:00:00.000Z'),leaseHeld=false,gateHeld=false,triggered=false,commitKnown=false;
        const clock=Date.now,encode=TextEncoder.prototype.encode,encoded:Uint8Array<ArrayBuffer>[]=[];
        const lease=async<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>)=>{
          leaseHeld=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{leaseHeld=false;}
        };
        const {handler,store}=makeHandler({outputLease:lease}),start=now;
        const advance=()=>{if(gateHeld&&!triggered){triggered=true;if(expire)now+=2000;}};
        mapFixtureViews(store,view=>({...view,
          teacherBindingByActor:async(owner,actor)=>{const row=await view.teacherBindingByActor(owner,actor);if(phase==='binding')advance();return row;},
          studentRevisionCurrent:async(owner,id)=>{const row=await view.studentRevisionCurrent(owner,id);if(phase==='page')advance();return row;},
        }));
        const read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
        let preparatoryCode:string|null=null;
        store.readSnapshot=async callback=>{
          try{return await read(preparation==='data-error'?async()=>{throw Error('fictional preparatory data unavailable');}:callback);}
          catch(error){preparatoryCode=error instanceof TypedReadRefusal?error.code:'CONTRACT_UNVERIFIABLE';throw error;}
        };
        store.commitReadOutput=async(admission,prepare)=>{
          expect(leaseHeld).toBe(true);expect(now).toBe(start);
          expect(preparatoryCode).toBe(preparation==='revision-stale'?'REVISION_STALE':'CONTRACT_UNVERIFIABLE');
          gateHeld=true;
          try{const result=await commit(admission,prepare);commitKnown=true;return result;}finally{gateHeld=false;}
        };
        const req=post(request({expectedRevisions:preparation==='revision-stale'?[objectRef('Teacher','teacher-a','rev-stale')]:[]}),{
          cookie:'dc_teacher='+signTeacherSession(SESSION_KEY,OWNER,ACTOR,Math.floor(start/1000),1),
        });
        Date.now=()=>now;
        TextEncoder.prototype.encode=function(input?:string){
          const bytes=encode.call(this,input);
          if(input?.startsWith('{"kind":"ERROR"')){
            expect(leaseHeld).toBe(true);expect(gateHeld).toBe(true);expect(commitKnown).toBe(false);expect(store.finalizations).toEqual([]);
            encoded.push(bytes);if(phase==='error-encode')advance();
          }
          return bytes;
        };
        let res:Response;
        try{res=await handler(req);}finally{Date.now=clock;TextEncoder.prototype.encode=encode;}
        const code=expire?'PERMISSION_DENIED':preparation==='revision-stale'?'REVISION_STALE':'CONTRACT_UNVERIFIABLE';
        expect(triggered).toBe(true);expect(commitKnown).toBe(true);expect(leaseHeld).toBe(false);
        expect(res!.status).toBe(expire?401:409);expect(encoded.length).toBeGreaterThan(0);
        const prepared=JSON.parse(new TextDecoder().decode(encoded.at(-1)!));
        expect(prepared.error.code).toBe(code);expect(prepared.items).toBeUndefined();expect(prepared.nextCursor).toBeUndefined();
        if(expire)expect(await res!.json()).toEqual({error:'teacher_authentication_required'});
        else expect(new Uint8Array(await res!.arrayBuffer())).toEqual(encoded.at(-1)!);
        expect(store.finalizations.map(x=>[x.status,x.refusalCode])).toEqual([['REFUSED',code]]);
        expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);
      });
    }
  }
});

describe('ORDINARY-R4-F1 stale preparation and current binding at the final fences',()=>{
  for(const retire of [false,true])test(retire?'retirement before the final gate overrides stale409 with current403':'unchanged active binding retains stale409',async()=>{
    let leaseHeld=false,gateHeld=false,preparatoryCode:string|null=null;
    const lease=async<T>(use:(s:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>)=>{
      leaseHeld=true;try{return await use({sessionKey:SESSION_KEY,identity});}finally{leaseHeld=false;}
    };
    const {handler,store}=makeHandler({outputLease:lease}),read=store.readSnapshot.bind(store),commit=store.commitReadOutput.bind(store);
    const code=retire?'PERMISSION_DENIED':'REVISION_STALE',events:string[]=[];
    const signedCookie=cookie(),req=post(request({expectedRevisions:[objectRef('Teacher','teacher-a','rev-stale')]}),{cookie:signedCookie});
    const encode=TextEncoder.prototype.encode,RealResponse=globalThis.Response;
    let encoded:Uint8Array<ArrayBuffer>|undefined,responseBody:BodyInit|null|undefined;
    store.readSnapshot=async callback=>{
      try{return await read(callback);}catch(error){
        expect(error).toBeInstanceOf(TypedReadRefusal);preparatoryCode=(error as TypedReadRefusal).code;
        events.push('preparatory-stale');throw error;
      }
    };
    store.commitReadOutput=async(admission,prepare)=>{
      expect(preparatoryCode).toBe('REVISION_STALE');expect(leaseHeld).toBe(true);
      expect(req.headers.get('Cookie')).toBe(signedCookie);
      if(retire)store.binding=version('teacher-a','rev-teacher-retired',{...store.binding!.payload,state:'RETIRED',assignmentState:knownK('INACTIVE' as const)});
      const result=await commit(admission,async view=>{gateHeld=true;try{return await prepare(view);}finally{gateHeld=false;}});
      expect(encoded).toBeDefined();
      events.push('terminal-commit');return result;
    };
    TextEncoder.prototype.encode=function(input?:string){
      const bytes=encode.call(this,input);
      if(input?.startsWith('{"kind":"ERROR"')){
        expect(leaseHeld).toBe(true);expect(gateHeld).toBe(true);expect(store.finalizations).toEqual([]);
        encoded=bytes;events.push('encode-selected-refusal');
      }
      return bytes;
    };
    globalThis.Response=class extends RealResponse{constructor(body?:BodyInit|null,init?:ResponseInit){
      expect(leaseHeld).toBe(true);expect(gateHeld).toBe(false);responseBody=body;events.push('response');super(body,init);
    }} as typeof Response;
    let res:Response;
    try{res=await handler(req);}finally{TextEncoder.prototype.encode=encode;globalThis.Response=RealResponse;}
    expect(res!.status).toBe(retire?403:409);expect(responseBody).toBe(encoded);
    const bytes=new Uint8Array(await res!.arrayBuffer());expect(bytes).toEqual(encoded!);
    const body=JSON.parse(new TextDecoder().decode(bytes));
    expect(body.error.code).toBe(code);expect(body.items).toBeUndefined();expect(body.nextCursor).toBeUndefined();
    expect(store.finalizations.map(x=>[x.status,x.refusalCode])).toEqual([['REFUSED',code]]);
    expect(events).toEqual(['preparatory-stale','encode-selected-refusal','terminal-commit','response']);
    expect(store.commitCalls).toBe(1);expect(store.directFinalizeCalls).toBe(0);expect(leaseHeld).toBe(false);
  });
});

describe('RC9 shape sweep through the real application and store',()=>{
  test('every prerequisite operation answers a malformed field value with 4xx, never 503',async()=>{
    const f=await foundation();
    const handler=createTeacherServerHandler({app:new TeacherApplication(f.store as never,OWNER,undefined,undefined,f.store as never),origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
      saveIdentity:async()=>{throw Error('auth writer must not run');},curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never});
    const ingressKeys=['idempotencyKey','occurrenceId','admissionId','processEpoch','sourceObservedAt','authenticationRevision','namespace','scopeRef','nativeOwnerBinding','nativeInterfaceBinding','action','requestIntentDigest'];
    const ingress=(label:string)=>{const c=commandFixture('rc9-'+label) as unknown as Record<string,unknown>&{verifiedSession:{authenticationRevision:string}};return Object.fromEntries(ingressKeys.map(k=>[k,k==='authenticationRevision'?c.verifiedSession.authenticationRevision:c[k]]));};
    const samples:Record<string,Record<string,unknown>>={default:{command:ingress('base'),payload:{}},prerequisiteTeacher:{teacherKey:'teacher-a'},prerequisiteClassGroup:{classKey:'class-a'},prerequisiteLesson:{lessonKey:'lesson-a'},prerequisiteStudentRevision:{studentId:'student-a'},prerequisiteStudentRevisionHistory:{studentId:'student-a'},prerequisiteApproval:{approvalId:'approval-a'},prerequisiteOwnerRevision:{family:'teacher',entityKey:'teacher-a',revisionId:'rev-teacher'},prerequisiteOwnerHistory:{family:'teacher',entityKey:'teacher-a'},prerequisiteScoreEvidence:{entityKey:'evidence-a'},prerequisiteScoreEvidenceForAttempt:{attemptRef:{identity:{},revision:'rev-attempt'}},admitReadOccurrence:{ownerId:OWNER,actorId:ACTOR,requestId:'req-1'},readOccurrence:{ownerId:OWNER,actorId:ACTOR,requestId:'req-1'}};
    const escaped:string[]=[];let cases=0;
    for(const operation of nativePrerequisiteOperations){
      const base=samples[operation]??samples.default!;
      const variants:Record<string,unknown>[]=Object.keys(base).flatMap(key=>[null,7,'x',{},[]].map(bad=>({...base,[key]:bad})));
      if(base.command&&typeof base.command==='object')for(const key of ingressKeys)for(const bad of [null,7,{}])variants.push({...base,command:{...ingress(operation+key),[key]:bad}});
      for(const input of variants){
        cases++;
        const res=await handler(new Request(ORIGIN+'/api/native-prerequisite',{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie()},body:JSON.stringify({operation,input})}));
        if(res.status>=500)escaped.push(operation+':'+JSON.stringify(input).replace(/"scopeRef":\{.*?\}\}\}/,'"scopeRef":{..}').slice(0,110)+' -> '+res.status);
      }
    }
    expect(cases).toBeGreaterThan(150);
    expect(escaped).toEqual([]);
  });
});


test('CLOCK-HTTP the fictional cookie route retains its synthetic read clock under future host time',async()=>{
 const previous=Date.now;Date.now=()=>Date.parse('2035-01-01T00:00:00.000Z');
 try{
  const {handler,store}=makeHandler(),response=await handler(post(request()));
  expect(response.status).toBe(200);expect(store.finalizations.map(row=>row.status)).toEqual(['COMPLETED']);
 }finally{Date.now=previous;}
});

const regressionIngress=(label:string)=>{
 const c=commandFixture(label),{ownerId:_owner,actorId:_actor,verifiedSession,...rest}=c;
 return {...rest,authenticationRevision:verifiedSession.authenticationRevision};
};

/** Derive the transport population from the actual router and its actual
 * application signatures, including referenced DTOs. No second route/field list. */
test('HTTP-TABLE native dispatch and handler custody share one bounded route table',async()=>{
 const {handler}=makeHandler();
 const routes=(handler as unknown as {nativeRoutes?:readonly {method:string;path:string;handler:(scope:unknown)=>Promise<Response>}[]}).nativeRoutes;
 expect(Array.isArray(routes)).toBe(true);
 const prefixes=['/api/native-prereq','/api/native-prerequisite','/api/typed-read','/api/native-read-snapshot','/api/native-read-descriptor'];
 for(const route of routes!){
  expect(prefixes.some(p=>route.path===p||route.path.startsWith(p+'/'))).toBe(true);
  await expect(route.handler({req:post({}),actor:ctx})).rejects.toThrow('http_parser_required');
  for(const suffix of ['/unregistered','/null','/7','/'+ 'x'.repeat(4097)])expect((await handler(new Request(ORIGIN+route.path+suffix,{headers:{Cookie:cookie()}}))).status).toBe(400);
 }
 expect(routes!.some(r=>r.path==='/design-lab')).toBe(false);
 expect(Object.isFrozen(routes)).toBe(true);
});

test('HTTP-LEGACY native extraction preserves existing initialization and legacy handler bytes',()=>{
 const source=readFileSync(new URL('../../src/academy/server.ts',import.meta.url),'utf8');
 const start=source.indexOf('export function createTeacherServerHandler(options:TeacherServerOptions){');
 const end=source.indexOf('  // This router owns only R07',start);
 expect(start>=0&&end>start).toBe(true);
 const legacy=source.split('/* BEGIN PRESERVED LEGACY ROUTER */\n')[1]?.split('/* END PRESERVED LEGACY ROUTER */')[0];
 expect(legacy).toBeDefined();
 const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
 // Independently reconstructed from gen89 after removing only its four native branches.
 expect(sha(source.slice(start,end).trimEnd())).toBe('166821ead822b971c5741243e4ba3222907d4e6ce4d094c7093423edcaf6e723');
 expect(sha(legacy!)).toBe('94dc84464f961bdf359b78c1aca1f3ed555578a5c4ab47a8367aebbc25b3c90c');
});

function httpSchemaValue(rule:TeacherHttpField,name:string):unknown{
 if(rule.values)return rule.values[0];
 if(rule.format==='nativeRef')return nativeRef();
 if(rule.format==='objectRef')return objectRef('Student','student-a','rev-student');
 if(rule.format==='action')return regressionIngress('http-action').action;
 if(rule.format==='closure')return closure();
 if(rule.format==='sha256')return 'a'.repeat(64);
 if(rule.format==='instant')return '2026-10-24T00:00:00Z';
 if(rule.format==='date')return '2026-10-24';
 if(rule.format==='uuid')return crypto.randomUUID();
 if(rule.kind==='null')return null;
 if(rule.kind==='integer')return rule.min??1;
 if(rule.kind==='boolean')return true;
 if(rule.kind==='array')return Array.from({length:rule.min??0},()=>httpSchemaValue(rule.item!,name));
 if(rule.kind==='object')return rule.fields?httpSchemaInput(rule.fields):{};
 return name==='consumerProfile'?'CURRENT_1_1':name==='contractVersion'?'2.0.0':'synthetic-'+name;
}
function httpSchemaInput(fields:TeacherHttpFields):Record<string,unknown>{return Object.fromEntries(Object.entries(fields).map(([name,rule])=>[name,httpSchemaValue(rule,name)]));}
function httpSchemaParameters(fields:TeacherHttpFields,prefix:string[]=[]):{path:string[];rule:TeacherHttpField}[]{return Object.entries(fields).flatMap(([name,rule])=>[{path:[...prefix,name],rule},...(rule.fields?httpSchemaParameters(rule.fields,[...prefix,name]):[])]);}
/** Negative cases come from schema kinds and bounds, never from the parser under test. */
function httpInvalidValues(rule:TeacherHttpField,name:string):unknown[]{
 const values:unknown[]=rule.nullable||rule.kind==='null'?[]:[null];
 switch(rule.kind){
  case 'text':
   values.push(7,false,{},[],'x'.repeat((rule.max??4096)+1));
   if((rule.min??1)>0)values.push('');
   if(rule.values)values.push('SYNTHETIC_UNDECLARED_ENUM');
   if(rule.format)values.push('SYNTHETIC_INVALID_FORMAT');
   break;
  case 'integer':values.push('1',1.5,Number.MAX_SAFE_INTEGER+1,false,{},[],(rule.min??0)-1);if(rule.max!==undefined&&rule.max<Number.MAX_SAFE_INTEGER)values.push(rule.max+1);break;
  case 'boolean':values.push(7,'true',{},[]);break;
  case 'object':values.push(7,'',false,[]);if(rule.fields)values.push({SYNTHETIC_UNDECLARED_FIELD:true});if(rule.format)values.push({});break;
  case 'array':values.push(7,'',false,{},Array.from({length:(rule.max??100)+1},()=>httpSchemaValue(rule.item!,name)));if((rule.min??0)>0)values.push([]);break;
  case 'null':values.push(7,'',false,{},[]);break;
 }
 return values;
}
/** Read source only, never authentication state or other runtime/private files. */
function sourceErrorClosure(entries:readonly string[]):Map<string,readonly string[]>{
 const sourceRoot=new URL('../../src/',import.meta.url),seen=new Map<string,readonly string[]>();
 const visit=(url:URL)=>{
  if(seen.has(url.href))return;
  expect(url.href.startsWith(sourceRoot.href)).toBe(true);
  const text=readFileSync(url,'utf8');
  seen.set(url.href,[...text.matchAll(/\b(?:new\s+)?(?:Error|TypeError|RangeError)\((['"])([^'"`$]{3,100})\1\)/g)].map(match=>match[2]!));
  for(const match of text.matchAll(/^import\s+(?!type\s)[^;]*?\sfrom\s*['"](\.[^'"]+)['"]/gm)){
   const dependency=new URL(match[1]!,url);
   const candidates=[new URL(dependency.href+'.ts'),new URL(dependency.href+'/index.ts')];
   const resolved=candidates.find(candidate=>existsSync(candidate));
   expect(resolved).toBeDefined();if(resolved)visit(resolved);
  }
 };
 for(const entry of entries)visit(new URL(entry,sourceRoot));
 return seen;
}
test('HTTP-INPUT imported route table enumerates every body/query/path parameter through the real stack',async()=>{
 const f=await foundation(),handler=prerequisiteHandler(f.store),failures:string[]=[];let cases=0;
 const routes:readonly TeacherHttpRoute[]=handler.nativeRoutes;
 const log=console.error;console.error=()=>{};
 try{for(const route of routes){
  const variants=route.body?.operations?Object.entries(route.body.operations).filter(([op])=>route.body!.nativeOperation==='GENERIC'||route.body!.nativeOperation==='TEACHER_UPDATE'?route.body!.nativeOperation==='GENERIC'||['updateTeacher','retireTeacher'].includes(op):op===route.body!.nativeOperation):[[null,route.body?.fields??{}] as const];
  for(const [operation,fields] of variants){
   const input=httpSchemaInput(fields);expect(()=>parseTeacherHttpFields(input,fields)).not.toThrow();
   const envelope=(value:Record<string,unknown>)=>route.body?.nativeOperation==='GENERIC'?{operation,input:value}:value;
   const send=(body:unknown,path=route.path)=>handler(new Request(ORIGIN+path,{method:route.method,headers:{Origin:ORIGIN,'Content-Type':'application/json',Cookie:cookie(),...(route.headers?{'X-Native-Metadata-Operation-Id':crypto.randomUUID()}:{})},...(route.body?{body:JSON.stringify(body)}:{})}));
   for(const {path,rule} of httpSchemaParameters(fields)){
    for(const value of httpInvalidValues(rule,path.at(-1)!)){
     const malformed=structuredClone(input);let target=malformed;
     for(const part of path.slice(0,-1))target=target[part] as Record<string,unknown>;
     target[path.at(-1)!]=value;
     const response=await send(envelope(malformed));cases++;
     if(response.status!==400)failures.push(route.path+':'+String(operation)+':'+path.join('.')+':'+typeof value+':'+response.status);
    }
   }
   for(const value of ['null','7','','x'.repeat(4097)]){
    // Each declared query parameter plus an unknown key. Native routes
    // currently declare none; future additions join this enumeration.
    for(const key of [...Object.keys(route.query),'SYNTHETIC_UNKNOWN_QUERY']){
     const response=await send(envelope(input),route.path+'?'+new URLSearchParams({[key]:value}));cases++;
     if(response.status!==400)failures.push(route.path+':query:'+response.status);
    }
   }
  }
 }}finally{console.error=log;}
 expect(cases).toBeGreaterThan(500);expect(failures.slice(0,60)).toEqual([]);
});

test('HTTP-LOG rejected envelope and input keys never enter diagnostics',async()=>{
 const f=await foundation(),handler=prerequisiteHandler(f.store),logs:string[]=[],original=console.error,canary='SYNTHETIC_PRIVATE_CANARY_KEY';
 console.error=(...args:unknown[])=>{logs.push(args.map(String).join(' '));};
 try{
  for(const payload of [{operation:'prerequisiteTeachers',input:{},[canary]:true},{operation:'prerequisiteTeachers',input:{[canary]:true}}])expect((await handler(post(payload,{path:'/api/native-prerequisite'}))).status).toBe(400);
 }finally{console.error=original;}
 expect(logs.length).toBeGreaterThan(0);expect(logs.some(line=>line.includes(canary))).toBe(false);
});

const nativeDependencyCodes=[...new Set([...sourceErrorClosure(['academy/teacherAuthStore.ts','academy/auth.ts']).values()].flat())];
test('RC7 dependency corpus includes errors from the actual authentication source closure',()=>{
 expect(nativeDependencyCodes.length).toBeGreaterThan(10);
});
const nativeDependencyFailures=[...nativeDependencyCodes.map(code=>({label:code,failure:Error(code)})),{label:'unknown',failure:Error('SYNTHETIC_AUTH_FAILURE')},{label:'type',failure:TypeError('SYNTHETIC_AUTH_FAILURE')},{label:'range',failure:RangeError('SYNTHETIC_AUTH_FAILURE')},{label:'null',failure:null},{label:'number',failure:7}];
for(const {label,failure} of nativeDependencyFailures)test('HTTP-DEPENDENCY '+label+' is infrastructure failure in every native phase',async()=>{
 const failures:string[]=[];
 for(const failAt of [1,2,3]){
  const f=await foundation();let reads=0;
  const handler=createTeacherServerHandler({app:new TeacherApplication(f.store as never,OWNER,undefined,undefined,f.store),origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,currentAuthentication:()=>{if(++reads===failAt)throw failure;return {identity,sessionKey:SESSION_KEY};},saveIdentity:async()=>{throw Error('no auth writes');},curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never});
  const before=f.sql.rows('class_versions').length;
  const response=await handler(post({operation:'createClassGroup',input:{command:regressionIngress('dependency-'+failAt),payload:{kind:'class_group',displayName:knownK('Invented Class'),businessTimezone:knownK('Asia/Seoul'),classState:knownK('ACTIVE'),synthetic:true}}},{path:'/api/native-prerequisite'}));
  const body=await response.json();
  if(response.status!==503||body.automaticRetry!==false||failAt===3&&body.readOriginalRequestBeforeNewIntent!==true)failures.push(failAt+':'+response.status+':'+String(body.error));
  expect(f.sql.rows('class_versions').length-before).toBe(failAt===3?1:0);
 }
 for(const path of ['/api/typed-read','/api/native-read-snapshot','/api/native-read-descriptor']){
  let reads=0;const {handler}=makeHandler({currentAuthentication:()=>{if(++reads===2)throw failure;return {identity,sessionKey:SESSION_KEY};}});
  const payload=path==='/api/native-read-snapshot'?{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'dependency-snapshot',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:testFunctionRequest(testTemporal())}:request();
  const response=path==='/api/native-read-descriptor'?await handler(new Request(ORIGIN+path,{headers:{Cookie:cookie(),'X-Native-Metadata-Operation-Id':crypto.randomUUID()}})):await handler(post(payload,{path}));
  if(response.status!==503)failures.push(path+':'+response.status);
 }
 expect(failures).toEqual([]);
});
function prerequisiteHandler(store:Awaited<ReturnType<typeof foundation>>['store']){
 return createTeacherServerHandler({app:new TeacherApplication(store as never,OWNER,undefined,undefined,store),origin:ORIGIN,sessionKey:SESSION_KEY,identity,invitationDigest:null,
  saveIdentity:async()=>{throw Error('auth writer must not run');},curatedConceptCandidates:{read:()=>{throw Error('unused');}} as never});
}

test('RC10 every dated authority route rejects invalid calendars before interval selection',async()=>{
 const dated={createLessonSession:'businessDate',updateLessonSession:'businessDate',attachActivityScope:'recordScope',correctActivityScope:'recordScope',createProgress:'recordScope',correctProgress:'recordScope',createAssessment:'assessmentScope',correctAssessment:'assessmentScope',createDraft:'recordScope',updateDraft:'recordScope',recordScoreEvidence:'recordScope'} as const;
 const facade=readFileSync(new URL('../../src/academy/prerequisiteApplication.ts',import.meta.url),'utf8');
 const observed=[...facade.matchAll(/async (\w+)\([^]*?(?=\n  async |\n  \/\/|$)/g)].filter(m=>/requireDatedTeacher\(context,input\?\.payload\?\./.test(m[0]!)).map(m=>m[1]!).sort();
 expect(observed).toEqual(Object.keys(dated).sort());
 const malformed:unknown[]=[null,7,{},[],'','not-a-date','2026-00-01','2026-02-30','2026-10-24T00:00:00Z'];
 const failures:string[]=[];let cases=0;
 for(const retired of [false,true]){
  const f=await foundation({validFrom:'2026-01-01',validTo:'2027-01-01'}),handler=prerequisiteHandler(f.store);
  if(retired){const command={...f.bind,context:commandFixture('rc10-retire'),entityKey:f.teacher.identity.nativeKey,expectedRevisionId:f.teacher.revisionId,payload:{...f.bind.payload,state:'RETIRED' as const}};await admitted(f.store,'append:teacher',command,()=>f.store.appendTeacher(command));}
  const before=f.sql.state();
  for(const [operation,field] of Object.entries(dated))for(const bad of malformed){
   const sample=operation.includes('Assessment')?assessment():operation.includes('Draft')?draft():operation.includes('Progress')?progress():{kind:operation.includes('Lesson')?'lesson_session':operation==='recordScoreEvidence'?'native_score_evidence':'activity_scope'};
   const payload={...sample,[field]:field==='businessDate'?bad:{...f.recordScope,businessDate:bad}};
   const input={command:regressionIngress('rc10-'+cases),payload,studentId:'student-a',entityId:'entity-a',expectedRevisionId:'revision-a',lessonKey:f.lesson.identity.nativeKey,scopeKey:'scope-a',entityKey:'evidence-a'};
   const paths=[['/api/native-prerequisite',false] as const,...Object.entries(nativePrereqRouteAliases).filter(([,op])=>op===operation).map(([path])=>[path,true] as const)];
   for(const [path,named] of paths){
    const keys=operation==='createLessonSession'?['command','payload']:operation==='updateLessonSession'?['command','lessonKey','expectedRevisionId','payload']:operation==='attachActivityScope'?['command','payload']:operation==='correctActivityScope'?['command','scopeKey','expectedRevisionId','payload']:operation==='recordScoreEvidence'?['command','entityKey','expectedRevisionId','payload']:operation.startsWith('create')?['command','studentId','payload']:['command','studentId','entityId','expectedRevisionId','payload'];
    const closed=Object.fromEntries(keys.map(k=>[k,input[k as keyof typeof input]]));
    const response=await handler(post(named?closed:{operation,input:closed},{path})),body=await response.json();cases++;
    if(response.status!==(retired?403:400)||body.error!==(retired?'teacher_binding_inactive':'invalid calendar date'))failures.push(operation+':'+path+':'+typeof bad+':'+response.status+':'+body.error);
   }
  }
  if(f.sql.state()!==before)failures.push('unexpected_admission_or_business_write:'+retired);
 }
 for(const retired of [false,true])for(const bad of malformed){
  const {handler,store}=makeHandler();if(retired)store.binding=version('teacher-a','rev-retired',{...store.binding!.payload,state:'RETIRED',assignmentState:knownK('INACTIVE' as const)});
  for(const acquire of [false,true]){
   const temporal={...testTemporal(),businessDate:bad},value=acquire?{schema:'native-read-acquire.v2',consumerProfile:'CURRENT_1_1',requestId:'rc10-acquire',scopeRef:nativeRef(),consistency:'SNAPSHOT',time:{mode:'CURRENT'},functionIntent:{...testFunctionRequest(testTemporal()),businessDate:bad}}:{...request(),temporalSelection:temporal};
   const response=await handler(post(value,{path:acquire?'/api/native-read-snapshot':'/api/typed-read'}));cases++;
   if(response.status!==(retired?403:400))failures.push((acquire?'acquire':'read')+':'+typeof bad+':'+response.status);
  }
 }
 expect(cases).toBeGreaterThan(350);expect(failures).toEqual([]);
});

test('RC9 recursive hash refusals stay classified across generic and named ingress',async()=>{
 const f=await foundation({validFrom:'2026-01-01',validTo:'2027-01-01'}),handler=prerequisiteHandler(f.store),before=f.sql.state();
 for(const [operation,path,named] of [['createLessonSession','/api/native-prerequisite',false],['createLessonSession','/api/native-prereq/lessons',true],['createClassGroup','/api/native-prerequisite',false],['createClassGroup','/api/native-prereq/classes',true]] as const)for(const array of [false,true]){
  const input={command:regressionIngress('rc9-depth-'+operation+array+named),payload:{kind:operation==='createLessonSession'?'lesson_session':'class_group',...(operation==='createLessonSession'?{businessDate:'2026-10-24'}:{}),nested:null}};
  const nested=(array?'[':'{"x":').repeat(40000)+'null'+(array?']':'}').repeat(40000);
  const raw=JSON.stringify(named?input:{operation,input}).replace('"nested":null','"nested":'+nested);
  expect(new TextEncoder().encode(raw).byteLength).toBeLessThan(524288);
  const response=await handler(post(null,{path,rawBody:raw}));expect(response.status).toBe(400);
  const body=await response.json();expect(prerequisiteRefusalStatus(body.error)).toBe(400);expect(body.error).toBe('invalid_json_depth');
 }
 expect(f.sql.state()).toBe(before);
});
