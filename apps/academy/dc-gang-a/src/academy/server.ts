import {TeacherWorkspaceRefusal} from './teacherWorkspace';
import type { TeacherApplication, TrustedTeacherContext } from './application';
import { readCookie, secretDigest, signTeacherSession, verifyTeacherSession } from './auth';
import { assertExactKeys } from '../learning/model';
import { validateWebMcpTrialToken } from './originTrial';
import {ClinicCommandRefusal} from './learningWork';
import {matchesTeacherActionHeaders} from './teacherActionScope';
import {ObservationCommandRefusal} from './records';
import {renderDesignLab} from './web/designLab';
import {teacherFontAssets} from './web/fontAssets';
import type {PrivateArtifactAccess} from './privateArtifactCatalog';
import {createPreservedHistoryReader} from './preservedHistory';
import type {PreservedSelection} from './contracts/preservedHistory';
import {createCuratedConceptCandidateAccess} from './curatedConceptCandidates';
import {nativeMetadataOperationIdPattern,nativeReadDescriptorMaxBytes,snapshotNativeReadBuildDescriptor,type NativeReadBuildDescriptor} from './nativeReadDescriptor';
import {createNativeTypedRead,typedReadContractVersion,TypedReadRefusal,type NativeQualificationHooks,type BufferedTypedReadOutput,type NativeSnapshotAcquireRequest,type SnapshotAdmissionGrant,type TypedReadRequest} from './nativeTypedRead';
import {fixedConsumerProfile,scopeActionDefinitions,type ConsumerProfileId} from './contracts/prerequisiteRecords';
/** Refusal statuses the action contracts declare per code ("409, ..."), so the HTTP mapping follows the
 * contract instead of a hand-kept list. */
/** Closed input-validation refusals thrown by the prerequisite contract validators: caller errors (400). */
export const inputRefusals:ReadonlySet<string>=new Set(['prerequisite_collection_bounds','duplicate_prerequisite_value','reference_depth','action_version','registry_version','score_scale_unsupported','synthetic_boolean','delegation_unsupported','calendar_underflow']);
export const declaredRefusalStatus:ReadonlyMap<string,number>=new Map(Object.values(scopeActionDefinitions).flatMap(definition=>{
  const errors=(definition as {errors?:unknown}).errors;
  return errors&&typeof errors==='object'?Object.entries(errors as Record<string,unknown>).flatMap(([code,text])=>{const status=/^(4\d\d)\b/.exec(String(text));return status?[[code,Number(status[1])] as const]:[];}):[];
}));
import type {TeacherPrerequisiteStore} from './ports/teacherStore';
import {ownerCursorLeaseFor,type NativeOwnerCursorLease} from './teacherAuthStore';
import type {NativeTypedReadOptions} from './nativeTypedRead';

export interface NativeCursorRuntime {
 readonly actorId:string;
 readonly interfaceBinding:string;readonly expiryCap:number;
 readonly context:NonNullable<NativeTypedReadOptions['cursorContext']>;
 readonly assertCurrent:()=>void;
}

