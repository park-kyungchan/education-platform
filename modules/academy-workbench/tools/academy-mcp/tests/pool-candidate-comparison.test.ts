import {expect,test} from 'bun:test';
import {
  POOL_COMPARISON_RESEARCH_REVISION,POOL_DIFFICULTY_POINTS,POOL_UNIT_DIFFICULTY_QUOTAS,
  poolCandidateSchema,poolCandidateSetSchema,reviewCandidateSet,summarizeCandidateComparison,
  type PoolCandidate,type PoolCandidateSet,
} from '../src/pool-candidate-comparison.ts';

// All native IDs, observations and source hashes below are fictional. A passing review
// validates these supplied claims only; it does not acquire or authenticate real content.
const observedAt='2026-10-19T06:00:00Z',selector='a'.repeat(64),snapshot='b'.repeat(64),researchHash='c'.repeat(64);
const source=(pointer:string)=>({owner:'math-research-module' as const,revision:POOL_COMPARISON_RESEARCH_REVISION,
  path:'fixtures/synthetic-research.json',sha256:researchHash,pointer});
const typeGroups={
  'U-M':['HM11-d1-T01','HM11-d2-T01','HM11-d3-T01','HM12-d1-T01','HM12-d2-T01','HM12-d3-T01','HM12-d4-T01','HM21-d1-T01'],
  'U-D':['HD11-d1-T01','HD11-d2-T01','HD11-d3-T01','HD12-d1-T01','HD12-d2-T01','HD21-d1-T01','HD21-d2-T01','HD22-d1-T01'],
  'U-C':['HC11-d1-T01','HC11-d2-T01','HC12-d1-T01','HC12-d2-T01','HC21-d1-T01','HC21-d2-T01','HC21-d3-T01','HC22-d1-T01'],
} as const;
const unknownAxis=()=>({strength:'unknown' as const,rationale:null,researchRefs:[],nativeEvidenceIds:[],differences:[]});
function candidate(index:number,option:number,unitId:keyof typeof typeGroups,typeId:string,band:'중'|'상'|'최상'):PoolCandidate {
  const evidence=(id:string,kind:'prompt'|'pool_difficulty'|'response_mode')=>({id,kind,inspection:'inspected' as const,
    sourceSha256:snapshot,artifactSha256:null,media:'text' as const,locator:`synthetic:${id}`,observation:'Fictional observation for this test only.'});
  const matched=()=>({strength:'strong' as const,rationale:'The synthetic task requires the declared mathematical relation and action.',
    researchRefs:[source(`/types/${index}`)],nativeEvidenceIds:['prompt'],differences:[]});
  return {id:`fictional-option-${index}-${option}`,
    question:{namespace:'academy_item',lecture_key:String(1000+index*10+option),pat_no:String(100+index),labelExact:'Fictional native label',
      hierarchyId:`fictional-hierarchy-${unitId}`,selectorSha256:selector,sourceSha256:snapshot,observedAt},
    difficulty:{value:band,rawValue:band,mappingRationale:null,evidenceIds:['difficulty']},
    responseMode:{value:'descriptive',evidenceIds:['response']},
    evidence:[evidence('prompt','prompt'),evidence('difficulty','pool_difficulty'),evidence('response','response_mode')],promptEvidenceIds:['prompt'],
    officialSolution:{state:'not_returned',evidenceIds:[]},
    analystSolution:{state:'derived',attribution:'assistant-analysis',reasoning:'Fictional derivation: identify the relation, apply it, and justify the result.',basedOnEvidenceIds:['prompt']},
    comparison:{attribution:'assistant-analysis',axes:{structure:matched(),reasoning:matched(),representation:unknownAxis(),conditions:unknownAxis(),errors:unknownAxis(),transfer:unknownAxis()},
      microstepMapping:[{researchMicrostepId:typeId+'-A01',researchRef:source(`/designs/${index}/microsteps/0`),candidateRequiredAction:'Identify and apply the stated relation.',basis:'analyst_derivation',nativeEvidenceIds:['prompt']}],
      duplicateGroupProposal:null,limitations:['Fictional fixture; no source authenticity or teacher acceptance is asserted.']},
    recommendation:{role:option===1?'preferred':'alternate',ordinal:option===1?1:2,rationale:'Ordinal synthetic comparison, not a probability.'},
  };
}
function filledSet():PoolCandidateSet {
  const slots:PoolCandidateSet['slots']=[];
  for(const unitId of Object.keys(typeGroups) as (keyof typeof typeGroups)[]) {
    const quota=POOL_UNIT_DIFFICULTY_QUOTAS[unitId];
    const bands=(['중','상','최상'] as const).flatMap(band=>Array.from({length:quota[band]},()=>band));
    typeGroups[unitId].forEach((typeId,index)=>{
      const globalIndex=slots.length,band=bands[index]!;
      slots.push({id:`fictional-slot-${globalIndex}`,unitId,primaryResearchTypeId:typeId,difficulty:band,
        candidates:[candidate(globalIndex,1,unitId,typeId,band),candidate(globalIndex,2,unitId,typeId,band)]});
    });
  }
  return {schemaVersion:'academy.pool-candidate-set/1',
    researchContext:{owner:'math-research-module',revision:POOL_COMPARISON_RESEARCH_REVISION,pins:[{path:'fixtures/synthetic-research.json',sha256:researchHash}],
      types:slots.map((slot,index)=>({id:slot.primaryResearchTypeId!,unitId:slot.unitId,detailId:slot.primaryResearchTypeId!.split('-T')[0]!,source:source(`/types/${index}`)}))},
    nativeContext:{selectorSha256:selector,resolvedScopes:(Object.keys(typeGroups) as (keyof typeof typeGroups)[]).map(unitId=>({unitId,hierarchyId:`fictional-hierarchy-${unitId}`,schoolStage:'elementary',grade:3,sourceSha256:selector,observedAt,evidenceLocator:'synthetic scope receipt'})),
      questionSnapshots:slots.map(slot=>({hierarchyId:slot.candidates[0]!.question.hierarchyId,pat_no:slot.candidates[0]!.question.pat_no,sourceSha256:snapshot}))},slots};
}
const codes=(input:unknown)=>reviewCandidateSet(input).issues.map(issue=>issue.code);
const first=(set:PoolCandidateSet)=>set.slots[0]!.candidates[0]!;

