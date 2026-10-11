import {z} from 'zod';
import {Evidence,type Evidence as EvidenceValue} from '../domain/evidence.ts';
import {EntityId,NativeEntityId,EvidenceId} from '../domain/ids.ts';
import {CertificationQuery,classifyCertificationScore,type CertificationScope} from '../domain/book-certification.ts';

const binding=z.strictObject({bookEditionId:EntityId,testEntityId:EntityId,nativeTestId:NativeEntityId,isFinalCertificationTest:z.literal(true)});
const queryClaim=z.strictObject({nativeTestId:NativeEntityId,completeForSelectedTest:z.literal(true),attemptIds:z.array(EntityId)});
const resultClaim=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('ungraded'),bookEditionId:EntityId,nativeTestId:NativeEntityId,nativeAttemptId:NativeEntityId,score:z.null(),scoreUnit:z.null()}),
 z.strictObject({state:z.literal('graded'),bookEditionId:EntityId,nativeTestId:NativeEntityId,nativeAttemptId:NativeEntityId,score:z.number(),scoreUnit:z.literal('points')})
]);
/** Source-described results stay separate from live verified retrieval and teacher completion. */
export function projectBookCertification(input:unknown,evidenceInputs:readonly unknown[]=[]){
 const request=CertificationQuery.parse(input),scope=request.scope,evidence=evidenceInputs.map(e=>Evidence.parse(e)),byId=new Map(evidence.map(e=>[e.evidenceId,e]));
 if(byId.size!==evidence.length)throw Error('duplicate_certification_evidence');
 const base={scope,minimumScore:70 as const,liveResultsRetrieved:false as const,teacherBookCompletion:'unknown' as const,retakeSelectionRule:'unconfirmed' as const};
 if(request.state==='unqueried')return {...base,state:'unqueried' as const,attempts:[],requirementSatisfied:null};
 const requireSource=(id:EvidenceId,type:string,extra:readonly EntityId[]=[]):EvidenceValue=>{const e=byId.get(id);if(!e||e.scope.studentId!==scope.studentId||![scope.bookEditionId,scope.testEntityId,...extra].every(target=>e.scope.entityIds.includes(target)))throw Error('certification_evidence_scope_mismatch');if(e.verificationStatus==='contradicted'||!['imported_snapshot','direct_lms_observation'].includes(e.source.kind)||e.claim.type!==type)throw Error('certification_source_result_required');return e;};
 assertFinalBinding(scope,binding.parse(requireSource(request.bindingEvidenceId,'book_certification_final_test_binding').claim.value));
 const query=queryClaim.parse(requireSource(request.queryEvidenceId,'book_certification_query_result').claim.value);
 if(query.nativeTestId!==scope.nativeTestId||new Set(query.attemptIds).size!==query.attemptIds.length||query.attemptIds.length!==request.attempts.length||request.attempts.some(a=>!query.attemptIds.includes(a.attemptId)))throw Error('certification_query_partition_mismatch');
 if(new Set(request.attempts.map(a=>a.attemptId)).size!==request.attempts.length||new Set(request.attempts.map(a=>a.nativeAttemptId)).size!==request.attempts.length)throw Error('duplicate_certification_attempt');
 const attempts=request.attempts.map(a=>{const claim=resultClaim.parse(requireSource(a.evidenceId,'book_certification_attempt_result',[a.attemptId]).claim.value);if(claim.bookEditionId!==scope.bookEditionId||claim.nativeTestId!==scope.nativeTestId||claim.nativeAttemptId!==a.nativeAttemptId||claim.state!==a.state||claim.score!==a.score)throw Error('certification_attempt_binding_mismatch');return {...a,outcome:a.state==='ungraded'?'ungraded' as const:classifyCertificationScore(a.score)};});
 return {...base,state:attempts.length?'supplied_attempts' as const:'not_attempted_in_supplied_complete_scope' as const,attempts,requirementSatisfied:null};
}
function assertFinalBinding(scope:CertificationScope,value:z.infer<typeof binding>){if(value.bookEditionId!==scope.bookEditionId||value.testEntityId!==scope.testEntityId||value.nativeTestId!==scope.nativeTestId)throw Error('final_certification_binding_mismatch');}
