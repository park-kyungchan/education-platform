/** Read models are projections, never new observations or teacher decisions.
 * Event, reported, observed, captured and build clocks remain independent.
 * The unpublished typed-core candidate's explicit-current-ID and clock
 * preservation rules are retained without importing its deployment stub. */
export const ACADEMY_READ_VERSION='academy.read/1.0.0';
export const ACADEMY_TIMEZONE='Asia/Seoul';
export class AcademyReadError extends Error {
  status:number;code:string;
  constructor(status:number,code:string){super(code);this.status=status;this.code=code;}
}
export type ReadOperation='today'|'student-detail'|'source-freshness';
export interface ReadArguments {date?:string;session?:'all'|'1'|'2';studentId?:string;recordId?:string;offset?:number;limit?:number;}
const object=(value:unknown):value is Record<string,any>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown)=>typeof value==='string'?value:null;
const array=(value:unknown):any[]=>Array.isArray(value)?value:[];
export function academyDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:ACADEMY_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function parseReadArguments(operation:ReadOperation,input:unknown):ReadArguments{
  if(!object(input))throw new AcademyReadError(400,'invalid_arguments');
  const allowed=operation==='today'?['date','session']:operation==='student-detail'?['studentId','recordId','offset','limit']:['studentId'];
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw new AcademyReadError(400,'invalid_arguments');
  for(const key of ['studentId','recordId'])if(key in input&&(typeof input[key]!=='string'||input[key].length===0||input[key].length>512))throw new AcademyReadError(400,'invalid_arguments');
  if(operation==='student-detail'&&!input.studentId)throw new AcademyReadError(400,'student_id_required');
  if('date'in input&&(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date+'T00:00:00Z'))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date))throw new AcademyReadError(400,'invalid_date');
  if('session'in input&&!['all','1','2'].includes(input.session))throw new AcademyReadError(400,'invalid_session');
  if('offset'in input&&(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>10000))throw new AcademyReadError(400,'invalid_offset');
  if('limit'in input&&(!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>20))throw new AcademyReadError(400,'invalid_limit');
  if(input.recordId&&('offset'in input||'limit'in input))throw new AcademyReadError(400,'record_and_page_are_mutually_exclusive');
  return {...input};
}
export function assertSavedRead(result:any,expectedStudentId?:string){
  if(!object(result)||result.status!=='success'||typeof result.studentId!=='string'||result.selectedStudent?.id!==result.studentId||result.scope?.studentId!==result.studentId||(expectedStudentId!==undefined&&result.studentId!==expectedStudentId)||!object(result.snapshot)||!object(result.gradingProjection?.view)||!object(result.evidenceProjection)||!object(result.assessmentProjection)||!Array.isArray(result.meta?.students)||!result.meta.students.some((s:any)=>s.id===result.studentId&&s.managementState==='active')||result.meta.sourceMode!=='saved_snapshot'||result.meta.liveRefreshConnected!==false||result.verification?.contextGatePassed!==true||result.verification?.navigationGatePassed!==true||result.verification?.authenticatedOwnerPrivateDispatch!==true||result.verification?.externalSourceQueried!==false||result.receipt?.runtimeReceipt!==true||result.receipt?.loadStatus!=='verified'||result.navigationReceipt?.runtimeReceipt!==true||result.navigationReceipt?.loadStatus!=='verified')throw new AcademyReadError(503,'verified_saved_scope_required');
  if(result.evidenceProjection.studentId!==result.studentId||result.assessmentProjection.studentId!==result.studentId)throw new AcademyReadError(503,'projection_student_scope_mismatch');
  return result;
}
export function assertSavedIndex(result:any){
  if(!object(result)||result.status!=='success'||result.kind!=='saved_navigation_index'||!Array.isArray(result.meta?.students)||result.meta.sourceMode!=='saved_snapshot'||result.meta.liveRefreshConnected!==false||result.verification?.contextGatePassed!==true||result.verification?.navigationGatePassed!==true||result.verification?.authenticatedOwnerPrivateDispatch!==true||result.verification?.externalSourceQueried!==false||result.receipt?.runtimeReceipt!==true||result.receipt?.loadStatus!=='verified'||result.navigationReceipt?.runtimeReceipt!==true||result.navigationReceipt?.loadStatus!=='verified')throw new AcademyReadError(503,'verified_saved_index_required');
  return result;
}
function common(result:any){return {schemaVersion:ACADEMY_READ_VERSION,domain:'academy',sourceMode:'saved_snapshot',liveRefreshConnected:false,externalSourceQueried:false,bundleBuiltAt:text(result.meta.bundleBuiltAt),sourceAsOf:null,queriedAt:null,lastSuccessfulRefreshedAt:null,rosterRevision:result.meta.rosterRevision,registrySha256:result.meta.registrySha256,coverage:{state:'unverified_for_requested_date',entireStudentHistoryComplete:false,absenceProvesMissingHomework:false},domainBoundary:{included:'academy',otherDomainsIncluded:false}};}
function evidenceReference(e:any){return {evidenceId:text(e.evidenceId),sourceKind:text(e.sourceKind),verificationStatus:text(e.verificationStatus),sourceRef:e.sourceRef??null,reportedAt:e.reportedAt??null,observedAt:e.observedAt??null,capturedAt:e.capturedAt??null,recordedAt:e.recordedAt??null,timeRaw:e.timeRaw??null,revision:e.revision??null,supersedesEvidenceIds:array(e.supersedesEvidenceIds),retractsEvidenceIds:array(e.retractsEvidenceIds),conflictingEvidenceIds:array(e.conflictingEvidenceIds)};}
function decisionView(projection:any){
  const all=array(projection.decisionRecords),explicit=Array.isArray(projection.currentDecisionIds)?projection.currentDecisionIds:null;
  const byId=new Map(all.map(d=>[d.decisionId,d]));
  if(explicit&&(new Set(explicit).size!==explicit.length||explicit.some((id:any)=>!byId.has(id))))throw new AcademyReadError(503,'invalid_current_decision_references');
  return {selection:explicit?'explicit_ids':'current_not_declared',current:explicit?explicit.map((id:any)=>byId.get(id)):[],history:all,clockOrderingUsedToInferCurrent:false};
}
export function buildToday(result:any,args:ReadArguments={},now=new Date()){
  if(result?.kind==='saved_navigation_index')assertSavedIndex(result);else assertSavedRead(result);const date=args.date??academyDate(now),sessions=args.session&&args.session!=='all'?[args.session]:['1','2'];
  // No date/session-bound DailyRecord exists in this saved-source contract.
  // An empty list is deliberately not a verified empty class or task list.
  return {...common(result),requestedDate:date,timezone:ACADEMY_TIMEZONE,kind:'daily_preparation',current:{state:'unverified',tasks:[],reason:'NO_VERIFIED_DATE_SESSION_DAILY_RECORD'},sessions:sessions.map(session=>({session,label:session+'부',mappingState:'unverified',studentIds:[],tasks:[],reason:'NO_VERIFIED_DATE_SESSION_MAPPING'})),historical:{state:'saved_evidence_available_on_student_request',detailTool:'academy_student_detail',treatedAsToday:false},unverified:[{code:'LIVE_ADAPTER_NOT_CONNECTED',message:'현재 학원 자료를 새로 조회하지 않았습니다.'},{code:'DAILY_RECORD_DATE_NOT_VERIFIED',message:'요청 날짜의 DailyRecord 근거가 확인되지 않았습니다.'},{code:'SESSION_MAPPING_NOT_VERIFIED',message:'요청 날짜의 1·2부 학생 배정은 확인되지 않았습니다.'}],conflicts:{state:'not_evaluated_for_requested_date',items:[]},managedStudents:result.meta.students.filter((s:any)=>s.managementState==='active').map((s:any)=>({studentId:s.id,displayName:s.displayName,session:null})),taskCount:null,emptyMeansNoTasks:false};
}
export function buildSourceFreshness(result:any,args:ReadArguments={}){
  if(args.studentId||result?.kind!=='saved_navigation_index')assertSavedRead(result,args.studentId);else assertSavedIndex(result);const selected=Boolean(args.studentId);
  return {...common(result),kind:'source_freshness',scope:selected?'selected_student':'site_saved_bundle',studentId:selected?result.studentId:null,status:'live_not_connected',lastBackendAttemptAt:null,backendAttemptStarted:false,reason:'LIVE_ADAPTER_NOT_CONNECTED',sources:selected?array(result.snapshot.sourceCoverage).map(s=>({module:text(s.module),sourceAsOf:s.sourceAsOf??null,completeness:text(s.completeness),queryScope:text(s.queryScope),queriedAt:null,lastSuccessfulRefreshedAt:null})):[],buildTimeIsNotSourceTime:true};
}
export function buildStudentDetail(result:any,args:ReadArguments){
  assertSavedRead(result,args.studentId);const projection=result.evidenceProjection,view=result.gradingProjection.view,records=object(view.records)?view.records:{},ids=Object.keys(records),offset=args.offset??0,limit=args.limit??10;
  if(args.recordId&&!Object.hasOwn(records,args.recordId))throw new AcademyReadError(404,'record_outside_selected_student');
  const selectedIds=args.recordId?[args.recordId]:ids.slice(offset,offset+limit);
  const evidence=array(projection.evidenceRecords),decisions=decisionView(projection),selectedEvidenceIds=new Set(selectedIds.flatMap(id=>array(projection.recordEvidenceIds?.[id])));
  const selectedEvidence=evidence.filter(e=>selectedEvidenceIds.has(e.evidenceId));
  const selectedDecisions=(items:any[])=>items.filter(d=>array(d.targetEntityIds).some(id=>selectedIds.includes(id)));
  const unboundEvidence=evidence.filter(e=>array(projection.unboundEvidenceIds).includes(e.evidenceId));
  const unboundDecisions=array(projection.decisionRecords).filter(d=>array(projection.unboundDecisionIds).includes(d.decisionId));
  const unresolvedAttempts=array(result.snapshot.unresolvedAttempts);
  const page=(items:any[])=>args.recordId?{state:'not_requested',items:[],nextOffset:null}:{state:'saved_scope',items:items.slice(offset,offset+limit),nextOffset:offset+limit<items.length?offset+limit:null};
  const conflicts=evidence.filter(e=>e.verificationStatus==='contradicted'||array(e.conflictingEvidenceIds).length).map(e=>evidenceReference(e));
  return {...common(result),kind:'student_detail',student:{studentId:result.studentId,displayName:result.meta.students.find((s:any)=>s.id===result.studentId)?.displayName??null,sourcePageId:result.selectedStudent.pageId??null},sourceRevision:result.scope.projectionSha256??result.meta.snapshotProjectionSha256?.[result.studentId]??null,sourceRevisionMeaning:'original_saved_snapshot_only',revisions:{snapshot:result.scope.projectionSha256??null,teacherOverlay:result.scope.teacherOverlayProjectionSha256??null,teacherOverlayRevision:result.scope.sourceRevisions?.teacherOverlayRevision??null,grading:result.scope.gradingProjectionSha256??null,evidence:result.scope.evidenceProjectionSha256??null,assessment:result.scope.assessmentProjectionSha256??null,domainContract:result.meta.domainContractSha256??null,assessmentContract:result.meta.assessmentContractSha256??null},current:{state:'unverified',tasks:[],reason:'NO_CURRENT_DAILY_RECORD_QUERY'},historical:{sourceMode:'saved_snapshot',eventYearMayBeUnknown:true,unboundEvidence:page(unboundEvidence.map(e=>({...evidenceReference(e),claim:e.claim}))),unboundDecisions:page(unboundDecisions),unresolvedAttempts:page(unresolvedAttempts),unboundLookup:'Omit recordId and use offset/limit; these saved items are not assigned to a book section.',books:array(view.books).map(b=>({bookId:b.key,title:b.label})),assignments:array(projection.assignments),dailyRecords:args.recordId?[]:array(result.assessmentProjection.diaryEvidence).map(row=>({sourceDiaryId:row.sourceDiaryId,dateRaw:row.evidence?.claim?.value?.dateRaw??null,yearStatus:row.evidence?.claim?.value?.yearStatus??'unknown',progressSummary:row.evidence?.claim?.value?.progressSummary??null,homeworkSummary:row.evidence?.claim?.value?.homeworkSummary??null,evidence:row.evidence?evidenceReference(row.evidence):null,currentDateMatchVerified:false})),records:selectedIds.map(id=>{const r=records[id];return args.recordId?{recordId:id,sectionLabel:r.sectionDisplayLabel,unitLabel:r.unitLabel,unitTitle:r.unitTitle,catalogCode:r.catalogCode??null,performanceState:r.performanceState??r.evidenceState??null,mappingState:r.mappingState??null,attemptEvidence:array(r.attemptEvidence),teacherVerdict:r.teacherVerdict??null,paperEvidence:r.paperEvidence??null,progressDecision:r.progressDecision??null,diaryAssertions:array(r.diaryAssertions),sourceUrls:array(r.sourceUrls)}:{recordId:id,sectionLabel:r.sectionDisplayLabel,unitLabel:r.unitLabel,unitTitle:r.unitTitle,performanceState:r.performanceState??r.evidenceState??null};}),pagination:args.recordId?null:{offset,limit,nextOffset:offset+limit<ids.length?offset+limit:null},evidence:selectedEvidence.map(e=>({...evidenceReference(e),claim:e.claim})),decisions:{selection:decisions.selection,current:selectedDecisions(decisions.current),history:selectedDecisions(decisions.history),clockOrderingUsedToInferCurrent:false},reviewPolicy:projection.reviewPolicy??null,reviewCheckpointElapsedIsNotMissingEvidence:true},unverified:[{code:'LIVE_ADAPTER_NOT_CONNECTED'},{code:'CURRENT_DATE_AND_SESSION_NOT_VERIFIED'}],conflicts:{state:'explicit_saved_relations_only',evidence:conflicts,decisions:array(projection.decisionRecords).filter(d=>d.decisionStatus==='conflicted'),absenceOfListedConflictsProvesConsistency:false},freshness:buildSourceFreshness(result,{studentId:result.studentId})};
}
