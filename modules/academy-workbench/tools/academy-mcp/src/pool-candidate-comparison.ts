import {z} from 'zod';

/** Domain review only: this module performs no acquisition, ranking model, persistence or Academy action. */
export const POOL_COMPARISON_RESEARCH_REVISION = '07edb2dea2e5997aea4318f0fa2efa21dde633df';
export const POOL_DIFFICULTY_POINTS = Object.freeze({'중':3,'상':5,'최상':6} as const);
export const POOL_UNIT_DIFFICULTY_QUOTAS = Object.freeze({
  'U-M':Object.freeze({'중':4,'상':3,'최상':1}),
  'U-D':Object.freeze({'중':4,'상':2,'최상':2}),
  'U-C':Object.freeze({'중':4,'상':3,'최상':1}),
} as const);
const units = ['U-M','U-D','U-C'] as const;
const difficulties = ['중','상','최상'] as const;
const axes = ['structure','reasoning','representation','conditions','errors','transfer'] as const;
const text = z.string().min(1).max(4096).refine(value=>value.trim().length>0,'A nonblank value is required.');
const id = text.max(1024);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.string().regex(/^[a-f0-9]{40}$/);
const nativeId = z.string().regex(/^[1-9][0-9]{0,15}$/);
const unit = z.enum(units);
const difficulty = z.enum(difficulties);
const typeId = z.string().regex(/^H[MDC][1-9][0-9]-d[1-9][0-9]*-T[0-9]{2}$/);
const detailId = z.string().regex(/^H[MDC][1-9][0-9]-d[1-9][0-9]*$/);
const ids = z.array(id).max(128);

export const poolResearchSourceRefSchema = z.object({
  owner:z.literal('math-research-module'),revision,path:id,sha256:sha,pointer:id,
}).strict();
export const poolCandidateEvidenceSchema = z.object({
  id,kind:z.enum(['prompt','diagram','answer','official_solution','pool_difficulty','response_mode']),
  inspection:z.enum(['inspected','returned_uninspected','unreadable']),
  sourceSha256:sha,artifactSha256:sha.nullable(),media:z.enum(['text','image','metadata']),
  locator:text,observation:text,
}).strict();
const axisSchema = z.object({
  strength:z.enum(['strong','partial','weak','conflict','unknown']),rationale:text.nullable(),
  researchRefs:z.array(poolResearchSourceRefSchema).max(64),nativeEvidenceIds:ids,
  differences:z.array(text).max(32),
}).strict();
export const poolCandidateSchema = z.object({
  id,
  question:z.object({
    namespace:z.literal('academy_item'),lecture_key:nativeId,pat_no:nativeId,labelExact:text,
    hierarchyId:id,selectorSha256:sha,sourceSha256:sha,observedAt:z.iso.datetime({offset:true}),
    q_code:id.nullable().optional(),paperKey:id.nullable().optional(),
  }).strict(),
  difficulty:z.object({value:difficulty.nullable(),rawValue:text.nullable(),mappingRationale:text.nullable(),evidenceIds:ids}).strict(),
  responseMode:z.object({value:z.enum(['constructed','descriptive','other']).nullable(),evidenceIds:ids}).strict(),
  evidence:z.array(poolCandidateEvidenceSchema).max(128),
  promptEvidenceIds:ids,
  officialSolution:z.object({
    state:z.enum(['unknown','not_returned','returned_uninspected','unreadable','inspected']),evidenceIds:ids,
  }).strict(),
  analystSolution:z.object({
    state:z.enum(['not_prepared','derived']),attribution:z.literal('assistant-analysis'),
    reasoning:text.nullable(),basedOnEvidenceIds:ids,
  }).strict(),
  comparison:z.object({
    attribution:z.literal('assistant-analysis'),
    axes:z.object(Object.fromEntries(axes.map(axis=>[axis,axisSchema])) as Record<typeof axes[number],typeof axisSchema>).strict(),
    microstepMapping:z.array(z.object({
      researchMicrostepId:id,researchRef:poolResearchSourceRefSchema,
      candidateRequiredAction:text.nullable(),basis:z.enum(['explicit_prompt','official_solution','analyst_derivation','unknown']),
      nativeEvidenceIds:ids,
    }).strict()).max(64),
    duplicateGroupProposal:id.nullable(),limitations:z.array(text).max(64),
  }).strict(),
  recommendation:z.object({
    role:z.enum(['preferred','alternate','unranked']),ordinal:z.union([z.literal(1),z.literal(2),z.literal(3)]).nullable(),
    rationale:text.nullable(),
  }).strict(),
}).strict();
export const poolCandidateSlotSchema = z.object({
  id,unitId:unit,primaryResearchTypeId:typeId.nullable(),difficulty:difficulty.nullable(),
  candidates:z.array(poolCandidateSchema).max(3),
}).strict();
export const poolCandidateSetSchema = z.object({
  schemaVersion:z.literal('academy.pool-candidate-set/1'),
  researchContext:z.object({
    owner:z.literal('math-research-module'),revision,
    pins:z.array(z.object({path:id,sha256:sha}).strict()).max(512),
    types:z.array(z.object({id:typeId,unitId:unit,detailId,source:poolResearchSourceRefSchema}).strict()).max(105),
  }).strict().nullable(),
  nativeContext:z.object({
    selectorSha256:sha,
    resolvedScopes:z.array(z.object({
      unitId:unit,hierarchyId:id,schoolStage:z.enum(['elementary','other']).nullable(),grade:z.number().int().min(1).max(12).nullable(),
      sourceSha256:sha,observedAt:z.iso.datetime({offset:true}),evidenceLocator:text,
    }).strict()).max(128),
    questionSnapshots:z.array(z.object({hierarchyId:id,pat_no:nativeId,sourceSha256:sha}).strict()).max(256),
  }).strict().nullable(),
  slots:z.array(poolCandidateSlotSchema).max(24),
}).strict();

