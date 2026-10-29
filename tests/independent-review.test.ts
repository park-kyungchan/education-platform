import {describe,expect,test} from 'bun:test';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {EXPECTED_WORKFLOW,RUN_PREFIX,REVIEW_CONTEXT,RUNNER_JOB_NAME,STATUS_CREATOR,STATUS_STATES,REQUEST_LABEL,FINDING_FIELDS,SEVERITY,TEMPLATE_KEYS,VERDICTS,checkWorkflow,claim,contextStatuses,decide,judge,parseVerdict,recordVerdict,renderPrompt,requested,type Api,type Severity,type StatusState} from '../scripts/independent-review';

const root=resolve(import.meta.dir,'..');
const schema=JSON.parse(readFileSync(resolve(root,'ci/independent-review/schema.json'),'utf8'));
const template=readFileSync(resolve(root,'ci/independent-review/prompt.md'),'utf8');
const workflowText=readFileSync(resolve(root,'.github/workflows/independent-review.yml'),'utf8');
const workflow=()=>Bun.YAML.parse(workflowText) as any;
const severities=Object.keys(SEVERITY) as Severity[];
const states=Object.keys(STATUS_STATES) as StatusState[];
const finding=(severity:Severity)=>({file:'a.ts',line:1,severity,summary:'s',evidence:'e'});
const head='a'.repeat(40),run='https://github.com/o/r/actions/runs/9/attempts/1',otherRun='https://github.com/o/r/actions/runs/8/attempts/1';

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

// An in-memory commit-status store with the REST shapes the script reads and writes.
const store=(seed:Record<string,unknown>[]=[])=>{
  const statuses=[...seed];let next=100;
  const posts:Record<string,unknown>[]=[];
  const api:Api=async(method,path,body)=>{
    if(method==='GET'){expect(path).toBe(`commits/${head}/statuses?per_page=100`);return [...statuses].reverse();}
    expect(path).toBe(`statuses/${head}`);
    const s={...(body as Record<string,unknown>),id:next++,created_at:`2026-10-29T00:00:${String(next).slice(-2)}Z`,creator:{login:STATUS_CREATOR}};
    statuses.push(s);posts.push(s);return s;
  };
  return {api,posts,statuses};
};
const status=(id:number,state:string,over:Record<string,unknown>={})=>({id,state,context:REVIEW_CONTEXT,target_url:otherRun,created_at:`2026-10-29T00:00:0${id}Z`,creator:{login:STATUS_CREATOR},...over});
const pass=JSON.stringify({verdict:'pass',findings:[finding('low')]});

describe('one verdict per head (commit statuses)',()=>{
  test('no status: claim posts pending once, then record posts the verdict',async()=>{
    const s=store();
    expect(await claim(s.api,head,run)).toBe(true);
    expect(s.posts.map(p=>[p.state,p.context,p.target_url])).toEqual([['pending',REVIEW_CONTEXT,run]]);
    expect((await recordVerdict(s.api,head,run,pass)).pass).toBe(true);
    expect(s.posts.map(p=>p.state)).toEqual(['pending','success']);
  });
  test('status policy: only a pending status is a lost sample',()=>{expect(STATUS_STATES).toEqual({pending:'lost',success:'recorded',failure:'recorded',error:'recorded'});});
  test('a run cancelled after its claim leaves pending, and every later run fails closed without sampling',async()=>{
    const s=store();expect(await claim(s.api,head,otherRun)).toBe(true);
    await expect(claim(s.api,head,run)).rejects.toThrow('independent_review_sample_lost');
    expect(s.posts.map(p=>p.state)).toEqual(['pending']);
  });
  test.each(states)('latest status %s decides exactly as STATUS_STATES says',async state=>{
    const s=store([status(1,state)]);
    if(STATUS_STATES[state]==='lost')await expect(claim(s.api,head,run)).rejects.toThrow('independent_review_sample_lost');
    else expect(await claim(s.api,head,run)).toBe(false);
    expect(s.posts).toEqual([]);
  });
  test('after a recorded verdict any later run, re-run or re-label samples nothing',async()=>{
    for(const verdict of [pass,JSON.stringify({verdict:'changes_required',findings:[finding('high')]})]){
      const s=store();await claim(s.api,head,run);await recordVerdict(s.api,head,run,verdict);
      expect(await claim(s.api,head,otherRun)).toBe(false);
      expect(decide(await contextStatuses(s.api,head))).toEqual({sample:false,state:s.posts.at(-1)!.state as StatusState});
    }
  });
  test('a missing or invalid verdict is recorded as failure, never left open',async()=>{
    for(const text of [undefined,'not json',JSON.stringify({verdict:'pass',findings:[finding('high')]})]){
      const s=store();await claim(s.api,head,run);
      await expect(recordVerdict(s.api,head,run,text)).rejects.toThrow(ReviewErrorCode);
      expect(s.posts.map(p=>p.state)).toEqual(['pending','failure']);
    }
  });
  test('only the claiming run records, and only over its own pending status',async()=>{
    const s=store([status(1,'pending')]);
    await expect(recordVerdict(s.api,head,run,pass)).rejects.toThrow('independent_review_claim_missing');
    const t=store([status(1,'success',{target_url:run})]);
    await expect(recordVerdict(t.api,head,run,pass)).rejects.toThrow('independent_review_claim_missing');
    expect([...s.posts,...t.posts]).toEqual([]);
  });
  test('the newest status wins; other contexts are ignored; foreign, unknown or paged lists fail closed',async()=>{
    expect(decide(await contextStatuses(store([status(1,'pending'),status(2,'success')]).api,head))).toEqual({sample:false,state:'success'});
    expect(decide(await contextStatuses(store([status(1,'pending',{context:'other'})]).api,head))).toEqual({sample:true});
    await expect(contextStatuses(store([status(1,'success',{creator:{login:'someone'}})]).api,head)).rejects.toThrow('independent_review_status_foreign');
    await expect(contextStatuses(store([status(1,'cancelled')]).api,head)).rejects.toThrow('independent_review_status_unknown');
    await expect(contextStatuses(store(Array.from({length:100},(_,i)=>status(1,'success',{id:i,context:'other'}))).api,head)).rejects.toThrow('independent_review_statuses_paged');
  });
});
const ReviewErrorCode=/^independent_review_\w+@scripts\/independent-review\.ts:\d+ /;

