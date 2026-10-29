// Independent exact-head review for pull requests, run by .github/workflows/independent-review.yml.
// The workflow runs on pull_request_target, so this file and the prompt come from the trusted base; the PR head is
// only read. One verdict per head: a later run reuses the first verdict artifact instead of sampling the model again.
import {mkdirSync,readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';

export const REVIEW_CHECK_NAME='Independent exact-head review';
export const REVIEW_MODEL='gpt-6.1-sol';
export const SEVERITY={high:true,medium:true,low:false} as const; // true: the finding blocks the merge
export const VERDICTS=['pass','changes_required'] as const;
export const FINDING_FIELDS=['evidence','file','line','severity','summary'] as const;
export const TEMPLATE_KEYS=['REPOSITORY','PR_NUMBER','BASE_SHA','HEAD_SHA','MERGE_BASE','DIFF_PATH','DIFF_STAT'] as const;
export const ARTIFACT_PREFIX='independent-review-verdict-';
export const RUN_PREFIX='bun trusted/scripts/independent-review.ts ';
export const REQUEST_LABEL='full-review';
export type Severity=keyof typeof SEVERITY;
export interface Finding {file:string;line:number;severity:Severity;summary:string;evidence:string}
export interface Verdict {verdict:typeof VERDICTS[number];findings:Finding[]}
export interface Artifact {id:number;name:string;expired:boolean;created_at:string;archive_download_url:string;workflow_run?:{id?:number;head_sha?:string}|null}
type TemplateKey=typeof TEMPLATE_KEYS[number];

export class ReviewError extends Error {}
const site='scripts/independent-review.ts';
const fail=(code:string,detail:string):never=>{
  const line=/:(\d+):\d+\)?$/.exec(new Error().stack?.split('\n')[2]??'')?.[1]??'0';
  throw new ReviewError(`${code}@${site}:${line} ${detail}`);
};
const SHA=/^[0-9a-f]{40}$/;
const record=(value:unknown):Record<string,unknown>|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
const sameKeys=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).sort().join()===[...keys].sort().join();

export const parseVerdict=(text:string):Verdict=>{
  let value:unknown;
  try{value=JSON.parse(text);}catch{return fail('independent_review_verdict_not_json',`bytes=${text.length}`);}
  const root=record(value);
  if(!root||!sameKeys(root,['findings','verdict']))return fail('independent_review_verdict_shape','root keys');
  const verdict=VERDICTS.find(v=>v===root.verdict)??fail('independent_review_verdict_unknown',String(root.verdict).slice(0,20));
  if(!Array.isArray(root.findings))return fail('independent_review_verdict_shape','findings');
  const findings=root.findings.map((item:unknown,index):Finding=>{
    const f=record(item);
    if(!f||!sameKeys(f,FINDING_FIELDS))return fail('independent_review_finding_shape',`index=${index}`);
    const severity=(Object.keys(SEVERITY) as Severity[]).find(s=>s===f.severity);
    if(!severity||typeof f.file!=='string'||typeof f.line!=='number'||!Number.isInteger(f.line)||typeof f.summary!=='string'||typeof f.evidence!=='string')
      return fail('independent_review_finding_field',`index=${index}`);
    return {file:f.file,line:f.line,severity,summary:f.summary,evidence:f.evidence};
  });
  return {verdict,findings};
};

export const judge=(v:Verdict):{pass:boolean;blocking:number}=>{
  const blocking=v.findings.filter(f=>SEVERITY[f.severity]).length;
  if(v.verdict==='pass'&&blocking)fail('independent_review_verdict_contradiction',`blocking=${blocking}`);
  return {pass:v.verdict==='pass',blocking};
};

export const renderPrompt=(template:string,values:Record<TemplateKey,string>):string=>{
  const used=new Set([...template.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(m=>m[1]!));
  const keys=new Set<string>(TEMPLATE_KEYS);
  for(const key of used)if(!keys.has(key))fail('independent_review_template_unknown_key',key);
  for(const key of keys)if(!used.has(key))fail('independent_review_template_missing_key',key);
  return template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key:TemplateKey)=>values[key]);
};

