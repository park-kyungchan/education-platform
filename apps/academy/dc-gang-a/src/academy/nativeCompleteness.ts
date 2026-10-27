import {canonicalJson} from '../learning/model';
import type {LearningWorkAssignment,LearningWorkAttempt} from './learningWork';
import type {DailyRecordDraftPayload,NativeObjectRef,ObjectRef,Knowledge} from './contracts/prerequisiteRecords';

export const completenessProfile='DAILY_RECORD_OCCURRENCE_V1' as const;
export const proposalRenderingProfile='NATIVE_SOURCE_RENDERING_V1' as const;
export interface ProposalSource {ref:ObjectRef;payload:unknown}
export interface ProposalSources {progress:ProposalSource[];homework:ProposalSource[];attempts:ProposalSource[];previousAssessments:ProposalSource[]}
/** A deliberately mechanical proposal profile. Unsupported human prose stays unverified.
 * These strings establish source consistency only; they never approve parent-facing wording. */
export function nativeProposalTexts(sources:ProposalSources):{progressText:string;homeworkText:string;noteText:string}{
 const sorted=(rows:ProposalSource[])=>[...rows].sort((a,b)=>canonicalJson(a.ref).localeCompare(canonicalJson(b.ref)));
 const render=(section:string,value:unknown)=>canonicalJson({profile:proposalRenderingProfile,section,sources:value});
 return {progressText:render('PROGRESS',sorted(sources.progress)),homeworkText:render('HOMEWORK',{assignments:sorted(sources.homework),previousAssessments:sorted(sources.previousAssessments)}),noteText:render('TEST_ATTEMPTS',sorted(sources.attempts))};
}
export function assertProposalTexts(p:DailyRecordDraftPayload,sources:ProposalSources,ref:(r:ObjectRef)=>NativeObjectRef):void{
 const expected=nativeProposalTexts(sources);
 for(const [field,rows] of [['progressText',sources.progress],['homeworkText',[...sources.homework,...sources.previousAssessments]],['noteText',sources.attempts]] as const){
  const text:Knowledge<string>=p[field];if(text.state!=='known'||!text.value.trim())throw Error('completeness_unknown:TEXT_EVIDENCE');
  if(text.value!==expected[field])throw Error('completeness_unverified_prose:TEXT_EVIDENCE');
  if(!rows.length||rows.some(row=>!text.evidence.some(e=>e.sourceRevision===row.ref.revision&&canonicalJson(e.sourceRef)===canonicalJson(ref(row.ref)))))throw Error('completeness_unknown:TEXT_EVIDENCE');
  if(text.evidence.some(e=>!rows.some(row=>e.sourceRevision===row.ref.revision&&canonicalJson(e.sourceRef)===canonicalJson(ref(row.ref)))))throw Error('completeness_source_conflict:TEXT_EVIDENCE');
 }
}
/** Per-item coverage is required, but conveys no numeric earned/maximum meaning. */
export function assertCompleteGrades(attempt:LearningWorkAttempt,assignment:LearningWorkAssignment):void{
 if(attempt.state!=='graded')throw Error('completeness_violated:TEST_ATTEMPTS');
 const expected=assignment.items.map(i=>i.assignedItemId).sort(),actual=attempt.itemResults.map(i=>i.assignedItemId).sort();
 if(!expected.length||canonicalJson(expected)!==canonicalJson(actual)||attempt.itemResults.some(i=>i.grade.state!=='known'||i.grade.value==='ungraded'))throw Error('completeness_unknown:TEST_ATTEMPTS');
}
