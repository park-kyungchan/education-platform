/** Pure candidate model. No persistence, network, native LMS IDs or execution authority. */
export const MODEL_VERSION = 'academy.student-event/2.0.0' as const;
export type EntityKind = 'student'|'book_edition'|'unit'|'item'|'item_set'|'assignment'|'activity'|'paper_artifact'|'session'|'handoff'|'person'|'unresolved_scope';
export type EntityRef<K extends EntityKind = EntityKind> = Readonly<{kind:K; id:string; namespace:'academy_private'|'source_native'; studentId:string|null; nativeIdentityVerified:boolean}>;
export type RelationState = 'unknown'|'provisional'|'user_reported'|'source_verified'|'rejected'|'conflicted';
export interface EntityBase<K extends EntityKind> {kind:K; ref:EntityRef<K>; labelRaw:string; evidenceIds:readonly string[];}
export interface BookEdition extends EntityBase<'book_edition'> {seriesRaw:string; gradeRaw:string|null; semesterRaw:string|null; volumeRaw:string|null; curriculumRaw:string|null; editionRevision:string|null; identityState:RelationState;}
export interface Unit extends EntityBase<'unit'> {bookEdition:EntityRef<'book_edition'>|null; parent:EntityRef<'unit'>|null; level:'major'|'middle'|'subunit'|'unknown'; codeRaw:string; titleRaw:string; pageStart:number|null; pageEnd:number|null; pageEndBasis:'source_explicit'|'next_start_minus_one'|'unknown';}
export interface Item extends EntityBase<'item'> {labelRaw:string; nativeLectureKey:string|null; nativeKeyRelation:RelationState; sourceUnitRaw:string|null;}
export type Scope = Readonly<{scopeId:string; studentId:string; bookEdition:EntityRef<'book_edition'>|null; units:readonly EntityRef<'unit'>[]; items:readonly EntityRef<'item'>[]; rawDescription:string; identityState:RelationState; coverage:'partial'|'complete_within_declared_scope'|'unknown'}>;
export type CurriculumRelation =
 {kind:'enrolled_in'; from:EntityRef<'student'>; to:EntityRef<'book_edition'>; state:RelationState; evidenceIds:readonly string[]} |
 {kind:'contains_unit'; from:EntityRef<'book_edition'|'unit'>; to:EntityRef<'unit'>; state:RelationState; evidenceIds:readonly string[]} |
 {kind:'contains_item'; from:EntityRef<'unit'|'paper_artifact'|'item_set'>; to:EntityRef<'item'>; sourceOrder:number|null; state:RelationState; evidenceIds:readonly string[]} |
 {kind:'assigns_scope'; from:EntityRef<'assignment'>; to:Scope; state:RelationState; evidenceIds:readonly string[]} |
 {kind:'performs_assignment'; from:EntityRef<'activity'>; to:EntityRef<'assignment'>; state:RelationState; evidenceIds:readonly string[]} |
 {kind:'handoff_for_session'; from:EntityRef<'handoff'>; to:EntityRef<'session'>; state:RelationState; evidenceIds:readonly string[]};
