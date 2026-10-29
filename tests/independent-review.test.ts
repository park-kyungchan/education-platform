import {describe,expect,test} from 'bun:test';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {REVIEW_STEP,EXPECTED_WORKFLOW,RUN_PREFIX,priorSampleTaken,ARTIFACT_PREFIX,WORKFLOW_PATH,REQUEST_LABEL,requested,FINDING_FIELDS,REVIEW_CHECK_NAME,SEVERITY,TEMPLATE_KEYS,VERDICTS,checkWorkflow,judge,parseVerdict,priorVerdict,renderPrompt,type Artifact,type Severity} from '../scripts/independent-review';

const root=resolve(import.meta.dir,'..');
const schema=JSON.parse(readFileSync(resolve(root,'ci/independent-review/schema.json'),'utf8'));
const template=readFileSync(resolve(root,'ci/independent-review/prompt.md'),'utf8');
const workflowText=readFileSync(resolve(root,'.github/workflows/independent-review.yml'),'utf8');
const workflow=()=>Bun.YAML.parse(workflowText) as any;
const severities=Object.keys(SEVERITY) as Severity[];
const finding=(severity:Severity)=>({file:'a.ts',line:1,severity,summary:'s',evidence:'e'});
const head='a'.repeat(40);

describe('contract parity (enumerated from the schema and the exports)',()=>{
  test('schema enums and required fields equal the exported tables',()=>{
    expect(schema.properties.verdict.enum).toEqual([...VERDICTS]);
    expect([...schema.properties.findings.items.properties.severity.enum].sort()).toEqual([...severities].sort());
    expect([...schema.properties.findings.items.required].sort()).toEqual([...FINDING_FIELDS].sort());
  });
  test('prompt placeholders equal TEMPLATE_KEYS, and drift either way fails',()=>{
    const values=Object.fromEntries(TEMPLATE_KEYS.map(k=>[k,`<${k}>`])) as Record<typeof TEMPLATE_KEYS[number],string>;
    expect(renderPrompt(template,values)).not.toContain('{{');
    expect(()=>renderPrompt(template+'{{EXTRA}}',values)).toThrow('independent_review_template_unknown_key');
    expect(()=>renderPrompt(template.replaceAll('{{DIFF_PATH}}','x'),values)).toThrow('independent_review_template_missing_key');
  });
});

describe('judge',()=>{
  test('blocking policy: high and medium block, low does not',()=>{expect(SEVERITY).toEqual({high:true,medium:true,low:false});});
  test.each(severities)('a pass verdict with one %s finding blocks exactly when the table says so',severity=>{
    const verdict={verdict:'pass' as const,findings:[finding(severity)]};
    if(SEVERITY[severity])expect(()=>judge(verdict)).toThrow('independent_review_verdict_contradiction');
    else expect(judge(verdict)).toEqual({pass:true,blocking:0});
  });
  test('clean pass passes; changes_required never passes',()=>{
    expect(judge({verdict:'pass',findings:[]}).pass).toBe(true);
    for(const severity of severities)expect(judge({verdict:'changes_required',findings:[finding(severity)]}).pass).toBe(false);
  });
  test('parseVerdict accepts the schema shape and rejects every deviation',()=>{
    expect(parseVerdict(JSON.stringify({verdict:'pass',findings:[finding('low')]})).findings).toHaveLength(1);
    const bad:[string,unknown][]=[
      ['independent_review_verdict_shape',{verdict:'pass',findings:[],extra:1}],
      ['independent_review_verdict_unknown',{verdict:'approve',findings:[]}],
      ['independent_review_finding_shape',{verdict:'pass',findings:[{...finding('low'),extra:1}]}],
      ['independent_review_finding_field',{verdict:'pass',findings:[{...finding('low'),severity:'critical'}]}],
      ['independent_review_finding_field',{verdict:'pass',findings:[{...finding('low'),line:1.5}]}],
    ];
    for(const [code,value] of bad)expect(()=>parseVerdict(JSON.stringify(value))).toThrow(code);
    expect(()=>parseVerdict('not json')).toThrow('independent_review_verdict_not_json');
  });
});

