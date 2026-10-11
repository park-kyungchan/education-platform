import {EvidenceRecord,DecisionRecord} from '../schema/v1/evidence-decision.ts';
import {Evidence,EVIDENCE_SCHEMA_VERSION} from '../domain/evidence.ts';
import {Decision,validateDecisionReferences} from '../domain/decision.ts';
import {SourceId} from '../domain/ids.ts';
/** Read-only normalization. The legacy wire/source object remains unchanged.
 * This never grants access, promotes source trust, or writes a migration. */
export function normalizeLegacyEvidence(input:unknown,sourceId:SourceId):Evidence{
 const old=EvidenceRecord.parse(input);let source:unknown;const common={actor:old.actor,sourceRef:{sourceMessageId:old.sourceRef.sourceMessageId,reference:old.sourceRef.reference,sha256:old.sourceRef.sha256,jsonPointer:old.sourceRef.jsonPointer}};
 if(old.sourceKind==='user_report')source={...common,kind:'user_report',sourceMessageId:old.sourceRef.sourceMessageId,reportedAt:old.reportedAt,reportedEventAt:old.observedAt,observedAt:null,capturedAt:null,statementProvenanceConfirmed:old.statementProvenance?.confirmed??false};
 else if(old.sourceKind==='imported_snapshot')source={...common,kind:'imported_snapshot',reportedAt:old.reportedAt,observedAt:old.observedAt,capturedAt:old.capturedAt};
 else if(old.sourceKind==='lms_direct_observation')throw Error('direct_receipt_requires_independent_trusted_adapter_validation');
 else {const claim=old.claim.value;if(!claim||typeof claim!=='object'||Array.isArray(claim)||!('inputEvidenceIds' in claim))throw Error('inference_input_evidence_missing');source={...common,kind:'inference',reportedAt:old.reportedAt,observedAt:null,capturedAt:null,providedClocks:{observedAt:old.observedAt,capturedAt:old.capturedAt},inputEvidenceIds:claim.inputEvidenceIds,ruleVersion:'legacy.inference/1.0.0'};}
 return Evidence.parse({schemaVersion:EVIDENCE_SCHEMA_VERSION,evidenceId:old.evidenceId,scope:{...old.scope,sourceId},recordedAt:old.recordedAt,timeRaw:old.timeRaw,claim:old.claim,verificationStatus:old.verificationStatus,verificationDetail:old.verificationDetail??null,revision:old.revision,supersedesEvidenceIds:old.supersedesEvidenceIds,retractsEvidenceIds:old.retractsEvidenceIds,conflictingEvidenceIds:old.conflictingEvidenceIds,source});
}
export function normalizeLegacyDecision(input:unknown,evidence:readonly Evidence[]):Decision{const old=DecisionRecord.parse(input);return validateDecisionReferences({schemaVersion:'academy.decision/2.0.0',decisionId:old.decisionId,studentId:old.studentId,targetEntityIds:old.targetEntityIds,evidenceIds:old.evidenceIds,ruleVersion:old.ruleVersion,status:old.decisionStatus,authority:old.decisionAuthority,recordedAt:old.recordedAt},evidence);}
