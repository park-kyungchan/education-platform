import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseAudit,readPinnedAudit,referenceFor,selectStudent} from '../model.ts';
import {render} from '../view.ts';
import {createViewer} from '../server.ts';
import type {Config} from '../../standalone/src/server/auth.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
// Entirely fictional fixture; never imports private audit records.
const fixture=()=>({schemaVersion:'academy.audit.normalized/1.0.0',collectedAt:'2026-01-01T00:00:00Z',coverage:{fullCurrentHistoryVerified:false},students:Array.from({length:5},(_,i)=>({studentId:'fictional-'+i,name:'가상학생'+i,pageUrl:'https://example.invalid/historical-'+i,books:[{sourceBookEditionId:'book-'+i,displayName:'가상 교재',catalogCode:'SYN',version:1}],sections:[{bookEditionId:'book-'+i,sectionSourceLabel:'가상 섹션',rowKind:'catalog_section',effectiveTeacherRoutes:[],paperEvidence:'unknown'}],currentContext:[{fact:'미확인'}]}))});
const audit=()=>parseAudit(JSON.stringify(fixture()));
test('strict schema, exactly five unique managed identities',()=>{assert.equal(audit().students.length,5);const x=fixture();x.students[1].studentId=x.students[0].studentId;assert.throws(()=>parseAudit(JSON.stringify(x)));assert.throws(()=>parseAudit('{}'));assert.throws(()=>selectStudent(audit(),'other'));});
test('file content hash is verified; symbolic links rejected',()=>{const dir=mkdtempSync(join(tmpdir(),'viewer-fixture-'));try{const text=JSON.stringify(fixture()),p=join(dir,'fixture.json');writeFileSync(p,text);assert.equal(readPinnedAudit(p,hash(text)).students.length,5);assert.throws(()=>readPinnedAudit(p,'0'.repeat(64)));symlinkSync(p,join(dir,'link'));assert.throws(()=>readPinnedAudit(join(dir,'link'),hash(text)));}finally{rmSync(dir,{recursive:true});}});
test('reference resolution uses selected local JSON pointer, preserves historical identity',()=>{const x=audit(),ref=referenceFor(x,'fictional-3','a'.repeat(64));assert.equal(ref.jsonPointer,'/students/3');assert.equal(ref.currentSpaceRequired,false);assert.equal(ref.historicalPageReference,'https://example.invalid/historical-3');});
test('HTML escapes hostile source text and all navigation stays local',()=>{const x=audit();x.students[0].name='<script>alert(1)</script>';const html=render(x,x.students[0],'a'.repeat(64));assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!/href="https?:/.test(html));assert.ok(html.includes('완료율 계산 안 함'));assert.ok(html.includes('현재 화면을 연 시각은 자료 갱신 시각이 아닙니다'));});
test('owner authentication is mandatory even for loopback',()=>{const c={host:'127.0.0.1',port:8790,authMode:'loopback-preview',ownerId:'test',dbPath:'unused',secretFile:null} as Config;assert.throws(()=>createViewer(audit(),'a'.repeat(64),c,Buffer.alloc(32)));});
test('HTTP owner-only routes, strict host/origin/proxy, no static archives or writes',async()=>{
 const secret='fictional-test-only-secret-not-a-real-credential',c:Config={host:'127.0.0.1',port:8790,authMode:'owner-secret',ownerId:'test',dbPath:'unused',secretFile:null};
 const srv=createViewer(audit(),'a'.repeat(64),c,createHash('sha256').update(secret).digest());await new Promise<void>(r=>srv.listen(0,c.host,r));const port=(srv.address() as {port:number}).port;
 const send=(path:string,headers:Record<string,string>={},method='GET')=>new Promise<{status:number,body:string,headers:Record<string,unknown>}>((resolve,reject)=>{const req=request({host:'127.0.0.1',port,path,method,headers},res=>{let body='';res.setEncoding('utf8');res.on('data',s=>body+=s);res.on('end',()=>resolve({status:res.statusCode!,body,headers:res.headers}));});req.on('error',reject);req.end();});
 const auth={Authorization:'Bearer '+secret};try{
 assert.equal((await send('/')).status,401);assert.equal((await send('/',{Authorization:'Bearer wrong'})).status,401);
 const ok=await send('/?studentId=fictional-2',auth);assert.equal(ok.status,200);assert.ok(ok.body.includes('가상학생2'));assert.equal(ok.headers['cache-control'],'private, no-store');assert.ok(String(ok.headers['content-security-policy']).includes("default-src 'none'"));
 const data=await send('/api/audit?studentId=fictional-2',auth);assert.equal(data.status,200);assert.equal(JSON.parse(data.body).student.studentId,'fictional-2');assert.ok(!data.body.includes('fictional-1'));
 assert.equal((await send('/api/audit?studentId=outside',auth)).status,404);assert.equal((await send('/api/audit?studentId=fictional-2&studentId=fictional-3',auth)).status,400);
 assert.equal((await send('/private/audit.json',auth)).status,404);assert.equal((await send('/../private/audit.json',auth)).status,404);
 assert.equal((await send('/',auth,'POST')).status,405);assert.equal((await send('/',{...auth,Host:'evil.invalid'})).status,403);assert.equal((await send('/',{...auth,Origin:'https://evil.invalid'})).status,403);assert.equal((await send('/',{...auth,'X-Forwarded-For':'127.0.0.1'})).status,403);
 assert.equal((await send('/source?studentId=fictional-4',auth)).status,200);
 }finally{await new Promise<void>(r=>srv.close(()=>r()));}
});
test('archive resolver refuses path traversal and never fabricates archive verification',async()=>{const {archiveReference}=await import('../model.ts');const x=audit(),s=x.students[0];s.pageUrl='https://chatgpt.com/space/page_abc';const map={schemaVersion:'academy.local-source-reference-map/1' as const,entries:{page_abc:{kind:'archived_page',originalPageId:'page_abc',runtimeDependency:'none',relativePath:'private/space-migration-20261014/pages/page_abc.json',sha256:'a'.repeat(64)}}};const found=archiveReference(s,map);assert.equal(found.state,'archived_reference_declared');assert.equal(found.archiveBytesReverifiedHere,false);map.entries.page_abc.relativePath='../secret';assert.equal(archiveReference(s,map).state,'not_resolved');});
