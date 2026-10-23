/** One shared section contract for Space/Site/MCP adapters. Does not send or persist a DailyRecord. */
export const DAILYRECORD_SECTION_VERSION='academy.dailyrecord-sections/1.0.0' as const;
interface Base {id:string;studentId:string;rawText:string;evidenceIds:readonly string[];}
export type DailyRecordAtom = Base & (
 {kind:'today_progress';occurredDate:string;status:'complete'|'in_progress'|'not_performed';} |
 {kind:'homework';scopeRaw:string;dueDate:string|null;} |
 {kind:'parent_notice';topic:'schedule'|'supplies'|'special_notice';} |
 {kind:'teacher_plan';} |
 {kind:'unclassified';reviewReason:string;}
);
export interface DailyRecordSections {schemaVersion:typeof DAILYRECORD_SECTION_VERSION;studentId:string;classDate:string;progress:DailyRecordAtom[];homework:DailyRecordAtom[];memo:DailyRecordAtom[];internalTeacherPlan:DailyRecordAtom[];reviewRequired:DailyRecordAtom[];rawAtoms:readonly DailyRecordAtom[];approvedForParentSend:false;}
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function composeDailyRecordSections(studentId:string,classDate:string,atoms:readonly DailyRecordAtom[]):DailyRecordSections {
 if(!studentId||!date(classDate))throw Error('invalid_dailyrecord_identity');
 const out:DailyRecordSections={schemaVersion:DAILYRECORD_SECTION_VERSION,studentId,classDate,progress:[],homework:[],memo:[],internalTeacherPlan:[],reviewRequired:[],rawAtoms:structuredClone(atoms),approvedForParentSend:false};
 const ids=new Set<string>();
 for(const atom of atoms){
  if(atom.studentId!==studentId||!atom.id||ids.has(atom.id)||!atom.rawText.trim()||!Array.isArray(atom.evidenceIds)||!atom.evidenceIds.length||atom.evidenceIds.some(id=>typeof id!=='string'||!id.trim()))throw Error('invalid_dailyrecord_atom');ids.add(atom.id);
  const a=structuredClone(atom);
  switch(a.kind){
   case 'today_progress': if(!date(a.occurredDate)||!['complete','in_progress','not_performed'].includes(a.status))throw Error('invalid_progress');if(a.occurredDate!==classDate){out.reviewRequired.push({...a,kind:'unclassified',reviewReason:'진도 근거 날짜가 해당 수업일과 다름'});break;}out.progress.push(a);break;
   case 'homework':if(!a.scopeRaw.trim()||a.dueDate!==null&&!date(a.dueDate))throw Error('invalid_homework_scope');if(a.dueDate===null||a.dueDate<classDate){out.reviewRequired.push({...a,kind:'unclassified',reviewReason:'숙제 기한 미확정 또는 수업일 이전: 이월 여부 확인 필요'});break;}out.homework.push(a);break;
   case 'parent_notice':if(!['schedule','supplies','special_notice'].includes(a.topic))throw Error('invalid_memo_topic');out.memo.push(a);break;
   case 'teacher_plan':out.internalTeacherPlan.push(a);break;
   case 'unclassified':if(!a.reviewReason.trim())throw Error('missing_review_reason');out.reviewRequired.push(a);break;
   default:throw Error('unrecognized_dailyrecord_kind');
  }
 }
 return out;
}
/** Read-only metadata shared by HTTP/MCP current projection; no write endpoint. */
export const DAILYRECORD_SECTION_CONTRACT = {
 schemaVersion:DAILYRECORD_SECTION_VERSION,
 sourcePage:'https://example.invalid/export-redacted-source',sourcePageSequence:5,
 sections:[
  {key:'progress',atomKind:'today_progress',meaning:'해당 수업일의 실제 수행·진행·미실시 근거'},
  {key:'homework',atomKind:'homework',meaning:'학생이 다음에 할 정확한 범위와 기한. 메모에 중복 입력하지 않음'},
  {key:'memo',atomKind:'parent_notice',meaning:'학부모에게 필요한 일정·준비물·특이사항'},
  {key:'internalTeacherPlan',atomKind:'teacher_plan',meaning:'교사 운영 계획. 학부모용 문안과 분리'},
  {key:'reviewRequired',atomKind:'unclassified',meaning:'모호한 문구·기한·범위는 교사 확인 대기'}
 ],
 rawEvidencePreserved:true,automaticFreeTextClassification:false,parentSendAuthorityGranted:false,
 dueDatePolicy:'미확정 또는 수업일 이전 기한은 원문 보존 후 이월 여부 검토',
} as const;
