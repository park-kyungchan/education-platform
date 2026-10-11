import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {mkdtempSync,readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const socket=process.env.DC_ACADEMY_TEST_SOCKET;
describe.skipIf(!socket)('actual observation browser cases, synthetic DOM/HTTP/PostgreSQL before native GUI',()=>{
 test('executes the finite cases against the shipped client and exact persisted requests',async()=>{
  const repo=resolve(import.meta.dir,'../..'),output=mkdtempSync('/opt/data/profiles/dc-gang-a-dev/cache/scratch/observation-browser-');
  const server=Bun.spawn({cmd:[process.execPath,'--no-env-file','harness/academy_browser_rehearsal.ts','--synthetic-only','--output-dir',output,'--teacher-observation-test-socket',socket!],cwd:repo,env:{...process.env,HERMES_HOME:'/opt/data/profiles/dc-gang-a-dev'},stdout:'pipe',stderr:'pipe'});
  let dom:JSDOM|undefined;
  try{
   for(let i=0;i<100&&!existsSync(output+'/endpoint.json');i++)await Bun.sleep(20);
   if(!existsSync(output+'/endpoint.json')){server.kill('SIGTERM');await server.exited;throw Error(await new Response(server.stderr).text());}
   const endpoint=JSON.parse(readFileSync(output+'/endpoint.json','utf8'));
   const client=await Bun.build({entrypoints:[repo+'/src/academy/web/client.ts'],target:'browser',format:'iife'});
   const cases=await Bun.build({entrypoints:[repo+'/tests/academy/teacherObservationBrowserCases.ts'],target:'browser',format:'iife'});
   expect(client.success).toBe(true);expect(cases.success).toBe(true);
   dom=new JSDOM(await (await fetch(endpoint.origin+'/')).text(),{url:endpoint.url.replace('/qa/start','/?date=2090-01-02'),runScripts:'outside-only'});
   Object.assign(dom.window,{structuredClone,fetch:(path:string,options:RequestInit={})=>fetch(new URL(path,endpoint.origin),{...options,headers:{...Object.fromEntries(new Headers(options.headers)),Origin:endpoint.origin}})});
   // Synthetic event dispatch is not a native mouse/input qualification.
   dom.window.HTMLElement.prototype.click=function(){this.dispatchEvent(new dom!.window.Event('click',{bubbles:true}));};
   dom.window.eval(await client.outputs[0]!.text());dom.window.eval(await cases.outputs[0]!.text());
   const result=await (dom.window as unknown as {runTeacherObservationBrowserCases:()=>Promise<{total:number;pass:number;cases:{id:string}[]}>}).runTeacherObservationBrowserCases();
   expect(result.cases.map(row=>row.id)).toEqual(['lost_acknowledgement_retains_exact_request','recovery_without_duplicate_post','append_only_correction','occurrence_scoped_draft','late_recovery_cannot_regress_confirmation','exact_persisted_history_and_effect_boundary','remounted_pending_confirmation_updates_active_editor','remounted_lost_acknowledgement_recovers_original','maximal_korean_observation_is_exactly_persisted','precommit_scene_cannot_regress_confirmed_head']);
   expect(result.total).toBe(10);expect(result.pass).toBe(10);
  }finally{dom?.window.close();server.kill('SIGTERM');await server.exited;}
 });
});
