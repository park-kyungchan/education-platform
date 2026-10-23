/** Non-sensitive, offline capability inventory. It does not implement transport,
 * grant authority, normalize student facts, or replace canonical evidence/decision types. */
export const REGISTRY_VERSION = 'academy.capabilities/1.0.0' as const;
export const STAGES = ['menu_observed','ui_query_verified','request_captured','offline_parser_verified','auth_connected','live_read_verified','published_verified'] as const;
export type Stage = typeof STAGES[number];
export type Knowledge<T> = {state:'observed';value:T;evidenceRefs:string[]} | {state:'unknown';value:null;reason:string};
export interface StageEvidence {
  state:'evidenced'|'not_verified'|'not_applicable';
  evidenceRefs:string[];
  scope:string;
  provenance:'reported_browser_observation'|'imported_capture_static'|'synthetic_test_receipt'|'current_runtime_receipt'|'none';
}
export interface SourceArtifact {id:string;kind:'space_contract'|'local_contract'|'uploaded_sanitized_capture'|'test_receipt';reference:string;sha256:string;byteSize:number;pageId:string|null;}
export interface ObservationEvidence {id:string;artifactId:string;jsonPointer:string|null;observedAt:string|null;observationWindow:[string,string]|null;reportedAt:string|null;sourceKind:'historical_report'|'user_workflow_statement'|'imported_capture'|'synthetic_test';scope:string;authorityGranted:false;}
export interface UiFilter {label:string;locator:string|null;valuePolicy:'private_runtime_only'|'non_sensitive_runtime_only';isSourceDataField:boolean;}
export interface CapturedHttpContract {
  url:string;method:'POST';operation:'StudentNameSearch';queryParameterNames:string[];bodyEncoding:'application/x-www-form-urlencoded';bodyParameterNames:string[];
  requestValuesPublished:false;response:{status:200;mimeType:'text/html';declaredCharset:'utf-8'};
  captureAt:string;captureCount:1;historicalCoverageComplete:false;credentialsIncluded:false;
}
export interface RouteCapability {
  routeId:string;sourceFamilyId:string;label:string;areaIds:string[];uiUrl:Knowledge<string>;menuPath:string[];
  uiSearchOperationLiterals:string[];uiFilters:UiFilter[];resultDimensions:string[];readProcedure:string[];
  stages:Record<Stage,StageEvidence>;requestContract:Knowledge<CapturedHttpContract>;
  identifierSemantics:Knowledge<{fields:string[];status:'candidates_only';nativeIdentityVerified:false}>;
  serverReadEffects:Knowledge<'read_only'>;authenticationRequirements:Knowledge<string[]>;
  effectfulControlsObserved:string[];observationEvidenceIds:string[];legacyContractIds:string[];
  blockers:string[];networkExecutionAllowed:false;allowlist:{knownUiUrlOnly:true;requestExecutionAllowlisted:false;studentScope:'user_confirmed_managed_students_only';broadQueryAllowed:false};
}
export interface AtomicOperation {
  operationId:string;sourceFamilyId:string;routeId:string|null;areaIds:string[];label:string;
  effect:'source_read_unverified'|'source_write'|'artifact_generation'|'physical_print'|'external_communication'|'private_append_only'|'permission_change'|'scope_review';
  intent:string;intentRouteState:'existing_registry_route'|'proposed_lookup_only';canonicalEntityRefs:string[];evidenceRefs:string[];
  boundaries:{DATA:{inputs:string[];outputs:string[];studentValuesIncluded:false};LOGIC:{allowed:string[];forbidden:string[]};ACTION:{mode:'offline_inventory_only';separateFrom:string[];networkExecutionAllowed:false};SECURITY:{authorizationGranted:false;requires:string[];stopWhen:string[]}};
  stages:Record<Stage,StageEvidence>;minimalGap:string;acceptanceCriteria:string[];
}
export interface CapabilityArea {areaId:string;label:string;routeIds:string[];operationIds:string[];taskRoutes:{intent:string;state:'existing_registry_route'|'proposed_lookup_only'}[];reuseBasis:string[];minimalGaps:string[];acceptanceCriteria:string[];coverageMeaning:'registered_not_connected';}
export interface CapabilityRegistry {
  kind:'academy_capability_registry';version:typeof REGISTRY_VERSION;generatedAt:string;authorityGranted:false;networkExecutionAllowed:false;studentRecordValuesIncluded:false;
  canonicalPageId:string;canonicalContractRefs:{path:string;purpose:string}[];stageDefinitions:Record<Stage,string>;
  sourceArtifacts:SourceArtifact[];evidence:ObservationEvidence[];areas:CapabilityArea[];routes:RouteCapability[];operations:AtomicOperation[];
  invariants:string[];excludedScope:string[];summary:{areaCount:13;routeCount:number;atomicOperationCount:number;requestCapturedOperationCount:1;authConnectedCount:0;liveReadVerifiedCount:0;sourcePublicationVerifiedCount:0};
}
function fail(code:string):never {throw new Error(code);}
function unique(xs:string[],code:string){if(new Set(xs).size!==xs.length)fail(code);}
function isRecord(x:unknown):x is Record<string,unknown>{return typeof x==='object'&&x!==null&&!Array.isArray(x);}
function exactKeys(x:unknown,keys:string[],code:string){if(!isRecord(x)||Object.keys(x).some(k=>!keys.includes(k))||keys.some(k=>!(k in x)))fail(code);}
function strings(x:unknown,code:string):asserts x is string[]{if(!Array.isArray(x)||x.some(v=>typeof v!=='string'))fail(code);}
/** Fail closed on changed live authority or unsupported promotion. Evidence is
 * checked per stage, never by ordinal/max-stage comparison. */
