/** Calls the existing canonical GitWork APIs externally; does not alter the consumer lock. */
import {openGitWork,validateGitWorkRecords,validateGitWorkTransition,taskVerificationTarget} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/index.ts';
import {resolve} from 'node:path';
import type {TaskRecord,InputRecord} from '/home/palantirkc/projects/agent-platform/packages/work-continuity/src/git-work/types.ts';
const auditor='/home/palantirkc/projects/agent-platform',pin='712f90deac0676e662dc5d75d88d89f7b6773bfe';
const git=(cwd:string,args:string[])=>{const p=Bun.spawnSync(['git',...args],{cwd});if(p.exitCode)throw Error('git_read_failed:'+p.stderr.toString());return p.stdout.toString().trim();};
if(git(auditor,['rev-parse','HEAD'])!==pin||Bun.spawnSync(['git','diff','--quiet','HEAD','--','packages/work-continuity/src'],{cwd:auditor}).exitCode)throw Error('canonical_auditor_pin_or_source_drift');
const root=resolve(import.meta.dir,'../..'),base='4bdef2c77cb9a537cecf806ba16054646147dbc5';
const commit=process.argv[2];if(!commit||!/^([a-f0-9]{40})$/.test(commit))throw Error('exact_commit_required');
const selection={repositoryRoot:root,repositoryId:'park-kyungchan/education-platform',projectId:'education-platform',workId:'academy-state-model-20261021'};
const before=await openGitWork({...selection,commit:base}),after=await openGitWork({...selection,commit});
const task=await after.readRecord({kind:'task',id:'education-platform:task:academy-state-model-20261021-dom-01'}) as TaskRecord;
const target=taskVerificationTarget(task);
const snapshot=await validateGitWorkRecords(after),transition=await validateGitWorkTransition(before,after);
const entry=(await after.readSource({kind:'snapshot',path:'architecture/academy-state-model/entrypoint.json'})).value as any;
const resultPath=entry.resultInput;
const result=await after.readSource({kind:'snapshot',path:resultPath});
const verificationInput=await after.readRecord({kind:'input',id:'DOM-01-VERIFICATION-R2'}) as InputRecord;
const verification=(verificationInput.content as any).verification;
const binding={actualTaskVerificationTarget:target,targetMatched:verification.payload.targetRefs.includes(target),resultObservationCited:verification.payload.criteria.some((r:any)=>r.evidenceRefs.includes(entry.resultEvidenceId)),exactResultInputHashBound:verification.payload.inputHashes.some((r:any)=>r.path===resultPath&&r.sha256===result.sha256),resultInputSha256:result.sha256};
const receipt={schema:'academy.dom01-canonical-audit.v1',createdAt:new Date().toISOString(),auditor:{repositoryRoot:auditor,commit:pin,api:'openGitWork/readRecord/readSource/taskVerificationTarget/validateGitWorkRecords/validateGitWorkTransition',consumerLockChanged:false},before:{commit:base,tree:git(root,['rev-parse',base+'^{tree}'])},after:{commit,tree:git(root,['rev-parse',commit+'^{tree}'])},rejectedIntermediateCandidate:{commit:'1ccae7f3222380ad1c2bf337d7d8856ad990d5c7',reason:'UNRECOGNIZED_WORK_RECORD_PATH',transitionThroughCandidateClaimed:false},snapshot,semanticTransition:transition,binding,authority:'source-only; no shared audit/native authentication/operational acceptance'};
const output=process.argv[3];
if(output){if(!output.startsWith('architecture/academy-state-model/observations/')||!output.endsWith('.json')||output.includes('..')||await Bun.file(resolve(root,output)).exists())throw Error('new_owned_receipt_path_required');await Bun.write(resolve(root,output),JSON.stringify(receipt,null,2)+'\n');}
console.log(JSON.stringify(receipt,null,2));
if(!snapshot.valid||!transition.valid||!binding.targetMatched||!binding.resultObservationCited||!binding.exactResultInputHashBound)process.exitCode=1;
