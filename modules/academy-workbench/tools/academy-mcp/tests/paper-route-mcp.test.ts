import {expect,test} from 'bun:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';

test('pinned routing dispatches once to the matching real MCP endpoint and refuses ambiguous or unknown students',async()=>{
 const base=await mkdtemp(resolve(tmpdir(),'academy-paper-routing-'));
 const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
 const deny=resolve(import.meta.dir,'network-deny.ts'), entry=resolve(import.meta.dir,'../src/neutral-server.ts');
 const fixture=resolve(import.meta.dir,'paper-route-fixture.ts'),events=resolve(base,'events');
 const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
 const pin=async(name:string,value:unknown)=>{const s=JSON.stringify(value),path=resolve(base,name);await writeFile(path,s,{mode:0o600});return {path,sha256:sha(s)};};
 let client:Client|undefined,transport:StdioClientTransport|undefined;
 try{
  await writeFile(events,'');
  const admission=await pin('admission.json',{schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-16',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',allowedFrom:'2040-01-15',allowedThrough:'2040-01-17',failClosedDefault:'2026-10-23'});
  const endpoints=await pin('endpoints.json',{paper1:{command:process.execPath,args:['--preload',deny,fixture,'paper1','1001',events]},paper2:{command:process.execPath,args:['--preload',deny,fixture,'paper2','1002',events]}});
  const registry=await pin('registry.json',[{endpoint:'paper1',upstreamName:'academy_paper_headers',tool:{name:'academy_paper_headers',inputSchema:{type:'object'}}},{endpoint:'paper2',upstreamName:'academy_paper_headers',tool:{name:'class2_academy_paper_headers',inputSchema:{type:'object'}}}]);
  let generation=0;
  const publish=async(paperScopes:unknown)=>{const routing=await pin(`routing-${++generation}.json`,{admissionPath:admission.path,admissionSha256:admission.sha256,paperScopes});await writeFile(resolve(base,'release.json'),JSON.stringify({schemaVersion:'academy.mcp-release/1',generation:`v${generation}`,routing,endpoints,registry}),{mode:0o600});};
  await publish([{endpoint:'paper1',studentIds:['1001']},{endpoint:'paper2',studentIds:['1002']}]);
  client=new Client({name:'fictional-client',version:'1'});transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],env,stderr:'pipe'});await client.connect(transport);
  const call=(studentId:string)=>client!.callTool({name:'academy_paper_headers',arguments:{studentId,paperCodes:['#ABC']}});
  expect((await call('1002')).structuredContent).toMatchObject({status:'observed',endpoint:'paper2'});
  expect(await readFile(events,'utf8')).toBe('paper2\n');
  const [first,second]=await Promise.all([call('1001'),call('1002')]);
  expect(first.structuredContent).toMatchObject({status:'observed',endpoint:'paper1'});
  expect(second.structuredContent).toMatchObject({status:'observed',endpoint:'paper2'});
  const afterConcurrent=(await readFile(events,'utf8')).trim().split('\n');
  expect(afterConcurrent[0]).toBe('paper2');
  expect(afterConcurrent.slice(1).sort()).toEqual(['paper1','paper2']);
  expect((await call('1003')).isError).toBe(true);
  expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(afterConcurrent);
  await publish([{endpoint:'paper2',studentIds:['1001']}]);
  expect((await call('1001')).structuredContent).toMatchObject({status:'blocked',code:'read_scope_not_admitted'});
  expect((await readFile(events,'utf8')).trim().split('\n')).toEqual([...afterConcurrent,'paper2']);
  await publish([{endpoint:'paper1',studentIds:['1002']},{endpoint:'paper2',studentIds:['1002']}]);
  expect((await call('1002')).isError).toBe(true);
  expect((await readFile(events,'utf8')).trim().split('\n')).toEqual([...afterConcurrent,'paper2']);
  await publish([{endpoint:'paper1',studentIds:['1001']},{endpoint:'paper2',studentIds:['1001']}]);
  expect((await call('1001')).isError).toBe(true);
  expect((await readFile(events,'utf8')).trim().split('\n')).toEqual([...afterConcurrent,'paper2']);
 }finally{await client?.close();await transport?.close();await rm(base,{recursive:true,force:true});}
},20000);
