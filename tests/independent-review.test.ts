import {describe,expect,test} from 'bun:test';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ARTIFACT_PREFIX,REQUEST_LABEL,requested,FINDING_FIELDS,REVIEW_CHECK_NAME,SEVERITY,TEMPLATE_KEYS,VERDICTS,checkWorkflow,judge,parseVerdict,priorVerdict,renderPrompt,type Artifact,type Severity} from '../scripts/independent-review';

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
  const artifact=(id:number,created:string,over:Partial<Artifact>={}):Artifact=>({id,name:ARTIFACT_PREFIX+head,expired:false,created_at:created,archive_download_url:'u',workflow_run:{id,head_sha:head},...over});
  const reader=(artifacts:Artifact[],total=artifacts.length,status=200)=>(async()=>new Response(JSON.stringify({total_count:total,artifacts}),{status})) as unknown as typeof fetch;
  test('no artifact means a first review; several mean the earliest is final',async()=>{
    expect(await priorVerdict('o/r',head,'t',reader([]))).toBeUndefined();
    expect((await priorVerdict('o/r',head,'t',reader([artifact(2,'2026-10-29T02:00:00Z'),artifact(1,'2026-10-29T01:00:00Z')])))?.id).toBe(1);
  });
  test('expired, foreign-head, paged or unreadable listings fail closed',async()=>{
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x',{expired:true})]))).rejects.toThrow('independent_review_verdict_expired');
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x',{workflow_run:{id:1,head_sha:'b'.repeat(40)}})]))).rejects.toThrow('independent_review_artifact_head_mismatch');
    await expect(priorVerdict('o/r',head,'t',reader([artifact(1,'x')],101))).rejects.toThrow('independent_review_artifacts_paged');
    await expect(priorVerdict('o/r',head,'t',reader([],0,403))).rejects.toThrow('independent_review_artifacts_unreadable');
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
  test('no other workflow can report the required check name',()=>{
    const dir=resolve(root,'.github/workflows');
    const owners=readdirSync(dir).filter(f=>/\.ya?ml$/.test(f)).filter(f=>Object.values((Bun.YAML.parse(readFileSync(resolve(dir,f),'utf8')) as any).jobs??{}).some((j:any)=>j?.name===REVIEW_CHECK_NAME));
    expect(owners).toEqual(['independent-review.yml']);
  });
  test('the committed workflow passes and names the exported check',()=>{
    expect(()=>checkWorkflow(workflow())).not.toThrow();
    expect(workflow().jobs.review.name).toBe(REVIEW_CHECK_NAME);
  });
  const step=(doc:any,prefix:string)=>doc.jobs.review.steps.find((s:any)=>String(s.uses??'').startsWith(prefix)&&(prefix!=='actions/checkout@'||s.with.path==='subject'));
  const faults:[string,(doc:any)=>void][]=[
    ['independent_review_workflow_trigger',doc=>{doc.on.pull_request={};}],
    ['independent_review_workflow_permissions',doc=>{doc.permissions.contents='write';}],
    ['independent_review_workflow_unpinned',doc=>{step(doc,'openai/codex-action@').uses='openai/codex-action@v1';}],
    ['independent_review_workflow_untrusted_run',doc=>{doc.jobs.review.steps.push({name:'x',run:'bun subject/scripts/check.ts'});}],
    ['independent_review_workflow_credentials',doc=>{step(doc,'actions/checkout@').with['persist-credentials']=true;}],
    ['independent_review_workflow_checkout',doc=>{step(doc,'actions/checkout@').with.ref='${{ github.event.pull_request.base.sha }}';}],
    ['independent_review_workflow_codex',doc=>{step(doc,'openai/codex-action@').with.model='gpt-6-luna';}],
    ['independent_review_workflow_codex',doc=>{step(doc,'openai/codex-action@').with['codex-args']='[]';}],
    ['independent_review_workflow_job',doc=>{doc.jobs.review.name='Review';}],
    ['independent_review_workflow_skippable',doc=>{doc.jobs.review.if="contains(github.event.pull_request.labels.*.name, 'full-review')";}],
    ['independent_review_workflow_request',doc=>{doc.jobs.review.steps.splice(3,1);}],
    ['independent_review_workflow_request',doc=>{doc.jobs.review.steps[5]['continue-on-error']=true;}],
  ];
  test.each(faults)('injected fault fails with %s',(code,mutate)=>{
    const doc=workflow();mutate(doc);
    expect(()=>checkWorkflow(doc)).toThrow(code);
  });
});
