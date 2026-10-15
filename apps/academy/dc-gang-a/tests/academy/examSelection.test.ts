import {describe, expect, test} from 'bun:test';
import {known, unknown} from '../../src/learning/model';
import {createExamCandidate, elementaryExamRequirement, inspectExamSelection, inspectExamPreselection, validateExamCandidate, type ExamCandidateBody, type ExamSelectionWorkspace, type ExamPreselectionUnitScope} from '../../src/academy/examSelection';
import {teacherExamSelectionContract} from '../../docs/teacher-exam-selection-contract';
import type {CatalogNode} from '../../src/academy/domain';

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

function preselection():ExamSelectionWorkspace {
  return {...workspace(),examDate:unknown('Exact date absent from original'),timeZone:unknown('Time zone absent from original'),selections:[]};
}
function unitScope():ExamPreselectionUnitScope {
  const catalog:CatalogNode[]=[{id:'edition',kind:'book_edition',sourceKey:{namespace:'synthetic_edition',literalKey:'edition-a'},label:'Synthetic edition',parent:unknown('Edition root')}];
  for(let index=0;index<3;index++)catalog.push({id:'unit-'+index,kind:'major_unit',sourceKey:{namespace:'synthetic_unit',literalKey:String(index)},label:'Synthetic unit '+index,parent:known('edition',['synthetic-catalog'])});
  return known({catalog,unitIds:['unit-0','unit-1','unit-2']},['synthetic-catalog']);
}

