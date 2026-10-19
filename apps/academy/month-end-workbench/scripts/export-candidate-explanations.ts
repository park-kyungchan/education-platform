import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {bindSuppliedExplanationReview,buildCandidateExplanationCase,renderCandidateExplanationHtml,sha256} from '../src/candidate-explanations.ts';
import {candidateNotes,slotNotes,teacherSelection} from '../cases/candidate-explanation-20261019/notes.ko.ts';

/** Explicit local export only. This never runs Academy, PDF, model or network tools. */
export async function exportCandidateExplanations(outputDirectory:string,reviewJson?:string){
 const root=resolve(import.meta.dir,'..');
 const candidateSetJson=await Bun.file(resolve(root,'work/month-end-candidate-preparation-20261019/candidate-set.json')).text();
 const researchProjectionJson=await Bun.file(resolve(root,'data/research-projection.json')).text();
 const result=buildCandidateExplanationCase({candidateSetJson,researchProjectionJson,notes:candidateNotes,slotNotes,selection:teacherSelection});
 const packetJson=JSON.stringify(result.packet,null,2)+'\n';
 const review=reviewJson?bindSuppliedExplanationReview(reviewJson,packetJson,result.packet.inputBindings):undefined;
 // A caller-supplied review is a reported result, not an authenticated reviewer or authority grant.
 const artifacts=[
  {path:'explanation-packet.json',contents:packetJson},
  {path:'teacher-selection-audit.json',contents:JSON.stringify(result.selectionAudit,null,2)+'\n'},
  {path:'candidate-explanations.ko.html',contents:renderCandidateExplanationHtml(result,review)},
 ];
 if(review)artifacts.push({path:'domain-review-summary.json',contents:JSON.stringify(review,null,2)+'\n'});
 const manifest={schemaVersion:'education.candidate-explanation-export/1',identity:result.packet.identity,inputBindings:result.packet.inputBindings,
  files:artifacts.map(a=>({path:a.path,sha256:sha256(a.contents),bytes:Buffer.byteLength(a.contents)})),
  summary:{slots:result.packet.slots.length,candidates:result.packet.slots.reduce((sum,s)=>sum+s.candidates.length,0),
   researchUnits:result.packet.slots.reduce((sum,s)=>sum+s.researchUnits.length,0),
   researchMicrosteps:result.readableSlots.reduce((sum,s)=>sum+s.stepUnits.length,0),
   sameSlotPairs:result.packet.slots.reduce((sum,s)=>sum+s.pairwiseComparisons.length,0),
   unresolvedPairs:result.packet.slots.flatMap(s=>s.pairwiseComparisons).filter(p=>p.preferenceState==='unresolved').length,
   selectedQuestions:result.selectionAudit.rows.length,selectedResearchTypes:result.selectionAudit.distinctResearchTypes,selectedPoints:result.selectionAudit.points},
  strictDomainReview:{owner:'academy-workbench/tools/academy-mcp/src/pool-explanation-review.ts',performedByExport:false,
   callerSuppliedResultAttached:!!review,sourceClaimsAuthenticated:false},
  governance:result.governance,existingCandidateProposalMutated:false,teacherSelectionMotiveInferred:false,
 };
 await mkdir(outputDirectory,{recursive:true});
 for(const artifact of artifacts)await Bun.write(resolve(outputDirectory,artifact.path),artifact.contents);
 await Bun.write(resolve(outputDirectory,'export-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(import.meta.main){
 const args=Bun.argv.slice(2),out=args.indexOf('--out-dir'),reviewIndex=args.indexOf('--review');
 if(out<0||!args[out+1])throw new Error('Usage: bun scripts/export-candidate-explanations.ts --out-dir <explicit-local-directory> [--review <caller-supplied-review.json>]');
 const reviewJson=reviewIndex>=0&&args[reviewIndex+1]?await Bun.file(args[reviewIndex+1]!).text():undefined;
 console.log(JSON.stringify(await exportCandidateExplanations(resolve(args[out+1]!),reviewJson),null,2));
}
