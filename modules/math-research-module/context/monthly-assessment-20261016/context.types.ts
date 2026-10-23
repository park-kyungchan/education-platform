/** Module-local research dossier only. Canonical Artifact/WorkContext stay upstream. */
export type ClaimStatus = 'current' | 'superseded' | 'proposal' | 'historical_report' | 'unknown' | 'accepted_scoped';
export type ClaimBasis = 'explicit_user_message' | 'user_hypothesis' | 'assistant_proposal' | 'assistant_report' | 'repository_snapshot' | 'derived';
export type ResearchLayer = 'DATA' | 'LOGIC' | 'ACTION' | 'GOVERNANCE';
export interface SourceReference {
  sourceKey: string; author: 'user' | 'assistant' | 'unknown' | 'page_summary';
  messageId?: string | null; sentAt: string | null; url?: string | null;
  originalText: string; textSha256: string;
  textCompleteness?: string; omissions?: string[];
  authority: 'none'; nativePermissionGranted: false; usedBy: string[];
}
export interface Claim {
  key: string; parentKey: string | null; title: string; statement: string;
  status: ClaimStatus; basis: ClaimBasis; sourceKeys: string[];
  existingRecordKeys: string[]; limitations: string[];
}
export interface Relation {
  from: string; to: string; type: string; sourceKeys: string[];
}
export interface Dossier {
  schemaVersion: 'monthly-assessment-context/1.0.0';
  authority: 'none'; nativePermissionGranted: false;
  claims: Claim[]; relations: Relation[];
  sourcesFile: 'sources.json'; coverageFile: 'coverage.json';
  externalRecordReferences: { key: string; path: string; baseCommit: string }[];
  ontologyArchitecture: { status: string; sourceKey: string; DATA: unknown; LOGIC: unknown; ACTION: unknown; GOVERNANCE: unknown; relationTypes: unknown; executionLink: unknown };
  hierarchy: { key: string; title: string; recordKeys: string[] }[];
  existingSourceOwner: { repository: string; baseCommit: string; canonicalHarnessPin: string; pinsModified: false };
}
