import {assertDate,assertExactKeys,requireText} from '../learning/model';

/** Versioned teacher-feedback consumer. Rendering is not approval, a source join or a writer. */
export const lessonJournalTemplates={
  revision:'2',
  formatting:{bullet:'- ',separator:'\n',entryBoundary:'one_attributable_activity_assignment_or_notice_not_each_sentence',dueDate:'first_homework_entry_only',existingTeacherText:'preserve_meaning_no_automatic_reapplication',authority:'teacher_final_format_feedback_2026_10_06'},
  progress:{order:['mapped_content','activity','attributable_outcome','specific_detail'],mappingRules:['Resolve edition + literal minor-unit code + name from scoped source/teacher evidence.','An internal inspection code never appears in parent text.','Keep solving, grading, correction and inspection separate.','Use an attributable topic only when an exact printed unit is unresolved; do not manufacture it.']},
  homework:{order:['due_date','mapped_content','selected_range','action'],mappingRules:['Preserve exact due date and teacher-selected partial range.','Unverified type/header blocks this field, not independent student fields.','Never infer a clinic ordinal from its original item ordinal.']},
  memo:{order:['teacher_notice'],mappingRules:['Filter notices by the admitted lesson part.','Preserve exact teacher purpose without adding an assessment or delivery claim.']},
} as const;
export interface JournalContentMapping {bookLabel:string;unitCode:string;unitName:string;basis:'source_edition'|'teacher_report'|'teacher_report_topic';evidenceRefs:string[]}
export const journalActivities={homework:'숙제',wrong_clinic:'오답클리닉',similar_clinic:'유사클리닉',solving:'문제풀이',prestudy:'예습영상',concept_blank_test:'개념백지테스트',daily_test:'DailyTest',havruta:'하브루타',routine:'나머지 학습 루틴',correction:'오답 정리'} as const;
export const journalOutcomes={teacher_checked:'채점·검사 완료',inspected:'검사 완료',performed:'진행',completed:'완료',worked_ungraded:'진행(미채점)',not_performed:'미실시',incomplete:'미완료',deferred:'다음 수업으로 이월'} as const;
export const homeworkActions={solve:'문제풀이 해오기',solve_without_grading:'프린트에 풀이를 적어 오기. 집에서는 채점하지 않고 등원 후 채점합니다',correct:'오답 정리 해오기',prestudy:'예습 해오기'} as const;
export interface JournalProgressEntry {content:JournalContentMapping[];activity:keyof typeof journalActivities;outcome:keyof typeof journalOutcomes;detail:string;evidenceRefs:string[];internalCode:string}
export interface JournalHomeworkTask {content:JournalContentMapping[];action:keyof typeof homeworkActions;selection:string;evidenceRefs:string[]}
export interface JournalTemplateInput {lessonDate:string;part:number;progress:JournalProgressEntry[];homework:{dueDate:string;tasks:JournalHomeworkTask[];qualification:'verified'|'unresolved_header'};memo:{text:string;parts:number[];evidenceRefs:string[]}[]}
function refs(values:unknown):asserts values is string[]{if(!Array.isArray(values)||!values.length||values.some(v=>typeof v!=='string'||!v.trim())||new Set(values).size!==values.length)throw Error('journal_evidence_required');}
function content(value:JournalContentMapping):string{
  assertExactKeys(value,['bookLabel','unitCode','unitName','basis','evidenceRefs']);refs(value.evidenceRefs);
  requireText(value.unitName,'unit name');
  if(typeof value.bookLabel!=='string'||typeof value.unitCode!=='string'||!['source_edition','teacher_report','teacher_report_topic'].includes(value.basis))throw Error('journal_mapping_rejected');
  if(value.basis!=='teacher_report_topic'){requireText(value.bookLabel,'book');requireText(value.unitCode,'literal unit code');}
  return [value.bookLabel,value.unitCode,value.unitName].filter(Boolean).join(' ');
}
function mapped(values:JournalContentMapping[]):string{
  if(!Array.isArray(values)||!values.length||values.length>16)throw Error('journal_content_mapping_required');
  const books=new Map<string,Set<string>>();
  for(const value of values){content(value);const units=books.get(value.bookLabel)??new Set<string>();units.add([value.unitCode,value.unitName].filter(Boolean).join(' '));books.set(value.bookLabel,units);}
  return [...books].map(([book,units])=>[book,[...units].join('·')].filter(Boolean).join(' ')).join(' / ');
}
/** Source's width400 is checked without silently truncating an accepted statement. */
export function journalWireWidth(value:string):number{return value.split('').reduce((sum,char)=>sum+(char.charCodeAt(0)>127?2:1),0);}
/** Entry boundaries belong to structured teacher evidence, not punctuation guessing. */
function bulletEntries(entries:string[]):string{return entries.map(text=>'- '+text.trim().replace(/^(?:-[ \t]+)+/,'')).join('\n');}
export function renderLessonJournal(input:JournalTemplateInput){
  assertExactKeys(input,['lessonDate','part','progress','homework','memo']);assertDate(input.lessonDate);
  if(!Number.isSafeInteger(input.part)||input.part<1||!Array.isArray(input.progress)||input.progress.length>32||!Array.isArray(input.memo)||input.memo.length>16)throw Error('journal_template_scope_rejected');
  const progress=bulletEntries(input.progress.map(entry=>{
    assertExactKeys(entry,['content','activity','outcome','detail','evidenceRefs','internalCode']);refs(entry.evidenceRefs);
    if(typeof entry.activity!=='string'||typeof entry.outcome!=='string'||!Object.hasOwn(journalActivities,entry.activity)||!Object.hasOwn(journalOutcomes,entry.outcome)||typeof entry.detail!=='string'||typeof entry.internalCode!=='string')throw Error('journal_activity_rejected');
    return `${mapped(entry.content)} ${journalActivities[entry.activity]} ${journalOutcomes[entry.outcome]}${entry.detail?`(${entry.detail})`:''}.`;
  }));
  const hw=input.homework;assertExactKeys(hw,['dueDate','tasks','qualification']);assertDate(hw.dueDate);
  if(hw.dueDate<input.lessonDate||!Array.isArray(hw.tasks)||hw.tasks.length>16||!['verified','unresolved_header'].includes(hw.qualification))throw Error('journal_homework_rejected');
  const weekdays=['일','월','화','수','목','금','토'];const due=`${hw.dueDate.slice(5).replace('-','/')}(${weekdays[new Date(hw.dueDate+'T00:00:00Z').getUTCDay()]})까지`;
  const tasks=hw.tasks.map(task=>{
    assertExactKeys(task,['content','action','selection','evidenceRefs']);refs(task.evidenceRefs);
    if(typeof task.action!=='string'||!Object.hasOwn(homeworkActions,task.action)||typeof task.selection!=='string')throw Error('journal_homework_action_rejected');
    return `${mapped(task.content)}${task.selection?` ${task.selection}`:''} ${homeworkActions[task.action]}.`;
  });
  const homework=bulletEntries(tasks.map((task,index)=>index===0?`${due} ${task}`:task));
  const renderedNotices=input.memo.filter(notice=>{
    assertExactKeys(notice,['text','parts','evidenceRefs']);refs(notice.evidenceRefs);requireText(notice.text,'memo');
    if(!Array.isArray(notice.parts)||!notice.parts.length||notice.parts.some(p=>!Number.isSafeInteger(p)||p<1))throw Error('journal_memo_scope_rejected');
    return notice.parts.includes(input.part);
  });
  const memo=bulletEntries(renderedNotices.map(notice=>notice.text));
  if([progress,homework,memo].some(text=>/P[123]/.test(text)))throw Error('internal_code_in_parent_text');
  const blockers:string[]=[];
  if(hw.qualification==='unresolved_header')blockers.push('homework:unresolved_original_header');
  for(const [field,text] of Object.entries({progress,homework,memo}))if(journalWireWidth(text)>400)blockers.push(`${field}:source_width_exceeded`);
  return {templateRevision:lessonJournalTemplates.revision,progress,homework,memo,blockers,evidenceRefs:[...new Set([...input.progress.flatMap(x=>[...x.evidenceRefs,...x.content.flatMap(m=>m.evidenceRefs)]),...hw.tasks.flatMap(x=>[...x.evidenceRefs,...x.content.flatMap(m=>m.evidenceRefs)]),...renderedNotices.flatMap(x=>x.evidenceRefs)])],approval:'not_granted_by_rendering' as const};
}
