import {assertExactKeys,assertInstant,canonicalJson,requireText,type Knowledge} from '../learning/model';
import {TeacherWorkspaceRefusal} from './teacherWorkspace';
import {conceptDefinitionDigest,createConceptRevision,createConceptLinkRevision,type ConceptDefinition,type ConceptRevision,type ConceptLinkRevision,type ConceptLinkBody} from './conceptEvidenceGraph';
import type {SourceKey} from './domain';

export interface ConceptDefinitionInput {
 expectedRevisionId:string|null;idempotencyKey:string;reportedAt:string;
 definition:Omit<ConceptDefinition,'semanticReview'>;
 review:{decision:'candidate'|'reviewed_definition';confirmedDefinitionReview:boolean;expectedDefinitionDigest:string|null;sourceRef:string|null};
}
export interface ConceptLinkInput {
 studentId:string;evidenceRevisionId:string;conceptRevisionId:string;status:ConceptLinkBody['status'];basisRefs:string[];
 expectedRevisionId:string|null;idempotencyKey:string;reportedAt:string;confirmedTeacherReview:boolean;reviewSourceRef:string|null;
}
export interface ConceptCommandContext {ownerId:string;actorId:string}
export interface ConceptWorkspaceVersion {
 ownerId:string;studentId:string|null;entityId:string;sequence:number;revisionId:string;previousRevisionId:string|null;previousDigest:string|null;
 kind:'definition'|'link';payload:ConceptRevision|ConceptLinkRevision;contentDigest:string;integrityDigest:string;recordedAt:string;
 actorId:string;idempotencyKey:string;commandDigest:string;sourceQualification:'teacher_reported_definition_not_curated_catalog'|'explicit_scoped_teacher_relationship_report';
}
export interface ConceptWorkspaceReceipt {status:'saved'|'replay';revisionId:string;sequence:number;recordedAt:string;contentDigest:string;officialSaved:false;parentSent:false;record:ConceptWorkspaceVersion}
export function conceptSelector(value:unknown):asserts value is string {if(typeof value!=='string'||!value.trim()||value.length>200)throw Error('invalid_concept_selector');}
export function conceptLease(value:unknown){if(value!==null)conceptSelector(value);}
export function conceptReportedAt(value:string){assertInstant(value);if(Date.parse(value)>Date.now())throw Error('future_source_observation');}
export function conceptIntake<T>(read:()=>T):T {try{return read();}catch(error){throw new TeacherWorkspaceRefusal(error instanceof Error?error.message:'invalid_concept_input','intake');}}
export function conceptDefinitionFromInput(context:ConceptCommandContext,input:ConceptDefinitionInput):ConceptRevision {
 canonicalJson(input);assertExactKeys(input,['expectedRevisionId','idempotencyKey','reportedAt','definition','review']);conceptLease(input.expectedRevisionId);conceptSelector(input.idempotencyKey);conceptReportedAt(input.reportedAt);
 assertExactKeys(input.definition,['sourceKey','label','definition','curriculumEdition','sourceRefs']);assertExactKeys(input.review,['decision','confirmedDefinitionReview','expectedDefinitionDigest','sourceRef']);
 const {review}=input;let semanticReview:ConceptDefinition['semanticReview'];
 if(review.decision==='candidate'){
  if(review.confirmedDefinitionReview!==false||review.expectedDefinitionDigest!==null||review.sourceRef!==null)throw Error('candidate_definition_review_conflict');
  semanticReview={state:'unknown',reason:'Teacher-entered definition candidate; curated mathematical/curriculum source acceptance not established'};
 }else if(review.decision==='reviewed_definition'){
  if(review.confirmedDefinitionReview!==true||review.expectedDefinitionDigest!==conceptDefinitionDigest(input.definition))throw Error('explicit_exact_definition_review_required');
  conceptSelector(review.sourceRef);
  semanticReview={state:'known',value:{definitionDigest:review.expectedDefinitionDigest,reviewerId:context.actorId,sourceRef:review.sourceRef,reviewedAt:input.reportedAt},evidenceRefs:[review.sourceRef]};
 }else throw Error('invalid_definition_review');
 return createConceptRevision({...input.definition,semanticReview});
}
export function conceptLinkFromInput(context:ConceptCommandContext,input:ConceptLinkInput,prior:ConceptLinkRevision|null):ConceptLinkRevision {
 canonicalJson(input);assertExactKeys(input,['studentId','evidenceRevisionId','conceptRevisionId','status','basisRefs','expectedRevisionId','idempotencyKey','reportedAt','confirmedTeacherReview','reviewSourceRef']);
 for(const value of [input.studentId,input.evidenceRevisionId,input.conceptRevisionId,input.idempotencyKey])conceptSelector(value);conceptLease(input.expectedRevisionId);conceptReportedAt(input.reportedAt);
 let teacherReview:ConceptLinkBody['teacherReview'];
 if(input.status==='candidate'){
  if(input.confirmedTeacherReview!==false||input.reviewSourceRef!==null)throw Error('candidate_relationship_review_conflict');teacherReview={state:'unknown',reason:'Candidate association only; no teacher relationship judgment'};
 }else {
  if(input.confirmedTeacherReview!==true)throw Error('explicit_scoped_teacher_review_required');conceptSelector(input.reviewSourceRef);
  teacherReview={state:'known',value:{actorId:context.actorId,reportedAt:input.reportedAt,sourceRef:input.reviewSourceRef,targetEvidenceRevisionId:input.evidenceRevisionId,targetConceptRevisionId:input.conceptRevisionId,decision:input.status==='verified'?'supported':'contradicted'},evidenceRefs:[input.reviewSourceRef]};
 }
 return createConceptLinkRevision({ownerId:context.ownerId,studentId:input.studentId,evidenceRevisionId:input.evidenceRevisionId,conceptRevisionId:input.conceptRevisionId,status:input.status,basisRefs:input.basisRefs,teacherReview},prior);
}