test('an empty truthful draft reports missing evidence and quotas without inventing assignments',()=>{
  const input={schemaVersion:'academy.pool-candidate-set/1',researchContext:null,nativeContext:null,slots:[]};
  expect(poolCandidateSetSchema.safeParse(input).success).toBe(true);
  const result=reviewCandidateSet(input);
  expect(result.inputValid).toBe(true);expect(result.readiness).toBe('draft');
  expect(result.summary?.slots).toBe(0);expect(result.summary?.candidateOptions).toBe(0);
  expect(result.issues.map(issue=>issue.code)).toContain('slot_count_incomplete');
  expect(result.governance.finalMembership).toBe(false);expect(result.governance.acceptance).toBe('not_inferred');
});

test('complete fictional evidence meets exact24/8 quotas and explicit difficulty-to-point policy only',()=>{
  const input=filledSet(),before=JSON.stringify(input),result=reviewCandidateSet(input);
  expect(result.issues).toEqual([]);expect(result.readiness).toBe('reviewable');
  expect(result.summary?.difficultyAssignments).toEqual({'중':12,'상':8,'최상':4});
  expect(result.summary?.points).toBe(100);expect(result.summary?.distinctPrimaryResearchTypes).toBe(24);
  expect(result.summary?.distinctPreferredNativeQuestions).toBe(24);expect(result.summary?.candidateOptions).toBe(48);
  expect(result.summary?.distinctCandidateNativeQuestions).toBe(48);expect(result.summary?.sharedNativeQuestions).toEqual([]);
  expect(POOL_DIFFICULTY_POINTS).toEqual({'중':3,'상':5,'최상':6});
  expect(result.governance.teacherLearningCompletion).toBe('not_inferred');expect(JSON.stringify(input)).toBe(before);
});