describe('one verdict per head',()=>{
  const artifact=(id:number,created:string,over:Partial<Artifact>={}):Artifact=>({id,name:ARTIFACT_PREFIX+head,expired:false,created_at:created,archive_download_url:'u',workflow_run:{id},...over});
  const trustedRun={event:'pull_request_target',path:WORKFLOW_PATH+'@refs/heads/main'};
  const reader=(artifacts:Artifact[],runs:Record<number,unknown>={},total=artifacts.length,status=200)=>(async(url:string|URL|Request)=>{
    const run=/actions\/runs\/(\d+)$/.exec(String(url));
    return new Response(JSON.stringify(run?runs[Number(run[1])]??trustedRun:{total_count:total,artifacts}),{status});
  }) as unknown as typeof fetch;
  test('no artifact means a first review; several trusted ones mean the earliest is final',async()=>{
    expect(await priorVerdict('o/r',head,'t',reader([]))).toBeUndefined();
    expect((await priorVerdict('o/r',head,'t',reader([artifact(2,'2026-10-29T02:00:00Z'),artifact(1,'2026-10-29T01:00:00Z')])))?.id).toBe(1);
  });
  test('an artifact from any other producer fails closed',async()=>{
    for(const run of [{event:'push',path:WORKFLOW_PATH},{event:'pull_request',path:WORKFLOW_PATH},{event:'pull_request_target',path:'.github/workflows/other.yml'},{}])
      await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x')],{1:run}))).rejects.toThrow('independent_review_artifact_untrusted');
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x',{workflow_run:null})]))).rejects.toThrow('independent_review_artifact_untrusted');
  });
  test('expired, paged or unreadable listings fail closed',async()=>{
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x',{expired:true})]))).rejects.toThrow('independent_review_verdict_expired');
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x')],{},101))).rejects.toThrow('independent_review_artifacts_paged');
    await expect(priorVerdict('o/r',head,'t',reader([],{},0,403))).rejects.toThrow('independent_review_artifacts_unreadable');
  });
});

describe('history without an artifact',()=>{
  const history=(jobs:Record<number,unknown>,total?:number)=>(async(url:string|URL|Request)=>{
    const job=/actions\/jobs\/(\d+)$/.exec(String(url));
    const ids=Object.keys(jobs).map(Number);
    return new Response(JSON.stringify(job?jobs[Number(job[1])]:{total_count:total??ids.length,check_runs:ids.map(id=>({id}))}),{status:200});
  }) as unknown as typeof fetch;
  const job=(run:number,attempt:number,status:string,conclusion:string|null)=>({run_id:run,run_attempt:attempt,steps:[{name:'Request',status:'completed',conclusion:'success'},{name:REVIEW_STEP,status,conclusion}]});
  const now={run:9,attempt:2};
  test('any other run or attempt whose review step started is a taken sample',async()=>{
    for(const [status,conclusion] of [['completed','success'],['completed','failure'],['completed','cancelled'],['in_progress',null]] as const){
      expect(await priorSampleTaken('o/r',head,now,'t',history({1:job(5,1,status,conclusion)}))).toBe(true);
      expect(await priorSampleTaken('o/r',head,now,'t',history({1:job(9,1,status,conclusion)}))).toBe(true);
    }
  });
  test('the current attempt and never-started review steps are not',async()=>{
    expect(await priorSampleTaken('o/r',head,now,'t',history({1:job(5,1,'completed','skipped'),2:job(6,1,'queued',null),3:job(9,2,'completed','success')}))).toBe(false);
    await expect(priorSampleTaken('o/r',head,now,'t',history({1:job(5,1,'completed','skipped')},101))).rejects.toThrow('independent_review_history_paged');
  });
  test('the workflow step that samples the model carries the name the history reads',()=>{
    expect(workflow().jobs.review.steps.filter((s:any)=>String(s.uses??'').startsWith('openai/codex-action@')).map((s:any)=>s.name)).toEqual([REVIEW_STEP]);
  });
});

describe('request gate',()=>{
  test('same repository with the label passes; anything else fails, never skips',()=>{
    expect(()=>requested('o/r','o/r',JSON.stringify(['x',REQUEST_LABEL]))).not.toThrow();
    expect(()=>requested('o/r','o/r',JSON.stringify(['x']))).toThrow('independent_review_not_requested');
    expect(()=>requested('o/r','fork/r',JSON.stringify([REQUEST_LABEL]))).toThrow('independent_review_cross_repository');
    expect(()=>requested('o/r','o/r','')).toThrow('independent_review_labels_unreadable');
  });
});

