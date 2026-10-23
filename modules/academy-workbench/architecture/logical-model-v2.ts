/** Business logical model and pure validators. Not an observed LMS database schema or an executor. */
import { createHash } from 'node:crypto';

export type EvidenceConfidence = 'observed' | 'inferred' | 'unverified';
export type SourceVersion = {kind:'sha256';value:string}|{kind:'declared_version';value:string}|{kind:'unknown'};
export type SourceKind = 'static_javascript'|'runtime_dom'|'runtime_response'|'teacher_observation'|'existing_print_artifact'|'design';
export type Evidence = {
  id:string; sourceKind:SourceKind; evidenceConfidence:EvidenceConfidence;
  sourceVersion:SourceVersion; observedAt:string; occurredAt:string|null;
  scopeDigest:string; claim:string;
};
export type Effect = 'read'|'write'|'notify'|'generate'|'print';
export type EffectAssertion = {effect:Effect;evidence:Evidence};
export type Known<T>={state:'known';value:T;evidenceIds:string[]}|{state:'unknown';reason:string};
export type SourceKey={namespace:string;value:string};
export type ActorRole='pilot_instructor'|'instructor'|'operations_staff'|'student'|'parent';

function fail(code:string):never {throw new Error(code);}
function text(x:unknown,code='nonempty_text_required'):asserts x is string {if(typeof x!=='string'||!x.trim())fail(code);}
export function instant(x:string):void {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)||!Number.isFinite(Date.parse(x)))fail('invalid_instant');
  const date=x.slice(0,10);if(new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)fail('invalid_instant');
}
export function digest(value:unknown):string {
  const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function validateEvidence(e:Evidence):void {
  text(e.id);text(e.scopeDigest);text(e.claim);instant(e.observedAt);if(e.occurredAt!==null)instant(e.occurredAt);
  if(!['observed','inferred','unverified'].includes(e.evidenceConfidence))fail('invalid_confidence');
  if(!['static_javascript','runtime_dom','runtime_response','teacher_observation','existing_print_artifact','design'].includes(e.sourceKind))fail('invalid_source_kind');
  if(e.sourceVersion.kind==='sha256'&&!/^[a-f0-9]{64}$/.test(e.sourceVersion.value))fail('invalid_source_digest');
  if(e.sourceVersion.kind==='declared_version')text(e.sourceVersion.value);
  if(!['sha256','declared_version','unknown'].includes(e.sourceVersion.kind))fail('invalid_source_version');
  if(e.evidenceConfidence==='observed'&&e.sourceKind==='design')fail('design_is_not_observation');
}
function unique(values:string[],code:string):void {if(new Set(values).size!==values.length)fail(code);}

export type EntityKind='actor'|'student'|'enrollment'|'lesson'|'book_edition'|'book_section'|'content_item'|'assignment'|'original_test'|'testing'|'judgment_revision'|'clinic_plan'|'generated_paper'|'print_snapshot'|'distribution'|'work_attempt'|'teacher_review'|'dayrecord'|'parent_projection';
export type EntityNode={id:string;kind:EntityKind;version:string;evidence:Evidence[]};
export type RelationKind='has_enrollment'|'attends'|'uses_edition'|'has_section'|'section_contains'|'assigned_to'|'contains_item'|'has_testing'|'for_original_test'|'has_judgment'|'based_on'|'generated_as'|'snapshotted_as'|'distributed_to'|'has_attempt'|'reviewed_by'|'reviews'|'projects_to';
export type EntityEdge={id:string;from:string;to:string;relation:RelationKind;evidenceConfidence:EvidenceConfidence;evidence:Evidence[]};
const relationTypes:Record<RelationKind,Array<[EntityKind,EntityKind]>>={
  has_enrollment:[['student','enrollment']],attends:[['student','lesson']],uses_edition:[['enrollment','book_edition']],
  has_section:[['book_edition','book_section']],section_contains:[['book_section','book_section'],['book_section','content_item']],
  assigned_to:[['assignment','student']],contains_item:[['original_test','content_item'],['print_snapshot','content_item']],
  has_testing:[['student','testing']],for_original_test:[['testing','original_test']],has_judgment:[['testing','judgment_revision']],
  based_on:[['clinic_plan','judgment_revision'],['teacher_review','work_attempt']],generated_as:[['clinic_plan','generated_paper']],
  snapshotted_as:[['generated_paper','print_snapshot']],distributed_to:[['distribution','student']],has_attempt:[['student','work_attempt']],
  reviewed_by:[['work_attempt','teacher_review']],reviews:[['teacher_review','work_attempt']],projects_to:[['lesson','parent_projection'],['parent_projection','dayrecord']],
};
/** Entity relations may contain valid cycles. Only endpoint kinds and references are constrained. */
export function validateEntityGraph(nodes:EntityNode[],edges:EntityEdge[]):void {
  unique(nodes.map(x=>x.id),'duplicate_entity');unique(edges.map(x=>x.id),'duplicate_entity_edge');
  const byId=new Map(nodes.map(x=>[x.id,x]));
  for(const n of nodes){text(n.id);text(n.version);n.evidence.forEach(validateEvidence);}
  for(const e of edges){const a=byId.get(e.from),b=byId.get(e.to);if(!a||!b)fail('missing_entity');
    if(!relationTypes[e.relation]?.some(([x,y])=>x===a.kind&&y===b.kind))fail('invalid_relation_type');
    if(!['observed','inferred','unverified'].includes(e.evidenceConfidence))fail('invalid_confidence');e.evidence.forEach(validateEvidence);
    if(e.evidenceConfidence==='observed'&&!e.evidence.some(x=>x.evidenceConfidence==='observed'))fail('observed_edge_needs_evidence');
  }
}

export type ExactBookSection={
  id:string;editionId:string;sourceKey:SourceKey;parent:Known<string|null>;
  /** Edition-local structural level. Not a universal curriculum ontology level. */
  hierarchyRole:string;sourceSiblingOrdinal:number;
  sourceLabelExact:string;displayLabel:string;searchAliases:string[];
  sourceVersion:SourceVersion;evidence:Evidence[];
};
export type BookHierarchyProfile={
  id:string;editionId:string;sourceVersion:SourceVersion;
  levels:Record<string,{sourceLevelLabelExact:string|null;allowedParentRoles:string[];canBeRoot:boolean}>;
  missingLevelPolicy:'preserve_absent_no_synthetic_nodes';evidence:Evidence[];
};
/** Section text is source-preserving: aliases help search but never replace the printed/source label. */
export function validateBookHierarchy(sections:ExactBookSection[],profiles:BookHierarchyProfile[]):void {
  unique(sections.map(x=>x.id),'duplicate_section');const byId=new Map(sections.map(x=>[x.id,x]));
  unique(profiles.map(x=>x.editionId),'duplicate_edition_profile');const byEdition=new Map(profiles.map(x=>[x.editionId,x]));
  for(const p of profiles){text(p.id);if(p.missingLevelPolicy!=='preserve_absent_no_synthetic_nodes')fail('synthetic_hierarchy_forbidden');p.evidence.forEach(validateEvidence);}
  for(const s of sections){text(s.id);text(s.editionId);text(s.sourceKey.namespace);text(s.sourceKey.value);text(s.sourceLabelExact);
    if(s.displayLabel!==s.sourceLabelExact)fail('section_name_changed');s.evidence.forEach(validateEvidence);
    const profile=byEdition.get(s.editionId);if(!profile)fail('edition_hierarchy_profile_required');const level=profile.levels[s.hierarchyRole];if(!level)fail('unknown_edition_level');
    if(!Number.isInteger(s.sourceSiblingOrdinal)||s.sourceSiblingOrdinal<1)fail('invalid_section_ordinal');
    if(s.parent.state==='known'&&s.parent.value!==null){const p=byId.get(s.parent.value);if(!p)fail('unknown_section_parent');if(p.editionId!==s.editionId)fail('cross_edition_parent');
      if(!level.allowedParentRoles.includes(p.hierarchyRole))fail('invalid_edition_level_parent');}
    if(s.parent.state==='known'&&s.parent.value===null&&!level.canBeRoot)fail('nonroot_section_without_parent');
    if(s.parent.state==='unknown')text(s.parent.reason);
  }
  unique(sections.filter(s=>s.parent.state==='known').map(s=>`${s.editionId}/${s.parent.state==='known'?s.parent.value:null}/${s.sourceSiblingOrdinal}`),'duplicate_source_sibling_ordinal');
  for(const s of sections){const seen=new Set<string>();let node:ExactBookSection|undefined=s;while(node){if(seen.has(node.id))fail('section_hierarchy_cycle');seen.add(node.id);node=node.parent.state==='known'&&node.parent.value!==null?byId.get(node.parent.value):undefined;}}
}
export type TopologyLocation=Known<string>|{state:'not_present_in_source';profileId:string;evidenceIds:string[]};
export type CanonicalBookPath={
  studentId:string;bookAssignmentId:string;editionId:string;
  /** Optional teaching-view projection only; physicalSectionPathIds preserves the true source path. */
  majorUnitId:TopologyLocation;middleUnitId:TopologyLocation;minorUnitId:TopologyLocation;
  hierarchyProfileId:string;physicalSectionPathIds:string[];
  pageId:Known<string>;printedPageLabel:Known<string>;pdfPageIndex:Known<number>;
  itemId:string;printedItemLabelExact:string;activitySectionId:Known<string>;
  evidence:Evidence[];
};
export type ConceptOntologyLink={
  bookSectionId:string;conceptId:string;relation:'covers'|'example_of'|'requires';
  evidenceConfidence:EvidenceConfidence;evidence:Evidence[];
  // No automatic equality between a concept hierarchy edge and physical table-of-contents parentage.
};
export type LearningContextRecord=
  | {kind:'official_observation';purpose:'prior_lesson_or_makeup_continuity';occurrenceId:Known<string>;path:CanonicalBookPath;evidence:Evidence[]}
  | {kind:'teacher_plan';purpose:'today_or_future_plan';intendedOccurrenceId:Known<string>;path:CanonicalBookPath;authorId:string;revision:string;evidence:Evidence[]};
export function mayProjectAsActualLearning(record:LearningContextRecord):boolean {
  return record.kind==='official_observation'&&record.occurrenceId.state==='known'&&record.evidence.some(e=>e.evidenceConfidence==='observed'&&['runtime_dom','runtime_response','teacher_observation'].includes(e.sourceKind));
}

export type TaskInstance={
  id:string;logicalStep:string;studentId:string;workId:string;attemptVersion:number;
  inputRevision:string;dependsOn:string[];effects:Effect[];
  state:'planned'|'blocked'|'evidence_ready';
};
/** A DAG of concrete versioned task instances; the business state machine is not forced to be a DAG. */
export function topologicalTaskOrder(tasks:TaskInstance[]):string[] {
  unique(tasks.map(x=>x.id),'duplicate_task_instance');
  const byId=new Map(tasks.map(x=>[x.id,x]));const visited=new Set<string>(),active=new Set<string>(),order:string[]=[];
  const visit=(id:string)=>{if(active.has(id))fail('task_dependency_cycle');if(visited.has(id))return;
    const task=byId.get(id);if(!task)fail('missing_task_dependency');text(task!.studentId);text(task!.workId);text(task!.inputRevision);
    if(!Number.isInteger(task!.attemptVersion)||task!.attemptVersion<0)fail('invalid_task_attempt');unique(task!.dependsOn,'duplicate_dependency');
    active.add(id);for(const depId of task!.dependsOn){const dep=byId.get(depId);if(!dep)fail('missing_task_dependency');
      if(dep!.studentId!==task!.studentId||dep!.workId!==task!.workId)fail('foreign_task_dependency');
      if(dep!.attemptVersion>task!.attemptVersion)fail('future_attempt_dependency');visit(depId);}
    active.delete(id);visited.add(id);order.push(id);
  };for(const task of tasks)visit(task.id);return order;
}

export type OrderedMember={ordinal:number;sourceItemKey:SourceKey|null;labelExact:string;printedPageLabel:string|null;sectionId:string|null};
export type Coverage={state:'complete'|'partial'|'unknown';expectedCount:number|null};
export type OriginalTest={id:string;sourcePaper:SourceKey;membershipVersion:string;members:OrderedMember[];coverage:Coverage;evidence:Evidence[]};
export type TestingKey={studentId:string;originalTestId:string;testing:SourceKey};
export type Judgment={ordinal:number;state:'correct'|'incorrect'|'ungraded'|'unknown';rawEnum:string|null};
export type TestingSnapshot={key:TestingKey;membershipVersion:string;judgmentRevision:string;judgments:Judgment[];coverage:Coverage;evidence:Evidence[]};
export type AssessmentJoinProof={identity:TestingKey;membershipVersion:string;judgmentRevision:string;basis:'verified_item_keys'|'same_assessment_ordinals';evidence:Evidence};
function validateOrdinals(items:Array<{ordinal:number}>,coverage:Coverage):void {
  if(items.some(x=>!Number.isInteger(x.ordinal)||x.ordinal<1))fail('invalid_ordinal');unique(items.map(x=>String(x.ordinal)),'duplicate_ordinal');
  if(coverage.expectedCount!==null&&(!Number.isInteger(coverage.expectedCount)||coverage.expectedCount<0))fail('invalid_expected_count');
  if(coverage.state==='complete'){
    if(coverage.expectedCount===null||coverage.expectedCount!==items.length)fail('unproven_complete_membership');
    if(items.some((x,i)=>x.ordinal!==i+1))fail('member_order_not_exact');
  }
}
export function validateOriginalTest(test:OriginalTest):void {
  text(test.id);text(test.membershipVersion);text(test.sourcePaper.namespace);text(test.sourcePaper.value);
  validateOrdinals(test.members,test.coverage);for(const m of test.members)text(m.labelExact,'missing_item_label');test.evidence.forEach(validateEvidence);
}
export function currentWrongSubset(original:OriginalTest,testing:TestingSnapshot,expected:TestingKey,proof:AssessmentJoinProof):{ordinals:number[];labels:string[];unknownOrdinals:number[];membershipVersion:string;judgmentRevision:string} {
  validateOriginalTest(original);if(digest(expected)!==digest(testing.key))fail('testing_identity_mismatch');
  if(original.id!==testing.key.originalTestId)fail('original_test_mismatch');if(original.membershipVersion!==testing.membershipVersion)fail('membership_version_mismatch');
  validateEvidence(proof.evidence);
  if(digest(proof.identity)!==digest(expected)||proof.membershipVersion!==original.membershipVersion||proof.judgmentRevision!==testing.judgmentRevision)fail('join_proof_version_mismatch');
  if(proof.evidence.evidenceConfidence!=='observed'||!['runtime_dom','runtime_response'].includes(proof.evidence.sourceKind)||proof.evidence.scopeDigest!==digest({identity:expected,membershipVersion:original.membershipVersion,judgmentRevision:testing.judgmentRevision}))fail('join_not_observed_for_exact_scope');
  if(original.coverage.state!=='complete'||testing.coverage.state!=='complete')fail('incomplete_join');
  text(testing.judgmentRevision);testing.evidence.forEach(validateEvidence);
  const judgments=[...testing.judgments].sort((a,b)=>a.ordinal-b.ordinal);validateOrdinals(judgments,testing.coverage);
  if(judgments.length!==original.members.length)fail('judgment_count_mismatch');
  if(judgments.some(x=>!['correct','incorrect','ungraded','unknown'].includes(x.state)))fail('invalid_judgment_state');
  const wrong=original.members.filter((m,i)=>judgments[i]!.state==='incorrect');
  return {ordinals:wrong.map(x=>x.ordinal),labels:wrong.map(x=>x.labelExact),unknownOrdinals:judgments.filter(x=>x.state==='unknown'||x.state==='ungraded').map(x=>x.ordinal),membershipVersion:original.membershipVersion,judgmentRevision:testing.judgmentRevision};
}
export type PrintedMember={printedOrdinal:number;printedLabelExact:string;sourceItemKey:SourceKey|null;originalOrdinal:number|null};
export type ImmutablePrintSnapshot={
  id:string;studentId:string;artifactDigest:string;generatedPaperVersion:string;
  originalTestId:Known<string>;testingKey:Known<TestingKey>;
  printedHeaderExact:string;orderedMembers:PrintedMember[];orderDigest:string;
  capturedAt:string;sourceVersion:SourceVersion;evidence:Evidence[];
  physicalPrintConfirmation:Known<{actorId:string;confirmedAt:string}>;
};
export function validatePrintSnapshot(s:ImmutablePrintSnapshot):void {
  text(s.id);text(s.studentId);text(s.generatedPaperVersion);text(s.printedHeaderExact);instant(s.capturedAt);
  if(!/^[a-f0-9]{64}$/.test(s.artifactDigest))fail('invalid_print_artifact_digest');
  if(s.orderedMembers.length===0)fail('empty_print_membership');
  if(s.orderedMembers.some((x,i)=>x.printedOrdinal!==i+1))fail('printed_order_not_exact');
  s.orderedMembers.forEach(x=>text(x.printedLabelExact));
  if(digest(s.orderedMembers)!==s.orderDigest)fail('print_order_digest_mismatch');
  if(s.testingKey.state==='known'&&s.testingKey.value.studentId!==s.studentId)fail('print_student_mismatch');
  if(s.originalTestId.state==='known'&&s.testingKey.state==='known'&&s.originalTestId.value!==s.testingKey.value.originalTestId)fail('print_original_mismatch');
  if(!s.evidence.some(e=>e.sourceKind==='existing_print_artifact'&&e.evidenceConfidence==='observed'))fail('historical_print_artifact_unproven');
  s.evidence.forEach(validateEvidence);
}
export function appendPrintSnapshot(existing:ImmutablePrintSnapshot[],next:ImmutablePrintSnapshot):ImmutablePrintSnapshot[] {
  existing.forEach(validatePrintSnapshot);validatePrintSnapshot(next);const old=existing.find(x=>x.id===next.id);
  if(old&&digest(old)!==digest(next))fail('immutable_print_replacement');return old?structuredClone(existing):structuredClone([...existing,next]);
}

export type WorkState='assigned'|'working'|'submitted'|'correction_required'|'awaiting_teacher'|'verified';
export type WorkEventKind='assignment_recorded'|'work_started'|'work_submitted'|'judgment_recorded'|'judgment_revised'|'teacher_confirmed'|'teacher_requests_retry';
export type WorkEvent={
  eventId:string;workId:string;studentId:string;sequence:number;previousEventId:string|null;
  kind:WorkEventKind;attemptVersion:number;judgmentVersion:number;
  outcome:'correct'|'incorrect'|'unknown'|null;actorId:string;actorRole:ActorRole;
  observedAt:string;occurredAt:string|null;reason:string|null;evidence:Evidence[];
};
export type WorkProjection={state:WorkState;attemptVersion:number;judgmentVersion:number;lastTeacherConfirmation:string|null;confirmationCurrent:boolean;historicalJudgmentEvents:string[]};
/** Repeating correction is legal. Each new attempt/event is versioned; old review events are retained. */
export function projectWorkHistory(events:WorkEvent[]):WorkProjection {
  if(events.length===0)fail('empty_work_history');unique(events.map(e=>e.eventId),'duplicate_work_event');
  let p:WorkProjection={state:'assigned',attemptVersion:0,judgmentVersion:0,lastTeacherConfirmation:null,confirmationCurrent:false,historicalJudgmentEvents:[]};
  let previous:WorkEvent|undefined;const grades=new Map<number,number>();
  for(const e of events){text(e.eventId);text(e.actorId);text(e.workId);text(e.studentId);instant(e.observedAt);if(e.occurredAt!==null)instant(e.occurredAt);e.evidence.forEach(validateEvidence);
    if(e.sequence!==(previous?.sequence??0)+1||e.previousEventId!==(previous?.eventId??null))fail('broken_event_sequence');
    if(previous&&(e.workId!==previous.workId||e.studentId!==previous.studentId))fail('event_partition_changed');
    if(previous&&Date.parse(e.observedAt)<Date.parse(previous.observedAt))fail('observation_time_regressed');
    if(!Number.isInteger(e.attemptVersion)||e.attemptVersion<0||!Number.isInteger(e.judgmentVersion)||e.judgmentVersion<0)fail('invalid_event_version');
    if(e.kind==='assignment_recorded'){if(previous||e.attemptVersion!==0||e.judgmentVersion!==0)fail('invalid_assignment_event');}
    else if(!previous)fail('assignment_event_required');
    else if(e.kind==='work_started'){
      if(!['assigned','correction_required'].includes(p.state)||e.attemptVersion!==p.attemptVersion+1||e.judgmentVersion!==0)fail('invalid_attempt_start');
      p={...p,state:'working',attemptVersion:e.attemptVersion,judgmentVersion:0,confirmationCurrent:false};
    } else if(e.kind==='work_submitted'){
      if(p.state!=='working'||e.attemptVersion!==p.attemptVersion||e.judgmentVersion!==p.judgmentVersion)fail('invalid_submission_event');p.state='submitted';
    } else if(e.kind==='judgment_recorded'||e.kind==='judgment_revised'){
      if(e.attemptVersion<1||e.attemptVersion>p.attemptVersion)fail('unknown_graded_attempt');
      if(e.judgmentVersion!==(grades.get(e.attemptVersion)??0)+1)fail('judgment_revision_gap');
      if(e.kind==='judgment_recorded'&&(p.state!=='submitted'||e.attemptVersion!==p.attemptVersion||(grades.get(e.attemptVersion)??0)!==0))fail('invalid_initial_grade');
      if(e.kind==='judgment_revised'&&!grades.has(e.attemptVersion))fail('grade_revision_without_original');
      if(!['correct','incorrect','unknown'].includes(String(e.outcome)))fail('invalid_grade_outcome');
      grades.set(e.attemptVersion,e.judgmentVersion);
      if(e.attemptVersion<p.attemptVersion)p.historicalJudgmentEvents.push(e.eventId);
      else p={...p,state:e.outcome==='incorrect'?'correction_required':e.outcome==='correct'?'awaiting_teacher':'submitted',judgmentVersion:e.judgmentVersion,confirmationCurrent:false};
    } else if(e.kind==='teacher_confirmed'||e.kind==='teacher_requests_retry'){
      if(!['pilot_instructor','instructor'].includes(e.actorRole))fail('teacher_authority_required');
      if(e.attemptVersion!==p.attemptVersion||e.judgmentVersion!==p.judgmentVersion)fail('stale_teacher_review');
      if(e.kind==='teacher_confirmed'){if(p.state!=='awaiting_teacher')fail('teacher_confirmation_not_ready');p={...p,state:'verified',lastTeacherConfirmation:e.eventId,confirmationCurrent:true};}
      else {if(!['awaiting_teacher','verified'].includes(p.state))fail('retry_not_ready');text(e.reason,'retry_reason_required');p={...p,state:'correction_required',confirmationCurrent:false};}
    } else fail('unknown_work_event');
    previous=e;
  }return structuredClone(p);
}

export type ActorPermission={
  actorId:string;role:ActorRole;academyId:string;studentIds:string[];effects:Effect[];
  authorizationProofRef:string;validFrom:string;validThrough:string;
};
export type OperationSpec={
  id:string;sourceVersion:SourceVersion;effects:EffectAssertion[];
  effectClosure:'complete'|'partial'|'unknown';teacherScopeObserved:boolean;
  compoundSteps:string[];
};
export function assessReadOnlyDesignAdmission(operation:OperationSpec,permission:ActorPermission,target:{actorId:string;academyId:string;studentIds:string[]},now:string):{eligible:boolean;reason:string;execution:'not_implemented'} {
  const deny=(reason:string)=>({eligible:false,reason,execution:'not_implemented' as const});instant(now);instant(permission.validFrom);instant(permission.validThrough);
  if(permission.actorId!==target.actorId||permission.academyId!==target.academyId)return deny('actor_scope_mismatch');
  if(permission.role!=='pilot_instructor')return deny('outside_one_instructor_pilot');
  if(!permission.authorizationProofRef.trim())return deny('authorization_proof_missing');
  if(Date.parse(now)<Date.parse(permission.validFrom)||Date.parse(now)>Date.parse(permission.validThrough))return deny('permission_not_current');
  if(target.studentIds.some(id=>!permission.studentIds.includes(id)))return deny('student_scope_expansion');
  if(operation.effectClosure!=='complete')return deny('effect_closure_unverified');
  if(!operation.teacherScopeObserved)return deny('teacher_scope_unverified');
  if(operation.effects.length===0||operation.effects.some(x=>x.effect!=='read')||!permission.effects.includes('read'))return deny('not_read_only');
  const expectedScope=digest({operationId:operation.id,actorId:target.actorId,academyId:target.academyId,studentIds:[...target.studentIds].sort()});
  for(const x of operation.effects){validateEvidence(x.evidence);if(x.evidence.evidenceConfidence!=='observed'||!['runtime_dom','runtime_response'].includes(x.evidence.sourceKind))return deny('runtime_read_effect_unverified');if(x.evidence.scopeDigest!==expectedScope)return deny('operation_evidence_scope_mismatch');}
  return {eligible:true,reason:'structurally_ready_for_trusted_adapter_review_only',execution:'not_implemented'};
}

export type UserContextAssertion={
  id:string;key:string;kind:'goal'|'workflow_rule'|'correction'|'preference'|'constraint';
  value:unknown;appliesTo:string[];evidenceConfidence:EvidenceConfidence;
  provenance:{source:'direct_user_message'|'user_document'|'interpretation';intentAttribution:'direct_user'|'user_confirmed_document'|'unverified';reference:string;authoredAt:string|null;authoredOn:string|null;observedAt:string;sourceVersion:SourceVersion};
  supersedes:string[];status:'active'|'superseded'|'uncertain';
  // This model cannot save or restore custom rules, assistant internals, or authority grants.
  authority:'business_context_only_not_execution_permission';
};
export function resolveUserContext(assertions:UserContextAssertion[],scope:string):{active:UserContextAssertion[];conflicts:string[];unverified:UserContextAssertion[]} {
  unique(assertions.map(x=>x.id),'duplicate_context');const byId=new Map(assertions.map(x=>[x.id,x]));
  const shadowed=new Set<string>();
  for(const x of assertions){text(x.id);text(x.key);text(x.provenance.reference);if(x.provenance.authoredAt!==null)instant(x.provenance.authoredAt);if(x.provenance.authoredOn!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(x.provenance.authoredOn))fail('invalid_context_date');instant(x.provenance.observedAt);
    if(x.authority!=='business_context_only_not_execution_permission')fail('context_is_not_permission');
    for(const id of x.supersedes){const old=byId.get(id);if(!old)fail('unknown_superseded_context');if(old.key!==x.key)fail('supersedes_unrelated_context');const nextDate=x.provenance.authoredAt?.slice(0,10)??x.provenance.authoredOn;const oldDate=old.provenance.authoredAt?.slice(0,10)??old.provenance.authoredOn;if(nextDate&&oldDate&&nextDate<oldDate)fail('supersedes_newer_context');}
  }
  const visiting=new Set<string>(),visited=new Set<string>();const visit=(id:string)=>{if(visiting.has(id))fail('context_supersession_cycle');if(visited.has(id))return;visiting.add(id);for(const old of byId.get(id)!.supersedes)visit(old);visiting.delete(id);visited.add(id);};assertions.forEach(x=>visit(x.id));
  // Uncertain/inferred interpretation may not silently override a direct-user assertion.
  const confirmed=(x:UserContextAssertion)=>x.evidenceConfidence==='observed'&&((x.provenance.source==='direct_user_message'&&x.provenance.intentAttribution==='direct_user')||(x.provenance.source==='user_document'&&x.provenance.intentAttribution==='user_confirmed_document'));
  for(const x of assertions.filter(x=>x.status==='active'&&confirmed(x))){
    const hide=(id:string)=>{shadowed.add(id);byId.get(id)!.supersedes.forEach(hide);};x.supersedes.forEach(hide);
  }
  const applicable=assertions.filter(x=>x.appliesTo.includes(scope)&&x.status!=='superseded'&&!shadowed.has(x.id));
  const active=applicable.filter(x=>x.status==='active'&&confirmed(x));
  const conflicts=[...new Set(active.map(x=>x.key))].filter(key=>new Set(active.filter(x=>x.key===key).map(x=>digest(x.value))).size>1);
  return {active:structuredClone(active.filter(x=>!conflicts.includes(x.key))),conflicts,unverified:structuredClone(applicable.filter(x=>!active.includes(x)))};
}
export function clinicPolicy(input:{assessmentScopeConfirmed:boolean;coverage:'complete'|'partial'|'unknown';score:number|null;maximum:number|null;wrongCount:number|null;teacherConfirmed:boolean}):{clinic:'not_required_default'|'required'|'unknown';rework:'not_applicable'|'pending_judgment';review:'verified'|'pending'} {
  const base={clinic:'unknown' as const,rework:'pending_judgment' as const,review:'pending' as const};
  if(!input.assessmentScopeConfirmed||input.coverage!=='complete'||input.wrongCount===null)return base;
  if(input.wrongCount<0||!Number.isInteger(input.wrongCount))fail('invalid_wrong_count');
  if(input.score!==null&&input.maximum!==null&&input.maximum>0&&input.score===input.maximum&&input.wrongCount>0)fail('perfect_score_wrong_count_conflict');
  const perfect=input.score!==null&&input.maximum!==null&&input.maximum>0&&input.score===input.maximum;
  return {clinic:input.wrongCount>0?'required':perfect?'not_required_default':'unknown',rework:input.wrongCount===0&&input.teacherConfirmed?'not_applicable':'pending_judgment',review:input.wrongCount===0&&input.teacherConfirmed?'verified':'pending'};
}
export type DecisionContextQuery={
  scope:string;purposeKeys:string[];decisionKeys:string[];
  questionCandidates:Array<{key:string;question:string;decisionState:'confirmed_unanswered'|'source_read_failed'|'not_checked'}>;
  contextRead:{status:'complete'|'partial'|'failed';unavailableKeys:string[]};
  prerequisites:Array<{id:string;state:'met'|'unmet'|'unknown';evidenceIds:string[]}>;
  evidence:Evidence[];operation:OperationSpec;permission:ActorPermission;
  target:{actorId:string;academyId:string;studentIds:string[]};now:string;
};
/** Mandatory pre-action context projection. Pure advice; no permission can be created by a context fact. */
export function prepareDecisionContext(context:UserContextAssertion[],q:DecisionContextQuery){
  const resolved=resolveUserContext(context,q.scope);q.evidence.forEach(validateEvidence);
  const admission=assessReadOnlyDesignAdmission(q.operation,q.permission,q.target,q.now);
  const byKey=new Map(resolved.active.map(x=>[x.key,x]));
  const missingKeys=[...new Set([...q.purposeKeys,...q.decisionKeys])].filter(key=>!byKey.has(key));
  const pendingPrerequisites=q.prerequisites.filter(x=>x.state!=='met'||x.evidenceIds.length===0);
  const questions=q.questionCandidates.filter(x=>x.decisionState==='confirmed_unanswered'&&!byKey.has(x.key)&&!q.contextRead.unavailableKeys.includes(x.key)&&q.contextRead.status!=='failed');
  return {
    purpose:q.purposeKeys.flatMap(k=>byKey.has(k)?[byKey.get(k)!]:[]),
    effectiveDecisions:q.decisionKeys.flatMap(k=>byKey.has(k)?[byKey.get(k)!]:[]),
    evidence:structuredClone(q.evidence),pendingPrerequisites,conflicts:resolved.conflicts,missingKeys,contextRead:structuredClone(q.contextRead),
    alreadyAnsweredKeys:[...byKey.keys()],questions,
    allowedEffects:admission.eligible?['read' as const]:[],effectAdmission:admission,
    disposition:q.contextRead.status==='failed'||missingKeys.some(k=>q.contextRead.unavailableKeys.includes(k))?'blocked_context_retrieval':!admission.eligible||pendingPrerequisites.length?'blocked_external_action':missingKeys.length||resolved.conflicts.length?'needs_context_resolution':'ready_for_trusted_adapter_review',
    execution:'not_implemented' as const,
  };
}
