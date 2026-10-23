import {createHash} from 'node:crypto';
import {z} from 'zod';
import {poolCandidateSetSchema,poolResearchSourceRefSchema,reviewCandidateSet,POOL_COMPARISON_RESEARCH_REVISION} from './pool-candidate-comparison.ts';

/** Academy explanation semantics only. No acquisition, model, persistence or action executor. */
const layers=['DATA','LOGIC','ACTION','GOVERNANCE'] as const;
const dimensions=['structure','reasoning','representation','conditions','errors','transfer'] as const;
const text=z.string().trim().min(8).max(4096).refine(value=>!/(?:https?:\/\/|data:image|\/home\/|\/root\/|\/opt\/data\/|-----BEGIN.*PRIVATE KEY)/i.test(value),'Keep original payloads and private transport locations outside the explanation.');
const id=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,1023}$/);
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const typeId=z.string().regex(/^H[MDC][1-9][0-9]-d[1-9][0-9]*-T[0-9]{2}$/);
const refs=z.array(poolResearchSourceRefSchema).min(1).max(32);
const names=z.array(id).max(128);
const researchUnitSchema=z.object({
  id,layer:z.enum(layers),classification:z.enum(['source_observation','analyst_decomposition']),
  statement:text,sourceRefs:refs,dependsOnUnitIds:names,
}).strict();
const observationSchema=z.object({
  id,role:z.enum(['prompt_requirement','official_solution','assistant_derivation']),
  certainty:z.enum(['explicit','inferred','unknown']),statement:text,evidenceIds:names,
}).strict();
const alignmentSchema=z.object({
  id,researchUnitId:id,observationIds:names,state:z.enum(['supported','partial','conflicts','unknown']),
  candidateElicitation:z.enum(['explicit','inferred','not_elicited','unknown']),rationale:text,
  differences:z.array(text).max(32),
}).strict();
const dimensionSchema=z.object({
  dimension:z.enum(dimensions),state:z.enum(['supported','partial','unknown','not_assessed']),
  alignmentIds:names,rationale:text,unknowns:z.array(text).max(32),
}).strict();
const explanationSchema=z.object({candidateId:id,observations:z.array(observationSchema).min(1).max(128),
  alignments:z.array(alignmentSchema).min(1).max(128),dimensions:z.array(dimensionSchema).length(6),unknowns:z.array(text).max(48),
}).strict();
const pairSchema=z.object({
  leftCandidateId:id,rightCandidateId:id,preferredCandidateId:id.nullable(),
  preferenceState:z.enum(['established','unresolved','tie']),
  preferenceBasis:z.enum(['evidence_comparison','historical_ordinal_not_reestablished']),unknowns:z.array(text).max(32),
  dimensions:z.array(z.enum(['structure','reasoning'])).min(1).max(2),rationale:text,
  tradeoffs:z.array(z.object({candidateId:id,dimension:z.enum(dimensions),alignmentIds:names,advantage:text.nullable(),limitation:text.nullable()}).strict()).max(12),
}).strict();
const slotSchema=z.object({
  slotId:id,researchTypeId:typeId,researchUnits:z.array(researchUnitSchema).min(1).max(128),
  layerCoverage:z.array(z.object({layer:z.enum(layers),state:z.enum(['represented','not_recorded','uninterpreted']),unitIds:names,unknown:text.nullable()}).strict()).length(4),
  candidates:z.array(explanationSchema).min(2).max(3),pairwiseComparisons:z.array(pairSchema).min(1).max(3),
}).strict();
export const candidateExplanationPacketSchema=z.object({
  schemaVersion:z.literal('academy.candidate-explanations/1'),
  identity:z.object({projectId:id,workId:id,registration:z.literal('local-record'),globallyRegistered:z.literal(false)}).strict(),
  inputBindings:z.object({candidateSetSha256:sha,researchProjectionSha256:sha,researchRevision:z.string().regex(/^[a-f0-9]{40}$/)}).strict(),
  slots:z.array(slotSchema).min(1).max(24),
}).strict();
export type CandidateExplanationPacket=z.infer<typeof candidateExplanationPacketSchema>;
export interface ExplanationInputs {candidateSetJson:string;researchProjectionJson:string}
export interface ExplanationIssue {code:string;path:string;message:string}
const projectionSchema=z.object({schema:z.literal('month-end.research-projection.v1'),owner:z.literal('math-research-module'),revision:id,
  manifest:z.array(z.object({path:z.string().min(1).max(1024),sha256:sha})).max(512),
  // The complete owning projection also contains upper-grade source IDs. Only selected slots use the Grade 3 namespace.
  types:z.array(z.object({id,source:poolResearchSourceRefSchema,examples:z.array(z.object({source:poolResearchSourceRefSchema}).passthrough())}).passthrough()).max(151),
  designs:z.array(z.object({typeId:id,source:poolResearchSourceRefSchema,microsteps:z.array(z.object({id,source:poolResearchSourceRefSchema}).passthrough()).max(128)}).passthrough()).max(151),
}).passthrough();
const hash=(value:string)=>createHash('sha256').update(value,'utf8').digest('hex');
const refKey=(ref:z.infer<typeof poolResearchSourceRefSchema>)=>JSON.stringify([ref.owner,ref.revision,ref.path,ref.sha256,ref.pointer]);
const repeats=(values:string[])=>[...new Set(values.filter((value,index)=>values.indexOf(value)!==index))];
const governance=Object.freeze({
  attribution:'assistant-analysis',status:'proposal_not_accepted',acceptance:'not_inferred',finalMembershipApplied:false,
  sourceWrites:0,nativePermissionGranted:false,sourceClaims:'caller_supplied_not_independently_authenticated',
  automaticRankingEnabled:false,
  controlsCrossLayers:['DATA','LOGIC','ACTION','GOVERNANCE'],
  layerTerminology:{GOVERNANCE:{userLabel:'SECURITY(GOVERNANCE)',normalizedLabel:'GOVERNANCE'}},
  sourceSecurity:{credentialOwner:'existing_native_owner',originalImages:'private_owner_custody',sourceAccess:'no_new_access_granted',sourceWrites:0},
  pedagogicalGovernance:{judgments:'attributed_proposals',historicalOrdinals:'not_a_new_comparative_reason',teacherAcceptance:'not_inferred',finalMembershipApplied:false},
  limits:['A source pointer and hash bind an input; they do not prove the interpretation is mathematically correct.',
    'An official or assistant solution does not prove that the prompt requires that method or that the student used it.',
    'Relative preference covers the supplied same-slot alternatives, not the entire question pool.'],
} as const);

