import {createHash,randomUUID} from 'node:crypto';
import {dlopen,FFIType} from 'bun:ffi';
import {closeSync,fsyncSync,linkSync,lstatSync,mkdirSync,openSync,readFileSync,readdirSync,realpathSync,unlinkSync,writeSync} from 'node:fs';
import {resolve} from 'node:path';
import {z} from 'zod';
import {canonicalActionDigest,canonicalJson} from './dailyrecord-save-admission.ts';
import {dailyRecordIdSchema,type DailyRecordField,type DailyRecordScope} from './dailyrecord-context.ts';

/**
 * Owner-managed DailyRecord request/review/execution/audit workflow.
 *
 * Accountability model (user direction 2026-10-30): any session the user
 * delegates to may save; every record says who did what. Each request
 * carries the user's verbatim instruction, and every observation, review,
 * execution and reconciliation records the runtime attribution observed by
 * the bridge (MCP client, process, Herdr pane) plus the caller's declared
 * actor. Attribution is evidence for audit, not a credential.
 *
 * Safety invariants stay independent of who calls: a prior recorded review,
 * a fresh recomputed review under a shared writer lock, one dispatch per
 * exact request/field transition, durable execution records before
 * dispatch, authoritative readback, and no replay of an uncertain effect
 * on the same record field under any request until reconciled. Records are
 * immutable files in one owner directory shared by every participating
 * process on this host.
 */
const instant=z.iso.datetime({offset:true});
const short=z.string().trim().min(1).max(200);
const sha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export const workflowStoreScope='single_host_owner_filesystem' as const;

const kinds=['observation','review','request','execution','outcome','reconciliation'] as const;
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
/** Kernel advisory lock (flock(2)): released by the kernel when the holder's
 * file description closes or its process dies, whatever its PID namespace.
 * The harness never judges another process's liveness itself. */
const LOCK_EX=2,LOCK_NB=4,LOCK_UN=8;
let libc:{symbols:{flock:(fd:number,operation:number)=>number}}|null=null;
const kernel=()=>libc??=dlopen('libc.so.6',{flock:{args:[FFIType.i32,FFIType.i32],returns:FFIType.i32}}) as never;

