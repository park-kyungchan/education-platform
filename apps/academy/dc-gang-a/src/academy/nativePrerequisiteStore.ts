import {assertProposalTexts,assertCompleteGrades} from './nativeCompleteness';
import {resolveActivityOccurrence,assertStudentOperationKind,activityScopeState,validateScopeMutation,fixedConsumerProfile,scopeActionDefinitions,ownerFamilies,type OwnerFamily,type NativeScoreEvidence,type ScoreEvidenceCommand} from './contracts/prerequisiteRecords';
import type {SQL} from 'bun';
import {randomUUID} from 'node:crypto';
import {assertDate,assertExactKeys,assertInstant,canonicalJson,digest,immutableCopy,requireText,stableId} from '../learning/model';
import type {TeacherPrerequisiteReadStore,ReadHorizonExpectation,ReadHorizonPlan} from './ports/teacherStore';
import {validateAcademyRecord,type AcademyRecord} from './records';
import {traceHierarchy,type CatalogNode} from './domain';
import type {RecordVersion} from './contracts/storageRecords';
import {educationTypes,validateContext,validateOwnerPayload,validateNativeStudentPayload,validateObjectRef,validateRequest,validateClosure,validateScope,validateSnapshot,validateKnowledge,validateNativeRef,validateRevision,scopeIdentity,validateAction,requestDigest,commandBinding,sha,type OwnerPayload,type OwnerVersion,type TeacherBinding,type ClassGroupRecord,type LessonSessionRecord,type TemporalBinding,type ActivityScopeLink,type StudentRecordPayload,type ApprovalVersionPayload,type OwnerAppendCommand,type StudentRevisionCommand,type CreateAssessmentCommand,type CreateDraftCommand,type CreateProgressCommand,type CorrectStudentCommand,type IssueApprovalCommand,type ApproveWithApprovalCommand,type RevokeApprovalCommand,type CommandContext,type NativeWriteResult,type NativeCommitReceipt,type ApprovalClosure,type ApprovalIssuance,type NativeStudentPayload,type RequestBinding,type AdmissionCommand,type FenceCommand,type OutcomeLookupResult,type AdmissionState,type ReadAdmission,type ReadFinalization,type ReadOccurrenceLookup,type EducationType,type ObjectRef,type NativeObjectRef,type LinkRevisionExpectation,type IdentityRevision,type RecordScope,type Knowledge,type EvidenceRef} from './contracts/prerequisiteRecords';

type Family=OwnerFamily;
/** Trusted composition only. This seam runs after genuine work in the same
 * transaction, with the exclusive owner lock still held. It grants no ingress. */
export type DependencyWriterHook=(operation:string,ownerId:string,key:string,tx:SQL)=>Promise<void>;
const tables={teacher:'teacher',class:'class',lesson:'lesson',binding:'binding',scope:'activity_scope',student:'student_record',approval:'approval',evidence:'native_score_evidence'} as const;
const kinds={teacher:'teacher_binding',class:'class_group',lesson:'lesson_session',binding:'temporal_binding',scope:'activity_scope',student:'student_record',approval:'teacher_approval',evidence:'native_score_evidence'} as const;
const objectTypes={teacher:'Teacher',class:'ClassGroup',lesson:'LessonSession',student:'Student'} as const;
interface BodyRow {body:OwnerVersion}
interface AdmissionRow {request:RequestBinding;state:AdmissionState;result:NativeWriteResult|null;proof_digest:string|null}
interface ReadRow {request:ReadAdmission;status:ReadOccurrenceLookup['status'];snapshot_digest:string|null;refusal_code:string|null}
interface StudentRow {owner_id:string;student_id:string;entity_id:string;sequence:number|string;revision_id:string;previous_revision_id:string|null;previous_digest:string|null;payload:AcademyRecord;content_digest:string;integrity_digest:string;source_observed_at:Date|string;recorded_at:Date|string;actor_id:string;idempotency_key:string;command_digest:string}
export function prerequisiteVersionFrom(v:OwnerVersion):OwnerVersion{assertExactKeys(v,['ownerId','namespace','scopeRef','entityKey','sequence','revisionId','previousRevisionId','previousDigest','payload','contentDigest','integrityDigest','sourceObservedAt','recordedAt','actorId','idempotencyKey','commandDigest']);validateOwnerPayload(v.payload);validateNativeRef(v.scopeRef);[v.ownerId,v.namespace,v.entityKey,v.revisionId,v.actorId,v.idempotencyKey,v.commandDigest].forEach(x=>requireText(x,'native version'));assertInstant(v.recordedAt);assertInstant(v.sourceObservedAt);if((v.sequence===1)!==(v.previousRevisionId===null&&v.previousDigest===null)||v.sequence>1&&(typeof v.previousRevisionId!=='string'||typeof v.previousDigest!=='string')||'ownerId' in v.payload&&v.payload.ownerId!==v.ownerId)throw Error('stored_revision_lineage');for(const field of ['teacherKey','classKey','lessonKey','bindingKey'] as const)if(field in v.payload&&Reflect.get(v.payload,field)!==v.entityKey)throw Error('stored_family_binding');const {integrityDigest,...body}=v;if(!Number.isSafeInteger(v.sequence)||v.sequence<1||digest(body)!==integrityDigest||digest(v.payload)!==v.contentDigest)throw Error('stored_revision_integrity');return immutableCopy(v);}
function studentVersion(row:StudentRow):RecordVersion{const v:RecordVersion={ownerId:row.owner_id,studentId:row.student_id,entityId:row.entity_id,sequence:Number(row.sequence),revisionId:row.revision_id,previousRevisionId:row.previous_revision_id,previousDigest:row.previous_digest,payload:row.payload,contentDigest:row.content_digest,integrityDigest:row.integrity_digest,sourceObservedAt:new Date(row.source_observed_at).toISOString(),recordedAt:new Date(row.recorded_at).toISOString(),actorId:row.actor_id,idempotencyKey:row.idempotency_key,commandDigest:row.command_digest};validateAcademyRecord(v.payload);const {integrityDigest,...body}=v;if(!Number.isSafeInteger(v.sequence)||v.sequence<1||digest(body)!==integrityDigest)throw Error('stored_revision_integrity');return v;}
/** Every approval-dependency writer takes this first, before source/student/catalog/entity/key locks.
 * Owner-wide serialization protects enumeration phantoms and exact source CAS until commit.
 * Metadata-only admission/fence/read/source journals never acquire it after a narrower lock. */
export async function lockApprovalDependencies(db:SQL,owner:string):Promise<void>{requireText(owner,'owner');await db`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson(['native-prerequisite-owner',owner])},0))`;}
/** Output gates hold the shared form of the same owner lock across the
 * terminal audit commit; participating dependency writers hold it exclusively. */
export async function lockSharedOutputGate(db:SQL,owner:string):Promise<void>{requireText(owner,'owner');await db`SELECT pg_advisory_xact_lock_shared(hashtextextended(${canonicalJson(['native-prerequisite-owner',owner])},0))`;}
export function validateReadAdmission(r:ReadAdmission):void{assertExactKeys(r,['ownerId','actorId','requestId','runId','requestDigest','selectorDigest','processEpoch','registryContractVersion','consumerProfile','consumerProfileDigest']);[r.ownerId,r.actorId,r.requestId,r.runId,r.processEpoch].forEach(x=>requireText(x,'read admission'));sha(r.requestDigest);sha(r.selectorDigest);const profile=fixedConsumerProfile(r.consumerProfile);if(r.registryContractVersion!==profile.definition.registry.version||r.consumerProfileDigest!==profile.pins.consumerProfileDigest)throw Error('read_registry_version');}
/* SC4 final-gate horizon. One normalized recomputation shared by the
 * preparatory snapshot capture (service side) and the store's in-gate
 * recomputation, so both sides compare identical canonical shapes. Only
 * frozen-view reads are used; the exactly-31 surface is unchanged. */
export function normalizeReadHorizon(value:unknown):ReadHorizonExpectation{
 const fail=():never=>{throw Error('horizon_evidence_required');};
 if(!value||typeof value!=='object'||Array.isArray(value))fail();
 const h=value as ReadHorizonExpectation;
 const keys=['businessDate','bindingRevision','ownerHeads','temporalEdges','activityScopes','students','recordHeads','catalogPins','catalogEdges','scoreHeads'];
 if(Object.keys(h).some(k=>!keys.includes(k)&&k!=='plan')||keys.some(k=>!(k in h)))fail();
 if(Object.hasOwn(h,'plan')){
  const plan=h.plan;
  if(!plan||typeof plan!=='object')return fail();
  assertExactKeys(plan,['classGroupRef','studentRef','occurrence','draftRef','expectedRevisions',...(Object.hasOwn(plan,'consumerProfile')?['consumerProfile']:[]),...(Object.hasOwn(plan,'sourceClosure')?['sourceClosure']:[])]);if(plan.consumerProfile!==undefined)fixedConsumerProfile(plan.consumerProfile);if(plan.sourceClosure!==undefined&&(plan.sourceClosure!==true||plan.consumerProfile!=='CURRENT_1_1'||plan.studentRef===null||plan.occurrence.mode!=='EXACT'))fail();
  validateObjectRef(plan.classGroupRef,['ClassGroup']);
  if(plan.studentRef!==null)validateObjectRef(plan.studentRef,['Student']);
  if(plan.draftRef!==null)validateObjectRef(plan.draftRef,['DailyRecordDraft']);
  if(plan.occurrence.mode==='EXACT'){assertExactKeys(plan.occurrence,['mode','lessonRef']);validateObjectRef(plan.occurrence.lessonRef,['LessonSession']);}
  else if(plan.occurrence.mode==='ENUMERATE_SEPARATELY')assertExactKeys(plan.occurrence,['mode']);else fail();
  if(!Array.isArray(plan.expectedRevisions))fail();plan.expectedRevisions.forEach(r=>validateObjectRef(r));
 }
 try{assertDate(h.businessDate);}catch{fail();}
 if(h.bindingRevision!==null)requireText(h.bindingRevision,'horizon binding');
 const text=(x:unknown)=>{if(typeof x!=='string'||!x.length)fail();return x as string;};
 const sorted=<T>(rows:T[]):T[]=>[...rows].sort((a,b)=>{const x=canonicalJson(a),y=canonicalJson(b);return x<y?-1:x>y?1:0;});
 if(!Array.isArray(h.ownerHeads)||!Array.isArray(h.temporalEdges)||!Array.isArray(h.activityScopes)||!Array.isArray(h.students)||!Array.isArray(h.recordHeads)||!Array.isArray(h.catalogPins)||!Array.isArray(h.catalogEdges)||!Array.isArray(h.scoreHeads))fail();
 for(const row of h.ownerHeads){if(!row||typeof row!=='object')fail();if(!['teacher','class','lesson','student'].includes(row.family))fail();text(row.entityKey);text(row.revisionId);}
 for(const row of h.temporalEdges){if(!row||typeof row!=='object')fail();text(row.entityKey);text(row.bindingKind);text(row.subject);text(row.target);try{assertDate(row.validFrom);if(row.validTo!==null)assertDate(row.validTo);}catch{fail();}text(row.revisionId);}
 for(const row of h.activityScopes){if(!row||typeof row!=='object')fail();text(row.entityKey);text(row.activityKey);text(row.lessonKey);text(row.revisionId);}
 h.students.forEach(text);
 for(const row of h.recordHeads){if(!row||typeof row!=='object')fail();text(row.studentId);text(row.entityId);text(row.revisionId);}
 for(const row of h.catalogPins){if(!row||typeof row!=='object')fail();text(row.nodeId);text(row.revisionId);sha(row.contentDigest);}
 for(const row of h.catalogEdges){if(!row||typeof row!=='object')fail();text(row.nodeId);if(row.parentNodeId!==null)text(row.parentNodeId);}
 for(const row of h.scoreHeads){if(!row||typeof row!=='object')fail();validateObjectRef(row.attemptRef,['DailyTestAttempt']);if(!Array.isArray(row.revisionIds))fail();row.revisionIds.forEach(text);}
 return {...(h.plan?{plan:h.plan}:{}),businessDate:h.businessDate,bindingRevision:h.bindingRevision,ownerHeads:sorted(h.ownerHeads),temporalEdges:sorted(h.temporalEdges),activityScopes:sorted(h.activityScopes),students:[...h.students].sort(),recordHeads:sorted(h.recordHeads),catalogPins:sorted(h.catalogPins),catalogEdges:sorted(h.catalogEdges),scoreHeads:sorted(h.scoreHeads.map(row=>({...row,revisionIds:[...row.revisionIds].sort()})))};
}
/** Student/source tuples are distinct from the dated candidate edges retained
 * as horizon witnesses. The same envelope governs projection of student links. */
export function readPlanStudentTuples(plan:ReadHorizonPlan,lessons:readonly OwnerVersion<LessonSessionRecord>[],temporal:readonly OwnerVersion<TemporalBinding>[]):Map<string,Set<string>>{
 const key=(r:ObjectRef)=>canonicalJson(r.identity);
 const members=new Set(temporal.filter(v=>['CLASS_MEMBERSHIP','ENROLLMENT'].includes(v.payload.bindingKind)&&key(v.payload.targetRef)===key(plan.classGroupRef)).map(v=>key(v.payload.subjectRef)));
 const tuples=new Map<string,Set<string>>();
 for(const lesson of lessons){
  const students=new Set<string>();
  if(plan.studentRef)students.add(key(plan.studentRef));
  else if(lesson.payload.participantRefs.state==='known')for(const ref of lesson.payload.participantRefs.value)if(members.has(key(ref)))students.add(key(ref));
  tuples.set(canonicalJson({scopeRef:lesson.scopeRef,namespace:lesson.namespace,objectType:'LessonSession',nativeKey:lesson.entityKey}),students);
 }
 return tuples;
}
/** Rebuild the complete registered operation envelope from the frozen view.
 * Empty sets remain witnesses: insertion/removal of a relevant member, record,
 * link, catalog ancestor or score head changes the next recomputation. The
 * owner lock remains wider than these semantic dependencies. */
