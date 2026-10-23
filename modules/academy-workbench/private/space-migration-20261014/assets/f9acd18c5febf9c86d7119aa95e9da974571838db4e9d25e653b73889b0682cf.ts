import type { HistoryDataset, SourceTime, SourceManifest, VideoObservation, AssignmentCheck } from './history-source.types.ts';
import type { LocalIdentityResolution } from './identity-binding.types.ts';
export interface ModuleCoverage {
  module: string; observedRecordCount: number;
  sourceAsOf: null; sourceAsOfState: 'not_supplied_for_this_module';
  displayedRange: { first: SourceTime|null; last: SourceTime|null; orderBasis: 'uniform_raw_display_format'|'not_comparable'; missingTimeCount: number };
  queryScope: string; queryScopeBasis: 'supplied_canonical_coverage';
  completeness: 'bounded_only'; sourceExhausted: null; provesMissingWork: false;
}
export interface StudentHistoryProjection {
  kind: 'student_bounded_history_projection'; schemaVersion: '1.0.0'; revision: 1;
  id: string; canonicalStudentId: string; sourceSnapshotStudentId: string; studentPageId: string;
  createdAt: string; identityResolution: LocalIdentityResolution;
  sourceArchive: {libraryFileId:string;sha256:string;canonicalFileBytesSha256:string;sourceFiles:SourceManifest[]};
  catalogLocator: {pageId:string;reference:string|null};
  asOfPolicy: 'ingestion_is_not_source_observation_time'; moduleCoverage: ModuleCoverage[];
  entities: Pick<HistoryDataset,'enrollments'|'registeredBooks'|'attempts'|'diarySummaries'|'attendance'|'assignments'> & {
    videos: Omit<VideoObservation,'sourceFields'>[];
    assignmentChecks: Omit<AssignmentCheck,'observedFields'>[];
  };
  bookSummary: {sourceBookEditionId:string;catalogCode:string;version:number;displayName:string;schoolLevel:string;catalogSections:number;attemptObservations:number;completion:'not_determined'}[];
  mappingCounts: {attempts:number;inferredCatalogMatches:number;unresolved:number};
  sourceOnlyRecordPolicy:'append_observations_no_event_deduplication_claim';
  preservedCurrentRegistryReference:string; exclusions:string[];
  overallProgressPercentage:null; fullHistoryComplete:false;
}
