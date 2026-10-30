import {expect,test} from 'bun:test';
import {chmod,chown,mkdir,mkdtemp,readFile,readdir,rename,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {loadRuntimeRelease} from '../src/runtime-release.ts';
import {publicReadFailure} from '../src/read-failure.ts';
import {createPackagedFixture} from './release-graph-fixture.ts';

async function failure(base:string){
  try{await loadRuntimeRelease(base);throw Error('expected_failure');}
  catch(error){return publicReadFailure(error);}
}

test('release base reports finite reasons without leaking paths or changing the existing failure code',async()=>{
  const base=await mkdtemp(join(tmpdir(),'PRIVATE_RELEASE_BASE_CANARY-'));
  const file=join(base,'file');await writeFile(file,'fictional');
  const link=join(base,'link');await symlink(base,link);
  const cases:[string,string][]=[['relative-path','relative_path'],[link,'noncanonical_path'],[file,'not_directory']];
  const writable=join(base,'writable');await mkdir(writable);await chmod(writable,0o777);
  cases.push([writable,'writable_by_others']);
  for(const [path,reason] of cases){
    const result=await failure(path);
    expect(result).toMatchObject({code:'release_base_unqualified',category:'policy_denial',automaticRetryAllowed:false,reason});
    expect(JSON.stringify(result)).not.toContain('PRIVATE_RELEASE_BASE_CANARY');
    expect(JSON.stringify(result)).not.toContain(path);
  }
});

test.skipIf(process.getuid?.()!==0)('release base reports an owner mismatch without revealing uid values',async()=>{
  const base=await mkdtemp(join(tmpdir(),'PRIVATE_OWNER_CANARY-'));
  await chown(base,2000,2000);
  try{
    const result=await failure(base);
    expect(result).toMatchObject({code:'release_base_unqualified',reason:'owner_mismatch',automaticRetryAllowed:false});
    expect(JSON.stringify(result)).not.toContain('PRIVATE_OWNER_CANARY');
    expect(JSON.stringify(result)).not.toContain('2000');
  }finally{await chown(base,0,0);}
});

test('packaged MCP response preserves the failure contract and adds the safe reason',async()=>{
  const f=await createPackagedFixture();
  try{
    await chmod(f.base,0o777);
    const result=await f.client.callTool({name:'academy_runtime_identity',arguments:{}});
    expect(result.structuredContent).toMatchObject({status:'blocked',code:'release_base_unqualified',failure:{category:'policy_denial',reason:'writable_by_others',automaticRetryAllowed:false}});
    expect(JSON.stringify(result)).not.toContain(f.base);
    let discoveryError:unknown;
    try{await f.client.listTools();}catch(error){discoveryError=error;}
    expect(discoveryError).toMatchObject({data:{reason:'writable_by_others'}});
    expect((discoveryError as Error).message).toContain('release_base_unqualified');
    expect(JSON.stringify(discoveryError)).not.toContain(f.base);
    const fresh=Bun.spawn([process.execPath,'--no-env-file',f.bridge.path],{env:f.env,stdout:'pipe',stderr:'pipe'});
    const stderr=await new Response(fresh.stderr).text();
    expect(await fresh.exited).toBe(1);
    expect(stderr).toContain('release_base_unqualified reason=writable_by_others');
    expect(stderr).not.toContain(f.base);
    const missing=join(f.base,'PRIVATE_MISSING_PATH_CANARY');
    const missingProc=Bun.spawn([process.execPath,'--no-env-file',f.bridge.path],{env:{...f.env,ACADEMY_MCP_INSTALL_DIR:missing},stdout:'pipe',stderr:'pipe'});
    const missingStderr=await new Response(missingProc.stderr).text();
    expect(await missingProc.exited).toBe(1);
    expect(missingStderr).toContain('release_discovery_unavailable');
    expect(missingStderr).not.toContain(missing);
    expect(missingStderr).not.toContain('PRIVATE_MISSING_PATH_CANARY');
    await chmod(f.base,0o700);
    if(process.getuid?.()===0){
      await chown(f.base,2000,2000);
      const ownerResult=await f.client.callTool({name:'academy_runtime_identity',arguments:{}});
      expect(ownerResult.structuredContent).toMatchObject({status:'blocked',code:'release_base_unqualified',failure:{reason:'owner_mismatch',automaticRetryAllowed:false}});
      expect(JSON.stringify(ownerResult)).not.toContain(f.base);
      expect(JSON.stringify(ownerResult)).not.toContain('2000');
    }
  }finally{if(process.getuid?.()===0)await chown(f.base,0,0);await chmod(f.base,0o700);await f.client.close();await f.transport.close();}
},60000);

test.skipIf(process.getuid?.()!==0||!Bun.which('runuser')||!Bun.which('chown'))('nonroot owner mismatch returns a bounded failure before attempting a receipt',async()=>{
  const f=await createPackagedFixture();await f.client.close();await f.transport.close();
  const ownership=Bun.spawnSync(['chown','-R','65534:65534',f.base]);
  expect(ownership.exitCode).toBe(0);
  const client=new Client({name:'fictional-nonroot-client',version:'1.0.0'});
  const transport=new StdioClientTransport({command:'runuser',args:['-u','nobody','--',process.execPath,'--no-env-file',f.bridge.path],env:f.env,stderr:'pipe'});
  try{
    await client.connect(transport);
    const before=await readdir(join(f.base,'receipts'));
    await chown(f.base,0,0);
    const result=await client.callTool({name:'academy_runtime_identity',arguments:{}});
    expect(result.structuredContent).toMatchObject({status:'blocked',code:'release_base_unqualified',failure:{reason:'owner_mismatch',automaticRetryAllowed:false}});
    expect(JSON.stringify(result)).not.toContain(f.base);
    expect(JSON.stringify(result)).not.toContain('65534');
    expect(await readdir(join(f.base,'receipts'))).toEqual(before);
    await chown(f.base,65534,65534);
    await chown(join(f.base,'receipts'),0,0);
    const receiptFailure=await client.callTool({name:'academy_runtime_identity',arguments:{}});
    expect(receiptFailure.structuredContent).toMatchObject({status:'blocked',code:'upstream_failure_reconcile_dispatch',automaticRetryAllowed:false});
    expect(JSON.stringify(receiptFailure)).not.toContain(f.base);
    expect(await readdir(join(f.base,'receipts'))).toEqual(before);
  }finally{await chown(f.base,65534,65534);await chown(join(f.base,'receipts'),65534,65534);await client.close();await transport.close();}
},60000);

test('a missing runtime base produces a sanitized failure before dispatch',async()=>{
  const f=await createPackagedFixture();const moved=f.base+'-moved';
  try{
    const before=await readdir(join(f.base,'receipts'));
    await rename(f.base,moved);
    const result=await f.client.callTool({name:'academy_runtime_identity',arguments:{}});
    expect(result.structuredContent).toMatchObject({status:'blocked',code:'upstream_failure_reconcile_dispatch',automaticRetryAllowed:false});
    expect(JSON.stringify(result)).not.toContain(f.base);
    expect(await readdir(join(moved,'receipts'))).toEqual(before);
  }finally{await rename(moved,f.base);await f.client.close();await f.transport.close();}
},60000);

test.skipIf(process.getuid?.()!==0||!Bun.which('runuser')||!Bun.which('chown'))('post-dispatch receipt failure is sanitized and requires reconciliation',async()=>{
  const f=await createPackagedFixture(process.execPath,'receipt-inaccessible');await f.client.close();await f.transport.close();
  expect(Bun.spawnSync(['chown','-R','65534:65534',f.base]).exitCode).toBe(0);
  const client=new Client({name:'fictional-post-dispatch-client',version:'1.0.0'});
  const transport=new StdioClientTransport({command:'runuser',args:['-u','nobody','--',process.execPath,'--no-env-file',f.bridge.path],env:f.env,stderr:'pipe'});
  try{
    await client.connect(transport);
    let error:unknown;
    try{await client.callTool({name:'academy_student_metadata_get',arguments:{displayName:'Fictional Two',lessonDate:'2026-10-21',purpose:'Fictional metadata',currentRequestRef:'synthetic-post-dispatch',queries:[{kind:'daily_metadata'}]}});}catch(e){error=e;}
    expect((error as Error).message).toContain('receipt_write_unavailable_reconcile');
    expect((error as Error).message).not.toContain(f.base);
    const data=(error as Error & {data:{occurrence:string;automaticRetryAllowed:boolean}}).data;
    expect(data).toMatchObject({automaticRetryAllowed:false});
    expect(data.occurrence).toMatch(/^[0-9a-f-]{36}$/);
    expect(await readFile(f.events,'utf8')).toContain('"op":"metadata"');
    const receipts=await readdir(join(f.base,'receipts'));
    expect(receipts).toContain(data.occurrence+'-dispatch.json');
    expect(receipts.some(name=>name.endsWith('-result.json')||name.endsWith('-failure.json'))).toBe(false);
  }finally{await chmod(join(f.base,'receipts'),0o700);await client.close();await transport.close();}
},60000);
