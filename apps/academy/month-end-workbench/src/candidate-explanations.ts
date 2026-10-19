import {createHash} from 'node:crypto';
import type {Projection, SourceRef} from './contracts.ts';

/** A pure Education case builder/renderer. Academy owns strict packet review.
 * No sibling-repository import, question acquisition, model call or action executor. */
export interface KoreanCandidateNote {prompt:string;official:string;derivation:string;advantage:string;limitation:string}
export interface KoreanSlotNote {difference:string;preference:string}
type Layer='DATA'|'LOGIC'|'ACTION'|'GOVERNANCE';
type Dimension='structure'|'reasoning'|'representation'|'conditions'|'errors'|'transfer';
interface Evidence {id:string;kind:string;observation:string;inspection:string}
interface Axis {strength:string;rationale:string|null;differences:string[]}
interface Mapping {researchMicrostepId:string;researchRef:SourceRef;candidateRequiredAction:string;basis:string;nativeEvidenceIds:string[]}
interface Candidate {
 id:string;question:{lecture_key:string;pat_no:string;labelExact:string};difficulty:{value:string;rawValue:string};responseMode:{value:string};
 evidence:Evidence[];promptEvidenceIds:string[];officialSolution:{state:string;evidenceIds:string[]};
 analystSolution:{state:string;reasoning:string;basedOnEvidenceIds:string[]};
 comparison:{axes:Record<Dimension,Axis>;microstepMapping:Mapping[]};
 recommendation:{role:string;ordinal:number;rationale:string};
}
interface Slot {id:string;unitId:string;primaryResearchTypeId:string;difficulty:string;candidates:Candidate[]}
interface CandidateSet {schemaVersion:string;researchContext:{revision:string};slots:Slot[]}
export interface AttributedSelection {
 schemaVersion:string;classification:string;sourceRecord:string;workId:string;selectedBy:string;title:string;ordering:string;
 orderedUnits:{unitId:string;lecture_keys:string[]}[];
 researchTypeDuplicateException:{researchTypeId:string;lecture_keys:string[];decision:string;source:string};
 previousRankingAcceptanceInferred:boolean;nativeMembershipPersisted:boolean;pdfGenerationPerformed:boolean;acceptanceDecision:null;
}
interface ResearchAtom {id:string;layer:Layer;classification:'source_observation'|'analyst_decomposition';statement:string;sourceRefs:SourceRef[];dependsOnUnitIds:string[]}
interface Observation {id:string;role:'prompt_requirement'|'official_solution'|'assistant_derivation';certainty:'explicit'|'inferred'|'unknown';statement:string;evidenceIds:string[]}
interface Alignment {id:string;researchUnitId:string;observationIds:string[];state:'supported'|'partial'|'conflicts'|'unknown';candidateElicitation:'explicit'|'inferred'|'not_elicited'|'unknown';rationale:string;differences:string[]}
const dimensions:Dimension[]=['structure','reasoning','representation','conditions','errors','transfer'];
const layers:Layer[]=['DATA','LOGIC','ACTION','GOVERNANCE'];
export interface AttributedPairDecision {
 attribution:'assistant-analysis';status:'current-attributed-proposal';preferredCandidateId:string;
 rationale:string;
}
/** Stable across source row order; the ledger is distinct from historical recommendation ordinals. */
export const candidatePairKey=(leftCandidateId:string,rightCandidateId:string)=>JSON.stringify([leftCandidateId,rightCandidateId].sort());
export const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
const obj=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const str=(value:unknown)=>typeof value==='string'?value:'';
const sourceText=(value:unknown)=>typeof value==='string'?value:JSON.stringify(value);
const requireText=(value:string,label:string)=>{if(value.trim().length<8)throw new Error(`Missing substantive Korean explanation: ${label}`);return value;};
const escaped=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export interface ExplanationCaseInput {
 candidateSetJson:string;researchProjectionJson:string;
 notes:Record<string,KoreanCandidateNote>;slotNotes:Record<string,KoreanSlotNote>;selection:AttributedSelection;
 pairDecisions?:Record<string,AttributedPairDecision>;
}
export function buildCandidateExplanationCase(input:ExplanationCaseInput){
 const set=JSON.parse(input.candidateSetJson) as CandidateSet;
 const research=JSON.parse(input.researchProjectionJson) as Projection;
 if(!Array.isArray(set.slots)||!Array.isArray(research.types)||!Array.isArray(research.designs))throw new Error('Missing owning candidate/research structure.');
 if(set.researchContext.revision!==research.revision)throw new Error('Candidate and research revision differ.');
 const seen=new Set<string>();
 const sourcePins=new Map(research.manifest.map(row=>[row.path,row.sha256]));
 const originalSlots=structuredClone(set.slots);
 const readableSlots=set.slots.map(slot=>{
  const type=research.types.find(row=>row.id===slot.primaryResearchTypeId),design=research.designs.find(row=>row.typeId===slot.primaryResearchTypeId);
  if(!type||!design)throw new Error(`Missing exact research type/design: ${slot.primaryResearchTypeId}`);
  const notes=input.slotNotes[slot.id];if(!notes)throw new Error(`Missing slot explanation: ${slot.id}`);
  const original=design.original as Record<string,unknown>,basic=obj(type.original.example),central=obj(original.centralTask),rationale=obj(original.designRationale);
  const actionDesign=obj(original.actionDesign),limits=Array.isArray(actionDesign.interpretationLimits)?actionDesign.interpretationLimits.map(String):[];
  const units:ResearchAtom[]=[];
  const atom=(id:string,layer:Layer,statement:string,ref:SourceRef,dependsOnUnitIds:string[]=[])=>{
   if(sourcePins.get(ref.path)!==ref.sha256||ref.revision!==research.revision)throw new Error(`Unpinned original source: ${id}`);
   const unit:ResearchAtom={id,layer,classification:'source_observation',statement:requireText(statement,id),sourceRefs:[ref],dependsOnUnitIds};units.push(unit);return id;
  };
  const basicId=atom(`${type.id}:data:basic`,'DATA',`원래 기본 예: ${sourceText(basic.prompt)} / 답: ${sourceText(basic.answer)} / 풀이: ${sourceText(basic.solution)}`,type.source);
  const centralId=atom(`${type.id}:data:central`,'DATA',`확장 연구의 중심 과제: ${sourceText(central.prompt)} / 답: ${sourceText(central.answer)}`,design.source);
  const representationId=atom(`${type.id}:data:representation`,'DATA',`연구 표상: ${sourceText(rationale.representation)}`,design.source);
  const conditionId=atom(`${type.id}:data:conditions`,'DATA',`연구 조건: ${sourceText(rationale.conditions)}`,design.source);
  const structureId=atom(`${type.id}:logic:structure`,'LOGIC',`목표 수학 구조: ${sourceText(original.targetStructure)}`,design.source,[basicId]);
  const reasoningId=atom(`${type.id}:logic:reasoning`,'LOGIC',`불변 관계: ${sourceText(original.invariant??obj(original.generalization).invariant)} / 중심 풀이: ${sourceText(central.solution)}`,design.source,[centralId,structureId]);
  const stepUnits=design.microsteps.map(step=>{
   const thoughtId=atom(`${step.id}:thought`,'LOGIC',`이 행동의 기대 이해: ${sourceText(step.original.expectedUnderstanding)}`,step.source,[structureId]);
   const actionId=atom(`${step.id}:action`,'ACTION',`질문: ${sourceText(step.original.cue)} / 관찰할 행동: ${sourceText(step.original.observableStudentAction)}`,step.source,[thoughtId,centralId]);
   return {step,thoughtId,actionId};
  });
  const governanceId=limits.length?atom(`${type.id}:governance:interpretation`,'GOVERNANCE',`연구 해석 한계: ${limits.join(' / ')}`,design.source):null;
  const explanations=slot.candidates.map(candidate=>{
   const q=candidate.question.lecture_key,note=input.notes[q];if(!note)throw new Error(`Missing Korean candidate explanation: ${q}`);
   for(const [key,value] of Object.entries(note))requireText(value,`${q}:${key}`);
   if(seen.has(q))throw new Error(`Native question reused across source slots: ${q}`);seen.add(q);
   if(candidate.difficulty.value!==slot.difficulty)throw new Error(`Native difficulty does not match slot: ${q}`);
   const promptId=`${candidate.id}:explain:prompt`,officialId=`${candidate.id}:explain:official`,analystId=`${candidate.id}:explain:derivation`;
   const observations:Observation[]=[{id:promptId,role:'prompt_requirement',certainty:'explicit',statement:`기존 이미지 검토에서 관찰한 문제 요구를 한국어로 요약: ${note.prompt}`,evidenceIds:candidate.promptEvidenceIds}];
   if(candidate.officialSolution.state==='inspected')observations.push({id:officialId,role:'official_solution',certainty:'explicit',statement:`기존에 확인한 원천 카드의 공식 정답·해설을 한국어로 요약: ${note.official}`,evidenceIds:candidate.officialSolution.evidenceIds});
   if(candidate.analystSolution.state==='derived')observations.push({id:analystId,role:'assistant_derivation',certainty:'inferred',statement:`분석자가 별도로 재구성한 가능한 풀이이며 학생이 실제 사용했다는 뜻은 아니다: ${note.derivation}`,evidenceIds:candidate.analystSolution.basedOnEvidenceIds});
   const alignments:Alignment[]=units.map(unit=>({id:`${candidate.id}:align:${unit.id}`,researchUnitId:unit.id,observationIds:[],state:'unknown',candidateElicitation:'unknown',rationale:'이 연구 단위와 후보의 대응을 개별 판정한 근거가 기존 검토에 없어 미확인으로 둔다.',differences:[]}));
   const find=(id:string)=>alignments.find(a=>a.researchUnitId===id)!;
   const core=(axis:'structure'|'reasoning',unitId:string)=>{
    const row=find(unitId),historical=candidate.comparison.axes[axis];
    row.state=historical.strength==='strong'?'supported':historical.strength==='partial'?'partial':'unknown';
    row.candidateElicitation='inferred';row.observationIds=[promptId,...(candidate.analystSolution.state==='derived'?[analystId]:[])];
    row.rationale=`분석자의 ${axis==='structure'?'구조':'풀이 관계'} 판단: ${note.advantage} ${note.limitation}`;
    if(row.state==='partial')row.differences=[notes.difference,note.limitation];
   };
   core('structure',structureId);core('reasoning',reasoningId);
   for(const {step,thoughtId,actionId} of stepUnits){
    const mapping=candidate.comparison.microstepMapping.find(row=>row.researchMicrostepId===step.id);
    if(!mapping)continue;
    if(JSON.stringify(mapping.researchRef)!==JSON.stringify(step.source))throw new Error(`Changed source microstep binding: ${q}:${step.id}`);
    const observationId=mapping.basis==='official_solution'&&candidate.officialSolution.state==='inspected'?officialId:analystId;
    for(const id of [thoughtId,actionId]){
     const row=find(id);row.state='partial';row.candidateElicitation='inferred';row.observationIds=[observationId];
     row.rationale=`기존 분석의 ${step.id} 대응을 보존한다. ${note.derivation} 이 연구 단계의 특정 사고·표현을 문제에서 따로 요구했는지는 확정하지 않는다.`;
     row.differences=[`연구 단계의 원래 수·표상·질문은 후보와 다르다. 풀이에서 이 단계를 사용할 수 있다는 것과 학생에게 그 단계를 명시적으로 쓰게 한다는 것은 다르다.`,note.limitation];
    }
   }
   if(governanceId){const row=find(governanceId);row.candidateElicitation='not_elicited';row.rationale='이 원문은 관찰 해석의 제한이다. 문항만으로 실제 수업 관찰, 학습효과 또는 교사의 수용을 확인할 수 없다.';}
   const dims=dimensions.map(dimension=>{
    if(dimension==='structure'||dimension==='reasoning'){
     const row=find(dimension==='structure'?structureId:reasoningId);
     return {dimension,state:row.state==='conflicts'?'partial' as const:row.state,alignmentIds:[row.id],rationale:row.rationale,unknowns:row.state==='unknown'?['기존 core 비교 판단의 근거가 충분히 기록되지 않아 대응 상태를 확정할 수 없다.']:[]};
    }
    return {dimension,state:'not_assessed' as const,alignmentIds:[],rationale:'기존 검토에서 이 차원을 후보별로 별도 판정하지 않았다. 연구자료에 내용이 있다는 사실만으로 문항 대응을 만들지 않는다.',unknowns:['원문 연구와 실제 문제 요구를 이 차원에서 다시 대조하는 검토가 필요하다.']};
   });
   return {candidateId:candidate.id,observations,alignments,dimensions:dims,unknowns:[
    '정답 또는 공식 풀이의 존재는 학생이 특정 전략·사고를 사용했다는 관찰 증거가 아니다.',
    `${stepUnits.filter(s=>!candidate.comparison.microstepMapping.some(m=>m.researchMicrostepId===s.step.id)).length}개 연구 미세행동은 기존 후보 검토에서 개별 대응을 판정하지 않았다.`,
    '이번 보고서는 기존 이미지 관찰과 분석을 풀어 쓴 것이며, 원본 이미지를 새로 독립 검토했다는 주장은 하지 않는다.',
   ]};
  });
  const pairs=[];
  for(let i=0;i<slot.candidates.length;i++)for(let j=i+1;j<slot.candidates.length;j++){
   const left=slot.candidates[i]!,right=slot.candidates[j]!,decision=input.pairDecisions?.[candidatePairKey(left.id,right.id)];
   if(decision&&(decision.attribution!=='assistant-analysis'||decision.status!=='current-attributed-proposal'||![left.id,right.id].includes(decision.preferredCandidateId)))throw new Error('Explicit pair decision must be a current attributed proposal about this exact pair.');
   if(decision)requireText(decision.rationale,'explicit pair decision');
   pairs.push({leftCandidateId:left.id,rightCandidateId:right.id,preferredCandidateId:decision?.preferredCandidateId??null,
    preferenceState:decision?'established' as const:'unresolved' as const,
    preferenceBasis:decision?'evidence_comparison' as const:'historical_ordinal_not_reestablished' as const,
    dimensions:['structure','reasoning'] as ('structure'|'reasoning')[],
    rationale:`${left.question.lecture_key} 대 ${right.question.lecture_key}: ${decision?`현재 분석자의 명시적 비교 제안: ${decision.rationale}`:`과거 순위 이유를 설명하는 기록이며 현재 쌍별 우열을 다시 확정하지 않는다. ${notes.preference}`}`,
    tradeoffs:[left,right].map(c=>({candidateId:c.id,dimension:'structure' as const,alignmentIds:[`${c.id}:align:${structureId}`],advantage:input.notes[c.question.lecture_key]!.advantage,limitation:input.notes[c.question.lecture_key]!.limitation})),
    unknowns:decision?[]:['이 두 후보의 우열을 재확정하는 별도의 현재 비교 결정이 기록되지 않았다. 과거 ordinal이나 설명 문구를 현재의 입증된 선호로 승격하지 않으며 공통점·차이·기존 순서를 함께 읽는다.'],
   });
  }
  return {slot,type,design,notes,units,stepUnits,explanations,pairs};
 });
 const packet={schemaVersion:'academy.candidate-explanations/1' as const,
  identity:{projectId:'education-platform',workId:'month-end-candidate-preparation-20261019',registration:'local-record' as const,globallyRegistered:false as const},
  inputBindings:{candidateSetSha256:sha256(input.candidateSetJson),researchProjectionSha256:sha256(input.researchProjectionJson),researchRevision:research.revision},
  slots:readableSlots.map(row=>({slotId:row.slot.id,researchTypeId:row.type.id,researchUnits:row.units,
   layerCoverage:layers.map(layer=>({layer,state:row.units.some(u=>u.layer===layer)?'represented' as const:'not_recorded' as const,unitIds:row.units.filter(u=>u.layer===layer).map(u=>u.id),unknown:row.units.some(u=>u.layer===layer)?null:'이 유형 원문에 독립된 해당 층의 단위를 확인하지 못했다. 분석자가 원문의 주장으로 보충하지 않는다.'})),
   candidates:row.explanations,pairwiseComparisons:row.pairs})),
 };
 const selectionAudit=auditAttributedSelection(set,input.selection);
 if(JSON.stringify(set.slots)!==JSON.stringify(originalSlots))throw new Error('Pure builder mutated original candidate slots.');
 return {packet,selection:input.selection,selectionAudit,readableSlots,governance:{
  securityLayerDisplay:'SECURITY(GOVERNANCE)',sourceSecurity:{rawImagesIncluded:false,rawResponsesIncluded:false,credentialsIncluded:false,sourceAcquisitionPerformed:false},
  pedagogicalGovernance:{teacherStudyCompletionInferred:false,studentStrategyObserved:false,learningEffectInferred:false,acceptanceDecision:null},
  nativePdfWorkId:input.selection.workId,pdfGenerationPerformed:false,sourceBusinessWrites:0,
 }};
}

