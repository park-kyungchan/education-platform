import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';

const root=resolve(import.meta.dir,'..');
const repository='fixture-owner/fixture-platform',head='a'.repeat(40),tree='b'.repeat(40),receiptCommit='c'.repeat(40),resultCommit='d'.repeat(40);
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const entries=[{path:'ci',mode:'040000',type:'tree',sha:'e'.repeat(40)},{path:'ci/source.ts',mode:'100644',type:'blob',sha:'f'.repeat(40)}];
 const manifest=hash('agent-platform.reviewed-source-manifest.v1\n'+JSON.stringify(entries));
 const result={schema:'agent-platform.independent-review-result.v1',recordClass:'verification',binding:{codeOwner:'agent-platform',evidenceOwner:'codex-harness-engineering',scope:'canonical-source-ci-quality'},headSha:head,reviewedTreeSha:tree,reviewedSourceManifestSha256:manifest,reviewer:{runtime:'native-codex',taskId:'fictional-independent-reviewer'},author:{runtime:'native-codex',taskId:'fictional-source-author'},conclusion:'pass',unresolvedFindings:0};
 const bytes=JSON.stringify(result),{schema,recordClass,...binding}=result;
 const receipt:any={schema:'native-independent-review.v2',...structuredClone(binding),provenance:{owner:'codex-harness-engineering',resultRef:`https://github.com/${repository}/blob/${resultCommit}/native-review-results/${head}.json`,sha256:hash(bytes)}};
 const status={context:'native-independent-review',state:'success',creator:{id:424242,login:'fictional-publisher'},target_url:`https://github.com/${repository}/blob/${receiptCommit}/native-reviews/${head}.json`};
 return {entries,result,bytes,receipt,status};
}
async function runFixture(change:(value:ReturnType<typeof fixture>)=>void=()=>{}){
 const value=fixture();change(value);
 const temporary=mkdtempSync(join(tmpdir(),'education-generated-gate-'));
 try{
  const file=(path:string,bytes:string)=>({type:'file',path,encoding:'base64',size:Buffer.byteLength(bytes),content:Buffer.from(bytes).toString('base64')});
  const responses={
   [`commits/${head}/statuses?per_page=100`]:[value.status],
   [`contents/native-reviews/${head}.json?ref=${receiptCommit}`]:file(`native-reviews/${head}.json`,JSON.stringify(value.receipt)),
   [`git/commits/${head}`]:{sha:head,tree:{sha:tree}},
   [`git/trees/${tree}?recursive=1`]:{sha:tree,truncated:false,tree:value.entries},
   [`contents/native-review-results/${head}.json?ref=${resultCommit}`]:file(`native-review-results/${head}.json`,value.bytes),
  };
  writeFileSync(join(temporary,'responses.json'),JSON.stringify(responses));
  const preload=join(temporary,'mock-fetch.ts');
  writeFileSync(preload,`import {readFileSync,writeFileSync} from 'node:fs';
const responses=JSON.parse(readFileSync(new URL('./responses.json',import.meta.url),'utf8')),reads=[];
process.on('exit',()=>writeFileSync(new URL('./reads.json',import.meta.url),JSON.stringify(reads)));
globalThis.fetch=async(url,options)=>{
 const prefix='https://api.github.com/repos/${repository}/';
 if(typeof url!=='string'||!url.startsWith(prefix)||options?.headers?.Authorization!=='Bearer fictional-test-token'||options?.redirect!=='error')throw Error('Unexpected synthetic request; network forbidden');
 const key=url.slice(prefix.length);reads.push(key);
 if(!Object.hasOwn(responses,key))throw Error('Unlisted synthetic request; network forbidden');
 return Response.json(responses[key]);
};`);
  const child=Bun.spawn([process.execPath,'--no-env-file','--preload',preload,resolve(root,'ci/native-review-gate.js')],{cwd:temporary,env:{PATH:dirname(process.execPath),GITHUB_REPOSITORY:repository,REVIEW_HEAD_SHA:head,GITHUB_TOKEN:'fictional-test-token',NATIVE_REVIEW_STATUS_CREATOR_ID:'424242',NATIVE_REVIEW_STATUS_CREATOR_LOGIN:'fictional-publisher'},stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text()]);
  return {exitCode:await child.exited,stdout,stderr,reads:JSON.parse(readFileSync(join(temporary,'reads.json'),'utf8')) as string[]};
 }finally{rmSync(temporary,{recursive:true,force:true});}
}

