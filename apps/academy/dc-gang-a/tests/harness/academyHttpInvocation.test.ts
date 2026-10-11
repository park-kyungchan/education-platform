import {expect,test} from 'bun:test';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reservePrivateJson,readPrivateJsonText} from '../../harness/academy_private_io';

test('actual HTTP invocation selects caller-owned bounded result writes while preserving manual output',async()=>{
 const module=await import('../../harness/academy_http_invocation').catch(()=>({parseHttpInvocation:undefined}));
 expect(typeof module.parseHttpInvocation).toBe('function');
 const home=mkdtempSync(join(tmpdir(),'http-invocation-'));mkdirSync(home+'/artifacts');
 const input=reservePrivateJson(home,home+'/artifacts/request.json'),output=reservePrivateJson(home,home+'/artifacts/output.json');
 try{
  const args=['--request',input.path,'--output',output.path,'--owned-input-inode',input.identity,'--owned-output-inode',output.identity];
  const invocation=module.parseHttpInvocation!(home,args);
  expect(invocation.inputIdentity).toBe(input.identity);
  const writer=invocation.openResult();try{writer.write({fixture:'observed'});}finally{writer.close();}
  expect(JSON.parse(readPrivateJsonText(home,output.path,output.identity))).toEqual({fixture:'observed'});
  for(const invalid of [[...args,'extra'],args.slice(0,6),[...args.slice(0,7),'malformed']])expect(()=>module.parseHttpInvocation!(home,invalid)).toThrow('invalid_http_arguments');
  const manual=module.parseHttpInvocation!(home,['--request',input.path,'--output',home+'/artifacts/manual.json']);
  const file=manual.openResult();try{file.write({fixture:'manual'});}finally{file.cleanup();}
 }finally{input.close();output.close();rmSync(home,{recursive:true,force:true});}
});