/** Build/collection time never fills a source event clock. */
export interface Clocks {occurredAt:string|null; occurredDate:string|null; sourceObservedAt:string|null; sourceReportedAt:string|null; sourceTimeRaw:string|null; sourceTimePrecision:'instant'|'minute'|'approximate_minute'|'date'|'unknown'; collectedAt:string; scheduledFor:string|null;}
export interface Provenance {kind:'space_preserved_evidence'|'legacy_preserved_evidence'|'verified_direct_source'|'direct_user_report'|'user_report_relay'; originalKind:'user_report'|'source_observation'|'derived_mapping'|'unknown'; pageId:string|null; pageSequence:number|null; blockId:string|null; blockHash:string|null; sourceMessageId:string|null; sourceReference:string|null; rawEvidenceQuote:string; originalReceiptVerifiedHere:boolean;}
export const STAGES = ['requested','generated','printed','prepared','distributed','solved','grading_local','grading_lms_entry','correction','teacher_review','video_filmed','video_uploaded','dailyrecord_prepared','dailyrecord_recorded','parent_message_sent','handoff_sent','handoff_received','attendance_arrived','attendance_departed'] as const;
export type Stage = typeof STAGES[number];
export const STAGE_STATES = ['unknown','planned','in_progress','complete','incomplete','not_performed','conditional','cancelled'] as const;
export type StageState = typeof STAGE_STATES[number];
export type Due = Readonly<{date:string|null; time:string|null; timezone:'Asia/Seoul'; resolution:'source_explicit'|'anchored_relative'|'unresolved'; raw:string|null; anchorDate:string|null}>;
interface EventBase {schemaVersion:typeof MODEL_VERSION; eventId:string; studentId:string; target:EntityRef; scope:Scope; provenance:Provenance; clocks:Clocks; supersedes:readonly string[]; eligibility:'local_candidate_only'|'adopted_preserved_evidence';}
export type Event =
 (EventBase & {kind:'stage_assertion'; stage:Stage; state:StageState; ownerRaw:string|null; conditionRaw:string|null}) |
 (EventBase & {kind:'assignment_assertion'; status:'planned'|'teacher_confirmed'|'issued_user_report'|'cancelled'; due:Due; submissionFormatRaw:string|null; basisItemCount:number|null; actualWrongItemLabels:readonly string[]|null; additionalLabels:readonly string[]|null}) |
 (EventBase & {kind:'due_assertion'; due:Due}) |
 (EventBase & {kind:'assignment_identity_correction'; correctsEventId:string; bookLabelRaw:string; previousBookLabelRaw:string; displayLabelRaw:string; scopeDescriptionRaw:string; structurePartsRaw:readonly string[]; nativeBookCode:null; editionRevision:null; volumeRaw:null; tocMapping:'unverified'; referenceSample:{labelRaw:string;retained:true;studentMapping:'rejected'}; correctionScope:'book_label_and_attribution_only'}) |
 (EventBase & {kind:'attendance_assertion'; date:string; session:'1'|'2'; arrivalLocal:string|null; status:'arrived_user_report'|'retracted_wrong_student'; exceptionResolution:'not_conflicting'|'pending_clarification'|'confirmed_exception'|'mistaken_student'; regularMembershipChanged:false; reason:string|null}) |
 (EventBase & {kind:'schedule_assertion'; scheduleKind:'arrival'|'absence'|'departure'|'makeup'; date:string; startsLocal:string|null; endsLocal:string|null; approximate:boolean; status:'planned'|'confirmed_schedule'|'cancelled'; actualOccurredAt:null}) |
 (EventBase & {kind:'reference_observation'; referenceKind:'answer_response'|'paper_item_membership'|'toc_mapping'|'assignment_selection'; details:Readonly<Record<string,unknown>>});
