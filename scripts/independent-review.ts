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

// The first verdict for a head is final. Only artifacts uploaded by a pull_request_target run of this workflow count:
// any other producer of the reserved name (another workflow, or a PR-defined pull_request run) fails closed, and so
// does an expired verdict, so neither can open a fresh sample.
export const WORKFLOW_PATH='.github/workflows/independent-review.yml';
export const priorVerdict=async(repository:string,head:string,token:string,fetchImpl:typeof fetch=fetch):Promise<Artifact|undefined>=>{
  const get=async(path:string)=>{
    const response=await fetchImpl(`https://api.github.com/repos/${repository}/${path}`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}});
    if(!response.ok)fail('independent_review_artifacts_unreadable',`status=${response.status}`);
    return await response.json() as unknown;
  };
  const name=ARTIFACT_PREFIX+head;
  const body=await get(`actions/artifacts?name=${name}&per_page=100`) as {total_count:number;artifacts:Artifact[]};
  if(body.total_count>body.artifacts.length)fail('independent_review_artifacts_paged',`total=${body.total_count}`);
  const own=body.artifacts.filter(a=>a.name===name);
  for(const artifact of own){
    const id=artifact.workflow_run?.id;
    const run=record(typeof id==='number'?await get(`actions/runs/${id}`):undefined);
    if(run?.event!=='pull_request_target'||String(run.path).split('@')[0]!==WORKFLOW_PATH)fail('independent_review_artifact_untrusted',`artifact=${artifact.id}`);
  }
  const live=own.filter(a=>!a.expired).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id-b.id);
  if(own.length&&!live.length)fail('independent_review_verdict_expired',`count=${own.length}`);
  return live[0];
};

// Without a verdict artifact, GitHub's check-run history still shows whether a model sample was taken for this head
// (artifact expired or removed). Any other run or attempt of this job whose Review step started (any conclusion but
// skipped, cancelled included) blocks a fresh sample.
export const REVIEW_STEP='Review';
export const priorSampleTaken=async(repository:string,head:string,current:{run:number;attempt:number},token:string,fetchImpl:typeof fetch=fetch):Promise<boolean>=>{
  const get=async(path:string)=>{
    const response=await fetchImpl(`https://api.github.com/repos/${repository}/${path}`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}});
    if(!response.ok)fail('independent_review_history_unreadable',`status=${response.status}`);
    return await response.json() as unknown;
  };
  const body=record(await get(`commits/${head}/check-runs?check_name=${encodeURIComponent(REVIEW_CHECK_NAME)}&filter=all&per_page=100`));
  const runs=Array.isArray(body?.check_runs)?body.check_runs.map(r=>record(r)??{}):fail('independent_review_history_unreadable','check_runs');
  if(Number(body?.total_count)>runs.length)fail('independent_review_history_paged',`total=${String(body?.total_count)}`);
  for(const check of runs){
    const job=record(await get(`actions/jobs/${String(check.id)}`));
    if(job?.run_id===current.run&&job?.run_attempt===current.attempt)continue;
    const steps=Array.isArray(job?.steps)?job.steps.map(x=>record(x)??{}):[];
    if(steps.some(step=>step.name===REVIEW_STEP&&step.status!=='queued'&&step.status!=='pending'&&step.conclusion!=='skipped'))return true;
  }
  return false;
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