test('strict schemas reject caller acceptance, teacher completion and fabricated semantic percentages',()=>{
  const input=filledSet();
  expect(poolCandidateSetSchema.safeParse({...input,accepted:true}).success).toBe(false);
  expect(poolCandidateSchema.safeParse({...first(input),teacherStudied:true}).success).toBe(false);
  expect(poolCandidateSchema.safeParse({...first(input),semanticSimilarity:0.99}).success).toBe(false);
  expect(poolCandidateSchema.safeParse({...first(input),recommendation:{...first(input).recommendation,probability:99}}).success).toBe(false);
  expect(reviewCandidateSet({...input,academyWrites:1}).issues[0]?.code).toBe('invalid_input');
  first(input).question.labelExact='  Fictional  exact label  ';
  expect(poolCandidateSchema.parse(first(input)).question.labelExact).toBe('  Fictional  exact label  ');
});

test('unit difficulty changes cannot pass merely because global totals and points still match',()=>{
  const input=filledSet(),left=input.slots[4]!,right=input.slots[15]!;
  expect(left.difficulty).toBe('상');expect(right.difficulty).toBe('최상');
  const swap=left.difficulty;left.difficulty=right.difficulty;right.difficulty=swap;
  for(const slot of [left,right]) for(const option of slot.candidates) {option.difficulty.value=slot.difficulty;option.difficulty.rawValue=slot.difficulty;}
  const result=reviewCandidateSet(input);
  expect(result.summary?.points).toBe(100);expect(codes(input)).toContain('unit_difficulty_quota');
  expect(codes(input)).not.toContain('difficulty_quota');expect(result.readiness).toBe('draft');
});

test('count, primary research duplication, native question duplication and candidate shortages remain explicit',()=>{
  const input=filledSet();input.slots[1]!.primaryResearchTypeId=input.slots[0]!.primaryResearchTypeId;
  input.slots[1]!.candidates[0]!.question.lecture_key=first(input).question.lecture_key;
  input.slots[2]!.candidates=[];input.slots.pop();
  expect(codes(input)).toEqual(expect.arrayContaining(['slot_count_incomplete','unit_slot_quota','duplicate_primary_research_type','duplicate_primary_native_question','candidate_count_incomplete','preferred_count']));
});

test('unique local option IDs cannot inflate candidate breadth when alternatives share native questions across slots',()=>{
  const input=filledSet();
  for(const slot of input.slots) slot.candidates[1]!.question.lecture_key='999999';
  const result=reviewCandidateSet(input);
  expect(new Set(input.slots.flatMap(slot=>slot.candidates.map(option=>option.id))).size).toBe(48);
  expect(result.summary?.candidateOptions).toBe(48);
  expect(result.summary?.distinctCandidateNativeQuestions).toBe(25);
  expect(result.summary?.distinctPreferredNativeQuestions).toBe(24);
  expect(result.summary?.sharedNativeQuestions).toHaveLength(1);
  expect(result.summary?.sharedNativeQuestions[0]?.lecture_key).toBe('999999');
  expect(result.summary?.sharedNativeQuestions[0]?.occurrences).toHaveLength(24);
  expect(result.summary?.sharedNativeQuestions[0]?.occurrences.every(entry=>entry.role==='alternate')).toBe(true);
  expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['shared_native_question_across_slots','distinct_native_candidate_count_incomplete']));
  expect(result.issues.map(issue=>issue.code)).not.toContain('duplicate_primary_native_question');
  expect(result.readiness).toBe('draft');
});

test('stale selector, source page, evidence digest and unpinned research refs hold review readiness',()=>{
  const input=filledSet(),option=first(input);
  input.researchContext!.revision='d'.repeat(40);option.question.selectorSha256='e'.repeat(64);
  option.question.sourceSha256='f'.repeat(64);option.comparison.axes.structure.researchRefs[0]!.sha256='0'.repeat(64);
  expect(codes(input)).toEqual(expect.arrayContaining(['stale_research_context','stale_native_selector','stale_question_snapshot','stale_question_evidence','stale_or_unpinned_research_reference']));
});

test('unknown prompt, difficulty, response mode and core reasoning cannot be hidden by a rank',()=>{
  const option=first(filledSet());option.promptEvidenceIds=[];option.difficulty.value=null;option.responseMode.value='other';
  option.comparison.axes.reasoning=unknownAxis();option.analystSolution={state:'not_prepared',attribution:'assistant-analysis',reasoning:null,basedOnEvidenceIds:[]};
  const result=summarizeCandidateComparison(option);
  expect(result.evidenceReviewable).toBe(false);
  expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['evidence_missing','pool_difficulty_unknown','response_mode_not_qualified','core_similarity_not_supported','solution_process_unsubstantiated']));
});

