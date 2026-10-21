/** Root checkpoint entrypoint: existing canonical APIs, exact committed objects, read-only Git. */
import {openGitWork,validateGitWorkRecords,validateGitWorkTransition,taskVerificationTarget} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/index.ts';
import type {TaskRecord,InputRecord} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/types.ts';
import {resolve} from 'node:path';
import {sourceBase} from './inventory.ts';
const auditor='/home/palantirkc/projects/agent-platform',pin='712f90deac0676e662dc5d75d88d89f7b6773bfe';
const git=(cwd:string,args:string[])=>{const p=Bun.spawnSync(['git',...args],{cwd});if(p.exitCode)throw Error('git_read_failed');return p.stdout.toString().trim();};
if(git(auditor,['rev-parse','HEAD'])!==pin||Bun.spawnSync(['git','diff','--quiet','HEAD','--','packages/work-continuity/src'],{cwd:auditor}).exitCode)throw Error('canonical_auditor_pin_or_source_drift');
const commit=process.argv[2];if(!commit||!/^([a-f0-9]{40})$/.test(commit))throw Error('exact_committed_candidate_required');
const root=resolve(import.meta.dir,'../..');
const selection={repositoryRoot:root,repositoryId:'park-kyungchan/education-platform',projectId:'education-platform',workId:'academy-query-integration-20261021'};
const before=await openGitWork({...selection,commit:sourceBase}),after=await openGitWork({...selection,commit});
const task=await after.readRecord({kind:'task',id:'education-platform:task:academy-query-integration-20261021-qry-01'}) as TaskRecord;
const target=taskVerificationTarget(task),snapshot=await validateGitWorkRecords(after),transition=await validateGitWorkTransition(before,after);
const entry=(await after.readSource({kind:'snapshot',path:'architecture/academy-query-integration/entrypoint.json'})).value as Record<string,string>;
const result=await after.readSource({kind:'snapshot',path:entry.resultInput!});
const input=await after.readRecord({kind:'input',id:'QRY-01-VERIFICATION-R1'}) as InputRecord;
const verification=(input.content as {verification:any}).verification;
const binding={actualTaskVerificationTarget:target,targetMatched:verification.payload.targetRefs.includes(target),
  resultObservationCited:verification.payload.criteria.every((r:any)=>r.evidenceRefs.includes(entry.resultEvidenceId)),
  exactResultInputHashBound:verification.payload.inputHashes.some((r:any)=>r.path===entry.resultInput&&r.sha256===result.sha256),resultInputSha256:result.sha256};
const receipt={schema:'academy.qry01-canonical-checkpoint.v1',createdAt:new Date().toISOString(),auditor:{path:auditor,commit:pin,api:'openGitWork/validateGitWorkRecords/validateGitWorkTransition/taskVerificationTarget'},
  before:{commit:sourceBase,tree:git(root,['rev-parse',sourceBase+'^{tree}'])},after:{commit,tree:git(root,['rev-parse',commit+'^{tree}'])},
  snapshot,semanticTransition:transition,binding,sharedDelivery:false,nativeAdoption:false,formalAcceptance:false};
console.log(JSON.stringify(receipt,null,2));
if(!snapshot.valid||!transition.valid||!binding.targetMatched||!binding.resultObservationCited||!binding.exactResultInputHashBound)process.exitCode=1;
