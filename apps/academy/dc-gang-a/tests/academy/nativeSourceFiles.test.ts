import {describe,expect,test} from 'bun:test';
import {existsSync,renameSync,rmSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import * as direct from '../../src/academy/nativeDirectSource';
import {openOwnedPrivateJson,readPrivateJsonText} from '../../harness/academy_private_io';
const input={username:'fixture-user',discover:{teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:['Invented Learner']}};
const nativeProfile=process.env.HERMES_HOME==='/opt/data/profiles/dc-gang-a-dev';
test.skipIf(nativeProfile)('outside the actual native profile, both entry points refuse before runner invocation',async()=>{
 let calls=0;const runner=async()=>{calls++;return {exitCode:0,stdout:''};};
 await expect(direct.runNativeDirectDiscovery(input,runner)).rejects.toThrow('active_profile_required');
 await expect(direct.runNativeDirectRead({username:'fixture-user',read:{family:'student_course',teacherLabel:'Invented Teacher',studentKey:'91001',studentName:'Invented Learner'}},runner)).rejects.toThrow('active_profile_required');
 expect(calls).toBe(0);
});
// These use the real profile-owned scratch directory, but only supplied fake runners: never source/auth requests.
// A portable checkout must not impersonate that profile or create a native home just to make them run.
describe.skipIf(!nativeProfile)('actual native profile filesystem exchange',()=>{
test('scoped direct read uses the same protected native exchange and rejects malformed keys before spawn',async()=>{
 expect(typeof direct.runNativeDirectRead).toBe('function');let calls=0;
 const read={family:'student_course' as const,teacherLabel:'Invented Teacher',studentKey:'91001',studentName:'Invented Learner'};
 const runner=async(options:direct.OwnedSourceProcess)=>{
  calls++;const arg=(key:string)=>options.argv[options.argv.indexOf(key)+1]!;
  expect(JSON.parse(readPrivateJsonText(process.env.HERMES_HOME!,arg('--request'),arg('--owned-input-inode')))).toEqual({username:'fixture-user',read});
  const output=openOwnedPrivateJson(process.env.HERMES_HOME!,arg('--output'),arg('--owned-output-inode'),131072);
  try{output.write({fixture:'scoped-read'});}finally{output.close();}return {exitCode:0,stdout:''};
 };
 expect(await direct.runNativeDirectRead({username:'fixture-user',read},runner)).toEqual({fixture:'scoped-read'});
 await expect(direct.runNativeDirectRead({username:'fixture-user',read:{...read,studentKey:'091001'}},runner)).rejects.toThrow('invalid');expect(calls).toBe(1);
});

test('native discovery exchanges only exact reserved files and a minimized relay environment',async()=>{
 expect(typeof direct.runNativeDirectDiscovery).toBe('function');
 let directory='';
 const runner=async(options:direct.OwnedSourceProcess)=>{
  expect(Object.keys(options.env).sort()).toEqual(['HERMES_HOME','HOME','PATH','TMPDIR']);
  expect(options.argv).toContain('--no-env-file');
  const arg=(key:string)=>options.argv[options.argv.indexOf(key)+1]!;
  const request=arg('--request'),output=arg('--output');directory=dirname(output);
  expect(JSON.parse(readPrivateJsonText(process.env.HERMES_HOME!,request,arg('--owned-input-inode')))).toEqual(input);
  const writer=openOwnedPrivateJson(process.env.HERMES_HOME!,output,arg('--owned-output-inode'),131072);
  try{writer.write({fixture:'observed'});}finally{writer.close();}
  return {exitCode:0,stdout:''};
 };
 expect(await direct.runNativeDirectDiscovery(input,runner)).toEqual({fixture:'observed'});
 expect(directory.length).toBeGreaterThan(0);expect(existsSync(directory)).toBe(false);
});
test('unknown group termination preserves the exchange for operator reconciliation',async()=>{
 let directory='';
 try{
  await expect(direct.runNativeDirectDiscovery(input,async options=>{directory=dirname(options.argv[options.argv.indexOf('--output')+1]!);throw Error('source_group_termination_unverified');})).rejects.toThrow('source_group_termination_unverified');
  expect(existsSync(directory+'/request.json')).toBe(true);expect(existsSync(directory+'/result.json')).toBe(true);
 }finally{if(directory)rmSync(directory,{recursive:true,force:true});}
});
test('parent readback rejects an unowned replacement without deleting it',async()=>{
 let directory='',output='';
 try{
  await expect(direct.runNativeDirectDiscovery(input,async options=>{
   output=options.argv[options.argv.indexOf('--output')+1]!;directory=dirname(output);
   writeFileSync(directory+'/replacement.json','{"foreign":true}',{mode:0o600});renameSync(directory+'/replacement.json',output);
   return {exitCode:0,stdout:''};
  })).rejects.toThrow('private_json_target_changed');
  expect(existsSync(output)).toBe(true);expect(existsSync(directory+'/request.json')).toBe(false);
 }finally{if(directory)rmSync(directory,{recursive:true,force:true});}
});
for(const scenario of ['oversized','failure'] as const)test('owned exchange cleanup after '+scenario,async()=>{
 let directory='';
 await expect(direct.runNativeDirectDiscovery(input,async options=>{
  const output=options.argv[options.argv.indexOf('--output')+1]!;directory=dirname(output);
  writeFileSync(output,scenario==='oversized'?'x'.repeat(131073):'{}');
  return {exitCode:scenario==='failure'?1:0,stdout:JSON.stringify({code:'synthetic_source_failure'})};
 })).rejects.toThrow(scenario==='oversized'?'private_json_input_too_large':'synthetic_source_failure');
 expect(existsSync(directory)).toBe(false);
});
});
