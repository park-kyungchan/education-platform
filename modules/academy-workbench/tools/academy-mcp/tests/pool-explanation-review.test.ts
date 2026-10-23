import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {POOL_COMPARISON_RESEARCH_REVISION,POOL_UNIT_DIFFICULTY_QUOTAS,type PoolCandidate,type PoolCandidateSet} from '../src/pool-candidate-comparison.ts';
import {candidateExplanationPacketSchema,reviewCandidateExplanations,buildCandidateExplanationView,type CandidateExplanationPacket} from '../src/pool-explanation-review.ts';

// Entirely invented source inputs. No image, actual question, student, account or service is read.
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const researchHash='a'.repeat(64),nativeHash='b'.repeat(64),selector='c'.repeat(64);
const ref=(pointer:string)=>({owner:'math-research-module' as const,revision:POOL_COMPARISON_RESEARCH_REVISION,path:'fixtures/research.json',sha256:researchHash,pointer});
function candidate(index:number,option:number,typeId:string,unit:string,band:'중'|'상'|'최상'):PoolCandidate{
  const evidence=(id:string,kind:'prompt'|'official_solution'|'response_mode'|'pool_difficulty')=>({id,kind,inspection:'inspected' as const,sourceSha256:nativeHash,artifactSha256:'d'.repeat(64),media:'image' as const,locator:'synthetic:'+id,observation:'Fictional observation for a source-bound contract test.'});
  const axis=()=>({strength:'strong' as const,rationale:'A fictional bounded mathematical relation and required process.',researchRefs:[ref('/types/'+index)],nativeEvidenceIds:['p'],differences:[]});
  return {id:'candidate-'+index+'-'+option,question:{namespace:'academy_item',lecture_key:String(10000+index*10+option),pat_no:String(100+index),labelExact:'Invented test label',hierarchyId:'scope-'+unit,selectorSha256:selector,sourceSha256:nativeHash,observedAt:'2026-10-19T06:00:00Z'},
    difficulty:{value:band,rawValue:band,mappingRationale:null,evidenceIds:['d']},responseMode:{value:'descriptive',evidenceIds:['r']},
    evidence:[evidence('p','prompt'),evidence('o','official_solution'),evidence('d','pool_difficulty'),evidence('r','response_mode')],promptEvidenceIds:['p'],
    officialSolution:{state:'inspected',evidenceIds:['o']},analystSolution:{state:'derived',attribution:'assistant-analysis',reasoning:'Independently derive the fictional result from the prompt.',basedOnEvidenceIds:['p']},
    comparison:{attribution:'assistant-analysis',axes:{structure:axis(),reasoning:axis(),representation:{strength:'unknown',rationale:null,researchRefs:[],nativeEvidenceIds:[],differences:[]},conditions:{strength:'unknown',rationale:null,researchRefs:[],nativeEvidenceIds:[],differences:[]},errors:{strength:'unknown',rationale:null,researchRefs:[],nativeEvidenceIds:[],differences:[]},transfer:{strength:'unknown',rationale:null,researchRefs:[],nativeEvidenceIds:[],differences:[]}},microstepMapping:[{researchMicrostepId:typeId+'-A01',researchRef:ref('/designs/'+index+'/microsteps/0'),candidateRequiredAction:'Perform the stated fictional reasoning action.',basis:'analyst_derivation',nativeEvidenceIds:['p']}],duplicateGroupProposal:null,limitations:['Fictional fixture, with no authenticated source or acceptance claim.']},recommendation:{role:option===1?'preferred':'alternate',ordinal:option as 1|2|3,rationale:'A fictional ordinal proposal, not a probability.'}};
}
function fixture(options=2){
  const slots:PoolCandidateSet['slots']=[];
  for(const unit of ['U-M','U-D','U-C'] as const){
    const bands=(['중','상','최상'] as const).flatMap(band=>Array.from({length:POOL_UNIT_DIFFICULTY_QUOTAS[unit][band]},()=>band));
    for(let i=0;i<8;i++){
      const index=slots.length,typeId=`H${unit[2]}11-d${i+1}-T01`,band=bands[i]!;
      slots.push({id:'slot-'+index,unitId:unit,primaryResearchTypeId:typeId,difficulty:band,candidates:Array.from({length:index===0?options:2},(_,n)=>candidate(index,n+1,typeId,unit,band))});
    }
  }
  const set:PoolCandidateSet={schemaVersion:'academy.pool-candidate-set/1',researchContext:{owner:'math-research-module',revision:POOL_COMPARISON_RESEARCH_REVISION,pins:[{path:'fixtures/research.json',sha256:researchHash}],types:slots.map((s,i)=>({id:s.primaryResearchTypeId!,unitId:s.unitId,detailId:s.primaryResearchTypeId!.split('-T')[0]!,source:ref('/types/'+i)}))},nativeContext:{selectorSha256:selector,resolvedScopes:(['U-M','U-D','U-C'] as const).map(unit=>({unitId:unit,hierarchyId:'scope-'+unit,schoolStage:'elementary',grade:3,sourceSha256:nativeHash,observedAt:'2026-10-19T06:00:00Z',evidenceLocator:'synthetic scope'})),questionSnapshots:slots.map(s=>({hierarchyId:s.candidates[0]!.question.hierarchyId,pat_no:s.candidates[0]!.question.pat_no,sourceSha256:nativeHash}))},slots};
  const research={schema:'month-end.research-projection.v1',owner:'math-research-module',revision:POOL_COMPARISON_RESEARCH_REVISION,manifest:[{path:'fixtures/research.json',sha256:researchHash}],types:slots.map((s,i)=>({id:s.primaryResearchTypeId,source:ref('/types/'+i),examples:[{source:ref('/examples/'+i)}]})),designs:slots.map((s,i)=>({typeId:s.primaryResearchTypeId,source:ref('/designs/'+i),microsteps:[{id:s.primaryResearchTypeId+'-A01',source:ref('/designs/'+i+'/microsteps/0')}]}))};
  const context={candidateSetJson:JSON.stringify(set),researchProjectionJson:JSON.stringify(research)};
  const explanations=slots[0]!.candidates.map((original,i)=>({candidateId:original.id,observations:[
    {id:'prompt',role:'prompt_requirement' as const,certainty:'explicit' as const,statement:i===0?'The invented prompt explicitly asks to explain the relation.':'The invented prompt asks for the answer only, without explanation.',evidenceIds:['p']},
    {id:'official',role:'official_solution' as const,certainty:'explicit' as const,statement:'The fictional official solution explains the observed relation.',evidenceIds:['o']},
    {id:'derived',role:'assistant_derivation' as const,certainty:'inferred' as const,statement:'The assistant independently derives the same fictional result.',evidenceIds:['p']},
  ],alignments:[
    {id:'given-match',researchUnitId:'given',observationIds:['prompt'],state:'supported' as const,candidateElicitation:'explicit' as const,rationale:'The fictional prompt provides the same known and unknown quantities.',differences:[]},
    {id:'relation-match',researchUnitId:'relation',observationIds:['derived'],state:'supported' as const,candidateElicitation:'inferred' as const,rationale:'The independent derivation uses the same relation on the quantities.',differences:[]},
    {id:'action-match',researchUnitId:'explain',observationIds:[i===0?'prompt':'derived'],state:i===0?'supported' as const:'partial' as const,candidateElicitation:i===0?'explicit' as const:'not_elicited' as const,rationale:i===0?'The first prompt explicitly elicits a written explanation.':'The second method can be derived but explanation is not requested.',differences:i===0?[]:['The answer-only prompt does not elicit the research explanatory activity.']},
  ],dimensions:(['structure','reasoning','representation','conditions','errors','transfer'] as const).map(dimension=>({dimension,state:dimension==='structure'?'supported' as const:dimension==='reasoning'?(i===0?'supported' as const:'partial' as const):'not_assessed' as const,alignmentIds:dimension==='structure'?['given-match','relation-match']:dimension==='reasoning'?['relation-match','action-match']:[],rationale:'Coverage is limited to the exact fictional observations and mapped units.',unknowns:['structure','reasoning'].includes(dimension)?[]:['No dimension-specific observation was supplied for this fixture.']})),unknowns:['No student execution or strategy was observed by this fictional test.']}));
  const packet:CandidateExplanationPacket={schemaVersion:'academy.candidate-explanations/1',identity:{projectId:'education-platform',workId:'fictional-test-work',registration:'local-record',globallyRegistered:false},inputBindings:{candidateSetSha256:digest(context.candidateSetJson),researchProjectionSha256:digest(context.researchProjectionJson),researchRevision:POOL_COMPARISON_RESEARCH_REVISION},slots:[{slotId:'slot-0',researchTypeId:'HM11-d1-T01',researchUnits:[
    {id:'given',layer:'DATA',classification:'analyst_decomposition',statement:'Identify the fictional known quantities and requested unknown.',sourceRefs:[ref('/types/0')],dependsOnUnitIds:[]},
    {id:'relation',layer:'LOGIC',classification:'analyst_decomposition',statement:'Relate those quantities with the source-backed invariant.',sourceRefs:[ref('/designs/0')],dependsOnUnitIds:['given']},
    {id:'explain',layer:'ACTION',classification:'source_observation',statement:'Write an explanation of why the mathematical relation holds.',sourceRefs:[ref('/designs/0/microsteps/0')],dependsOnUnitIds:['relation']},
  ],layerCoverage:[{layer:'DATA',state:'represented',unitIds:['given'],unknown:null},{layer:'LOGIC',state:'represented',unitIds:['relation'],unknown:null},{layer:'ACTION',state:'represented',unitIds:['explain'],unknown:null},{layer:'GOVERNANCE',state:'not_recorded',unitIds:[],unknown:'No original research governance statement was supplied; workflow controls remain separate.'}],candidates:explanations,pairwiseComparisons:[{leftCandidateId:explanations[0]!.candidateId,rightCandidateId:explanations[1]!.candidateId,preferredCandidateId:explanations[0]!.candidateId,preferenceState:'established',preferenceBasis:'evidence_comparison',unknowns:[],dimensions:['reasoning'],rationale:'Prefer the first prompt because it explicitly elicits the explanatory activity missing from the second.',tradeoffs:explanations.slice(0,2).map((c,i)=>({candidateId:c.candidateId,dimension:'reasoning' as const,alignmentIds:['action-match'],advantage:i===0?'Explicitly elicits the mapped research explanation.':'Provides a shorter answer-only calculation alternative.',limitation:i===0?'This observation does not establish learner understanding.':'Does not require the mapped explanatory student activity.'}))}]}]};
  return {packet,context,set,research};
}
const codes=(packet:unknown,context:ReturnType<typeof fixture>['context'])=>reviewCandidateExplanations(packet,context).issues.map(row=>row.code);