// The workflow must equal this table exactly (parsed YAML, every key and value). A property-by-property check let an
// unlisted change through (FULL2: `if: false` on every step after the request gate skipped the model and the judge);
// exact equality closes that class, and the tests derive one injected fault from every leaf of this table.
const FOUND_FALSE="${{ steps.prior.outputs.found == 'false' }}";
const CHECKOUT='actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
export const EXPECTED_WORKFLOW={
  name:'Independent review',
  on:{pull_request_target:{types:['opened','labeled','synchronize','reopened']}},
  permissions:{contents:'read',actions:'read',checks:'read'},
  concurrency:{group:'independent-review-${{ github.event.pull_request.head.sha }}','cancel-in-progress':false},
  jobs:{review:{
    name:REVIEW_CHECK_NAME,
    'runs-on':'ubuntu-latest',
    'timeout-minutes':60,
    env:{
      PR_NUMBER:'${{ github.event.pull_request.number }}',
      BASE_SHA:'${{ github.event.pull_request.base.sha }}',
      HEAD_SHA:'${{ github.event.pull_request.head.sha }}',
      HEAD_REPOSITORY:'${{ github.event.pull_request.head.repo.full_name }}',
      PR_LABELS:'${{ toJSON(github.event.pull_request.labels.*.name) }}',
    },
    steps:[
      {name:'Check out trusted base',uses:CHECKOUT,with:{ref:'${{ github.event.pull_request.base.sha }}',path:'trusted','persist-credentials':false}},
      {name:'Check out exact head as data',uses:CHECKOUT,with:{ref:'${{ github.event.pull_request.head.sha }}',path:'subject','fetch-depth':0,'persist-credentials':false}},
      {uses:'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6',with:{'bun-version':'1.4.2'}},
      {name:'Require a same-repository head and the full-review label',run:RUN_PREFIX+'request'},
      {name:'Reuse the first verdict for this head',id:'prior',run:RUN_PREFIX+'prior review-input',env:{GITHUB_TOKEN:'${{ github.token }}'}},
      {name:'Build review input',if:FOUND_FALSE,run:RUN_PREFIX+'prepare subject review-input'},
      {name:'Review',if:FOUND_FALSE,uses:'openai/codex-action@bdf19a4a223ec2549a3e2274a0cf61556bc07675',with:{
        'openai-api-key':'${{ secrets.OPENAI_API_KEY }}',
        'prompt-file':'review-input/prompt.md',
        'working-directory':'${{ github.workspace }}/subject',
        model:REVIEW_MODEL,
        effort:'high',
        'permission-profile':':read-only',
        'output-schema-file':'trusted/ci/independent-review/schema.json',
        'output-file':'review-input/verdict.json',
        'codex-args':'["-c", "project_doc_max_bytes=0"]',
      }},
      {name:'Keep the verdict for this head',if:FOUND_FALSE,uses:'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02',with:{
        name:ARTIFACT_PREFIX+'${{ github.event.pull_request.head.sha }}',
        path:'review-input/verdict.json',
        'if-no-files-found':'error',
        'retention-days':90,
      }},
      {name:'Judge',run:RUN_PREFIX+'judge review-input/verdict.json'},
    ],
  }},
} as const;

// First path where two parsed values differ (keys compared as sets, arrays by length and position).
export const firstDifference=(actual:unknown,expected:unknown,path='$'):string|undefined=>{
  if(Array.isArray(expected)){
    if(!Array.isArray(actual)||actual.length!==expected.length)return path;
    for(let i=0;i<expected.length;i++){const d=firstDifference(actual[i],expected[i],`${path}[${i}]`);if(d)return d;}
    return undefined;
  }
  const want=record(expected);
  if(want){
    const have=record(actual);
    if(!have||!sameKeys(have,Object.keys(want)))return path;
    for(const key of Object.keys(want)){const d=firstDifference(have[key],want[key],`${path}.${key}`);if(d)return d;}
    return undefined;
  }
  return actual===expected?undefined:path;
};

export const checkWorkflow=(doc:unknown):void=>{
  const difference=firstDifference(doc,EXPECTED_WORKFLOW);
  if(difference)fail('independent_review_workflow_drift',difference);
};

const prior=async(outDir:string)=>{
  const repository=env('GITHUB_REPOSITORY',/^[\w.-]+\/[\w.-]+$/),head=env('HEAD_SHA',SHA),token=env('GITHUB_TOKEN',/./);
  mkdirSync(outDir,{recursive:true});
  const artifact=await priorVerdict(repository,head,token);
  if(!artifact&&await priorSampleTaken(repository,head,{run:Number(env('GITHUB_RUN_ID',/^\d+$/)),attempt:Number(env('GITHUB_RUN_ATTEMPT',/^\d+$/))},token))fail('independent_review_prior_sample_unrecoverable','verdict artifact missing');
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