test('generated gate accepts owner-correct V2 through exact mocked status, source tree and result bytes',async()=>{
 const outcome=await runFixture();expect(outcome.exitCode).toBe(0);expect(JSON.parse(outcome.stdout).status).toBe('pass');
 expect(outcome.reads).toEqual([`commits/${head}/statuses?per_page=100`,`contents/native-reviews/${head}.json?ref=${receiptCommit}`,`git/commits/${head}`,`git/trees/${tree}?recursive=1`,`contents/native-review-results/${head}.json?ref=${resultCommit}`]);
});
const refusals:[string,(value:ReturnType<typeof fixture>)=>void,string][]=[
 ['Codex provenance forged into legacy V1',v=>{v.receipt.schema='native-independent-review.v1';},'independent native reviewer'],
 ['foreign V2 code owner',v=>{v.receipt.binding.codeOwner='foreign-owner';},'ownership'],
 ['changed actual source tree',v=>{v.entries[1]!.sha='0'.repeat(40);},'manifest'],
 ['wrong immutable result digest',v=>{v.receipt.provenance.sha256='0'.repeat(64);},'digest mismatch'],
 ['self-review',v=>{v.receipt.reviewer={...v.receipt.author};},'independent native identities'],
 ['unexpected authenticated publisher',v=>{v.status.creator.id=424243;},'unexpected creator'],
 ['different immutable result reviewer despite matching byte digest',v=>{v.result.reviewer.taskId='different-fictional-reviewer';v.bytes=JSON.stringify(v.result);v.receipt.provenance.sha256=hash(v.bytes);},'identities differ'],
];
for(const [name,change,message] of refusals)test('generated gate refuses '+name,async()=>{
 const outcome=await runFixture(change);expect(outcome.exitCode).not.toBe(0);expect(outcome.stderr).toContain(message);expect(outcome.stdout).not.toContain('"status":"pass"');
});

test('compiled source proof verifies locally and rejects edited bundle or transitive input pins',async()=>{
 const temporary=mkdtempSync(join(tmpdir(),'education-projection-proof-'));
 try{
  mkdirSync(join(temporary,'ci'));mkdirSync(join(temporary,'architecture'));
  for(const path of ['ci/verify-projection.ts','ci/generate-projection.ts','ci/native-review.entry.ts','ci/native-review-gate.js','architecture/common-ci-provider.json'])copyFileSync(resolve(root,path),join(temporary,path));
  const verify=()=>Bun.spawnSync([process.execPath,'--no-env-file',join(temporary,'ci/verify-projection.ts')],{cwd:temporary,env:{PATH:dirname(process.execPath)},stdout:'pipe',stderr:'pipe'});
  expect(verify().exitCode).toBe(0);
  const gate=join(temporary,'ci/native-review-gate.js');writeFileSync(gate,readFileSync(gate,'utf8')+'\n// drift\n');
  expect(verify().exitCode).not.toBe(0);copyFileSync(resolve(root,'ci/native-review-gate.js'),gate);
  const path=join(temporary,'architecture/common-ci-provider.json'),manifest=JSON.parse(readFileSync(path,'utf8'));
  manifest.compiledInputs[0].sha256='0'.repeat(64);writeFileSync(path,JSON.stringify(manifest));
  expect(verify().exitCode).not.toBe(0);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