describe('workflow invariants',()=>{
  test('job names are literal, and no other workflow can report the required check name',()=>{
    const dir=resolve(root,'.github/workflows');
    const jobs=readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).flatMap(f=>Object.entries((Bun.YAML.parse(readFileSync(resolve(dir,f),'utf8')) as any).jobs??{}).map(([key,job]:[string,any])=>({file:f,name:String(job?.name??key)})));
    expect(jobs.filter(j=>j.name.includes('${{'))).toEqual([]);
    expect(jobs.filter(j=>j.name===REVIEW_CHECK_NAME).map(j=>j.file)).toEqual(['independent-review.yml']);
  });
  test('the committed workflow equals the table exactly',()=>{
    expect(()=>checkWorkflow(workflow())).not.toThrow();
    expect(workflow().jobs.review.name).toBe(REVIEW_CHECK_NAME);
  });
  test('FULL2 counterexample: skipping every step after the request gate fails',()=>{
    const doc=workflow();
    doc.jobs.review.steps.slice(4).forEach((s:any)=>{s.if=false;});
    expect(()=>checkWorkflow(doc)).toThrow('independent_review_workflow_drift');
  });
  // One fault per leaf, per key and per array, enumerated from the exported table.
  type Fault=[string,(doc:any)=>void];
  const faults:Fault[]=[];
  const at=(doc:any,path:(string|number)[])=>path.reduce((node,key)=>node[key],doc);
  const walk=(node:unknown,path:(string|number)[])=>{
    const where=path.join('.')||'$';
    if(Array.isArray(node)){
      faults.push([`${where} +item`,doc=>{at(doc,path).push({});}]);
      if(node.length)faults.push([`${where} -item`,doc=>{at(doc,path).pop();}]);
      node.forEach((item,i)=>walk(item,[...path,i]));
    }else if(node!==null&&typeof node==='object'){
      faults.push([`${where} +key`,doc=>{at(doc,path).injected=false;}]);
      for(const [key,value] of Object.entries(node)){
        faults.push([`${where}.${key} -key`,doc=>{delete at(doc,path)[key];}]);
        walk(value,[...path,key]);
      }
    }else{
      const other=typeof node==='string'?node+'x':typeof node==='number'?node+1:!node;
      faults.push([`${where} =changed`,doc=>{const parent=at(doc,path.slice(0,-1));parent[path.at(-1)!]=other;}]);
    }
  };
  walk(EXPECTED_WORKFLOW,[]);
  test('the enumeration reaches every step and field',()=>{expect(faults.length).toBeGreaterThan(100);});
  test.each(faults)('injected fault %s fails',(_,mutate)=>{
    const doc=workflow();mutate(doc);
    expect(()=>checkWorkflow(doc)).toThrow('independent_review_workflow_drift');
  });
  // What makes the table itself safe.
  const job=EXPECTED_WORKFLOW.jobs.review;
  const steps=job.steps as readonly Record<string,any>[];
  test('the job never skips, and only the sampling steps depend on the prior verdict',()=>{
    expect('if' in job||'continue-on-error' in job).toBe(false);
    expect(steps.filter(s=>'continue-on-error' in s)).toEqual([]);
    expect(steps.filter(s=>'if' in s).map(s=>s.name)).toEqual(['Build review input',REVIEW_STEP,'Keep the verdict for this head']);
    expect(new Set(steps.filter(s=>'if' in s).map(s=>s.if))).toEqual(new Set(["${{ steps.prior.outputs.found == 'false' }}"]));
    expect(steps[3]?.run).toBe(RUN_PREFIX+'request');
    expect(steps.at(-1)).toEqual({name:'Judge',run:RUN_PREFIX+'judge review-input/verdict.json'});
  });
  test('trusted code only, pinned actions, read-only token, uncredentialed checkouts',()=>{
    expect(Object.values(EXPECTED_WORKFLOW.permissions)).toEqual(['read','read','read']);
    expect(steps.filter(s=>'run' in s&&!String(s.run).startsWith(RUN_PREFIX))).toEqual([]);
    expect(steps.filter(s=>'uses' in s&&!/@[0-9a-f]{40}$/.test(String(s.uses)))).toEqual([]);
    const checkouts=steps.filter(s=>String(s.uses).startsWith('actions/checkout@'));
    expect(checkouts.map(s=>[s.with.path,s.with.ref,s.with['persist-credentials']])).toEqual([
      ['trusted','${{ github.event.pull_request.base.sha }}',false],['subject','${{ github.event.pull_request.head.sha }}',false]]);
  });
});
