import {z} from 'zod';
import {LocalDate} from './operational-makeup.ts';
import {Instant} from './ids.ts';

const Notice=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('unknown')}),
 z.strictObject({state:z.literal('not_received')}),
 z.strictObject({state:z.literal('guardian_notice'),receivedOn:LocalDate})
]);
/** A policy eligibility aid; it neither invalidates an existing plan nor proves attendance. */
export function assessNewMakeupEligibility(absenceInput:unknown,noticeInput:unknown){
 const absence=LocalDate.parse(absenceInput),notice=Notice.parse(noticeInput);
 return {eligibility:notice.state==='unknown'?'unknown' as const:notice.state==='not_received'||notice.receivedOn>=absence?'ineligible' as const:'eligible' as const,existingPlansRevalidated:false as const,executionProven:false as const};
}
export function makeupContactGuidance(receivedDateInput:unknown){return {anchorDate:LocalDate.parse(receivedDateInput),suggestedOffsetsDays:[0,2,3] as const,hardDeadline:null,strength:'soft_guidance' as const};}
export const WithdrawalDuration=z.strictObject({months:z.number().nonnegative().nullable(),lessonCount:z.number().int().nonnegative().nullable()});
export function withdrawalMonthFromLastActualClass(input:unknown){const date=LocalDate.nullable().parse(input);return date===null?null:date.slice(0,7);}
/** This decoder is deliberately scoped to one meaning in one roster column. */
export function decodeWithdrawalBriefingMarker(scopeInput:unknown,valueInput:unknown){
 z.strictObject({sheet:z.literal('withdrawal_roster'),column:z.literal('I'),meaning:z.literal('briefing_attendance')}).parse(scopeInput);
 const value=z.union([z.string(),z.literal(0),z.null()]).parse(valueInput);
 return {state:value===null||value===''?'unknown' as const:value==='O'||value==='0'||value===0?'attends_briefing' as const:'unrecognized' as const,provesPastEventCompletion:false as const};
}
const ReportState=z.enum(['not_checked','reported_done']);
export function summarizeBookIssueResponsibilities(input:unknown){
 const value=z.strictObject({physicalHandoff:ReportState,managerLineReport:ReportState,managerLedger:ReportState}).parse(input);
 return {teacherDutyReportedComplete:value.physicalHandoff==='reported_done'&&value.managerLineReport==='reported_done',managerLedger:value.managerLedger,liveDeliveryVerified:false as const};
}
export function prepareWithdrawalArtifactStatus(input:unknown){
 const value=z.strictObject({viceDirectorNotified:ReportState,rosterEntry:ReportState,reasonFormSubmission:ReportState,orderEvidence:z.strictObject({kind:z.literal('teacher_reported_times'),notificationAt:Instant,rosterEntryAt:Instant}).nullable()}).parse(input);
 if(value.rosterEntry==='reported_done'&&value.viceDirectorNotified!=='reported_done')throw Error('vice_director_notice_required_before_roster_entry');
 if(value.rosterEntry==='reported_done'&&(!value.orderEvidence||Date.parse(value.orderEvidence.notificationAt)>=Date.parse(value.orderEvidence.rosterEntryAt)))throw Error('notification_before_roster_entry_order_evidence_required');
 return {...value,reasonFormReportedSubmitted:value.reasonFormSubmission==='reported_done',liveSubmissionVerified:false as const};
}
export function prepareDailyRestudyReview(input:unknown){
 const value=z.strictObject({assessmentKind:z.literal('textbook_daily_restudy_section'),observedErrors:z.enum(['not_checked','none_reported','found']),correctionReported:z.boolean(),recheckReported:z.boolean()}).parse(input);
 if(value.recheckReported&&!value.correctionReported&&value.observedErrors==='found')throw Error('error_correction_required_before_recheck');
 return {readyForTeacherCompletionReview:value.observedErrors!=='not_checked'&&(value.observedErrors==='none_reported'||value.correctionReported&&value.recheckReported),teacherCompletionState:'unknown' as const,wholeConceptMasteryProven:false as const};
}
