/** Versioned, append-only evidence overlay. Never modifies original snapshot IDs or clocks. */
export type ChecklistStatus='pending'|'reported_missing'|'assigned'|'planned'|'completed_user_report';
export interface ChecklistItem {key:string;label:string;status:ChecklistStatus;dueDate:string;eventAt:null;completedAt:null;evidence:'user_report';detail:string;dueDateEvidenceEventId?:string;previousDueDate?:string;scheduleEvidenceEventId?:string;}
export interface HistoryEvent {
 eventId:string;studentId:string;kind:'daily_record'|'result_observation'|'book_plan'|'printing'|'video_plan'|'class_activity'|'instruction_update'|'care_update'|'assignment_due_update';
 source:'lms_observation'|'user_report'; sourceIdentity:string; observedAt:string|null;reportedAt:string|null;
 eventDate:string|null;eventAt:null;bookId:null;sectionId:null;joinState:'pending_exact_identity';
 payload:unknown;supersedes:string[];
}
export interface HistoryBundle {schemaVersion:'academy.history-import/1.0.0';revision:number;previousRevision:number|null;sha256:string;coverage:'partial';events:HistoryEvent[]}
const obj=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateHistory(bundle:HistoryBundle):void {
 if(bundle.schemaVersion!=='academy.history-import/1.0.0'||!Number.isSafeInteger(bundle.revision)||bundle.revision<1||!Array.isArray(bundle.events)||!/^[a-f0-9]{64}$/.test(bundle.sha256)||bundle.coverage!=='partial')throw Error('invalid_history_bundle');
 const ids=new Set<string>();
 for(const e of bundle.events){
  if(ids.has(e.eventId)||!/^hist_[a-f0-9]{64}$/.test(e.eventId)||!/^stu_[a-f0-9]{32}$/.test(e.studentId)||!e.sourceIdentity||e.bookId!==null||e.sectionId!==null||e.eventAt!==null||e.joinState!=='pending_exact_identity'||!Array.isArray(e.supersedes))throw Error('invalid_history_event');
  if(!['daily_record','result_observation','book_plan','printing','video_plan','class_activity','instruction_update','care_update','assignment_due_update'].includes(e.kind)||!['lms_observation','user_report'].includes(e.source))throw Error('invalid_history_type');
  for(const t of [e.observedAt,e.reportedAt])if(t!==null&&(!/^\d{4}-\d\d-\d\dT/.test(t)||!Number.isFinite(Date.parse(t))))throw Error('invalid_history_clock');
  if(e.source==='lms_observation'&&!e.observedAt||e.source==='user_report'&&e.observedAt!==null)throw Error('invalid_history_provenance');
  if(e.kind==='daily_record'){
   const p=e.payload as any,o=p?.payload?.observation,a=o?.assignment;
   if(!obj(p)||p.studentId!==e.studentId||o?.studentId!==e.studentId||!a||!/^\d{4}-\d\d-\d\d$/.test(a.dueDate)||typeof a.text!=='string'||!['월수','월금','월수금'].includes(o.classPattern)||![1,2].includes(o.session)||o.membershipEvidence!=='user_confirmed')throw Error('invalid_daily_capture');
  }
  if(e.kind==='assignment_due_update'){
   const p=e.payload as any,previous=bundle.events.find(x=>x.eventId===p?.replacesAssignmentFrom);
   if(!p||!previous||!ids.has(previous.eventId)||previous.kind!=='care_update'||previous.studentId!==e.studentId||p.previousDueDate!==(previous.payload as any).newAssignment.dueDate||!/^\d{4}-\d\d-\d\d$/.test(p.dueDate))throw Error('invalid_due_correction');
  }
  if(e.kind==='care_update'){
   const p=e.payload as any;
   if(e.source!=='user_report'||!obj(p)||!Array.isArray(p.checklist)||p.checklist.length>30||!p.newAssignment||p.newAssignment.completion!=='unknown'||typeof p.newAssignment.text!=='string'||!/^\d{4}-\d\d-\d\d$/.test(p.newAssignment.dueDate))throw Error('invalid_care_update');
   const keys=new Set();for(const c of p.checklist){if(!c||typeof c.key!=='string'||keys.has(c.key)||typeof c.label!=='string'||typeof c.detail!=='string'||!['pending','reported_missing','assigned','planned','completed_user_report'].includes(c.status)||c.completedAt!==null||c.eventAt!==null||c.evidence!=='user_report'||!/^\d{4}-\d\d-\d\d$/.test(c.dueDate))throw Error('invalid_checklist');keys.add(c.key);}
  }
  for(const id of e.supersedes){const previous=bundle.events.find(x=>x.eventId===id);if(!previous||!ids.has(id)||previous.studentId!==e.studentId||e.kind!=='care_update'||previous.kind!=='video_plan')throw Error('invalid_supersession');}
  ids.add(e.eventId);
 }
}
export function mergeHistory(previous:HistoryBundle,next:HistoryBundle):HistoryBundle {
 validateHistory(previous);validateHistory(next);
 if(next.previousRevision!==previous.revision||next.revision!==previous.revision+1)throw Error('history_revision_conflict');
 for(const old of previous.events){const found=next.events.find(e=>e.eventId===old.eventId);if(!found||JSON.stringify(found)!==JSON.stringify(old))throw Error('history_evidence_changed_or_removed');}
 return next;
}
export function projectHistory(read:any,args:any,bundle:HistoryBundle,authorizedStudentIds?:string[]):any {
 validateHistory(bundle);
 const roster=authorizedStudentIds??read.managedStudents?.map((s:any)=>s.studentId)??(read.student?.studentId?[read.student.studentId]:[]);
 const events=bundle.events.filter(e=>roster.includes(e.studentId));
 if(!events.length)return read;
 const supersededIds=new Set(events.flatMap(e=>e.supersedes));const activeEvents=events.filter(e=>!supersededIds.has(e.eventId));
 const effectiveChecklist=(e:HistoryEvent)=>{
  const p=e.payload as any,c=activeEvents.find(x=>x.kind==='assignment_due_update'&&(x.payload as any).replacesAssignmentFrom===e.eventId);
  return p.checklist.map((item:any)=>item.key==='notes_assignment'&&c?{...item,dueDate:(c.payload as any).dueDate,dueDateEvidenceEventId:c.eventId,previousDueDate:item.dueDate}:item.key==='attendance'&&c?{...item,detail:'사용자 보고; 별도 보강 일정은 기한 정정 근거에서 확인됨',scheduleEvidenceEventId:c.eventId}:item);
 };
 const presentation=(e:HistoryEvent)=>e.kind==='care_update'?{...e,effectiveChecklist:effectiveChecklist(e)}:e;
 const receipt={latestObservedAt:events.map(e=>e.observedAt).filter((x):x is string=>!!x).sort().at(-1)??null,latestReportedAt:events.map(e=>e.reportedAt).filter((x):x is string=>!!x).sort().at(-1)??null,sourceAsOf:null,originalSnapshotUnchanged:true,schemaVersion:bundle.schemaVersion,revision:bundle.revision,sha256:bundle.sha256,coverage:'partial',liveRefreshConnected:false,entireStudentHistoryComplete:false};
 if(read.kind==='source_freshness')return {...read,historyImport:receipt,preservedSources:events.map(e=>({eventId:e.eventId,studentId:e.studentId,kind:e.kind,source:e.source,observedAt:e.observedAt,reportedAt:e.reportedAt,eventDate:e.eventDate,sourceAsOf:null})),latestObservationIsNotFullRefresh:true};
 if(read.kind==='daily_preparation'){
  const captures=events.filter(e=>e.kind==='daily_record').filter(e=>(e.payload as any).payload.observation.assignment.dueDate===read.requestedDate);
  const requested=read.sessions.map((s:any)=>Number(s.session));
  const relevant=captures.filter(e=>requested.includes((e.payload as any).payload.observation.session));
  if(!relevant.length)return {...read,historyImport:receipt};
  const tasks=relevant.map(e=>{const o=(e.payload as any).payload.observation;return {taskId:e.eventId,studentId:e.studentId,displayName:o.name,session:o.session,assignment:o.assignment,source:'preserved_lms_observation',observedAt:e.observedAt,completion:'unknown',teacherDecision:null,bookId:null,sectionId:null,joinState:e.joinState,observations:o.observations??[],carryForward:o.carryForward??[],relatedUserReports:activeEvents.filter(x=>x.studentId===e.studentId&&x.source==='user_report'&&x.eventDate===read.requestedDate).map(presentation)};});
  return {...read,historyImport:receipt,current:{state:'preserved_partial_evidence',tasks,reason:'VERIFIED_PRESERVED_CAPTURE_NOT_LIVE_QUERY'},sessions:read.sessions.map((s:any)=>({...s,mappingState:'user_confirmed_for_captured_students',studentIds:tasks.filter(t=>String(t.session)===s.session).map(t=>t.studentId),tasks:tasks.filter(t=>String(t.session)===s.session),reason:'PARTIAL_CAPTURE_NOT_COMPLETE_CLASS_ROSTER'})),unverified:[{code:'LIVE_ADAPTER_NOT_CONNECTED'},{code:'BOOK_SECTION_IDENTITY_PENDING'},{code:'CLASS_AND_HOMEWORK_COVERAGE_PARTIAL'}],taskCount:tasks.length,emptyMeansNoTasks:false};
 }
 if(read.kind==='student_detail'&&!args.recordId){
  const daily=events.filter(e=>e.kind==='daily_record');const updates=activeEvents.filter(e=>e.kind==='care_update');
  return {...read,historyImport:receipt,historical:{...read.historical,assignments:[...read.historical.assignments,...daily.map(e=>({historyEventId:e.eventId,...(e.payload as any).payload.observation.assignment,source:'preserved_lms_observation',observedAt:e.observedAt,bookId:null,sectionId:null,teacherDecision:null}))],dailyRecords:[...read.historical.dailyRecords,...daily.map(e=>({sourceDiaryId:null,historyEventId:e.eventId,eventDate:e.eventDate,homeworkSummary:(e.payload as any).payload.observation.assignment.text,observedAt:e.observedAt,source:'preserved_lms_observation',nativeIdentityVerified:false}))],preservedHistory:events,currentUserReports:activeEvents.filter(e=>e.source==='user_report').map(presentation),supersededEventIds:[...supersededIds],upcomingAssignments:updates.map(e=>({historyEventId:e.eventId,...(e.payload as any).newAssignment,dueDate:effectiveChecklist(e).find((c:any)=>c.key==='notes_assignment').dueDate,source:'user_report',bookId:null,sectionId:null,teacherCompletedAt:null})),checklist:updates.flatMap(e=>effectiveChecklist(e).map((c:any)=>({...c,evidenceEventId:e.eventId,reportedAt:e.reportedAt}))),sectionJoinAttempted:false}};
 }
 return {...read,historyImport:receipt};
}