test('official solution absence stays separate from an attributed analyst derivation',()=>{
  const option=first(filledSet()),result=summarizeCandidateComparison(option);
  expect(result.evidenceReviewable).toBe(true);expect(result.officialSolutionState).toBe('not_returned');
  expect(result.analystDerivation).toBe('derived');expect(result.limitations).toContain('Official solution was not inspected; any analyst derivation is separate evidence.');
  option.analystSolution.reasoning=null;
  expect(summarizeCandidateComparison(option).issues.map(issue=>issue.code)).toContain('analyst_reasoning_missing');
  option.officialSolution.evidenceIds=['prompt'];
  expect(summarizeCandidateComparison(option).issues.map(issue=>issue.code)).toContain('solution_evidence_state_conflict');
});

test('an inspected official solution can support reasoning without fabricating an analyst derivation',()=>{
  const option=first(filledSet());
  option.evidence.push({...option.evidence[0]!,id:'official',kind:'official_solution'});
  option.officialSolution={state:'inspected',evidenceIds:['official']};
  option.analystSolution={state:'not_prepared',attribution:'assistant-analysis',reasoning:null,basedOnEvidenceIds:[]};
  option.comparison.microstepMapping[0]!.basis='official_solution';option.comparison.microstepMapping[0]!.nativeEvidenceIds=['official'];
  expect(summarizeCandidateComparison(option).evidenceReviewable).toBe(true);
});

test('answer-only comparisons and foreign microsteps do not prove structural or process similarity',()=>{
  const input=filledSet(),option=first(input);
  option.evidence.push({...option.evidence[0]!,id:'answer',kind:'answer'});
  option.comparison.axes.structure.nativeEvidenceIds=['answer'];option.comparison.axes.reasoning.nativeEvidenceIds=['answer'];
  option.analystSolution.basedOnEvidenceIds=['answer'];option.comparison.microstepMapping[0]!.researchMicrostepId='HC11-d1-T01-A01';
  expect(codes(input)).toEqual(expect.arrayContaining(['answer_only_core_comparison','analyst_derivation_prompt_unbound','foreign_research_microstep']));
});

test('an image requires acquired byte evidence and a partial match must disclose its differences',()=>{
  const option=first(filledSet());option.evidence[0]!.media='image';
  option.comparison.axes.structure.strength='partial';
  expect(summarizeCandidateComparison(option).issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['inspected_image_digest_missing','partial_match_difference_missing']));
  option.evidence[0]!.artifactSha256='1'.repeat(64);option.comparison.axes.structure.differences=['Different numerical values with the same required relation.'];
  expect(summarizeCandidateComparison(option).evidenceReviewable).toBe(true);
});

test('exact Grade3 scope and primary research hierarchy must be evidenced independently',()=>{
  const input=filledSet();input.nativeContext!.resolvedScopes[0]!.grade=null;
  input.slots[0]!.unitId='U-D';input.researchContext!.types[0]!.detailId='HD11-d1';
  expect(codes(input)).toEqual(expect.arrayContaining(['native_grade_or_unit_scope_unqualified','research_unit_mismatch','research_catalog_hierarchy_conflict']));
});

test('preferred and alternate ordinals are recommendations and duplicate options are reported',()=>{
  const input=filledSet();first(input).recommendation.ordinal=2;
  input.slots[0]!.candidates[1]!.question.lecture_key=first(input).question.lecture_key;
  expect(codes(input)).toEqual(expect.arrayContaining(['ordinal_role_conflict','duplicate_ordinal','duplicate_slot_question']));
  const draft=filledSet();draft.slots[0]!.primaryResearchTypeId=null;draft.slots[0]!.difficulty=null;
  expect(codes(draft)).toEqual(expect.arrayContaining(['primary_research_type_unknown','slot_difficulty_unassigned']));
  const gap=filledSet();gap.slots[0]!.candidates[1]!.recommendation.ordinal=3;
  expect(codes(gap)).toContain('ordinal_sequence_incomplete');
});
