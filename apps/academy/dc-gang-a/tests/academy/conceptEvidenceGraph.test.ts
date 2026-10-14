import {expect,test} from 'bun:test';
import {known,unknown} from '../../src/learning/model';
import {conceptDefinitionDigest,createConceptRevision,createConceptLinkRevision,projectStudentConceptGraph,type ConceptDefinition,type ConceptLinkBody,type StudentConceptEvidence} from '../../src/academy/conceptEvidenceGraph';

const definition:ConceptDefinition={sourceKey:{namespace:'academy_atomic_concept',literalKey:'synthetic-distributivity'},label:'Synthetic distributivity candidate',definition:'a(b+c)=ab+ac in the supplied synthetic domain.',curriculumEdition:unknown('No real edition imported by this test'),sourceRefs:['synthetic-source'],semanticReview:unknown('Atomic definition remains a proposal')};
const concept=createConceptRevision(definition);
const evidence:StudentConceptEvidence={ownerId:'owner-a',studentId:'student-a',revisionId:'source-revision-a',sourceKey:{namespace:'synthetic_question_attempt',literalKey:'attempt-a'},grain:'question_attempt',bookEdition:unknown('Edition unresolved'),observedAt:'2026-10-14T10:00:00.000Z',sourceRefs:['synthetic-evidence']};
const body:ConceptLinkBody={ownerId:'owner-a',studentId:'student-a',evidenceRevisionId:evidence.revisionId,conceptRevisionId:concept.revisionId,status:'candidate',basisRefs:['synthetic-alignment-proposal'],teacherReview:unknown('No teacher judgment')};
const candidate=createConceptLinkRevision(body,null);
function review(decision:'supported'|'contradicted') {return known({actorId:'synthetic-teacher',reportedAt:'2026-10-14T10:05:00.000Z',sourceRef:'synthetic-teacher-report',targetEvidenceRevisionId:evidence.revisionId,targetConceptRevisionId:concept.revisionId,decision},['synthetic-teacher-report']);}

