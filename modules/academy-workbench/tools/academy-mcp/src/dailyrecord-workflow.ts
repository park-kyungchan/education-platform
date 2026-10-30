import {createHash,createPrivateKey,createPublicKey,randomUUID,sign,verify,type KeyObject} from 'node:crypto';
import {closeSync,fsyncSync,linkSync,lstatSync,mkdirSync,openSync,readFileSync,readdirSync,renameSync,rmSync,unlinkSync,writeFileSync,writeSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import {canonicalActionDigest,canonicalJson} from './dailyrecord-save-admission.ts';
import {dailyRecordFieldSchema,dailyRecordIdSchema,dailyRecordScopeSchema,type DailyRecordField,type DailyRecordScope} from './dailyrecord-context.ts';
import {readPinnedLocalBytes} from './item-label-store.ts';

/**
 * Owner-managed DailyRecord request/review/authorization/execution/audit
 * workflow. Records are immutable once published and live in one owner
 * directory shared by every participating MCP process on this host, so a
 * review, authorization or uncertain dispatch survives restart and actor
 * handoff. Authority comes only from owner-pinned public keys: an actor proof
 * authenticates the calling runtime, and an owner-issued signed authorization
 * binds one actual user event to exact student/date/field/before/after tuples
 * and review policy. Caller labels, flags and unsigned documents never
 * authorize. The shared lock covers participating writers on this host only.
 */
const hash=z.string().regex(/^[a-f0-9]{64}$/),instant=z.iso.datetime({offset:true});
const principalId=z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,127}$/);
const sha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export const payloadDigest=(value:unknown)=>sha256(canonicalJson(value));
export const workflowStoreScope='single_host_owner_filesystem' as const;

