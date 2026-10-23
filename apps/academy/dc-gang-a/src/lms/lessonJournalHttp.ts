import {assertDate,assertExactKeys,canonicalJson,digest,requireText} from '../learning/model';
import {readLiteralKey,readLiteralName} from './academyReadProtocol';
import {journalWireWidth} from './lessonJournalTemplates';
export const journalHttpFields=['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment'] as const;
export type JournalHttpField=typeof journalHttpFields[number];
/** Current exact field-wire contract; historical source observations do not authorize effects or weaken this qualification. */
export const JOURNAL_HTTP_SOURCE_CONTRACT={
 revision:'2026-10-21-direct-dayrecord-v2',observedOn:'2026-10-21',
 staticWireDigest:'650813891d9428cb03eedb071f5c94bc369fd9641993de6d02ce4e07a5945bd1',
 predecessorRawWireDigest:'c7afa7e2975397c54801af3a417c44caeb7850de70e67a6806f61da8c97d5b4b',
 popupSelection:'One popup source; from its unique empty g_param declaration through the unchanged event-source suffix. No handler body, request or option normalization.',
 digestContent:['inert_handler_definitions','assessment_popup_events','literal_assessment_options'],
 sourceReceipt:'docs/dayrecord-wire-qualification-2026-10-21.json',
 predecessorSourceReceipt:'review/academy-direct-journal-checkpoint-2026-10-06.json',
 assessmentLabels:{
  homework_radio:{'-1':'미확인','0':'미실시','1':'숙제 수행도 C','2':'숙제 수행도 B','3':'숙제 수행도 B⁺','4':'숙제 수행도 A','5':'숙제 수행도 A⁺'},
  daily_test_radio:{'-1':'미확인','0':'미실시','1':'일일 테스트 10점','2':'일일 테스트 20점','3':'일일 테스트 30점','4':'일일 테스트 40점','5':'일일 테스트 50점','6':'일일 테스트 60점','7':'일일 테스트 70점','8':'일일 테스트 80점','9':'일일 테스트 90점','10':'일일 테스트 100점'},
 },
 fields:{
  progress:{method:'GET',path:'/servlet/controller.cct.tutor.DayRecordServlet',selector:'udtPrg',valueParameter:'prg_txt',target:'current_record'},
  homework:{method:'GET',path:'/servlet/controller.cct.tutor.DayRecordServlet',selector:'udtHw',valueParameter:'hw_txt',target:'current_record'},
  lessonMemo:{method:'GET',path:'/servlet/controller.cct.tutor.DayRecordServlet',selector:'udtMemo',valueParameter:'memo_txt',target:'current_record'},
  attendance:{method:'GET',path:'/servlet/controller.cct.tutor.DayRecordServlet',selector:'udtAttn',valueParameter:'attn_yn',target:'current_record'},
  dailyTestAssessment:{method:'POST',path:'/servlet/controller.cct.common.CourseCommonServlet',selector:'SetDailyTest',valueParameter:'daily_test_no',target:'current_record'},
  previousHomeworkAssessment:{method:'POST',path:'/servlet/controller.cct.common.CourseCommonServlet',selector:'SetHomeWorkRate',valueParameter:'homework_rate_no',target:'independently_selected_previous_record'},
 },
 targetChecks:['authenticated_teacher_principal','qualified_date_group_header_and_passive_tuples','independent_selected_current_record','current_DT_tuple','independent_selected_previous_record'],
 readback:'new_direct_HTTP_Main_and_selected_occurrence; exact field plus unchanged-field preservation; not browser UI echo or causal proof',
 scope:'Six explicitly approved fields only; no persistent memo, unit selection, generation, printing, finalization or sender',
} as const;
/** The collector's preceding context can contain unrelated bfcache handlers. Retain the
 * entire request-parameter declaration and popup event suffix, plus every full handler
 * and literal option. Unknown/ambiguous popup sources remain refused. */
