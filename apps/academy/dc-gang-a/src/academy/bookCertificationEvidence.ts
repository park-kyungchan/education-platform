import {canonicalJson,digest,assertExactKeys,assertInstant} from '../learning/model';
import {projectBookCertification} from '../../../gang-a/packages/application/project-book-certification';
import {CertificationQuery} from '../../../gang-a/packages/domain/book-certification';
import {Evidence,type Evidence as PolicyEvidence} from '../../../gang-a/packages/domain/evidence';
import type {RecordVersion,StoredStudent} from './contracts/storageRecords';
import type {SourceBookRegistration} from './records';

export interface RetainedCertificationBinding {ownerId:string;student:StoredStudent;registration:RecordVersion&{payload:SourceBookRegistration}}
export interface RetainedCertificationScope {ownerId:string;studentId:string;nativeStudentId:string;registrationRevisionId:string;catalogEditionId:string;sourceBook:SourceBookRegistration['sourceBook'];sourceCourse:SourceBookRegistration['sourceCourse'];sourceUserCourse:SourceBookRegistration['sourceUserCourse']}
/** Supplied only by an owner-configured retained-reader port, never by an HTTP client or teacher grading form. */
export interface QualifiedRetainedCertificationRead {
 state:'qualified_supplied_result';scope:RetainedCertificationScope;
 qualification:{family:'book_certification_results';readContractRef:string;verificationReceiptRef:string;sourceRevision:string;observedAt:string;sourceBlobSha256:string[];evidenceDigest:string};
 query:unknown;evidence:unknown[];
}
export type RetainedCertificationRead=QualifiedRetainedCertificationRead|{state:'unresolved';scope:RetainedCertificationScope;unknowns:string[]};
export interface BookCertificationRetainedPort {
 /** Lookup locally retained, separately qualified inputs; acquisition is owned by explicit refresh, not this query. */
 lookup(scope:RetainedCertificationScope):Promise<RetainedCertificationRead|null>;
}
export function certificationScope(binding:RetainedCertificationBinding):RetainedCertificationScope {
 const {ownerId,student,registration}=binding;
 if(student.ownerId!==ownerId||registration.ownerId!==ownerId||registration.studentId!==student.id||registration.payload.kind!=='source_book_registration'||canonicalJson(registration.payload.sourceStudent)!==canonicalJson(student.sourceKey))throw Error('certification_owner_student_binding_conflict');
 return {ownerId,studentId:student.id,nativeStudentId:student.sourceKey.literalKey,registrationRevisionId:registration.revisionId,catalogEditionId:registration.payload.catalogNodeId,sourceBook:registration.payload.sourceBook,sourceCourse:registration.payload.sourceCourse,sourceUserCourse:registration.payload.sourceUserCourse};
}
export function projectRetainedBookCertification(binding:RetainedCertificationBinding,read:RetainedCertificationRead|null){
 const scope=certificationScope(binding),base={kind:'retained_book_certification' as const,scope,minimumScore:70 as const,minimumScoreUnit:'points' as const,applicability:'exact_final_certification_binding_required' as const,teacherBookCompletion:'unknown' as const,retakeSelectionRule:'unconfirmed' as const,automaticBookAdvancement:false as const,liveResultsRetrieved:false as const,officialSaved:false as const,parentSent:false as const};
 const held=(unknowns:string[])=>({...base,state:'held' as const,unknowns,finalTestBinding:'unknown' as const,queryCoverage:'unknown' as const,scoreUnit:'unknown' as const,projection:null,sourceVerification:'not_established_by_this_projection' as const});
 if(read===null)return held(['No qualified retained final-test binding or same-book student result query is configured; missing evidence is not no attempt']);
 canonicalJson(read);if(canonicalJson(read.scope)!==canonicalJson(scope))throw Error('certification_exact_scope_conflict');
 if(read.state==='unresolved'){assertExactKeys(read,['state','scope','unknowns']);if(!Array.isArray(read.unknowns)||!read.unknowns.length||read.unknowns.length>64||read.unknowns.some(value=>typeof value!=='string'||!value.trim()||value.length>1000))throw Error('invalid_certification_unknowns');return held(read.unknowns);}
 assertExactKeys(read,['state','scope','qualification','query','evidence']);if(read.state!=='qualified_supplied_result')throw Error('invalid_certification_capture');
 const q=read.qualification;assertExactKeys(q,['family','readContractRef','verificationReceiptRef','sourceRevision','observedAt','sourceBlobSha256','evidenceDigest']);
 if(q.family!=='book_certification_results'||![q.readContractRef,q.verificationReceiptRef,q.sourceRevision].every(value=>typeof value==='string'&&value.trim()&&value.length<=1000)||!Array.isArray(q.sourceBlobSha256)||!q.sourceBlobSha256.length||q.sourceBlobSha256.length>64||q.sourceBlobSha256.some(value=>!/^[a-f0-9]{64}$/.test(value)))throw Error('invalid_certification_capture');
 if(q.observedAt===null||q.observedAt===undefined)return held(['Qualified source observation time is unknown; recording/view time is not substituted']);assertInstant(q.observedAt);
 if(!Array.isArray(read.evidence)||read.evidence.length>500||q.evidenceDigest!==digest(read.evidence))throw Error('certification_capture_digest_conflict');
 const request=CertificationQuery.parse(read.query);if(request.scope.studentId!==scope.studentId||request.scope.bookEditionId!==scope.catalogEditionId)throw Error('certification_exact_scope_conflict');
 if(request.state!=='supplied_result')return held(['Final-test query has not supplied its exact complete attempt partition']);
 const evidence=read.evidence.map(value=>Evidence.parse(value));
 for(const row of evidence){
  if(row.scope.studentId!==scope.studentId||row.verificationStatus!=='corroborated'||!['imported_snapshot','direct_lms_observation'].includes(row.source.kind))throw Error('certification_qualified_source_required');
  if(row.source.kind!=='imported_snapshot'&&row.source.kind!=='direct_lms_observation')throw Error('certification_qualified_source_required');
  if(!q.sourceBlobSha256.includes(row.source.sourceRef.sha256)||row.source.observedAt===null)throw Error('certification_source_provenance_conflict');
  if(row.source.kind==='direct_lms_observation'&&(row.source.receipt.nativeStudentId!==scope.nativeStudentId||row.source.receipt.sourceRevision!==q.sourceRevision||row.source.observedAt!==q.observedAt))throw Error('certification_native_receipt_scope_conflict');
 }
 const projection=projectBookCertification(request,evidence);
 return {...base,state:'supplied_retained_projection' as const,unknowns:[] as string[],finalTestBinding:'supplied_exact_binding' as const,queryCoverage:'supplied_complete_selected_test' as const,scoreUnit:'points_when_graded' as const,projection,
  sourceVerification:'server_injected_retained_port_scope_and_digest_validated; actual_source_qualification_requires_separate_owner_receipt' as const,qualificationRefs:[q.readContractRef,q.verificationReceiptRef],sourceObservedAt:q.observedAt,evidenceSourceClocks:evidence.map(row=>({evidenceId:row.evidenceId,observedAt:row.source.observedAt})),actualLearningTime:'not_inferred' as const};
}
