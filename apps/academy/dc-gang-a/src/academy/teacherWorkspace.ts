import {assertDate,assertExactKeys,assertInstant,assertRefs,canonicalJson,requireText} from '../learning/model';
import {validateSourceKey,type SourceKey} from './domain';
import type {LearningWorkAssignment} from './learningWork';

interface WorkspaceBase {studentBinding:{studentId:string;sourceStudent:SourceKey};sourceStudent:SourceKey;reportedAt:string;evidenceRevisionIds:string[]}
/** Teacher-reported stages remain independent; a local final is never app grading or a whole-book conclusion. */
export interface TeacherActivityReview extends WorkspaceBase {
 kind:'teacher_activity_review';assignmentRevisionId:string;selectedItemIds:string[];coverage:'known_subset'|'unknown_subset'|'whole_assigned_items';
 originalScore:number|null;originalWrong:'unknown'|'potentially_applicable'|'not_applicable';similarPrinted:'unknown'|'not_printed'|'printed';similar:'unknown'|'applicable'|'not_applicable';
 appEntry:'unknown'|'not_entered'|'entered'|'graded';
 paper:{issuance:LearningWorkAssignment['paper'];corrections:{assignedItemId:string;state:'unknown'|'needs_correction'|'corrected'|'teacher_reviewed'}[]};
 video:{upload:'unknown'|'not_uploaded'|'uploaded';reference:string;review:'not_reviewed'|'supplement_requested'|'reviewed';note:string};
 mindmap:{state:'not_requested'|'requested'|'prepared'|'reviewed';note:string;explanation:{assignmentRevisionId:string;eventRef:string;mode:'board'|'oral'}|null};
 final:{decision:'pending'|'accepted'|'reopen';checkedSolutionAndUnderstanding:boolean;note:string};
}
export interface ParentDraftLine {text:string;evidenceRevisionIds:string[]}
/** This local parent projection never overwrites an official document or records a transmission. */
export interface TeacherParentDraft extends WorkspaceBase {
 kind:'teacher_parent_draft';date:string;state:'draft'|'reviewed';progress:ParentDraftLine[];homework:ParentDraftLine[];memo:ParentDraftLine[];
 internalNote:string;teacherReviewed:boolean;officialSaved:false;parentSent:false;deliveryReceipt:'unobserved';
}
export const operationalCaseKinds=['counseling','cism','makeup','onboarding','withdrawal','materials','forms'] as const;
export interface TeacherOperationalCase {
 reportedAt:string;evidenceRevisionIds:string[];studentBinding:{studentId:string;sourceStudent:SourceKey}|null;
 kind:'teacher_operational_case';caseId:string;category:typeof operationalCaseKinds[number];policyIds:string[];policyRevision:string;
 title:string;state:'open'|'prepared'|'awaiting_human'|'locally_closed'|'reopened';note:string;
 checklist:{stepId:string;state:'not_checked'|'prepared'|'human_reported_done';note:string}[];
 actualAssignmentConfirmed:boolean;roleBoundaryAcknowledged:boolean;completionNote:string;
 executed:false;transmitted:false;received:false;officialSaved:false;
}
export type TeacherWorkspaceRecord=TeacherActivityReview|TeacherParentDraft;
export interface TeacherWorkspaceInput {studentId:string;expectedRevisionId:string|null;idempotencyKey:string;reportedAt:string;payload:Omit<TeacherActivityReview,'sourceStudent'|'reportedAt'|'studentBinding'>|Omit<TeacherParentDraft,'sourceStudent'|'reportedAt'|'studentBinding'>}
export const isTeacherWorkspaceRecord=(record:{kind:string}):record is TeacherWorkspaceRecord=>['teacher_activity_review','teacher_parent_draft'].includes(record.kind);
const boundedText=(value:unknown,max=16000)=>{if(typeof value!=='string'||value.length>max)throw Error('invalid_workspace_text');};
const member=(value:unknown,choices:readonly string[])=>{if(typeof value!=='string'||!choices.includes(value))throw Error('invalid_workspace_state');};
const refs=(value:unknown,minimum=1)=>{if(!Array.isArray(value)||value.length<minimum||value.length>500||new Set(value).size!==value.length)throw Error('invalid_workspace_references');if(value.length)assertRefs(value);for(const id of value)if(id.length>200)throw Error('invalid_workspace_references');};
/** This explicit exclusion list is a safeguard for a reviewed draft, never a language model or a completeness claim. */
export const parentInternalLanguage=/강사\s*확인|교사\s*확인|교사\s*검토|채점|미실시|미완료|시간\s*부족|확인\s*전|검사.{0,8}미완료|풀이와\s*채점|teacher\s*(?:inspection|review)|ungraded|not\s*completed|insufficient\s*time/i;
export function parentDraftText(draft:Pick<TeacherParentDraft,'progress'|'homework'|'memo'>){return {progress:draft.progress.map(line=>'- '+line.text).join('\n'),homework:draft.homework.map(line=>'- '+line.text).join('\n'),memo:draft.memo.map(line=>'- '+line.text).join('\n')};}
export const originalWrongApplicability=(score:number|null)=>score===100?'not_applicable' as const:score===null?'unknown' as const:'potentially_applicable' as const;
export function teacherActivitySummary(review:TeacherActivityReview){return {learning:review.final.decision==='accepted'?(review.coverage==='whole_assigned_items'?'teacher_finalized_assigned_items':'teacher_finalized_partial'):review.final.decision==='reopen'?'reopened':'unknown',originalWrong:originalWrongApplicability(review.originalScore),similarAssignment:review.similar,similarPrint:review.similarPrinted,appRecord:review.appEntry,mindmapCompletionClaimAllowed:review.mindmap.state==='reviewed'&&!!review.mindmap.explanation&&review.final.decision==='accepted',wholeBookComplete:false as const};}
export function workspaceEntityId(payload:TeacherWorkspaceRecord|TeacherOperationalCase):string {
 if(payload.kind==='teacher_activity_review')return 'teacher-activity-review-'+payload.assignmentRevisionId;
 if(payload.kind==='teacher_parent_draft')return 'teacher-parent-draft-'+payload.date+':'+payload.sourceStudent.namespace+':'+payload.sourceStudent.literalKey;
 return 'teacher-operational-case-'+payload.caseId;
}
export function validateTeacherWorkspace(payload:TeacherWorkspaceRecord|TeacherOperationalCase){
 canonicalJson(payload);if(payload.kind==='teacher_operational_case'){if(payload.studentBinding!==null){assertExactKeys(payload.studentBinding,['studentId','sourceStudent']);requireText(payload.studentBinding.studentId,'student binding');validateSourceKey(payload.studentBinding.sourceStudent);if(payload.studentBinding.sourceStudent.namespace!=='academy_student')throw Error('source_namespace_conflict');}refs(payload.evidenceRevisionIds,0);}else{assertExactKeys(payload.studentBinding,['studentId','sourceStudent']);requireText(payload.studentBinding.studentId,'student binding');if(payload.studentBinding.studentId.length>200||canonicalJson(payload.studentBinding.sourceStudent)!==canonicalJson(payload.sourceStudent))throw Error('workspace_student_binding_conflict');validateSourceKey(payload.sourceStudent);if(payload.sourceStudent.namespace!=='academy_student')throw Error('source_namespace_conflict');refs(payload.evidenceRevisionIds);}assertInstant(payload.reportedAt);
 if(payload.kind==='teacher_activity_review'){
  assertExactKeys(payload,['kind','studentBinding','sourceStudent','reportedAt','evidenceRevisionIds','assignmentRevisionId','selectedItemIds','coverage','originalScore','originalWrong','similarPrinted','similar','appEntry','paper','video','mindmap','final']);
  requireText(payload.assignmentRevisionId,'assignment revision');member(payload.coverage,['known_subset','unknown_subset','whole_assigned_items']);refs(payload.selectedItemIds,payload.coverage==='unknown_subset'?0:1);if(payload.coverage==='unknown_subset'&&payload.selectedItemIds.length)throw Error('invalid_unknown_subset');
  if(payload.originalScore!==null&&(!Number.isFinite(payload.originalScore)||payload.originalScore<0||payload.originalScore>100))throw Error('invalid_activity_score');
  if(payload.originalWrong!==originalWrongApplicability(payload.originalScore))throw Error('original_wrong_applicability_conflict');member(payload.similarPrinted,['unknown','not_printed','printed']);member(payload.similar,['unknown','applicable','not_applicable']);member(payload.appEntry,['unknown','not_entered','entered','graded']);
  assertExactKeys(payload.paper,['issuance','corrections']);if(!Array.isArray(payload.paper.corrections)||payload.paper.corrections.length>500||new Set(payload.paper.corrections.map(item=>item.assignedItemId)).size!==payload.paper.corrections.length)throw Error('invalid_paper_scope');
  for(const item of payload.paper.corrections){assertExactKeys(item,['assignedItemId','state']);if(!payload.selectedItemIds.includes(item.assignedItemId))throw Error('invalid_paper_scope');member(item.state,['unknown','needs_correction','corrected','teacher_reviewed']);}
  assertExactKeys(payload.video,['upload','reference','review','note']);member(payload.video.upload,['unknown','not_uploaded','uploaded']);member(payload.video.review,['not_reviewed','supplement_requested','reviewed']);boundedText(payload.video.reference,1000);boundedText(payload.video.note);
  if(payload.video.upload!=='uploaded'&&(payload.video.review!=='not_reviewed'||payload.video.reference!==''))throw Error('video_upload_review_conflict');
  if(payload.video.upload==='uploaded')requireText(payload.video.reference,'video evidence reference');
  assertExactKeys(payload.mindmap,['state','note','explanation']);if(payload.mindmap.explanation!==null){assertExactKeys(payload.mindmap.explanation,['assignmentRevisionId','eventRef','mode']);requireText(payload.mindmap.explanation.assignmentRevisionId,'concept explanation assignment');requireText(payload.mindmap.explanation.eventRef,'concept explanation event');boundedText(payload.mindmap.explanation.eventRef,1000);member(payload.mindmap.explanation.mode,['board','oral']);if(payload.mindmap.explanation.assignmentRevisionId!==payload.assignmentRevisionId)throw Error('mindmap_activity_scope_conflict');}if(['prepared','reviewed'].includes(payload.mindmap.state)&&payload.mindmap.explanation===null)throw Error('mindmap_explanation_link_required');member(payload.mindmap.state,['not_requested','requested','prepared','reviewed']);boundedText(payload.mindmap.note);
  assertExactKeys(payload.final,['decision','checkedSolutionAndUnderstanding','note']);member(payload.final.decision,['pending','accepted','reopen']);boundedText(payload.final.note);
  if(typeof payload.final.checkedSolutionAndUnderstanding!=='boolean'||payload.final.decision==='accepted'&&(!payload.final.checkedSolutionAndUnderstanding||!payload.final.note.trim()))throw Error('explicit_teacher_understanding_required');
  if(payload.final.decision==='reopen'&&!payload.final.note.trim())throw Error('explicit_reopen_reason_required');return;
 }
 if(payload.kind==='teacher_parent_draft'){
  assertExactKeys(payload,['kind','studentBinding','sourceStudent','reportedAt','evidenceRevisionIds','date','state','progress','homework','memo','internalNote','teacherReviewed','officialSaved','parentSent','deliveryReceipt']);assertDate(payload.date);member(payload.state,['draft','reviewed']);boundedText(payload.internalNote);
  for(const section of [payload.progress,payload.homework,payload.memo]){
   if(!Array.isArray(section)||section.length>100)throw Error('invalid_parent_draft');
   for(const line of section){assertExactKeys(line,['text','evidenceRevisionIds']);boundedText(line.text,2000);requireText(line.text,'parent line');if(/[\r\n]/.test(line.text)||line.text.startsWith('- '))throw Error('parent_line_format');refs(line.evidenceRevisionIds);if(line.evidenceRevisionIds.some(id=>!payload.evidenceRevisionIds.includes(id)))throw Error('parent_line_evidence_conflict');if(parentInternalLanguage.test(line.text))throw Error('parent_internal_language_excluded');}
  }
  if(payload.progress.length+payload.homework.length+payload.memo.length===0||typeof payload.teacherReviewed!=='boolean'||payload.state==='reviewed'&&!payload.teacherReviewed||payload.officialSaved!==false||payload.parentSent!==false||payload.deliveryReceipt!=='unobserved')throw Error('invalid_parent_draft');return;
 }
 if(payload.kind==='teacher_operational_case'){
  assertExactKeys(payload,['kind','studentBinding','reportedAt','evidenceRevisionIds','caseId','category','policyIds','policyRevision','title','state','note','checklist','actualAssignmentConfirmed','roleBoundaryAcknowledged','completionNote','executed','transmitted','received','officialSaved']);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(payload.caseId))throw Error('invalid_operational_case');member(payload.category,operationalCaseKinds);refs(payload.policyIds);if(!/^[0-9a-f]{64}$/.test(payload.policyRevision))throw Error('invalid_operational_revision');
  requireText(payload.title,'case title');boundedText(payload.title,300);boundedText(payload.note);boundedText(payload.completionNote);member(payload.state,['open','prepared','awaiting_human','locally_closed','reopened']);
  if(!Array.isArray(payload.checklist)||payload.checklist.length>500||new Set(payload.checklist.map(step=>step.stepId)).size!==payload.checklist.length)throw Error('invalid_operational_checklist');
  for(const step of payload.checklist){assertExactKeys(step,['stepId','state','note']);requireText(step.stepId,'policy step');member(step.state,['not_checked','prepared','human_reported_done']);boundedText(step.note);}
  if(typeof payload.actualAssignmentConfirmed!=='boolean'||typeof payload.roleBoundaryAcknowledged!=='boolean'||!payload.roleBoundaryAcknowledged||payload.state==='locally_closed'&&!payload.completionNote.trim()||payload.executed!==false||payload.transmitted!==false||payload.received!==false||payload.officialSaved!==false)throw Error('invalid_operational_boundary');return;
 }
 throw Error('unsupported_teacher_workspace');
}