export class DailyRecordWorkflowStore {
  readonly scope=workflowStoreScope;
  constructor(readonly root:string){
    for(const dir of ['',...kinds,'ledger','audit','locks'])mkdirSync(resolve(root,dir),{recursive:true,mode:0o700});
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
  /** Field ledger: every execution key ever consumed for one record field, across all requests. */
  addToLedger(group:string,key:string){
    const dir=resolve(this.root,'ledger',sha256(group));mkdirSync(dir,{recursive:true,mode:0o700});
    exclusiveWrite(dir,resolve(dir,sha256(key)+'.json'),JSON.stringify({group,key})+'\n');
  }
  ledger(group:string):string[]{
    const dir=resolve(this.root,'ledger',sha256(group));
    let names:string[];try{names=readdirSync(dir).filter(n=>n.endsWith('.json')&&!n.startsWith('.'));}catch(error){if(errno(error)==='ENOENT')return [];throw error;}
    return names.map(n=>JSON.parse(readFileSync(resolve(dir,n),'utf8')) as {group:string;key:string}).filter(e=>e.group===group).map(e=>e.key).sort();
  }
  /** Append-only, metadata-only audit events. Never place field or instruction text here. */
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
  /** Mutual exclusion for every participating writer on this filesystem, by
   * kernel flock(2) on one lock file per key. Separate opens conflict even in
   * one process; a crashed holder's lock is released by the kernel. */
  async withLock<T>(key:string,run:()=>Promise<T>,options:{waitMs?:number;pollMs?:number}={}):Promise<T>{
    const fd=openSync(resolve(this.root,'locks',sha256(key)+'.flock'),'a',0o600),{flock}=kernel().symbols;
    const deadline=Date.now()+(options.waitMs??30000);
    try{
      while(flock(fd,LOCK_EX|LOCK_NB)!==0){
        if(Date.now()>deadline)throw Error('shared_writer_lock_busy');
        await new Promise(r=>setTimeout(r,options.pollMs??20));
      }
      try{return await run();}finally{flock(fd,LOCK_UN);}
    }finally{closeSync(fd);}
  }
}

/** What the caller says about itself; recorded as declared, never as verified. */
export const declaredActorSchema=z.object({runtime:short,sessionRef:short.optional(),paneRef:short.optional(),model:short.optional()}).strict();
/** Runtime facts observed by the neutral bridge (or the upstream itself when called directly). */
export const attributionSchema=z.object({
  schemaVersion:z.literal('academy.dailyrecord-attribution/1'),
  observedBy:z.enum(['neutral-bridge','upstream']),observedAt:instant,
  client:z.object({name:short,version:short}).strict().nullable(),
  process:z.object({pid:z.number().int().positive(),ppid:z.number().int().nonnegative(),uid:z.number().int().nonnegative().nullable(),
    parentCommand:short.nullable(),bridgeSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable()}).strict(),
  herdrPaneId:short.nullable(),
  declared:declaredActorSchema.nullable(),
}).strict();
export type DailyRecordAttribution=z.infer<typeof attributionSchema>;
const parentCommand=(ppid:number)=>{
  try{const argv=readFileSync(`/proc/${ppid}/cmdline`,'utf8').split('\0').filter(Boolean);
    return argv.slice(0,3).map(a=>a.split('/').pop()!).join(' ').slice(0,200)||null;}catch{return null;}
};
export function observeAttribution(input:{observedBy:'neutral-bridge'|'upstream';client:{name:string;version:string}|null;bridgeSha256:string|null;declared:unknown}):DailyRecordAttribution{
  const declared=declaredActorSchema.safeParse(input.declared);
  return attributionSchema.parse({schemaVersion:'academy.dailyrecord-attribution/1',observedBy:input.observedBy,observedAt:new Date().toISOString(),
    client:input.client?{name:input.client.name.slice(0,200)||'unknown',version:input.client.version.slice(0,200)||'unknown'}:null,
    process:{pid:process.pid,ppid:process.ppid,uid:process.getuid?.()??null,parentCommand:parentCommand(process.ppid),bridgeSha256:input.bridgeSha256},
    herdrPaneId:process.env.HERDR_PANE_ID?.trim().slice(0,200)||null,declared:declared.success?declared.data:null});
}
/** Compact attribution for audit lines. */
export const attributionSummary=(a:DailyRecordAttribution)=>({observedBy:a.observedBy,client:a.client?.name??null,pid:a.process.pid,
  parentCommand:a.process.parentCommand,herdrPaneId:a.herdrPaneId,declaredRuntime:a.declared?.runtime??null,declaredSession:a.declared?.sessionRef??null});

/** The user's instruction behind a save. Required; stored privately and referenced by digest in audit. */
export const userRequestSchema=z.object({
  requestRef:dailyRecordIdSchema,
  instruction:z.object({text:z.string().trim().min(1).max(4000),sessionRef:short.optional(),receivedAt:instant.optional()}).strict(),
}).strict();
export type DailyRecordUserRequest=z.infer<typeof userRequestSchema>;

export interface DailyRecordWorkflow {readonly store:DailyRecordWorkflowStore}
/** The store must sit under a real (non-symlink) owner root with no symlink
 * component, so records cannot escape to another location. */
function assertOwnerStorePath(storeDir:string,requiredRoot:string){
  if(resolve(storeDir)!==storeDir||!storeDir.startsWith(requiredRoot))throw Error('dailyrecord_workflow_store_owner_root_required');
  const root=requiredRoot.replace(/\/$/,'');
  if(realpathSync(root)!==root)throw Error('dailyrecord_workflow_store_owner_root_required');
  let current=root;
  for(const part of storeDir.slice(root.length).split('/').filter(Boolean)){
    current+='/'+part;
    try{if(lstatSync(current).isSymbolicLink())throw Error('dailyrecord_workflow_store_symlink_refused');}
    catch(error){if(errno(error)==='ENOENT')break;throw error;}
  }
}
export function createDailyRecordWorkflow(input:{storeDir:string;requiredRoot?:string}):DailyRecordWorkflow{
  if(input.requiredRoot)assertOwnerStorePath(input.storeDir,input.requiredRoot);
  return {store:new DailyRecordWorkflowStore(input.storeDir)};
}
/**
 * Launch flags only; nothing is created here. Native launches enable the
 * workflow by default inside the owner artifacts root, wherever the flags
 * appear; the server creates the store after the owner launch is verified.
 */
export function dailyRecordWorkflowConfiguration(args:readonly string[],options:{nativeDefaultStore?:string;requiredRoot?:string}={}):{remainingArgs:string[];storeDir:string|null}{
  const remainingArgs:string[]=[];let storeDir:string|null=null;
  for(let i=0;i<args.length;i++){
    if(args[i]!=='--dailyrecord-workflow-store'){remainingArgs.push(args[i]!);continue;}
    if(storeDir||i+1>=args.length||!args[i+1]!.startsWith('/'))throw Error('dailyrecord_workflow_store_arguments_invalid');
    storeDir=args[++i]!;
  }
  storeDir??=options.nativeDefaultStore??null;
  if(storeDir&&options.requiredRoot&&(resolve(storeDir)!==storeDir||!storeDir.startsWith(options.requiredRoot)))throw Error('dailyrecord_workflow_store_owner_root_required');
  return {remainingArgs,storeDir};
}

export const workflowRequestKey=(scope:DailyRecordScope,requestRef:string)=>canonicalJson({scope,requestRef});
/** Per-student lock: current and previous-record fields of one student serialize together. */
export const workflowLockKey=(scope:DailyRecordScope)=>canonicalJson({sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId});
/** One dispatch per exact request/field transition. */
export const executionKey=(requestRef:string,scope:DailyRecordScope,field:DailyRecordField,effectRecordKey:string,before:string,after:string)=>
  // Bound to the student and physical record, not the lesson date it was reached through.
  canonicalJson({requestRef,student:workflowLockKey(scope),field,effectRecordKey,beforeSha256:sha256(before),afterSha256:sha256(after)});
/** Every execution for one student, across dates and requests; filtered by physical record field. */
export const ledgerGroup=(scope:DailyRecordScope)=>workflowLockKey(scope);
export type FieldExecutionState='available'|'dispatch_outcome_unknown'|'reconciliation_required'|'settled_persisted'|'settled_noop'|'settled_not_persisted'
  |'reconciled_persisted'|'reconciled_not_persisted'|'reconciled_conflict';
export function fieldExecutionState(store:DailyRecordWorkflowStore,key:string):FieldExecutionState{
  const reconciled=store.get('reconciliation',key) as {classification:'persisted'|'not_persisted'|'conflict'}|null;
  if(reconciled)return ('reconciled_'+reconciled.classification) as FieldExecutionState;
  const outcome=store.get('outcome',key) as {status:string}|null;
  if(outcome)return outcome.status==='persisted'?'settled_persisted':outcome.status==='noop'?'settled_noop':outcome.status==='not_persisted'?'settled_not_persisted':'reconciliation_required';
  return store.get('execution',key)?'dispatch_outcome_unknown':'available';
}
export const needsReconciliation=(state:FieldExecutionState)=>state==='dispatch_outcome_unknown'||state==='reconciliation_required';
export const settledEffect=(state:FieldExecutionState)=>state==='settled_persisted'||state==='settled_noop'||state==='reconciled_persisted';
/** A transition that was dispatched without landing is never replayed under the same request. */
export const consumedWithoutEffect=(state:FieldExecutionState)=>state==='settled_not_persisted'||state==='reconciled_not_persisted'||state==='reconciled_conflict';
export type ExecutionRecord={requestRef:string;scope:DailyRecordScope;field:DailyRecordField;attribution:DailyRecordAttribution;reviewDigest:string;attemptId:string;
  effectRecordKey:string;beforeSha256:string;afterSha256:string;actionDigest:string;recordedAt:string};
/** Executions of one student. A ledger entry whose execution record was never
 * published (crash between the two writes) is skipped: it never dispatched. */
export function studentExecutions(store:DailyRecordWorkflowStore,scope:DailyRecordScope){
  return store.ledger(ledgerGroup(scope)).flatMap(key=>{const record=store.get('execution',key) as ExecutionRecord|null;return record?[{key,record,state:fieldExecutionState(store,key)}]:[];});
}
/** Any unresolved dispatch on this physical record field, reached through any lesson date or request, blocks a new one. */
export const unresolvedOnField=(store:DailyRecordWorkflowStore,scope:DailyRecordScope,field:DailyRecordField,effectRecordKey:string)=>
  studentExecutions(store,scope).filter(e=>e.record.field===field&&e.record.effectRecordKey===effectRecordKey&&needsReconciliation(e.state));

export type JournalAction=Readonly<{attemptId:string;target:{studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string};field:string;effectRecordKey:string;before:string;after:string;wireDigest:string}>;
export interface DailyRecordActionApproval {consumeApproval(action:JournalAction):Promise<{status:'verified';actionDigest:string}|{status:'rejected'}>}
/** Request-bound approval: each exact reviewed action is durably recorded
 * once, before dispatch, with its request and attribution. */
export function requestBoundApproval(store:DailyRecordWorkflowStore,input:{requestRef:string;attribution:DailyRecordAttribution;reviewDigest:string;scope:DailyRecordScope;
  reviewed:readonly {field:DailyRecordField;before:string;after:string;effectRecordKey:string}[]}):DailyRecordActionApproval{
  return {async consumeApproval(action){
    const reviewed=input.reviewed.find(p=>p.field===action.field);
    if(!reviewed||action.target.studentKey!==input.scope.studentId||action.target.teacherKey!==input.scope.teacherId||action.target.date!==input.scope.lessonDate
      ||action.effectRecordKey!==reviewed.effectRecordKey||action.before!==reviewed.before||action.after!==reviewed.after)return {status:'rejected'};
    const key=executionKey(input.requestRef,input.scope,reviewed.field,reviewed.effectRecordKey,action.before,action.after),actionDigest=canonicalActionDigest(action);
    // Ledger first: a crash between the two writes leaves an index entry that still reads as available.
    store.addToLedger(ledgerGroup(input.scope),key);
    const created=store.publishOnce('execution',key,{requestRef:input.requestRef,scope:input.scope,field:reviewed.field,attribution:input.attribution,reviewDigest:input.reviewDigest,
      attemptId:action.attemptId,effectRecordKey:action.effectRecordKey,beforeSha256:sha256(action.before),afterSha256:sha256(action.after),actionDigest,
      recordedAt:new Date().toISOString()}).created;
    return created?{status:'verified',actionDigest}:{status:'rejected'};
  }};
}
export const textDigest=sha256;
export {same as canonicalSame};