test('candidate graph retains exact source scope and cannot infer mastery or semantic acceptance',()=>{
 const graph=projectStudentConceptGraph('owner-a','student-a',[evidence],[concept],[candidate]);
 expect(graph.edges[0]!.status).toBe('candidate');expect(graph.edges[0]!.atomicity).toBe('candidate_definition');
 expect(graph.knowledge.mastery).toBe('not_inferred');expect(graph.knowledge.causality).toBe('not_inferred');expect(graph.knowledge.scoreToConceptPromotion).toBe(false);
 expect(graph.unlinkedEvidenceRevisionIds).toEqual([]);expect(graph.evidence[0]!.bookEdition.state).toBe('unknown');expect(Object.isFrozen(graph.edges[0]!.history)).toBe(true);
});
test('explicit supported and contradicted teacher revisions preserve the earlier candidate and judgment',()=>{
 const verified=createConceptLinkRevision({...body,status:'verified',teacherReview:review('supported')},candidate);
 const contradicted=createConceptLinkRevision({...body,status:'contradicted',teacherReview:review('contradicted')},verified);
 const graph=projectStudentConceptGraph('owner-a','student-a',[evidence],[concept],[contradicted,candidate,verified]);
 expect(graph.edges[0]!.status).toBe('contradicted');expect(graph.edges[0]!.history.map(row=>row.status)).toEqual(['candidate','verified','contradicted']);
 expect(graph.edges[0]!.atomicity).toBe('candidate_definition');expect(graph.knowledge.mastery).toBe('not_inferred');
 expect(graph.knowledge.sourceAndTeacherAuthentication).toBe('adapter_owned_not_proved_by_projection');
});
test('missing, mismatched or unscoped teacher review cannot verify a relationship',()=>{
 expect(()=>createConceptLinkRevision({...body,status:'verified'},candidate)).toThrow('explicit_scoped_teacher_review_required');
 expect(()=>createConceptLinkRevision({...body,status:'verified',teacherReview:review('contradicted')},candidate)).toThrow('explicit_scoped_teacher_review_required');
 expect(()=>createConceptLinkRevision({...body,teacherReview:review('supported')},candidate)).toThrow('candidate_link_cannot_claim_teacher_review');
 const supported=review('supported');if(supported.state!=='known')throw Error('synthetic_review_required');
 expect(()=>createConceptLinkRevision({...body,status:'verified',teacherReview:known({...supported.value,targetEvidenceRevisionId:'foreign-revision'},['synthetic-review'])},candidate)).toThrow('concept_teacher_review_scope_conflict');
});
test('foreign owner/student, missing revisions and incomplete chains refuse instead of dropping evidence',()=>{
 expect(()=>projectStudentConceptGraph('owner-b','student-a',[evidence],[concept],[candidate])).toThrow('foreign_concept_evidence');
 expect(()=>projectStudentConceptGraph('owner-a','student-b',[evidence],[concept],[candidate])).toThrow('foreign_concept_evidence');
 expect(()=>projectStudentConceptGraph('owner-a','student-a',[],[concept],[candidate])).toThrow('concept_graph_reference_missing');
 const verified=createConceptLinkRevision({...body,status:'verified',teacherReview:review('supported')},candidate);
 expect(()=>projectStudentConceptGraph('owner-a','student-a',[evidence],[concept],[verified])).toThrow('concept_graph_history_gap');
 expect(()=>projectStudentConceptGraph('owner-a','student-a',[evidence],[concept],[candidate,candidate])).toThrow('duplicate_concept_link_revision');
});
test('new concept definition revision never inherits a judgment for the old definition',()=>{
 const successor=createConceptRevision({...definition,definition:'A revised synthetic definition.'});
 expect(successor.id).toBe(concept.id);expect(successor.revisionId).not.toBe(concept.revisionId);
 expect(()=>createConceptLinkRevision({...body,conceptRevisionId:successor.revisionId,status:'verified',teacherReview:review('supported')},candidate)).toThrow('concept_teacher_review_scope_conflict');
 expect(()=>createConceptLinkRevision({...body,conceptRevisionId:successor.revisionId},candidate)).toThrow('concept_link_identity_changed');
 const graph=projectStudentConceptGraph('owner-a','student-a',[evidence],[concept,successor],[candidate]);expect(graph.edges[0]!.conceptRevisionId).toBe(concept.revisionId);
});
test('reviewed definition pins exact semantics and curriculum while task/capability identities stay separate',()=>{
 const declared={...definition,curriculumEdition:known({namespace:'synthetic_curriculum_edition',literalKey:'edition-a'},['synthetic-curriculum'])};
 const reviewed=createConceptRevision({...declared,semanticReview:known({definitionDigest:conceptDefinitionDigest(declared),reviewerId:'synthetic-domain-reviewer',sourceRef:'synthetic-domain-review',reviewedAt:'2026-10-14T10:00:00.000Z'},['synthetic-domain-review'])});
 expect(reviewed.semanticReview.state).toBe('known');
 expect(()=>createConceptRevision({...definition,sourceKey:{namespace:'research_task_type',literalKey:'HM11-d1-T01'}})).toThrow('explicit_atomic_concept_namespace_required');
 expect(()=>createConceptRevision({...definition,semanticReview:reviewed.semanticReview})).toThrow('concept_semantic_review_scope_conflict');
 expect(()=>createConceptRevision({...declared,definition:'Changed meaning',semanticReview:reviewed.semanticReview})).toThrow('concept_semantic_review_scope_conflict');
});
test('unlinked evidence remains explicit and accessors are rejected without invocation',()=>{
 expect(projectStudentConceptGraph('owner-a','student-a',[evidence],[concept],[]).unlinkedEvidenceRevisionIds).toEqual([evidence.revisionId]);
 let reads=0;const rows=[evidence];Object.defineProperty(rows,0,{get(){reads++;return evidence;},enumerable:true});
 expect(()=>projectStudentConceptGraph('owner-a','student-a',rows,[concept],[])).toThrow('accessors are not JSON data');expect(reads).toBe(0);
});
