import { describe, expect, test } from 'bun:test';
import { DATA } from '../src/components/generated/MathData';
import { RESEARCH_DESIGNS } from '../src/components/generated/ResearchData';
import capabilities from '../source/capability-research/초3_105유형_능력후보_근거대응.json';
import { validateResearch } from '../research/structure';
describe('research structure, distinct from mathematical validation', () => {
  test('151/105/46 types, 170 originals, 1216 actions, 28 candidates', () => expect(validateResearch(DATA, RESEARCH_DESIGNS, capabilities)).toEqual({ types:151,core:105,connected:46,originalExamples:170,microActions:1216,capabilityCandidates:28,mappings:105 }));
  test('rejects a broken design link', () => { const changed = {...RESEARCH_DESIGNS}; delete changed[Object.keys(changed)[0]]; expect(() => validateResearch(DATA,changed,capabilities)).toThrow('Expected 151 design records'); });
  test('rejects an invented capability', () => { const changed = structuredClone(capabilities); changed.mapping[0].structuralCandidateIds.push('not-a-capability'); expect(() => validateResearch(DATA,RESEARCH_DESIGNS,changed)).toThrow('Missing capability'); });
  test('rejects conflating task analysis with student observation', () => { const changed:any = structuredClone(capabilities); changed.mapping[0].evidenceScope='student-validated'; expect(() => validateResearch(DATA,RESEARCH_DESIGNS,changed)).toThrow('Student evidence claim'); });
});
