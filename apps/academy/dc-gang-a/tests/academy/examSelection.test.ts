import {describe, expect, test} from 'bun:test';
import {known, unknown} from '../../src/learning/model';
import {createExamCandidate, elementaryExamRequirement, inspectExamSelection, validateExamCandidate, type ExamCandidateBody, type ExamSelectionWorkspace} from '../../src/academy/examSelection';

function body(index: number): ExamCandidateBody {
  const ref='synthetic-evidence:'+index;
  return {sourceItem:{namespace:'synthetic_exam_item',literalKey:String(index)}, edition:known({namespace:'synthetic_edition',literalKey:'edition-a'}, [ref]),
    observedAt:'2026-10-14T10:00:00.000Z', sourceRef:ref, evidenceRefs:[ref], content:known('Synthetic written question '+index,[ref]),
    answer:known('Synthetic answer '+index,[ref]), responseMode:known('constructed_response',[ref]), difficulty:known({level:'synthetic candidate assessment',basis:'source_claim',sourceRef:ref},[ref])};
}
const candidates=Array.from({length:24},(_,index)=>createExamCandidate(body(index+1)));
function workspace(): ExamSelectionWorkspace {
  return {kind:'exam_selection_workspace',schemaVersion:1,requirementRevision:elementaryExamRequirement.revision,title:'Synthetic selection qualification',
    examDate:known('2026-10-20',['synthetic-schedule']), timeZone:known('Asia/Seoul',['synthetic-schedule']),
    selections:candidates.map((candidate,index)=>({candidateId:candidate.id,candidateRevisionId:candidate.revisionId,points:index<12?3:index<20?5:6,rationale:'Synthetic validation only; no actual item choice.'}))};
}

describe('private exam candidate inspection',()=>{
  test('24 written questions with 12x3/8x5/4x6 totals100 and only proposes teacher review',()=>{
    const result=inspectExamSelection(workspace(),candidates);
    expect(result.selectedQuestions).toBe(24); expect(result.selectedPoints).toBe(100);
    expect(result.bands.map(band=>band.selected)).toEqual([12,8,4]); expect(result.readiness).toBe('ready_for_teacher_review');
    expect([result.teacherAccepted,result.printed,result.published]).toEqual([false,false,false]); expect(result.academyWrites).toBe(0);
    expect(result.sourceVerification).toBe('not_performed_by_this_projection');
    expect(Object.isFrozen(result.rows[0]!.candidate.content)).toBe(true);
    expect(Object.isFrozen(elementaryExamRequirement.pointBands[0])).toBe(true);
  });
  test('the old9/9/6 proposal and partial work stay incomplete',()=>{
    const wrong=workspace(); const selections=wrong.selections.map((selection,index)=>({...selection,points:index<9?3 as const:index<18?5 as const:6 as const}));
    const result=inspectExamSelection({...wrong,selections},candidates);
    expect(result.selectedPoints).toBe(108); expect(result.readiness).toBe('incomplete'); expect(result.issues.map(issue=>issue.code)).toEqual(['point_band_3_incomplete','point_band_5_incomplete','point_band_6_incomplete']);
    expect(inspectExamSelection({...wrong,selections:wrong.selections.slice(0,2)},candidates).readiness).toBe('incomplete');
  });
  test('unknown originals, answer, edition, difficulty and schedule never become ready',()=>{
    const incomplete=createExamCandidate({...body(1),edition:unknown('unresolved edition'),content:unknown('original not acquired'),answer:unknown('answer not acquired'),difficulty:unknown('not assessed'),responseMode:unknown('not inspected')});
    const selected=workspace();const result=inspectExamSelection({...selected,examDate:unknown('original date absent'),timeZone:unknown('original timezone absent'),selections:[{...selected.selections[0]!,candidateRevisionId:incomplete.revisionId}]},[incomplete]);
    expect(result.readiness).toBe('incomplete');
    expect(result.issues.filter(issue=>issue.candidateId===incomplete.id).map(issue=>issue.code)).toEqual(['edition_unknown','content_unknown','answer_unknown','difficulty_unknown','constructed_response_unverified']);
    expect(result.issues.map(issue=>issue.code)).toContain('exam_date_unknown'); expect(result.issues.map(issue=>issue.code)).toContain('exam_timezone_unknown');
  });
  test('changed source content needs an exact new revision and cannot replace the selected version',()=>{
    const changed=createExamCandidate({...body(1),answer:known('Different retained answer',['synthetic-correction'])});
    expect(changed.id).toBe(candidates[0]!.id); expect(changed.revisionId).not.toBe(candidates[0]!.revisionId);
    expect(()=>inspectExamSelection(workspace(),[changed,...candidates.slice(1)])).toThrow('selected_exam_candidate_unavailable');
    expect(()=>validateExamCandidate({...candidates[0]!,answer:changed.answer})).toThrow('exam_candidate_revision_conflict');
    expect(inspectExamSelection(workspace(),[changed,...candidates]).rows[0]!.candidate.answer).toEqual(candidates[0]!.answer);
  });
  test('duplicate item, foreign revision, invalid dates and selection overflow fail closed',()=>{
    const selected=workspace();
    expect(()=>inspectExamSelection({...selected,selections:[selected.selections[0]!,selected.selections[0]!] },candidates)).toThrow('duplicate_exam_item');
    expect(()=>inspectExamSelection({...selected,selections:[{...selected.selections[0]!,candidateRevisionId:candidates[1]!.revisionId}]},candidates)).toThrow('selected_exam_candidate_unavailable');
    expect(()=>inspectExamSelection({...selected,examDate:known('2026-02-30',['synthetic-date'])},candidates)).toThrow('invalid_exam_date');
    expect(()=>inspectExamSelection({...selected,selections:[...selected.selections,selected.selections[0]!]},candidates)).toThrow('exam_selection_cap');
    expect(()=>inspectExamSelection(selected,[...candidates,candidates[0]!])).toThrow('duplicate_exam_candidate_revision');
  });
  test('source multiple-choice content cannot qualify as a written question, and points do not infer difficulty',()=>{
    const choice=createExamCandidate({...body(1),responseMode:known('multiple_choice',['synthetic-format'])});
    const selected=workspace();const result=inspectExamSelection({...selected,selections:[{...selected.selections[0]!,candidateRevisionId:choice.revisionId}]},[choice]);
    expect(result.issues.map(issue=>issue.code)).toContain('constructed_response_unverified'); expect(result.rows[0]!.candidate.difficulty).toEqual(choice.difficulty);
  });
  test('non-JSON candidates are rejected without invoking accessors or accepting forged revisions',()=>{
    let reads=0;
    const candidate={...candidates[0]!};
    Object.defineProperty(candidate,'content',{enumerable:true,get(){reads++;return candidates[0]!.content;}});
    expect(()=>validateExamCandidate(candidate)).toThrow('accessors are not JSON data');expect(reads).toBe(0);
    expect(()=>createExamCandidate({...body(1),content:unknown('x'.repeat(1001))})).toThrow('invalid_exam_text');
  });
});