test('source-bound atomic explanations preserve layers, unknowns, method attribution and relative preference without effects',()=>{
  const {packet,context}=fixture(),before=JSON.stringify({packet,context}),result=reviewCandidateExplanations(packet,context);
  expect(result.issues).toEqual([]);expect(result.readiness).toBe('reviewable');expect(result.summary?.slots).toBe(1);
  expect(result.summary?.candidates).toBe(2);expect(result.slots[0]!.layerCoverage[3]!.state).toBe('not_recorded');
  expect(buildCandidateExplanationView(result,'slot-0').status).toBe('available');expect(buildCandidateExplanationView(result,'missing').status).toBe('held');
  expect(result.governance.finalMembershipApplied).toBe(false);expect(result.governance.nativePermissionGranted).toBe(false);expect(result.governance.acceptance).toBe('not_inferred');
  expect(JSON.stringify({packet,context})).toBe(before);
});

test('exact JSON bytes and original research pointers cannot be silently re-pinned or relabelled',()=>{
  const {packet,context}=fixture();expect(codes(packet,{...context,candidateSetJson:context.candidateSetJson+'\n'})).toContain('candidate_bytes_changed');
  expect(codes(packet,{...context,researchProjectionJson:context.researchProjectionJson+'\n'})).toContain('research_bytes_changed');
  packet.slots[0]!.researchUnits[0]!.sourceRefs[0]!.pointer='/types/1';expect(codes(packet,context)).toContain('unbound_original_source');
  packet.slots[0]!.researchUnits[0]!.sourceRefs[0]=ref('/types/0');packet.slots[0]!.researchUnits[0]!.sourceRefs[0]!.sha256='f'.repeat(64);
  expect(codes(packet,context)).toContain('unbound_original_source');
});

