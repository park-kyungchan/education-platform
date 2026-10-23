/** Synthetic Git custody only. No actual native review/status or network publication. */
import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadOwnerReviewProjection } from '../scripts/canonical-projection.ts';

test('generated owner gate verifies real acyclic synthetic custody and holds lineage/status drift',async()=>{
 const api=await loadOwnerReviewProjection(),policy=api.policy;
 const root=await mkdtemp(join(tmpdir(),'math-owner-publication-'));
 const git=(...args:string[])=>execFileSync('git',['-C',root,...args],{env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'},stdio:['ignore','pipe','pipe']});
 const commit=(message:string)=>{git('add','.');git('-c','user.name=Synthetic custody fixture','-c','user.email=fixture@example.invalid','commit','-qm',message);return git('rev-parse','HEAD').toString().trim();};
 const readCommit=async(sha:string)=>{const [identity,tree,parents]=git('show','-s','--format=%H%n%T%n%P',sha).toString().trim().split('\n');return {sha:identity,tree:{sha:tree},parents:(parents??'').split(' ').filter(Boolean).map(sha=>({sha}))};};
 const readTree=async(tree:string)=>({sha:tree,truncated:false,tree:git('ls-tree','-r','-t','-z',tree).toString().split('\0').filter(Boolean).map(row=>{const [metadata,path]=row.split('\t'),[mode,type,sha]=metadata!.split(' ');return {path,mode,type,sha};})});
 try {
  git('init','-q');await writeFile(join(root,'source.ts'),'export const syntheticSourceOnly = true;\n');
  const head=commit('H fictional reviewed source'),tree=(await readCommit(head)).tree.sha!;
  // One-blob fixture manifest is serialized according to the published canonical protocol.
  const entries=(await readTree(tree)).tree.map(({path,mode,type,sha})=>({path,mode,type,sha}));
  const manifestSha=createHash('sha256').update('agent-platform.reviewed-source-manifest.v1\n'+JSON.stringify(entries)).digest('hex');
  const {publisher:_publisher,statusContext:_context,...binding}=policy;
  const proof={binding,headSha:head,reviewedTreeSha:tree,reviewedSourceManifestSha256:manifestSha,reviewer:{runtime:'native-codex',taskId:'/synthetic/independent-reviewer'},author:{runtime:'native-codex',taskId:'/synthetic/source-author'},conclusion:'pass',unresolvedFindings:0};
  const put=async(role:string,value:unknown)=>{const path=`${role}/${head}.json`,bytes=Buffer.from(JSON.stringify(value));await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),bytes,{flag:'wx'});return {path,sha256:createHash('sha256').update(bytes).digest('hex')};};
  const raw={...proof,schema:'owner-scoped-native-review-output.v1',reviewStatus:'complete',findings:[]};
  const rawFile=await put('native-review-raw',raw),rawCommit=commit('R0 synthetic raw output'),rawRef={commit:rawCommit,...rawFile};
  const result={...proof,schema:'owner-scoped-independent-review-result.v1',custody:{classification:'source-custody-native-parent-observation',publisher:policy.publisher,rawNativeResult:rawRef}};
  const base={schemaVersion:'1.0.0',projectId:policy.projectId,domainId:policy.domainId,createdAt:'2026-10-17T00:00:00Z'};
  const evidence={...base,kind:'evidence',id:'math-research-module:evidence:synthetic-review',payload:{claim:'Fictional exact independent source review',method:'native-codex-independent-source-review',sourceUrl:`https://github.com/${policy.repository}/blob/${rawCommit}/${rawRef.path}`,fetchedAt:base.createdAt,upstreamRevision:head,result:{outcome:'success',processExitCode:0,contentMatched:true},attempts:[{attempt:1,outcome:'success'}],limitations:['Synthetic fixture only; no actual native authorship or status'],details:{semanticOwner:policy.semanticOwner,review:proof}}};
  const resultFile=await put('native-review-results',result),evidenceFile=await put('native-review-evidence',evidence);
  const verification={...base,kind:'verification',id:'math-research-module:verification:synthetic-review',payload:{targetRefs:[evidence.id],criteria:[{id:'independent-native-source-review',status:'pass',message:'Synthetic exact custody',evidenceRefs:[evidence.id]}],inputHashes:[resultFile,evidenceFile,rawFile],runtime:{name:'synthetic-test-only',version:'1'},details:{semanticOwner:policy.semanticOwner,review:proof}}};
  const verificationFile=await put('native-review-verifications',verification),evidenceCommit=commit('E synthetic normalized custody and artifacts');
  const receipt={...proof,schema:'owner-scoped-independent-review.v1',provenance:{owner:policy.semanticOwner,rawNativeResult:rawRef,result:{commit:evidenceCommit,...resultFile},evidence:{commit:evidenceCommit,...evidenceFile},verification:{commit:evidenceCommit,...verificationFile}}};
  const receiptFile=await put('native-reviews',receipt),receiptCommit=commit('R1 synthetic receipt');
  const status={id:1,context:policy.statusContext,state:'success',creator:{...policy.publisher,id:Number(policy.publisher.id)},target_url:`https://github.com/${policy.repository}/blob/${receiptCommit}/${receiptFile.path}`};
  const reader={readCommit,readTree,readStatuses:async()=>[status],readFile:async(path:string,sha:string)=>{const bytes=git('show',`${sha}:${path}`);return {type:'file',path,encoding:'base64',content:bytes.toString('base64'),size:bytes.length};}};
  const request={repository:policy.repository,head};
  const verified=await api.validateOwnerScopedReviewWithEvidence(policy,request,reader);
  expect(new Set([head,rawCommit,evidenceCommit,receiptCommit]).size).toBe(4);
  expect(verified.receipt.commit).toBe(receiptCommit);expect(verified.manifest.sha256).toBe(manifestSha);
  expect(verified.publisherAuthenticated).toBe(true);expect(verified.nativeAuthenticationEstablished).toBe(false);expect(verified.nativePermissionGranted).toBe(false);expect(verified.acceptanceEstablished).toBe(false);
  expect(git('show',`${rawCommit}:${rawRef.path}`).toString()).toBe(JSON.stringify(raw));
  await expect(api.validateOwnerScopedReviewWithEvidence(policy,request,{...reader,readCommit:async(sha:string)=>sha===evidenceCommit?{...(await readCommit(sha)),parents:[{sha:receiptCommit}]}:readCommit(sha)})).rejects.toThrow('ancestry');
  let statusReads=0;
  await expect(api.validateOwnerScopedReviewWithEvidence(policy,request,{...reader,readStatuses:async()=>[{...status,state:++statusReads===1?'success':'failure'}]})).rejects.toThrow('latest status');
  await expect(api.validateOwnerScopedReviewWithEvidence(policy,request,{...reader,readFile:async(path:string,sha:string)=>{const original=await reader.readFile(path,sha);return path===rawRef.path?{...original,content:Buffer.from('{}').toString('base64'),size:2}:original;}})).rejects.toThrow('digest');
 } finally {await rm(root,{recursive:true,force:true});}
});