/** Raw JSON bytes are hashed before parsing; never substitute a reserialized object for a file-byte identity. */
export function reviewCandidateExplanations(input:unknown,context:ExplanationInputs){
  const issues:ExplanationIssue[]=[];
  const issue=(code:string,path:string,message:string)=>issues.push({code,path,message});
  const fail=()=>({inputValid:false,readiness:'draft' as const,preferenceReadiness:'not_reviewable' as const,issues,slots:[] as CandidateExplanationPacket['slots'],summary:null,governance});
  const parsed=candidateExplanationPacketSchema.safeParse(input);
  if(!parsed.success){for(const row of parsed.error.issues)issue('invalid_explanation',row.path.join('.'),row.message);return fail();}
  const packet=parsed.data;
  if(typeof context?.candidateSetJson!=='string'||typeof context?.researchProjectionJson!=='string'
    ||Buffer.byteLength(context.candidateSetJson)>16_777_216||Buffer.byteLength(context.researchProjectionJson)>16_777_216){issue('input_bytes_invalid','inputs','Expected bounded explicit JSON strings.');return fail();}
  let setValue:unknown,projectionValue:unknown;
  try{setValue=JSON.parse(context.candidateSetJson);projectionValue=JSON.parse(context.researchProjectionJson);}catch{issue('input_json_invalid','inputs','The supplied JSON could not be parsed.');return fail();}
  const setParsed=poolCandidateSetSchema.safeParse(setValue),researchParsed=projectionSchema.safeParse(projectionValue);
  if(!setParsed.success||!researchParsed.success){issue('input_contract_invalid','inputs','The candidate set or owning research projection is invalid.');return fail();}
  const set=setParsed.data,research=researchParsed.data;
  if(reviewCandidateSet(set).readiness!=='reviewable')issue('candidate_set_not_reviewable','inputs.candidateSet','The existing independent pool evidence/identity/quota review must pass; this explanation does not replace it.');
  if(packet.inputBindings.candidateSetSha256!==hash(context.candidateSetJson))issue('candidate_bytes_changed','inputBindings','The exact candidate artifact bytes differ.');
  if(packet.inputBindings.researchProjectionSha256!==hash(context.researchProjectionJson))issue('research_bytes_changed','inputBindings','The exact research projection bytes differ.');
  if(packet.inputBindings.researchRevision!==POOL_COMPARISON_RESEARCH_REVISION||research.revision!==packet.inputBindings.researchRevision||set.researchContext?.revision!==research.revision)issue('research_revision_changed','inputBindings','Keep the immutable owning research revision.');
  const pins=new Map(research.manifest.map(row=>[row.path,row.sha256]));
  for(const duplicate of repeats(research.manifest.map(row=>row.path)))issue('ambiguous_research_pin','inputs.researchProjection',duplicate);
  for(const duplicate of repeats(research.types.map(row=>row.id)))issue('ambiguous_research_type','inputs.researchProjection',duplicate);
  for(const duplicate of repeats(research.designs.map(row=>row.typeId)))issue('ambiguous_research_design','inputs.researchProjection',duplicate);
  for(const duplicate of repeats(set.slots.map(row=>row.id)))issue('ambiguous_source_slot','inputs.candidateSet',duplicate);
  for(const duplicate of repeats(packet.slots.map(row=>row.slotId)))issue('duplicate_slot','slots',duplicate);
  for(const [slotIndex,slot] of packet.slots.entries()){
    const path=`slots.${slotIndex}`,native=set.slots.find(row=>row.id===slot.slotId),type=research.types.find(row=>row.id===slot.researchTypeId),design=research.designs.find(row=>row.typeId===slot.researchTypeId);
    if(!native||native.primaryResearchTypeId!==slot.researchTypeId||!type||!design){issue('slot_research_binding_invalid',path,'Slot and owning research type/design must match the supplied source set.');continue;}
    const allowed=new Set([type.source,...type.examples.map(row=>row.source),design.source,...design.microsteps.map(row=>row.source)].map(refKey));
    const units=new Map(slot.researchUnits.map(row=>[row.id,row]));
    for(const duplicate of repeats(slot.researchUnits.map(row=>row.id)))issue('duplicate_research_unit',path,duplicate);
    for(const [index,unit] of slot.researchUnits.entries()){
      const at=path+`.researchUnits.${index}`;
      for(const ref of unit.sourceRefs)if(!allowed.has(refKey(ref))||pins.get(ref.path)!==ref.sha256||ref.revision!==research.revision||!/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(ref.path)||ref.path.split('/').some(part=>part==='..'||part==='.'))issue('unbound_original_source',at,'Reference is not in this exact type, example, design or microstep of the owning projection.');
      for(const parent of unit.dependsOnUnitIds)if(!units.has(parent))issue('research_dependency_missing',at,parent);
    }
    const visited=new Set<string>(),visiting=new Set<string>();
    const visit=(id:string):void=>{if(visiting.has(id)){issue('research_dependency_cycle',path,id);return;}if(visited.has(id))return;visiting.add(id);for(const parent of units.get(id)?.dependsOnUnitIds??[])if(units.has(parent))visit(parent);visiting.delete(id);visited.add(id);};
    for(const unit of units.keys())visit(unit);
    for(const layer of layers){
      const rows=slot.layerCoverage.filter(row=>row.layer===layer);if(rows.length!==1){issue('layer_coverage_missing_or_duplicate',path,layer);continue;}
      const row=rows[0]!;
      if(row.state==='represented'&&!row.unitIds.length)issue('represented_layer_empty',path,layer);
      if(row.state!=='represented'&&!row.unknown)issue('layer_unknown_unexplained',path,layer);
      for(const id of row.unitIds)if(units.get(id)?.layer!==layer)issue('layer_unit_binding_invalid',path,id);
      for(const unit of slot.researchUnits.filter(unit=>unit.layer===layer))if(!row.unitIds.includes(unit.id))issue('research_unit_coverage_missing',path,unit.id);
    }
    const candidates=new Map(slot.candidates.map(row=>[row.candidateId,row]));
    for(const duplicate of repeats(slot.candidates.map(row=>row.candidateId)))issue('duplicate_candidate_explanation',path,duplicate);
    if(native.candidates.length!==slot.candidates.length||native.candidates.some(row=>!candidates.has(row.id)))issue('same_slot_alternatives_incomplete',path,'Explain every supplied alternative in this exact slot.');
    for(const [index,candidate] of slot.candidates.entries()){
      const at=path+`.candidates.${index}`,original=native.candidates.find(row=>row.id===candidate.candidateId);
      if(!original){issue('foreign_candidate',at,'The candidate belongs to another slot or source set.');continue;}
      const evidence=new Map(original.evidence.map(row=>[row.id,row])),observations=new Map(candidate.observations.map(row=>[row.id,row])),alignments=new Map(candidate.alignments.map(row=>[row.id,row]));
      for(const duplicate of repeats(candidate.observations.map(row=>row.id)))issue('duplicate_observation',at,duplicate);
      for(const duplicate of repeats(candidate.alignments.map(row=>row.id)))issue('duplicate_alignment',at,duplicate);
      for(const [oi,observation] of candidate.observations.entries()){
        const where=at+`.observations.${oi}`;
        if(!observation.evidenceIds.length)issue('observation_evidence_missing',where,'An observation needs exact original evidence IDs.');
        const kinds=observation.role==='prompt_requirement'?['prompt','diagram']:observation.role==='official_solution'?['official_solution']:['prompt','diagram','official_solution'];
        for(const id of observation.evidenceIds){const row=evidence.get(id);if(!row||row.inspection!=='inspected'||row.sourceSha256!==original.question.sourceSha256||!kinds.includes(row.kind)||row.media==='image'&&row.artifactSha256===null)issue('observation_evidence_unqualified',where,id);}
        if(observation.role==='official_solution'&&(original.officialSolution.state!=='inspected'||observation.evidenceIds.some(id=>!original.officialSolution.evidenceIds.includes(id))))issue('official_solution_not_observed',where,'Do not promote assistant or uninspected content into an official source solution.');
        if(observation.role==='assistant_derivation'&&original.analystSolution.state!=='derived')issue('assistant_derivation_not_prepared',where,'The original candidate lacks an attributed derivation.');
        if(observation.role==='assistant_derivation'&&observation.evidenceIds.some(id=>!original.analystSolution.basedOnEvidenceIds.includes(id)))issue('assistant_basis_changed',where,'Retain the exact prompt/diagram/solution evidence on which the supplied assistant derivation was based.');
        if(observation.role==='assistant_derivation'&&observation.certainty==='explicit')issue('derivation_is_not_explicit_prompt',where,'Mark a derived method inferred, not an explicit source requirement.');
      }
      for(const [ai,alignment] of candidate.alignments.entries()){
        const where=at+`.alignments.${ai}`,unit=units.get(alignment.researchUnitId);
        if(!unit)issue('alignment_research_unit_missing',where,alignment.researchUnitId);
        const linked=alignment.observationIds.map(id=>observations.get(id));
        if(linked.some(row=>!row))issue('alignment_observation_missing',where,'An observation reference does not resolve.');
        if(alignment.state!=='unknown'&&!linked.length)issue('alignment_evidence_missing',where,'A positive, partial or conflicting claim requires observed content.');
        if(alignment.state==='partial'&&!alignment.differences.length)issue('partial_difference_missing',where,'State the material difference instead of claiming complete correspondence.');
        if(alignment.state==='supported'&&(alignment.candidateElicitation==='unknown'||alignment.candidateElicitation==='not_elicited'||linked.some(row=>row?.certainty==='unknown')))issue('unsupported_coverage',where,'Unknown or unelicited content cannot be fully supported.');
        if(unit?.layer==='ACTION'&&alignment.state==='supported'&&(alignment.candidateElicitation!=='explicit'||!linked.some(row=>row?.role==='prompt_requirement'&&row.certainty==='explicit')))issue('solution_does_not_establish_prompt_requirement',where,'An available solution or inferred strategy does not establish explicitly elicited student action.');
        if(alignment.candidateElicitation==='explicit'&&!linked.some(row=>row?.role==='prompt_requirement'&&row.certainty==='explicit'))issue('explicit_requirement_unbound',where,'An explicit requirement needs an explicit prompt observation.');
      }
      for(const unit of slot.researchUnits)if(!candidate.alignments.some(row=>row.researchUnitId===unit.id))issue('research_unit_unaddressed',at,unit.id);
      for(const dimension of dimensions){
        const rows=candidate.dimensions.filter(row=>row.dimension===dimension);if(rows.length!==1){issue('dimension_missing_or_duplicate',at,dimension);continue;}
        const row=rows[0]!,linked=row.alignmentIds.map(id=>alignments.get(id));
        if(linked.some(value=>!value))issue('dimension_alignment_missing',at,dimension);
        if(['supported','partial'].includes(row.state)&&!linked.length)issue('dimension_unsubstantiated',at,dimension);
        if(row.state==='supported'&&linked.some(value=>value?.state!=='supported'))issue('dimension_overstates_alignment',at,dimension);
        if(row.state==='partial'&&!linked.some(value=>value?.state==='partial'))issue('partial_dimension_difference_unbound',at,dimension);
        if(['supported','partial'].includes(row.state)&&['structure','reasoning'].includes(dimension)){
          const required=dimension==='structure'?['DATA','LOGIC']:['LOGIC','ACTION'];
          if(!linked.some(value=>value&&required.includes(units.get(value.researchUnitId)?.layer??'')))issue('core_dimension_layer_unbound',at,dimension);
        }
        if(['unknown','not_assessed'].includes(row.state)&&!row.unknowns.length)issue('dimension_unknown_unexplained',at,dimension);
      }
    }
    const pairs=new Set<string>();
    for(const [index,pair] of slot.pairwiseComparisons.entries()){
      const at=path+`.pairwiseComparisons.${index}`,ids=[pair.leftCandidateId,pair.rightCandidateId],key=[...ids].sort().join('\0');
      if(pairs.has(key))issue('duplicate_pairwise_comparison',at,key);pairs.add(key);
      if(ids[0]===ids[1]||ids.some(id=>!candidates.has(id)))issue('foreign_or_self_comparison',at,'Comparison must concern two different alternatives in this same slot.');
      if(pair.preferredCandidateId!==null&&!ids.includes(pair.preferredCandidateId))issue('pair_preference_foreign',at,'The preferred option must belong to this pair.');
      if(pair.preferenceState==='established'&&(pair.preferredCandidateId===null||pair.preferenceBasis!=='evidence_comparison'))issue('preference_not_reestablished',at,'A historical ordinal cannot establish a new comparative advantage.');
      if(pair.preferenceState!=='established'&&pair.preferredCandidateId!==null)issue('unresolved_preference_has_winner',at,'Keep unresolved or tied comparisons without an invented winner.');
      if(pair.preferenceState==='unresolved'&&!pair.unknowns.length)issue('preference_unknown_unexplained',at,'Explain why a comparative preference has not been established.');
      if(pair.preferenceBasis==='historical_ordinal_not_reestablished'&&pair.preferenceState!=='unresolved')issue('historical_preference_promoted',at,'Retain historical ordinal provenance as unresolved unless new comparative evidence is supplied.');
      if(pair.preferenceState!=='unresolved')for(const id of ids)if(!pair.tradeoffs.some(row=>row.candidateId===id))issue('one_sided_preference_reason',at,id);
      for(const tradeoff of pair.tradeoffs){
        const candidate=candidates.get(tradeoff.candidateId),dimension=candidate?.dimensions.find(row=>row.dimension===tradeoff.dimension);
        if(!ids.includes(tradeoff.candidateId)||!candidate||!pair.dimensions.includes(tradeoff.dimension as 'structure'|'reasoning'))issue('tradeoff_candidate_or_dimension_foreign',at,tradeoff.candidateId);
        if((tradeoff.advantage!==null||tradeoff.limitation!==null)&&(!tradeoff.alignmentIds.length||tradeoff.alignmentIds.some(id=>!candidate?.alignments.some(row=>row.id===id)||!dimension?.alignmentIds.includes(id))))issue('preference_evidence_unbound',at,'A stated tradeoff must cite the exact candidate alignments in its declared dimension.');
        if(tradeoff.advantage!==null&&(!dimension||['unknown','not_assessed'].includes(dimension.state)||tradeoff.alignmentIds.some(id=>candidate?.alignments.find(row=>row.id===id)?.state==='unknown')))issue('preference_coverage_unknown',at,'Unknown comparison coverage cannot establish a comparative advantage.');
        if(pair.preferenceState!=='unresolved'&&tradeoff.advantage===null&&tradeoff.limitation===null)issue('comparative_fact_missing',at,'An established comparison or tie needs an observed comparative fact.');
      }
    }
    for(let i=0;i<slot.candidates.length;i++)for(let j=i+1;j<slot.candidates.length;j++)if(!pairs.has([slot.candidates[i]!.candidateId,slot.candidates[j]!.candidateId].sort().join('\0')))issue('same_slot_pair_missing',path,'Include every unordered pair, including alternate-versus-alternate when three options exist.');
  }
  const comparisons=packet.slots.flatMap(row=>row.pairwiseComparisons),unresolved=comparisons.filter(row=>row.preferenceState==='unresolved').length,ties=comparisons.filter(row=>row.preferenceState==='tie').length;
  return {inputValid:true,readiness:issues.length?'draft' as const:'reviewable' as const,
    preferenceReadiness:issues.length?'not_reviewable' as const:unresolved||ties?'ties_or_unresolved' as const:'established_for_supplied_pairs' as const,issues,slots:packet.slots,
    summary:{slots:packet.slots.length,candidates:packet.slots.reduce((sum,row)=>sum+row.candidates.length,0),pairwiseComparisons:comparisons.length,unresolvedPreferences:unresolved,tiedPreferences:ties,researchLayers:[...layers],dimensions:[...dimensions]},governance};
}

/** A JSON view only. Unresolved explanations stay held; no HTML, membership, source command or effect is produced. */
export function buildCandidateExplanationView(review:ReturnType<typeof reviewCandidateExplanations>,slotId:string){
  const slot=review.slots.find(row=>row.slotId===slotId);
  const issues=review.issues.filter(row=>!slot||!row.path.startsWith('slots.')||row.path.startsWith(`slots.${review.slots.indexOf(slot)}.`));
  if(!slot)return {status:'held' as const,slot:null,issues,preferenceReadiness:review.preferenceReadiness,governance:review.governance};
  const unresolved=slot.pairwiseComparisons.some(row=>row.preferenceState!=='established');
  return {status:issues.length||unresolved?'available_with_gaps' as const:'available' as const,slot,issues,
    bindingReadiness:review.readiness,preferenceReadiness:review.preferenceReadiness,governance:review.governance};
}