export function validateRegistry(input:unknown):CapabilityRegistry {
  if(!isRecord(input)||input.kind!=='academy_capability_registry'||input.version!==REGISTRY_VERSION)fail('INVALID_REGISTRY_IDENTITY');
  if(input.authorityGranted!==false||input.networkExecutionAllowed!==false||input.studentRecordValuesIncluded!==false)fail('REGISTRY_CANNOT_GRANT_AUTHORITY_OR_INCLUDE_STUDENT_VALUES');
  const r=input as unknown as CapabilityRegistry;
  exactKeys(r,['kind','version','generatedAt','authorityGranted','networkExecutionAllowed','studentRecordValuesIncluded','canonicalPageId','canonicalContractRefs','stageDefinitions','sourceArtifacts','evidence','areas','routes','operations','invariants','excludedScope','summary'],'UNEXPECTED_REGISTRY_FIELD');
  for(const k of ['areas','routes','operations','sourceArtifacts','evidence'] as const)if(!Array.isArray(r[k]))fail('INVALID_COLLECTION_'+k);
  if(r.areas.length!==13)fail('AREA_COUNT_MUST_BE_13');
  unique(r.areas.map(a=>a.areaId),'DUPLICATE_AREA');unique(r.routes.map(a=>a.routeId),'DUPLICATE_ROUTE');unique(r.operations.map(a=>a.operationId),'DUPLICATE_OPERATION');unique(r.evidence.map(a=>a.id),'DUPLICATE_EVIDENCE');unique(r.sourceArtifacts.map(a=>a.id),'DUPLICATE_ARTIFACT');
  const areas=new Set(r.areas.map(a=>a.areaId)),routes=new Set(r.routes.map(a=>a.routeId)),ops=new Set(r.operations.map(a=>a.operationId)),ev=new Set(r.evidence.map(a=>a.id)),artifacts=new Set(r.sourceArtifacts.map(a=>a.id));
  for(const e of r.evidence){exactKeys(e,['id','artifactId','jsonPointer','observedAt','observationWindow','reportedAt','sourceKind','scope','authorityGranted'],'UNEXPECTED_EVIDENCE_FIELD');if(!artifacts.has(e.artifactId)||e.authorityGranted!==false)fail('INVALID_EVIDENCE_REFERENCE');if(e.observedAt!==null&&!Number.isFinite(Date.parse(e.observedAt)))fail('INVALID_OBSERVATION_TIME');}
  const evById=new Map(r.evidence.map(e=>[e.id,e]));
  const checkKnowledge=(k:Knowledge<unknown>)=>{if(k.state==='unknown'){exactKeys(k,['state','value','reason'],'UNEXPECTED_UNKNOWN_FIELD');if(k.value!==null||!k.reason)fail('UNKNOWN_REQUIRES_NULL_AND_REASON');}else if(k.state==='observed'){exactKeys(k,['state','value','evidenceRefs'],'UNEXPECTED_OBSERVED_FIELD');if(k.value===null||!Array.isArray(k.evidenceRefs)||!k.evidenceRefs.length||k.evidenceRefs.some(id=>!ev.has(id)))fail('OBSERVED_REQUIRES_SCOPED_EVIDENCE');}else fail('INVALID_KNOWLEDGE_STATE');};
  const checkStages=(s:Record<Stage,StageEvidence>)=>{
    if(!isRecord(s)||Object.keys(s).length!==STAGES.length)fail('INCOMPLETE_STAGE_MATRIX');
    for(const stage of STAGES){const v=s[stage];exactKeys(v,['state','evidenceRefs','scope','provenance'],'UNEXPECTED_STAGE_FIELD');if(!v||!['evidenced','not_verified','not_applicable'].includes(v.state)||!Array.isArray(v.evidenceRefs))fail('INVALID_STAGE_STATE');
      if(v.evidenceRefs.some(id=>!ev.has(id)))fail('MISSING_STAGE_EVIDENCE');
      if(v.state==='evidenced'&&(!v.evidenceRefs.length||v.provenance==='none'))fail('EVIDENCED_STAGE_REQUIRES_SCOPED_PROOF');
      if(['auth_connected','live_read_verified','published_verified'].includes(stage)&&v.state==='evidenced')fail('LIVE_STAGE_NOT_ESTABLISHED_IN_THIS_OFFLINE_REGISTRY');
      if(stage==='request_captured'&&v.state==='evidenced'&&v.provenance!=='imported_capture_static')fail('UI_HISTORY_CANNOT_PROVE_HTTP_REQUEST');
      if(stage==='offline_parser_verified'&&v.state==='evidenced'&&v.provenance!=='synthetic_test_receipt')fail('PARSER_STAGE_REQUIRES_TEST_RECEIPT');
      if(stage==='offline_parser_verified'&&v.state==='evidenced'&&v.evidenceRefs.some(id=>evById.get(id)?.sourceKind!=='synthetic_test'))fail('PARSER_STAGE_CANNOT_REUSE_CAPTURE_OR_UI_EVIDENCE');
    }
  };
  let capturedRoutes=0,capturedOperations=0;
  for(const route of r.routes){
    exactKeys(route,['routeId','sourceFamilyId','label','areaIds','uiUrl','menuPath','uiSearchOperationLiterals','uiFilters','resultDimensions','readProcedure','stages','requestContract','identifierSemantics','serverReadEffects','authenticationRequirements','effectfulControlsObserved','observationEvidenceIds','legacyContractIds','blockers','networkExecutionAllowed','allowlist'],'UNEXPECTED_ROUTE_FIELD');
    for(const k of [route.uiUrl,route.requestContract,route.identifierSemantics,route.serverReadEffects,route.authenticationRequirements])checkKnowledge(k);
    for(const k of [route.areaIds,route.menuPath,route.uiSearchOperationLiterals,route.resultDimensions,route.readProcedure,route.effectfulControlsObserved,route.blockers])strings(k,'INVALID_ROUTE_STRING_COLLECTION');
    for(const f of route.uiFilters)exactKeys(f,['label','locator','valuePolicy','isSourceDataField'],'UNEXPECTED_FILTER_FIELD');
    if(route.networkExecutionAllowed!==false||route.allowlist.requestExecutionAllowlisted!==false||route.allowlist.broadQueryAllowed!==false)fail('UNAUTHORIZED_TRANSPORT');
    if(route.areaIds.some(id=>!areas.has(id)))fail('ROUTE_AREA_MISSING');checkStages(route.stages);
    if(route.requestContract.state==='observed'){
      capturedRoutes++;const h=route.requestContract.value;
      exactKeys(h,['url','method','operation','queryParameterNames','bodyEncoding','bodyParameterNames','requestValuesPublished','response','captureAt','captureCount','historicalCoverageComplete','credentialsIncluded'],'UNEXPECTED_HTTP_CONTRACT_FIELD');
      exactKeys(h.response,['status','mimeType','declaredCharset'],'UNEXPECTED_HTTP_RESPONSE_FIELD');
      if(h.url!=='https://dc.gang-a.kr/servlet/controller.tutor.base.TestPageListServlet?p_process=StudentNameSearch'||h.bodyEncoding!=='application/x-www-form-urlencoded'||h.bodyParameterNames.join('|')!=='clg_no|book_code|stu_name|check_all_stu|sort_date|chioce_course'||h.queryParameterNames.join('|')!=='p_process'||h.response.status!==200||h.response.mimeType!=='text/html'||h.response.declaredCharset!=='utf-8')fail('HTTP_CONTRACT_DIFFERS_FROM_CAPTURE');
      if(route.routeId!=='route:learning-results'||h.method!=='POST'||h.operation!=='StudentNameSearch'||h.captureCount!==1||h.requestValuesPublished!==false||h.credentialsIncluded!==false||h.historicalCoverageComplete!==false)fail('CAPTURE_CONTRACT_EXCEEDS_SINGLE_OBSERVATION');
      if(route.stages.request_captured.state!=='evidenced')fail('CAPTURE_WITHOUT_STAGE_EVIDENCE');
    }else if(route.requestContract.value!==null||route.stages.request_captured.state==='evidenced')fail('UNKNOWN_HTTP_CONTRACT_CANNOT_BE_PROMOTED');
    if(route.serverReadEffects.state!=='unknown'||route.authenticationRequirements.state!=='unknown')fail('HAR_CANNOT_VERIFY_EFFECTS_OR_AUTH');
  }
  for(const op of r.operations){
    exactKeys(op,['operationId','sourceFamilyId','routeId','areaIds','label','effect','intent','intentRouteState','canonicalEntityRefs','evidenceRefs','boundaries','stages','minimalGap','acceptanceCriteria'],'UNEXPECTED_OPERATION_FIELD');
    exactKeys(op.boundaries,['DATA','LOGIC','ACTION','SECURITY'],'UNEXPECTED_BOUNDARY_FIELD');
    exactKeys(op.boundaries.DATA,['inputs','outputs','studentValuesIncluded'],'UNEXPECTED_DATA_FIELD');
    exactKeys(op.boundaries.LOGIC,['allowed','forbidden'],'UNEXPECTED_LOGIC_FIELD');
    exactKeys(op.boundaries.ACTION,['mode','separateFrom','networkExecutionAllowed'],'UNEXPECTED_ACTION_FIELD');
    exactKeys(op.boundaries.SECURITY,['authorizationGranted','requires','stopWhen'],'UNEXPECTED_SECURITY_FIELD');
    if(op.routeId!==null&&!routes.has(op.routeId))fail('OPERATION_ROUTE_MISSING');if(op.areaIds.some(id=>!areas.has(id)))fail('OPERATION_AREA_MISSING');checkStages(op.stages);
    if(op.boundaries.ACTION.networkExecutionAllowed!==false||op.boundaries.ACTION.mode!=='offline_inventory_only'||op.boundaries.SECURITY.authorizationGranted!==false||op.boundaries.DATA.studentValuesIncluded!==false)fail('INVALID_ATOMIC_BOUNDARY');
    if(op.stages.request_captured.state==='evidenced'){capturedOperations++;if(op.operationId!=='read:learning-results'||op.effect!=='source_read_unverified')fail('CAPTURE_DOES_NOT_AUTHORIZE_OTHER_OPERATIONS');}
    if(!op.acceptanceCriteria.length||!op.minimalGap)fail('OPERATION_ACCEPTANCE_REQUIRED');
  }
  for(const a of r.areas){if(a.coverageMeaning!=='registered_not_connected'||!a.minimalGaps.length||!a.acceptanceCriteria.length)fail('AREA_COVERAGE_MUST_PRESERVE_GAPS');if(a.routeIds.some(id=>!routes.has(id))||a.operationIds.some(id=>!ops.has(id)))fail('AREA_REFERENCE_MISSING');}
  if(capturedRoutes!==1||capturedOperations!==1)fail('EXACTLY_ONE_REQUEST_CAPTURE_ALLOWED');
  if(r.summary.areaCount!==13||r.summary.routeCount!==r.routes.length||r.summary.atomicOperationCount!==r.operations.length||r.summary.requestCapturedOperationCount!==1||r.summary.authConnectedCount!==0||r.summary.liveReadVerifiedCount!==0||r.summary.sourcePublicationVerifiedCount!==0)fail('SUMMARY_MISMATCH');
  return r;
}
/** Unified lookup for every registered area. Returns an offline plan and gaps;
 * never returns a live-ready badge, credential instruction, or HTTP executor. */
export function planArea(registry:unknown,areaId:string){
  const r=validateRegistry(registry),a=r.areas.find(x=>x.areaId===areaId);
  if(!a)return {status:'unknown_area' as const,areaId,networkExecutionAllowed:false as const};
  return {status:'registered_not_connected' as const,area:a,routes:r.routes.filter(x=>a.routeIds.includes(x.routeId)),operations:r.operations.filter(x=>a.operationIds.includes(x.operationId)),networkExecutionAllowed:false as const,missing:a.minimalGaps};
}