test('the complete owning projection retains upper-grade source IDs without filtering bytes or widening selected Grade3 slots',()=>{
  const {packet,context,research}=fixture();
  // The authentic source uses this upper-grade ID shape; all content and digests here remain fictional.
  research.types.push({id:'G4-M-SD01-T01',source:ref('/upper/types/0'),examples:[{source:ref('/upper/examples/0')}]});
  research.designs.push({typeId:'G4-M-SD01-T01',source:ref('/upper/designs/0'),microsteps:[{id:'G4-M-SD01-T01-A01',source:ref('/upper/designs/0/microsteps/0')}]});
  context.researchProjectionJson=JSON.stringify(research);packet.inputBindings.researchProjectionSha256=digest(context.researchProjectionJson);
  const originalBytes=context.researchProjectionJson,result=reviewCandidateExplanations(packet,context);
  expect(result.issues).toEqual([]);expect(result.readiness).toBe('reviewable');expect(context.researchProjectionJson).toBe(originalBytes);
  const filtered={...research,types:research.types.filter(row=>row.id!=='G4-M-SD01-T01'),designs:research.designs.filter(row=>row.typeId!=='G4-M-SD01-T01')};
  expect(codes(packet,{...context,researchProjectionJson:JSON.stringify(filtered)})).toContain('research_bytes_changed');
  packet.slots[0]!.researchTypeId='G4-M-SD01-T01';expect(codes(packet,context)).toContain('invalid_explanation');
});

