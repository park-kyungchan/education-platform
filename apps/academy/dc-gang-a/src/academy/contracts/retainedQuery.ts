/** Browser-safe transport contract. Fragments preserve JSON structure, never infer learning state. */
export const retainedQueryLimits={pageBytes:65_536,maxPageBytes:131_072,minPageBytes:1024,pageRecords:100,maxPageRecords:250,documentBytes:8_388_608,documentRecords:100_000,depth:64} as const;
export type RetainedSelector={kind:'cohort'}|{kind:'student';studentId:string;date:string}|{kind:'class_preparation';date:string;groupId?:string};
export interface RetainedQueryRequest {selector:RetainedSelector;cursor?:string|null;limit?:number;maxBytes?:number}
export type QueryJson=null|boolean|number|string|QueryJson[]|{[key:string]:QueryJson};
export type RetainedPath=(string|number)[];
export type RetainedFragment={ordinal:number;path:RetainedPath;kind:'object'|'array'}|{ordinal:number;path:RetainedPath;kind:'value';value:QueryJson};
export interface RetainedQueryPage {
  schema:'academy.retained-query.v1';status:'page';selector:RetainedSelector;
  snapshot:string;facadeSceneRevision:string|null;callerBinding:string;retrievedAt:string;
  coverage:{source:'canonical_retained_facade';authoritativeCurrentness:'unknown';completeCurrentRoster:'not_established';history:'canonical_projection_inputs_only_not_all_history';clocks:'source_observed_verified_recorded_clocks_retained_in_document_not_refreshed_by_query';groupFilter:'none'|'exact_observed_group';sourceRowCount:number|null};
  omissions:readonly string[];
  records:RetainedFragment[];
  page:{offset:number;returned:number;totalRecords:number;exhausted:boolean;nextCursor:string|null;maxBytes:number;serializedBytes:number};
  effects:{sourceAcquisition:false;sourceWrites:false;parentSends:false};
}
export interface RetainedQueryRefusal {schema:'academy.retained-query.v1';status:'refused';code:string;records:[];automaticRetry:false}
export type RetainedQueryReply=RetainedQueryPage|RetainedQueryRefusal;
