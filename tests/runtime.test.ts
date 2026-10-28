import {expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {delimiter,join,resolve} from 'node:path';
import {moduleCheckExecution,projectRoot,readSourceMap} from '../src/modules';
import {assertBunRuntime,bunToolchain,setupRuntime,publishActionsBunPath} from '../src/runtime';
import {educationSourceCi} from '../src/source-ci';

test('Bun checks refuse old invokers and unadmitted scripts before spawning',async()=>{
 const module=(await readSourceMap()).modules.find(m=>m.id==='mathcrew')!;
 for(const version of ['1.4.1','1.4.2'])expect(()=>moduleCheckExecution(module,'check',{executable:'/old/bin/bun',version,path:''})).toThrow('bun_runtime_mismatch');
 expect(()=>moduleCheckExecution(module,'publish')).toThrow('unadmitted_script');
 expect(()=>assertBunRuntime()).not.toThrow();
});

test('every Bun module selects the invoking executable and nested Bun ignores stale PATH',async()=>{
 const modules=(await readSourceMap()).modules.filter(m=>m.runtime==='bun');
 const root=mkdtempSync(join(tmpdir(),'education-bun-routing-'));
 try {
  const stale=join(root,'old-bin');mkdirSync(stale);
  writeFileSync(join(stale,'bun'),'#!/bin/sh\nexit 91\n',{mode:0o755});
  writeFileSync(join(root,'package.json'),JSON.stringify({scripts:{check:'bun probe.ts'}}));
  writeFileSync(join(root,'probe.ts'),'console.log(JSON.stringify({version:Bun.version,executable:process.execPath,cwd:process.cwd()}));');
  for(const module of modules){
   const {command,env}=moduleCheckExecution({...module,checks:['check']},'check',{executable:process.execPath,version:Bun.version,path:stale});
   expect(command).toEqual([process.execPath,'run','check']);
   expect(env.PATH.split(delimiter)[0]).toBe(resolve(process.execPath,'..'));
   const child=Bun.spawn(command,{cwd:root,env,stdout:'pipe',stderr:'pipe'});
   const output=await new Response(child.stdout).text();
   expect(await child.exited).toBe(0);
   expect(JSON.parse(output.trim())).toEqual({version:bunToolchain.version,executable:process.execPath,cwd:root});
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('mathematics preserves exact Node/npm reference routing and deferred Bun parity',async()=>{
 const map=await readSourceMap(),module=map.modules.find(m=>m.id==='mathematics-core')!;
 const {command,env}=moduleCheckExecution(module,'verify',{executable:'/old/bin/bun',version:'1.4.1',path:'/fixture/bin'});
 expect(command).toEqual([resolve(projectRoot,'.private/runtimes/node-26.7.0/bin/node'),resolve(projectRoot,'.private/runtimes/npm-11.17.0/bin/npm-cli.js'),'run','verify']);
 expect(env.PATH.split(delimiter)[0]).toBe(resolve(projectRoot,'.private/runtimes/node-26.7.0/bin'));
 expect(map.semanticState.bunParity).toBe('DEFERRED');
});

test('setup plan, module runtime declarations and active doctor pin share Bun1.4.3',async()=>{
 expect(bunToolchain).toEqual({packageName:'@oven/bun-linux-x64',version:'1.4.3',directory:'bun-1.4.3'});
 const map=await readSourceMap();
 for(const module of map.modules.filter(m=>m.runtime==='bun'))expect(module.runtimePin).toBe(bunToolchain.version);
 for(const path of ['package.json','packages/curriculum/package.json','examples/clinic-workbench/package.json']){
  const manifest=await Bun.file(resolve(projectRoot,path)).json();expect(manifest.packageManager).toBe('bun@'+bunToolchain.version);
 }
 for(const path of ['apps/mathcrew/package.json','apps/academy/gang-a/package.json','examples/clinic-workbench/package.json']){
  const manifest=await Bun.file(resolve(projectRoot,path)).json();expect(manifest.engines.bun).toBe(bunToolchain.version);
 }
 const curriculum=await Bun.file(resolve(projectRoot,'packages/curriculum/runtime.manifest.json')).json();
 expect(curriculum.runtime.bun).toBe(bunToolchain.version);
 expect(curriculum.runtime.bunTypes).toBe('1.4.2');
});

test('only the existing Actions source step can use Bun1.4.2 as setup bootstrap',()=>{
 for(const options of [
  {version:'1.4.2',actions:undefined,path:undefined},
  {version:'1.4.2',actions:'true',path:undefined},
  {version:'1.4.2',actions:'false',path:'/fixture/path'},
  {version:'1.4.1',actions:'true',path:'/fixture/path'},
 ])expect(()=>setupRuntime(options)).toThrow('bun_runtime_mismatch');
 expect(setupRuntime({version:'1.4.2',actions:'true',path:'/fixture/path'})).toEqual({bootstrapVersion:'1.4.2',actionsPath:'/fixture/path'});
 expect(setupRuntime({version:'1.4.3',actions:undefined,path:'/fixture/path'}).actionsPath).toBeUndefined();
 expect(()=>setupRuntime({version:'1.4.2',actions:'true',path:'/fixture/path\n/other'})).toThrow('invalid_actions_path');
});

test('standalone module CI templates provision the maintained Bun runtime before checks',()=>{
 const paths=['apps/mathcrew/.github/workflows/ci.yml','examples/clinic-workbench/.github/workflows/check.yml','apps/academy/gang-a/.github/workflows/ci.yml','packages/curriculum/.github/workflows/validate.yml'];
 for(const path of paths){
  const workflow=Bun.YAML.parse(readFileSync(resolve(projectRoot,path),'utf8')) as {jobs:Record<string,{steps:{uses?:string;with?:Record<string,unknown>}[]}>};
  const setup=Object.values(workflow.jobs).flatMap(job=>job.steps).filter(step=>step.uses?.startsWith('oven-sh/setup-bun@'));
  expect(setup).toHaveLength(1);
  expect(setup[0]!.with?.['bun-version']).toBe(bunToolchain.version);
 }
});

test('setup publishes Bun1.4.3 to later Actions steps without overwriting existing PATH entries',()=>{
 const root=mkdtempSync(join(tmpdir(),'education-actions-path-'));
 try{
  const path=join(root,'github-path'),bin=join(root,bunToolchain.directory,'bin');
  writeFileSync(path,'/existing/tool/bin\n');
  publishActionsBunPath(bin,path);
  expect(readFileSync(path,'utf8')).toBe('/existing/tool/bin\n'+bin+'\n');
  expect(()=>publishActionsBunPath(bin+'\n/other',path)).toThrow('invalid_actions_path');
  expect(readFileSync(path,'utf8')).toBe('/existing/tool/bin\n'+bin+'\n');
  publishActionsBunPath('/not-published',undefined);
  expect(readFileSync(path,'utf8')).toBe('/existing/tool/bin\n'+bin+'\n');
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('root source CI guards owner setup inside the shared action and preserves runtime, review and gate boundaries',async()=>{
 const contract=educationSourceCi;
 const workflow=Bun.YAML.parse(readFileSync(resolve(projectRoot,contract.workflow),'utf8')) as any;
 expect(workflow.permissions).toEqual(contract.permissions);
 const project=await Bun.file(resolve(projectRoot,'project.json')).json();
 expect(project.projectId).toBe(contract.owner.projectId);expect(project.domainId).toBe(contract.owner.domainId);
 const source=workflow.jobs[contract.source.jobId];
 const checkout=source.steps.find((step:any)=>step.uses?.startsWith('actions/checkout@'));
 expect(checkout.with.ref).toBe(contract.sourceSha);expect(checkout.with['persist-credentials']).toBe(false);
 expect(checkout.with['fetch-depth']).toBe(contract.source.fetchDepth);
 const bootstrap=source.steps.find((step:any)=>step.uses?.startsWith('oven-sh/setup-bun@'));
 expect(bootstrap.with['bun-version']).toBe(contract.setup.bootstrapBun);
 const shared=source.steps.filter((step:any)=>step.uses===contract.source.action);
 expect(shared).toHaveLength(1);
 const sharedIndex=source.steps.indexOf(shared[0]);
 expect(source.steps.slice(0,sharedIndex).map((step:any)=>step.uses)).toEqual([checkout.uses,bootstrap.uses]);
 // Owner setup stays in the shared action. Only this closed disposable
 // source-plan suffix may follow; missing replay/cleanup or extra shell fails.
 expect(sharedIndex).toBe(2);
 expect(source.steps.slice(sharedIndex+1)).toEqual(contract.source.nativePlanReplaySteps);
 expect(source.steps.filter((step:any)=>step.run)).toEqual(contract.source.nativePlanReplaySteps);
 expect(shared[0].with).toEqual({
  'project-id':contract.owner.projectId,repository:contract.owner.repository,
  'source-sha':contract.sourceSha,'bun-version':contract.source.bun,
  'install-dependencies':contract.source.installDependencies,scripts:JSON.stringify(contract.source.scripts),
 });
 expect(shared[0].env).toBeUndefined();expect(contract.source.bun).toBe(bunToolchain.version);
 const manifest=await Bun.file(resolve(projectRoot,'package.json')).json();
 expect(contract.source.scripts[0]).toBe(contract.setup.script);
 expect(manifest.scripts[contract.source.scripts[0]]).toBe('bun scripts/setup.ts');
 expect(manifest.scripts[contract.source.scripts[1]]).toBe('bun ci/verify-projection.ts');
 expect(manifest.scripts[contract.source.scripts[2]]).toBe('bun scripts/check.ts');
 const review=workflow.jobs[contract.nativeReview.jobId];
 expect(review.steps.find((step:any)=>step.uses?.startsWith('oven-sh/setup-bun@')).with['bun-version']).toBe(contract.setup.bootstrapBun);
 expect(review.steps.filter((step:any)=>step.run).map((step:any)=>step.run)).toEqual(['bun ci/verify-projection.ts','bun ci/native-review-gate.js']);
 const provider=await Bun.file(resolve(projectRoot,contract.nativeReview.policyPath)).json();
 expect(provider.policy.repository).toBe(contract.owner.repository);expect(provider.policy.projectId).toBe(contract.owner.projectId);
 expect(provider.policy.domainId).toBe(contract.owner.domainId);expect(provider.policy.semanticOwner).toBe(contract.owner.projectId);
 const gate=workflow.jobs[contract.gate.jobId];
 expect(gate.if).toBe('${{ always() }}');expect(gate.needs).toEqual(contract.gate.needs);
 for(const source of ['success','failure','cancelled','skipped'])for(const review of ['success','failure','cancelled','skipped']){
  const child=Bun.spawn(['bash','-c',gate.steps[0].run],{env:{SOURCE_RESULT:source,REVIEW_RESULT:review},stdout:'pipe',stderr:'pipe'});
  expect((await child.exited)===0).toBe(source==='success'&&review==='success');
 }
});