export function factKey(e:Event):string {return [e.studentId,e.target.namespace,e.target.kind,e.target.id,e.kind,e.kind==='stage_assertion'?e.stage:e.kind==='schedule_assertion'?e.scheduleKind:e.kind==='reference_observation'?e.referenceKind:''].join('|');}
function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value);}
function claim(e:Event):unknown {switch(e.kind){case 'stage_assertion':return {stage:e.stage,state:e.state,ownerRaw:e.ownerRaw,conditionRaw:e.conditionRaw};case 'assignment_assertion':return {status:e.status,due:e.due,submissionFormatRaw:e.submissionFormatRaw,basisItemCount:e.basisItemCount,actualWrongItemLabels:e.actualWrongItemLabels,additionalLabels:e.additionalLabels};case 'due_assertion':return e.due;case 'assignment_identity_correction':return {correctsEventId:e.correctsEventId,bookLabelRaw:e.bookLabelRaw,previousBookLabelRaw:e.previousBookLabelRaw,displayLabelRaw:e.displayLabelRaw,scopeDescriptionRaw:e.scopeDescriptionRaw,structurePartsRaw:e.structurePartsRaw,nativeBookCode:e.nativeBookCode,editionRevision:e.editionRevision,volumeRaw:e.volumeRaw,tocMapping:e.tocMapping,referenceSample:e.referenceSample,correctionScope:e.correctionScope};case 'attendance_assertion':return {date:e.date,session:e.session,arrivalLocal:e.arrivalLocal,status:e.status,exceptionResolution:e.exceptionResolution,regularMembershipChanged:e.regularMembershipChanged,reason:e.reason};case 'schedule_assertion':return {scheduleKind:e.scheduleKind,date:e.date,startsLocal:e.startsLocal,endsLocal:e.endsLocal,approximate:e.approximate,status:e.status,actualOccurredAt:e.actualOccurredAt};case 'reference_observation':return e.details;}}
const isoDate=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const instant=(x:string)=>/^\d{4}-\d\d-\d\dT.*(Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
function validateDue(d:Due){if(!d||!['source_explicit','anchored_relative','unresolved'].includes(d.resolution)||!nullableString(d.raw)||!nullableString(d.anchorDate))throw Error('invalid_due_fields');if(d.time!==null&&!/^\d\d:\d\d$/.test(d.time))throw Error('invalid_due_time');if(d.timezone!=='Asia/Seoul'||d.date!==null&&!isoDate(d.date))throw Error('invalid_due');if(d.resolution==='unresolved'&&(d.date!==null||d.time!==null))throw Error('unresolved_due_cannot_be_filled');if(d.resolution==='anchored_relative'&&(!d.raw||!d.anchorDate||!isoDate(d.anchorDate)))throw Error('relative_due_requires_anchor');}
const EVENT_KINDS=['stage_assertion','assignment_assertion','due_assertion','schedule_assertion','reference_observation','attendance_assertion','assignment_identity_correction'];
const ENTITY_KINDS=['student','book_edition','unit','item','item_set','assignment','activity','paper_artifact','session','handoff','person','unresolved_scope'];
const str=(x:unknown):x is string=>typeof x==='string'&&x.length>0;
const nullableString=(x:unknown)=>x===null||typeof x==='string';
const stringArray=(x:unknown):x is string[]=>Array.isArray(x)&&x.every(str);
export function validateEvents(events:readonly Event[]):void {
 if(!Array.isArray(events))throw Error('events_array_required');
 const byId=new Map<string,Event>();
 for(const e0 of events){
  const e=e0 as Event;
  if(!e||typeof e!=='object'||!EVENT_KINDS.includes(e.kind)||!['local_candidate_only','adopted_preserved_evidence'].includes(e.eligibility))throw Error('invalid_event_kind_or_eligibility');
  const common=['schemaVersion','eventId','studentId','target','scope','provenance','clocks','supersedes','eligibility','kind'];
  const specific={stage_assertion:['stage','state','ownerRaw','conditionRaw'],assignment_assertion:['status','due','submissionFormatRaw','basisItemCount','actualWrongItemLabels','additionalLabels'],due_assertion:['due'],assignment_identity_correction:['correctsEventId','bookLabelRaw','previousBookLabelRaw','displayLabelRaw','scopeDescriptionRaw','structurePartsRaw','nativeBookCode','editionRevision','volumeRaw','tocMapping','referenceSample','correctionScope'],attendance_assertion:['date','session','arrivalLocal','status','exceptionResolution','regularMembershipChanged','reason'],schedule_assertion:['scheduleKind','date','startsLocal','endsLocal','approximate','status','actualOccurredAt'],reference_observation:['referenceKind','details']}[e.kind];
  if(Object.keys(e).some(k=>![...common,...specific].includes(k))||[...common,...specific].some(k=>!Object.hasOwn(e,k)))throw Error('unknown_or_missing_event_fields');
  const validRef=(r:EntityRef)=>r&&ENTITY_KINDS.includes(r.kind)&&str(r.id)&&['academy_private','source_native'].includes(r.namespace)&&nullableString(r.studentId)&&typeof r.nativeIdentityVerified==='boolean';
  if(!validRef(e.target)||!e.scope||!str(e.scope.scopeId)||!str(e.scope.rawDescription)||!Array.isArray(e.scope.units)||!Array.isArray(e.scope.items)||!e.scope.units.every(validRef)||!e.scope.items.every(validRef)||e.scope.bookEdition!==null&&!validRef(e.scope.bookEdition))throw Error('invalid_scope_or_reference');
  const scopeRefs=[e.target,...(e.scope.bookEdition?[e.scope.bookEdition]:[]),...e.scope.units,...e.scope.items];
  if(scopeRefs.some(r=>r.studentId!==null&&r.studentId!==e.studentId))throw Error('cross_student_nested_reference');
  if(scopeRefs.some(r=>r.namespace==='source_native'&&!r.nativeIdentityVerified))throw Error('unverified_native_identity');
  if(e.scope.bookEdition&&e.scope.bookEdition.kind!=='book_edition'||e.scope.units.some(r=>r.kind!=='unit')||e.scope.items.some(r=>r.kind!=='item'))throw Error('scope_reference_kind_mismatch');
  if(!e.provenance||!['space_preserved_evidence','legacy_preserved_evidence','verified_direct_source','direct_user_report','user_report_relay'].includes(e.provenance.kind)||!str(e.provenance.rawEvidenceQuote)||typeof e.provenance.originalReceiptVerifiedHere!=='boolean')throw Error('invalid_provenance');
  if(!e.clocks||!str(e.clocks.collectedAt)||!stringArray(e.supersedes))throw Error('invalid_clocks_or_supersedes');
  if(e.kind==='stage_assertion'&&(!nullableString(e.ownerRaw)||!nullableString(e.conditionRaw)))throw Error('invalid_stage_fields');
  if(e.kind==='assignment_assertion'&&(!['planned','teacher_confirmed','issued_user_report','cancelled'].includes(e.status)||!nullableString(e.submissionFormatRaw)||e.basisItemCount!==null&&(!Number.isSafeInteger(e.basisItemCount)||e.basisItemCount<0)||e.actualWrongItemLabels!==null&&!stringArray(e.actualWrongItemLabels)||e.additionalLabels!==null&&!stringArray(e.additionalLabels)))throw Error('invalid_assignment_fields');
  if(e.kind==='assignment_identity_correction'&&(!str(e.correctsEventId)||!str(e.bookLabelRaw)||!str(e.previousBookLabelRaw)||!str(e.displayLabelRaw)||!str(e.scopeDescriptionRaw)||!stringArray(e.structurePartsRaw)||e.target.kind!=='assignment'||e.scope.bookEdition!==null||e.scope.units.length!==0||e.scope.items.length!==0||e.nativeBookCode!==null||e.editionRevision!==null||e.volumeRaw!==null||e.tocMapping!=='unverified'||e.correctionScope!=='book_label_and_attribution_only'||!e.referenceSample||!str(e.referenceSample.labelRaw)||e.referenceSample.retained!==true||e.referenceSample.studentMapping!=='rejected'))throw Error('invalid_book_identity_correction');
  if(e.kind==='schedule_assertion'&&(!['arrival','absence','departure','makeup'].includes(e.scheduleKind)||!['planned','confirmed_schedule','cancelled'].includes(e.status)||typeof e.approximate!=='boolean'||!nullableString(e.startsLocal)||!nullableString(e.endsLocal)))throw Error('invalid_schedule_fields');
  if(e.kind==='attendance_assertion'){if(!isoDate(e.date)||!['1','2'].includes(e.session)||e.regularMembershipChanged!==false||!nullableString(e.reason)||!['not_conflicting','pending_clarification','confirmed_exception','mistaken_student'].includes(e.exceptionResolution))throw Error('invalid_actual_attendance');if(e.status==='arrived_user_report'){if(e.arrivalLocal===null||!/^\d\d:\d\d$/.test(e.arrivalLocal)||e.clocks.occurredAt===null||e.exceptionResolution==='mistaken_student')throw Error('invalid_arrival_claim');}else if(e.status==='retracted_wrong_student'){if(e.arrivalLocal!==null||e.clocks.occurredAt!==null||e.exceptionResolution!=='mistaken_student'||!e.supersedes.length)throw Error('invalid_attendance_retraction');}else throw Error('invalid_attendance_status');}
  if(e.kind==='reference_observation'&&(!['answer_response','paper_item_membership','toc_mapping','assignment_selection'].includes(e.referenceKind)||!e.details||typeof e.details!=='object'||Array.isArray(e.details)))throw Error('invalid_reference_fields');
  if(e.schemaVersion!==MODEL_VERSION||!/^evt_[a-f0-9]{64}$/.test(e.eventId)||!/^stu_[a-f0-9]{32}$/.test(e.studentId)||byId.has(e.eventId))throw Error('invalid_event_identity');
  if(e.scope.studentId!==e.studentId||e.target.studentId!==null&&e.target.studentId!==e.studentId)throw Error('cross_student_scope');
  if(e.target.namespace==='source_native'&&!e.target.nativeIdentityVerified)throw Error('unverified_native_identity');
  if(e.clocks.occurredDate!==null&&!isoDate(e.clocks.occurredDate))throw Error('invalid_event_date');
  for(const value of [e.clocks.occurredAt,e.clocks.sourceObservedAt,e.clocks.sourceReportedAt,e.clocks.collectedAt,e.clocks.scheduledFor])if(value!==null&&!instant(value))throw Error('invalid_clock');
  if(e.provenance.kind==='space_preserved_evidence'&&(!e.provenance.pageId||e.provenance.pageSequence===null||!e.provenance.blockId||!e.provenance.blockHash||!/^[a-f0-9]{64}$/.test(e.provenance.blockHash)||e.provenance.originalReceiptVerifiedHere))throw Error('invalid_preserved_page_provenance');
  if(e.provenance.kind==='verified_direct_source'&&!e.provenance.originalReceiptVerifiedHere)throw Error('direct_observation_requires_verified_receipt');
  if(e.kind==='stage_assertion'&&(!STAGES.includes(e.stage)||!STAGE_STATES.includes(e.state)||e.state==='conditional'&&!e.conditionRaw))throw Error('invalid_stage');
  if(e.kind==='assignment_assertion'||e.kind==='due_assertion')validateDue(e.due);
  if(e.kind==='schedule_assertion'&&(!isoDate(e.date)||e.actualOccurredAt!==null))throw Error('plan_is_not_actual_attendance');
  if(new Set(e.supersedes).size!==e.supersedes.length||e.supersedes.includes(e.eventId))throw Error('invalid_supersession');
  byId.set(e.eventId,e);
 }
 for(const e of events)if(e.kind==='assignment_identity_correction'){const prior=byId.get(e.correctsEventId);if(!prior||prior.kind!=='assignment_assertion'||prior.studentId!==e.studentId||prior.target.id!==e.target.id||prior.target.namespace!==e.target.namespace)throw Error('identity_correction_scope_mismatch');}
 const checked=new Set<string>(),visiting=new Set<string>();
 const visit=(id:string)=>{if(visiting.has(id))throw Error('supersession_cycle');if(checked.has(id))return;visiting.add(id);const e=byId.get(id)!;for(const prevId of e.supersedes){const prev=byId.get(prevId);if(!prev)throw Error('superseded_evidence_missing');if(factKey(prev)!==factKey(e))throw Error('supersession_scope_mismatch');visit(prevId);}visiting.delete(id);checked.add(id);};
 for(const e of events)visit(e.eventId);
}
export interface EffectiveFact {key:string; studentId:string; target:EntityRef; status:'supported'|'conflicted'; claims:readonly Event[]; supersededEventIds:readonly string[];}
/** Caller authorizes student scope. Explicit preview IDs do not adopt or persist anything. */
export function deriveEffectiveFacts(events:readonly Event[],allowedStudentIds:readonly string[],options:{previewCandidateIds?:readonly string[]}={}):EffectiveFact[]{
 validateEvents(events);const preview=new Set(options.previewCandidateIds??[]),allowed=new Set(allowedStudentIds);
 const selected=events.filter(e=>allowed.has(e.studentId)&&(e.eligibility==='adopted_preserved_evidence'||preview.has(e.eventId)));
 const hidden=new Set(selected.flatMap(e=>e.supersedes));const groups=new Map<string,Event[]>();
 for(const e of selected){if(hidden.has(e.eventId))continue;const k=factKey(e),rows=groups.get(k)??[];rows.push(e);groups.set(k,rows);}
 return [...groups].map(([key,claims])=>({key,studentId:claims[0].studentId,target:claims[0].target,status:new Set(claims.map(e=>canonical(claim(e)))).size===1?'supported' as const:'conflicted' as const,claims,supersededEventIds:selected.filter(e=>factKey(e)===key&&hidden.has(e.eventId)).map(e=>e.eventId)})).sort((a,b)=>a.key.localeCompare(b.key));
}
export interface ChecklistRequirement {taskId:string; studentId:string; target:EntityRef; stage:Stage; labelRaw:string; due:Due;}
/** The UI and MCP should consume this exact server projection; neither infers stage completion. */
export function projectChecklist(requirements:readonly ChecklistRequirement[],facts:readonly EffectiveFact[],allowedStudentIds:readonly string[]){
 return requirements.filter(r=>allowedStudentIds.includes(r.studentId)).map(r=>{validateDue(r.due);if(r.target.studentId!==null&&r.target.studentId!==r.studentId)throw Error('checklist_target_student_mismatch');const f=facts.find(f=>f.studentId===r.studentId&&f.target.id===r.target.id&&f.target.namespace===r.target.namespace&&f.target.kind===r.target.kind&&f.claims[0]?.kind==='stage_assertion'&&f.claims[0].stage===r.stage);const first=f?.claims[0];const state=f?.status==='conflicted'?'conflicted':first?.kind==='stage_assertion'?first.state:'unknown';return {...r,state,checked:state==='complete',evidenceEventIds:f?.claims.map(e=>e.eventId)??[],completionTime:first?.kind==='stage_assertion'&&state==='complete'?first.clocks.occurredAt:null,authorityGranted:false as const};});
}
export type Action = 'read'|'derive_preview'|'persist_internal_evidence'|'lms_write'|'generate_paper'|'physical_print'|'send_handoff'|'send_parent_message';
export interface ExecutionPermit {action:Action; studentId:string; targetIds:readonly string[]; approvalRef:string; expiresAt:string|null; revoked:boolean;}
/** A fact, completed checkbox, planned owner or teacher-review outcome never grants authority. */
export function canExecute(action:Action,studentId:string,targetId:string,permits:readonly ExecutionPermit[],now:string):boolean {return permits.some(p=>p.action===action&&p.studentId===studentId&&p.targetIds.includes(targetId)&&!!p.approvalRef&&!p.revoked&&(p.expiresAt===null||Date.parse(p.expiresAt)>Date.parse(now)));}
/** Due updates are their own facts. They do not replace assignment scope or completion. */
export function projectAssignments(facts:readonly EffectiveFact[]){
 return facts.filter(f=>f.claims[0]?.kind==='assignment_assertion').map(f=>{
  const a=f.claims[0] as Extract<Event,{kind:'assignment_assertion'}>;
  const sameTarget=(x:EffectiveFact)=>x.studentId===a.studentId&&x.target.id===a.target.id&&x.target.namespace===a.target.namespace&&x.target.kind===a.target.kind;
  const d=facts.find(x=>sameTarget(x)&&x.claims[0]?.kind==='due_assertion'),dueClaim=d?.claims[0];
  const identity=facts.find(x=>sameTarget(x)&&x.claims[0]?.kind==='assignment_identity_correction'),correction=identity?.claims[0];
  const confirmed=identity?.status==='supported'&&correction?.kind==='assignment_identity_correction'?correction:null;
  const scope=identity?.status==='conflicted'?{...a.scope,rawDescription:'교재 귀속 근거 상충',bookEdition:null,units:[],items:[],identityState:'conflicted' as const}:confirmed?{...a.scope,rawDescription:confirmed.scopeDescriptionRaw,bookEdition:null,units:[],items:[],identityState:'user_reported' as const}:a.scope;
  return {studentId:a.studentId,assignmentId:a.target.id,assignmentStatus:f.status==='conflicted'?'conflicted':a.status,scope,effectiveDue:d?.status==='conflicted'?null:dueClaim?.kind==='due_assertion'?dueClaim.due:a.due,dueState:d?.status??f.status,evidenceEventIds:[...f.claims.map(e=>e.eventId),...(d?.claims.map(e=>e.eventId)??[]),...(identity?.claims.map(e=>e.eventId)??[])],identityCorrection:identity?{state:identity.status,evidenceEventIds:identity.claims.map(e=>e.eventId),displayLabelRaw:identity.status==='conflicted'?'교재 귀속 확인 필요':confirmed!.displayLabelRaw,bookLabelRaw:confirmed?.bookLabelRaw??null,structurePartsRaw:confirmed?.structurePartsRaw??[],nativeBookCode:null,editionRevision:null,volumeRaw:null,tocMapping:'unverified' as const,referenceSample:confirmed?.referenceSample??null,affectsDueDate:false,affectsCompletion:false}:null,studentCompletion:'unknown' as const,lmsEntry:'unknown' as const,parentMessageSent:'unknown' as const};
 });
}
