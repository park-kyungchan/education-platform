import {normalizeLegacyEvidence,normalizeLegacyDecision} from './normalize-legacy-evidence.ts';
import {SourceId} from '../domain/ids.ts';
import {EvidenceProjection,ClaimValues} from '../schema/v1/evidence-projection.ts';
import {parseEvidenceDecisionBundle} from '../schema/v1/evidence-decision.ts';
export function validateEvidenceProjection(input:unknown,context:{studentId:string;studentPageId:string;rosterRevision:string;sourceSnapshotSha256:string;sourceProjectionSha256:string;allowedRecordIds:string[]}){
 const p=EvidenceProjection.parse(input),b=p.namespaceBinding;
 if(p.studentId!==context.studentId||b.studentId!==p.studentId||b.studentPageId!==context.studentPageId||b.rosterRevision!==context.rosterRevision||p.sourceSnapshotSha256!==context.sourceSnapshotSha256||b.sourceSnapshotSha256!==p.sourceSnapshotSha256||p.sourceProjectionSha256!==context.sourceProjectionSha256)throw Error('evidence_namespace_or_source_scope_mismatch');
 const parsed=parseEvidenceDecisionBundle(p.evidenceRecords,p.decisionRecords),evidence=new Map(parsed.evidenceRecords.map(e=>[e.evidenceId,e])),decisions=new Map(parsed.decisionRecords.map(d=>[d.decisionId,d])),allowed=new Set(context.allowedRecordIds);
 if(parsed.evidenceRecords.some(e=>e.scope.studentId!==p.studentId)||parsed.decisionRecords.some(d=>d.studentId!==p.studentId))throw Error('evidence_student_scope_mismatch');
 // This release has no direct LMS adapter. A source document cannot relabel a
 // report/cache as a completed direct query, even with forged receipt fields.
 if(parsed.evidenceRecords.some(e=>e.sourceKind==='lms_direct_observation'))throw Error('live_lms_adapter_not_connected');
 for(const e of parsed.evidenceRecords){const schema=Object.hasOwn(ClaimValues,e.claim.type)?ClaimValues[e.claim.type as keyof typeof ClaimValues]:undefined;if(!schema||!schema.safeParse(e.claim.value).success)throw Error('unsupported_or_expanded_evidence_claim');const expectedKind=e.claim.type==='assignment_catalog_unit_count'?'inference':['imported_grading_observation','unmapped_imported_grading_observation','cached_native_catalog_structure'].includes(e.claim.type)?'imported_snapshot':'user_report';if(e.sourceKind!==expectedKind)throw Error('claim_source_kind_mismatch');}
 for(const d of parsed.decisionRecords)if(d.decisionStatus==='confirmed'&&d.evidenceIds.some(id=>evidence.get(id)?.claim.type!=='teacher_review_statement'))throw Error('teacher_confirmation_requires_teacher_review_evidence');
 for(const [rid,ids]of Object.entries(p.recordEvidenceIds)){if(!allowed.has(rid)||new Set(ids).size!==ids.length||ids.some(id=>!evidence.get(id)?.scope.entityIds.includes(rid)))throw Error('record_evidence_scope_mismatch');}
 for(const [rid,ids]of Object.entries(p.recordDecisionIds)){if(!allowed.has(rid)||new Set(ids).size!==ids.length||ids.some(id=>!decisions.get(id)?.targetEntityIds.includes(rid)))throw Error('record_decision_scope_mismatch');}
 if(p.unboundEvidenceIds.some(id=>!evidence.has(id))||p.unboundDecisionIds.some(id=>!decisions.has(id)))throw Error('unbound_reference_missing');
 const checkPartition=(all:readonly string[],bound:readonly string[],unbound:readonly string[],kind:string)=>{const mapped=new Set(bound),unmapped=new Set(unbound);if(unmapped.size!==unbound.length||unbound.some(id=>mapped.has(id))||all.some(id=>!mapped.has(id)&&!unmapped.has(id)))throw Error(kind+'_mapping_partition_invalid');};
 checkPartition([...evidence.keys()],Object.values(p.recordEvidenceIds).flat(),p.unboundEvidenceIds,'evidence');checkPartition([...decisions.keys()],Object.values(p.recordDecisionIds).flat(),p.unboundDecisionIds,'decision');
 for(const a of p.assignments){if(a.studentId!==p.studentId||a.scopeItems.length!==a.appGradingUnitCount||a.evidenceIds.some(id=>!evidence.has(id)))throw Error('assignment_scope_mismatch');for(const s of a.scopeItems){if(!allowed.has(s.existingRecordRef)||s.evidenceIds.some(id=>!evidence.get(id)?.scope.entityIds.includes(s.existingRecordRef)))throw Error('assignment_record_evidence_mismatch');}}
 const normalized=parsed.evidenceRecords.map(e=>normalizeLegacyEvidence(e,SourceId.parse(e.sourceRef.reference??e.sourceRef.sourceMessageId??'legacy:'+p.sourceSnapshotSha256)));for(const decision of parsed.decisionRecords)normalizeLegacyDecision(decision,normalized);
 return p;
}
