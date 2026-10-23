/** Module-local context contracts. These keys are not central artifact/work IDs. */
export type ModuleScope = 'academy' | 'math';
export type ContextKind = 'intent' | 'decision' | 'proposal' | 'evidence' | 'verification' | 'acceptance';
export type ContextStatus = 'active' | 'proposed' | 'rejected' | 'superseded' | 'future' | 'open_to_revision' | 'reported' | 'observed' | 'accepted_scoped';
export type EpistemicBasis = 'explicit_user_message' | 'assistant_interpretation' | 'user_hypothesis' | 'assistant_report' | 'observed_source_snapshot';
export interface NoAuthority { authority: 'none'; nativePermissionGranted: false; }
export interface ContextSource extends NoAuthority {
  sourceKey: string;
  sourceType: 'conversation_message' | 'space_block';
  author: 'user' | 'assistant' | 'unknown';
  alias: string;
  messageId: string | null;
  channel: string | null;
  sentAt: string | null;
  url: string | null;
  urlStatus: 'not_returned_by_message_tool' | 'verified_page_url';
  locator: { method?: 'read_messages'; messageId?: string; pageId?: string; blockId?: string; upstreamBlockHash?: string };
  retrieval: 'read_or_search_visible_room' | 'chatgpt_space.read_page';
  originalText: string;
  textSha256: string;
  textCompleteness: 'complete_returned_message' | 'complete_returned_block';
  omissions: string[];
  replyTo: string | null;
  replyRoot: string | null;
  pageSnapshot?: { updatedAt: string; currentSequence: number; title: string };
}
export interface ContextLink { relation: 'rejects' | 'rejected_by' | 'restricts' | 'extends' | 'interprets' | 'responds_to' | 'qualifies' | 'corrected_by' | 'clarified_by' | 'corrects' | 'clarifies' | 'implements_intent' | 'narrows' | 'superseded_by' | 'supersedes' | 'accepts_scope'; targetKey: string; }
export interface ContextRecordBase {
  key: string;
  modules: ModuleScope[];
  summary: string;
  basis: EpistemicBasis;
  status: ContextStatus;
  sourceKeys: string[];
  links: ContextLink[];
  limitations: string[];
  assessmentFacts?: { questionCount: number; scoreBands: { count: number; points: number }[]; totalPoints: number; selectionStatus: 'not_selected' };
  timingFacts?: { startLocal: string; durationMinutes: number; sessionEndLocal: string; date: null; timeZone: null };
  derivedValues?: { field: string; value: string | number; method: string }[];
}
export type ContextRecord =
  | ContextRecordBase & { kind: Exclude<ContextKind, 'acceptance' | 'verification'>; acceptance?: never }
  | ContextRecordBase & { kind: 'acceptance'; status: 'accepted_scoped'; acceptance: { outcome: 'accepted'; targetKey: string; scope: string; excluded: string[] } };
export interface ContextRecords extends NoAuthority {
  schemaVersion: 'module-user-context.records/1.0.0';
  recordKeys: string;
  records: ContextRecord[];
}
export interface ContextVerification extends NoAuthority {
  schemaVersion: 'module-user-context.verification/1.0.0';
  kind: 'verification';
  status: 'passed' | 'failed';
  verifiedAt: string;
  implementation: 'scripts/validate.mjs';
  checks: { name: string; status: 'passed' }[];
  errors: string[];
  sourceFingerprint: string;
  scope: string;
  doesNotEstablish: string[];
  acceptanceDecision: 'not_made';
  executionEffects: 'none';
}
export interface Coverage {
  schemaVersion: 'module-user-context.coverage/1.0.0';
  scopeStatus: 'partial';
  fullConversationTransferComplete: false;
  fullSpaceReconciliationComplete: false;
  conversationDenominator: null;
  coveragePercent: null;
  scopeDescription: string;
  included: { messages: number; spaceBlocks: number; records: number; sourceTimeMinimum: string; sourceTimeMaximum: string };
  scopeInventory: { scope: string; status: string; includes: string[]; notIncluded?: string[]; reason?: string }[];
  gaps: { key: string; status: string; detail: string }[];
  excludedData: string[];
  sourceTruthRules: string[];
}