export type PoolCandidate = z.infer<typeof poolCandidateSchema>;
export type PoolCandidateSet = z.infer<typeof poolCandidateSetSchema>;
export interface PoolReviewIssue {code:string;path:string;message:string}
const governance = Object.freeze({
  analysisAttribution:'assistant-analysis',status:'proposal_not_accepted',acceptance:'not_inferred',
  teacherLearningCompletion:'not_inferred',finalMembership:false,academyWrites:0,
  sourceQualification:'caller_supplied_evidence_not_independently_authenticated',
} as const);
const issue = (issues:PoolReviewIssue[],code:string,path:string,message:string) => issues.push({code,path,message});
const repeated = (values:string[]) => [...new Set(values.filter((value,index)=>values.indexOf(value)!==index))];

function inspectCandidate(candidate:PoolCandidate,path:string) {
  const issues:PoolReviewIssue[] = [];
  const evidence = new Map(candidate.evidence.map(entry=>[entry.id,entry]));
  for(const duplicate of repeated(candidate.evidence.map(entry=>entry.id))) issue(issues,'duplicate_evidence_id',path+'.evidence',duplicate);
  const requireEvidence = (refs:string[],kinds:PoolCandidate['evidence'][number]['kind'][],at:string) => {
    let valid = refs.length>0;
    for(const ref of refs) {
      const entry = evidence.get(ref);
      if(!entry) { issue(issues,'evidence_reference_missing',at,ref); valid=false; continue; }
      if(entry.inspection!=='inspected'||!kinds.includes(entry.kind)) { issue(issues,'evidence_not_inspected_or_wrong_kind',at,ref); valid=false; }
      if(entry.sourceSha256!==candidate.question.sourceSha256) { issue(issues,'stale_question_evidence',at,ref); valid=false; }
      if(entry.media==='image'&&entry.artifactSha256===null) { issue(issues,'inspected_image_digest_missing',at,ref); valid=false; }
    }
    if(!refs.length) issue(issues,'evidence_missing',at,'No inspected evidence was supplied.');
    return valid;
  };
  requireEvidence(candidate.promptEvidenceIds,['prompt'],path+'.promptEvidenceIds');
  if(candidate.difficulty.value===null||candidate.difficulty.rawValue===null) issue(issues,'pool_difficulty_unknown',path+'.difficulty','An explicit observed pool difficulty is required.');
  else if(candidate.difficulty.rawValue!==candidate.difficulty.value&&!candidate.difficulty.mappingRationale) issue(issues,'difficulty_mapping_unexplained',path+'.difficulty','Preserve and explain normalization of the raw pool value.');
  requireEvidence(candidate.difficulty.evidenceIds,['pool_difficulty'],path+'.difficulty.evidenceIds');
  if(candidate.responseMode.value!=='constructed'&&candidate.responseMode.value!=='descriptive') issue(issues,'response_mode_not_qualified',path+'.responseMode','Only evidenced constructed or descriptive responses qualify.');
  requireEvidence(candidate.responseMode.evidenceIds,['response_mode'],path+'.responseMode.evidenceIds');
  if(candidate.officialSolution.state==='inspected') requireEvidence(candidate.officialSolution.evidenceIds,['official_solution'],path+'.officialSolution.evidenceIds');
  else if(candidate.officialSolution.state==='unknown'||candidate.officialSolution.state==='not_returned') {
    if(candidate.officialSolution.evidenceIds.length) issue(issues,'solution_evidence_state_conflict',path+'.officialSolution','Unknown or not-returned solution content cannot cite acquired solution evidence.');
  } else {
    if(!candidate.officialSolution.evidenceIds.length||candidate.officialSolution.evidenceIds.some(ref=>{
      const entry=evidence.get(ref);return !entry||entry.kind!=='official_solution'||entry.inspection!==candidate.officialSolution.state||entry.sourceSha256!==candidate.question.sourceSha256;
    })) issue(issues,'solution_evidence_state_conflict',path+'.officialSolution','Retain the exact uninspected or unreadable source observation.');
  }
  if(candidate.analystSolution.state==='derived') {
    if(!candidate.analystSolution.reasoning) issue(issues,'analyst_reasoning_missing',path+'.analystSolution','An attributed derivation must explain the reasoning.');
    requireEvidence(candidate.analystSolution.basedOnEvidenceIds,['prompt','diagram','answer','official_solution'],path+'.analystSolution.basedOnEvidenceIds');
    if(!candidate.analystSolution.basedOnEvidenceIds.some(ref=>['prompt','diagram'].includes(evidence.get(ref)?.kind??''))) issue(issues,'analyst_derivation_prompt_unbound',path+'.analystSolution','An answer alone cannot establish the required solution process.');
  } else if(candidate.analystSolution.reasoning!==null||candidate.analystSolution.basedOnEvidenceIds.length) issue(issues,'analyst_derivation_state_conflict',path+'.analystSolution','A not-prepared derivation cannot contain derived reasoning or references.');
  if(candidate.officialSolution.state!=='inspected'&&candidate.analystSolution.state!=='derived') issue(issues,'solution_process_unsubstantiated',path+'.analystSolution','The official solution was not inspected; an explicitly attributed analyst derivation is required.');
  for(const axis of axes) {
    const judgment=candidate.comparison.axes[axis],at=path+'.comparison.axes.'+axis;
    if(axis==='structure'||axis==='reasoning') {
      if(judgment.strength!=='strong'&&judgment.strength!=='partial') issue(issues,'core_similarity_not_supported',at,'Structure and required reasoning both need supported matching judgments.');
    }
    if(judgment.strength!=='unknown') {
      if(!judgment.rationale||!judgment.researchRefs.length) issue(issues,'comparison_rationale_or_research_missing',at,'A judgment needs a rationale and exact research references.');
      requireEvidence(judgment.nativeEvidenceIds,['prompt','diagram','answer','official_solution'],at+'.nativeEvidenceIds');
      if((axis==='structure'||axis==='reasoning')&&!judgment.nativeEvidenceIds.some(ref=>['prompt','diagram','official_solution'].includes(evidence.get(ref)?.kind??''))) issue(issues,'answer_only_core_comparison',at,'A final answer alone does not establish mathematical structure or required reasoning.');
      if(judgment.strength==='partial'&&!judgment.differences.length) issue(issues,'partial_match_difference_missing',at,'Explain the difference in a partial match.');
    } else if(judgment.rationale===null&&judgment.nativeEvidenceIds.length) issue(issues,'unknown_axis_unexplained',at,'Explain why observed evidence leaves this axis unknown.');
  }
  if(!candidate.comparison.microstepMapping.length) issue(issues,'microstep_mapping_missing',path+'.comparison.microstepMapping','Map at least one research action to the required candidate reasoning.');
  for(const [index,mapping] of candidate.comparison.microstepMapping.entries()) {
    const at=path+'.comparison.microstepMapping.'+index;
    if(mapping.basis==='unknown'||mapping.candidateRequiredAction===null) issue(issues,'microstep_mapping_unknown',at,'The required action and its evidence basis remain unknown.');
    else {
      requireEvidence(mapping.nativeEvidenceIds,mapping.basis==='official_solution'?['official_solution']:['prompt','diagram'],at+'.nativeEvidenceIds');
      if(mapping.basis==='official_solution'&&candidate.officialSolution.state!=='inspected') issue(issues,'official_solution_not_inspected',at,'Do not attribute an analyst mapping to an uninspected official solution.');
      if(mapping.basis==='analyst_derivation'&&candidate.analystSolution.state!=='derived') issue(issues,'analyst_derivation_missing',at,'This mapping requires the attributed analyst derivation.');
    }
  }
  const rec=candidate.recommendation;
  if(rec.role==='unranked'||rec.ordinal===null||rec.rationale===null) issue(issues,'ordinal_recommendation_missing',path+'.recommendation','Keep an explicit preferred/alternate ordinal and explanation.');
  else if((rec.role==='preferred'&&rec.ordinal!==1)||(rec.role==='alternate'&&rec.ordinal===1)) issue(issues,'ordinal_role_conflict',path+'.recommendation','Preferred is ordinal 1; alternates are ordinal 2 or 3.');
  return {evidenceReviewable:issues.length===0,issues,officialSolutionState:candidate.officialSolution.state,
    analystDerivation:candidate.analystSolution.state,limitations:[...candidate.comparison.limitations,
      ...(candidate.officialSolution.state==='inspected'?[]:['Official solution was not inspected; any analyst derivation is separate evidence.'])]};
}

