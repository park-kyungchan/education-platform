import {expect,test} from 'bun:test';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
test('neutral MCP runs resolve and intake in one upstream lifetime and logs metadata only',async()=>{
  const base=await mkdtemp(resolve(tmpdir(),'academy-neutral-synthetic-'));
  const entry=resolve(import.meta.dir,'../src/neutral-server.ts'),deny=resolve(import.meta.dir,'network-deny.ts'),events=resolve(base,'events.txt');
  const admission={schemaVersion:'academy.owner-admission/1',decider:'user',decidedAt:'2040-01-16',sourceNamespace:'academy.lms.dayrecord',teacherId:'99001',
    allowedFrom:'2040-01-15',allowedThrough:'2040-01-17',failClosedDefault:'2026-10-23'};
  const bytes=JSON.stringify(admission),admissionPath=resolve(base,'admission.json');
  const env={PATH:process.env.PATH??'/usr/bin:/bin',ACADEMY_MCP_INSTALL_DIR:base};
  let client:Client|undefined,transport:StdioClientTransport|undefined;
  try{
    await writeFile(admissionPath,bytes);await writeFile(resolve(base,'routing.json'),JSON.stringify({admissionPath,admissionSha256:createHash('sha256').update(bytes).digest('hex')}));
    await writeFile(resolve(base,'endpoints.json'),JSON.stringify({dailyrecord:{command:process.execPath,args:['--preload',deny,resolve(import.meta.dir,'neutral-upstream-fixture.ts'),events]}}));
    const discovery=Bun.spawn([process.execPath,'--preload',deny,entry,'--discover'],{env,stdout:'pipe',stderr:'pipe'});
    expect(await discovery.exited).toBe(0);expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start']);
    client=new Client({name:'fictional-neutral-client',version:'1.0.0'});
    transport=new StdioClientTransport({command:process.execPath,args:['--preload',deny,entry],env,stderr:'pipe'});await client.connect(transport);
    const tools=(await client.listTools()).tools,tool=tools.find(t=>t.name==='academy_dailyrecord_get')!;
    expect(tools.filter(t=>t.name===tool.name)).toHaveLength(1);expect(tool.inputSchema.required).not.toContain('lessonDate');
    expect(tool.inputSchema.additionalProperties).toBe(false);
    const request={displayName:'Invented Student',purpose:'Read a fictional source',currentRequestRef:'fictional-neutral-request',lessonDate:'2040-01-16'};
    const result=await client.callTool({name:tool.name,arguments:request});
    expect(result.isError).not.toBe(true);expect(result.structuredContent).toMatchObject({status:'observed',sourceAvailability:'observed',academyWrites:0,parentSends:0});
    expect((await readFile(events,'utf8')).trim().split('\n')).toEqual(['start','start','resolve','intake']);
    const receipts=await readdir(resolve(base,'receipts')),saved=await Promise.all(receipts.map(n=>readFile(resolve(base,'receipts',n),'utf8')));
    expect(saved).toHaveLength(2);
    expect(saved.join('')).not.toContain('Invented Student');expect(saved.join('')).not.toContain('기존 준비물');
    expect(JSON.parse(saved.find(s=>s.includes('completedAt'))!)).toMatchObject({sourceAvailability:'observed',steps:[{tool:'academy_student_resolve',status:'resolved'},{tool:'academy_dailyrecord_intake',sourceAvailability:'observed'}]});
    const denied=await client.callTool({name:tool.name,arguments:{...request,teacherId:'99002'}});expect(denied.isError).toBe(true);
    expect((await readFile(events,'utf8')).match(/intake/g)).toHaveLength(1);
  }finally{await client?.close();await transport?.close();await rm(base,{recursive:true,force:true});}
},20000);
