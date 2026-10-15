/** Archived claims adapted from academy-workbench/app/standalone/src/server/contracts.ts.
 * This contract has no native StudentBinding or current teacher-judgment conversion. */
export type ArchivedJson=null|boolean|number|string|ArchivedJson[]|{[key:string]:ArchivedJson};
export interface ArchivedStudent {id:string;displayName:string;sourceIdentities:{namespace:string;sourceId:string;verification:'unverified'|'verified';evidenceIds:string[]}[]}
export interface ArchivedRecord {id:string;studentId:string|null;domain:string;kind:string;data:ArchivedJson;provenance:Record<string,ArchivedJson>;supersedes:string[];retracts:string[];conflicts:string[]}
export interface ArchivedArtifact {id:string;mime:string;filename:string;bytes:number|null;sha256:string|null;archivePath:string|null;sourceObjectId:string|null;acquiredAt:string|null;availability:'available'|'missing'|'blocked'|'unverified'}
export interface PreservedDataset {schemaVersion:'academy.portable-dataset/1';datasetId:string;ownerId:string;mode:'synthetic'|'private';createdAt:string;students:ArchivedStudent[];records:ArchivedRecord[];artifacts:ArchivedArtifact[];projections:ArchivedJson[]}
export interface ArchiveIdentity {sourceIdentity:'unverified_preservation';namespace:string;snapshotSha256:string;datasetId:string;archivedOwnerId:string;createdAt:string;currentStudentBinding:null;currentness:'unknown';correctionSemantics:'preserved_not_applied'}
export interface PreservedHistoryIndex extends ArchiveIdentity {students:ArchivedStudent[];ownerRecordCount:number;recordCount:number;projectionCount:number;artifacts:ArchivedArtifact[];datasetDownload:string}
export interface PreservedSelection {namespace:string;scope:'owner'|'student';studentId?:string}
export interface PreservedRecordSummary {id:string;studentId:string|null;domain:string;kind:string;sourceKind:ArchivedJson;verification:ArchivedJson;completeness:ArchivedJson;recordedAt:ArchivedJson;originalTimeLabel:ArchivedJson;supersedes:string[];retracts:string[];conflicts:string[]}
export interface PreservedHistoryPage extends ArchiveIdentity {selection:PreservedSelection;total:number;records:PreservedRecordSummary[];nextCursor:string|null}
export interface PreservedHistoryDetail extends ArchiveIdentity {selection:PreservedSelection;record:ArchivedRecord}
