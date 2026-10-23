import { DATA } from '../src/components/generated/MathData';
import { RESEARCH_DESIGNS } from '../src/components/generated/ResearchData';
import capabilities from '../source/capability-research/초3_105유형_능력후보_근거대응.json';
import preserved from '../source/archive/research_review/original_170_examples_and_hierarchy.json';
import { validateResearch } from '../research/structure';
if (JSON.stringify(DATA) !== JSON.stringify(preserved)) throw new Error('Runtime DATA drift from preserved 170-example dataset');
console.log('PASS domain structure', JSON.stringify(validateResearch(DATA, RESEARCH_DESIGNS, capabilities)));
