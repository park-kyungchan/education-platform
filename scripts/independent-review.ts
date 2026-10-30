// Independent exact-head review for pull requests, run by .github/workflows/independent-review.yml.
// The workflow runs on pull_request_target from the default branch, so this file and the prompt are trusted; the PR
// head is only read. The verdict is a commit status on the exact head, posted by the review GitHub App; the ruleset pins
// that app as the context's only accepted source (integration_id), so a same-named check from any other workflow or fork
// job never satisfies it. Statuses cannot be deleted, so the first status for a head is final: no re-run, re-label or
// concurrent request samples the model again.
import {mkdirSync,readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

export const REVIEW_CONTEXT='Independent exact-head review'; // the required status context on main
export const RUNNER_JOB_NAME='Independent review runner'; // its own check lands on the default-branch commit
export const REVIEW_APP_SLUG='education-platform-review'; // the GitHub App pinned as integration_id on main
export const STATUS_CREATOR=`${REVIEW_APP_SLUG}[bot]`;
export const REVIEW_MODEL='gpt-6.1-sol';
// true: the finding blocks the merge. Only a defect reachable under the trusted deployment assumptions blocks; a
// medium finding (unusual configuration or limited reach) is reported for the owner but does not hold the merge.
export const SEVERITY={high:true,medium:false,low:false} as const;
export const VERDICTS=['pass','changes_required'] as const;
export const FINDING_FIELDS=['evidence','file','line','severity','summary'] as const;
export const TEMPLATE_KEYS=['REPOSITORY','PR_NUMBER','BASE_SHA','HEAD_SHA','MERGE_BASE','DIFF_PATH','DIFF_STAT','ASSUMPTIONS','REVIEW_SCOPE'] as const;
export const RUN_PREFIX='bun trusted/scripts/independent-review.ts ';
export const REQUEST_LABEL='full-review';
// What the latest status of the context means for a new run: a terminal verdict is kept; a pending one is a sample
// whose verdict was lost (cancelled or crashed run) and fails closed, so a new head is needed.
export const STATUS_STATES={pending:'lost',success:'recorded',failure:'recorded',error:'recorded'} as const;
export type Severity=keyof typeof SEVERITY;
export type StatusState=keyof typeof STATUS_STATES;
export interface Finding {file:string;line:number;severity:Severity;summary:string;evidence:string}
export interface Verdict {verdict:typeof VERDICTS[number];findings:Finding[]}
export interface Status {id:number;state:StatusState;context:string;target_url:string|null;created_at:string;creator:{login:string}|null}
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

// A skipped job never reports the context, and an unrequested, cross-repository or non-default-branch PR fails here.
export const requested=(repository:string,headRepository:string,labelsJson:string,baseRef:string,defaultBranch:string):void=>{
  if(headRepository!==repository)fail('independent_review_cross_repository',headRepository.split('/')[0]!);
  if(!defaultBranch||baseRef!==defaultBranch)fail('independent_review_base_not_default',`base=${baseRef}`);
  let labels:unknown;
  try{labels=JSON.parse(labelsJson);}catch{return fail('independent_review_labels_unreadable',`bytes=${labelsJson.length}`);}
  if(!Array.isArray(labels)||!labels.includes(REQUEST_LABEL))fail('independent_review_not_requested',`label=${REQUEST_LABEL}`);
};

// GitHub REST access with the job token; every non-2xx answer fails closed at the calling site.
export type Api=(method:'GET'|'POST',path:string,body?:unknown)=>Promise<unknown>;
export const githubApi=(repository:string,token:string,fetchImpl:typeof fetch=fetch):Api=>async(method,path,body)=>{
  const response=await fetchImpl(`https://api.github.com/repos/${repository}/${path}`,{method,headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response.ok)fail('independent_review_api_failed',`${method} status=${response.status}`);
  return await response.json() as unknown;
};

// Plain-text GitHub REST reads (job logs answer with a redirect to text).
export type TextApi=(path:string)=>Promise<string>;
export const githubText=(repository:string,token:string,fetchImpl:typeof fetch=fetch):TextApi=>async path=>{
  const response=await fetchImpl(`https://api.github.com/repos/${repository}/${path}`,{headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}});
  if(!response.ok)fail('independent_review_api_failed',`GET status=${response.status}`);
  return await response.text();
};

// Statuses of the review context on one head, newest first. A status from any other creator fails closed.
export const contextStatuses=async(api:Api,head:string):Promise<Status[]>=>{
  const body=await api('GET',`commits/${head}/statuses?per_page=100`);
  if(!Array.isArray(body))return fail('independent_review_statuses_unreadable','not a list');
  if(body.length>=100)fail('independent_review_statuses_paged',`count=${body.length}`);
  const own=body.map(s=>record(s)??{}).filter(s=>s.context===REVIEW_CONTEXT).map(s=>{
    const state=(Object.keys(STATUS_STATES) as StatusState[]).find(k=>k===s.state)??fail('independent_review_status_unknown',String(s.state));
    if(record(s.creator)?.login!==STATUS_CREATOR)fail('independent_review_status_foreign',`status=${String(s.id)}`);
    return {...s,state} as Status;
  });
  return own.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
};

// First run for a head: sample. Terminal status: keep it. Pending only: the sample was taken and its verdict lost.
export const decide=(statuses:readonly Status[]):{sample:true}|{sample:false;state:StatusState}=>{
  const latest=statuses[0];
  if(!latest)return {sample:true};
  if(STATUS_STATES[latest.state]==='lost')fail('independent_review_sample_lost',`status=${latest.id}`);
  return {sample:false,state:latest.state};
};

export const postStatus=(api:Api,head:string,state:StatusState,description:string,targetUrl:string)=>
  api('POST',`statuses/${head}`,{state,context:REVIEW_CONTEXT,description:description.slice(0,140),target_url:targetUrl});

// Claim: post the pending status that marks this head as sampled, before any model call.
export const claim=async(api:Api,head:string,runUrl:string):Promise<boolean>=>{
  const decision=decide(await contextStatuses(api,head));
  if(decision.sample)await postStatus(api,head,'pending','Model review running',runUrl);
  else console.log(JSON.stringify({recorded:decision.state}));
  return decision.sample;
};

// Record: only the run that claimed the head (its pending status is still the latest) posts the final verdict.
// A missing or invalid verdict, or a Review step that did not succeed, is recorded as failure, so the head never gets a
// second sample. A cancelled run never reaches this step (the workflow guards it with !cancelled()), so its pending
// status stays and fails closed.
export const recordVerdict=async(api:Api,head:string,runUrl:string,reviewOutcome:string,verdictText:string|undefined)=>{
  const latest=(await contextStatuses(api,head))[0];
  if(latest?.state!=='pending'||latest.target_url!==runUrl)fail('independent_review_claim_missing',`latest=${String(latest?.id)}`);
  let result:{pass:boolean;blocking:number;findings:Finding[]};
  try{
    if(reviewOutcome!=='success')fail('independent_review_step_not_success',`outcome=${reviewOutcome.slice(0,20)}`);
    if(verdictText===undefined)fail('independent_review_verdict_missing','no verdict file');
    const verdict=parseVerdict(verdictText!);
    result={...judge(verdict),findings:verdict.findings};
  }catch(error){
    await postStatus(api,head,'failure',`No valid verdict: ${String((error as Error).message).split(' ')[0]}`,runUrl);
    throw error;
  }
  await postStatus(api,head,result.pass?'success':'failure',result.pass?`pass, ${result.findings.length} low findings`:`changes required, ${result.blocking} blocking`,runUrl);
  return result;
};

// Convergence: after the first reviewed head of a pull request, a new head is reviewed against the previous one. Every
// full re-review sampled new paths through unchanged code and never converged (P6 failure ledger #9, PR #53).
// The previous reviewed head is the newest earlier commit of the PR carrying a recorded verdict of this context from
// the review app; its findings are read back from the trusted record step of that run's job log.
export const priorReviewedHead=async(api:Api,pr:string,head:string):Promise<{sha:string;state:StatusState;runUrl:string}[]>=>{
  const body=await api('GET',`pulls/${pr}/commits?per_page=100`);
  if(!Array.isArray(body))return fail('independent_review_commits_unreadable','not a list');
  // A pull request of 100 or more commits is not paged through: it simply gets full reviews.
  if(body.length>=100)return [];
  const shas=body.map(c=>String(record(c)?.sha??''));
  const at=shas.indexOf(head);
  if(at<0)fail('independent_review_head_not_in_pull_request','head');
  // Newest first: every earlier PR commit with a recorded verdict of this context from the review app.
  const heads:{sha:string;state:StatusState;runUrl:string}[]=[];
  for(let i=at-1;i>=0;i--){
    const latest=(await contextStatuses(api,shas[i]!))[0];
    if(latest&&STATUS_STATES[latest.state]==='recorded'&&latest.target_url)heads.push({sha:shas[i]!,state:latest.state,runUrl:latest.target_url});
  }
  return heads;
};
const RECORD_MARKER=`##[group]Run ${RUN_PREFIX}record`;
// Only the record step, the last step of the job, prints these lines (verdictLogLines). Parsing starts at the LAST record
// marker, so model output earlier in the job cannot stand in for it. A head is a valid baseline only if the totals equal
// the parsed findings: a failed or invalid review prints no totals, and a marker forged inside a finding's text (which the
// runner may render as its own line) leaves fewer parsed findings than the totals. Quotes inside a finding are escaped,
// so its text can never produce a parsable finding or totals line. Every mismatch means a full review.
export const loggedFindings=(log:string):Finding[]|null=>{
  const start=log.lastIndexOf(RECORD_MARKER);
  if(start<0)return null;
  const findings:Finding[]=[];let totals:{findings:number}|null=null;
  for(const line of log.slice(start).split('\n')){
    const at=line.indexOf('{"finding":'),total=line.indexOf('{"status":');
    if(at>=0)findings.push(...parseVerdict(JSON.stringify({verdict:'changes_required',findings:[JSON.parse(line.slice(at)).finding]})).findings);
    else if(total>=0){const t=record(JSON.parse(line.slice(total)));if(t&&typeof t.findings==='number')totals={findings:t.findings};}
  }
  return totals&&totals.findings===findings.length?findings:null;
};
// Findings of one earlier run, or null when that run is unfinished, its log is unavailable or it has no valid verdict.
export const priorFindings=async(api:Api,text:TextApi,runUrl:string):Promise<Finding[]|null>=>{
  const match=/\/actions\/runs\/(\d+)\/attempts\/(\d+)$/.exec(runUrl);
  if(!match)return null;
  const jobs=record(await api('GET',`actions/runs/${match[1]}/attempts/${match[2]}/jobs?per_page=100`))?.jobs;
  const job=Array.isArray(jobs)?jobs.map(j=>record(j)).find(j=>j?.name===RUNNER_JOB_NAME):undefined;
  if(!job||typeof job.id!=='number'||job.status!=='completed')return null;
  // Any unreadable or unparsable earlier log falls back to a full review; it never fails this head.
  try{return loggedFindings(await text(`actions/jobs/${job.id}/logs`));}catch{return null;}
};
// The newest earlier head with a valid verdict is the baseline. Discovery only ever narrows a review: any failure to
// find or read one (deleted runs, API errors, foreign statuses, history rewrites) keeps the review full, because the
// head is already claimed and a failed preparation could never be sampled again.
export const reviewBaseline=async(api:Api,text:TextApi,pr:string,head:string,isAncestor:(sha:string)=>boolean)=>{
  try{
    for(const candidate of await priorReviewedHead(api,pr,head)){
      if(!isAncestor(candidate.sha))return null;
      const findings=await priorFindings(api,text,candidate.runUrl);
      if(findings)return {...candidate,findings};
    }
  }catch{return null;}
  return null;
};
export const renderScope=(prior:{sha:string;state:StatusState;findings:readonly Finding[];deltaPath:string;deltaStat:string}|null):string=>{
  if(!prior)return 'Full review: this is the first reviewed head of the pull request. Review the whole diff.';
  const listed=prior.findings.length?prior.findings.map(f=>`- [${f.severity}] ${f.file}:${f.line} ${f.summary}`).join('\n'):'- (none)';
  return [`Incremental review. The previous reviewed head ${prior.sha} was recorded as ${prior.state} with these findings:`,listed,
    `The change since that head is \`${prior.deltaPath}\` (${prior.deltaStat}). The full diff stays available for context.`,
    'Tasks: (1) for each previous high or medium finding, decide whether this head fixes it; report an unfixed one again with its severity.',
    '(2) Review the delta and the code it changes or newly reaches, including whether a fix introduced a regression.',
    '(3) Do not report code that is unchanged since the previous reviewed head unless the delta changes its behavior or a previous finding names it.'].join('\n');
};
const git=(cwd:string,...args:string[])=>{
  const run=Bun.spawnSync(['git','-C',cwd,...args],{stdout:'pipe',stderr:'pipe'});
  if(run.exitCode!==0)fail('independent_review_git_failed',`${args[0]} exit=${run.exitCode}`);
  return run.stdout.toString();
};

const env=(name:string,pattern:RegExp)=>{const value=process.env[name]??'';return pattern.test(value)?value:fail('independent_review_env_invalid',name);};
const repository=()=>env('GITHUB_REPOSITORY',/^[\w.-]+\/[\w.-]+$/);
const runUrl=()=>`${env('GITHUB_SERVER_URL',/^https:\/\//)}/${repository()}/actions/runs/${env('GITHUB_RUN_ID',/^\d+$/)}/attempts/${env('GITHUB_RUN_ATTEMPT',/^\d+$/)}`;
const jobApi=()=>githubApi(repository(),env('GITHUB_TOKEN',/./));

// The workflow must equal this table exactly (parsed YAML, every key and value). A property-by-property check let an
// unlisted change through (FULL2: `if: false` on every step after the request gate skipped the model and the judge);
// exact equality closes that class, and the tests derive one injected fault from every leaf of this table.
const SAMPLE="${{ steps.claim.outputs.sample == 'true' }}";
const APP_TOKEN='${{ steps.app.outputs.token }}';
const CHECKOUT='actions/checkout@11d5960a326750d5838078e36cf38b85af677262';
export const EXPECTED_WORKFLOW={
  name:'Independent review',
  on:{pull_request_target:{types:['opened','labeled','synchronize','reopened']}},
  // Read-only job token: the prepare step reads PR commits, earlier review statuses and the earlier record log.
  permissions:{contents:'read',statuses:'read',actions:'read','pull-requests':'read'},
  concurrency:{group:'independent-review-${{ github.event.pull_request.head.sha }}','cancel-in-progress':false},
  jobs:{review:{
    name:RUNNER_JOB_NAME,
    'runs-on':'ubuntu-latest',
    'timeout-minutes':60,
    env:{
      PR_NUMBER:'${{ github.event.pull_request.number }}',
      BASE_SHA:'${{ github.event.pull_request.base.sha }}',
      BASE_REF:'${{ github.event.pull_request.base.ref }}',
      DEFAULT_BRANCH:'${{ github.event.repository.default_branch }}',
      HEAD_SHA:'${{ github.event.pull_request.head.sha }}',
      HEAD_REPOSITORY:'${{ github.event.pull_request.head.repo.full_name }}',
      PR_LABELS:'${{ toJSON(github.event.pull_request.labels.*.name) }}',
    },
    steps:[
      {name:'Check out trusted default branch',uses:CHECKOUT,with:{ref:'${{ github.sha }}',path:'trusted','persist-credentials':false}},
      {name:'Check out exact head as data',uses:CHECKOUT,with:{ref:'${{ github.event.pull_request.head.sha }}',path:'subject','fetch-depth':0,'persist-credentials':false}},
      {uses:'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6',with:{'bun-version':'1.4.2'}},
      {name:'Require a same-repository head, the default base and the full-review label',run:RUN_PREFIX+'request'},
      {name:'Mint the review app token',id:'app',uses:'actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510',with:{
        'client-id':'${{ vars.REVIEW_APP_CLIENT_ID }}',
        'private-key':'${{ secrets.REVIEW_APP_PRIVATE_KEY }}',
        'permission-statuses':'write',
      }},
      {name:'Claim the one review of this head',id:'claim',run:RUN_PREFIX+'claim',env:{GITHUB_TOKEN:APP_TOKEN}},
      {name:'Build review input',if:SAMPLE,run:RUN_PREFIX+'prepare subject review-input',env:{GITHUB_TOKEN:'${{ github.token }}'}},
      {name:'Review',id:'review',if:SAMPLE,uses:'openai/codex-action@bdf19a4a223ec2549a3e2274a0cf61556bc07675',with:{
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
      {name:'Record the verdict on the head',if:"${{ !cancelled() && steps.claim.outputs.sample == 'true' }}",run:RUN_PREFIX+'record review-input/verdict.json',env:{
        GITHUB_TOKEN:APP_TOKEN,
        REVIEW_OUTCOME:'${{ steps.review.outcome }}',
      }},
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

const prepare=async(subject:string,outDir:string)=>{
  const values={REPOSITORY:repository(),PR_NUMBER:env('PR_NUMBER',/^\d+$/),BASE_SHA:env('BASE_SHA',SHA),HEAD_SHA:env('HEAD_SHA',SHA)};
  if(git(subject,'rev-parse','HEAD').trim()!==values.HEAD_SHA)fail('independent_review_head_mismatch','subject checkout');
  const mergeBase=git(subject,'merge-base',values.BASE_SHA,values.HEAD_SHA).trim();
  mkdirSync(outDir,{recursive:true});
  const diffPath=resolve(outDir,'diff.patch');
  writeFileSync(diffPath,git(subject,'diff','-M','-D','--no-color',mergeBase,values.HEAD_SHA));
  const token=env('GITHUB_TOKEN',/./),api=githubApi(repository(),token);
  // A rewritten history (the baseline is not an ancestor) or no valid baseline gets a full review again.
  const isAncestor=(sha:string)=>Bun.spawnSync(['git','-C',subject,'merge-base','--is-ancestor',sha,values.HEAD_SHA]).exitCode===0;
  const baseline=await reviewBaseline(api,githubText(repository(),token),values.PR_NUMBER,values.HEAD_SHA,isAncestor);
  let scope=renderScope(null);
  if(baseline){
    const deltaPath=resolve(outDir,'delta.patch');
    writeFileSync(deltaPath,git(subject,'diff','-M','-D','--no-color',baseline.sha,values.HEAD_SHA));
    scope=renderScope({...baseline,deltaPath,deltaStat:git(subject,'diff','-M','--shortstat',baseline.sha,values.HEAD_SHA).trim()});
  }
  const template=readFileSync(resolve(import.meta.dir,'../ci/independent-review/prompt.md'),'utf8');
  const assumptions=readFileSync(resolve(import.meta.dir,'../ci/independent-review/assumptions.md'),'utf8').trim();
  writeFileSync(resolve(outDir,'prompt.md'),renderPrompt(template,{...values,MERGE_BASE:mergeBase,DIFF_PATH:diffPath,
    DIFF_STAT:git(subject,'diff','-M','--shortstat',mergeBase,values.HEAD_SHA).trim(),ASSUMPTIONS:assumptions,REVIEW_SCOPE:scope}));
};

// The job log carries every finding, one JSON line each, then the totals: the step summary is not readable through the
// REST API, so an owner fixing a failed head must be able to read the findings from the log.
export const verdictLogLines=(result:{pass:boolean;blocking:number;findings:readonly Finding[]}):string[]=>[
  ...result.findings.map(finding=>JSON.stringify({finding})),
  JSON.stringify({status:result.pass?'pass':'changes_required',findings:result.findings.length,blocking:result.blocking}),
];

const record_=async(path:string)=>{
  const result=await recordVerdict(jobApi(),env('HEAD_SHA',SHA),runUrl(),process.env.REVIEW_OUTCOME??'',existsSync(path)?readFileSync(path,'utf8'):undefined);
  const cell=(s:string)=>s.replace(/\|/g,'\\|').replace(/\n/g,' ');
  const summary=[`## ${REVIEW_CONTEXT}: ${result.pass?'PASS':'CHANGES REQUIRED'}`,'','| severity | location | summary |','|---|---|---|',...result.findings.map(f=>`| ${f.severity} | ${cell(f.file)}:${f.line} | ${cell(f.summary)} |`)].join('\n');
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
  for(const line of verdictLogLines(result))console.log(line);
  if(!result.pass)fail('independent_review_changes_required',`findings=${result.findings.length} blocking=${result.blocking}`);
};

if(import.meta.main){
  const [mode,...args]=Bun.argv.slice(2);
  try{
    if(mode==='request'&&args.length===0)requested(repository(),process.env.HEAD_REPOSITORY??'',process.env.PR_LABELS??'',process.env.BASE_REF??'',process.env.DEFAULT_BRANCH??'');
    else if(mode==='claim'&&args.length===0){const sample=await claim(jobApi(),env('HEAD_SHA',SHA),runUrl());appendFileSync(env('GITHUB_OUTPUT',/./),`sample=${sample}\n`);}
    else if(mode==='prepare'&&args.length===2)await prepare(args[0]!,args[1]!);
    else if(mode==='record'&&args.length===1)await record_(args[0]!);
    else fail('independent_review_usage',String(mode));
  }catch(error){
    if(error instanceof ReviewError){console.error(error.message);process.exit(1);}
    throw error;
  }
}
