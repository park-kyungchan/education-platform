import {assertExactKeys, assertInstant, assertKnowledge, assertRefs, canonicalJson, digest, immutableCopy, requireText, stableId, type Knowledge} from '../learning/model';
import {validateSourceKey, type SourceKey} from './domain';

export interface ConceptDefinition {
  readonly sourceKey: SourceKey; readonly label: string; readonly definition: string;
  readonly curriculumEdition: Knowledge<SourceKey>;
  readonly sourceRefs: readonly string[];
  /** A task type/capability label is not an atomic-concept identity. */
  readonly semanticReview: Knowledge<{definitionDigest: string; reviewerId: string; sourceRef: string; reviewedAt: string}>;
}
export interface ConceptRevision extends ConceptDefinition {
  readonly kind: 'atomic_concept_revision'; readonly id: string; readonly revisionId: string;
}
export interface StudentConceptEvidence {
  readonly ownerId: string; readonly studentId: string; readonly revisionId: string;
  readonly sourceKey: SourceKey;
  readonly grain: 'question_attempt' | 'activity' | 'source_observation';
  readonly bookEdition: Knowledge<SourceKey>; readonly observedAt: string; readonly sourceRefs: readonly string[];
}
export interface ConceptLinkBody {
  readonly ownerId: string; readonly studentId: string;
  readonly evidenceRevisionId: string; readonly conceptRevisionId: string;
  readonly status: 'candidate' | 'verified' | 'contradicted';
  readonly basisRefs: readonly string[];
  readonly teacherReview: Knowledge<{
    actorId: string; reportedAt: string; sourceRef: string;
    targetEvidenceRevisionId: string; targetConceptRevisionId: string;
    decision: 'supported' | 'contradicted';
  }>;
}
export interface ConceptLinkRevision extends ConceptLinkBody {
  readonly kind: 'student_concept_link_revision'; readonly id: string; readonly revisionId: string;
  readonly previousRevisionId: string|null; readonly sequence: number;
}
export interface StudentConceptGraphEdge {
  readonly id:string; readonly evidenceRevisionId:string; readonly conceptRevisionId:string;
  readonly status:ConceptLinkBody['status']; readonly currentRevisionId:string;
  readonly history:readonly ConceptLinkRevision[]; readonly teacherJudgment:ConceptLinkBody['teacherReview'];
  readonly atomicity:'reviewed_definition'|'candidate_definition';
}