export interface LoginIdentity { readonly actorId:string; readonly username:string; readonly passwordHash:string }
export interface TeacherServerOptions {
  readonly app:TeacherApplication; readonly origin:string; readonly sessionKey:string;
  readonly identity:LoginIdentity|null; readonly invitationDigest:string|null;
  readonly currentAuthentication?:()=>{identity:LoginIdentity|null;sessionKey:string};
  readonly buildDescriptor?:NativeReadBuildDescriptor;
  readonly passwordRecovery?:{
    claim:(token:string)=>Promise<{id:string;expiresAt:number}>;
    status:(id:string)=>Promise<{id:string;expiresAt:number}>;
    complete:(id:string,passwordHash:string)=>Promise<{identity:LoginIdentity;sessionKey:string}>;
  };
  readonly saveIdentity:(identity:LoginIdentity)=>Promise<void>;
  readonly consumeInvitation?:()=>Promise<void>;
  readonly page?:string; readonly script?:string;
  readonly originTrialToken?:string;
  readonly refresh?:(context:TrustedTeacherContext,selection:{studentId:string|null;requestId:string;date?:string})=>Promise<unknown>;
  readonly refreshResult?:(context:TrustedTeacherContext,requestId:string)=>Promise<unknown>;
  readonly refreshPending?:(context:TrustedTeacherContext)=>Promise<unknown>;
  readonly refreshHistory?:(context:TrustedTeacherContext,cursor:string|null)=>Promise<unknown>;
  readonly privateArtifacts?:PrivateArtifactAccess;
  readonly curatedConceptCandidates?:ReturnType<typeof createCuratedConceptCandidateAccess>;
  readonly typedRead?:{readonly cursorRuntime?:NativeCursorRuntime;readonly qualification?:NativeQualificationHooks;readonly consumerProfile?:ConsumerProfileId;readonly sourceSetSha256?:string;readonly store:TeacherPrerequisiteStore;readonly processEpoch?:string;readonly registrySha256?:string;readonly snapshotGrantVerifier?:(grant:SnapshotAdmissionGrant,request:TypedReadRequest)=>boolean;readonly outputLease?:<T>(use:(state:Readonly<{sessionKey:string;identity:LoginIdentity|null}>)=>Promise<T>)=>Promise<T>};
}
const securityHeaders={ 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" };
function json(value:unknown,status=200,headers:Record<string,string>={}){return new Response(JSON.stringify(value),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8',...headers}});}
// Fixed authentication refusal bytes exist before any read transaction.
const authenticationRequiredBody=new TextEncoder().encode('{"error":"teacher_authentication_required"}');
function authenticationRequiredOutput(){return new Response(authenticationRequiredBody,{status:401,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});}
const cookie=(name:string,value:string,age=3600)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
/** Closed IG-3 prerequisite facade allowlist (application.ts:36-79). The
 * authenticated wrapper below dispatches only these explicit cases; it
 * never resolves a caller-supplied method name dynamically. */
export const nativePrerequisiteOperations=['bindTeacher','updateTeacher','retireTeacher','createClassGroup','updateClassGroup','createLessonSession','updateLessonSession','upsertTemporalBinding','attachStudentRevision','updateStudentRevision','attachActivityScope','correctActivityScope','createProgress','correctProgress','createAssessment','correctAssessment','createDraft','updateDraft','recordScoreEvidence','previewApprovalClosure','issueApproval','approveDraft','revokeApproval','commandOutcome','fenceCommand','admitReadOccurrence','finalizeReadOccurrence','readOccurrence','prerequisiteTeachers','prerequisiteTeacher','ownTeacherBinding','prerequisiteClassGroups','prerequisiteClassGroup','prerequisiteLessons','prerequisiteLesson','prerequisiteTemporalBindings','prerequisiteActivityScopes','prerequisiteStudentRevision','prerequisiteStudentRevisionHistory','prerequisiteApproval','prerequisiteOwnerRevision','prerequisiteOwnerHistory','prerequisiteScoreEvidence','prerequisiteScoreEvidenceForAttempt'] as const;
/** Adopted RC4 named aliases: exactly 17 operation.path routes dispatching
 * the same generic44 facade operations with direct input. The existing
 * teachers/update compatibility alias is retained separately and is not
 * part of the 17. Aliases add no operation beyond the generic44 set. */
export const nativePrereqRouteAliases=Object.freeze({
  '/api/native-prereq/student-revisions':'attachStudentRevision',
  '/api/native-prereq/student-revisions/update':'updateStudentRevision',
  '/api/native-prereq/activity-scopes':'attachActivityScope',
  '/api/native-prereq/activity-scopes/correct':'correctActivityScope',
  '/api/native-prereq/progress':'createProgress',
  '/api/native-prereq/progress/correct':'correctProgress',
  '/api/native-prereq/teachers':'bindTeacher',
  '/api/native-prereq/classes':'createClassGroup',
  '/api/native-prereq/classes/update':'updateClassGroup',
  '/api/native-prereq/lessons':'createLessonSession',
  '/api/native-prereq/lessons/update':'updateLessonSession',
  '/api/native-prereq/bindings':'upsertTemporalBinding',
  '/api/native-prereq/assessments':'createAssessment',
  '/api/native-prereq/assessments/correct':'correctAssessment',
  '/api/native-prereq/drafts':'createDraft',
  '/api/native-prereq/drafts/update':'updateDraft',
  '/api/native-prereq/drafts/approve':'approveDraft',
} as const);
export function createTeacherServerHandler(options:TeacherServerOptions){
  // Per-request service so the real grant verifier/issuer always seals with
  // the current server session key; an injected verifier still wins in tests.
  const typedReadServiceFor=(key:string,sessionExpiresAt?:number,cursorOwner?:NativeOwnerCursorLease)=>options.typedRead?createNativeTypedRead(options.typedRead.store,options.app.ownerId,{consumerProfile:options.typedRead.consumerProfile,sourceSetSha256:options.typedRead.sourceSetSha256,processEpoch:options.typedRead.processEpoch,registrySha256:options.typedRead.registrySha256,snapshotGrantVerifier:options.typedRead.snapshotGrantVerifier,snapshotGrantSecret:key,qualification:options.typedRead.qualification,sessionExpiresAt,cursorOwner,cursorInterfaceBinding:options.typedRead.cursorRuntime?.interfaceBinding,cursorExpiryCap:options.typedRead.cursorRuntime?.expiryCap,cursorContext:options.typedRead.cursorRuntime?.context}):null;
  const cursorOwnerFor=(leased:Readonly<{sessionKey:string;identity:LoginIdentity|null}>,currentAuthorization:()=>boolean):NativeOwnerCursorLease|undefined=>{
    const runtime=options.typedRead?.cursorRuntime;if(!runtime)return undefined;
    // The genuine actor captured by the sealed helper owner remains fixed
    // across same-key B substitution. Deny before ANY opaque diagnostics.
    if(!leased.identity||leased.identity.actorId!==runtime.actorId)throw new TypedReadRefusal('PERMISSION_DENIED',403);
    let codec:NativeOwnerCursorLease|undefined;
    const getCodec=()=>{runtime.assertCurrent();return codec??=ownerCursorLeaseFor(leased,{registrySha256:options.typedRead!.registrySha256!,processNonce:options.typedRead!.processEpoch!,interfaceBinding:runtime.interfaceBinding,consumerProfile:options.typedRead!.consumerProfile??'CURRENT_1_1',consumerProfileDigest:fixedConsumerProfile(options.typedRead!.consumerProfile??'CURRENT_1_1').pins.consumerProfileDigest},()=>{runtime.assertCurrent();return currentAuthorization();});};
    return {open:token=>getCodec().open(token),seal:binding=>getCodec().seal(binding),assertCurrent:()=>getCodec().assertCurrent()};
  };
  const buildDescriptor=snapshotNativeReadBuildDescriptor(options.buildDescriptor);
  const preservedHistory=options.privateArtifacts?createPreservedHistoryReader(options.privateArtifacts,options.app.ownerId):null;
  const curatedConceptCandidates=options.curatedConceptCandidates??createCuratedConceptCandidateAccess(options.app.ownerId);
  const trial=options.originTrialToken?validateWebMcpTrialToken(options.originTrialToken,options.origin):null;
  const admittedHost=new URL(options.origin).hostname;
  let identity=options.identity,sessionKey=options.sessionKey,invitationDigest=options.invitationDigest,setupRunning=false,resetRunning=false;
  const loginAttempts=new Map<string,{count:number;windowStart:number}>();
  const authenticationRateLimit=(key:string,now:number,error:'login_rate_limited'|'recovery_rate_limited'):Response|null=>{
    for(const [expiredKey,attempt] of loginAttempts)if(now-attempt.windowStart>=900000)loginAttempts.delete(expiredKey);
    const prior=loginAttempts.get(key);
    if(!prior&&loginAttempts.size>=2048)return json({error},429);
    const attempt=prior??{count:0,windowStart:now};
    attempt.count++;loginAttempts.set(key,attempt);
    return attempt.count>5?json({error},429,{'Retry-After':'900'}):null;
  };
  const context=(req:Request):TrustedTeacherContext|null=>{
    const raw=readCookie(req.headers.get('Cookie'),'dc_teacher');
    const session=raw?verifyTeacherSession(sessionKey,raw):null;
    return session&&identity&&session.ownerId===options.app.ownerId&&session.actorId===identity.actorId?{ownerId:session.ownerId,actorId:session.actorId,role:'teacher'}:null;
  };
  const body=async(req:Request):Promise<Record<string,unknown>>=>{
    if(req.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw Error('json_required');
    // 16000 UTF-16 text units may occupy 96000 JSON bytes after escaping; keep a bounded envelope.
    // Native prerequisite records inline full NativeObjectRef scope bases in every evidence ref (~1.1 KB each),
    // so a real B-lane draft exceeds 128000 B; 512 KiB until refs are compacted (tracked contract change).
    const intakePath=new URL(req.url).pathname;
    const limit=intakePath==='/api/owner-workspace'?4_194_304:['/api/exam-candidate','/api/concept-definition'].includes(intakePath)?262_144:intakePath==='/api/native-prerequisite'||intakePath.startsWith('/api/native-prereq/')?524_288:['/api/teacher-observation','/api/teacher-clinic','/api/teacher-workspace','/api/owner-workspace','/api/record'].includes(intakePath)?128000:['/api/typed-read','/api/native-read-snapshot'].includes(intakePath)?65536:20000;
    const length=req.headers.get('Content-Length');
    if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw Error('input_too_large');
    const reader=req.body?.getReader();if(!reader)throw Error('invalid_input');
    const decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,text='';
    try{
      while(true){
        const chunk=await reader.read();if(chunk.done)break;
        bytes+=chunk.value.byteLength;
        if(bytes>limit){await reader.cancel();throw Error('input_too_large');}
        text+=decoder.decode(chunk.value,{stream:true});
      }
      text+=decoder.decode();
    }finally{reader.releaseLock();}
    const data:unknown=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error('invalid_input');return data as Record<string,unknown>;
  };
  return async(req:Request):Promise<Response>=>{
    const url=new URL(req.url),path=url.pathname;
    const conceptWrite=req.method==='POST'&&['/api/concept-definition','/api/concept-link'].includes(path);
    // Origin and authentication gates return before application dispatch; status alone never proves a write outcome.
    const preDispatchRefusal=(error:string,status:number)=>json({error,...(conceptWrite?{requestOutcome:'rejected_before_commit',automaticRetry:false}:{})},status);
    if(!['GET','POST'].includes(req.method))return json({error:'method_not_allowed'},405);
    if(req.method==='POST'&&req.headers.get('Origin')!==options.origin)return preDispatchRefusal('origin_denied',403);
    try{
      if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
      if(options.typedRead?.consumerProfile==='OLD_SECTION_1_0'&&!((path==='/health'||path==='/api/native-read-descriptor')&&req.method==='GET'||['/api/login','/api/native-read-snapshot','/api/typed-read'].includes(path)&&req.method==='POST'))return context(req)?json({error:'PERMISSION_DENIED'},403):json({error:'teacher_authentication_required'},401);
      if(path==='/health'&&req.method==='GET')return json({status:'running',studentDisclosure:false});
      if((path==='/'||path==='/setup'||path==='/reset')&&req.method==='GET')return new Response(options.page??'Private teacher application',{headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8',
        ...(trial&&url.hostname===admittedHost&&Date.parse(trial.expiresAt)>Date.now()?{'Origin-Trial':trial.token}:{})}});
      if(path==='/client.js'&&req.method==='GET')return new Response(options.script??'',{headers:{...securityHeaders,'Content-Type':'text/javascript; charset=utf-8'}});
      if(path==='/teacher-ko-76f45ef4.ttf'&&req.method==='GET')return new Response(Bun.file(new URL('./web/assets/NanumGothic-Regular.ttf',import.meta.url)),{headers:{...securityHeaders,'Content-Type':'font/ttf','Cache-Control':'public, max-age=31536000, immutable'}});
      if(Object.hasOwn(teacherFontAssets,path)&&req.method==='GET'){
        const asset=teacherFontAssets[path as keyof typeof teacherFontAssets];
        return new Response(Bun.file(new URL('./web/assets/'+asset.file,import.meta.url)),{headers:{...securityHeaders,'Content-Type':'font/woff2','Cache-Control':'public, max-age=31536000, immutable'}});
      }
      if(path==='/api/setup-session'&&req.method==='POST'){
        const data=await body(req);assertExactKeys(data,['invitation']);
        if(identity||!invitationDigest||typeof data.invitation!=='string'||secretDigest(data.invitation)!==invitationDigest)return json({error:'setup_not_admitted'},403);
        await options.consumeInvitation?.();
        invitationDigest=null;
        const token=signTeacherSession(sessionKey,options.app.ownerId,'bootstrap-owner',undefined,900);
        return json({status:'owner_setup_admitted'},200,{'Set-Cookie':cookie('dc_setup',token,900)});
      }
      if(path==='/api/setup-user'&&req.method==='POST'){
        const token=readCookie(req.headers.get('Cookie'),'dc_setup');const grant=token?verifyTeacherSession(sessionKey,token):null;
        if(identity||setupRunning||!grant||grant.ownerId!==options.app.ownerId||grant.actorId!=='bootstrap-owner')return json({error:'setup_not_admitted'},403);
        const data=await body(req);assertExactKeys(data,['username','password']);
        if(typeof data.username!=='string'||!data.username.trim()||data.username.length>200||typeof data.password!=='string'||data.password.length<10||data.password.length>1024)return json({error:'invalid_credentials_shape'},400);
        // Body intake yielded: another request or the authoritative store may have consumed admission.
        if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
        const currentGrant=token?verifyTeacherSession(sessionKey,token):null;
        if(identity||setupRunning||!currentGrant||currentGrant.ownerId!==options.app.ownerId||currentGrant.actorId!=='bootstrap-owner')return json({error:'setup_not_admitted'},403);
        setupRunning=true;
        try{
          const newIdentity:LoginIdentity={actorId:crypto.randomUUID(),username:data.username,passwordHash:await Bun.password.hash(data.password)};
          await options.saveIdentity(newIdentity);identity=newIdentity;
          return json({status:'teacher_registered'},200,{'Set-Cookie':cookie('dc_teacher',signTeacherSession(sessionKey,options.app.ownerId,newIdentity.actorId))});
        }finally{setupRunning=false;}
      }
      if(path==='/api/login'&&req.method==='POST'){
        const now=Date.now(),remote=(req.headers.get('CF-Connecting-IP')??'direct-loopback').slice(0,64);
        const rateLimit=authenticationRateLimit(remote,now,'login_rate_limited');if(rateLimit)return rateLimit;
        const data=await body(req);assertExactKeys(data,['username','password']);
        const loginIdentity=identity,loginKey=sessionKey;
        if(!loginIdentity||typeof data.username!=='string'||typeof data.password!=='string'||data.password.length>1024||data.username!==loginIdentity.username||!await Bun.password.verify(data.password,loginIdentity.passwordHash))return json({error:'login_required'},401);
        const current=options.currentAuthentication?.()??{identity,sessionKey};
        if(current.sessionKey!==loginKey||current.identity?.actorId!==loginIdentity.actorId||current.identity.passwordHash!==loginIdentity.passwordHash||current.identity.username!==loginIdentity.username)return json({error:'login_required'},401);
        const lifetime=options.typedRead?.qualification?.loginLifetime?.()??3600;
        return json({status:'teacher_authenticated'},200,{'Set-Cookie':cookie('dc_teacher',signTeacherSession(loginKey,options.app.ownerId,loginIdentity.actorId,undefined,lifetime),lifetime)});
      }
      if(path==='/api/password-recovery-request'&&req.method==='POST'){
        if(!identity||!options.passwordRecovery)return json({error:'password_recovery_denied'},403);
        const now=Date.now(),remote='recovery-request:'+(req.headers.get('CF-Connecting-IP')??'direct-loopback').slice(0,64);
        const rateLimit=authenticationRateLimit(remote,now,'recovery_rate_limited');if(rateLimit)return rateLimit;
        const data=await body(req);assertExactKeys(data,[]);
        const requestRef=crypto.randomUUID(),expiresAt=Math.floor(now/1000)+900;
        return json({status:'owner_approval_required',requestRef,expiresAt,referenceGrantsAccess:false},200,{'Set-Cookie':cookie('dc_password_recovery',signTeacherSession(sessionKey,options.app.ownerId,'password-recovery:'+requestRef,undefined,900),900)});
      }
      if(path==='/api/password-recovery-session'&&req.method==='POST'){
        if(!identity||!options.passwordRecovery)return json({error:'password_recovery_denied'},403);
        const now=Date.now(),remote='recovery:'+(req.headers.get('CF-Connecting-IP')??'direct-loopback').slice(0,64);
        const rateLimit=authenticationRateLimit(remote,now,'recovery_rate_limited');if(rateLimit)return rateLimit;
        const data=await body(req);assertExactKeys(data,['token']);
        if(typeof data.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.token))return json({error:'password_recovery_denied'},403);
        const grant=await options.passwordRecovery.claim(data.token);
        const lifetime=grant.expiresAt-Math.floor(Date.now()/1000);
        if(lifetime<1||lifetime>900)throw Error('password_recovery_denied');
        return json({status:'password_recovery_admitted',username:identity.username},200,{'Set-Cookie':cookie('dc_password_recovery',signTeacherSession(sessionKey,options.app.ownerId,'password-recovery:'+grant.id,undefined,lifetime),lifetime)});
      }
      if(path==='/api/password-recovery-status'&&req.method==='GET'){
        const raw=readCookie(req.headers.get('Cookie'),'dc_password_recovery'),grant=raw?verifyTeacherSession(sessionKey,raw):null;
        if(!options.passwordRecovery||!identity||!grant||grant.ownerId!==options.app.ownerId||!grant.actorId.startsWith('password-recovery:'))return json({error:'password_recovery_denied'},403);
        await options.passwordRecovery.status(grant.actorId.slice('password-recovery:'.length));
        return json({status:'password_recovery_admitted',username:identity.username});
      }
      if(path==='/api/password-reset'&&req.method==='POST'){
        const raw=readCookie(req.headers.get('Cookie'),'dc_password_recovery'),grant=raw?verifyTeacherSession(sessionKey,raw):null;
        if(!options.passwordRecovery||!identity||resetRunning||!grant||grant.ownerId!==options.app.ownerId||!grant.actorId.startsWith('password-recovery:'))return json({error:'password_recovery_denied'},403);
        const data=await body(req);assertExactKeys(data,['password']);
        if(typeof data.password!=='string'||data.password.length<10||data.password.length>1024)return json({error:'invalid_credentials_shape'},400);
        if(resetRunning)return json({error:'password_recovery_denied'},403);
        resetRunning=true;
        try{
          const next=await options.passwordRecovery.complete(grant.actorId.slice('password-recovery:'.length),await Bun.password.hash(data.password));
          identity=next.identity;sessionKey=next.sessionKey;
          return json({status:'teacher_password_reset',username:identity.username,requiresLogin:true},200,{'Set-Cookie':cookie('dc_password_recovery','',0)});
        }finally{resetRunning=false;}
      }
      if(path==='/design-lab'){
        if(req.method!=='GET')return json({error:'method_not_allowed'},405);
        if(!context(req))return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><title>교사 로그인 필요</title><h1>교사 로그인이 필요합니다</h1><p>디자인 샘플은 교사 전용입니다.</p><a href="/">로그인 화면으로 이동</a></html>',{status:401,headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8'}});
        return new Response(renderDesignLab(url.searchParams),{headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8'}});
      }
      if(path.startsWith('/api/')){
        const actor=context(req);if(!actor)return preDispatchRefusal('teacher_authentication_required',401);
        if(path==='/api/native-read-descriptor'){
          if(req.method!=='GET')return json({error:'method_not_allowed'},405);
          if(url.href.includes('?'))return json({error:'unexpected_query_scope'},400);
          // Never consume even an empty supplied stream or trust a framing header over its presence.
          const length=req.headers.get('Content-Length');
          if(req.body!==null||req.bodyUsed||req.headers.has('Transfer-Encoding')||length!==null&&length!=='0')return json({error:'native_metadata_body_forbidden'},400);
          const operationId=req.headers.get('X-Native-Metadata-Operation-Id');
          if(!operationId||operationId.length!==36||!nativeMetadataOperationIdPattern.test(operationId))return json({error:'native_metadata_operation_id_required'},400);
          if(req.signal.aborted)return json({error:'request_aborted'},499);
          const admittedKey=sessionKey,admittedUsername=identity!.username,admittedPasswordHash=identity!.passwordHash;
          const descriptor={schema:'academy.native-read-descriptor/1',operationId,observedAtUtc:new Date().toISOString(),
            sourceSetSha256:buildDescriptor.sourceSetSha256,serviceInstanceRef:buildDescriptor.serviceInstanceRef,
            principal:{authenticated:true,role:'teacher',ownerBindingMatched:true},
            nativeReadInterface:null,syntheticTestAdmission:null,retentionQualification:'UNVERIFIED'};
          // No awaited work or application dispatch: refresh the same principal at output linearization.
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const after=context(req);
          if(sessionKey!==admittedKey||identity?.username!==admittedUsername||identity.passwordHash!==admittedPasswordHash||!after||after.ownerId!==actor.ownerId||after.actorId!==actor.actorId)return json({error:'teacher_authentication_required'},401);
          if(req.signal.aborted)return json({error:'request_aborted'},499);
          if(Buffer.byteLength(JSON.stringify(descriptor),'utf8')>nativeReadDescriptorMaxBytes)return json({error:'native_read_descriptor_unavailable'},503);
          return json(descriptor);
        }
        if(path==='/api/native-read-snapshot'){
          if(req.method!=='POST')return json({error:'method_not_allowed'},405);
          if(url.search)return json({error:'unexpected_query_scope'},400);
          if(!options.typedRead)return json({error:'typed_read_unavailable'},503);
          let input:Record<string,unknown>;try{input=await body(req);}catch{return json({error:'INVALID_REQUEST'},400);}
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const currentActor=context(req);if(!currentActor||currentActor.ownerId!==actor.ownerId||currentActor.actorId!==actor.actorId)return json({error:'teacher_authentication_required'},401);
          const requestId=typeof input.requestId==='string'&&input.requestId?input.requestId:'unknown';
          const rawSession=readCookie(req.headers.get('Cookie'),'dc_teacher'),verifiedSession=rawSession?verifyTeacherSession(sessionKey,rawSession):null;
          if(!verifiedSession)return json({error:'teacher_authentication_required'},401);
          const service=typedReadServiceFor(sessionKey,verifiedSession.expiresAt*1000);if(!service)return json({error:'typed_read_unavailable'},503);
          try{
            const runtime=options.typedRead.cursorRuntime;
            if(runtime){if(currentActor.actorId!==runtime.actorId)throw new TypedReadRefusal('PERMISSION_DENIED',403);runtime.assertCurrent();}
            const result=await service.acquireSnapshot(currentActor,input as unknown as NativeSnapshotAcquireRequest);
            if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
            const after=context(req);return after?.ownerId===actor.ownerId&&after.actorId===actor.actorId?json(result):json({error:'teacher_authentication_required'},401);
          }catch(error){
            if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
            const after=context(req);if(!after||after.ownerId!==actor.ownerId||after.actorId!==actor.actorId)return json({error:'teacher_authentication_required'},401);
            if(error instanceof TypedReadRefusal)return json({kind:'ERROR',contractVersion:typedReadContractVersion,consumerProfile:options.typedRead?.consumerProfile??'CURRENT_1_1',requestId,correlationId:requestId,error:{code:error.code,retryable:false,correlationId:requestId,requiredEvidence:error.requiredEvidence,readResolution:error.code==='READ_UNRESOLVED'?'UNRESOLVED_READ':'NOT_APPLICABLE'}},error.httpStatus);
            return json({error:'typed_read_unavailable'},503);
          }
        }
        if(path==='/api/typed-read'){
          // Authenticated typed read: principal comes only from the existing
          // dc_teacher session cookie; header/body teacher claims are ignored
          // here and refused by the closed typed-read request validator.
          if(req.method!=='POST')return json({error:'method_not_allowed'},405);
          if(url.search)return json({error:'unexpected_query_scope'},400);
          if(!options.typedRead)return json({error:'typed_read_unavailable'},503);
          let input:Record<string,unknown>;try{input=await body(req);}catch{return json({error:'INVALID_REQUEST'},400);}
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const currentActor=context(req);if(!currentActor||currentActor.ownerId!==actor.ownerId||currentActor.actorId!==actor.actorId)return authenticationRequiredOutput();
          const requestId=typeof input.requestId==='string'&&input.requestId?input.requestId:'unknown';
          const qualification=options.typedRead.qualification;
          if(qualification){const token=readCookie(req.headers.get('Cookie'),'dc_teacher');const session=token?verifyTeacherSession(sessionKey,token):null;if(session)qualification.session(requestId,session.expiresAt);}
          const outputLease=options.typedRead?.outputLease;
          if(!outputLease){
            // W3-E2: the mandatory output lease is part of the qualification;
            // refuse at ingress with no commit or page when it is absent.
            return json({kind:'ERROR',contractVersion:typedReadContractVersion,consumerProfile:options.typedRead?.consumerProfile??'CURRENT_1_1',requestId,correlationId:requestId,error:{code:'OUTPUT_ADMISSION_BLOCKED',retryable:false,correlationId:requestId,requiredEvidence:['OWNER_INTERFACE_RATIFICATION'],readResolution:'NOT_APPLICABLE'}},409);
          }
          try{
            if(input.cursor!==null&&options.typedRead.cursorRuntime){
              // S2 short current-owner lease ends before preparatory business
              // evaluation. S6 uses a new capability and reopens from scratch.
              await outputLease(async leased=>{
                const currentAuthorization=()=>{const state=options.currentAuthentication?.()??{identity,sessionKey};identity=state.identity;sessionKey=state.sessionKey;const after=context(req);return leased.sessionKey===sessionKey&&after?.ownerId===currentActor.ownerId&&after.actorId===currentActor.actorId;};
                if(!currentAuthorization())throw Error('teacher_authentication_required');
                const raw=readCookie(req.headers.get('Cookie'),'dc_teacher'),session=raw?verifyTeacherSession(leased.sessionKey,raw):null;
                if(!session)throw Error('teacher_authentication_required');
                await typedReadServiceFor(leased.sessionKey,session.expiresAt*1000,cursorOwnerFor(leased,currentAuthorization))!.verifyContinuation(currentActor,input as unknown as TypedReadRequest);
              });
            }
            // W3-E3: expiry/session recheck and buffered Response preparation
            // run inside the lease callback, after the committed read and
            // with no await before the handoff.
            return await outputLease(async leased=>{
              if(leased.sessionKey!==sessionKey||leased.identity?.actorId!==currentActor.actorId)return authenticationRequiredOutput();
              const currentAuthorization=()=>{
                if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
                const after=context(req);
                return sessionKey===leased.sessionKey&&after?.ownerId===actor.ownerId&&after.actorId===actor.actorId;
              };
              const rawSession=readCookie(req.headers.get('Cookie'),'dc_teacher'),verifiedSession=rawSession?verifyTeacherSession(leased.sessionKey,rawSession):null;
              if(!verifiedSession)return authenticationRequiredOutput();
              const cursorOwner=cursorOwnerFor(leased,currentAuthorization);
              const service=typedReadServiceFor(leased.sessionKey,verifiedSession.expiresAt*1000,cursorOwner)!;
              let reply:BufferedTypedReadOutput;
              try{
                const pairedId=qualification?.pairedRequestId(requestId);
                if(pairedId){
                  // Two genuine service preparations under the same actual auth
                  // lease. Each independently admits and locks its own read key.
                  const second=structuredClone(input) as unknown as TypedReadRequest;
                  second.requestId=pairedId;second.functionRequest.requestId=pairedId;
                  const both=await Promise.all([service.typedReadBuffered(currentActor,input as unknown as TypedReadRequest,currentAuthorization),service.typedReadBuffered(currentActor,second,currentAuthorization)]);
                  reply=both[0];
                  if(both[1].status!==200)throw new TypedReadRefusal('READ_UNRESOLVED',503);
                }else reply=await service.typedReadBuffered(currentActor,input as unknown as TypedReadRequest,currentAuthorization);
              }
              catch(error){
                if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
                const failedAfter=context(req);if(!failedAfter||failedAfter.ownerId!==actor.ownerId||failedAfter.actorId!==actor.actorId)return authenticationRequiredOutput();
                if(error instanceof TypedReadRefusal)return json({kind:'ERROR',contractVersion:typedReadContractVersion,consumerProfile:options.typedRead?.consumerProfile??'CURRENT_1_1',requestId,correlationId:requestId,error:{code:error.code,retryable:false,correlationId:requestId,requiredEvidence:error.requiredEvidence,readResolution:error.code==='READ_UNRESOLVED'?'UNRESOLVED_READ':'NOT_APPLICABLE'}},error.httpStatus);
                throw error;
              }
              const authorized=currentAuthorization();
              // A qualification expiry uses the actual verified session deadline.
              // No await or business reserialization follows the known COMMIT.
              if(!authorized){qualification?.handoff(requestId,401,0,false);return authenticationRequiredOutput();}
              if(qualification?.handoff(requestId,reply.status,reply.body?.byteLength??0,true)==='SUPPRESS')return new Response(null,{status:503,headers:securityHeaders});
              // Exact gate-prepared bytes, known COMMIT, same auth lease;
              // no JSON serialization or await before the Response handoff.
              return new Response(reply.body,{status:reply.status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});
            });
          }catch(error){
            if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
            const after=context(req);if(!after||after.ownerId!==actor.ownerId||after.actorId!==actor.actorId)return authenticationRequiredOutput();
            if(error instanceof Error&&error.message==='teacher_authentication_required')return authenticationRequiredOutput();
            if(error instanceof Error&&error.message==='private_auth_lock_required')return json({error:'READ_UNRESOLVED',readResolution:'UNRESOLVED_READ',automaticRetry:false},503);
            if(error instanceof TypedReadRefusal)return json({kind:'ERROR',contractVersion:typedReadContractVersion,consumerProfile:options.typedRead?.consumerProfile??'CURRENT_1_1',requestId,correlationId:requestId,error:{code:error.code,retryable:false,correlationId:requestId,requiredEvidence:error.requiredEvidence,readResolution:error.code==='READ_UNRESOLVED'?'UNRESOLVED_READ':'NOT_APPLICABLE'}},error.httpStatus);
            return json({error:'typed_read_unavailable'},503);
          }
        }
        if(path==='/api/native-prerequisite'||path==='/api/native-prereq/teachers/update'||Object.hasOwn(nativePrereqRouteAliases,path)){
          // Authenticated prerequisite wrapper: principal only from the
          // dc_teacher cookie above; Origin/body gates already applied.
          // No body/header principal authority is read. The facade keeps
          // first-self-BindTeacher, refusal and no-replay semantics.
          if(req.method!=='POST')return json({error:'method_not_allowed'},405);
          if(url.search)return json({error:'unexpected_query_scope'},400);
          let data:Record<string,unknown>;
          try{data=await body(req);}catch(e){console.error(JSON.stringify({status:'NATIVE_PREREQUISITE_INPUT_REJECTED',code:'body:'+(e instanceof Error&&/^[a-z0-9_]{1,60}$/.test(e.message)?e.message:'unparsable'),automaticRetry:false}));return json({error:'invalid_native_prerequisite_input'},400);}
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const currentActor=context(req);if(!currentActor||currentActor.ownerId!==actor.ownerId||currentActor.actorId!==actor.actorId)return json({error:'teacher_authentication_required'},401);
          let operation:string;let input:Record<string,unknown>;
          if(path==='/api/native-prereq/teachers/update'){
            // Closed compatibility alias for the qualification probe URL:
            // direct UpdateTeacherInput; RETIRED payload state retires.
            input=data;
            const payload=(data as {payload?:unknown}).payload;
            operation=payload&&typeof payload==='object'&&(payload as {state?:unknown}).state==='RETIRED'?'retireTeacher':'updateTeacher';
          }else if(Object.hasOwn(nativePrereqRouteAliases,path)){
            // Adopted RC4 named alias: direct operation input, same facade.
            operation=nativePrereqRouteAliases[path as keyof typeof nativePrereqRouteAliases];
            input=data;
          }else{
            try{assertExactKeys(data,['operation','input']);}catch{console.error(JSON.stringify({status:'NATIVE_PREREQUISITE_INPUT_REJECTED',code:'envelope_keys:'+Object.keys(data).sort().join(',').slice(0,80),automaticRetry:false}));return json({error:'invalid_native_prerequisite_input'},400);}
            if(typeof data.operation!=='string'||!(nativePrerequisiteOperations as readonly string[]).includes(data.operation))return json({error:'invalid_operation'},400);
            operation=data.operation;
            if(!data.input||typeof data.input!=='object'||Array.isArray(data.input))return json({error:'invalid_native_prerequisite_input'},400);
            input=data.input as Record<string,unknown>;
          }
          const invalidInput=()=>{console.error(JSON.stringify({status:'NATIVE_PREREQUISITE_INPUT_REJECTED',code:'input_keys:'+String(operation)+':'+Object.keys(input).sort().join(',').slice(0,120),automaticRetry:false}));return json({error:'invalid_native_prerequisite_input'},400);};
          const exactInputKeys=(expected:readonly string[]):boolean=>{
            const keys=Object.keys(input);
            return keys.every(key=>expected.includes(key))&&expected.filter(key=>!['afterSequence','limit'].includes(key)).every(key=>keys.includes(key));
          };
          const stringField=(field:string):string|null=>typeof input[field]==='string'&&(input[field] as string).length>0?input[field] as string:null;
          const stillAuthorized=():boolean=>{
            if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
            const after=context(req);return !!after&&after.ownerId===actor.ownerId&&after.actorId===actor.actorId;
          };
          const prerequisiteError=(error:unknown):Response=>{
            const code=error instanceof Error?error.message:'';
            if(code==='prerequisite_store_required')return json({error:'native_prerequisite_unavailable'},503);
            if(code==='committed_outcome_uncertain')return json({error:code,automaticRetry:false,readOriginalRequestBeforeNewIntent:true},503);
            if(['teacher_binding_required','teacher_binding_inactive','teacher_attribution_conflict','owner_scope_conflict','student_scope_conflict'].includes(code))return json({error:code},403);
            if(inputRefusals.has(code))return json({error:code},400);
            const declared=declaredRefusalStatus.get(code);
            if(declared)return json(declared===409?{error:code,automaticRetry:false}:{error:code},declared);
            // Designed domain refusals are conflicts, not internal failures.
            if(code.includes('conflict')||/^(approval_|duplicate_|completeness_|stale_)/.test(code)||['stale_base','revision_conflict','idempotency_reuse','identity_collision','teacher_binding_exists','invalid_transition','temporal_overlap'].includes(code))return json({error:code,automaticRetry:false},409);
            if(code.startsWith('invalid_')||code.endsWith('_required')||code==='unexpected or missing domain fields'||code==='sha256_required'||code.includes('must be nonempty'))return json({error:code},400);
            // Unexpected failure: log only a closed code or class plus throw-site frames (no payloads) so it is diagnosable.
            const at=error instanceof Error?[...(error.stack??'').matchAll(/\/([A-Za-z_]+\.ts):(\d+):\d+/g)].slice(0,4).map(x=>x[1]+':'+x[2]).join('<'):'';
            console.error(JSON.stringify({status:'NATIVE_PREREQUISITE_FAILED',code:(/^[a-z0-9_]{1,100}$/.test(code)?code:(error instanceof Error?error.constructor.name:'UNKNOWN'))+(at?'@'+at:''),automaticRetry:false}));
            return json({error:'native_prerequisite_failed',automaticRetry:false},503);
          };
          // W12-F1 fence: ordinary teacher transport must never mark a
          // read COMPLETED. Only the internal owner-witness commit path
          // (commitReadOutput) may do so; REFUSED/UNKNOWN cleanup and all
          // other operations keep their existing dispatch.
          if(operation==='finalizeReadOccurrence'&&(input as {status?:unknown}).status==='COMPLETED')return json({error:'read_completion_owner_witness_required',automaticRetry:false},403);
          let result:unknown;
          try{
            switch(operation){
              case 'bindTeacher': result=await options.app.bindTeacher(currentActor,input as never); break;
              case 'updateTeacher': result=await options.app.updateTeacher(currentActor,input as never); break;
              case 'retireTeacher': result=await options.app.retireTeacher(currentActor,input as never); break;
              case 'createClassGroup': result=await options.app.createClassGroup(currentActor,input as never); break;
              case 'updateClassGroup': result=await options.app.updateClassGroup(currentActor,input as never); break;
              case 'createLessonSession': result=await options.app.createLessonSession(currentActor,input as never); break;
              case 'updateLessonSession': result=await options.app.updateLessonSession(currentActor,input as never); break;
              case 'upsertTemporalBinding': result=await options.app.upsertTemporalBinding(currentActor,input as never); break;
              case 'attachStudentRevision': result=await options.app.attachStudentRevision(currentActor,input as never); break;
              case 'updateStudentRevision': result=await options.app.updateStudentRevision(currentActor,input as never); break;
              case 'attachActivityScope': result=await options.app.attachActivityScope(currentActor,input as never); break;
              case 'correctActivityScope': result=await options.app.correctActivityScope(currentActor,input as never); break;
              case 'createProgress': result=await options.app.createProgress(currentActor,input as never); break;
              case 'correctProgress': result=await options.app.correctProgress(currentActor,input as never); break;
              case 'createAssessment': result=await options.app.createAssessment(currentActor,input as never); break;
              case 'correctAssessment': result=await options.app.correctAssessment(currentActor,input as never); break;
              case 'createDraft': result=await options.app.createDraft(currentActor,input as never); break;
              case 'updateDraft': result=await options.app.updateDraft(currentActor,input as never); break;
              case 'recordScoreEvidence': result=await options.app.recordScoreEvidence(currentActor,input as never); break;
              case 'previewApprovalClosure': result=await options.app.previewApprovalClosure(currentActor,input as never); break;
              case 'issueApproval': result=await options.app.issueApproval(currentActor,input as never); break;
              case 'approveDraft': result=await options.app.approveDraft(currentActor,input as never); break;
              case 'revokeApproval': result=await options.app.revokeApproval(currentActor,input as never); break;
              case 'commandOutcome': result=await options.app.commandOutcome(currentActor,input as never); break;
              case 'fenceCommand': result=await options.app.fenceCommand(currentActor,input as never); break;
              case 'admitReadOccurrence': result=await options.app.admitReadOccurrence(currentActor,input as never); break;
              case 'finalizeReadOccurrence': result=await options.app.finalizeReadOccurrence(currentActor,input as never); break;
              case 'readOccurrence': result=await options.app.readOccurrence(currentActor,input as never); break;
              case 'prerequisiteTeachers': if(!exactInputKeys([]))return invalidInput(); result=await options.app.prerequisiteTeachers(currentActor); break;
              case 'prerequisiteTeacher': { if(!exactInputKeys(['teacherKey'])||!stringField('teacherKey'))return invalidInput(); result=await options.app.prerequisiteTeacher(currentActor,stringField('teacherKey')!); break; }
              case 'ownTeacherBinding': if(!exactInputKeys([]))return invalidInput(); result=await options.app.ownTeacherBinding(currentActor); break;
              case 'prerequisiteClassGroups': if(!exactInputKeys([]))return invalidInput(); result=await options.app.prerequisiteClassGroups(currentActor); break;
              case 'prerequisiteClassGroup': { if(!exactInputKeys(['classKey'])||!stringField('classKey'))return invalidInput(); result=await options.app.prerequisiteClassGroup(currentActor,stringField('classKey')!); break; }
              case 'prerequisiteLessons': if(!exactInputKeys([]))return invalidInput(); result=await options.app.prerequisiteLessons(currentActor); break;
              case 'prerequisiteLesson': { if(!exactInputKeys(['lessonKey'])||!stringField('lessonKey'))return invalidInput(); result=await options.app.prerequisiteLesson(currentActor,stringField('lessonKey')!); break; }
              case 'prerequisiteTemporalBindings': if(!exactInputKeys([]))return invalidInput(); result=await options.app.prerequisiteTemporalBindings(currentActor); break;
              case 'prerequisiteActivityScopes': { if(!Object.keys(input).every(key=>['activityKind','activityEntityId','lessonKey'].includes(key)))return invalidInput(); result=await options.app.prerequisiteActivityScopes(currentActor,input as never); break; }
              case 'prerequisiteStudentRevision': { if(!exactInputKeys(['studentId'])||!stringField('studentId'))return invalidInput(); result=await options.app.prerequisiteStudentRevision(currentActor,stringField('studentId')!); break; }
              case 'prerequisiteStudentRevisionHistory': { if(!exactInputKeys(['studentId','afterSequence','limit'])||!stringField('studentId'))return invalidInput(); result=await options.app.prerequisiteStudentRevisionHistory(currentActor,stringField('studentId')!,typeof input.afterSequence==='number'?input.afterSequence:0,typeof input.limit==='number'?input.limit:200); break; }
              case 'prerequisiteApproval': { if(!exactInputKeys(['approvalId'])||!stringField('approvalId'))return invalidInput(); result=await options.app.prerequisiteApproval(currentActor,stringField('approvalId')!); break; }
              case 'prerequisiteOwnerRevision': { if(!exactInputKeys(['family','entityKey','revisionId'])||!stringField('family')||!stringField('entityKey')||!stringField('revisionId'))return invalidInput(); result=await options.app.prerequisiteOwnerRevision(currentActor,stringField('family') as never,stringField('entityKey')!,stringField('revisionId')!); break; }
              case 'prerequisiteOwnerHistory': { if(!exactInputKeys(['family','entityKey','afterSequence','limit'])||!stringField('family')||!stringField('entityKey'))return invalidInput(); result=await options.app.prerequisiteOwnerHistory(currentActor,stringField('family') as never,stringField('entityKey')!,typeof input.afterSequence==='number'?input.afterSequence:0,typeof input.limit==='number'?input.limit:200); break; }
              case 'prerequisiteScoreEvidence': { if(!exactInputKeys(['entityKey'])||!stringField('entityKey'))return invalidInput(); result=await options.app.prerequisiteScoreEvidence(currentActor,stringField('entityKey')!); break; }
              case 'prerequisiteScoreEvidenceForAttempt': { if(!exactInputKeys(['attemptRef'])||!input.attemptRef||typeof input.attemptRef!=='object')return invalidInput(); result=await options.app.prerequisiteScoreEvidenceForAttempt(currentActor,input.attemptRef as never); break; }
              default: return json({error:'invalid_operation'},400);
            }
          }catch(error){
            if(!stillAuthorized())return json({error:'teacher_authentication_required'},401);
            return prerequisiteError(error);
          }
          if(!stillAuthorized())return json({error:'teacher_authentication_required'},401);
          return json(result===undefined?null:result);
        }
        if(path==='/api/retained-query'){
          if(req.method!=='POST'||url.search)return json({error:'unexpected_query_scope'},400);
          let input:Record<string,unknown>;try{input=await body(req);}catch{return json({error:'retained_query_input_invalid'},400);}
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const currentActor=context(req);if(!currentActor||currentActor.ownerId!==actor.ownerId||currentActor.actorId!==actor.actorId)return json({error:'teacher_authentication_required'},401);
          const reply=await options.app.retainedQuery(currentActor,input);
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const after=context(req);return after?.ownerId===actor.ownerId&&after.actorId===actor.actorId?json(reply):json({error:'teacher_authentication_required'},401);
        }
        if(['/api/preserved-history','/api/preserved-history-records','/api/preserved-history-record','/api/preserved-history-artifact'].includes(path)){
          if(req.method!=='GET')return json({error:'method_not_allowed'},405);
          const required=path==='/api/preserved-history'?[]:path==='/api/preserved-history-artifact'?['id','snapshot']:['namespace','scope','snapshot',...(url.searchParams.get('scope')==='student'?['studentId']:[]),...(path==='/api/preserved-history-record'?['recordId']:[])];
          const allowed=[...required,...(path==='/api/preserved-history-records'?['cursor']:[])];
          if([...url.searchParams.keys()].some(key=>!allowed.includes(key))||required.some(key=>url.searchParams.getAll(key).length!==1)||allowed.some(key=>url.searchParams.getAll(key).length>1))return json({error:'unexpected_query_scope'},400);
          if(!preservedHistory)return json({error:'preserved_history_unavailable'},503);
          const stillAuthorized=()=>{if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}const current=context(req);return current?.ownerId===actor.ownerId&&current.actorId===actor.actorId;};
          try{
            if(path==='/api/preserved-history'){const value=await preservedHistory.index(actor);return stillAuthorized()?json(value):json({error:'teacher_authentication_required'},401);}
            const snapshot=url.searchParams.get('snapshot')!;
            if(path==='/api/preserved-history-artifact'){const value=await preservedHistory.artifact(actor,url.searchParams.get('id')!,snapshot);return stillAuthorized()?new Response(value.body,{headers:{...securityHeaders,...value.headers}}):json({error:'teacher_authentication_required'},401);}
            const scope=url.searchParams.get('scope'),selection:PreservedSelection={namespace:url.searchParams.get('namespace')!,scope:scope as PreservedSelection['scope'],...(scope==='student'?{studentId:url.searchParams.get('studentId')!}:{})};
            const value=path==='/api/preserved-history-record'?await preservedHistory.detail(actor,selection,url.searchParams.get('recordId')!,snapshot):await preservedHistory.page(actor,selection,url.searchParams.get('cursor'),snapshot);
            return stillAuthorized()?json(value):json({error:'teacher_authentication_required'},401);
          }catch(error){
            if(!stillAuthorized())return json({error:'teacher_authentication_required'},401);
            const code=error instanceof Error?error.message:'';
            if(['owner_scope_conflict','preserved_namespace_conflict','preserved_student_scope_conflict','preserved_record_scope_conflict','preserved_artifact_scope_conflict','artifact_student_scope_conflict'].includes(code))return json({error:'preserved_history_scope_conflict'},403);
            if(['preserved_snapshot_conflict','preserved_cursor_scope_conflict'].includes(code))return json({error:'preserved_history_snapshot_conflict'},409);
            if(['preserved_selection_invalid','preserved_cursor_invalid','preserved_record_selector_invalid','preserved_artifact_selector_invalid'].includes(code))return json({error:'invalid_preserved_history_selector'},400);
            return json({error:'preserved_history_unavailable'},503);
          }
        }
        if(path==='/api/curated-concept-candidates'){
          if(req.method!=='GET')return json({error:'method_not_allowed'},405);
          if(url.searchParams.size)return json({error:'unexpected_query_scope'},400);
          try{return json(curatedConceptCandidates.read(actor));}
          catch{return json({error:'curated_concept_candidates_unavailable',teacherPersistence:false,studentLinksCreated:0},503);}
        }
        if(['/api/private-artifacts','/api/private-artifact'].includes(path)&&req.method==='GET'){
          if(path==='/api/private-artifacts'&&url.searchParams.size||path==='/api/private-artifact'&&([...url.searchParams.keys()].some(key=>key!=='id')||url.searchParams.getAll('id').length!==1))return json({error:'unexpected_query_scope'},400);
          if(!options.privateArtifacts)return path==='/api/private-artifacts'?json({state:'not_configured',sourceIdentity:'unverified_preservation',artifacts:[]}):json({error:'private_artifact_unavailable'},503);
          const stillAuthorized=()=>{
            if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
            const current=context(req);return current?.ownerId===actor.ownerId&&current.actorId===actor.actorId;
          };
          try{
            if(path==='/api/private-artifacts'){const result=await options.privateArtifacts.list(actor);return stillAuthorized()?json(result):json({error:'teacher_authentication_required'},401);}
            const result=await options.privateArtifacts.read(actor,url.searchParams.get('id')!);
            if(!stillAuthorized())return json({error:'teacher_authentication_required'},401);
            return new Response(result.body,{headers:{...securityHeaders,...result.headers}});
          }catch(error){
            const code=error instanceof Error?error.message:'';
            if(['owner_scope_conflict','artifact_student_scope_conflict'].includes(code))return json({error:'artifact_scope_conflict'},403);
            if(code==='private_artifact_not_found')return json({error:'private_artifact_not_found'},404);
            if(code==='invalid_artifact_selector')return json({error:'invalid_artifact_selector'},400);
            return json({error:'private_artifact_unavailable'},503);
          }
        }
        if(['/api/teacher-observation','/api/teacher-clinic','/api/teacher-workspace','/api/owner-workspace','/api/exam-candidate','/api/concept-definition','/api/concept-link','/api/refresh'].includes(path)&&req.method==='POST'){
          const conflict=()=>json({error:'teacher_scene_actor_conflict',originalRetained:false,automaticRetry:false},409);
          if(!matchesTeacherActionHeaders(req.headers,actor))return conflict();
          let input:Record<string,unknown>;try{input=await body(req);}catch(error){if(['/api/teacher-workspace','/api/owner-workspace','/api/concept-definition','/api/concept-link'].includes(path)){const code=error instanceof Error&&['json_required','input_too_large','invalid_input'].includes(error.message)?error.message:'invalid_input';return json({error:code,requestOutcome:'rejected_before_commit',automaticRetry:false},400);}throw error;}
          // Body intake can yield while authentication changes in another tab.
          if(options.currentAuthentication){const current=options.currentAuthentication();identity=current.identity;sessionKey=current.sessionKey;}
          const currentActor=context(req);if(!currentActor)return preDispatchRefusal('teacher_authentication_required',401);
          if(!matchesTeacherActionHeaders(req.headers,currentActor))return conflict();
          if(path==='/api/refresh'){
            assertExactKeys(input,Object.hasOwn(input,'date')?['studentId','requestId','date']:['studentId','requestId']);
            if(input.date!==undefined&&(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date+'T00:00:00Z'))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date))return json({error:'invalid_refresh_date'},400);
            if(input.studentId!==null&&typeof input.studentId!=='string')return json({error:'invalid_refresh_scope'},400);
            if(typeof input.requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId))return json({error:'source_request_id_required'},400);
            if(!options.refresh)return json({status:'blocked',reason:'native_source_connector_unavailable',cacheRetained:true},503);
            return json(await options.refresh(currentActor,{studentId:input.studentId as string|null,requestId:input.requestId,...(input.date?{date:input.date as string}:{})}));
          }
          if(path==='/api/teacher-workspace')return json(await options.app.saveTeacherWorkspace(currentActor,input));
          if(path==='/api/concept-definition')return json(await options.app.saveConceptDefinition(currentActor,input));
          if(path==='/api/concept-link')return json(await options.app.saveStudentConceptLink(currentActor,input));
          if(path==='/api/exam-candidate')return json(await options.app.projectExamCandidate(currentActor,input));
          if(path==='/api/owner-workspace')return json(await options.app.saveOwnerWorkspace(currentActor,input));
          return json(path==='/api/teacher-observation'?await options.app.saveObservation(currentActor,input):await options.app.saveClinicDecision(currentActor,input));
        }
        if(path==='/api/concept-graph'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='studentId')||url.searchParams.getAll('studentId').length!==1)return json({error:'unexpected_query_scope'},400);return json(await options.app.studentConceptGraph(actor,url.searchParams.get('studentId')!));
        }
        if(path==='/api/concept-evidence'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','revisionId'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('revisionId').length!==1)return json({error:'unexpected_query_scope'},400);return json(await options.app.conceptEvidence(actor,url.searchParams.get('studentId')!,url.searchParams.get('revisionId')!));
        }
        if(path==='/api/concept-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','requestId'].includes(key))||url.searchParams.getAll('requestId').length!==1||url.searchParams.getAll('studentId').length>1)return json({error:'unexpected_query_scope'},400);return json(await options.app.conceptResult(actor,url.searchParams.get('requestId')!,url.searchParams.get('studentId')));
        }
        if(path==='/api/concept-history'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','entityId','afterSequence'].includes(key))||url.searchParams.getAll('entityId').length!==1||url.searchParams.getAll('studentId').length>1||url.searchParams.getAll('afterSequence').length>1)return json({error:'unexpected_query_scope'},400);return json(await options.app.conceptHistory(actor,url.searchParams.get('entityId')!,url.searchParams.get('studentId'),Number(url.searchParams.get('afterSequence')??0)));
        }
        if(path==='/api/book-certification'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','registrationRevisionId'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('registrationRevisionId').length!==1)return json({error:'unexpected_query_scope'},400);return json(await options.app.bookCertification(actor,url.searchParams.get('studentId')!,url.searchParams.get('registrationRevisionId')!));
        }
        if(path==='/api/teacher-workspace-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','requestId'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('requestId').length!==1)return json({error:'unexpected_query_scope'},400);
          return json(await options.app.teacherWorkspaceResult(actor,url.searchParams.get('studentId')!,url.searchParams.get('requestId')!));
        }
        if(path==='/api/teacher-workspace-history'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','entityId','afterSequence'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('entityId').length!==1||url.searchParams.getAll('afterSequence').length>1)return json({error:'unexpected_query_scope'},400);
          return json(await options.app.teacherWorkspaceHistory(actor,url.searchParams.get('studentId')!,url.searchParams.get('entityId')!,Number(url.searchParams.get('afterSequence')??0)));
        }
        if(path==='/api/operating-catalog'&&req.method==='GET'){
          if(url.searchParams.size)return json({error:'unexpected_query_scope'},400);return json(await options.app.operatingCatalog(actor));
        }
        if(path==='/api/operating-context'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['policyId','revision'].includes(key))||url.searchParams.getAll('revision').length!==1)return json({error:'unexpected_query_scope'},400);return json(await options.app.operatingSelection(actor,url.searchParams.getAll('policyId'),url.searchParams.get('revision')!));
        }
        if(path==='/api/owner-workspaces'&&req.method==='GET'){
          if(url.searchParams.size)return json({error:'unexpected_query_scope'},400);return json(await options.app.ownerWorkspaces(actor));
        }
        if(path==='/api/owner-workspace-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='requestId')||url.searchParams.getAll('requestId').length!==1)return json({error:'unexpected_query_scope'},400);return json(await options.app.ownerWorkspaceResult(actor,url.searchParams.get('requestId')!));
        }
        if(path==='/api/owner-workspace-history'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['entityId','afterSequence'].includes(key))||url.searchParams.getAll('entityId').length!==1||url.searchParams.getAll('afterSequence').length>1)return json({error:'unexpected_query_scope'},400);return json(await options.app.ownerWorkspaceHistory(actor,url.searchParams.get('entityId')!,Number(url.searchParams.get('afterSequence')??0)));
        }
        if(path==='/api/teacher-clinic-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','requestId'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('requestId').length!==1)return json({error:'unexpected_query_scope'},400);
          return json(await options.app.clinicResult(actor,url.searchParams.get('studentId')!,url.searchParams.get('requestId')!));
        }
        if(path==='/api/teacher-observation-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>!['studentId','requestId'].includes(key))||url.searchParams.getAll('studentId').length!==1||url.searchParams.getAll('requestId').length!==1)return json({error:'unexpected_query_scope'},400);
          return json(await options.app.observationResult(actor,url.searchParams.get('studentId')!,url.searchParams.get('requestId')!));
        }
        if(path==='/api/cohort'&&req.method==='GET')return json(await options.app.cohort(actor));
        if(path==='/api/source-refresh-result'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='requestId')||url.searchParams.getAll('requestId').length!==1||!options.refreshResult)return json({error:'unexpected_query_scope'},400);
          return json(await options.refreshResult(actor,url.searchParams.get('requestId')!));
        }
        if(path==='/api/source-refresh-pending'&&req.method==='GET'){
          if(url.searchParams.size!==0||!options.refreshPending)return json({error:'unexpected_query_scope'},400);
          return json(await options.refreshPending(actor));
        }
        if(path==='/api/source-refresh-history'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='cursor')||url.searchParams.getAll('cursor').length>1||!options.refreshHistory)return json({error:'unexpected_query_scope'},400);
          return json(await options.refreshHistory(actor,url.searchParams.get('cursor')));
        }
        if(path==='/api/class'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='date')||url.searchParams.getAll('date').length!==1)return json({error:'unexpected_query_scope'},400);
          const date=url.searchParams.get('date');if(!date)return json({error:'date_required'},400);
          return json(await options.app.classPreparation(actor,date));
        }
        if(path==='/api/student'&&req.method==='GET'){
          if([...url.searchParams.keys()].some(key=>key!=='id'&&key!=='date')||url.searchParams.getAll('id').length!==1||url.searchParams.getAll('date').length>1)return json({error:'unexpected_query_scope'},400);
          const id=url.searchParams.get('id');if(!id)return json({error:'student_required'},400);
          return json(await options.app.student(actor,id,url.searchParams.get('date')??undefined));
        }

        return json({error:'unknown_operation'},404);
      }
      return json({error:'not_found'},404);
    }catch(error){
      if(path==='/api/native-read-descriptor')return json({error:'native_read_descriptor_unavailable'},503);
      const code=error instanceof Error?error.message:'operation_failed';
      if(error instanceof TeacherWorkspaceRefusal)return json({error:error.message,requestOutcome:'rejected_before_commit',automaticRetry:false},error.message.includes('scope_conflict')?403:error.phase==='transaction'?409:400);
      if(error instanceof ClinicCommandRefusal||error instanceof ObservationCommandRefusal)return json({error:code,originalRetained:error.originalRetained,automaticRetry:false},409);
      if(['stale_base','stale_evidence_basis','idempotency_reuse','observation_basis_conflict','work_assignment_basis_conflict','work_attempt_basis_conflict','work_item_binding_conflict','clinic_target_identity_conflict','unresolved_clinic_request','unresolved_observation_request','workspace_target_identity_conflict','operational_revision_conflict','operational_step_binding_conflict','operational_evidence_scope_conflict','operational_assignment_confirmation_required','operational_deferred_boundary','owner_workspace_identity_changed','explicit_reopen_required','explicit_case_reopen_required','workspace_identity_changed','work_paper_binding_conflict','mindmap_activity_scope_conflict'].includes(code))return json({error:code,originalRetained:false,requestOutcome:'rejected_before_commit',automaticRetry:false},409);
      if(code==='committed_outcome_uncertain')return json({error:code,automaticRetry:false,readOriginalRequestBeforeNewIntent:true},503);
      if(code==='observation_result_not_found'||code==='clinic_result_not_found'||code==='workspace_result_not_found'||code==='concept_result_not_found'||code==='concept_evidence_not_found')return json({error:code,automaticRetry:false},404);
      const workspaceCodes=['invalid_workspace_input','unexpected_workspace_attribution','unsupported_teacher_workspace','unsupported_owner_workspace','parent_internal_language_excluded','parent_line_format','parent_line_evidence_conflict','explicit_teacher_understanding_required','explicit_reopen_reason_required','video_upload_review_conflict','invalid_paper_scope','invalid_activity_score','invalid_parent_draft','invalid_workspace_references','invalid_workspace_text','invalid_workspace_state','invalid_operational_boundary','invalid_operational_checklist','invalid_operational_revision','invalid_operational_case','mindmap_explanation_link_required','original_wrong_applicability_conflict','invalid_unknown_subset','duplicate_selected_policy','selected_operational_policy_missing','workspace_history_scope_conflict','invalid_history_range'];
      if(workspaceCodes.includes(code))return json({error:code,automaticRetry:false},400);
      if(req.method==='POST'&&['/api/teacher-workspace','/api/owner-workspace','/api/concept-definition','/api/concept-link'].includes(new URL(req.url).pathname))return json({error:'workspace_outcome_uncertain',automaticRetry:false,readOriginalRequestBeforeNewIntent:true},503);
      const safe=['owner_scope_conflict','student_scope_conflict','invalid_student_selector','invalid_input','json_required','input_too_large','password_recovery_denied','unexpected or missing domain fields'].includes(code)?code:'operation_failed';
      return json({error:safe},safe.includes('scope_conflict')||safe==='password_recovery_denied'?403:400);
    }
  };
}
