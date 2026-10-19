import {describe,expect,test} from 'bun:test';
import {bindSuppliedExplanationReview,buildCandidateExplanationCase,renderCandidateExplanationHtml,sha256} from '../src/candidate-explanations.ts';
import {candidateNotes,slotNotes,teacherSelection} from '../cases/candidate-explanation-20261019/notes.ko.ts';
const root=new URL('../',import.meta.url);
const candidateSetJson=await Bun.file(new URL('work/month-end-candidate-preparation-20261019/candidate-set.json',root)).text();
const researchProjectionJson=await Bun.file(new URL('data/research-projection.json',root)).text();
const input={candidateSetJson,researchProjectionJson,notes:candidateNotes,slotNotes,selection:teacherSelection};
const result=buildCandidateExplanationCase(input);
describe('actual retained research/candidate explanation case',()=>{
 test('explains all57 candidates and all24 owning types without changing historical bytes',()=>{
  expect(result.packet.slots).toHaveLength(24);expect(result.packet.slots.flatMap(s=>s.candidates)).toHaveLength(57);
  expect(new Set(result.packet.slots.flatMap(s=>s.candidates.map(c=>c.candidateId))).size).toBe(57);
  expect(result.packet.inputBindings.candidateSetSha256).toBe(sha256(candidateSetJson));
  expect(result.packet.inputBindings.researchProjectionSha256).toBe(sha256(researchProjectionJson));
  expect(candidateSetJson).toBe(input.candidateSetJson);expect(result.governance.sourceBusinessWrites).toBe(0);
 });
 test('keeps thought/action source refs exact and unresolved microsteps visible',()=>{
  const projection=JSON.parse(researchProjectionJson);
  for(const slot of result.packet.slots){
   const design=projection.designs.find((d:{typeId:string})=>d.typeId===slot.researchTypeId);
   for(const step of design.microsteps){
    const action=slot.researchUnits.find(u=>u.id===step.id+':action')!,thought=slot.researchUnits.find(u=>u.id===step.id+':thought')!;
    expect(action.sourceRefs).toEqual([step.source]);expect(thought.sourceRefs).toEqual([step.source]);
    for(const candidate of slot.candidates)expect(candidate.alignments.some(a=>a.researchUnitId===action.id)).toBe(true);
   }
  }
  const candidate=result.packet.slots[0]!.candidates[0]!;
  expect(candidate.alignments.filter(a=>a.researchUnitId.endsWith(':action')&&a.state==='unknown').length).toBeGreaterThan(0);
  expect(candidate.alignments.filter(a=>a.researchUnitId.endsWith(':action')&&a.state==='supported')).toHaveLength(0);
 });
 test('official observation, prompt requirement and possible analyst route remain distinct',()=>{
  for(const candidate of result.packet.slots.flatMap(s=>s.candidates)){
   expect(candidate.observations.map(o=>o.role)).toEqual(['prompt_requirement','official_solution','assistant_derivation']);
   expect(candidate.observations[2]!.certainty).toBe('inferred');
   expect(candidate.observations.every(o=>o.evidenceIds.length>0)).toBe(true);
   expect(candidate.dimensions.filter(d=>['representation','conditions','errors','transfer'].includes(d.dimension)).every(d=>d.state==='not_assessed'&&d.unknowns.length>0)).toBe(true);
  }
 });
 test('all same-slot pairs exist and opaque historical ranks do not become invented advantages',()=>{
  for(const slot of result.packet.slots)expect(slot.pairwiseComparisons).toHaveLength(slot.candidates.length===3?3:1);
  const pairs=result.packet.slots.flatMap(s=>s.pairwiseComparisons);
  expect(pairs).toHaveLength(42);
  expect(pairs.every(p=>p.preferenceState==='unresolved'&&p.preferredCandidateId===null&&p.unknowns.length>0)).toBe(true);
  expect(pairs.every(p=>p.preferenceBasis==='historical_ordinal_not_reestablished')).toBe(true);
 });
 test('slot16 and reordered candidates cannot turn historical ordinal into current pair evidence',()=>{
  const pair=result.packet.slots.find(s=>s.slotId==='slot-16')!.pairwiseComparisons.find(p=>p.leftCandidateId.includes('1416308')&&p.rightCandidateId.includes('1390885'))!;
  expect(pair.preferredCandidateId).toBeNull();expect(pair.preferenceState).toBe('unresolved');expect(pair.rationale).toContain('엄밀한 우열의 추가 근거는 없다');
  const reordered=JSON.parse(candidateSetJson);reordered.slots.reverse();for(const slot of reordered.slots)slot.candidates.reverse();
  const rebuilt=buildCandidateExplanationCase({...input,candidateSetJson:JSON.stringify(reordered)});
  expect(rebuilt.packet.slots.flatMap(s=>s.pairwiseComparisons).every(p=>p.preferredCandidateId===null&&p.preferenceState==='unresolved')).toBe(true);
 });
 test('current teacher choice has exact fixed quotas,23 types and explicit same-type exception',()=>{
  expect(result.selectionAudit.structurallyConsistent).toBe(true);expect(result.selectionAudit.missing).toEqual([]);
  expect(result.selectionAudit.counts.map(c=>c.difficultyCounts)).toEqual([[4,3,1],[4,2,2],[4,3,1]]);
  expect(result.selectionAudit.distinctQuestions).toBe(24);expect(result.selectionAudit.distinctResearchTypes).toBe(23);expect(result.selectionAudit.points).toBe(100);
  expect(result.selectionAudit.duplicateTypes).toEqual([{researchTypeId:'HC21-d3-T02',lecture_keys:['1416655','1416654']}]);
  expect(result.selectionAudit.omittedHistoricalSlots).toEqual(['slot-20']);expect(result.selectionAudit.nativeMembershipApplied).toBe(false);
  expect(result.selectionAudit.rawBandPolicyConflicts).toEqual([]);expect(result.selectionAudit.responseModeCounts).toEqual({constructed:16,descriptive:8});
 });
 test('readable Korean export includes every question and transparent held comparisons without private payloads',()=>{
  const html=renderCandidateExplanationHtml(result);
  expect(html).toContain('한 축 이상 partial 53개');expect(html).toContain('공식 정답·해설');expect(html).toContain('분석자가 풀어 본 과정');
  expect(html).toContain('우열 근거 미완성');expect(html).toContain('SECURITY(GOVERNANCE)');
  for(const q of Object.keys(candidateNotes))expect(html).toContain(`id="q-${q}"`);
  expect(html).not.toMatch(/(?:https?:\/\/|data:image|\/home\/|\/root\/|\/opt\/data\/|<script|<img)/i);
 });
 test('missing notes, wrong source pin, and changed difficulty fail instead of fabricating explanations',()=>{
  const notes={...candidateNotes};delete notes['1389269'];expect(()=>buildCandidateExplanationCase({...input,notes})).toThrow('Missing Korean');
  const projection=JSON.parse(researchProjectionJson);projection.manifest.find((r:{path:string})=>r.path==='source/archive/research_review/multiplication_designs.json').sha256='f'.repeat(64);
  expect(()=>buildCandidateExplanationCase({...input,researchProjectionJson:JSON.stringify(projection)})).toThrow('Unpinned');
  const set=JSON.parse(candidateSetJson);set.slots[0].candidates[0].difficulty.value='최상';expect(()=>buildCandidateExplanationCase({...input,candidateSetJson:JSON.stringify(set)})).toThrow('difficulty');
 });
 test('supplied domain review is bound to exact bytes and never authenticates the reviewer',()=>{
  const packetJson=JSON.stringify(result.packet,null,2)+'\n';
  const receipt={schemaVersion:'education.explanation-domain-review/1',packetSha256:sha256(packetJson),inputBindings:result.packet.inputBindings,reviewer:{owner:'test-supplied-owner',path:'review.ts',sha256:'a'.repeat(64)},review:{inputValid:true,readiness:'reviewable',preferenceReadiness:'ties_or_unresolved',issues:[]}};
  expect(bindSuppliedExplanationReview(JSON.stringify(receipt),packetJson,result.packet.inputBindings).sourceClaimsAuthenticated).toBe(false);
  expect(()=>bindSuppliedExplanationReview(JSON.stringify(receipt),packetJson+' ',result.packet.inputBindings)).toThrow('exact packet');
  expect(()=>bindSuppliedExplanationReview(JSON.stringify({...receipt,inputBindings:{...receipt.inputBindings,researchProjectionSha256:'f'.repeat(64)}}),packetJson,result.packet.inputBindings)).toThrow('exact packet');
 });
});