export async function selectReadPlan(view:TeacherPrerequisiteReadStore,ownerId:string,businessDate:string,plan:ReadHorizonPlan):Promise<TeacherPrerequisiteReadStore>{
 const key=(r:ObjectRef)=>canonicalJson(r.identity);
 const classKey=key(plan.classGroupRef),studentKeys=new Set<string>();
 if(plan.studentRef)studentKeys.add(key(plan.studentRef));
 const lessons=(await view.lessons(ownerId)).filter(v=>key(v.payload.classGroupRef)===classKey&&v.payload.businessDate===businessDate&&(plan.occurrence.mode!=='EXACT'||v.entityKey===plan.occurrence.lessonRef.identity.nativeKey));
 const lessonKeys=new Set(lessons.map(v=>v.entityKey));
 if(plan.occurrence.mode==='EXACT')lessonKeys.add(plan.occurrence.lessonRef.identity.nativeKey);
 const allTemporal=await view.temporalBindings(ownerId);
 const active=(v:OwnerVersion<TemporalBinding>)=>{
  const p=v.payload;assertDate(p.validFrom);
  if(p.validTo!==null){assertDate(p.validTo);if(p.validTo<=p.validFrom)throw Error('horizon_evidence_required');}
  return p.validFrom<=businessDate&&(p.validTo===null||businessDate<p.validTo);
 };
 // Retain all relevant dated candidates, including nonparticipants, so
 // membership/participation insertion and removal remain change witnesses.
 const temporal=allTemporal.filter(v=>(
  ['CLASS_MEMBERSHIP','ENROLLMENT'].includes(v.payload.bindingKind)?(!plan.studentRef||studentKeys.has(key(v.payload.subjectRef)))&&key(v.payload.targetRef)===classKey:
  v.payload.bindingKind==='TEACHING_ASSIGNMENT'?key(v.payload.subjectRef)===classKey:
  v.payload.bindingKind==='LESSON_PARTICIPATION'?lessonKeys.has(v.payload.subjectRef.identity.nativeKey)&&(!plan.studentRef||studentKeys.has(key(v.payload.targetRef))):false)&&active(v));
 const tuples=readPlanStudentTuples(plan,lessons,temporal);
 if(!plan.studentRef)for(const students of tuples.values())for(const student of students)studentKeys.add(student);
 const scopeMatches=(s:RecordScope)=>key(s.classGroupRef)===classKey&&studentKeys.has(key(s.studentRef))&&s.businessDate===businessDate&&lessonKeys.has(s.lessonRef.identity.nativeKey)&&(plan.studentRef!==null||tuples.get(key(s.lessonRef))?.has(key(s.studentRef))===true);
 const allScopes=await view.activityScopes(ownerId,{});
 const scopes=allScopes.filter(v=>scopeMatches(v.payload.recordScope));
 const refs=new Map<string,ObjectRef>();
 const collect=(x:unknown):void=>{
  if(!x||typeof x!=='object')return;
  if('identity' in x&&'revision' in x){const r=x as ObjectRef;validateObjectRef(r);refs.set(key(r),r);return;}
  for(const v of Object.values(x))collect(v);
 };
 collect(plan);lessons.forEach(v=>collect(v.payload));temporal.forEach(v=>collect(v.payload));scopes.forEach(v=>collect(v.payload));
 const students:Awaited<ReturnType<TeacherPrerequisiteReadStore['students']>>=[];const current=new Map<string,Awaited<ReturnType<TeacherPrerequisiteReadStore['current']>>>();
 const studentIds=new Set([...studentKeys].map(k=>(JSON.parse(k) as ObjectRef['identity']).nativeKey));
 for(const student of await view.students(ownerId)){
  if(!studentIds.has(student.id))continue;
  const revision=await view.studentRevisionCurrent(ownerId,student.id);
  const identity=revision?canonicalJson({scopeRef:revision.scopeRef,namespace:revision.namespace,objectType:'Student',nativeKey:student.id}):null;
  if(!(identity&&studentKeys.has(identity))&&!([...studentKeys].some(k=>JSON.parse(k).nativeKey===student.id)))continue;
  students.push(student);
  const allRows=await view.current(ownerId,student.id);
  const rows=allRows.filter(row=>{
   const payload=row.payload;
   if(payload.kind==='daily_record_draft'&&plan.draftRef&&row.entityId!==plan.draftRef.identity.nativeKey)return false;
   const s=payload.kind==='previous_homework_assessment'?payload.assessmentScope:'recordScope' in payload?payload.recordScope:null;
   // Progress and assessments, like homework/attempts, belong to the occurrence of their current activity
   // scope when one exists (a correction moves them, a detach keeps them visible as detached).
   if(s&&(payload.kind==='daily_progress'||payload.kind==='previous_homework_assessment')){
    const occurrence=resolveActivityOccurrence({objectType:payload.kind==='daily_progress'?'DailyProgress':'PreviousHomeworkAssessment',nativeKey:row.entityId,revision:row.revisionId},s as RecordScope,allScopes.filter(v=>v.payload.recordScope.studentRef.identity.nativeKey===student.id));
    // Attached/embedded: its occurrence; detached: where it was detached; unresolved: any occurrence one of its
    // attachments names, so the reader can report the unresolved mapping there.
    if(occurrence.state==='ATTACHED'||occurrence.state==='EMBEDDED')return scopeMatches(occurrence.scope);
    if(occurrence.state==='DETACHED')return scopeMatches(occurrence.attachment.payload.recordScope);
    return occurrence.attachments.some(v=>scopeMatches(v.payload.recordScope));
   }
   if(s)return scopeMatches(s as RecordScope);
   if(payload.kind==='teacher_lesson_carryover')return plan.sourceClosure===true&&plan.studentRef!==null&&payload.targetDate===businessDate&&payload.occurrence?.date===businessDate;
   if(payload.kind!=='learning_work_assignment'&&payload.kind!=='learning_work_attempt')return false;
   const mappings=allScopes.filter(v=>v.payload.activityRef.identity.nativeKey===row.entityId&&v.payload.recordScope.studentRef.identity.nativeKey===student.id);
   return mappings.length===0||mappings.some(v=>scopeMatches(v.payload.recordScope));
  });
  // Exact citations can reach a prior occurrence. Preserve that closure,
  // while unrelated registrations and other-occurrence activities stay out.
  const selected=new Set(rows.map(row=>row.entityId));
  for(let i=0;i<rows.length;i++){
   collect(rows[i]!.payload);
   const payload=rows[i]!.payload;
   const sourceRevisions=new Set(['registrationRevisionId','assignmentRevisionId','previousAttemptRevisionId'].flatMap(field=>field in payload?[Reflect.get(payload,field)]:[]));
   for(const candidate of allRows){
    const types:Partial<Record<AcademyRecord['kind'],ObjectRef['identity']['objectType']>>={daily_progress:'DailyProgress',daily_record_draft:'DailyRecordDraft',previous_homework_assessment:'PreviousHomeworkAssessment',learning_work_assignment:'HomeworkAssignment',learning_work_attempt:'DailyTestAttempt'};
    const objectType=types[candidate.payload.kind];
    const cited=objectType&&[...refs.values()].some(ref=>ref.identity.nativeKey===candidate.entityId&&ref.identity.objectType===objectType&&canonicalJson(ref.identity.scopeRef)===canonicalJson(plan.classGroupRef.identity.scopeRef)&&ref.identity.namespace===plan.classGroupRef.identity.namespace&&ref.revision===candidate.revisionId);
    if(!selected.has(candidate.entityId)&&(cited||sourceRevisions.has(candidate.revisionId))){selected.add(candidate.entityId);rows.push(candidate);}
   }
  }
  // Retain every relevant source/history head, even unprojectable legacy
  // rows; never turn an incomplete mapping into proof of absence.
  current.set(student.id,rows);
 }
 // A cited progress/assessment from another occurrence still carries its current scope head, so a
 // correction or detach is never read back as the original payload scope.
 const horizonActivities=new Set([...current.values()].flatMap(rows=>rows.flatMap(row=>row.payload.kind==='daily_progress'||row.payload.kind==='previous_homework_assessment'?[row.entityId]:[])));
 const visibleScopes=[...scopes,...allScopes.filter(v=>!scopes.includes(v)&&(v.payload.activityKind==='DAILY_PROGRESS'||v.payload.activityKind==='PREVIOUS_HOMEWORK_ASSESSMENT')&&horizonActivities.has(v.payload.activityRef.identity.nativeKey))];
 const nodeIds=new Set([...refs.values()].filter(r=>['TextbookEdition','Unit','Section'].includes(r.identity.objectType)).map(r=>r.identity.nativeKey));
 for(const rows of current.values())for(const row of rows){const payload=row.payload;if('catalogRefs' in payload)for(const ref of payload.catalogRefs)nodeIds.add(ref.nodeId);}
 const pins=await view.currentCatalogPins(ownerId),byId=new Map(pins.map(p=>[p.node.id,p.node]));
 for(const id of nodeIds){const node=byId.get(id);if(node?.parent.state==='known')nodeIds.add(node.parent.value);}
 const teacherKeys=new Set([...refs.values()].filter(r=>r.identity.objectType==='Teacher').map(key));
 return {...view,
  classGroups:async()=> (await view.classGroups(ownerId)).filter(v=>canonicalJson({scopeRef:v.scopeRef,namespace:v.namespace,objectType:'ClassGroup',nativeKey:v.entityKey})===classKey),
  teachers:async()=> (await view.teachers(ownerId)).filter(v=>teacherKeys.has(canonicalJson({scopeRef:v.scopeRef,namespace:v.namespace,objectType:'Teacher',nativeKey:v.entityKey}))),
  lessons:async()=>lessons,students:async()=>students,current:async(_owner,id)=>current.get(id)??[],
  temporalBindings:async()=>temporal,activityScopes:async()=>visibleScopes,
  catalog:async()=> (await view.catalog(ownerId)).filter(n=>nodeIds.has(n.id)),
  currentCatalogPins:async()=>pins.filter(p=>nodeIds.has(p.node.id)),
 };
}
export async function computeReadHorizon(view:TeacherPrerequisiteReadStore,ownerId:string,actorId:string,businessDate:string,attemptRefs:readonly ObjectRef[],plan?:ReadHorizonPlan):Promise<ReadHorizonExpectation>{
 assertDate(businessDate);requireText(ownerId,'owner');requireText(actorId,'actor');
 if(plan)view=await selectReadPlan(view,ownerId,businessDate,plan);
 const binding=await view.teacherBindingByActor(ownerId,actorId);
 const ownerHeads:ReadHorizonExpectation['ownerHeads']=[];
 for(const v of await view.teachers(ownerId))ownerHeads.push({family:'teacher',entityKey:v.entityKey,revisionId:v.revisionId});
 for(const v of await view.classGroups(ownerId))ownerHeads.push({family:'class',entityKey:v.entityKey,revisionId:v.revisionId});
 for(const v of await view.lessons(ownerId))ownerHeads.push({family:'lesson',entityKey:v.entityKey,revisionId:v.revisionId});
 const temporalEdges:ReadHorizonExpectation['temporalEdges']=(await view.temporalBindings(ownerId)).map(v=>({entityKey:v.entityKey,bindingKind:v.payload.bindingKind,subject:v.payload.subjectRef.identity.objectType+':'+v.payload.subjectRef.identity.nativeKey,target:v.payload.targetRef.identity.objectType+':'+v.payload.targetRef.identity.nativeKey,validFrom:v.payload.validFrom,validTo:v.payload.validTo,revisionId:v.revisionId}));
 const scopeRows=await view.activityScopes(ownerId,{});
 const activityScopes:ReadHorizonExpectation['activityScopes']=scopeRows.map(v=>({entityKey:v.entityKey,activityKey:v.payload.activityRef.identity.nativeKey,lessonKey:v.payload.recordScope.lessonRef.identity.nativeKey,revisionId:v.revisionId}));
 /* NG-FINAL-E1-SCORE: the complete authorized plan dependency set is
  * derived here, before preparation, from the frozen view only: supplied
  * refs plus every attempt explicitly scoped via ActivityScopeLink and
  * every observed whole-plan attempt row. Each enters scoreHeads even
  * with no score evidence, so the empty revisionIds list is the
  * score-absence witness the final gate recomputes identically. */
 const completeAttempts=new Map<string,ObjectRef>();
 const addAttempt=(ref:ObjectRef)=>{validateObjectRef(ref,['DailyTestAttempt']);completeAttempts.set(canonicalJson(ref),ref);};
 for(const attemptRef of attemptRefs)addAttempt(attemptRef);
 for(const scope of scopeRows)if(scope.payload.activityRef.identity.objectType==='DailyTestAttempt')addAttempt(scope.payload.activityRef);
 const studentRows=await view.students(ownerId);const students=studentRows.map(s=>s.id);
 const recordHeads:ReadHorizonExpectation['recordHeads']=[];
 for(const student of studentRows){
  const revision=await view.studentRevisionCurrent(ownerId,student.id);
  if(revision)ownerHeads.push({family:'student',entityKey:student.id,revisionId:revision.revisionId});
  for(const row of await view.current(ownerId,student.id)){
   recordHeads.push({studentId:student.id,entityId:row.entityId,revisionId:row.revisionId});
   if(row.payload.kind==='daily_record_draft'&&row.payload.attemptRefs.state==='known')for(const ref of row.payload.attemptRefs.value)addAttempt(ref);
   if((row.payload as {kind?:string}).kind==='learning_work_attempt'){
    if(!revision)throw Error('horizon_evidence_required');
    addAttempt({identity:{scopeRef:revision.scopeRef,namespace:revision.namespace,objectType:'DailyTestAttempt',nativeKey:row.entityId},revision:row.revisionId});
   }
  }
 }
 const pins=await view.currentCatalogPins(ownerId);
 const catalogPins=pins.map(pin=>({nodeId:pin.node.id,revisionId:pin.revisionId,contentDigest:pin.contentDigest}));
 const catalogEdges=pins.map(pin=>({nodeId:pin.node.id,parentNodeId:pin.node.parent.state==='known'?pin.node.parent.value:null}));
 const scoreHeads:ReadHorizonExpectation['scoreHeads']=[];
 for(const attemptRef of completeAttempts.values()){
  const rows=await view.scoreEvidenceForAttempt(ownerId,attemptRef as ObjectRef<'DailyTestAttempt'>);
  scoreHeads.push({attemptRef:attemptRef as ObjectRef<'DailyTestAttempt'>,revisionIds:rows.map(row=>row.revisionId)});
 }
 return normalizeReadHorizon({...(plan?{plan}:{}),businessDate,bindingRevision:binding?.revisionId??null,ownerHeads,temporalEdges,activityScopes,students,recordHeads,catalogPins,catalogEdges,scoreHeads});
}
export function nativeBusinessDate(at:string):string{assertInstant(at);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));const value=(type:string)=>parts.find(p=>p.type===type)!.value;return `${value('year')}-${value('month')}-${value('day')}`;}
export function assertTeacherDate(p:TeacherBinding,date:string):void{if(p.state!=='ACTIVE'||p.assignmentState.state!=='known'||p.assignmentState.value!=='ACTIVE'||date<p.validFrom||p.validTo!==null&&date>=p.validTo)throw Error('teacher_binding_inactive');}
/** All original execution paths with a reserved key must reject, including pre-transaction legacy append. */
export async function guardReservedAppend(db:SQL,owner:string,actor:string,key:string):Promise<void>{
 const [schema]=await db<{ready:boolean}[]>`SELECT to_regclass('academy.effect_fences') IS NOT NULL AS ready`;
 if(!schema?.ready)return;
 const rows=await db`SELECT state FROM academy.effect_fences WHERE owner_id=${owner} AND actor_id=${actor} AND idempotency_key=${key}`;
 if(rows.length)throw Error('reserved_native_admission_use_supported_command');
}
export async function migrateNativePrerequisites(db:SQL):Promise<void>{
 await db.begin(async tx=>{
 for(const table of Object.values(tables)){
  await tx.unsafe(`CREATE TABLE IF NOT EXISTS academy.${table}_versions(owner_id text NOT NULL,entity_key text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),revision_id text NOT NULL,body jsonb NOT NULL,PRIMARY KEY(owner_id,entity_key,sequence),UNIQUE(owner_id,revision_id));
 CREATE TABLE IF NOT EXISTS academy.${table}_heads(owner_id text NOT NULL,entity_key text NOT NULL,sequence bigint NOT NULL,PRIMARY KEY(owner_id,entity_key),FOREIGN KEY(owner_id,entity_key,sequence) REFERENCES academy.${table}_versions(owner_id,entity_key,sequence));
 DROP TRIGGER IF EXISTS immutable_native_history ON academy.${table}_versions;
 CREATE TRIGGER immutable_native_history BEFORE UPDATE OR DELETE ON academy.${table}_versions FOR EACH ROW EXECUTE FUNCTION academy.prevent_history_mutation();`);
 }
 await tx.unsafe(`CREATE TABLE IF NOT EXISTS academy.teacher_actor_index(owner_id text NOT NULL,actor_id text NOT NULL,teacher_key text NOT NULL,state text NOT NULL CHECK(state IN ('ACTIVE','RETIRED')),retired_revision_id text,PRIMARY KEY(owner_id,actor_id));
 CREATE TABLE IF NOT EXISTS academy.draft_scope_index(owner_id text NOT NULL,scope_digest text NOT NULL,draft_entity_id text NOT NULL,PRIMARY KEY(owner_id,scope_digest));
 CREATE TABLE IF NOT EXISTS academy.effect_fences(owner_id text NOT NULL,actor_id text NOT NULL,idempotency_key text NOT NULL,request jsonb NOT NULL,state text NOT NULL CHECK(state IN ('PRE_TRANSACTION','ACTIVE','COMMITTED','FENCED_NOT_COMMITTED')),result jsonb,proof_digest text,PRIMARY KEY(owner_id,actor_id,idempotency_key),CHECK((state='COMMITTED')=(result IS NOT NULL)),CHECK((state='FENCED_NOT_COMMITTED')=(proof_digest IS NOT NULL)));
 CREATE TABLE IF NOT EXISTS academy.read_occurrences(owner_id text NOT NULL,actor_id text NOT NULL,request_id text NOT NULL,request jsonb NOT NULL,status text NOT NULL CHECK(status IN ('PENDING','COMPLETED','REFUSED','UNKNOWN')),snapshot_digest text,refusal_code text,PRIMARY KEY(owner_id,actor_id,request_id));
 REVOKE ALL ON ALL TABLES IN SCHEMA academy FROM PUBLIC;`);
 });
}
export async function assertNativePrerequisitesReady(db:SQL):Promise<void>{
 const names=[...Object.values(tables).flatMap(x=>[x+'_versions',x+'_heads']),'teacher_actor_index','draft_scope_index','effect_fences','read_occurrences'];
 for(const n of names){const [r]=await db<{ready:boolean}[]>`SELECT to_regclass(${'academy.'+n}) IS NOT NULL AS ready`;if(!r?.ready)throw Error('prerequisite_schema_required');}
 const [r]=await db<{count:number}[]>`SELECT count(*)::int AS count FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='academy' AND pn.nspname='academy' AND p.proname='prevent_history_mutation' AND t.tgname='immutable_native_history' AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgtype=27 AND c.relname IN ${db(Object.values(tables).map(x=>x+'_versions'))}`;
 if(r?.count!==8)throw Error('prerequisite_history_required');
}
/** Additive adapter over the existing academy database; no connection creation or second business store. */
export class NativePrerequisiteStore {
 constructor(private readonly db:SQL,private readonly afterDependencyWrite?:DependencyWriterHook){}
 private lock(db:SQL,r:Pick<RequestBinding,'ownerId'|'actorId'|'idempotencyKey'>){return db`SELECT pg_advisory_xact_lock(hashtextextended(${canonicalJson([r.ownerId,r.actorId,r.idempotencyKey])},0))`;}
 private async clock(db:SQL):Promise<string>{const [r]=await db<{now:Date|string}[]>`SELECT clock_timestamp() AS now`;if(!r)throw Error('native_clock_required');return new Date(r.now).toISOString();}
 private async admission(db:SQL,r:RequestBinding):Promise<AdmissionRow|null>{const [v]=await db<AdmissionRow[]>`SELECT request,state,result,proof_digest FROM academy.effect_fences WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND idempotency_key=${r.idempotencyKey}`;if(!v)return null;validateRequest(v.request);if(canonicalJson(v.request)!==canonicalJson(r))throw Error('idempotency_reuse');return v;}
 async admitCommand(c:AdmissionCommand):Promise<RequestBinding>{assertExactKeys(c,['context','requestDigest']);validateContext(c.context);sha(c.requestDigest);const r=commandBinding(c.context,c.requestDigest);return this.db.begin(async tx=>{await this.lock(tx,r);const found=await this.admission(tx,r);if(found){if(found.state==='FENCED_NOT_COMMITTED')throw Error('original_occurrence_fenced');return r;}const old=await tx`SELECT command_digest FROM academy.command_outcomes WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND idempotency_key=${r.idempotencyKey}`;if(old.length)throw Error('legacy_key_already_used');await tx`INSERT INTO academy.effect_fences(owner_id,actor_id,idempotency_key,request,state) VALUES(${r.ownerId},${r.actorId},${r.idempotencyKey},${canonicalJson(r)}::text::jsonb,'PRE_TRANSACTION')`;return r;});}
 async commandOutcomeLookup(r:RequestBinding):Promise<OutcomeLookupResult>{validateRequest(r);let row:AdmissionRow|null;try{row=await this.admission(this.db,r);}catch(e){if(e instanceof Error&&e.message==='idempotency_reuse')return {status:'UNKNOWN',request:r,reason:'MISMATCHED_RECEIPT',next:'BLOCK_WRITEBACK_NO_REPLAY'};throw e;}
 if(!row)return {status:'UNKNOWN',request:r,reason:'AMBIGUOUS_NOT_FOUND',next:'BLOCK_WRITEBACK_NO_REPLAY'};
 if(row.state==='COMMITTED'&&row.result){validateReceipt(row.result.receipt);if(row.result.receipt.requestDigest!==r.requestDigest||row.result.receipt.occurrenceId!==r.occurrenceId||row.result.receipt.admissionId!==r.admissionId)throw Error('stored_receipt_binding');return {status:'COMMITTED',request:r,result:row.result,next:'READBACK_NO_REPLAY'};}
 if(row.state==='FENCED_NOT_COMMITTED'&&row.proof_digest)return {status:'NOT_COMMITTED_FENCED',request:r,proofDigest:row.proof_digest,next:'STOP_REASSESS_NEW_OCCURRENCE_AUTHORITY'};
 return {status:'PENDING',request:r,next:'LOOKUP_ONLY_NO_REPLAY'};
 }
 async fenceCommand(c:FenceCommand):Promise<OutcomeLookupResult>{assertExactKeys(c,['request','fenceOccurrenceId','reason']);validateRequest(c.request);requireText(c.fenceOccurrenceId,'fence occurrence');if(c.fenceOccurrenceId===c.request.occurrenceId||!['ABORT','RESTART','CANCEL'].includes(c.reason))throw Error('separate_fence_occurrence_required');await this.db.begin(async tx=>{await this.lock(tx,c.request);const row=await this.admission(tx,c.request);if(!row)throw Error('unknown_original_admission');if(row.state==='COMMITTED'||row.state==='FENCED_NOT_COMMITTED')return;
 // The lock waits out an active original transaction. Persisted terminal state excludes even a delayed live handler.
 const proof=digest({request:c.request,fenceOccurrenceId:c.fenceOccurrenceId,reason:c.reason,at:await this.clock(tx)});await tx`UPDATE academy.effect_fences SET state='FENCED_NOT_COMMITTED',proof_digest=${proof} WHERE owner_id=${c.request.ownerId} AND actor_id=${c.request.actorId} AND idempotency_key=${c.request.idempotencyKey}`;
 });return this.commandOutcomeLookup(c.request);}
 private async execute(c:CommandContext,operation:string,command:unknown,work:(tx:SQL,at:string,request:RequestBinding)=>Promise<NativeWriteResult>):Promise<NativeWriteResult>{validateContext(c);const r=commandBinding(c,requestDigest(operation,command));return this.db.begin(async tx=>{
 // READ COMMITTED gives post-lock-wait reads a fresh horizon. Nested legacy writes inherit it.
 await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;
 // All business writers serialize the owner closure before narrower locks; metadata takes its key only.
 await lockApprovalDependencies(tx,c.ownerId);await this.lock(tx,r);const admitted=await this.admission(tx,r);if(!admitted)throw Error('durable_admission_required');if(admitted.state==='FENCED_NOT_COMMITTED')throw Error('original_occurrence_fenced');if(admitted.state==='COMMITTED'){if(!admitted.result)throw Error('stored_result_missing');return {...admitted.result,status:'replay'};}
 await tx`UPDATE academy.effect_fences SET state='ACTIVE' WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND idempotency_key=${r.idempotencyKey}`;
 const at=await this.clock(tx);if(Date.parse(c.sourceObservedAt)>Date.parse(at))throw Error('future_source_observation');const result=await work(tx,at,r);validateReceipt(result.receipt);
 if(operation==='consumeApprovalAndApproveDraft'){const proof=result.receipt.approvalId?await this.one<ApprovalVersionPayload>(tx,'approval',c.ownerId,result.receipt.approvalId):null;const finalClock=await this.clock(tx);if(!proof||Date.parse(finalClock)>=Date.parse(proof.payload.expiresAt))throw Error('approval_expired');}
 await this.afterDependencyWrite?.(operation,c.ownerId,c.idempotencyKey,tx as unknown as SQL);
 await tx`INSERT INTO academy.command_outcomes(owner_id,actor_id,idempotency_key,command_digest,acknowledgement) VALUES(${r.ownerId},${r.actorId},${r.idempotencyKey},${r.requestDigest},${canonicalJson(result)}::text::jsonb)`;
 await tx`UPDATE academy.effect_fences SET state='COMMITTED',result=${canonicalJson(result)}::text::jsonb WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND idempotency_key=${r.idempotencyKey}`;return result;
 });}
 private async ownerRows<P extends OwnerPayload>(db:SQL,f:Family,owner:string,key?:string):Promise<OwnerVersion<P>[]>{requireText(owner,'owner');const rows=await db.unsafe<BodyRow[]>(`SELECT v.body FROM academy.${tables[f]}_heads h JOIN academy.${tables[f]}_versions v USING(owner_id,entity_key,sequence) WHERE h.owner_id=$1${key===undefined?'':' AND h.entity_key=$2'} ORDER BY h.entity_key`,key===undefined?[owner]:[owner,key]);return rows.map(r=>{const v=prerequisiteVersionFrom(r.body);if(v.payload.kind!==kinds[f]||v.ownerId!==owner||key!==undefined&&v.entityKey!==key)throw Error('stored_family_binding');return v as OwnerVersion<P>;});}
 private async one<P extends OwnerPayload>(db:SQL,f:Family,owner:string,key:string):Promise<OwnerVersion<P>|null>{return (await this.ownerRows<P>(db,f,owner,key))[0]??null;}
 teachers=(owner:string)=>this.ownerRows<TeacherBinding>(this.db,'teacher',owner);
 teacherCurrent=(owner:string,key:string)=>this.one<TeacherBinding>(this.db,'teacher',owner,key);
 async teacherBindingByActor(owner:string,actor:string):Promise<OwnerVersion<TeacherBinding>|null>{const [r]=await this.db<{teacher_key:string;state:string}[]>`SELECT teacher_key,state FROM academy.teacher_actor_index WHERE owner_id=${owner} AND actor_id=${actor}`;if(!r)return null;const v=await this.teacherCurrent(owner,r.teacher_key);if(!v||v.payload.actorId!==actor||v.payload.state!==r.state)throw Error('teacher_index_integrity');return v;}
 classGroups=(owner:string)=>this.ownerRows<ClassGroupRecord>(this.db,'class',owner);
 classCurrent=(owner:string,key:string)=>this.one<ClassGroupRecord>(this.db,'class',owner,key);
 lessons=(owner:string)=>this.ownerRows<LessonSessionRecord>(this.db,'lesson',owner);
 lessonCurrent=(owner:string,key:string)=>this.one<LessonSessionRecord>(this.db,'lesson',owner,key);
 temporalBindings=(owner:string)=>this.ownerRows<TemporalBinding>(this.db,'binding',owner);
 async activityScopes(owner:string,filter:{activityKind?:ActivityScopeLink['activityKind'];activityEntityId?:string;lessonKey?:string}):Promise<OwnerVersion<ActivityScopeLink>[]>{for(const key of Object.keys(filter))if(!['activityKind','activityEntityId','lessonKey'].includes(key))throw Error('activity_filter');const heads=await this.ownerRows<ActivityScopeLink>(this.db,'scope',owner);for(const head of heads)await this.assertScopeHistory(this.db,head);return heads.filter(v=>(!filter.activityKind||v.payload.activityKind===filter.activityKind)&&(!filter.activityEntityId||v.payload.activityRef.identity.nativeKey===filter.activityEntityId)&&(!filter.lessonKey||v.payload.recordScope.lessonRef.identity.nativeKey===filter.lessonKey));}
 studentRevisionCurrent=(owner:string,id:string)=>this.one<StudentRecordPayload>(this.db,'student',owner,id);
 async ownerRevision(owner:string,family:OwnerFamily,key:string,revision:string):Promise<OwnerVersion|null>{requireText(revision,'revision');const rows=await this.historicalRows(owner,family,key,revision,0,1);return rows[0]??null;}
 async ownerHistory(owner:string,family:OwnerFamily,key:string,after=0,limit=200):Promise<OwnerVersion[]>{return this.historicalRows(owner,family,key,null,after,limit);}
 private async historicalRows(owner:string,family:OwnerFamily,key:string,revision:string|null,after:number,limit:number):Promise<OwnerVersion[]>{
  requireText(owner,'owner');requireText(key,'entity');if(!ownerFamilies.includes(family))throw Error('owner_family_required');if(!Number.isSafeInteger(after)||after<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw Error('invalid_history_range');
  const rows=revision===null?await this.db.unsafe<BodyRow[]>(`SELECT body FROM academy.${tables[family]}_versions WHERE owner_id=$1 AND entity_key=$2 AND sequence>$3 ORDER BY sequence LIMIT $4`,[owner,key,after,limit]):await this.db.unsafe<BodyRow[]>(`SELECT body FROM academy.${tables[family]}_versions WHERE owner_id=$1 AND entity_key=$2 AND revision_id=$3`,[owner,key,revision]);
  return rows.map(r=>{const v=prerequisiteVersionFrom(r.body);if(v.ownerId!==owner||v.entityKey!==key||v.payload.kind!==kinds[family]||revision!==null&&v.revisionId!==revision||revision===null&&v.sequence<=after)throw Error('stored_family_binding');return v;});
 }
 async studentRevisionHistory(owner:string,id:string,after=0,limit=200):Promise<OwnerVersion<StudentRecordPayload>[]>{return await this.ownerHistory(owner,'student',id,after,limit) as OwnerVersion<StudentRecordPayload>[];}
 scoreEvidenceCurrent=(owner:string,key:string)=>this.one<NativeScoreEvidence>(this.db,'evidence',owner,key);
 async scoreEvidenceForAttempt(owner:string,attempt:ObjectRef<'DailyTestAttempt'>):Promise<OwnerVersion<NativeScoreEvidence>[]>{validateObjectRef(attempt,['DailyTestAttempt']);return (await this.ownerRows<NativeScoreEvidence>(this.db,'evidence',owner)).filter(v=>canonicalJson(v.payload.attemptRef)===canonicalJson(attempt));}
 async appendScoreEvidence(c:ScoreEvidenceCommand):Promise<NativeWriteResult>{
  assertExactKeys(c,['context','entityKey','expectedRevisionId','payload']);validateOwnerPayload(c.payload);if(c.payload.kind!=='native_score_evidence')throw Error('command_family_mismatch');
  return this.execute(c.context,'appendScoreEvidence',c,async(db,at,r)=>{
   const p=c.payload,teacher=await this.active(db,c.context,p.recordScope.businessDate);await this.assertScope(db,c.context,p.recordScope);for(const ref of [p.attemptRef,p.assignmentRef,p.recordedBy])await this.assertRef(db,c.context,ref);
   if(p.recordedBy.identity.nativeKey!==teacher.entityKey||p.recordedBy.revision!==teacher.revisionId)throw Error('teacher_attribution_conflict');
   const attempt=await this.studentForRef(db,c.context,p.attemptRef),assignment=await this.studentForRef(db,c.context,p.assignmentRef);
   if(attempt?.payload.kind!=='learning_work_attempt'||assignment?.payload.kind!=='learning_work_assignment'||attempt.studentId!==p.recordScope.studentRef.identity.nativeKey||assignment.studentId!==attempt.studentId||attempt.payload.assignmentRevisionId!==assignment.revisionId)throw Error('score_source_conflict');
   assertCompleteGrades(attempt.payload,assignment.payload);
   const scopes=await this.ownerRows<ActivityScopeLink>(db,'scope',c.context.ownerId);if(!scopes.some(v=>activityScopeState(v.payload)==='ACTIVE'&&canonicalJson(v.payload.activityRef)===canonicalJson(p.attemptRef)&&scopeIdentity(v.payload.recordScope)===scopeIdentity(p.recordScope)))throw Error('scope_conflict');
   const prior=c.entityKey===null?null:await this.one<NativeScoreEvidence>(db,'evidence',c.context.ownerId,c.entityKey);if(c.entityKey!==null&&!prior)throw Error('identity_minting_forbidden');this.cas(prior,c.expectedRevisionId,c.context);
   if(prior&&canonicalJson([prior.payload.attemptRef.identity,prior.payload.assignmentRef.identity])!==canonicalJson([p.attemptRef.identity,p.assignmentRef.identity]))throw Error('score_identity_changed');
   if((await this.ownerRows<NativeScoreEvidence>(db,'evidence',c.context.ownerId)).some(v=>v.entityKey!==prior?.entityKey&&canonicalJson(v.payload.attemptRef.identity)===canonicalJson(p.attemptRef.identity)))throw Error('duplicate_score_evidence');
   const key=c.entityKey??'score:'+randomUUID(),v=await this.persistOwner(db,c.context,r,at,'evidence',key,p,prior);return this.result(c.context,r,at,'NativeScoreEvidence',key,v.revisionId,v.sequence,v.contentDigest,prior?.revisionId??null);
  });
 }

 approvalCurrent=(owner:string,key:string)=>this.one<ApprovalVersionPayload>(this.db,'approval',owner,key);
 private async active(db:SQL,c:CommandContext,date?:string):Promise<OwnerVersion<TeacherBinding>>{const bound=await new NativePrerequisiteStore(db).teacherBindingByActor(c.ownerId,c.actorId);if(!bound)throw Error('teacher_binding_required');assertTeacherDate(bound.payload,date??nativeBusinessDate(await this.clock(db)));if(bound.namespace!==c.namespace||canonicalJson(bound.scopeRef)!==canonicalJson(c.scopeRef))throw Error('scope_conflict');return bound;}
 private identity(c:CommandContext,type:NativeWriteResult['identity']['objectType'],key:string){return {scopeRef:c.scopeRef,namespace:c.namespace,objectType:type,nativeKey:key};}
 private ref(c:CommandContext,type:string,key:string):NativeObjectRef{const r=immutableCopy({...c.scopeRef,objectTypeId:type,objectTypeVersion:type==='Section'?'1.1.0':'1.0.0',objectKey:key});validateNativeRef(r);return r;}
 private result(c:CommandContext,r:RequestBinding,at:string,type:NativeWriteResult['identity']['objectType'],key:string,revisionId:string,sequence:number,contentDigest:string,before:string|null,approvalId:string|null=null,extra:NativeCommitReceipt['changed']=[]):NativeWriteResult{
 const receipt:NativeCommitReceipt={schema:'native-commit-receipt.v1',nativeOwnerBinding:c.nativeOwnerBinding,nativeInterfaceBinding:c.nativeInterfaceBinding,nativeCommitId:'commit:'+randomUUID(),occurrenceId:c.occurrenceId,idempotencyKey:digest(c.idempotencyKey),requestDigest:r.requestDigest,action:c.action,principalBinding:digest({ownerId:c.ownerId,actorId:c.actorId,authenticationRevision:c.verifiedSession.authenticationRevision}),scopeBinding:digest({scopeRef:c.scopeRef,namespace:c.namespace}),approvalId,admissionId:c.admissionId,committedAt:at,changed:[{ref:this.ref(c,type,key),before:before===null?'ABSENT':{scheme:'OWNER_REVISION',value:before},after:{scheme:'OWNER_REVISION',value:revisionId}},...extra],changedLinks:[],businessCommitCount:1,proofHandle:'receipt:'+randomUUID()};return {status:'saved',identity:this.identity(c,type,key),revisionId,sequence,contentDigest,receipt,officialSaved:false,parentSent:false};
 }
 private async persistOwner(db:SQL,c:CommandContext,r:RequestBinding,at:string,f:Family,key:string,payload:OwnerPayload,prior:OwnerVersion|null):Promise<OwnerVersion>{validateOwnerPayload(payload);const body:Omit<OwnerVersion,'integrityDigest'>={ownerId:c.ownerId,namespace:c.namespace,scopeRef:c.scopeRef,entityKey:key,sequence:(prior?.sequence??0)+1,revisionId:stableId('revision','academy-v1',c.ownerId,c.actorId,c.idempotencyKey),previousRevisionId:prior?.revisionId??null,previousDigest:prior?.integrityDigest??null,payload,contentDigest:digest(payload),sourceObservedAt:new Date(c.sourceObservedAt).toISOString(),recordedAt:at,actorId:c.actorId,idempotencyKey:c.idempotencyKey,commandDigest:r.requestDigest};const v={...body,integrityDigest:digest(body)};await db.unsafe(`INSERT INTO academy.${tables[f]}_versions(owner_id,entity_key,sequence,revision_id,body) VALUES($1,$2,$3,$4,$5::text::jsonb)`,[c.ownerId,key,v.sequence,v.revisionId,canonicalJson(v)]);await db.unsafe(`INSERT INTO academy.${tables[f]}_heads(owner_id,entity_key,sequence) VALUES($1,$2,$3) ON CONFLICT(owner_id,entity_key) DO UPDATE SET sequence=EXCLUDED.sequence`,[c.ownerId,key,v.sequence]);return v;}
 private cas(prior:OwnerVersion|RecordVersion|null,expected:string|null,c:CommandContext){if((prior?.revisionId??null)!==expected)throw Error('revision_conflict');if(prior&&Date.parse(prior.sourceObservedAt)>Date.parse(c.sourceObservedAt))throw Error('invalid_revision_transition');if(prior&&'namespace' in prior&&(prior.namespace!==c.namespace||canonicalJson(prior.scopeRef)!==canonicalJson(c.scopeRef)))throw Error('scope_conflict');}
 private async assertRef(db:SQL,c:CommandContext,ref:ObjectRef):Promise<void>{validateObjectRef(ref);if(ref.identity.namespace!==c.namespace||canonicalJson(ref.identity.scopeRef)!==canonicalJson(c.scopeRef))throw Error('scope_conflict');const type=ref.identity.objectType;const family=type==='Teacher'?'teacher':type==='ClassGroup'?'class':type==='LessonSession'?'lesson':type==='Student'?'student':null;if(family){const row=await this.one(db,family,c.ownerId,ref.identity.nativeKey);if(!row||row.revisionId!==ref.revision)throw Error('stale_source_revision');return;}
 if(['TextbookEdition','Unit','Section'].includes(type)){const [row]=await db<{revision_id:string;payload:CatalogNode;content_digest:string}[]>`SELECT revision_id,payload,content_digest FROM academy.catalog_versions WHERE owner_id=${c.ownerId} AND node_id=${ref.identity.nativeKey} ORDER BY sequence DESC LIMIT 1`;if(!row||row.revision_id!==ref.revision||digest(row.payload)!==row.content_digest||type==='TextbookEdition'&&row.payload.kind!=='book_edition'||type==='Section'&&row.payload.kind!=='learning_section'||type==='Unit'&&!['major_unit','middle_unit','minor_unit'].includes(row.payload.kind))throw Error('stale_source_revision');return;}
 const scope=await this.studentForRef(db,c,ref);if(!scope)throw Error('stale_source_revision');
 }
 private async studentForRef(db:SQL,c:CommandContext,ref:ObjectRef):Promise<RecordVersion|null>{const rows=await db<StudentRow[]>`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${c.ownerId} AND h.entity_id=${ref.identity.nativeKey} AND v.revision_id=${ref.revision}`;if(!rows.length)return null;if(rows.length!==1)throw Error('native_identity_ambiguous');const v=studentVersion(rows[0]!);const expected=ref.identity.objectType;const valid=expected==='HomeworkAssignment'?v.payload.kind==='learning_work_assignment':expected==='DailyTestAttempt'?v.payload.kind==='learning_work_attempt':expected==='DailyProgress'?v.payload.kind==='daily_progress':expected==='PreviousHomeworkAssessment'?v.payload.kind==='previous_homework_assessment':expected==='DailyRecordDraft'?v.payload.kind==='daily_record_draft':false;if(!valid)throw Error('reference_kind_mismatch');return v;}
 private async assertScope(db:SQL,c:CommandContext,s:RecordScope):Promise<void>{validateScope(s);for(const ref of [s.studentRef,s.classGroupRef,s.lessonRef])await this.assertRef(db,c,ref);const lesson=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,s.lessonRef.identity.nativeKey);if(!lesson||lesson.payload.businessDate!==s.businessDate||canonicalJson(lesson.payload.classGroupRef.identity)!==canonicalJson(s.classGroupRef.identity)||lesson.payload.lessonState.state!=='known'||lesson.payload.lessonState.value==='CANCELLED')throw Error('scope_conflict');if(lesson.payload.participantRefs.state==='known'&&!lesson.payload.participantRefs.value.some(r=>canonicalJson(r)===canonicalJson(s.studentRef)))throw Error('scope_conflict');const links=await this.ownerRows<TemporalBinding>(db,'binding',c.ownerId);const has=(kind:TemporalBinding['bindingKind'],from:ObjectRef,to:ObjectRef)=>links.some(v=>v.payload.bindingKind===kind&&canonicalJson(v.payload.subjectRef)===canonicalJson(from)&&canonicalJson(v.payload.targetRef)===canonicalJson(to)&&v.payload.validFrom<=s.businessDate&&(v.payload.validTo===null||s.businessDate<v.payload.validTo));if(!has('CLASS_MEMBERSHIP',s.studentRef,s.classGroupRef)||!has('LESSON_PARTICIPATION',s.lessonRef,s.studentRef))throw Error('scope_membership_unknown');}
 private async assertScopeHistory(db:SQL,head:OwnerVersion<ActivityScopeLink>):Promise<void>{
  const store=new NativePrerequisiteStore(db);let previous:OwnerVersion<ActivityScopeLink>|null=null;
  for(let after=0;after<head.sequence;){
   const batch=await store.ownerHistory(head.ownerId,'scope',head.entityKey,after,1000) as OwnerVersion<ActivityScopeLink>[];
   if(!batch.length)throw Error('stored_scope_history');
   const before=after;
   for(const row of batch){
    if(row.sequence>head.sequence)break;
    if(row.sequence!==after+1||row.previousRevisionId!==(previous?.revisionId??null)||row.previousDigest!==(previous?.integrityDigest??null))throw Error('stored_scope_history');
    if(previous&&activityScopeState(previous.payload)==='DETACHED')throw Error('activity_scope_terminal');
    if(activityScopeState(row.payload)==='DETACHED'){
     if(!previous)throw Error('stored_scope_history');
     const {schemaVersion:_schema,state:_state,...lineage}=row.payload;
     const {schemaVersion:_oldSchema,state:_oldState,...priorLineage}=previous.payload;
     if(canonicalJson(lineage)!==canonicalJson(priorLineage))throw Error('activity_scope_terminal_payload_changed');
    }
    previous=row;after=row.sequence;
   }
   if(after===before)throw Error('stored_scope_history');
  }
  if(!previous||canonicalJson(previous)!==canonicalJson(head))throw Error('stored_scope_history');
 }
 private async ownerWrite(f:Family,c:OwnerAppendCommand<TeacherBinding>|OwnerAppendCommand<ClassGroupRecord>|OwnerAppendCommand<LessonSessionRecord>|OwnerAppendCommand<TemporalBinding>|OwnerAppendCommand<ActivityScopeLink>):Promise<NativeWriteResult>{assertExactKeys(c,['context','entityKey','expectedRevisionId','payload']);return this.execute(c.context,'append:'+f,c,async(db,at,r)=>{
 const x=c.context;if(f==='scope')await this.active(db,x,(c.payload as ActivityScopeLink)?.recordScope?.businessDate);const prior=c.entityKey===null?null:await this.one(db,f,x.ownerId,c.entityKey);if(c.entityKey!==null&&!prior)throw Error('identity_minting_forbidden');this.cas(prior,c.expectedRevisionId,x);const key=c.entityKey??`${f}:${randomUUID()}`;const raw=c.payload;
 const payload:OwnerPayload=raw.kind==='teacher_binding'?{...raw,teacherKey:key,ownerId:x.ownerId}:raw.kind==='class_group'?{...raw,classKey:key,ownerId:x.ownerId}:raw.kind==='lesson_session'?{...raw,lessonKey:key,ownerId:x.ownerId}:raw.kind==='temporal_binding'?{...raw,bindingKey:key,ownerId:x.ownerId}:raw;
 if(payload.kind!==kinds[f])throw Error('command_family_mismatch');
 // Validate the complete constructed native payload; supplied allocation fields are never silently accepted.
 for(const field of ['teacherKey','classKey','lessonKey','bindingKey','ownerId'])if(Object.hasOwn(raw,field))throw Error('identity_minting_forbidden');validateOwnerPayload(payload);
 if(f==='teacher'&&payload.kind==='teacher_binding'){
  if(payload.actorId!==x.actorId)throw Error('teacher_attribution_conflict');const bound=await new NativePrerequisiteStore(db).teacherBindingByActor(x.ownerId,x.actorId);
  if(!prior){if(bound)throw Error(bound.payload.state==='RETIRED'?'teacher_binding_inactive':'teacher_binding_exists');if(payload.state!=='ACTIVE'||payload.assignmentState.state!=='known'||payload.assignmentState.value!=='ACTIVE')throw Error('invalid_first_binding');}
  else {await this.active(db,x,nativeBusinessDate(at));if(prior.payload.kind!=='teacher_binding'||prior.payload.actorId!==payload.actorId||canonicalJson(prior.payload.teacherSourceKey)!==canonicalJson(payload.teacherSourceKey))throw Error('teacher_identity_changed');}
 }else await this.active(db,x,payload.kind==='lesson_session'?payload.businessDate:payload.kind==='activity_scope'?payload.recordScope.businessDate:nativeBusinessDate(at));
 if(payload.kind==='activity_scope')validateScopeMutation(payload,x.action,c.entityKey!==null);
 await this.validateOwnerRelations(db,x,payload,prior);
 const v=await this.persistOwner(db,x,r,at,f,key,payload,prior);
 if(payload.kind==='teacher_binding')await db`INSERT INTO academy.teacher_actor_index(owner_id,actor_id,teacher_key,state,retired_revision_id) VALUES(${x.ownerId},${payload.actorId},${key},${payload.state},${payload.state==='RETIRED'?v.revisionId:null}) ON CONFLICT(owner_id,actor_id) DO UPDATE SET state=EXCLUDED.state,retired_revision_id=EXCLUDED.retired_revision_id`;
 const type=f==='teacher'?'Teacher':f==='class'?'ClassGroup':f==='lesson'?'LessonSession':payload.kind==='activity_scope'?'ActivityScopeLink':payload.kind==='temporal_binding'?'TemporalBinding':'Student';const result=this.result(x,r,at,type,key,v.revisionId,v.sequence,v.contentDigest,prior?.revisionId??null);
 if(payload.kind==='temporal_binding'||payload.kind==='activity_scope'){result.receipt.changedLinks=[await this.linkEffect(x,v,prior)];}
 return result;
 });}
 appendTeacher=(c:OwnerAppendCommand<TeacherBinding>)=>this.ownerWrite('teacher',c);
 appendClassGroup=(c:OwnerAppendCommand<ClassGroupRecord>)=>this.ownerWrite('class',c);
 appendLesson=(c:OwnerAppendCommand<LessonSessionRecord>)=>this.ownerWrite('lesson',c);
 appendTemporalBinding=(c:OwnerAppendCommand<TemporalBinding>)=>this.ownerWrite('binding',c);
 appendActivityScope=(c:OwnerAppendCommand<ActivityScopeLink>)=>this.ownerWrite('scope',c);
 private async validateOwnerRelations(db:SQL,c:CommandContext,p:OwnerPayload,prior:OwnerVersion|null){
 if(p.kind==='lesson_session'){await this.assertRef(db,c,p.classGroupRef);const group=await this.one<ClassGroupRecord>(db,'class',c.ownerId,p.classGroupRef.identity.nativeKey);if(group?.payload.businessTimezone.state!=='known'||group.payload.businessTimezone.value!=='Asia/Seoul')throw Error('business_calendar_unknown');if(prior?.payload.kind==='lesson_session'&&(prior.payload.businessDate!==p.businessDate||canonicalJson(prior.payload.classGroupRef.identity)!==canonicalJson(p.classGroupRef.identity)))throw Error('lesson_identity_changed');if(p.teacherRefs.state==='known')for(const ref of p.teacherRefs.value)await this.assertRef(db,c,ref);if(p.participantRefs.state==='known')for(const ref of p.participantRefs.value)await this.assertRef(db,c,ref);}
 if(p.kind==='temporal_binding'){await this.assertRef(db,c,p.subjectRef);await this.assertRef(db,c,p.targetRef);if(prior?.payload.kind==='temporal_binding'&&canonicalJson([prior.payload.bindingKind,prior.payload.subjectRef.identity,prior.payload.targetRef.identity])!==canonicalJson([p.bindingKind,p.subjectRef.identity,p.targetRef.identity]))throw Error('binding_identity_changed');const rows=await this.ownerRows<TemporalBinding>(db,'binding',c.ownerId);for(const v of rows){const a=v.payload;if(v.entityKey!==prior?.entityKey&&a.bindingKind===p.bindingKind&&canonicalJson([a.subjectRef.identity,a.targetRef.identity])===canonicalJson([p.subjectRef.identity,p.targetRef.identity])&&(a.validTo===null||p.validFrom<a.validTo)&&(p.validTo===null||a.validFrom<p.validTo))throw Error('temporal_overlap');}}
 if(p.kind==='activity_scope'){await this.assertScope(db,c,p.recordScope);await this.assertRef(db,c,p.activityRef);const v=await this.studentForRef(db,c,p.activityRef);if(!v||v.studentId!==p.recordScope.studentRef.identity.nativeKey)throw Error('scope_conflict');if(!prior&&(v.payload.kind==='daily_progress'||v.payload.kind==='daily_record_draft')){if(scopeIdentity(v.payload.recordScope)!==scopeIdentity(p.recordScope))throw Error('scope_conflict');}if(!prior&&v.payload.kind==='previous_homework_assessment'&&scopeIdentity(v.payload.assessmentScope)!==scopeIdentity(p.recordScope))throw Error('scope_conflict');const rows=await this.ownerRows<ActivityScopeLink>(db,'scope',c.ownerId);
 for(const row of rows)await this.assertScopeHistory(db,row);
 const sameActivity=(row:OwnerVersion<ActivityScopeLink>)=>canonicalJson(row.payload.activityRef.identity)===canonicalJson(p.activityRef.identity);
 if(rows.some(row=>sameActivity(row)&&activityScopeState(row.payload)==='DETACHED'))throw Error('activity_scope_terminal');
 if(rows.some(row=>row.entityKey!==prior?.entityKey&&sameActivity(row)&&activityScopeState(row.payload)==='ACTIVE'))throw Error('duplicate_activity_scope');
 if(p.state==='DETACHED'){
  if(!prior||prior.payload.kind!=='activity_scope'||activityScopeState(prior.payload)!=='ACTIVE')throw Error('activity_scope_terminal');
  const {schemaVersion:_schema,state:_state,...lineage}=p;const {schemaVersion:_oldSchema,state:_oldState,...oldLineage}=prior.payload;
  if(canonicalJson(lineage)!==canonicalJson(oldLineage))throw Error('activity_scope_terminal_payload_changed');
 }
 const teacher=await this.active(db,c,p.recordScope.businessDate),teacherRef:ObjectRef<'Teacher'>={identity:{scopeRef:teacher.scopeRef,namespace:teacher.namespace,objectType:'Teacher',nativeKey:teacher.entityKey},revision:teacher.revisionId};
 const lesson=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,p.recordScope.lessonRef.identity.nativeKey);
 const teaching=(await this.ownerRows<TemporalBinding>(db,'binding',c.ownerId)).some(row=>row.payload.bindingKind==='TEACHING_ASSIGNMENT'&&canonicalJson(row.payload.subjectRef)===canonicalJson(p.recordScope.classGroupRef)&&canonicalJson(row.payload.targetRef)===canonicalJson(teacherRef)&&row.payload.validFrom<=p.recordScope.businessDate&&(row.payload.validTo===null||p.recordScope.businessDate<row.payload.validTo));
 if(!teaching||lesson?.payload.teacherRefs.state!=='known'||!lesson.payload.teacherRefs.value.some(ref=>canonicalJson(ref)===canonicalJson(teacherRef)))throw Error('teacher_attribution_conflict');if(prior?.payload.kind==='activity_scope'&&canonicalJson([prior.payload.activityKind,prior.payload.activityRef.identity])!==canonicalJson([p.activityKind,p.activityRef.identity]))throw Error('activity_scope_identity_changed');}
 }
 private linkRef(c:CommandContext,r:ObjectRef):NativeObjectRef{return this.ref(c,r.identity.objectType,r.identity.nativeKey);}
 private async linkEffect(c:CommandContext,v:OwnerVersion,prior:OwnerVersion|null):Promise<NativeCommitReceipt['changedLinks'][number]>{const p=v.payload;if(p.kind!=='temporal_binding'&&p.kind!=='activity_scope')throw Error('link_kind');const from=p.kind==='temporal_binding'?p.subjectRef:p.activityRef,to=p.kind==='temporal_binding'?p.targetRef:p.recordScope.lessonRef;return {linkDefinitionBinding:p.kind==='activity_scope'&&p.schemaVersion==='2.0.0'?digest(scopeActionDefinitions.ScopeRelation):digest({contract:'native-prerequisite-links.v3',kind:p.kind==='temporal_binding'?p.bindingKind:p.activityKind}),nativeLinkIdentity:v.entityKey,from:this.linkRef(c,from),to:this.linkRef(c,to),before:prior?{scheme:'OWNER_REVISION',value:prior.revisionId}:'ABSENT',after:p.kind==='activity_scope'&&activityScopeState(p)==='DETACHED'?'ABSENT':{scheme:'OWNER_REVISION',value:v.revisionId}};}
 async appendStudentRevision(c:StudentRevisionCommand):Promise<NativeWriteResult>{assertExactKeys(c,['context','studentId','expectedRevisionId','payload']);validateOwnerPayload(c.payload);if(c.payload.kind!=='student_record')throw Error('invalid_student_payload_kind');return this.execute(c.context,'append:student',c,async(db,at,r)=>{await this.active(db,c.context);const rows=await db`SELECT id FROM academy.students WHERE owner_id=${c.context.ownerId} AND id=${c.studentId}`;if(!rows.length)throw Error('unknown_student');const prior=await this.one(db,'student',c.context.ownerId,c.studentId);this.cas(prior,c.expectedRevisionId,c.context);const v=await this.persistOwner(db,c.context,r,at,'student',c.studentId,c.payload,prior);return this.result(c.context,r,at,'Student',c.studentId,v.revisionId,v.sequence,v.contentDigest,prior?.revisionId??null);});}
 private async persistStudent(db:SQL,c:CommandContext,r:RequestBinding,at:string,studentId:string,key:string,payload:NativeStudentPayload,prior:RecordVersion|null):Promise<RecordVersion>{validateAcademyRecord(payload);const body:Omit<RecordVersion,'integrityDigest'>={ownerId:c.ownerId,studentId,entityId:key,sequence:(prior?.sequence??0)+1,revisionId:stableId('revision','academy-v1',c.ownerId,c.actorId,c.idempotencyKey),previousRevisionId:prior?.revisionId??null,previousDigest:prior?.integrityDigest??null,payload,contentDigest:digest(payload),sourceObservedAt:new Date(c.sourceObservedAt).toISOString(),recordedAt:at,actorId:c.actorId,idempotencyKey:c.idempotencyKey,commandDigest:r.requestDigest};const v={...body,integrityDigest:digest(body)};await db`INSERT INTO academy.record_versions(owner_id,student_id,entity_id,sequence,revision_id,previous_revision_id,previous_digest,payload,content_digest,integrity_digest,source_observed_at,recorded_at,actor_id,idempotency_key,command_digest) VALUES(${v.ownerId},${v.studentId},${v.entityId},${v.sequence},${v.revisionId},${v.previousRevisionId},${v.previousDigest},${canonicalJson(v.payload)}::text::jsonb,${v.contentDigest},${v.integrityDigest},${v.sourceObservedAt},${v.recordedAt},${v.actorId},${v.idempotencyKey},${v.commandDigest})`;await db`INSERT INTO academy.record_heads(owner_id,student_id,entity_id,sequence,revision_id,content_digest,last_verified_at) VALUES(${v.ownerId},${v.studentId},${v.entityId},${v.sequence},${v.revisionId},${v.contentDigest},${v.sourceObservedAt}) ON CONFLICT(owner_id,student_id,entity_id) DO UPDATE SET sequence=EXCLUDED.sequence,revision_id=EXCLUDED.revision_id,content_digest=EXCLUDED.content_digest,last_verified_at=EXCLUDED.last_verified_at`;return v;}
 private async validateStudentRelations(db:SQL,c:CommandContext,studentId:string,p:NativeStudentPayload,teacher:OwnerVersion<TeacherBinding>):Promise<void>{const s=p.kind==='previous_homework_assessment'?p.assessmentScope:p.recordScope;if(s.studentRef.identity.nativeKey!==studentId)throw Error('scope_conflict');await this.assertScope(db,c,s);const [student]=await db<{source_key:string}[]>`SELECT source_key FROM academy.students WHERE owner_id=${c.ownerId} AND id=${studentId}`;if(!student||student.source_key!==p.sourceStudent.literalKey)throw Error('source_student_binding_conflict');
 if(p.kind==='previous_homework_assessment'){await this.assertRef(db,c,p.homeworkRef);const work=await this.studentForRef(db,c,p.homeworkRef);if(!work||work.studentId!==studentId)throw Error('scope_conflict');const scopes=await this.ownerRows<ActivityScopeLink>(db,'scope',c.ownerId);const origin=scopes.find(v=>activityScopeState(v.payload)==='ACTIVE'&&canonicalJson(v.payload.activityRef)===canonicalJson(p.homeworkRef));if(!origin||origin.payload.recordScope.businessDate>s.businessDate)throw Error('prior_homework_unverified');if(origin.payload.recordScope.businessDate===s.businessDate){const a=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,origin.payload.recordScope.lessonRef.identity.nativeKey),b=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,s.lessonRef.identity.nativeKey);if(a?.payload.endsAt.state!=='known'||b?.payload.startsAt.state!=='known'||Date.parse(a.payload.endsAt.value)>Date.parse(b.payload.startsAt.value)||a.entityKey===b.entityKey)throw Error('prior_homework_unverified');}if(p.assessedBy.state!=='known'||p.assessedBy.value.identity.nativeKey!==teacher.entityKey||p.assessedBy.value.revision!==teacher.revisionId)throw Error('teacher_attribution_conflict');await this.assertRef(db,c,p.assessedBy.value);}
 if(p.kind==='daily_progress'){const content=p.contentScope;await this.assertRef(db,c,content.editionRef);await this.assertRef(db,c,content.unitRef);if(content.sectionRefs.state==='known')for(const ref of content.sectionRefs.value)await this.assertRef(db,c,ref);const nodes=await db<{payload:CatalogNode}[]>`SELECT DISTINCT ON(node_id) payload FROM academy.catalog_versions WHERE owner_id=${c.ownerId} ORDER BY node_id,sequence DESC`;const all=nodes.map(x=>x.payload);const chain=traceHierarchy(all,content.unitRef.identity.nativeKey);if(chain.state!=='known'||!chain.path.some(n=>n.id===content.editionRef.identity.nativeKey))throw Error('catalog_scope_conflict');if(content.sectionRefs.state==='known')for(const section of content.sectionRefs.value){const node=all.find(n=>n.id===section.identity.nativeKey);if(node?.parent.state!=='known'||node.parent.value!==content.unitRef.identity.nativeKey)throw Error('catalog_scope_conflict');}}
 if(p.kind==='daily_record_draft'){if(p.responsibleTeacherRef.state!=='known'||p.responsibleTeacherRef.value.identity.nativeKey!==teacher.entityKey||p.responsibleTeacherRef.value.revision!==teacher.revisionId)throw Error('teacher_attribution_conflict');if(p.sourceSnapshot.consistency!=='FAIL_ON_CHANGE')throw Error('draft_snapshot_consistency');for(const collection of [p.progressRefs,p.homeworkRefs,p.attemptRefs,p.previousAssessmentRefs])if(collection.state==='known')for(const ref of collection.value){await this.assertRef(db,c,ref);const v=await this.studentForRef(db,c,ref);const attachment=(await this.ownerRows<ActivityScopeLink>(db,'scope',c.ownerId)).find(a=>activityScopeState(a.payload)==='ACTIVE'&&canonicalJson(a.payload.activityRef)===canonicalJson(ref));if(!v||v.studentId!==studentId||!attachment||scopeIdentity(attachment.payload.recordScope)!==scopeIdentity(s))throw Error('scope_conflict');}}
 }
 private async studentWrite(operation:string,c:CreateAssessmentCommand|CreateDraftCommand|CreateProgressCommand|CorrectStudentCommand):Promise<NativeWriteResult>{const correction='entityId' in c;assertExactKeys(c,correction?['context','studentId','entityId','expectedRevisionId','payload']:['context','studentId','payload']);validateNativeStudentPayload(c.payload);assertStudentOperationKind(operation,c.payload);return this.execute(c.context,operation,c,async(db,at,r)=>{const teacher=await this.active(db,c.context,c.payload.kind==='previous_homework_assessment'?c.payload.assessmentScope.businessDate:c.payload.recordScope.businessDate);await this.validateStudentRelations(db,c.context,c.studentId,c.payload,teacher);const type=c.payload.kind==='daily_progress'?'DailyProgress':c.payload.kind==='daily_record_draft'?'DailyRecordDraft':'PreviousHomeworkAssessment';let prior:RecordVersion|null=null;if(correction){const [row]=await db<StudentRow[]>`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${c.context.ownerId} AND h.student_id=${c.studentId} AND h.entity_id=${c.entityId}`;prior=row?studentVersion(row):null;if(!prior)throw Error('unknown_native_record');this.cas(prior,c.expectedRevisionId,c.context);assertStudentCorrection(prior.payload,c.payload);}
 const key=correction?c.entityId:`${type==='DailyProgress'?'progress':type==='DailyRecordDraft'?'draft':'assessment'}:${randomUUID()}`;
 if(c.payload.kind==='daily_record_draft'){if(c.payload.draftState.state!=='known'||c.payload.draftState.value!=='DRAFT')throw Error('native_approval_required');const scopeDigest=digest([c.context.namespace,scopeIdentity(c.payload.recordScope)]);const [existing]=await db<{draft_entity_id:string}[]>`SELECT draft_entity_id FROM academy.draft_scope_index WHERE owner_id=${c.context.ownerId} AND scope_digest=${scopeDigest}`;if(!correction&&existing){if(!c.payload.supersedesDraftRef||c.payload.supersedesDraftRef.identity.nativeKey!==existing.draft_entity_id)throw Error('duplicate_current_draft');const old=await this.studentForRef(db,c.context,c.payload.supersedesDraftRef);if(old?.payload.kind!=='daily_record_draft'||old.payload.draftState.state!=='known'||old.payload.draftState.value!=='APPROVED')throw Error('invalid_draft_supersession');}if(!correction)await db`INSERT INTO academy.draft_scope_index(owner_id,scope_digest,draft_entity_id) VALUES(${c.context.ownerId},${scopeDigest},${key}) ON CONFLICT(owner_id,scope_digest) DO UPDATE SET draft_entity_id=EXCLUDED.draft_entity_id`;}
 const v=await this.persistStudent(db,c.context,r,at,c.studentId,key,c.payload,prior);return this.result(c.context,r,at,type,key,v.revisionId,v.sequence,v.contentDigest,prior?.revisionId??null);
 });}
 createAssessment=(c:CreateAssessmentCommand)=>this.studentWrite('createAssessment',c);
 createDraft=(c:CreateDraftCommand)=>this.studentWrite('createDraft',c);
 createProgress=(c:CreateProgressCommand)=>this.studentWrite('createProgress',c);
 correctPrerequisiteRecord=(c:CorrectStudentCommand)=>this.studentWrite('correctPrerequisiteRecord',c);
 async approvalClosurePreview(context:CommandContext,draftRef:ObjectRef<'DailyRecordDraft'>):Promise<ApprovalClosure>{validateContext(context);return (await this.approvalClosure(this.db,context,draftRef)).closure;}
 private async approvalClosure(db:SQL,c:CommandContext,draftRef:ObjectRef<'DailyRecordDraft'>):Promise<{version:RecordVersion;payload:import('./contracts/prerequisiteRecords').DailyRecordDraftPayload;closure:ApprovalClosure}>{
  validateObjectRef(draftRef,['DailyRecordDraft']);await this.assertRef(db,c,draftRef);const v=await this.studentForRef(db,c,draftRef);if(v?.payload.kind!=='daily_record_draft')throw Error('draft_required');const p=v.payload,scope=p.recordScope;
  const teacher=await this.active(db,c,scope.businessDate),now=await this.clock(db);
  if(p.draftState.state!=='known'||p.draftState.value!=='DRAFT')throw Error('invalid_transition');
  await this.validateStudentRelations(db,c,v.studentId,p,teacher);
  const [head]=await db<{draft_entity_id:string}[]>`SELECT draft_entity_id FROM academy.draft_scope_index WHERE owner_id=${c.ownerId} AND scope_digest=${digest([c.namespace,scopeIdentity(scope)])}`;
  if(head?.draft_entity_id!==v.entityId)throw Error('completeness_violated:SCOPE');
  const [snapshot]=await db`SELECT request_id FROM academy.read_occurrences WHERE owner_id=${c.ownerId} AND actor_id=${c.actorId} AND status='COMPLETED' AND snapshot_digest=${digest(p.sourceSnapshot)} LIMIT 1`;
  if(!snapshot||Date.parse(p.sourceSnapshot.asOf)>Date.parse(now))throw Error('source_snapshot_unverified');
  const dependencies=new Map<string,IdentityRevision>(),linkRows=new Map<string,OwnerVersion>();
  const pinNative=(type:string,key:string,revision:string)=>{const value:IdentityRevision={ref:this.ref(c,type,key),expected:{scheme:'OWNER_REVISION',value:revision}};dependencies.set(canonicalJson(value),value);};
  const pin=async(ref:ObjectRef)=>{await this.assertRef(db,c,ref);pinNative(ref.identity.objectType,ref.identity.nativeKey,ref.revision);};
  const activities=await this.ownerRows<ActivityScopeLink>(db,'scope',c.ownerId),temporal=await this.ownerRows<TemporalBinding>(db,'binding',c.ownerId);
  const sourceRows=await db<StudentRow[]>`SELECT v.* FROM academy.record_heads h JOIN academy.record_versions v USING(owner_id,student_id,entity_id,sequence) WHERE h.owner_id=${c.ownerId} AND h.student_id=${v.studentId}`;
  const records=sourceRows.map(studentVersion);if(records.some(row=>row.ownerId!==c.ownerId||row.studentId!==v.studentId))throw Error('stored_family_binding');if(records.length>256)throw Error('completeness_unknown:COMPLETE_COLLECTION');
  const sourceRef=(row:RecordVersion,type:EducationType):ObjectRef=>({identity:{scopeRef:c.scopeRef,namespace:c.namespace,objectType:type,nativeKey:row.entityId},revision:row.revisionId});
  const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
  const collectScope=async(s:RecordScope)=>{
   await this.assertScope(db,c,s);for(const ref of [s.studentRef,s.classGroupRef,s.lessonRef])await pin(ref);
   const lesson=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,s.lessonRef.identity.nativeKey);if(!lesson)throw Error('completeness_unknown:SCOPE');await pin(lesson.payload.classGroupRef);
   if(lesson.payload.participantRefs.state!=='known'||!lesson.payload.participantRefs.value.some(r=>same(r,s.studentRef)))throw Error('completeness_unknown:SCOPE');
   if(lesson.payload.teacherRefs.state!=='known')throw Error('completeness_unknown:TEACHER_CONTEXT');
   for(const ref of lesson.payload.teacherRefs.value){if(!temporal.some(row=>row.payload.bindingKind==='TEACHING_ASSIGNMENT'&&same(row.payload.subjectRef,s.classGroupRef)&&same(row.payload.targetRef,ref)&&row.payload.validFrom<=s.businessDate&&(row.payload.validTo===null||s.businessDate<row.payload.validTo)))throw Error('completeness_unknown:TEACHER_CONTEXT');await pin(ref);const t=await this.one<TeacherBinding>(db,'teacher',c.ownerId,ref.identity.nativeKey);if(!t)throw Error('completeness_unknown:TEACHER_CONTEXT');assertTeacherDate(t.payload,s.businessDate);}
   for(const link of temporal){const q=link.payload;if(q.validFrom<=s.businessDate&&(q.validTo===null||s.businessDate<q.validTo)&&((q.bindingKind==='CLASS_MEMBERSHIP'&&same(q.subjectRef,s.studentRef)&&same(q.targetRef,s.classGroupRef))||(q.bindingKind==='LESSON_PARTICIPATION'&&same(q.subjectRef,s.lessonRef)&&same(q.targetRef,s.studentRef))||(q.bindingKind==='TEACHING_ASSIGNMENT'&&same(q.subjectRef,s.classGroupRef)&&lesson.payload.teacherRefs.value.some(t=>same(t,q.targetRef))))){linkRows.set(link.entityKey,link);await pin(q.subjectRef);await pin(q.targetRef);}}
   const group=await this.one<ClassGroupRecord>(db,'class',c.ownerId,s.classGroupRef.identity.nativeKey);if(group?.payload.businessTimezone.state!=='known'||group.payload.businessTimezone.value!=='Asia/Seoul')throw Error('business_calendar_unknown');
   return lesson;
  };
  const lesson=await collectScope(scope);
  if(p.responsibleTeacherRef.state!=='known')throw Error('completeness_unknown:TEACHER_CONTEXT');const teacherRef=p.responsibleTeacherRef.value;await pin(teacherRef);if(p.supersedesDraftRef!==null){await pin(p.supersedesDraftRef);const previous=await this.studentForRef(db,c,p.supersedesDraftRef);if(previous?.payload.kind!=='daily_record_draft'||scopeIdentity(previous.payload.recordScope)!==scopeIdentity(scope)||previous.payload.draftState.state!=='known'||previous.payload.draftState.value!=='APPROVED')throw Error('invalid_draft_supersession');}
  if(lesson.payload.teacherRefs.state!=='known'||!lesson.payload.teacherRefs.value.some(r=>same(r,teacherRef))||![...linkRows.values()].some(row=>row.payload.kind==='temporal_binding'&&row.payload.bindingKind==='TEACHING_ASSIGNMENT'&&same(row.payload.subjectRef,scope.classGroupRef)&&same(row.payload.targetRef,teacherRef)))throw Error('completeness_unknown:TEACHER_CONTEXT');
  const attachment=async(ref:ObjectRef)=>{
   const matches=activities.filter(a=>activityScopeState(a.payload)==='ACTIVE'&&same(a.payload.activityRef.identity,ref.identity));if(matches.length!==1||!same(matches[0]!.payload.activityRef,ref))throw Error('completeness_unknown:SOURCE_REVISIONS');
   const row=matches[0]!;if(row.payload.recordScope.studentRef.identity.nativeKey!==v.studentId)throw Error('scope_conflict');linkRows.set(row.entityKey,row);await pin(ref);await collectScope(row.payload.recordScope);return row;
  };
  const current={progress:[] as {ref:ObjectRef;payload:unknown}[],homework:[] as {ref:ObjectRef;payload:unknown}[],attempts:[] as {ref:ObjectRef;payload:unknown}[],previousAssessments:[] as {ref:ObjectRef;payload:unknown}[]};
  const byRevision=new Map(records.map(row=>[row.revisionId,row]));
  const catalogRows=await db<{node_id:string;revision_id:string;payload:CatalogNode;content_digest:string}[]>`SELECT DISTINCT ON(node_id) node_id,revision_id,payload,content_digest FROM academy.catalog_versions WHERE owner_id=${c.ownerId} ORDER BY node_id,sequence DESC`;
  const catalog=new Map(catalogRows.map(row=>[row.node_id,row]));
  const catalogNode=(key:string,revision?:string)=>{const row=catalog.get(key);if(!row||revision!==undefined&&row.revision_id!==revision||digest(row.payload)!==row.content_digest)throw Error('stale_source_revision');const type=row.payload.kind==='book_edition'?'TextbookEdition':row.payload.kind==='learning_section'?'Section':['major_unit','middle_unit','minor_unit'].includes(row.payload.kind)?'Unit':'NativeCatalogNode';pinNative(type,key,row.revision_id);return row.payload;};
  const catalogChain=(key:string,allowed:Set<string>)=>{const seen=new Set<string>();let node=catalogNode(key);for(;;){if(seen.has(node.id)||!allowed.has(node.id))throw Error('catalog_scope_conflict');seen.add(node.id);if(node.kind==='book_edition')return node;if(node.parent.state!=='known')throw Error('completeness_unknown:HOMEWORK');node=catalogNode(node.parent.value);}};
  const assignments=records.filter(row=>row.payload.kind==='learning_work_assignment');
  const applicable=new Set<string>();
  for(const row of assignments){
   if(row.payload.kind!=='learning_work_assignment')continue;const q=row.payload,ref=sourceRef(row,'HomeworkAssignment'),origin=await attachment(ref),originScope=origin.payload.recordScope;
   if(q.effectiveDate!==originScope.businessDate)throw Error('completeness_source_conflict:HOMEWORK');
   if(q.dueDate.state!=='known')throw Error('completeness_unknown:HOMEWORK');if(q.dueDate.value<q.effectiveDate)throw Error('completeness_source_conflict:HOMEWORK');
   if(!q.evidenceRefs.length||!q.items.length||!q.catalogRefs.length||!same(q.sourceStudent,p.sourceStudent))throw Error('completeness_unknown:HOMEWORK');
   if(q.replaces!==undefined)throw Error('completeness_unknown:HOMEWORK_REPLACEMENT');
   const allowed=new Set(q.catalogRefs.map(r=>r.nodeId));for(const r of q.catalogRefs)catalogNode(r.nodeId,r.revisionId);
   const registration=byRevision.get(q.registrationRevisionId);if(registration?.payload.kind!=='source_book_registration')throw Error('completeness_unknown:SOURCE_REVISIONS');
   if(Date.parse(registration.sourceObservedAt)>Date.parse(p.sourceSnapshot.asOf))throw Error('source_snapshot_unverified');const reg=registration.payload;if(!same([reg.sourceStudent,reg.sourceCourse,reg.sourceUserCourse,reg.sourceBook],[q.sourceStudent,q.sourceCourse,q.sourceUserCourse,q.sourceBook]))throw Error('catalog_scope_conflict');pinNative('NativeSourceRecord',registration.entityId,registration.revisionId);
   for(const item of q.items){const node=catalogNode(item.contentNodeId),section=catalogNode(item.sectionNodeId);if(node.kind!=='problem'||section.kind!=='learning_section'||!same(node.sourceKey,item.itemKey)||!q.sectionNodeIds.includes(section.id))throw Error('catalog_scope_conflict');const chain=traceHierarchy(catalogRows.map(r=>r.payload),node.id);if(chain.state!=='known'||!chain.path.some(n=>n.id===section.id))throw Error('catalog_scope_conflict');const book=catalogChain(node.id,allowed);if(book.id!==reg.catalogNodeId||!same(book.sourceKey,q.sourceBook))throw Error('catalog_scope_conflict');}
   if(scopeIdentity(originScope)===scopeIdentity(scope))current.homework.push({ref,payload:q});
   let prior=originScope.businessDate<scope.businessDate;
   if(originScope.businessDate===scope.businessDate&&originScope.lessonRef.identity.nativeKey!==scope.lessonRef.identity.nativeKey){const earlier=await this.one<LessonSessionRecord>(db,'lesson',c.ownerId,originScope.lessonRef.identity.nativeKey);if(earlier?.payload.endsAt.state!=='known'||lesson.payload.startsAt.state!=='known')throw Error('completeness_unknown:PREVIOUS_HOMEWORK');prior=Date.parse(earlier.payload.endsAt.value)<=Date.parse(lesson.payload.startsAt.value);if(!prior)throw Error('completeness_unknown:PREVIOUS_HOMEWORK');}
   if(prior&&q.status==='assigned')applicable.add(row.revisionId);
  }
  const satisfied=new Set<string>();
  for(const row of records){
   const q=row.payload;if(!['daily_progress','learning_work_attempt','previous_homework_assessment'].includes(q.kind))continue;
   const type=q.kind==='daily_progress'?'DailyProgress':q.kind==='learning_work_attempt'?'DailyTestAttempt':'PreviousHomeworkAssessment',ref=sourceRef(row,type),link=await attachment(ref),s=link.payload.recordScope;
   if(Date.parse(row.sourceObservedAt)>Date.parse(p.sourceSnapshot.asOf))throw Error('source_snapshot_unverified');
   if(q.kind==='daily_progress'){
    // The current ACTIVE attachment governs (CorrectActivityScope may retarget it); the embedded scope is history.
    if(scopeIdentity(s)!==scopeIdentity(scope))continue;
    if(q.progressState.state!=='known'||q.contentScope.sectionRefs.state!=='known'||!q.contentScope.sectionRefs.value.length)throw Error('completeness_unknown:PROGRESS');
    await this.validateStudentRelations(db,c,row.studentId,q,teacher);for(const ref of [q.contentScope.editionRef,q.contentScope.unitRef,...q.contentScope.sectionRefs.value])await pin(ref);
    const chain=traceHierarchy(catalogRows.map(r=>r.payload),q.contentScope.unitRef.identity.nativeKey);if(chain.state!=='known')throw Error('catalog_scope_conflict');for(const node of chain.path)catalogNode(node.id);
    current.progress.push({ref,payload:q});
   }else if(q.kind==='learning_work_attempt'){
    if(q.assessmentBasis!==undefined)throw Error('completeness_unknown:ATTEMPT_SOURCE_MAPPING');const work=byRevision.get(q.assignmentRevisionId);if(work?.payload.kind!=='learning_work_assignment')throw Error('completeness_unknown:TEST_ATTEMPTS');await pin(sourceRef(work,'HomeworkAssignment'));
    if(q.previousAttemptRevisionId!==null){const previous=byRevision.get(q.previousAttemptRevisionId);if(previous?.payload.kind!=='learning_work_attempt'||previous.payload.assignmentRevisionId!==q.assignmentRevisionId||previous.entityId===row.entityId)throw Error('completeness_unknown:TEST_ATTEMPTS');await pin(sourceRef(previous,'DailyTestAttempt'));}
    if(scopeIdentity(s)!==scopeIdentity(scope))continue;assertCompleteGrades(q,work.payload);
    if(q.occurredAt.state!=='known'||nativeBusinessDate(q.occurredAt.value)!==s.businessDate||Date.parse(q.occurredAt.value)>Date.parse(now))throw Error('completeness_unknown:TEST_ATTEMPTS');
    if(work.payload.paper.state!=='known'||!same(q.paperIssuanceKey,work.payload.paper.value.issuanceKey))throw Error('completeness_unknown:TEST_ATTEMPTS');
    const scores=(await this.ownerRows<NativeScoreEvidence>(db,'evidence',c.ownerId)).filter(e=>same(e.payload.attemptRef,ref));if(scores.length!==1)throw Error('completeness_unknown:SCORE_SCALE');const score=scores[0]!,e=score.payload;if(Date.parse(score.sourceObservedAt)>Date.parse(p.sourceSnapshot.asOf))throw Error('source_snapshot_unverified');
    if(!same(e.assignmentRef,sourceRef(work,'HomeworkAssignment'))||scopeIdentity(e.recordScope)!==scopeIdentity(scope))throw Error('completeness_source_conflict:SCORE_SCALE');await this.assertScope(db,c,e.recordScope);await pin(e.recordedBy);const assessor=await this.one<TeacherBinding>(db,'teacher',c.ownerId,e.recordedBy.identity.nativeKey);if(!assessor)throw Error('completeness_unknown:TEACHER_CONTEXT');assertTeacherDate(assessor.payload,s.businessDate);pinNative('NativeScoreEvidence',score.entityKey,score.revisionId);
    current.attempts.push({ref,payload:{attempt:q,scoreEvidence:{revision:score.revisionId,payload:e}}});
   }else if(q.kind==='previous_homework_assessment'){
    if(scopeIdentity(s)!==scopeIdentity(scope))continue;
    await this.validateStudentRelations(db,c,row.studentId,q,teacher);await pin(q.homeworkRef);
    if(!applicable.has(q.homeworkRef.revision)||q.outcome.state!=='known'||q.assessedBy.state!=='known'||q.assessedAt.state!=='known'||nativeBusinessDate(q.assessedAt.value)!==scope.businessDate||Date.parse(q.assessedAt.value)>Date.parse(now))throw Error('completeness_unknown:PREVIOUS_HOMEWORK');
    await pin(q.assessedBy.value);satisfied.add(q.homeworkRef.revision);current.previousAssessments.push({ref,payload:q});
   }
  }
  if([...applicable].some(revision=>!satisfied.has(revision)))throw Error('completeness_violated:PREVIOUS_HOMEWORK');
  // An empty enumeration does not assert applicability. This profile requires positive evidence in every category.
  for(const [rows,refs] of [[current.progress,p.progressRefs],[current.homework,p.homeworkRefs],[current.attempts,p.attemptRefs],[current.previousAssessments,p.previousAssessmentRefs]] as const){if(!rows.length||refs.state!=='known'||!same(rows.map(r=>canonicalJson(r.ref)).sort(),refs.value.map(canonicalJson).sort()))throw Error('completeness_unknown:COMPLETE_COLLECTION');}
  // Every declared link at this occurrence must resolve to exactly one enumerated source, including detached/stale relations.
  const all=[...current.progress,...current.homework,...current.attempts,...current.previousAssessments];for(const link of activities.filter(a=>scopeIdentity(a.payload.recordScope)===scopeIdentity(scope)))if(!all.some(row=>same(row.ref,link.payload.activityRef)))throw Error('completeness_source_conflict:SCOPE');
  for(const row of assignments)if(Date.parse(row.sourceObservedAt)>Date.parse(p.sourceSnapshot.asOf))throw Error('source_snapshot_unverified');
  assertProposalTexts(p,current,r=>this.linkRef(c,r));
  const linkExpectations:LinkRevisionExpectation[]=[];for(const row of linkRows.values()){const e=await this.linkEffect(c,row,null);linkExpectations.push({linkDefinitionBinding:e.linkDefinitionBinding,nativeLinkIdentity:e.nativeLinkIdentity,from:e.from,to:e.to,expected:{scheme:'OWNER_REVISION',value:row.revisionId}});}
  if(dependencies.size>100||linkExpectations.length>100)throw Error('completeness_unknown:COMPLETE_COLLECTION');
  const closure:ApprovalClosure={teacherRef:this.linkRef(c,teacherRef),executorPrincipalBinding:digest({ownerId:c.ownerId,actorId:c.actorId,bindingRevision:teacher.revisionId,authenticationRevision:c.verifiedSession.authenticationRevision}),scopeBinding:digest({scopeRef:c.scopeRef,namespace:c.namespace}),action:c.action,occurrenceId:c.occurrenceId,targets:[{ref:this.linkRef(c,draftRef),expected:{scheme:'OWNER_REVISION',value:draftRef.revision}}],dependencies:[...dependencies.values()].sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b))),changeDigest:digest({profile:'DAILY_RECORD_OCCURRENCE_V1',renderingProfile:'NATIVE_SOURCE_RENDERING_V1',draftRef,payload:p}),requestIntentDigest:c.requestIntentDigest,admissionId:c.admissionId,linkExpectations:linkExpectations.sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)))};validateClosure(closure);return {version:v,payload:p,closure};
 }
 async issueApproval(c:IssueApprovalCommand):Promise<ApprovalIssuance>{assertExactKeys(c,['context','draftRef','closure','validForSeconds']);validateClosure(c.closure);if(!Number.isSafeInteger(c.validForSeconds)||c.validForSeconds<1||c.validForSeconds>900)throw Error('approval_validity');
 // Issuance is its own durable command occurrence. Closure binds the later immutable action occurrence/admission.
 const result=await this.execute(c.context,'issueApproval',c,async(db,at,r)=>{const targetContext={...c.context,action:c.closure.action,occurrenceId:c.closure.occurrenceId,admissionId:c.closure.admissionId,requestIntentDigest:c.closure.requestIntentDigest};const derived=await this.approvalClosure(db,targetContext,c.draftRef);if(c.closure.action.name!=='ApproveDailyRecord'||canonicalJson(derived.closure)!==canonicalJson(c.closure))throw Error('approval_closure_mismatch');const key='approval:'+randomUUID();const payload:ApprovalVersionPayload={...derived.closure,kind:'teacher_approval',approvalId:key,issuerInterfaceBinding:c.context.nativeInterfaceBinding,delegationEvidenceId:null,issuedAt:at,expiresAt:new Date(Date.parse(at)+c.validForSeconds*1000).toISOString(),proofHandle:key,state:'ISSUED',consumedByDraftRevision:null,synthetic:c.context.namespace.startsWith('synthetic')};const v=await this.persistOwner(db,c.context,r,at,'approval',key,payload,null);return this.result(c.context,r,at,'ApprovalRecord',key,v.revisionId,v.sequence,v.contentDigest,null,key);});const [stored]=await this.db.unsafe<BodyRow[]>('SELECT body FROM academy.approval_versions WHERE owner_id=$1 AND entity_key=$2 AND revision_id=$3',[c.context.ownerId,result.identity.nativeKey,result.revisionId]);const row=stored?prerequisiteVersionFrom(stored.body):null;if(!row||row.payload.kind!=='teacher_approval')throw Error('committed_outcome_uncertain');return {approvalId:row.entityKey,proofHandle:row.payload.proofHandle,payload:row.payload,result};
 }
 async consumeApprovalAndApproveDraft(c:ApproveWithApprovalCommand):Promise<NativeWriteResult>{assertExactKeys(c,['context','draftRef','approvalProofHandle']);return this.execute(c.context,'consumeApprovalAndApproveDraft',c,async(db,at,r)=>{const derived=await this.approvalClosure(db,c.context,c.draftRef);const row=await this.one<ApprovalVersionPayload>(db,'approval',c.context.ownerId,c.approvalProofHandle);if(!row)throw Error('approval_required');const p=row.payload;assertApprovalUsable(p,derived.closure,at,c.context.nativeInterfaceBinding);const evidence:EvidenceRef={sourceRef:this.ref(c.context,'ApprovalRecord',row.entityKey),sourceRevision:row.revisionId,locator:'single-use-consumption',observedAt:at};const approved={...derived.payload,draftState:{state:'known' as const,value:'APPROVED' as const,evidence:[evidence]}};const v=await this.persistStudent(db,c.context,r,at,derived.version.studentId,derived.version.entityId,approved,derived.version);const consumed=await this.persistOwner(db,c.context,r,at,'approval',row.entityKey,{...p,state:'CONSUMED',consumedByDraftRevision:v.revisionId},row);return this.result(c.context,r,at,'DailyRecordDraft',v.entityId,v.revisionId,v.sequence,v.contentDigest,derived.version.revisionId,row.entityKey,[{ref:this.ref(c.context,'ApprovalRecord',row.entityKey),before:{scheme:'OWNER_REVISION',value:row.revisionId},after:{scheme:'OWNER_REVISION',value:consumed.revisionId}}]);});}
 async revokeApproval(c:RevokeApprovalCommand):Promise<NativeWriteResult>{assertExactKeys(c,['context','approvalId','expectedRevisionId']);return this.execute(c.context,'revokeApproval',c,async(db,at,r)=>{const teacher=await this.active(db,c.context);const prior=await this.one<ApprovalVersionPayload>(db,'approval',c.context.ownerId,c.approvalId);if(!prior)throw Error('approval_required');this.cas(prior,c.expectedRevisionId,c.context);if(prior.payload.teacherRef.objectKey!==teacher.entityKey&&prior.actorId!==c.context.actorId)throw Error('teacher_attribution_conflict');if(prior.payload.state!=='ISSUED')throw Error('invalid_transition');const v=await this.persistOwner(db,c.context,r,at,'approval',prior.entityKey,{...prior.payload,state:'REVOKED'},prior);return this.result(c.context,r,at,'ApprovalRecord',v.entityKey,v.revisionId,v.sequence,v.contentDigest,prior.revisionId,prior.entityKey);});}
 private validateRead(r:ReadAdmission):void{validateReadAdmission(r);}
 async readOccurrenceLookup(r:ReadAdmission):Promise<ReadOccurrenceLookup>{this.validateRead(r);const [row]=await this.db<ReadRow[]>`SELECT request,status,snapshot_digest,refusal_code FROM academy.read_occurrences WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND request_id=${r.requestId}`;if(!row)return {request:r,status:'UNKNOWN',snapshotDigest:null,refusalCode:null,partialDataDiscarded:true};this.validateRead(row.request);if(canonicalJson(row.request)!==canonicalJson(r))throw Error('read_request_binding_conflict');return {request:r,status:row.status,snapshotDigest:row.snapshot_digest,refusalCode:row.refusal_code,partialDataDiscarded:true};}
 async admitReadOccurrence(r:ReadAdmission):Promise<ReadOccurrenceLookup>{this.validateRead(r);await this.db.begin(async tx=>{await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;await lockApprovalDependencies(tx,r.ownerId);await this.lock(tx,{ownerId:r.ownerId,actorId:r.actorId,idempotencyKey:'read:'+r.requestId});const existing=await new NativePrerequisiteStore(tx).readOccurrenceLookup(r);if(existing.status!=='UNKNOWN')throw Error('read_occurrence_already_admitted');const rows=await tx`SELECT request_id FROM academy.read_occurrences WHERE owner_id=${r.ownerId} AND actor_id=${r.actorId} AND request_id=${r.requestId}`;if(rows.length)throw Error('read_occurrence_already_admitted');await tx`INSERT INTO academy.read_occurrences(owner_id,actor_id,request_id,request,status) VALUES(${r.ownerId},${r.actorId},${r.requestId},${canonicalJson(r)}::text::jsonb,'PENDING')`;await this.afterDependencyWrite?.("admitReadOccurrence",r.ownerId,r.requestId,tx as unknown as SQL);});return this.readOccurrenceLookup(r);}
 private assertFinalization(c:ReadFinalization):void{assertExactKeys(c,['request','status','snapshotDigest','refusalCode']);this.validateRead(c.request);if(!['COMPLETED','REFUSED','UNKNOWN'].includes(c.status)||c.status==='COMPLETED'&&(c.snapshotDigest===null||c.refusalCode!==null)||c.status==='REFUSED'&&(c.refusalCode===null||c.snapshotDigest!==null)||c.status==='UNKNOWN'&&c.snapshotDigest!==null)throw Error('invalid_read_finalization');if(c.snapshotDigest!==null)sha(c.snapshotDigest);if(c.refusalCode!==null)requireText(c.refusalCode,'read refusal');}
 private async finalizePending(c:ReadFinalization):Promise<void>{const row=await this.readOccurrenceLookup(c.request);if(row.status!=='PENDING')throw Error('read_already_terminal_or_unadmitted');await this.db`UPDATE academy.read_occurrences SET status=${c.status},snapshot_digest=${c.snapshotDigest},refusal_code=${c.refusalCode} WHERE owner_id=${c.request.ownerId} AND actor_id=${c.request.actorId} AND request_id=${c.request.requestId}`;}
 async finalizeReadOccurrence(c:ReadFinalization):Promise<ReadOccurrenceLookup>{this.assertFinalization(c);await this.db.begin(async tx=>{await tx`SET TRANSACTION ISOLATION LEVEL READ COMMITTED`;await lockApprovalDependencies(tx,c.request.ownerId);await this.lock(tx,{ownerId:c.request.ownerId,actorId:c.request.actorId,idempotencyKey:'read:'+c.request.requestId});await new NativePrerequisiteStore(tx).finalizePending(c);await this.afterDependencyWrite?.("finalizeReadOccurrence",c.request.ownerId,c.request.requestId,tx as unknown as SQL);});return this.readOccurrenceLookup(c.request);}
 /** Terminal audit write for the output gate only. The caller must already
  * hold the shared owner gate and then the exact read key inside this
  * store's transaction; this never acquires the owner lock after the read key. */
 async finalizeOutputInGate(c:ReadFinalization):Promise<ReadOccurrenceLookup>{this.assertFinalization(c);await this.finalizePending(c);return this.readOccurrenceLookup(c.request);}
}
export function assertStudentCorrection(before:AcademyRecord,after:NativeStudentPayload):void{if(before.kind!==after.kind)throw Error('record_kind_changed');if(before.kind==='daily_record_draft'&&after.kind==='daily_record_draft'){if(before.draftState.state!=='known'||before.draftState.value!=='DRAFT'||after.draftState.state!=='known'||after.draftState.value!=='DRAFT')throw Error('invalid_transition');for(const f of ['recordScope','sourceStudent','responsibleTeacherRef','supersedesDraftRef'] as const)if(canonicalJson(before[f])!==canonicalJson(after[f]))throw Error('draft_identity_changed');}if(before.kind==='daily_progress'&&after.kind==='daily_progress'&&canonicalJson([before.sourceStudent,scopeIdentity(before.recordScope)])!==canonicalJson([after.sourceStudent,scopeIdentity(after.recordScope)]))throw Error('progress_identity_changed');if(before.kind==='previous_homework_assessment'&&after.kind==='previous_homework_assessment'&&canonicalJson([before.sourceStudent,before.homeworkRef,scopeIdentity(before.assessmentScope)])!==canonicalJson([after.sourceStudent,after.homeworkRef,scopeIdentity(after.assessmentScope)]))throw Error('assessment_identity_changed');}
export function assertApprovalUsable(p:ApprovalVersionPayload,closure:ApprovalClosure,at:string,issuer:string):void{validateOwnerPayload(p);validateClosure(closure);assertInstant(at);if(p.state==='REVOKED')throw Error('approval_revoked');if(p.state==='CONSUMED')throw Error('approval_consumed');if(Date.parse(at)<Date.parse(p.issuedAt)||Date.parse(at)>=Date.parse(p.expiresAt))throw Error('approval_expired');if(p.issuerInterfaceBinding!==issuer)throw Error('approval_issuer_mismatch');const {kind,approvalId,issuerInterfaceBinding,delegationEvidenceId,issuedAt,expiresAt,proofHandle,state,consumedByDraftRevision,synthetic,...stored}=p;if(canonicalJson(stored)!==canonicalJson(closure))throw Error('approval_closure_mismatch');}
export function validateReceipt(r:NativeCommitReceipt):void{assertExactKeys(r,['schema','nativeOwnerBinding','nativeInterfaceBinding','nativeCommitId','occurrenceId','idempotencyKey','requestDigest','action','principalBinding','scopeBinding','approvalId','admissionId','committedAt','changed','changedLinks','businessCommitCount','proofHandle']);validateAction(r.action);if(r.schema!=='native-commit-receipt.v1'||r.businessCommitCount!==1)throw Error('receipt_contract');[r.nativeOwnerBinding,r.nativeInterfaceBinding,r.idempotencyKey,r.requestDigest,r.principalBinding,r.scopeBinding].forEach(sha);[r.nativeCommitId,r.occurrenceId,r.admissionId,r.proofHandle].forEach(x=>requireText(x,'receipt'));assertInstant(r.committedAt);if(r.changed.length<1||r.changed.length>100||r.changedLinks.length>100)throw Error('receipt_effect_bounds');for(const e of r.changed){assertExactKeys(e,['ref','before','after']);validateNativeRef(e.ref);if(e.before!=='ABSENT')validateRevision(e.before);validateRevision(e.after);}for(const e of r.changedLinks){assertExactKeys(e,['linkDefinitionBinding','nativeLinkIdentity','from','to','before','after']);sha(e.linkDefinitionBinding);requireText(e.nativeLinkIdentity,'link');validateNativeRef(e.from);validateNativeRef(e.to);if(e.before!=='ABSENT')validateRevision(e.before);if(e.after!=='ABSENT')validateRevision(e.after);if(e.before==='ABSENT'&&e.after==='ABSENT')throw Error('empty_link_effect');}}
