import {normalizeLegacyEvidence} from '../../application/normalize-legacy-evidence.ts';
import {EvidenceRecord} from '../v1/evidence-decision.ts';
import {Evidence,EVIDENCE_SCHEMA_VERSION} from '../../domain/evidence.ts';
import {SourceId,Sha256} from '../../domain/ids.ts';
import {MigrationManifest} from '../version.ts';
async function hashBytes(bytes:Uint8Array){return Sha256.parse(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes).buffer)),n=>n.toString(16).padStart(2,'0')).join(''));}
export async function migrateEvidenceV1(originalBytes:Uint8Array,context:{sourceId:SourceId;expectedOriginalSha256:Sha256}){
 if(await hashBytes(originalBytes)!==context.expectedOriginalSha256)throw Error('migration_original_hash_mismatch');
 const old=EvidenceRecord.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(originalBytes)));const evidence=normalizeLegacyEvidence(old,context.sourceId);
 const manifest=MigrationManifest.parse({migrationId:'evidence-v1-to-v2',from:'academy.evidence/1.1.0',to:EVIDENCE_SCHEMA_VERSION,reversible:true,preservesOriginalBytes:true,nativeIdentityPromoted:false,sourceVerificationPromoted:false,rollback:{kind:'restore_pinned_original',originalSha256:context.expectedOriginalSha256,requiresRevisionLease:true},breakingChanges:['sourceKind and actor/time fields moved into discriminated source','direct source naming requires independent trusted validation','user claimed event time is reportedEventAt, never tool observedAt'],blockedReasons:['direct receipt cannot be trusted by syntax alone','inference requires explicit input evidence references']});
 return {evidence,original:old,originalBytes:Uint8Array.from(originalBytes),manifest};
}
export async function prepareEvidenceRollback(input:{originalBytes:Uint8Array;manifest:unknown;expectedRevision:Sha256;currentRevision:Sha256}){const manifest=MigrationManifest.parse(input.manifest);if(manifest.migrationId!=='evidence-v1-to-v2'||manifest.from!=='academy.evidence/1.1.0'||manifest.to!==EVIDENCE_SCHEMA_VERSION||manifest.reversible!==true)throw Error('rollback_migration_identity_or_reversibility_mismatch');if(input.expectedRevision!==input.currentRevision)throw Error('rollback_revision_conflict');if(await hashBytes(input.originalBytes)!==manifest.rollback.originalSha256)throw Error('rollback_original_hash_mismatch');return Uint8Array.from(input.originalBytes);}
