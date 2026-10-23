import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
// @ts-expect-error Generated canonical projection has no separately maintained declarations.
import {policy,validateOwnerScopedReviewWithEvidence,deriveReviewedSourceManifest} from '../../ci/generated/native-review-gate.js';
test('fixed owner policy and publisher are immutable',()=>{expect(Object.isFrozen(policy)).toBe(true);expect(Object.isFrozen(policy.publisher)).toBe(true);});
const root=resolve(import.meta.dir,'../..'),head='a'.repeat(40),tree='b'.repeat(40),rawCommit='c'.repeat(40),evidenceCommit='d'.repeat(40),receiptCommit='e'.repeat(40);
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
function fixture(change:(value:any)=>void=()=>{}){
 const entries=[{path:'ci',mode:'040000',type:'tree',sha:'f'.repeat(40)},{path:'ci/source.ts',mode:'100644',type:'blob',sha:'1'.repeat(40)}];
 const manifest=deriveReviewedSourceManifest({sha:tree,truncated:false,tree:entries},tree);
 const {publisher,statusContext,...binding}=policy;
 const proof={binding,headSha:head,reviewedTreeSha:tree,reviewedSourceManifestSha256:manifest.sha256,reviewer:{runtime:'native-codex',taskId:'/fictional/independent-review'},author:{runtime:'native-codex',taskId:'/fictional/author'},conclusion:'pass',unresolvedFindings:0};
 const raw:any={...structuredClone(proof),schema:'owner-scoped-native-review-output.v1',reviewStatus:'complete',findings:[]};
 const result:any={...structuredClone(proof),schema:'owner-scoped-independent-review-result.v1'};
 const evidence:any={schemaVersion:'1.0.0',kind:'evidence',id:policy.projectId+':evidence:review-fixture',projectId:policy.projectId,domainId:policy.domainId,createdAt:'2026-10-17T00:00:00Z',payload:{claim:'Fictional exact review test only',method:'native-codex-independent-source-review',sourceUrl:`https://github.com/${policy.repository}/blob/${rawCommit}/native-review-raw/${head}.json`,fetchedAt:'2026-10-17T00:00:00Z',upstreamRevision:head,result:{outcome:'success',processExitCode:0,contentMatched:true},attempts:[{attempt:1,outcome:'success'}],limitations:['Synthetic fixture only; no native authentication or domain acceptance'],details:{semanticOwner:policy.semanticOwner,review:structuredClone(proof)}}};
 const verification:any={schemaVersion:'1.0.0',kind:'verification',id:policy.projectId+':verification:review-fixture',projectId:policy.projectId,domainId:policy.domainId,createdAt:'2026-10-17T00:00:00Z',payload:{targetRefs:[evidence.id],criteria:[{id:'independent-native-source-review',status:'pass',message:'Fictional review test',evidenceRefs:[evidence.id]}],inputHashes:[],runtime:{name:'native-codex',version:'synthetic-only'},details:{semanticOwner:policy.semanticOwner,review:structuredClone(proof)}}};
 change({raw,result,evidence,verification,entries});
 const files=new Map<string,Buffer>();const put=(role:string,value:any,commit=evidenceCommit)=>{const path=role+'/'+head+'.json',bytes=Buffer.from(JSON.stringify(value));files.set(commit+':'+path,bytes);return{commit,path,sha256:hash(bytes)};};
 const rawRef=put('native-review-raw',raw,rawCommit);result.custody={classification:'source-custody-native-parent-observation',publisher,rawNativeResult:rawRef};
 const resultRef=put('native-review-results',result),evidenceRef=put('native-review-evidence',evidence);
 verification.payload.inputHashes=[resultRef,evidenceRef,rawRef].map(({path,sha256})=>({path,sha256}));const verificationRef=put('native-review-verifications',verification);
 const receipt:any={...proof,schema:'owner-scoped-independent-review.v1',provenance:{owner:policy.semanticOwner,result:resultRef,evidence:evidenceRef,verification:verificationRef,rawNativeResult:rawRef}};
 const statuses:any[]=[{id:42,context:statusContext,state:'success',creator:{...publisher,id:Number(publisher.id)},target_url:`https://github.com/${policy.repository}/blob/${receiptCommit}/native-reviews/${head}.json`}];
 const parent:any={[rawCommit]:head,[evidenceCommit]:rawCommit,[receiptCommit]:evidenceCommit};const reads:string[]=[];
 const reader={readCommit:async(sha:string)=>{reads.push('commit:'+sha);return{sha,tree:{sha:tree},parents:parent[sha]?[{sha:parent[sha]}]:[]};},readStatuses:async()=>{reads.push('status');return statuses;},readTree:async()=>({sha:tree,truncated:false,tree:entries}),readFile:async(path:string,commit:string)=>{reads.push('file:'+commit+':'+path);const bytes=path==='native-reviews/'+head+'.json'&&commit===receiptCommit?Buffer.from(JSON.stringify(receipt)):files.get(commit+':'+path);if(!bytes)throw Error('Unexpected synthetic read; no network');return{type:'file',path,encoding:'base64',content:bytes.toString('base64'),size:bytes.length};}};
 return{reader,receipt,statuses,parent,reads};
}
test('generated canonical owner gate accepts fixed owner acyclic raw/evidence/receipt chain',async()=>{
 const value=fixture(),result=await validateOwnerScopedReviewWithEvidence(policy,{repository:policy.repository,head},value.reader);
 expect(result.publisherAuthenticated).toBe(true);expect(result.nativeAuthenticationEstablished).toBe(false);expect(result.nativePermissionGranted).toBe(false);expect(result.acceptanceEstablished).toBe(false);expect(value.reads.filter(p=>p==='status')).toHaveLength(2);
});
const mutations:[string,(v:any)=>void][]=[['foreign semantic binding',v=>v.raw.binding.semanticOwner='foreign'],['self review',v=>v.raw.reviewer={...v.raw.author}],['unfinished raw review',v=>v.raw.reviewStatus='incomplete'],['unresolved raw finding',v=>{v.raw.findings=[{id:'fictional-open'}];v.raw.unresolvedFindings=1;}],['different exact tree',v=>v.entries[1].sha='2'.repeat(40)],['fake Evidence kind',v=>v.evidence.kind='evaluation'],['unaccepted Verification criterion',v=>v.verification.payload.criteria[0].status='pending'],['wrong domain evidence',v=>v.evidence.domainId='foreign-domain']];
for(const [name,change]of mutations)test('generated canonical owner gate rejects '+name,async()=>{const value=fixture(change);await expect(validateOwnerScopedReviewWithEvidence(policy,{repository:policy.repository,head},value.reader)).rejects.toThrow();});
test('latest status failure and incorrect publisher cannot reuse old pass',async()=>{
 for(const mutate of [(v:any)=>v.statuses.unshift({...v.statuses[0],id:43,state:'failure'}),(v:any)=>v.statuses[0].creator.id++]){const value=fixture();mutate(value);await expect(validateOwnerScopedReviewWithEvidence(policy,{repository:policy.repository,head},value.reader)).rejects.toThrow();}
});
test('publication chain cannot reference itself or skip raw custody',async()=>{const value=fixture();value.parent[evidenceCommit]=head;await expect(validateOwnerScopedReviewWithEvidence(policy,{repository:policy.repository,head},value.reader)).rejects.toThrow();});
test('fixed repository holds before any reader operation',async()=>{const value=fixture();await expect(validateOwnerScopedReviewWithEvidence(policy,{repository:'foreign/owner',head},value.reader)).rejects.toThrow();expect(value.reads).toHaveLength(0);});
test('bundled CLI runs without dependencies and rejects unknown repository before network',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'owner-review-cli-'));try{const gate=resolve(temporary,'gate.js');cpSync(resolve(root,'ci/generated/native-review-gate.js'),gate);const result=Bun.spawnSync([process.execPath,'--no-env-file',gate],{cwd:temporary,env:{PATH:dirname(process.execPath),GITHUB_REPOSITORY:'foreign/repository',REVIEW_HEAD_SHA:head,GITHUB_TOKEN:'fictional-only'},stdout:'pipe',stderr:'pipe'});expect(result.exitCode).not.toBe(0);expect(result.stderr.toString()).toContain('fixed repository');}finally{rmSync(temporary,{recursive:true,force:true});}
});
test('standalone bundled CLI accepts exact mocked owner chain with no dependencies or real network',async()=>{
 const value=fixture(),responses:Record<string,unknown>={};
 for(const sha of [head,rawCommit,evidenceCommit,receiptCommit])responses['git/commits/'+sha]=await value.reader.readCommit(sha);
 responses['commits/'+head+'/statuses?per_page=100']=await value.reader.readStatuses();
 responses['git/trees/'+tree+'?recursive=1']=await value.reader.readTree();
 for(const [role,commit]of [['native-review-raw',rawCommit],['native-review-results',evidenceCommit],['native-review-evidence',evidenceCommit],['native-review-verifications',evidenceCommit],['native-reviews',receiptCommit]] as const){const path=role+'/'+head+'.json';responses['contents/'+path+'?ref='+commit]=await value.reader.readFile(path,commit);}
 const temporary=mkdtempSync(join(tmpdir(),'owner-review-cli-pass-'));try{
  cpSync(resolve(root,'ci/generated/native-review-gate.js'),resolve(temporary,'gate.js'));
  writeFileSync(resolve(temporary,'responses.json'),JSON.stringify(responses));
  writeFileSync(resolve(temporary,'preload.ts'),`import {readFileSync} from 'node:fs';
const responses=JSON.parse(readFileSync(new URL('./responses.json',import.meta.url),'utf8'));
globalThis.fetch=async(url,options)=>{const prefix=${JSON.stringify('https://api.github.com/repos/'+policy.repository+'/')};if(typeof url!=='string'||!url.startsWith(prefix)||options?.redirect!=='error'||options?.headers?.Authorization!=='Bearer fictional-only')throw Error('Unexpected mocked transport; real network forbidden');const key=url.slice(prefix.length);if(!Object.hasOwn(responses,key))throw Error('Unlisted mocked request; real network forbidden');return Response.json(responses[key]);};`);
  const result=Bun.spawnSync([process.execPath,'--no-env-file','--preload',resolve(temporary,'preload.ts'),resolve(temporary,'gate.js')],{cwd:temporary,env:{PATH:dirname(process.execPath),GITHUB_REPOSITORY:policy.repository,REVIEW_HEAD_SHA:head,GITHUB_TOKEN:'fictional-only'},stdout:'pipe',stderr:'pipe'});
  expect(result.exitCode).toBe(0);const proof=JSON.parse(result.stdout.toString());expect(proof.schema).toBe('owner-scoped-native-review-ci.v1');expect(proof.nativeAuthenticationEstablished).toBe(false);expect(proof.acceptanceEstablished).toBe(false);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
test('projection proof rejects edited output, source graph, fixed policy and generator bytes',()=>{
 const temporary=mkdtempSync(join(tmpdir(),'owner-review-proof-'));try{
  const provider=JSON.parse(readFileSync(resolve(root,'ci/provider.json'),'utf8'));
  const paths=['ci/provider.json','ci/verify-projection.ts',...provider.generationInputs.map((p:any)=>p.path),...provider.generated.map((p:any)=>p.path),'harness/agent-platform.lock.json'];
  for(const path of new Set(paths)){mkdirSync(dirname(resolve(temporary,path)),{recursive:true});cpSync(resolve(root,path),resolve(temporary,path));}
  const verify=()=>Bun.spawnSync([process.execPath,'--no-env-file',resolve(temporary,'ci/verify-projection.ts')],{cwd:temporary,env:{PATH:dirname(process.execPath)},stdout:'pipe',stderr:'pipe'});
  expect(verify().exitCode).toBe(0);
  for(const change of [(p:any)=>p.compiledInputs[0].sha256='0'.repeat(64),(p:any)=>p.policy.semanticOwner='foreign']){const value=structuredClone(provider);change(value);writeFileSync(resolve(temporary,'ci/provider.json'),JSON.stringify(value));expect(verify().exitCode).not.toBe(0);}
  writeFileSync(resolve(temporary,'ci/provider.json'),JSON.stringify(provider));
  writeFileSync(resolve(temporary,'ci/generated/native-review-gate.js'),readFileSync(resolve(root,'ci/generated/native-review-gate.js'),'utf8')+'\n// drift\n');expect(verify().exitCode).not.toBe(0);cpSync(resolve(root,'ci/generated/native-review-gate.js'),resolve(temporary,'ci/generated/native-review-gate.js'));
  writeFileSync(resolve(temporary,provider.generator),readFileSync(resolve(root,provider.generator),'utf8')+'\n// drift\n');expect(verify().exitCode).not.toBe(0);
 }finally{rmSync(temporary,{recursive:true,force:true});}
});
