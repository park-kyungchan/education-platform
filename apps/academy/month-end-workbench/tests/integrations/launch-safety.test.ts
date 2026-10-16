import {expect,test,mock} from 'bun:test';
import * as fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import type {McpLaunchConfiguration} from '../../src/integrations/mcp-source-port.ts';
import type {Projection} from '../../src/contracts.ts';

const real={...fs};
let selectedPath='',afterSelectedClose:(()=>Promise<void>)|undefined;
// Transparent outside one disposable synthetic descriptor. No SDK launcher is mocked:
// a future attempt to launch these non-executable text fixtures fails this contract.
mock.module('node:fs/promises',()=>({...real,open:async(...args:Parameters<typeof fs.open>)=>{
 const fd=await real.open(...args);if(args[0]!==selectedPath)return fd;
 return new Proxy(fd,{get(target,key){if(key==='close')return async()=>{await target.close();await afterSelectedClose?.();};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}}));
const {createMcpSourcePort,snapshotMcpLaunchConfiguration}=await import('../../src/integrations/mcp-source-port.ts');
const projection={owner:'math-research-module',revision:'07edb2dea2e5997aea4318f0fa2efa21dde633df',manifest:[{path:'synthetic',sha256:'a'.repeat(64)}]} as Projection;
async function fixture(){
 const directory=await real.mkdtemp(resolve(tmpdir(),'mcp-launch-held-'));
 const pin=async(name:string)=>{const path=resolve(directory,name),bytes='reviewed synthetic '+name;await real.writeFile(path,bytes);return{path,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const executable=await pin('executable'),bundle=await pin('bundle'),snapshot=await pin('snapshot');
 const config:McpLaunchConfiguration={executable,bundle,source:{mode:'synthetic',snapshot}};
 return{directory,config};
}
test('launch snapshot owns and deeply freezes all configuration before any await',async()=>{
 const f=await fixture();try{
  const expected=structuredClone(f.config),owned=snapshotMcpLaunchConfiguration(f.config);
  expect(owned).toEqual(expected);expect(owned).not.toBe(f.config);
  expect(Object.isFrozen(owned)).toBe(true);expect(Object.isFrozen(owned.executable)).toBe(true);expect(Object.isFrozen(owned.bundle)).toBe(true);expect(Object.isFrozen(owned.source)).toBe(true);
  expect(Object.isFrozen((owned.source as {snapshot:unknown}).snapshot)).toBe(true);
  const pending=createMcpSourcePort(f.config,projection);
  f.config.executable={path:resolve(f.directory,'unreviewed-missing-executable'),sha256:'0'.repeat(64)};
  f.config.bundle={path:resolve(f.directory,'unreviewed-missing-bundle'),sha256:'0'.repeat(64)};
  f.config.source={mode:'native-readonly',bridge:{path:resolve(f.directory,'unreviewed-missing-bridge'),sha256:'0'.repeat(64)}};
  expect(owned).toEqual(expected);
  await expect(pending).rejects.toThrow('mcp_verified_execution_boundary_unavailable');
 }finally{await real.rm(f.directory,{recursive:true,force:true});}
});
test('replacement of every verified launch path remains fail-closed, including bridge and snapshot',async()=>{
 for(const mode of ['synthetic','native-readonly'] as const){
  const f=await fixture();const file=f.config.source.mode==='synthetic'?f.config.source.snapshot:f.config.source.bridge;
  if(mode==='native-readonly')f.config.source={mode,bridge:file};
  selectedPath=file.path;
  afterSelectedClose=async()=>{for(const pin of [f.config.executable,f.config.bundle,file]){const replacement=pin.path+'.replacement';await real.writeFile(replacement,'UNREVIEWED replacement');await real.rename(replacement,pin.path);}};
  try{
   const before=structuredClone(f.config);
   await expect(createMcpSourcePort(f.config,projection)).rejects.toThrow('mcp_verified_execution_boundary_unavailable');
   expect(f.config).toEqual(before);
   for(const pin of [f.config.executable,f.config.bundle,file])expect(await real.readFile(pin.path,'utf8')).toBe('UNREVIEWED replacement');
  }finally{afterSelectedClose=undefined;selectedPath='';await real.rm(f.directory,{recursive:true,force:true});}
 }
});