describe('selection-free month-end analysis',()=>{
  test('original requirement/scoring/timing and provenance are handed off with no chosen items',()=>{
    const before=JSON.stringify(candidates),result=inspectExamPreselection(preselection(),candidates);
    expect(result.requirement).toEqual(teacherExamSelectionContract.acceptedRequirement);
    expect(result.requirement).toMatchObject({grade:3,month:10,questions:24,totalPoints:100,responseMode:'constructed_response'});
    expect(result.scoring.calculatedPoints).toBe(100);
    expect(result.scoring.difficultyFromPoints).toBe(false);
    expect(result.timing).toMatchObject({localStartTime:'15:00',localExamEndTime:'16:20',localSessionEndTime:'18:00',gradingAndPeerHavrutaMinutes:100,calendarInstantResolved:false});
    expect(result.originalSource).toEqual(teacherExamSelectionContract.source);
    expect(result.originalSource.originalTextSha256).toEqual(['25711d3b49e2be397e9ed0e938837c37dfc852e5ca5b9215ac5528e980b57fe0','d2270ffdc888101090883df70130fe43b9c3abf8f6f88bd335a342f077259172']);
    expect(result.unknowns).toContain('exam_date_unknown');expect(result.unknowns).toContain('exam_timezone_unknown');
    expect(result).toMatchObject({selectedQuestions:0,selectedPoints:0,finalMembershipCreated:false,candidateCreation:false,teacherAccepted:false,printed:false,published:false,academyWrites:0});
    expect(JSON.stringify(candidates)).toBe(before);expect(Object.isFrozen(result.originalSource.sourceKeys)).toBe(true);
  });
  test('even complete declared candidates never qualify actual source, unit coverage or a final exam',()=>{
    const result=inspectExamPreselection(preselection(),candidates);
    expect(result.coverage.observedCandidateRevisions).toBe(24);expect(result.coverage.distinctSourceItems).toBe(24);
    expect(result.coverage.inventoryCompleteness.state).toBe('unknown');expect(result.coverage.itemToUnitCoverage.state).toBe('unknown');
    expect(result.proposals.unitDistribution.state).toBe('unknown');expect(result.sourceVerification).toBe('not_performed_by_this_projection');
    expect(result.unknowns).toContain('source_currentness_unverified');expect(result.unknowns).toContain('teacher_judgment_unobserved');
    const incomplete=createExamCandidate({...body(1),edition:unknown('No edition'),answer:unknown('No answer'),difficulty:unknown('No difficulty'),responseMode:unknown('No format')});
    const partial=inspectExamPreselection(preselection(),[incomplete]);
    expect(partial.coverage.rows[0]!.missingFields).toEqual(['edition','answer','difficulty','responseMode']);
    expect(partial.unknowns).toContain('constructed_response_unverified');expect(partial.unknowns).toContain('edition_unknown');
  });
  test('nonempty selection, wrong requirement and forged source revisions fail closed',()=>{
    expect(()=>inspectExamPreselection(workspace(),candidates)).toThrow('exam_preselection_requires_empty_selections');
    expect(()=>inspectExamPreselection({...preselection(),requirementRevision:'unaccepted' as any},[])).toThrow('exam_requirement_conflict');
    expect(()=>inspectExamPreselection(preselection(),[{...candidates[0]!,sourceRef:'forged-source-receipt'}])).toThrow('exam_candidate_revision_conflict');
    expect(()=>inspectExamPreselection(preselection(),[candidates[0]!,candidates[0]!])).toThrow('duplicate_exam_candidate_revision');
    expect(()=>inspectExamPreselection(preselection(),Array(2001).fill(candidates[0]!))).toThrow('exam_candidate_cap');
    let reads=0;const source={...candidates[0]!};Object.defineProperty(source,'sourceRef',{enumerable:true,get(){reads++;return 'forged';}});
    expect(()=>inspectExamPreselection(preselection(),[source])).toThrow('accessors are not JSON data');expect(reads).toBe(0);
  });
  test('exact unit hierarchy supports a labelled quota proposal, never item or difficulty allocation',()=>{
    const result=inspectExamPreselection(preselection(),[],unitScope()),proposal=result.proposals.unitDistribution;
    expect(proposal.state).toBe('known');if(proposal.state!=='known')throw Error('expected synthetic quota proposal');
    expect(proposal.value.allocations.map(row=>row.questions)).toEqual([8,8,8]);expect(proposal.value.allocations[0]!.pathIds).toEqual(['edition','unit-0']);
    expect(result.proposals.reviewStatus).toBe('proposal_only');expect(result.coverage.itemToUnitCoverage.state).toBe('unknown');expect(result.selectedQuestions).toBe(0);
    expect(proposal.value.allocations.every(row=>!('candidateId' in row)&&!('points' in row))).toBe(true);
    expect(Object.isFrozen(proposal.value.allocations[0])).toBe(true);
  });
  test('missing ancestry remains unknown; unavailable, repeated and overlapping scope is refused',()=>{
    const declared=unitScope();if(declared.state!=='known')throw Error('expected synthetic scope');
    const missing=declared.value.catalog.map(node=>node.id==='unit-0'?{...node,parent:unknown('Parent not acquired')}:node);
    expect(inspectExamPreselection(preselection(),[],known({...declared.value,catalog:missing},['synthetic'])).proposals.unitDistribution.state).toBe('unknown');
    expect(()=>inspectExamPreselection(preselection(),[],known({...declared.value,unitIds:['unavailable']},['synthetic']))).toThrow('exam_scope_unit_unavailable');
    expect(()=>inspectExamPreselection(preselection(),[],known({...declared.value,unitIds:['unit-0','unit-0']},['synthetic']))).toThrow('duplicate_exam_scope_unit');
    const duplicate=declared.value.catalog.map(node=>node.id==='unit-1'?{...node,sourceKey:{namespace:'synthetic_unit',literalKey:'0'}}:node);
    expect(()=>inspectExamPreselection(preselection(),[],known({...declared.value,catalog:duplicate},['synthetic']))).toThrow('duplicate_exam_scope_source_unit');
    const middle:CatalogNode={id:'middle',kind:'middle_unit',sourceKey:{namespace:'synthetic_unit',literalKey:'middle'},label:'Synthetic middle',parent:known('unit-0',['synthetic'])};
    expect(()=>inspectExamPreselection(preselection(),[],known({catalog:[...declared.value.catalog,middle],unitIds:['unit-0','middle']},['synthetic']))).toThrow('overlapping_exam_scope_units');
  });
});