// The first verdict for a head is final. An expired one blocks instead of allowing a fresh sample.
export const priorVerdict=async(repository:string,head:string,token:string,fetchImpl:typeof fetch=fetch):Promise<Artifact|undefined>=>{
  const name=ARTIFACT_PREFIX+head;
  const response=await fetchImpl(`https://api.github.com/repos/${repository}/actions/artifacts?name=${name}&per_page=100`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}});
  if(!response.ok)return fail('independent_review_artifacts_unreadable',`status=${response.status}`);
  const body=await response.json() as {total_count:number;artifacts:Artifact[]};
  if(body.total_count>body.artifacts.length)fail('independent_review_artifacts_paged',`total=${body.total_count}`);
  const own=body.artifacts.filter(a=>a.name===name);
  if(own.some(a=>a.workflow_run?.head_sha!==head))fail('independent_review_artifact_head_mismatch',`count=${own.length}`);
  const live=own.filter(a=>!a.expired).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id-b.id);
  if(own.length&&!live.length)fail('independent_review_verdict_expired',`count=${own.length}`);
  return live[0];
};

const download=async(artifact:Artifact,token:string,zipPath:string)=>{
  const first=await fetch(artifact.archive_download_url,{headers:{authorization:`Bearer ${token}`},redirect:'manual'});
  const location=first.headers.get('location');
  const response=first.status>=300&&first.status<400&&location?await fetch(location):first;
  if(!response.ok)fail('independent_review_artifact_download',`status=${response.status}`);
  writeFileSync(zipPath,Buffer.from(await response.arrayBuffer()));
  const unzip=Bun.spawnSync(['unzip','-p',zipPath,'verdict.json'],{stdout:'pipe',stderr:'pipe'});
  if(unzip.exitCode!==0)fail('independent_review_artifact_unzip',`exit=${unzip.exitCode}`);
  return unzip.stdout.toString();
};

const git=(cwd:string,...args:string[])=>{
  const run=Bun.spawnSync(['git','-C',cwd,...args],{stdout:'pipe',stderr:'pipe'});
  if(run.exitCode!==0)fail('independent_review_git_failed',`${args[0]} exit=${run.exitCode}`);
  return run.stdout.toString();
};

const env=(name:string,pattern:RegExp)=>{const value=process.env[name]??'';return pattern.test(value)?value:fail('independent_review_env_invalid',name);};

// A skipped required job counts as success on GitHub, so an unrequested or cross-repository review fails instead.
export const requested=(repository:string,headRepository:string,labelsJson:string):void=>{
  if(headRepository!==repository)fail('independent_review_cross_repository',headRepository.split('/')[0]!);
  let labels:unknown;
  try{labels=JSON.parse(labelsJson);}catch{return fail('independent_review_labels_unreadable',`bytes=${labelsJson.length}`);}
  if(!Array.isArray(labels)||!labels.includes(REQUEST_LABEL))fail('independent_review_not_requested',`label=${REQUEST_LABEL}`);
};

// Structural invariants of the workflow; tests run them on the committed file and on injected faults.
export const checkWorkflow=(doc:unknown):void=>{
  const root=record(doc)??fail('independent_review_workflow_shape','root');
  const on=record(root.on)??fail('independent_review_workflow_shape','on');
  if(!sameKeys(on,['pull_request_target']))fail('independent_review_workflow_trigger',Object.keys(on).join());
  const permissions=record(root.permissions)??fail('independent_review_workflow_shape','permissions');
  if(!sameKeys(permissions,['actions','contents'])||permissions.actions!=='read'||permissions.contents!=='read')fail('independent_review_workflow_permissions','not read-only');
  const jobs=record(root.jobs)??fail('independent_review_workflow_shape','jobs');
  const job=record(jobs.review)??fail('independent_review_workflow_shape','jobs.review');
  if(!sameKeys(jobs,['review'])||job.name!==REVIEW_CHECK_NAME)fail('independent_review_workflow_job','name');
  if('if' in job||'continue-on-error' in job)fail('independent_review_workflow_skippable','job condition');
  const steps=Array.isArray(job.steps)?job.steps.map(s=>record(s)??fail('independent_review_workflow_shape','step')):fail('independent_review_workflow_shape','steps');
  if(steps[3]?.run!==RUN_PREFIX+'request'||steps.some(s=>'continue-on-error' in s))fail('independent_review_workflow_request','request gate');
  let checkouts=0,codex=0;
  for(const step of steps){
    const uses=typeof step.uses==='string'?step.uses:undefined,with_=record(step.with)??{};
    if(uses&&!/@[0-9a-f]{40}$/.test(uses))fail('independent_review_workflow_unpinned',uses.split('@')[0]!);
    if(typeof step.run==='string'&&!step.run.startsWith(RUN_PREFIX))fail('independent_review_workflow_untrusted_run',String(step.name));
    if(uses?.startsWith('actions/checkout@')){
      checkouts++;
      if(with_['persist-credentials']!==false)fail('independent_review_workflow_credentials',String(with_.path));
      const expected=with_.path==='trusted'?'${{ github.event.pull_request.base.sha }}':with_.path==='subject'?'${{ github.event.pull_request.head.sha }}':undefined;
      if(!expected||with_.ref!==expected)fail('independent_review_workflow_checkout',String(with_.path));
    }
    if(uses?.startsWith('openai/codex-action@')){
      codex++;
      const args=typeof with_['codex-args']==='string'?with_['codex-args']:'';
      if(with_.model!==REVIEW_MODEL||with_['permission-profile']!==':read-only'||with_['output-schema-file']!=='trusted/ci/independent-review/schema.json'||!args.includes('project_doc_max_bytes=0'))
        fail('independent_review_workflow_codex','model/profile/schema/instructions');
    }
  }
  if(checkouts!==2||codex!==1)fail('independent_review_workflow_steps',`checkouts=${checkouts} codex=${codex}`);
};