describe('request gate',()=>{
  test('same repository, default base and the label pass; anything else fails, never skips',()=>{
    expect(()=>requested('o/r','o/r',JSON.stringify(['x',REQUEST_LABEL]),'main','main')).not.toThrow();
    expect(()=>requested('o/r','o/r',JSON.stringify(['x']),'main','main')).toThrow('independent_review_not_requested');
    expect(()=>requested('o/r','fork/r',JSON.stringify([REQUEST_LABEL]),'main','main')).toThrow('independent_review_cross_repository');
    expect(()=>requested('o/r','o/r',JSON.stringify([REQUEST_LABEL]),'release','main')).toThrow('independent_review_base_not_default');
    expect(()=>requested('o/r','o/r',JSON.stringify([REQUEST_LABEL]),'','')).toThrow('independent_review_base_not_default');
    expect(()=>requested('o/r','o/r','','main','main')).toThrow('independent_review_labels_unreadable');
  });
});

describe('workflow invariants',()=>{
  test('job names are literal, and no workflow job can report the required context name',()=>{
    const dir=resolve(root,'.github/workflows');
    const jobs=readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).flatMap(f=>Object.entries((Bun.YAML.parse(readFileSync(resolve(dir,f),'utf8')) as any).jobs??{}).map(([key,job]:[string,any])=>({file:f,name:String(job?.name??key)})));
    expect(jobs.filter(j=>j.name.includes('${{'))).toEqual([]);
    expect(jobs.filter(j=>j.name===REVIEW_CONTEXT)).toEqual([]);
    expect(jobs.filter(j=>j.name===RUNNER_JOB_NAME).map(j=>j.file)).toEqual(['independent-review.yml']);
  });
  test('the committed workflow equals the table exactly',()=>{expect(()=>checkWorkflow(workflow())).not.toThrow();});
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
  test('claiming never skips; only sampling and recording depend on the claim; recording always follows a claim',()=>{
    expect('if' in job||'continue-on-error' in job).toBe(false);
    expect(steps.filter(s=>'continue-on-error' in s)).toEqual([]);
    expect(steps.filter(s=>'if' in s).map(s=>s.if)).toEqual(["${{ steps.claim.outputs.sample == 'true' }}","${{ steps.claim.outputs.sample == 'true' }}","${{ always() && steps.claim.outputs.sample == 'true' }}"]);
    expect(steps.slice(3,5).map(s=>s.run)).toEqual([RUN_PREFIX+'request',RUN_PREFIX+'claim']);
    expect(steps.at(-1)?.run).toBe(RUN_PREFIX+'record review-input/verdict.json');
    expect(steps.filter(s=>String(s.uses).startsWith('openai/codex-action@')).map(s=>steps.indexOf(s))).toEqual([steps.length-2]);
  });
  test('trusted code only, pinned actions, least token, uncredentialed checkouts',()=>{
    expect(EXPECTED_WORKFLOW.permissions).toEqual({contents:'read',statuses:'write'});
    expect(steps.filter(s=>'run' in s&&!String(s.run).startsWith(RUN_PREFIX))).toEqual([]);
    expect(steps.filter(s=>'uses' in s&&!/@[0-9a-f]{40}$/.test(String(s.uses)))).toEqual([]);
    const checkouts=steps.filter(s=>String(s.uses).startsWith('actions/checkout@'));
    expect(checkouts.map(s=>[s.with.path,s.with.ref,s.with['persist-credentials']])).toEqual([
      ['trusted','${{ github.sha }}',false],['subject','${{ github.event.pull_request.head.sha }}',false]]);
  });
});