export function journalWireDigest(wire:{functions:Record<string,string>;popupEvents:string[];assessmentOptions:{field:string;value:string;label:string}[]}){
 if(wire.popupEvents.length!==1)throw Error('journal_popup_source_ambiguous');
 const source=wire.popupEvents[0]!;
 const declarations=[...source.matchAll(/(?:^|\n)[\t ]*var g_param\s*=\s*""\s*;/g)];
 if(declarations.length!==1)throw Error('journal_popup_source_ambiguous');
 return digest({functions:wire.functions,popupEvents:[source.slice(declarations[0]!.index).trimStart()],assessmentOptions:wire.assessmentOptions});
}
export function assertJournalWireQualified(wireDigest:string){if(wireDigest!==JOURNAL_HTTP_SOURCE_CONTRACT.staticWireDigest)throw Error('journal_mutation_wire_not_qualified');}
export function assertJournalAssessmentOptions(options:{field:string;value:string;label:string}[]){
 const expected=Object.entries(JOURNAL_HTTP_SOURCE_CONTRACT.assessmentLabels).flatMap(([field,values])=>Object.entries(values).map(([value,label])=>({field,value,label})));
 const sort=(rows:{field:string;value:string;label:string}[])=>[...rows].sort((a,b)=>(a.field+':'+a.value).localeCompare(b.field+':'+b.value));
 if(canonicalJson(sort(options))!==canonicalJson(sort(expected)))throw Error('journal_assessment_options_drift');
}
export interface JournalHttpTarget {studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string}
export interface JournalHttpState {target:JournalHttpTarget;fields:Record<string,string>;previousRecordKey:string;previousDate:string;wireDigest:string}
export interface JournalHttpAction {attemptId:string;target:JournalHttpTarget;field:JournalHttpField;effectRecordKey:string;before:string;after:string;wireDigest:string}
export interface JournalHttpAdmission {
  /** Host integration retrieves the actual current teacher decision and durably consumes this exact action before dispatch. Caller flags are not authority. */
  consumeApproval:(action:Readonly<JournalHttpAction>)=>Promise<{status:'verified';actionDigest:string}|{status:'rejected'}>;
}
export interface JournalHttpPort extends JournalHttpAdmission {read:(target:JournalHttpTarget)=>Promise<JournalHttpState>;write:(action:JournalHttpAction)=>Promise<void>}
function target(value:JournalHttpTarget){assertExactKeys(value,['studentName','date','groupId','teacherKey','studentKey','courseKey','recordKey','membershipKey']);readLiteralName(value.studentName);assertDate(value.date);for(const key of ['groupId','teacherKey','studentKey','courseKey','recordKey','membershipKey'] as const)readLiteralKey(value[key]);}
export function validateJournalHttpAction(action:JournalHttpAction){
  assertExactKeys(action,['attemptId','target','field','effectRecordKey','before','after','wireDigest']);requireText(action.attemptId,'attempt');if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(action.attemptId))throw Error('journal_http_attempt_rejected');target(action.target);readLiteralKey(action.effectRecordKey);
  if(!journalHttpFields.includes(action.field)||typeof action.before!=='string'||typeof action.after!=='string'||! /^[a-f0-9]{64}$/.test(action.wireDigest))throw Error('journal_http_action_rejected');
  if(['progress','homework','lessonMemo'].includes(action.field)&&journalWireWidth(action.after)>400)throw Error('journal_http_text_too_long');
  if(action.field==='attendance'&&!['Y','N','L',' ',''].includes(action.after))throw Error('journal_http_attendance_rejected');
  if(action.field==='dailyTestAssessment'&&!['-1','0','1','2','3','4','5','6','7','8','9','10'].includes(action.after))throw Error('journal_http_daily_scale_rejected');
  if(action.field==='previousHomeworkAssessment'&&!['-1','0','1','2','3','4','5'].includes(action.after))throw Error('journal_http_homework_scale_rejected');
}
export function journalHttpActionDigest(action:JournalHttpAction){validateJournalHttpAction(action);return digest(action);}
/** Stable consumption identity; caller-selected result directories cannot renew an approval. */
export function journalApprovalReceiptName(sessionId:string,messageId:number,actionDigest:string){
  if(typeof sessionId!=='string'||!/^\d{8}_\d{6}_[a-f0-9]{6}$/.test(sessionId)||!Number.isSafeInteger(messageId)||messageId<1||! /^[a-f0-9]{64}$/.test(actionDigest))throw Error('native_journal_receipt_identity_rejected');
  return `journal-approval-${sessionId}-${messageId}-${actionDigest}.json`;
}
/** Validates the actual native result retrieved by the effect owner, not a caller approval flag. */
export function acceptNativeJournalDecision(value:unknown,reviewDigest:string):boolean{
  if(!/^[a-f0-9]{64}$/.test(reviewDigest)||!value||typeof value!=='object'||Array.isArray(value))return false;
  const decision=value as {outcome?:unknown;responses?:unknown};if(decision.outcome!=='submitted'||!Array.isArray(decision.responses))return false;
  const marker='[review:'+reviewDigest+']';
  const matches=decision.responses.filter(r=>r&&typeof r==='object'&&!Array.isArray(r)&&typeof r.question==='string'&&r.question.split(marker).length===2);
  return matches.length===1&&matches[0].status==='answered'&&matches[0].user_response==='표시된 일지 입력을 승인합니다. 전송은 직접 합니다.';
}
function verifiedState(action:JournalHttpAction,state:JournalHttpState){
  assertExactKeys(state,['target','fields','previousRecordKey','previousDate','wireDigest']);target(state.target);
  if(canonicalJson(state.target)!==canonicalJson(action.target)||state.wireDigest!==action.wireDigest)throw Error('journal_http_source_drift');
  const expectedRecord=action.field==='previousHomeworkAssessment'?state.previousRecordKey:state.target.recordKey;
  if(action.effectRecordKey!==expectedRecord)throw Error('journal_http_effect_record_conflict');
  if(action.field==='previousHomeworkAssessment'){assertDate(state.previousDate);readLiteralKey(state.previousRecordKey);if(state.previousDate>=state.target.date||state.previousRecordKey===state.target.recordKey)throw Error('journal_http_previous_occurrence_unverified');}
  if(typeof state.fields[action.field]!=='string')throw Error('journal_http_before_unknown');
}
/** One action, no retry/rollback. Fresh authoritative values are evidence, not server CAS or causal proof. */
export async function applyJournalHttpAction(input:JournalHttpAction,port:JournalHttpPort){
  validateJournalHttpAction(input);const action=structuredClone(input);Object.freeze(action.target);Object.freeze(action);
  if(!port||typeof port.consumeApproval!=='function'||typeof port.read!=='function'||typeof port.write!=='function')throw Error('journal_http_trusted_admission_required');
  const before=await port.read(action.target);verifiedState(action,before);
  if(before.fields[action.field]!==action.before)throw Error('journal_http_before_drift');
  if(action.before===action.after)return {status:'noop' as const,action,before,after:before,transport:'not_invoked' as const,parentSends:0 as const,automaticRetryAllowed:false as const};
  const decision=await port.consumeApproval(action);
  if(decision.status!=='verified'||decision.actionDigest!==journalHttpActionDigest(action))throw Error('journal_http_approval_rejected');
  let transport:'returned'|'uncertain'='returned';try{await port.write(action);}catch{transport='uncertain';}
  let after:JournalHttpState;try{after=await port.read(action.target);verifiedState(action,after);}catch{return {status:'unresolved' as const,action,before,transport,parentSends:0 as const,automaticRetryAllowed:false as const};}
  const preserved=Object.entries(before.fields).every(([field,value])=>field===action.field||after.fields[field]===value);
  const status=preserved&&after.fields[action.field]===action.after?'persisted' as const:preserved&&after.fields[action.field]===action.before?'not_persisted' as const:'conflict' as const;
  return {status,action,before,after,transport,parentSends:0 as const,automaticRetryAllowed:false as const};
}