test('official and assistant solutions never manufacture an explicit required student action',()=>{
  const {packet,context}=fixture();const second=packet.slots[0]!.candidates[1]!;
  second.alignments[2]!.state='supported';expect(codes(packet,context)).toContain('solution_does_not_establish_prompt_requirement');
  second.alignments[2]!.candidateElicitation='explicit';expect(codes(packet,context)).toContain('explicit_requirement_unbound');
  second.observations[2]!.certainty='explicit';expect(codes(packet,context)).toContain('derivation_is_not_explicit_prompt');
  second.observations[1]!.evidenceIds=['p'];expect(codes(packet,context)).toContain('official_solution_not_observed');
});

test('stale, uninspected and wrongly typed evidence stays held instead of becoming an explanation claim',()=>{
  const {packet,context,set}=fixture();set.slots[0]!.candidates[0]!.evidence[0]!.inspection='returned_uninspected';
  context.candidateSetJson=JSON.stringify(set);packet.inputBindings.candidateSetSha256=digest(context.candidateSetJson);
  expect(codes(packet,context)).toContain('candidate_set_not_reviewable');expect(codes(packet,context)).toContain('observation_evidence_unqualified');
  const result=reviewCandidateExplanations(packet,context);expect(buildCandidateExplanationView(result,'slot-0').status).toBe('available_with_gaps');
  expect(result.readiness).toBe('draft');expect(result.governance.automaticRankingEnabled).toBe(false);
  expect(result.governance.sourceClaims).toBe('caller_supplied_not_independently_authenticated');
});

test('missing units, dimension coverage, dependency cycles and partial differences remain explicit issues',()=>{
  const {packet,context}=fixture();const slot=packet.slots[0]!;
  slot.researchUnits[0]!.dependsOnUnitIds=['explain'];expect(codes(packet,context)).toContain('research_dependency_cycle');
  slot.candidates[1]!.alignments[2]!.differences=[];expect(codes(packet,context)).toContain('partial_difference_missing');
  slot.candidates[0]!.alignments.pop();expect(codes(packet,context)).toContain('research_unit_unaddressed');
  slot.candidates[0]!.dimensions[5]!.dimension='errors';expect(codes(packet,context)).toContain('dimension_missing_or_duplicate');
  slot.layerCoverage[3]!.unknown=null;expect(codes(packet,context)).toContain('layer_unknown_unexplained');
});

test('all actual same-slot alternatives and pairwise tradeoffs are required, including a third option',()=>{
  const {packet,context}=fixture(3);expect(codes(packet,context)).toContain('same_slot_pair_missing');
  const pair=packet.slots[0]!.pairwiseComparisons[0]!;pair.rightCandidateId='candidate-1-1';expect(codes(packet,context)).toContain('foreign_or_self_comparison');
  pair.rightCandidateId='candidate-0-2';pair.tradeoffs[1]!.candidateId=pair.leftCandidateId;expect(codes(packet,context)).toContain('one_sided_preference_reason');
  pair.tradeoffs[0]!.alignmentIds=['unobserved-action'];expect(codes(packet,context)).toContain('preference_evidence_unbound');
  pair.preferredCandidateId=null;expect(codes(packet,context)).toContain('preference_not_reestablished');
});

