import {expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,unlinkSync,readFileSync,rmSync,existsSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as io from '../../harness/academy_private_io';
test('invalid output bounds refuse before creating a private exchange file',()=>{
 const home=mkdtempSync(join(tmpdir(),'source-bound-'));mkdirSync(home+'/artifacts');const path=home+'/artifacts/out.json';
 try{expect(()=>io.reservePrivateJson(home,path,0)).toThrow('private_json_limit_required');expect(existsSync(path)).toBe(false);}finally{rmSync(home,{recursive:true,force:true});}
});
test('reserved private exchange binds producer, bounded readback and cleanup to one inode',()=>{
 const home=mkdtempSync(join(tmpdir(),'source-exchange-'));mkdirSync(join(home,'artifacts'));
 const path=join(home,'artifacts','result.json'),owned=io.reservePrivateJson(home,path,128);
 try{
  expect(typeof owned.identity).toBe('string');
  const producer=io.openOwnedPrivateJson(home,path,owned.identity,128);
  try{producer.write({state:'observed'});}finally{producer.close();}
  expect(JSON.parse(io.readPrivateJsonText(home,path,owned.identity))).toEqual({state:'observed'});
  expect(()=>owned.write({data:'x'.repeat(129)})).toThrow('private_json_output_too_large');
  expect(JSON.parse(io.readPrivateJsonText(home,path,owned.identity))).toEqual({state:'observed'});
  const replacement=join(home,'artifacts','replacement.json');writeFileSync(replacement,'{"foreign":true}',{mode:0o600});renameSync(replacement,path);
  expect(()=>io.readPrivateJsonText(home,path,owned.identity)).toThrow('private_json_target_changed');
  expect(()=>io.openOwnedPrivateJson(home,path,owned.identity,128)).toThrow('private_json_target_changed');
  owned.cleanup();expect(existsSync(path)).toBe(true);expect(readFileSync(path,'utf8')).toBe('{"foreign":true}');
 }finally{owned.close();rmSync(home,{recursive:true,force:true});}
});
test('private JSON descriptors refuse replacement instead of following an output symlink',async()=>{
 const module=await import('../../harness/academy_private_io').catch(()=>({reservePrivateJson:undefined}));expect(typeof module.reservePrivateJson).toBe('function');
 const home=mkdtempSync(join(tmpdir(),'journal-io-'));mkdirSync(join(home,'artifacts'));const path=join(home,'artifacts','out.json'),foreign=join(home,'foreign.json');writeFileSync(foreign,'preserve');
 const result=module.reservePrivateJson!(home,path);try{result.write({state:'started'});unlinkSync(path);symlinkSync(foreign,path);expect(()=>result.write({state:'late'})).toThrow('private_json_target_changed');expect(readFileSync(foreign,'utf8')).toBe('preserve');}finally{result.close();rmSync(home,{recursive:true,force:true});}
});
