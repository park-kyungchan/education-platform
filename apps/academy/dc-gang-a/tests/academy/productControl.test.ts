import {describe,test,expect} from 'bun:test';
import {assertSuccessorOperation,currentAppArgv,assertRetiredNativeAdmission,pointerEntryState} from '../../src/academy/product-control/product-domain-controller';
import {assertOwnedSql} from '../../src/academy/product-control/product-readback';
import type {SQL} from 'bun';
describe('same owner current compiler and restricted source operations',()=>{
 test('future app uses explicit current binary and retained-only argv',()=>{expect(currentAppArgv('/opt/data/.local/bin/bun','/fixture/releases/final','main.ts')).toEqual(['/opt/data/.local/bin/bun','--no-env-file','/fixture/releases/final/main.ts','--retained-only']);});
 test('old binary cannot be silently re-admitted',()=>{expect(()=>currentAppArgv('/opt/data/toolchains/bun/1.4.2/bin/bun','/fixture','main.ts')).toThrow('current_compiler_required');});
 for(const op of ['status','prepare-role','ready'])for(const role of ['app','tunnel'])test(op+' '+role+' is source-defined',()=>{expect(()=>assertSuccessorOperation(op,role)).not.toThrow();});
 for(const op of ['status','prepare-role','ready'])test(op+' postgres refused before initialization',()=>{expect(()=>assertSuccessorOperation(op,'postgres')).toThrow('preserved_postgres_lifecycle_forbidden');});
 for(const op of ['migrate','inspect-legacy','reset','serve'])test('consumed/foreign '+op+' refused',()=>{expect(()=>assertSuccessorOperation(op,'postgres')).toThrow();});
 test('selection requires explicit byte/absence expected value',()=>{expect(()=>assertSuccessorOperation('select-release','final-product-df7793a','absent')).not.toThrow();expect(()=>assertSuccessorOperation('select-release','final-product-df7793a',undefined)).toThrow();expect(()=>assertSuccessorOperation('select-release','final-product-df7793a','unknown')).toThrow();});
 test('role arity is fixed',()=>{expect(()=>assertSuccessorOperation('ready','app','unexpected')).toThrow();});
 test('SQL identity helper performs only declared read against fictional port',async()=>{let calls=0;const scope={database:'fixture',username:'fixture-user',dataDirectory:'/fixture/primary',socketDirectory:'/fixture/socket',port:9999};const tx=async(strings:TemplateStringsArray)=>{calls++;expect(strings.join('')).toContain('SELECT current_database()');return[{database:scope.database,username:scope.username,local_socket:true,data:scope.dataDirectory,socket:scope.socketDirectory,port:String(scope.port),listen:''}];};await assertOwnedSql(tx as unknown as SQL,scope);expect(calls).toBe(1);});
 test('foreign SQL identity refuses without opening a database',async()=>{const tx=async()=>[{database:'foreign',username:'fixture',local_socket:true,data:'/fixture',socket:'/fixture',port:'1',listen:''}];await expect(assertOwnedSql(tx as unknown as SQL,{database:'owned',username:'fixture',dataDirectory:'/fixture',socketDirectory:'/fixture',port:1})).rejects.toThrow('own_product_sql_identity_required');});
});

describe('original non-PG eligibility retirement',()=>{
 const admission={schema:'academy.root-product-activation-admission.v2',taskId:'fixture',deploymentContractSha256:'a'.repeat(64),sourceAcquisition:false,operations:['status:postgres','stop:postgres']};
 test('original PG status/stop retained without Bun eligibility',()=>expect(()=>assertRetiredNativeAdmission(admission,'fixture','a'.repeat(64))).not.toThrow());
 for(const op of ['serve:app','serve:tunnel','serve:postgres','ready:postgres','select-release','migrate'])test(op+' legacy eligibility refused',()=>expect(()=>assertRetiredNativeAdmission({...admission,operations:[...admission.operations,op]},'fixture','a'.repeat(64))).toThrow());
 test('non-array operations refused',()=>expect(()=>assertRetiredNativeAdmission({...admission,operations:'status:postgres'},'fixture','a'.repeat(64))).toThrow());
});

import {mkdtempSync,symlinkSync,lstatSync,existsSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
describe('actual pointer directory entry qualification',()=>{
 const uid=process.getuid!();
 function fixture(run:(dir:string,path:string)=>void){const dir=mkdtempSync(join(tmpdir(),'pc143-pointer-'));try{run(dir,join(dir,'selected-release.json'));}finally{rmSync(dir,{recursive:true,force:true});}}
 test('genuine absence at known private parent',()=>fixture((dir,path)=>expect(pointerEntryState(path,uid)).toBe('absent')));
 test('dangling symlink is refused and preserved',()=>fixture((dir,path)=>{symlinkSync(join(dir,'missing'),path);expect(existsSync(path)).toBe(false);expect(()=>pointerEntryState(path,uid)).toThrow('malformed_pointer_entry_refused');expect(lstatSync(path).isSymbolicLink()).toBe(true);}));
 test('directory entry is refused and preserved',()=>fixture((dir,path)=>{mkdirSync(path);expect(()=>pointerEntryState(path,uid)).toThrow();expect(lstatSync(path).isDirectory()).toBe(true);}));
 test('malformed regular pointer is refused and preserved',()=>fixture((dir,path)=>{writeFileSync(path,'{}',{mode:0o600});expect(()=>pointerEntryState(path,uid)).toThrow('malformed_pointer_state_refused');expect(lstatSync(path).size).toBe(2);}));
 test('exact valid pointer bytes return expected hash',()=>fixture((dir,path)=>{const body=JSON.stringify({schema:'academy.selected-retained-release.v2',taskId:'fictional',generation:'fictional',label:'fictional',manifestSha256:'a'.repeat(64),selectedAt:'fictional'});writeFileSync(path,body,{mode:0o600});expect(pointerEntryState(path,uid)).toBe(createHash('sha256').update(body).digest('hex'));}));
 test('unknown parent is refused before absence claim',()=>fixture((dir,path)=>expect(()=>pointerEntryState(join(dir,'missing-parent','pointer'),uid)).toThrow()));
});