export function auditAttributedSelection(set:CandidateSet,selection:AttributedSelection){
 const rows=selection.orderedUnits.flatMap(unit=>unit.lecture_keys.map((lecture_key,index)=>{
  const slot=set.slots.find(s=>s.candidates.some(c=>c.question.lecture_key===lecture_key)),candidate=slot?.candidates.find(c=>c.question.lecture_key===lecture_key);
  return {unitId:unit.unitId,unitOrdinal:index+1,lecture_key,found:!!candidate,sourceSlotId:slot?.id??null,researchTypeId:slot?.primaryResearchTypeId??null,
   difficulty:candidate?.difficulty.value??null,rawDifficulty:candidate?.difficulty.rawValue??null,responseMode:candidate?.responseMode.value??null,priorOrdinal:candidate?.recommendation.ordinal??null,priorRole:candidate?.recommendation.role??null,unitMatches:unit.unitId===slot?.unitId};
 }));
 const expected:Record<string,number[]>={'U-M':[4,3,1],'U-D':[4,2,2],'U-C':[4,3,1]};
 const counts=selection.orderedUnits.map(unit=>({unitId:unit.unitId,count:rows.filter(r=>r.unitId===unit.unitId).length,difficultyCounts:['중','상','최상'].map(d=>rows.filter(r=>r.unitId===unit.unitId&&r.difficulty===d).length)}));
 const occurrences=new Map<string,string[]>();for(const row of rows)if(row.researchTypeId)occurrences.set(row.researchTypeId,[...(occurrences.get(row.researchTypeId)??[]),row.lecture_key]);
 const duplicateTypes=[...occurrences].filter(([,q])=>q.length>1).map(([researchTypeId,lecture_keys])=>({researchTypeId,lecture_keys}));
 const missing=rows.filter(r=>!r.found),unitConflicts=rows.filter(r=>!r.unitMatches),difficultyConflicts=counts.filter(c=>c.count!==8||JSON.stringify(c.difficultyCounts)!==JSON.stringify(expected[c.unitId]));
 const rawBandValues:Record<string,string>={'2':'중','3':'상','4':'최상'};
 const rawBandPolicyConflicts=rows.filter(row=>rawBandValues[row.rawDifficulty??'']!==row.difficulty);
 const responseModeCounts={constructed:rows.filter(row=>row.responseMode==='constructed').length,descriptive:rows.filter(row=>row.responseMode==='descriptive').length};
 const duplicateExceptionMatches=duplicateTypes.length===1&&duplicateTypes[0]!.researchTypeId===selection.researchTypeDuplicateException.researchTypeId&&JSON.stringify(duplicateTypes[0]!.lecture_keys)===JSON.stringify(selection.researchTypeDuplicateException.lecture_keys)&&selection.researchTypeDuplicateException.decision==='include-both';
 const pointValues:Record<string,number>={'중':3,'상':5,'최상':6};
 const distinctQuestions=new Set(rows.map(r=>r.lecture_key)).size,points=rows.reduce((sum,row)=>sum+(pointValues[row.difficulty??'']??0),0);
 return {rows,counts,missing,unitConflicts,difficultyConflicts,rawBandPolicyConflicts,responseModeCounts,duplicateTypes,duplicateExceptionMatches,distinctQuestions,distinctResearchTypes:occurrences.size,points,
  structurallyConsistent:rows.length===24&&distinctQuestions===24&&points===100&&!missing.length&&!unitConflicts.length&&!difficultyConflicts.length&&!rawBandPolicyConflicts.length&&responseModeCounts.constructed+responseModeCounts.descriptive===24&&duplicateExceptionMatches,
  sourceDifficultyMeaning:'Raw 2/3/4 retain the existing exact-formatter source-derived association; branch/coercion semantics are not newly authenticated.',
  omittedHistoricalSlots:set.slots.filter(s=>!rows.some(row=>row.sourceSlotId===s.id)).map(s=>s.id),
  teacherChoiceMotive:'not_inferred',previousRankingAcceptance:'not_inferred',nativeMembershipApplied:false,pdfGenerated:false};
}