const prior=async(outDir:string)=>{
  const repository=env('GITHUB_REPOSITORY',/^[\w.-]+\/[\w.-]+$/),head=env('HEAD_SHA',SHA),token=env('GITHUB_TOKEN',/./);
  mkdirSync(outDir,{recursive:true});
  const artifact=await priorVerdict(repository,head,token);
  if(artifact)writeFileSync(resolve(outDir,'verdict.json'),await download(artifact,token,resolve(outDir,'prior.zip')));
  appendFileSync(env('GITHUB_OUTPUT',/./),`found=${artifact?'true':'false'}\n`);
  console.log(JSON.stringify({prior:artifact?{artifact:artifact.id,run:artifact.workflow_run?.id}:null}));
};

const prepare=(subject:string,outDir:string)=>{
  const values={REPOSITORY:env('GITHUB_REPOSITORY',/^[\w.-]+\/[\w.-]+$/),PR_NUMBER:env('PR_NUMBER',/^\d+$/),BASE_SHA:env('BASE_SHA',SHA),HEAD_SHA:env('HEAD_SHA',SHA)};
  if(git(subject,'rev-parse','HEAD').trim()!==values.HEAD_SHA)fail('independent_review_head_mismatch','subject checkout');
  const mergeBase=git(subject,'merge-base',values.BASE_SHA,values.HEAD_SHA).trim();
  mkdirSync(outDir,{recursive:true});
  const diffPath=resolve(outDir,'diff.patch');
  writeFileSync(diffPath,git(subject,'diff','-M','--no-color',mergeBase,values.HEAD_SHA));
  const template=readFileSync(resolve(import.meta.dir,'../ci/independent-review/prompt.md'),'utf8');
  writeFileSync(resolve(outDir,'prompt.md'),renderPrompt(template,{...values,MERGE_BASE:mergeBase,DIFF_PATH:diffPath,DIFF_STAT:git(subject,'diff','-M','--shortstat',mergeBase,values.HEAD_SHA).trim()}));
};

const report=(path:string)=>{
  const verdict=parseVerdict(readFileSync(path,'utf8')),result=judge(verdict);
  const cell=(s:string)=>s.replace(/\|/g,'\\|').replace(/\n/g,' ');
  const summary=[`## ${REVIEW_CHECK_NAME}: ${result.pass?'PASS':'CHANGES REQUIRED'}`,'','| severity | location | summary |','|---|---|---|',...verdict.findings.map(f=>`| ${f.severity} | ${cell(f.file)}:${f.line} | ${cell(f.summary)} |`)].join('\n');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
  console.log(JSON.stringify({status:result.pass?'pass':'changes_required',findings:verdict.findings.length,blocking:result.blocking}));
  if(!result.pass)fail('independent_review_changes_required',`findings=${verdict.findings.length} blocking=${result.blocking}`);
};

if(import.meta.main){
  const [mode,...args]=Bun.argv.slice(2);
  try{
    if(mode==='request'&&args.length===0)requested(env('GITHUB_REPOSITORY',/^[\w.-]+\/[\w.-]+$/),process.env.HEAD_REPOSITORY??'',process.env.PR_LABELS??'');
    else if(mode==='prior'&&args.length===1)await prior(args[0]!);
    else if(mode==='prepare'&&args.length===2)prepare(args[0]!,args[1]!);
    else if(mode==='judge'&&args.length===1)report(args[0]!);
    else fail('independent_review_usage',String(mode));
  }catch(error){
    if(error instanceof ReviewError){console.error(error.message);process.exit(1);}
    throw error;
  }
}