const kinds=['observation','review','authorization','consumption','outcome','reconciliation','nonce'] as const;
type Kind=typeof kinds[number];
const errno=(error:unknown)=>(error as NodeJS.ErrnoException)?.code;
function syncDirectory(path:string){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
function exclusiveWrite(dir:string,target:string,bytes:string):boolean{
  const temporary=resolve(dir,'.tmp-'+randomUUID());
  const fd=openSync(temporary,'wx',0o600);
  try{writeSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  // link(2) publishes the complete file atomically and refuses an existing name.
  try{linkSync(temporary,target);}catch(error){unlinkSync(temporary);if(errno(error)==='EEXIST')return false;throw error;}
  unlinkSync(temporary);syncDirectory(dir);return true;
}
const alive=(pid:unknown)=>{
  if(typeof pid!=='number'||!Number.isSafeInteger(pid)||pid<1)return false;
  try{process.kill(pid,0);return true;}catch(error){return errno(error)==='EPERM';}
};

export class DailyRecordWorkflowStore {
  readonly scope=workflowStoreScope;
  constructor(readonly root:string){
    for(const dir of ['',...kinds,'audit','locks'])mkdirSync(resolve(root,dir),{recursive:true,mode:0o700});
  }
  #file(kind:Kind,id:string){return resolve(this.root,kind,sha256(kind+'\n'+id)+'.json');}
  /** Exclusive immutable publish; an existing record is returned, never replaced. */
  publishOnce(kind:Kind,id:string,record:unknown):{created:boolean;record:unknown}{
    if(exclusiveWrite(resolve(this.root,kind),this.#file(kind,id),JSON.stringify({kind,id,record})+'\n'))return {created:true,record};
    return {created:false,record:this.get(kind,id)};
  }
  get(kind:Kind,id:string):unknown{
    let bytes:string;
    try{bytes=readFileSync(this.#file(kind,id),'utf8');}catch(error){if(errno(error)==='ENOENT')return null;throw error;}
    const parsed=JSON.parse(bytes) as {kind:unknown;id:unknown;record:unknown};
    if(parsed.kind!==kind||parsed.id!==id)throw Error('workflow_store_record_identity_conflict');
    return parsed.record;
  }
  /** Append-only, metadata-only audit events. Never place field text here. */
  appendAudit(requestKey:string,event:Record<string,unknown>){
    const dir=resolve(this.root,'audit',sha256(requestKey));mkdirSync(dir,{recursive:true,mode:0o700});
    const at=new Date().toISOString(),name=Date.now().toString().padStart(15,'0')+'-'+randomUUID()+'.json';
    exclusiveWrite(dir,resolve(dir,name),JSON.stringify({requestKey,at,pid:process.pid,...event})+'\n');
  }
  audit(requestKey:string,limit=256):Record<string,unknown>[]{
    const dir=resolve(this.root,'audit',sha256(requestKey));
    let names:string[];try{names=readdirSync(dir).filter(n=>n.endsWith('.json')&&!n.startsWith('.')).sort();}catch(error){if(errno(error)==='ENOENT')return [];throw error;}
    return names.slice(-limit).map(n=>JSON.parse(readFileSync(resolve(dir,n),'utf8')) as Record<string,unknown>).filter(e=>e.requestKey===requestKey);
  }
  /** Cross-process mutual exclusion for participating writers on this host. */
  async withLock<T>(key:string,run:()=>Promise<T>,options:{waitMs?:number;pollMs?:number}={}):Promise<T>{
    const dir=resolve(this.root,'locks',sha256(key)),token=randomUUID(),deadline=Date.now()+(options.waitMs??30000);
    for(;;){
      try{
        mkdirSync(dir,{mode:0o700});
        writeFileSync(resolve(dir,'holder.json'),JSON.stringify({pid:process.pid,token,acquiredAt:new Date().toISOString()}),{mode:0o600,flag:'wx'});
        break;
      }catch(error){
        if(errno(error)!=='EEXIST')throw error;
        this.#breakIfAbandoned(dir);
        if(Date.now()>deadline)throw Error('shared_writer_lock_busy');
        await new Promise(r=>setTimeout(r,options.pollMs??20));
      }
    }
    try{return await run();}
    finally{if(this.#holder(dir)?.token===token)rmSync(dir,{recursive:true,force:true});}
  }
  #holder(dir:string):{pid:unknown;token:unknown}|null{try{return JSON.parse(readFileSync(resolve(dir,'holder.json'),'utf8'));}catch{return null;}}
  #olderThan(path:string,ms:number){try{return Date.now()-lstatSync(path).mtimeMs>ms;}catch{return false;}}
  /** Break only a lock whose holder process is gone (or that never recorded
   * a holder). A guard directory makes the check-and-break single-winner. */
  #breakIfAbandoned(dir:string){
    const first=this.#holder(dir);
    if(first?alive(first.pid):!this.#olderThan(dir,5000))return;
    const guard=dir+'.break';
    try{mkdirSync(guard,{mode:0o700});}catch{if(this.#olderThan(guard,10000))rmSync(guard,{recursive:true,force:true});return;}
    try{
      const again=this.#holder(dir);
      const abandoned=again?again.token===first?.token&&!alive(again.pid):first===null&&this.#olderThan(dir,5000);
      if(!abandoned)return;
      const grave=dir+'.abandoned-'+randomUUID();
      try{renameSync(dir,grave);}catch{return;}
      rmSync(grave,{recursive:true,force:true});
    }finally{rmSync(guard,{recursive:true,force:true});}
  }
}

const registryEntry=z.object({id:principalId,publicKeySpkiPem:z.string().min(40).max(4096),status:z.enum(['active','revoked'])}).strict();
export const actorRegistrySchema=z.object({schemaVersion:z.literal('academy.dailyrecord-actor-registry/1'),principals:z.array(registryEntry).min(1).max(64)}).strict();
export const issuerRegistrySchema=z.object({schemaVersion:z.literal('academy.dailyrecord-authorization-issuers/1'),principals:z.array(registryEntry).min(1).max(16)}).strict();
type Principals=Map<string,{status:'active'|'revoked';key:KeyObject}>;
function principals(entries:z.infer<typeof registryEntry>[]):Principals{
  const map:Principals=new Map();
  for(const entry of entries){
    if(map.has(entry.id))throw Error('workflow_registry_duplicate_principal');
    const key=createPublicKey(entry.publicKeySpkiPem);
    if(key.asymmetricKeyType!=='ed25519')throw Error('workflow_registry_ed25519_required');
    map.set(entry.id,{status:entry.status,key});
  }
  return map;
}
const verifySignature=(message:unknown,key:KeyObject,signature:string)=>{
  try{return verify(null,Buffer.from(canonicalJson(message),'utf8'),key,Buffer.from(signature,'base64'));}catch{return false;}
};
const signMessage=(message:unknown,privateKey:KeyObject|string)=>
  sign(null,Buffer.from(canonicalJson(message),'utf8'),typeof privateKey==='string'?createPrivateKey(privateKey):privateKey).toString('base64');
type Rejected={status:'rejected';reasonCode:string};
const reject=(reasonCode:string):Rejected=>({status:'rejected',reasonCode});

export const actorProofSchema=z.object({schemaVersion:z.literal('academy.dailyrecord-actor-proof/1'),actorId:principalId,issuedAt:instant,
  nonce:z.string().regex(/^[A-Za-z0-9-]{16,64}$/),tool:z.string().regex(/^academy_[a-z_]{1,80}$/),payloadSha256:hash,signature:z.string().min(16).max(1024)}).strict();
export type DailyRecordActorProof=z.infer<typeof actorProofSchema>;
/** Runtime-side signer: the payload is the schema-normalized tool input without its proof. */
export function signActorProof(privateKey:KeyObject|string,actorId:string,tool:string,payload:unknown,now=Date.now()):DailyRecordActorProof{
  const unsigned={schemaVersion:'academy.dailyrecord-actor-proof/1' as const,actorId,issuedAt:new Date(now).toISOString(),nonce:randomUUID(),tool,payloadSha256:payloadDigest(payload)};
  return {...unsigned,signature:signMessage(unsigned,privateKey)};
}
export class ActorVerifier {
  readonly #principals:Principals|null;
  constructor(registry:z.infer<typeof actorRegistrySchema>|null,readonly store:DailyRecordWorkflowStore,readonly now:()=>number=Date.now){
    this.#principals=registry?principals(actorRegistrySchema.parse(registry).principals):null;
  }
  get configured(){return this.#principals!==null;}
  verify(tool:string,payload:unknown,proof:unknown):{status:'authenticated';actorId:string}|Rejected{
    if(!this.#principals)return reject('actor_authentication_unavailable');
    if(proof===undefined)return reject('actor_proof_required');
    const parsed=actorProofSchema.safeParse(proof);if(!parsed.success)return reject('actor_proof_invalid');
    const {signature,...unsigned}=parsed.data,principal=this.#principals.get(unsigned.actorId);
    if(!principal||principal.status!=='active')return reject('actor_not_registered');
    if(unsigned.tool!==tool)return reject('actor_proof_tool_mismatch');
    const age=this.now()-Date.parse(unsigned.issuedAt);if(age<-60000||age>300000)return reject('actor_proof_stale');
    if(unsigned.payloadSha256!==payloadDigest(payload))return reject('actor_proof_payload_mismatch');
    if(!verifySignature(unsigned,principal.key,signature))return reject('actor_signature_invalid');
    if(!this.store.publishOnce('nonce',unsigned.actorId+'\n'+unsigned.nonce,{tool,issuedAt:unsigned.issuedAt}).created)return reject('actor_proof_replayed');
    return {status:'authenticated',actorId:unsigned.actorId};
  }
}

const policyPins=z.object({
  learningPolicy:z.object({bundleSha256:hash,configSha256:hash,catalogSha256:hash}).strict().nullable(),
  parentSafeguard:z.object({policySha256:hash,safeguardSourceSha256:hash}).strict().nullable(),
}).strict();
export type DailyRecordReviewPolicyPins=z.infer<typeof policyPins>;
export const dailyRecordAuthorizationSchema=z.object({
  schemaVersion:z.literal('academy.dailyrecord-save-authorization/1'),
  authorizationId:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  issuerId:principalId,issuedAt:instant,expiresAt:instant,
  /** The actual user instruction the issuer observed; the issuer is accountable for it. */
  userEvent:z.object({eventRef:dailyRecordIdSchema,channel:dailyRecordIdSchema,observedAt:instant,textSha256:hash}).strict(),
  requestRef:dailyRecordIdSchema,
  authorizedActors:z.array(principalId).min(1).max(16),
  reviewPolicy:policyPins,
  basedOnReviewDigests:z.array(hash).min(1).max(16),
  actions:z.array(z.object({scope:dailyRecordScopeSchema,field:dailyRecordFieldSchema,before:z.string().max(8192),after:z.string().max(8192)}).strict()).min(1).max(12),
  /** Saving never authorizes parent transmission; that stays a separate explicit instruction. */
  parentTransmission:z.literal('not_authorized'),
}).strict().superRefine((value,context)=>{
  const keys=value.actions.map(a=>canonicalJson([a.scope,a.field]));
  if(new Set(keys).size!==keys.length)context.addIssue({code:'custom',message:'duplicate_authorized_action'});
  if(value.actions.some(a=>a.before===a.after))context.addIssue({code:'custom',message:'authorized_action_must_change_value'});
  if(new Set(value.authorizedActors).size!==value.authorizedActors.length)context.addIssue({code:'custom',message:'duplicate_authorized_actor'});
  const issued=Date.parse(value.issuedAt),expires=Date.parse(value.expiresAt);
  if(!(issued<expires)||expires-issued>24*3600000)context.addIssue({code:'custom',message:'authorization_validity_window_invalid'});
  if(Date.parse(value.userEvent.observedAt)>issued)context.addIssue({code:'custom',message:'user_event_after_issue'});
});
export type DailyRecordAuthorization=z.infer<typeof dailyRecordAuthorizationSchema>;
export const signedAuthorizationSchema=z.object({authorization:z.unknown(),signature:z.string().min(16).max(1024)}).strict();
export type SignedDailyRecordAuthorization={authorization:DailyRecordAuthorization;signature:string};
/** Owner-issuer side; exported so an owner issuer and synthetic tests share one encoding. */
export function signAuthorization(privateKey:KeyObject|string,authorization:DailyRecordAuthorization):SignedDailyRecordAuthorization{
  const parsed=dailyRecordAuthorizationSchema.parse(authorization);
  return {authorization:parsed,signature:signMessage(parsed,privateKey)};
}
export class AuthorizationVerifier {
  readonly #issuers:Principals|null;
  constructor(registry:z.infer<typeof issuerRegistrySchema>|null,readonly now:()=>number=Date.now){
    this.#issuers=registry?principals(issuerRegistrySchema.parse(registry).principals):null;
  }
  get configured(){return this.#issuers!==null;}
  verify(value:unknown):{status:'verified';authorization:DailyRecordAuthorization;signed:SignedDailyRecordAuthorization}|Rejected{
    if(!this.#issuers)return reject('dailyrecord_authorization_issuer_not_configured');
    if(value===undefined)return reject('request_authorization_required');
    const envelope=signedAuthorizationSchema.safeParse(value);if(!envelope.success)return reject('authorization_invalid');
    const parsed=dailyRecordAuthorizationSchema.safeParse(envelope.data.authorization);if(!parsed.success)return reject('authorization_invalid');
    const authorization=parsed.data,issuer=this.#issuers.get(authorization.issuerId);
    if(!issuer||issuer.status!=='active')return reject('authorization_issuer_not_registered');
    // Verify the bytes as supplied: parsing must not have normalized anything.
    if(!same(authorization,envelope.data.authorization))return reject('authorization_invalid');
    if(!verifySignature(authorization,issuer.key,envelope.data.signature))return reject('authorization_signature_invalid');
    const now=this.now();
    if(now<Date.parse(authorization.issuedAt)-60000)return reject('authorization_not_yet_valid');
    if(now>Date.parse(authorization.expiresAt))return reject('authorization_expired');
    return {status:'verified',authorization,signed:{authorization,signature:envelope.data.signature}};
  }
}

export interface DailyRecordWorkflow {
  readonly store:DailyRecordWorkflowStore;
  readonly actors:ActorVerifier;
  readonly authorizations:AuthorizationVerifier;
}
export function createDailyRecordWorkflow(input:{storeDir:string;actorRegistry:z.infer<typeof actorRegistrySchema>|null;issuerRegistry:z.infer<typeof issuerRegistrySchema>|null;now?:()=>number}):DailyRecordWorkflow{
  const store=new DailyRecordWorkflowStore(input.storeDir),now=input.now??Date.now;
  return {store,actors:new ActorVerifier(input.actorRegistry,store,now),authorizations:new AuthorizationVerifier(input.issuerRegistry,now)};
}
/** Launch flags. The store alone is allowed (actors/issuers then fail closed with precise reasons). */
export async function dailyRecordWorkflowConfiguration(args:readonly string[],options:{requiredRoot?:string}={}):Promise<{remainingArgs:string[];workflow:DailyRecordWorkflow|null;storeDir:string|null}>{
  const remainingArgs:string[]=[];let storeDir:string|null=null,actors:unknown=null,issuers:unknown=null;
  for(let i=0;i<args.length;i++){
    const flag=args[i]!;
    if(flag==='--dailyrecord-workflow-store'){
      if(storeDir||i+1>=args.length||!args[i+1]!.startsWith('/'))throw Error('dailyrecord_workflow_store_arguments_invalid');
      storeDir=args[++i]!;continue;
    }
    if(flag==='--dailyrecord-actor-registry'||flag==='--dailyrecord-authorization-issuers'){
      if(i+2>=args.length||(flag==='--dailyrecord-actor-registry'?actors:issuers)!==null)throw Error('dailyrecord_workflow_registry_arguments_invalid');
      const pinned=await readPinnedLocalBytes(args[i+1]!,args[i+2]!),value=JSON.parse(pinned.bytes.toString('utf8'));
      if(flag==='--dailyrecord-actor-registry')actors=actorRegistrySchema.parse(value);else issuers=issuerRegistrySchema.parse(value);
      i+=2;continue;
    }
    remainingArgs.push(flag);
  }
  if(!storeDir&&(actors||issuers))throw Error('dailyrecord_workflow_store_required');
  if(storeDir&&options.requiredRoot&&(!resolve(storeDir).startsWith(options.requiredRoot)||resolve(storeDir)!==storeDir))throw Error('dailyrecord_workflow_store_owner_root_required');
  return {remainingArgs,storeDir,workflow:storeDir?createDailyRecordWorkflow({storeDir,actorRegistry:actors as never,issuerRegistry:issuers as never}):null};
}

export const workflowRequestKey=(scope:DailyRecordScope,requestRef:string)=>canonicalJson({scope,requestRef});
/** Per-student lock: current and previous-record fields of one student serialize together. */
export const workflowLockKey=(scope:DailyRecordScope)=>canonicalJson({sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId});
export const executionKey=(authorizationId:string,scope:DailyRecordScope,field:DailyRecordField)=>canonicalJson({authorizationId,scope,field});
export type FieldExecutionState='available'|'dispatch_outcome_unknown'|'reconciliation_required'|'settled_persisted'|'settled_noop'|'settled_not_persisted'
  |'reconciled_persisted'|'reconciled_not_persisted'|'reconciled_conflict';
export function fieldExecutionState(store:DailyRecordWorkflowStore,key:string):FieldExecutionState{
  const reconciled=store.get('reconciliation',key) as {classification:'persisted'|'not_persisted'|'conflict'}|null;
  if(reconciled)return ('reconciled_'+reconciled.classification) as FieldExecutionState;
  const outcome=store.get('outcome',key) as {status:string}|null;
  if(outcome)return outcome.status==='persisted'?'settled_persisted':outcome.status==='noop'?'settled_noop':outcome.status==='not_persisted'?'settled_not_persisted':'reconciliation_required';
  return store.get('consumption',key)?'dispatch_outcome_unknown':'available';
}
export const needsReconciliation=(state:FieldExecutionState)=>state==='dispatch_outcome_unknown'||state==='reconciliation_required';
export const settledEffect=(state:FieldExecutionState)=>state==='settled_persisted'||state==='settled_noop'||state==='reconciled_persisted';
/** A consumed authorization whose effect did not land needs a new authorization; it is never replayed. */
export const consumedWithoutEffect=(state:FieldExecutionState)=>state==='settled_not_persisted'||state==='reconciled_not_persisted'||state==='reconciled_conflict';

export type JournalAction=Readonly<{attemptId:string;target:{studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string};field:string;effectRecordKey:string;before:string;after:string;wireDigest:string}>;
export interface DailyRecordActionApproval {consumeApproval(action:JournalAction):Promise<{status:'verified';actionDigest:string}|{status:'rejected'}>}
/** Request-bound replacement for the launch-pinned admission: each exact
 * reviewed and authorized action is durably consumed once, before dispatch. */
export function requestBoundApproval(store:DailyRecordWorkflowStore,input:{authorization:DailyRecordAuthorization;actorId:string;reviewDigest:string;scope:DailyRecordScope;
  reviewed:readonly {field:DailyRecordField;before:string;after:string;effectRecordKey:string}[]}):DailyRecordActionApproval{
  return {async consumeApproval(action){
    const reviewed=input.reviewed.find(p=>p.field===action.field);
    const authorized=input.authorization.actions.find(a=>same(a.scope,input.scope)&&a.field===action.field);
    if(!reviewed||!authorized||action.target.studentKey!==input.scope.studentId||action.target.teacherKey!==input.scope.teacherId||action.target.date!==input.scope.lessonDate
      ||action.effectRecordKey!==reviewed.effectRecordKey||action.before!==reviewed.before||action.after!==reviewed.after
      ||action.before!==authorized.before||action.after!==authorized.after)return {status:'rejected'};
    const actionDigest=canonicalActionDigest(action);
    const created=store.publishOnce('consumption',executionKey(input.authorization.authorizationId,input.scope,reviewed.field),{
      authorizationId:input.authorization.authorizationId,scope:input.scope,field:reviewed.field,actorId:input.actorId,reviewDigest:input.reviewDigest,
      attemptId:action.attemptId,effectRecordKey:action.effectRecordKey,beforeSha256:sha256(action.before),afterSha256:sha256(action.after),actionDigest,
      consumedAt:new Date().toISOString()}).created;
    return created?{status:'verified',actionDigest}:{status:'rejected'};
  }};
}
export const textDigest=sha256;
export {same as canonicalSame};
