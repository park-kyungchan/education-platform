import{test}from'node:test';import assert from'node:assert/strict';import{mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,existsSync,symlinkSync}from'node:fs';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';import{sha}from'../src/adapter.ts';
function setup(){
 const root=mkdtempSync(join(tmpdir(),'academy-adapter-test-')),input=join(root,'input');mkdirSync(input);mkdirSync(join(input,'student-details'));
 const at='2030-01-08T00:00:00Z';
 const response={student:{studentId:'fiction-one',displayName:'가상',sourcePageId:'fiction-page'},historical:{records:[],pagination:{offset:0,limit:20,nextOffset:null},unboundEvidence:{nextOffset:null},unboundDecisions:{nextOffset:null},unresolvedAttempts:{nextOffset:null}}};
 const objects:Record<string,unknown>={
  'recovery-audit.json':{observedAt:at},
  'recovered-ledger-events.json':{events:[]},
  'd1-bounded-read.json':{pages:[{table_name:'academy_ledger_events',rows:[]},{table_name:'academy_ledger_heads',rows:[{student_id:'fiction-one'}]}]},
  'student-details/fiction.json':{observedAt:at,pages:[{request:{studentId:'fiction-one',offset:0,limit:20},response}]}
 };
 const manifest:Record<string,unknown>={};for(const[path,obj]of Object.entries(objects)){const b=JSON.stringify(obj);writeFileSync(join(input,path),b);manifest[path]={sha256:sha(b),bytes:Buffer.byteLength(b)};}
 writeFileSync(join(input,'privacy-audit.json'),JSON.stringify({files:manifest}));return{root,input,output:join(root,'output')};
}
const run=(input:string,output:string)=>spawnSync(process.execPath,['src/cli.ts',input,output],{encoding:'utf8',env:{PATH:process.env.PATH}});
test('CLI creates private files, copies exact bytes and verifies without databases',()=>{const f=setup(),r=run(f.input,f.output);assert.equal(r.status,0,r.stderr);assert.equal(statSync(f.output).mode&0o777,0o700);assert.equal(statSync(join(f.output,'private-dataset.json')).mode&0o777,0o600);assert.deepEqual(readFileSync(join(f.input,'d1-bounded-read.json')),readFileSync(join(f.output,'sources/d1-bounded-read.json')));assert.equal(JSON.parse(readFileSync(join(f.output,'mapping-report.json'),'utf8')).databaseWritten,false);assert.equal(spawnSync(process.execPath,['src/verify-output.ts',f.output],{encoding:'utf8'}).status,0);});
test('CLI refuses an existing output without overwriting',()=>{const f=setup();mkdirSync(f.output);writeFileSync(join(f.output,'keep.txt'),'synthetic original');assert.notEqual(run(f.input,f.output).status,0);assert.equal(readFileSync(join(f.output,'keep.txt'),'utf8'),'synthetic original');});
test('CLI rejects source symlinks and leaves destination absent',()=>{const f=setup();symlinkSync(join(f.input,'recovery-audit.json'),join(f.input,'linked.json'));assert.notEqual(run(f.input,f.output).status,0);assert.equal(existsSync(f.output),false);});
test('CLI rejects public and recognized runtime output roots before reading source',()=>{const f=setup(),runtime=join(f.root,'runtime');mkdirSync(runtime);writeFileSync(join(runtime,'package.json'),JSON.stringify({name:'academy-workbench'}));for(const output of [join(f.root,'public/output'),join(runtime,'private-output')]){assert.notEqual(run(f.input,output).status,0);assert.equal(existsSync(output),false);}});
test('CLI refuses symlink output ancestors',()=>{const f=setup(),alias=join(f.root,'alias');symlinkSync(f.root,alias);assert.notEqual(run(f.input,join(alias,'nested-output')).status,0);assert.equal(existsSync(join(f.root,'nested-output')),false);});