test('historical ordinals may remain unresolved without hiding known research or fabricating comparative advantages',()=>{
  const {packet,context}=fixture();const pair=packet.slots[0]!.pairwiseComparisons[0]!;
  pair.preferredCandidateId=null;pair.preferenceState='unresolved';pair.preferenceBasis='historical_ordinal_not_reestablished';
  pair.unknowns=['The historical ordinal did not record a direct comparative advantage between these two options.'];pair.tradeoffs=[];
  const result=reviewCandidateExplanations(packet,context),view=buildCandidateExplanationView(result,'slot-0');
  expect(result.issues).toEqual([]);expect(result.readiness).toBe('reviewable');expect(result.preferenceReadiness).toBe('ties_or_unresolved');
  expect(view.status).toBe('available_with_gaps');expect(view.slot?.researchUnits.length).toBe(3);expect(view.slot?.candidates.length).toBe(2);
  expect(result.governance.automaticRankingEnabled).toBe(false);expect(result.governance.pedagogicalGovernance.teacherAcceptance).toBe('not_inferred');
  expect(result.governance.layerTerminology.GOVERNANCE.userLabel).toBe('SECURITY(GOVERNANCE)');
  pair.preferredCandidateId='candidate-0-1';expect(codes(packet,context)).toContain('unresolved_preference_has_winner');
  pair.preferenceState='established';expect(codes(packet,context)).toContain('historical_preference_promoted');
});

test('a newly attributed comparison may differ from the historical ordinal without changing it or applying a winner',()=>{
  const {packet,context}=fixture(),original=context.candidateSetJson,pair=packet.slots[0]!.pairwiseComparisons[0]!;
  pair.preferredCandidateId='candidate-0-2';pair.rationale='The analyst now prioritizes the shorter required response; this changes a proposal only, not the historical source ordinal.';
  const result=reviewCandidateExplanations(packet,context);
  expect(result.readiness).toBe('reviewable');expect(result.preferenceReadiness).toBe('established_for_supplied_pairs');
  expect(context.candidateSetJson).toBe(original);expect(result.governance.finalMembershipApplied).toBe(false);
  expect(result.governance.automaticRankingEnabled).toBe(false);
});

test('a complete three-option graph can preserve every comparative reason as unresolved and keep all observations visible',()=>{
  const {packet,context}=fixture(3),slot=packet.slots[0]!;
  slot.pairwiseComparisons=[];
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)slot.pairwiseComparisons.push({leftCandidateId:slot.candidates[i]!.candidateId,rightCandidateId:slot.candidates[j]!.candidateId,preferredCandidateId:null,preferenceState:'unresolved',preferenceBasis:'historical_ordinal_not_reestablished',unknowns:['No direct comparative advantage was recorded for this actual pair.'],dimensions:['structure','reasoning'],rationale:'Keep the historical ordinal separate from the currently unestablished relative preference.',tradeoffs:[]});
  const result=reviewCandidateExplanations(packet,context);
  expect(result.issues).toEqual([]);expect(result.summary?.pairwiseComparisons).toBe(3);expect(result.summary?.unresolvedPreferences).toBe(3);
  expect(buildCandidateExplanationView(result,'slot-0').slot?.candidates.length).toBe(3);
});

test('strict domain packets reject semantic scores, authority claims, private locators and source payloads',()=>{
  const {packet,context}=fixture();expect(candidateExplanationPacketSchema.safeParse({...packet,accepted:true}).success).toBe(false);
  expect(candidateExplanationPacketSchema.safeParse({...packet,identity:{...packet.identity,globallyRegistered:true}}).success).toBe(false);
  packet.slots[0]!.researchUnits[0]!.statement='Source located at /home/example/private/source.png';expect(codes(packet,context)).toContain('invalid_explanation');
  packet.slots[0]!.researchUnits[0]!.statement='Retain only source-bound typed observations.';
  expect(candidateExplanationPacketSchema.safeParse({...packet,semanticSimilarity:0.99}).success).toBe(false);
  expect(reviewCandidateExplanations(packet,{...context,researchProjectionJson:'{broken'}).inputValid).toBe(false);
});