/** Reviews supplied evidence only; does not independently authenticate source claims or choose a winner. */
export function summarizeCandidateComparison(input:unknown) {
  return {...inspectCandidate(poolCandidateSchema.parse(input),'candidate'),governance};
}

/** A pending draft is a valid shape. Readiness is derived from explicit missing/conflicting evidence. */
export function reviewCandidateSet(input:unknown) {
  const parsed=poolCandidateSetSchema.safeParse(input);
  if(!parsed.success) return {inputValid:false,readiness:'draft' as const,issues:parsed.error.issues.map(entry=>({
    code:'invalid_input',path:entry.path.map(String).join('.'),message:entry.message,
  })),summary:null,governance};
  const set=parsed.data,issues:PoolReviewIssue[]=[],research=set.researchContext,native=set.nativeContext;
  const types=new Map(research?.types.map(entry=>[entry.id,entry])??[]);
  const pins=new Map(research?.pins.map(entry=>[entry.path,entry.sha256])??[]);
  if(!research) issue(issues,'research_context_unknown','researchContext','The pinned source catalog has not been supplied.');
  else {
    if(research.revision!==POOL_COMPARISON_RESEARCH_REVISION) issue(issues,'stale_research_context','researchContext.revision','The research projection remains bound to its immutable source revision.');
    for(const value of repeated(research.types.map(entry=>entry.id))) issue(issues,'duplicate_research_catalog_type','researchContext.types',value);
    for(const value of repeated(research.pins.map(entry=>entry.path))) issue(issues,'duplicate_research_pin','researchContext.pins',value);
  }
  const checkResearchRef=(ref:z.infer<typeof poolResearchSourceRefSchema>,path:string) => {
    if(ref.revision!==research?.revision||ref.revision!==POOL_COMPARISON_RESEARCH_REVISION||pins.get(ref.path)!==ref.sha256) issue(issues,'stale_or_unpinned_research_reference',path,'Research revision, path and hash must match the supplied immutable pins.');
  };
  for(const [index,entry] of (research?.types??[]).entries()) {
    checkResearchRef(entry.source,'researchContext.types.'+index+'.source');
    if(!entry.id.startsWith(entry.detailId+'-T')||entry.id[1]!==entry.unitId[2]) issue(issues,'research_catalog_hierarchy_conflict','researchContext.types.'+index,'Type, detail and root identities conflict.');
  }
  if(!native) issue(issues,'native_context_unknown','nativeContext','Current native observations have not been supplied.');
  if(set.slots.length!==24) issue(issues,'slot_count_incomplete','slots',`Expected 24 slots; observed ${set.slots.length}.`);
  for(const duplicate of repeated(set.slots.map(slot=>slot.id))) issue(issues,'duplicate_slot_id','slots',duplicate);
  const primaryTypes=set.slots.flatMap(slot=>slot.primaryResearchTypeId?[slot.primaryResearchTypeId]:[]);
  for(const duplicate of repeated(primaryTypes)) issue(issues,'duplicate_primary_research_type','slots',duplicate);
  const assignments:{key:string;path:string}[]=[],allCandidates:string[]=[],candidateReviews:{slotId:string;candidateId:string;evidenceReviewable:boolean;limitations:string[]}[]=[];
  const nativeCandidateOccurrences:{lecture_key:string;slotId:string;candidateId:string;role:PoolCandidate['recommendation']['role']}[]=[];
  const bands=Object.fromEntries(difficulties.map(value=>[value,set.slots.filter(slot=>slot.difficulty===value).length])) as Record<typeof difficulties[number],number>;
  const unitSummary=units.map(value=>({unitId:value,slots:set.slots.filter(slot=>slot.unitId===value).length,
    primaryTypes:new Set(set.slots.filter(slot=>slot.unitId===value).flatMap(slot=>slot.primaryResearchTypeId?[slot.primaryResearchTypeId]:[])).size,
    details:new Set(set.slots.filter(slot=>slot.unitId===value).flatMap(slot=>types.get(slot.primaryResearchTypeId??'')?.detailId??[])).size,
    smallUnits:new Set(set.slots.filter(slot=>slot.unitId===value).flatMap(slot=>{const detail=types.get(slot.primaryResearchTypeId??'')?.detailId;return detail?[detail.split('-d')[0]]:[];})).size,
    middleUnits:new Set(set.slots.filter(slot=>slot.unitId===value).flatMap(slot=>{const detail=types.get(slot.primaryResearchTypeId??'')?.detailId;return detail?[detail.slice(0,3)]:[];})).size,
    difficultyAssignments:Object.fromEntries(difficulties.map(band=>[band,set.slots.filter(slot=>slot.unitId===value&&slot.difficulty===band).length])) as Record<typeof difficulties[number],number>,
  }));
  for(const value of unitSummary) {
    if(value.slots!==8) issue(issues,'unit_slot_quota','slots',`${value.unitId} requires 8 slots; observed ${value.slots}.`);
    for(const band of difficulties) if(value.difficultyAssignments[band]!==POOL_UNIT_DIFFICULTY_QUOTAS[value.unitId][band]) issue(issues,'unit_difficulty_quota','slots',`${value.unitId}/${band} requires ${POOL_UNIT_DIFFICULTY_QUOTAS[value.unitId][band]}; observed ${value.difficultyAssignments[band]}.`);
  }
  for(const [band,count] of [['중',12],['상',8],['최상',4]] as const) if(bands[band]!==count) issue(issues,'difficulty_quota','slots',`${band} requires ${count} assignments; observed ${bands[band]}.`);
  for(const [slotIndex,slot] of set.slots.entries()) {
    const path='slots.'+slotIndex,type=types.get(slot.primaryResearchTypeId??'');
    if(!slot.primaryResearchTypeId) issue(issues,'primary_research_type_unknown',path+'.primaryResearchTypeId','Choose a distinct source-backed primary research type.');
    else if(!type) issue(issues,'research_type_not_in_catalog',path+'.primaryResearchTypeId',slot.primaryResearchTypeId);
    else if(type.unitId!==slot.unitId) issue(issues,'research_unit_mismatch',path+'.primaryResearchTypeId','The type belongs to another research root.');
    if(slot.difficulty===null) issue(issues,'slot_difficulty_unassigned',path+'.difficulty','The confirmed per-unit policy has not yet been assigned to this slot.');
    if(slot.candidates.length<2) issue(issues,'candidate_count_incomplete',path+'.candidates',`Expected 2–3 candidates; observed ${slot.candidates.length}.`);
    const preferred=slot.candidates.filter(candidate=>candidate.recommendation.role==='preferred');
    if(preferred.length!==1) issue(issues,'preferred_count',path+'.candidates','Exactly one preferred recommendation is required.');
    for(const duplicate of repeated(slot.candidates.map(candidate=>candidate.question.lecture_key))) issue(issues,'duplicate_slot_question',path+'.candidates',duplicate);
    for(const duplicate of repeated(slot.candidates.flatMap(candidate=>candidate.recommendation.ordinal===null?[]:[String(candidate.recommendation.ordinal)]))) issue(issues,'duplicate_ordinal',path+'.candidates',duplicate);
    const ordinals=slot.candidates.flatMap(candidate=>candidate.recommendation.ordinal===null?[]:[candidate.recommendation.ordinal]).sort((left,right)=>left-right);
    if(slot.candidates.length>=2&&ordinals.some((ordinal,index)=>ordinal!==index+1)) issue(issues,'ordinal_sequence_incomplete',path+'.candidates','Use contiguous recommendation ordinals 1 through the option count.');
    if(preferred[0]) assignments.push({key:preferred[0].question.lecture_key,path});
    for(const [candidateIndex,candidate] of slot.candidates.entries()) {
      const at=path+'.candidates.'+candidateIndex,q=candidate.question;
      allCandidates.push(candidate.id);
      nativeCandidateOccurrences.push({lecture_key:q.lecture_key,slotId:slot.id,candidateId:candidate.id,role:candidate.recommendation.role});
      const reviewed=inspectCandidate(candidate,at);issues.push(...reviewed.issues);
      candidateReviews.push({slotId:slot.id,candidateId:candidate.id,evidenceReviewable:reviewed.evidenceReviewable,limitations:reviewed.limitations});
      if(candidate.difficulty.value!==null&&slot.difficulty!==null&&candidate.difficulty.value!==slot.difficulty) issue(issues,'candidate_difficulty_mismatch',at+'.difficulty','This option does not meet its slot difficulty.');
      if(native) {
        if(q.selectorSha256!==native.selectorSha256) issue(issues,'stale_native_selector',at+'.question','The selector differs from the current native observation.');
        if(!native.questionSnapshots.some(snapshot=>snapshot.hierarchyId===q.hierarchyId&&snapshot.pat_no===q.pat_no&&snapshot.sourceSha256===q.sourceSha256)) issue(issues,'stale_question_snapshot',at+'.question','The exact question page is not in the current observation set.');
        const scope=native.resolvedScopes.find(scope=>scope.unitId===slot.unitId&&scope.hierarchyId===q.hierarchyId);
        if(!scope||scope.schoolStage!=='elementary'||scope.grade!==3) issue(issues,'native_grade_or_unit_scope_unqualified',at+'.question.hierarchyId','The exact elementary Grade 3 unit scope is not evidenced.');
      }
      for(const axis of axes) for(const [refIndex,ref] of candidate.comparison.axes[axis].researchRefs.entries()) checkResearchRef(ref,at+'.comparison.axes.'+axis+'.researchRefs.'+refIndex);
      for(const axis of ['structure','reasoning'] as const) if(type&&!candidate.comparison.axes[axis].researchRefs.some(ref=>ref.path===type.source.path&&(ref.pointer===type.source.pointer||ref.pointer.startsWith(type.source.pointer+'/')))) issue(issues,'primary_research_evidence_unbound',at+'.comparison.axes.'+axis,'Core comparison must reference the exact primary type, not merely another source object.');
      for(const [mappingIndex,mapping] of candidate.comparison.microstepMapping.entries()) {
        checkResearchRef(mapping.researchRef,at+'.comparison.microstepMapping.'+mappingIndex+'.researchRef');
        if(slot.primaryResearchTypeId&&!mapping.researchMicrostepId.startsWith(slot.primaryResearchTypeId+'-A')) issue(issues,'foreign_research_microstep',at+'.comparison.microstepMapping.'+mappingIndex,'A mapped action must belong to the slot primary research type.');
      }
    }
  }
  for(const duplicate of repeated(allCandidates)) issue(issues,'duplicate_candidate_id','slots',duplicate);
  for(const duplicate of repeated(assignments.map(entry=>entry.key))) issue(issues,'duplicate_primary_native_question','slots',duplicate);
  const nativeGroups=new Map<string,typeof nativeCandidateOccurrences>();
  for(const occurrence of nativeCandidateOccurrences) {
    const group=nativeGroups.get(occurrence.lecture_key)??[];group.push(occurrence);nativeGroups.set(occurrence.lecture_key,group);
  }
  const sharedNativeQuestions=[...nativeGroups.entries()].filter(([,occurrences])=>new Set(occurrences.map(entry=>entry.slotId)).size>1)
    .map(([lecture_key,occurrences])=>({lecture_key,occurrences}));
  for(const shared of sharedNativeQuestions) issue(issues,'shared_native_question_across_slots','slots',
    `${shared.lecture_key} appears in ${new Set(shared.occurrences.map(entry=>entry.slotId)).size} slots; shared alternatives remain visible draft overlaps, not additional candidate breadth.`);
  if(nativeGroups.size<48) issue(issues,'distinct_native_candidate_count_incomplete','slots',`Expected at least 48 distinct native question candidates for 24 slots; observed ${nativeGroups.size}.`);
  const proposedGroups=set.slots.flatMap(slot=>slot.candidates.filter(candidate=>candidate.recommendation.role==='preferred').flatMap(candidate=>candidate.comparison.duplicateGroupProposal?[candidate.comparison.duplicateGroupProposal]:[]));
  for(const duplicate of repeated(proposedGroups)) issue(issues,'possible_semantic_duplicate','slots',duplicate);
  const points=difficulties.reduce((sum,value)=>sum+bands[value]*POOL_DIFFICULTY_POINTS[value],0);
  if(points!==100) issue(issues,'point_total_incomplete','slots',`The explicit pool-difficulty scoring policy yields ${points}, not 100.`);
  return {inputValid:true,readiness:issues.length?'draft' as const:'reviewable' as const,issues,
    summary:{slots:set.slots.length,unitCoverage:unitSummary,difficultyAssignments:bands,points,
      distinctPrimaryResearchTypes:new Set(primaryTypes).size,distinctPreferredNativeQuestions:new Set(assignments.map(entry=>entry.key)).size,
      candidateOptions:set.slots.reduce((sum,slot)=>sum+slot.candidates.length,0),distinctCandidateNativeQuestions:nativeGroups.size,
      sharedNativeQuestions,candidateReviews,
      researchWarnings:primaryTypes.includes('HC11-d1-T02')?[{typeId:'HC11-d1-T02',status:'proposed_not_applied',
        reason:'The pinned source retains an unapplied correction proposal concerning conditions that determine the center.'}]:[]},governance};
}