export type CandidateExplanationCase=ReturnType<typeof buildCandidateExplanationCase>;
/** Verify receipt-to-byte binding only. This does not authenticate a reviewer or grant authority. */
export function bindSuppliedExplanationReview(receiptJson:string,packetJson:string,bindings:{candidateSetSha256:string;researchProjectionSha256:string;researchRevision:string}){
 const receipt=obj(JSON.parse(receiptJson)),bound=obj(receipt.inputBindings),review=obj(receipt.review);
 if(receipt.schemaVersion!=='education.explanation-domain-review/1'||receipt.packetSha256!==sha256(packetJson)
  ||bound.candidateSetSha256!==bindings.candidateSetSha256||bound.researchProjectionSha256!==bindings.researchProjectionSha256||bound.researchRevision!==bindings.researchRevision)
  throw new Error('Supplied review receipt does not bind the exact packet and owning input bytes.');
 if(!['draft','reviewable'].includes(str(review.readiness))||!Array.isArray(review.issues)||typeof review.inputValid!=='boolean')throw new Error('Supplied review result has no supported reading boundary.');
 const reviewer=obj(receipt.reviewer);
 return {readiness:str(review.readiness),preferenceReadiness:str(review.preferenceReadiness),issues:review.issues,
  inputValid:review.inputValid,reviewer:{owner:str(reviewer.owner),path:str(reviewer.path),sha256:str(reviewer.sha256)},
  packetSha256:str(receipt.packetSha256),inputBindings:bindings,receiptSha256:sha256(receiptJson),
  identityMeaning:'caller-supplied result with verified byte binding; reviewer is not authenticated by this export',
  sourceClaimsAuthenticated:false,automaticRankingEnabled:false,acceptanceDecision:null};
}
export function renderCandidateExplanationHtml(result:CandidateExplanationCase,review?:{readiness:string;preferenceReadiness?:string;issues:unknown[]}){
 const e=escaped,selected=new Map(result.selectionAudit.rows.map((r,index)=>[r.lecture_key,index+1]));
 const state=(s:string)=>({supported:'대응 근거 있음',partial:'부분 대응',unknown:'미확인',not_assessed:'아직 별도 검토하지 않음',established:'명시한 비교 기준에서 근거 있음',unresolved:'우열 근거 미완성',tie:'차이로 우열을 정하지 않음'}[s]??s);
 const refs=(units:ResearchAtom[])=>units.map(u=>`<tr><td>${e(u.id)}</td><td>${e(u.layer)}</td><td>${e(u.statement)}</td><td>${u.sourceRefs.map(r=>`${e(r.path)}<br><code>${e(r.pointer)}</code><br>SHA256 <code>${e(r.sha256)}</code>`).join('<br>')}</td></tr>`).join('');
 const sections=result.readableSlots.map(row=>{
  const p=result.packet.slots.find(s=>s.slotId===row.slot.id)!;
  const actions=row.stepUnits.map(({step,thoughtId,actionId})=>`<tr><td>${e(step.id)}<br>${e(step.original.phase)}</td><td>${e(step.original.cue)}</td><td>${e(step.original.expectedUnderstanding)}</td><td>${e(step.original.observableStudentAction)}</td>${row.explanations.map(c=>{const a=c.alignments.find(a=>a.researchUnitId===actionId)!,t=c.alignments.find(a=>a.researchUnitId===thoughtId)!;return `<td>${e(state(a.state))}<br>${a.state==='partial'?'풀이에서 사용할 수 있음; 문제의 별도 행동 요구는 미확정':'이 단계는 개별 대조 기록 없음'}<br>사고: ${e(state(t.state))}</td>`;}).join('')}</tr>`).join('');
  const candidates=row.slot.candidates.map(c=>{
   const x=row.explanations.find(x=>x.candidateId===c.id)!,prompt=x.observations.find(o=>o.role==='prompt_requirement'),official=x.observations.find(o=>o.role==='official_solution'),analyst=x.observations.find(o=>o.role==='assistant_derivation');
   const coverage=x.alignments.filter(a=>a.state==='partial'&&row.units.find(u=>u.id===a.researchUnitId)?.layer==='ACTION').map(a=>a.researchUnitId);
   return `<article id="q-${e(c.question.lecture_key)}"><h3>문항 ${e(c.question.lecture_key)} ${selected.has(c.question.lecture_key)?`<mark>현재 선생님 선택 ${selected.get(c.question.lecture_key)}번</mark>`:''}</h3><p class="meta">과거 제안: ${c.recommendation.role==='preferred'?'1순위 preferred':`${c.recommendation.ordinal}순위 alternate`} · 원천 난이도 ${e(c.difficulty.value)} (raw ${e(c.difficulty.rawValue)}) · 응답 형식 ${e(c.responseMode.value)} · 원천 label ${e(c.question.pat_no)} / ${e(c.question.labelExact)}</p>
    <p><b>문제가 요구하는 것.</b> ${e(prompt?.statement)}</p><p><b>공식 정답·해설.</b> ${e(official?.statement??'확인한 공식 풀이가 없다. 미확인으로 둔다.')}</p><p><b>분석자가 풀어 본 과정.</b> ${e(analyst?.statement??'독립 풀이 재구성이 기록되지 않았다.')}</p>
    <p><b>연구와 맞는 점과 차이.</b> ${e(x.alignments.find(a=>a.researchUnitId===`${row.type.id}:logic:structure`)?.rationale)}</p>
    <p><b>core 대응.</b> 구조 ${e(state(x.dimensions[0]!.state))}, 풀이 관계 ${e(state(x.dimensions[1]!.state))}. 이는 확장 연구의 모든 단계가 일치한다는 뜻이 아니다.</p>
    <p><b>미세행동.</b> ${coverage.length?e(coverage.join(', '))+'는 풀이와 부분 대응한다.':'개별 대응 근거가 기록된 연구 행동은 없다.'} 나머지 연구 행동은 아래 표에서 미확인으로 남겨 두었다. 공식 풀이를 학생의 실제 전략 증거로 읽지 않는다.</p>
    <p><b>아직 모르는 것.</b> 표상·조건·오류·전이는 후보별 별도 판정 기록이 없다. 정답만으로 연구가 의도한 사고나 학습효과를 판정할 수 없다.</p>
    <details><summary>과거 순위 이유 원문과 정확한 evidence ID</summary><p>${e(c.recommendation.rationale)}</p><ul>${x.observations.map(o=>`<li>${e(o.role)}: ${o.evidenceIds.map(e).join(', ')}</li>`).join('')}</ul></details></article>`;
  }).join('');
  return `<section id="${e(row.slot.id)}"><h2>${e(row.slot.id)} · ${e(row.type.title)} <small>${e(row.type.id)} / ${e(row.slot.difficulty)}</small></h2>
   <div class="research"><p><b>DATA — 무엇이 주어졌나.</b> ${e(row.units.find(u=>u.id.endsWith(':data:basic'))?.statement)}</p><p>${e(row.units.find(u=>u.id.endsWith(':data:central'))?.statement)}</p><p><b>LOGIC — 어떤 관계를 생각하나.</b> ${e(row.units.find(u=>u.id.endsWith(':logic:structure'))?.statement)}</p><p>${e(row.units.find(u=>u.id.endsWith(':logic:reasoning'))?.statement)}</p><p><b>ACTION — 무엇을 하게 관찰하나.</b> 원문 미세행동 ${row.stepUnits.length}개를 아래에 각각 분리했다. 풀이의 가능성과 문제에서 직접 요구하는 행동을 구분한다.</p><p><b>SECURITY(GOVERNANCE).</b> 원본 이미지·서버 응답·인증정보는 이 파일에 포함하지 않았다. 연구의 교사 관찰·지원 전후 구분은 설계 지침이며 실제 수업 수행이나 수용을 뜻하지 않는다.</p></div>
   <div class="comparison"><h3>같은 슬롯에서 비교한 이유</h3><p>${e(row.notes.preference)}</p>${p.pairwiseComparisons.map(pair=>`<p><b>${e(pair.leftCandidateId.split(':')[1])} ↔ ${e(pair.rightCandidateId.split(':')[1])}</b> — ${e(state(pair.preferenceState))}${pair.preferredCandidateId?` / 이 기준의 선호: ${e(pair.preferredCandidateId.split(':')[1])}`:''}. ${e(pair.rationale)} ${pair.unknowns.map(e).join(' ')}</p>`).join('')}</div>
   ${candidates}<details><summary>원문 연구의 모든 사고·행동 단계와 후보별 미확인 범위</summary><div class="scroll"><table><thead><tr><th>연구 행동 ID</th><th>연구 질문</th><th>기대 이해·사고</th><th>관찰할 학생 행동</th>${row.slot.candidates.map(c=>`<th>문항 ${e(c.question.lecture_key)}</th>`).join('')}</tr></thead><tbody>${actions}</tbody></table></div></details>
   <details><summary>DATA/LOGIC/ACTION/GOVERNANCE 전체 단위와 정확한 원문 pointer·hash</summary><div class="scroll"><table><thead><tr><th>단위 ID</th><th>층</th><th>원문 내용</th><th>원문 출처</th></tr></thead><tbody>${refs(row.units)}</tbody></table></div></details></section>`;
 }).join('');
 const rows=result.selectionAudit.rows.map((r,i)=>`<tr><td>${i+1}</td><td><a href="#q-${e(r.lecture_key)}">${e(r.lecture_key)}</a></td><td>${e(r.unitId)}</td><td>${e(r.difficulty)}</td><td>${e(r.sourceSlotId)}</td><td>${e(r.researchTypeId)}</td><td>${e(r.priorOrdinal)}순위</td></tr>`).join('');
 return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>57개 후보의 연구 대응 설명</title><style>body{max-width:1120px;margin:auto;padding:28px;font:17px/1.8 system-ui,sans-serif;color:#202b35;background:#fafbfc}h1,h2,h3{line-height:1.4}h2{padding-top:25px;border-top:3px solid #315b7a}small,.meta{font-size:14px;color:#4a5b67}section{margin:36px 0}article,.research,.comparison{background:white;border:1px solid #d6e0e8;border-radius:8px;padding:18px;margin:18px 0}article h3{margin-top:0}mark{padding:3px 7px;font-size:14px}p{margin:10px 0}table{border-collapse:collapse;font-size:14px;line-height:1.6;width:100%}th,td{border:1px solid #c8d4df;padding:8px;text-align:left;vertical-align:top}code{font-size:11px;overflow-wrap:anywhere}.scroll{overflow:auto}details{margin:15px 0}summary{cursor:pointer;font-weight:600}.notice{border-left:5px solid #bf7b22;background:#fff5e6;padding:14px}nav a{display:inline-block;margin:3px 8px}a{color:#155d83}@media print{details{display:block}section{break-before:page}article{break-inside:avoid}nav{display:none}}</style></head><body>
  <h1>왜 이 후보를 연결했는지: 24슬롯·57문항 설명</h1><p class="notice">기존 core 판단은 두 축 모두 strong 4개, 한 축 이상 partial 53개이다. 연구 설계 전체와 동등한 57문항이라는 뜻이 아니다. 이 문서는 기존 관찰·풀이를 설명하는 보고서이며 시험지 PDF가 아니다. 현재 선택 24문항과 과거 후보 순위를 구분한다.</p>
  <p>DATA는 주어진 수·그림·조건, LOGIC은 유지되는 수학 관계와 사고, ACTION은 학생에게 관찰하려는 표현·계산·설명이다. SECURITY(GOVERNANCE)는 원천 보안과 판단의 책임·한계를 함께 다루되 학습효과나 교사 수용을 대신하지 않는다. 미확인은 불일치나 학생의 미이해를 뜻하지 않는다.</p>
  <p>정확한 입력 SHA256: 후보 <code>${e(result.packet.inputBindings.candidateSetSha256)}</code> / 연구 projection <code>${e(result.packet.inputBindings.researchProjectionSha256)}</code>. 연구 revision <code>${e(result.packet.inputBindings.researchRevision)}</code>.</p>
  <p>호출자가 제공하고 입력 bytes를 대조한 Academy domain reviewer 결과: ${review?e(review.readiness):'미첨부 — 읽기용 보고서는 제공하되 기계적 심사 통과를 주장하지 않는다.'}; 상대 선호 상태: ${e(review?.preferenceReadiness??'미완성 근거를 아래에 표시')}. 결과 첨부는 source 인증이나 판단 수용을 대신하지 않는다.</p>
  <details open><summary>선생님이 현재 선택한 24문항 — 선택 동기는 추정하지 않음</summary><p>단원별 중/상/최상: 곱셈 4/3/1, 나눗셈 4/2/2, 원 4/3/1, 합계 100점이다. 원 19·20번은 HC21-d3-T02 두 후보를 함께 선택한 사용자 예외로, 현재 선택은 23유형이다. 이전 slot-20의 HC22-d1-T01은 현재 선택에 없다. 서버 등록·PDF 생성 여부는 이 분석 보고서로 확인할 수 없다.</p><div class="scroll"><table><thead><tr><th>현재 순서</th><th>원천 문항 ID</th><th>단원</th><th>난이도</th><th>과거 슬롯</th><th>연구 유형</th><th>과거 순위</th></tr></thead><tbody>${rows}</tbody></table></div></details>
  <nav>${result.readableSlots.map(row=>`<a href="#${e(row.slot.id)}">${e(row.slot.id)} ${e(row.type.title)}</a>`).join('')}</nav>${sections}
  <p>출처의 inspected 표시는 이전 분석자의 관찰 기록을 가리킨다. 이 export 자체는 이미지 재검토·실제 학생 사고 관찰·원천 인증·자동 순위 확정·최종 시험 등록을 수행하지 않는다.</p></body></html>`;
}
