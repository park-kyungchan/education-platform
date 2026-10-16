import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectExamPreselection, elementaryExamRequirement} from '../dc-gang-a/src/academy/examSelection';
import {unknown} from '../dc-gang-a/src/learning/model';
import {makeExamples} from './src/fixtures';
import {requirePreviewData} from './src/model';

const root = import.meta.dir, output = resolve(root,'dist');
const analysis = inspectExamPreselection({kind:'exam_selection_workspace',schemaVersion:1,
  requirementRevision:elementaryExamRequirement.revision,title:'월말평가 · 문항 선택 전 분석',
  examDate:unknown('정확한 시험일 미확정'),timeZone:unknown('시간대 미확정'),selections:[]},[]);
const publicAnalysis={selectedQuestions:analysis.selectedQuestions,selectedPoints:analysis.selectedPoints,finalMembershipCreated:analysis.finalMembershipCreated,sourceVerification:analysis.sourceVerification,
  coverage:{inventoryCompleteness:analysis.coverage.inventoryCompleteness,itemToUnitCoverage:analysis.coverage.itemToUnitCoverage}};
const data = requirePreviewData({schema:'academy.month-end-static-preview.v1',requirement:analysis.requirement,analysis:publicAnalysis,examples:makeExamples(),
  sourceMode:'synthetic_examples_only',actualInventory:'unknown'});
await mkdir(output,{recursive:true});
const result = await Bun.build({entrypoints:[resolve(root,'src/app.ts')],outdir:output,target:'browser',
  naming:'app.js',format:'iife',minify:true,sourcemap:'none'});
if (!result.success) throw new AggregateError(result.logs,'browser_build_failed');
const json = JSON.stringify(data).replaceAll('<','\\u003c');
await writeFile(resolve(output,'index.html'),(await readFile(resolve(root,'index.html'),'utf8')).replace('<!--PREVIEW_DATA-->',json));
await copyFile(resolve(root,'src/styles.css'),resolve(output,'styles.css'));
await mkdir(resolve(output,'fonts'),{recursive:true});
for (const name of ['NotoSansKR-variable.woff2','NotoSerifKR-variable.woff2','NotoSansKR-OFL.txt','NotoSerifKR-OFL.txt']) {
  await copyFile(resolve(root,'../dc-gang-a/src/academy/web/assets',name),resolve(output,'fonts',name));
}
await writeFile(resolve(output,'.nojekyll'),'');
// A single-file review artifact can be opened directly without any hosting or design service.
let css=await readFile(resolve(output,'styles.css'),'utf8');
for(const name of ['NotoSansKR-variable.woff2','NotoSerifKR-variable.woff2']){
  const bytes=await readFile(resolve(output,'fonts',name));css=css.replace(`./fonts/${name}`,`data:font/woff2;base64,${bytes.toString('base64')}`);
}
const script=(await readFile(resolve(output,'app.js'),'utf8')).replaceAll('</script','<\\/script');
const sha=(value:string)=>createHash('sha256').update(value).digest('base64');
const policy=`default-src 'none'; script-src 'sha256-${sha(script)}'; style-src 'sha256-${sha(css)}'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-src 'none'`;
const standalone=(await readFile(resolve(output,'index.html'),'utf8'))
  .replace(/content="default-src[^"\n]*"/,`content="${policy}"`)
  .replace('<link rel="stylesheet" href="./styles.css">',()=>`<style>${css}</style>`)
  .replace('<script defer src="./app.js"></script>','')
  .replace('</body>',()=>`<script>${script}</script></body>`);
const licenses=(await Promise.all(['NotoSansKR-OFL.txt','NotoSerifKR-OFL.txt'].map(name=>readFile(resolve(output,'fonts',name),'utf8')))).join('\n\n').replaceAll('--','- -');
await writeFile(resolve(output,'review.html'),standalone.replace('</html>',()=>`<!-- Embedded font licenses:\n${licenses}\n-->\n</html>`));
console.log(JSON.stringify({status:'built',output:'dist',sourceMode:data.sourceMode,actualInventory:'unknown',
  selectedQuestions:analysis.selectedQuestions,academyRequests:0,magicPathRuntimeDependencies:0}));