function text(value: unknown, cap=1000): asserts value is string {
  if(typeof value!=='string')throw Error('invalid_concept_field');
  requireText(value,'concept field');
  if(value.length>cap||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))throw Error('invalid_concept_field');
}
function refs(value: readonly string[]) {
  assertRefs(value);if(value.length>64)throw Error('concept_reference_cap');value.forEach(ref=>text(ref));
}
function knowledge<T>(value: Knowledge<T>, check: (value:T)=>void) {
  assertKnowledge(value,check);if(value.state==='known')refs(value.evidenceRefs);else text(value.reason);
}
export function conceptDefinitionDigest(definition: Pick<ConceptDefinition,'sourceKey'|'label'|'definition'|'curriculumEdition'>) {
  return digest({sourceKey:definition.sourceKey,label:definition.label,definition:definition.definition,curriculumEdition:definition.curriculumEdition});
}
function validateDefinition(body: ConceptDefinition) {
  canonicalJson(body);assertExactKeys(body,['sourceKey','label','definition','curriculumEdition','sourceRefs','semanticReview']);
  validateSourceKey(body.sourceKey);
  if(body.sourceKey.namespace!=='academy_atomic_concept')throw Error('explicit_atomic_concept_namespace_required');
  text(body.label,300);text(body.definition,16000);refs(body.sourceRefs);knowledge(body.curriculumEdition,validateSourceKey);
  knowledge(body.semanticReview,review=>{
    assertExactKeys(review,['definitionDigest','reviewerId','sourceRef','reviewedAt']);
    text(review.reviewerId,200);text(review.sourceRef);assertInstant(review.reviewedAt);
    if(review.definitionDigest!==conceptDefinitionDigest(body)||body.curriculumEdition.state!=='known')throw Error('concept_semantic_review_scope_conflict');
  });
}
export function createConceptRevision(body: ConceptDefinition): ConceptRevision {
  validateDefinition(body);const id=stableId('atomic_concept',body.sourceKey.namespace,body.sourceKey.literalKey);
  return immutableCopy({...body,kind:'atomic_concept_revision',id,revisionId:stableId('concept_revision',id,digest(body))});
}
function validateConcept(concept: ConceptRevision) {
  canonicalJson(concept);assertExactKeys(concept,['sourceKey','label','definition','curriculumEdition','sourceRefs','semanticReview','kind','id','revisionId']);
  const {kind,id,revisionId,...body}=concept,expected=createConceptRevision(body);
  if(kind!==expected.kind||id!==expected.id||revisionId!==expected.revisionId)throw Error('concept_revision_conflict');
}
function validateEvidence(evidence: StudentConceptEvidence) {
  canonicalJson(evidence);assertExactKeys(evidence,['ownerId','studentId','revisionId','sourceKey','grain','bookEdition','observedAt','sourceRefs']);
  [evidence.ownerId,evidence.studentId,evidence.revisionId].forEach(value=>text(value,200));validateSourceKey(evidence.sourceKey);
  if(!['question_attempt','activity','source_observation'].includes(evidence.grain))throw Error('invalid_concept_evidence_grain');
  knowledge(evidence.bookEdition,validateSourceKey);assertInstant(evidence.observedAt);refs(evidence.sourceRefs);
}
function validateLinkBody(body: ConceptLinkBody) {
  canonicalJson(body);assertExactKeys(body,['ownerId','studentId','evidenceRevisionId','conceptRevisionId','status','basisRefs','teacherReview']);
  [body.ownerId,body.studentId,body.evidenceRevisionId,body.conceptRevisionId].forEach(value=>text(value,200));refs(body.basisRefs);
  if(!['candidate','verified','contradicted'].includes(body.status))throw Error('invalid_concept_link_status');
  knowledge(body.teacherReview,review=>{
    assertExactKeys(review,['actorId','reportedAt','sourceRef','targetEvidenceRevisionId','targetConceptRevisionId','decision']);
    text(review.actorId,200);text(review.sourceRef);assertInstant(review.reportedAt);
    if(review.targetEvidenceRevisionId!==body.evidenceRevisionId||review.targetConceptRevisionId!==body.conceptRevisionId||!['supported','contradicted'].includes(review.decision))throw Error('concept_teacher_review_scope_conflict');
  });
  if(body.status==='candidate'&&body.teacherReview.state!=='unknown')throw Error('candidate_link_cannot_claim_teacher_review');
  if(body.status!=='candidate'&&(body.teacherReview.state!=='known'||body.teacherReview.value.decision!==(body.status==='verified'?'supported':'contradicted')))throw Error('explicit_scoped_teacher_review_required');
}
/** Ingress must authenticate the supplied actor and transactionally pin the actual evidence. */
export function createConceptLinkRevision(body: ConceptLinkBody, previous: ConceptLinkRevision|null): ConceptLinkRevision {
  validateLinkBody(body);
  const id=stableId('concept_link',body.ownerId,body.studentId,body.evidenceRevisionId,body.conceptRevisionId);
  if(previous){validateLink(previous);if(previous.id!==id)throw Error('concept_link_identity_changed');}
  const value={...body,kind:'student_concept_link_revision' as const,id,previousRevisionId:previous?.revisionId??null,sequence:(previous?.sequence??0)+1};
  return immutableCopy({...value,revisionId:stableId('concept_link_revision',id,digest(value))});
}
function validateLink(link: ConceptLinkRevision) {
  canonicalJson(link);assertExactKeys(link,['ownerId','studentId','evidenceRevisionId','conceptRevisionId','status','basisRefs','teacherReview','kind','id','revisionId','previousRevisionId','sequence']);
  const {kind,id,revisionId,previousRevisionId,sequence,...body}=link;validateLinkBody(body);
  if(kind!=='student_concept_link_revision'||!Number.isSafeInteger(sequence)||sequence<1||(sequence===1?previousRevisionId!==null:typeof previousRevisionId!=='string'))throw Error('invalid_concept_link_chain');
  if(previousRevisionId!==null)text(previousRevisionId,200);
  if(id!==stableId('concept_link',body.ownerId,body.studentId,body.evidenceRevisionId,body.conceptRevisionId)||revisionId!==stableId('concept_link_revision',id,digest({...body,kind,id,previousRevisionId,sequence})))throw Error('concept_link_revision_conflict');
}
/** Shared concepts stay distinct from each student's attributable evidence and review history. */
export function projectStudentConceptGraph(ownerId: string, studentId: string, evidence: readonly StudentConceptEvidence[], concepts: readonly ConceptRevision[], links: readonly ConceptLinkRevision[]) {
  text(ownerId,200);text(studentId,200);
  for(const values of [evidence,concepts,links]){if(!Array.isArray(values)||values.length>2000)throw Error('concept_graph_cap');canonicalJson(values);}
  const evidenceIndex=new Map<string,StudentConceptEvidence>(),conceptIndex=new Map<string,ConceptRevision>();
  for(const row of evidence){validateEvidence(row);if(row.ownerId!==ownerId||row.studentId!==studentId)throw Error('foreign_concept_evidence');if(evidenceIndex.has(row.revisionId))throw Error('duplicate_concept_evidence_revision');evidenceIndex.set(row.revisionId,row);}
  for(const row of concepts){validateConcept(row);if(conceptIndex.has(row.revisionId))throw Error('duplicate_concept_revision');conceptIndex.set(row.revisionId,row);}
  const groups=new Map<string,ConceptLinkRevision[]>(),seen=new Set<string>();
  for(const link of links){
    validateLink(link);if(link.ownerId!==ownerId||link.studentId!==studentId)throw Error('foreign_concept_link');
    if(!evidenceIndex.has(link.evidenceRevisionId)||!conceptIndex.has(link.conceptRevisionId))throw Error('concept_graph_reference_missing');
    if(seen.has(link.revisionId))throw Error('duplicate_concept_link_revision');seen.add(link.revisionId);
    const group=groups.get(link.id)??[];group.push(link);groups.set(link.id,group);
  }
  const edges:StudentConceptGraphEdge[]=[];
  for(const history of groups.values()){
    history.sort((a,b)=>a.sequence-b.sequence);
    history.forEach((link,index)=>{if(link.sequence!==index+1||link.previousRevisionId!==(index===0?null:history[index-1]!.revisionId))throw Error('concept_graph_history_gap');});
    const current=history.at(-1)!;
    edges.push({id:current.id,evidenceRevisionId:current.evidenceRevisionId,conceptRevisionId:current.conceptRevisionId,status:current.status,currentRevisionId:current.revisionId,history,teacherJudgment:current.teacherReview,
      atomicity:conceptIndex.get(current.conceptRevisionId)!.semanticReview.state==='known'?'reviewed_definition' as const:'candidate_definition' as const});
  }
  return immutableCopy({kind:'student_concept_evidence_graph' as const,ownerId,studentId,evidence:[...evidenceIndex.values()],concepts:[...conceptIndex.values()],edges,
    unlinkedEvidenceRevisionIds:evidence.filter(row=>!edges.some(edge=>edge.evidenceRevisionId===row.revisionId)).map(row=>row.revisionId),
    knowledge:{mastery:'not_inferred' as const,causality:'not_inferred' as const,scoreToConceptPromotion:false as const,sourceAndTeacherAuthentication:'adapter_owned_not_proved_by_projection' as const},
    officialSaved:false as const,parentSent:false as const,academyWrites:0 as const});
}
