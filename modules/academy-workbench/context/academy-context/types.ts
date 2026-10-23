/** Local discovery metadata. Not a Memory store, native registry, dispatcher or permission grant. */
export interface Repo { id: string; path: string; commit: string; role: string; observation: 'local-checkout'; dirty: boolean }
export type SourceClassification = 'current-owner' | 'original-reference' | 'historical-summary' | 'derived-view' | 'verification' | 'private-metadata' | 'compatibility';
export interface Source {
  id: string; repositoryId: string; path: string; sha256: string | null; byteLength: number | null;
  classification: SourceClassification; readPolicy: 'metadata-only' | 'selected-design' | 'no-content-read';
  ownerId: string; topicIds: string[]; note: string;
}
export interface Topic { id: string; parentId: string | null; kind: 'domain' | 'workflow' | 'foundation'; title: string; sourceIds: string[]; dependsOn: string[] }
export interface ContextRecord {
  id: string; kind: 'actual-user-decision' | 'source-owner-decision' | 'proposal' | 'inference' | 'coverage-gap';
  status: 'current' | 'historical' | 'proposed' | 'unresolved'; title: string; text: string;
  topicIds: string[]; sourceIds: string[]; originalIds: string[]; supersedes: string[];
}
export interface DomainRelation { id: string; topology: 'containment' | 'dependency' | 'provenance' | 'semantic' | 'revision' | 'workflow-cycle'; from: string; to: string; meaning: string }
export interface Finding {
  id: string; category: string; priority: 'P1' | 'P2' | 'P3';
  status: 'observed' | 'mitigated-locally' | 'peer-in-progress' | 'deferred-owner' | 'unverified';
  title: string; detail: string; topicIds: string[]; sourceIds: string[]; taskId: string; nextAction: string;
}
export interface Catalog {
  schemaVersion: 'academy.context-catalog/1'; projectId: string; workId: string;
  authority: 'none'; nativePermissionGranted: false; defaultNavigation: ['date', 'class', 'student'];
  coverage: { status: 'partial'; denominator: null; complete: false; note: string };
  /** Topic IDs. Excluded topic roots also exclude their containment descendants. */
  scope: { included: string[]; excluded: string[] };
  repositories: Repo[]; sources: Source[]; topics: Topic[]; records: ContextRecord[]; relations: DomainRelation[]; findings: Finding[];
}
export interface SelectionQuery { topicId: string; includeHistory?: boolean; maxBytes?: number; cursor?: string }
export interface HistoricalReference { id: string; recordKind: ContextRecord['kind']; status: 'historical'; topicIds: string[]; sourceIds: string[]; supersedes: string[]; reason: 'historical-revision-reference' }
export type SelectionItem = { kind: 'topic'; value: Topic } | { kind: 'source'; value: Source } | { kind: 'record'; value: ContextRecord } | { kind: 'finding'; value: Finding } | { kind: 'reference'; value: HistoricalReference } | { kind: 'relation'; value: DomainRelation };
export interface SelectionPage {
  schemaVersion: 'academy.context-selection/1'; catalogSha256: string;
  projectId: string; workId: string; authority: 'none'; nativePermissionGranted: false;
  query: { topicId: string; includeHistory: boolean; maxBytes: number };
  coverage: Catalog['coverage']; excludedScope: string[];
  closure: { topicIds: string[]; topicCount: number; sourceCount: number; recordCount: number; findingCount: number; relationCount: number; referenceCount: number; itemCount: number };
  items: SelectionItem[]; nextCursor: string | null; usedBytes: number;
}
