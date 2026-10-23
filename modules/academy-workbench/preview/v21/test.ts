import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {makeSnapshot} from './fixture.ts';
const tick=()=>new Promise(r=>setTimeout(r,0)),dir=import.meta.dir;
const w:any=new Window({url:'http://127.0.0.1:8765/v21app/',settings:{enableJavaScriptEvaluation:false,disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
w.happyDOM.setWindowSize({width:1440,height:1000});w.HTMLElement.prototype.scrollIntoView=function(){};
w.document.write(readFileSync(dir+'/index.html','utf8'));
new Function('window','document','navigator','Response',readFileSync(dir+'/safety.js','utf8'))(w,w.document,w.navigator,Response);
new Function('window','document','fetch',readFileSync(dir+'/app.js','utf8'))(w,w.document,w.fetch);
const tests:string[]=[];function check(name:string,fn:()=>void){fn();tests.push(name);}
try{
 assert.equal(await w.ACADEMY_READY,true,'actual app initialization');
 for(let i=0;i<40&&w.document.querySelector('.workflow-view')?.getAttribute('aria-busy')==='true';i++)await tick();
 const d=w.document,q=w.SYNTHETIC_QA;
 check('actual app initializes five fictional students, three books and 48 records',()=>{assert.equal(d.querySelectorAll('[data-student-id]').length,5);assert.equal(d.querySelectorAll('.book').length,3);assert.equal(d.querySelectorAll('[data-record-id]').length,48);});
 check('all renderers including evidence, assessment, inclusion and teacher overlays mount',()=>{for(const s of ['.domain-evidence-summary','.assessment-view','.student-event-view','.workflow-view','.today-preparation','.refresh-readiness'])assert.equal(d.querySelectorAll(s).length,1,s);assert.equal(d.querySelectorAll('[data-teacher-overlay-owned="row"]').length,12);assert.equal(d.querySelectorAll('[data-included-source-record]').length,12);assert.equal(d.querySelector('.workflow-view').getAttribute('aria-busy'),'false');assert.equal(d.querySelector('.workflow-status').dataset.state,'ready');});
 check('no synthetic callback registered into native WebMCP',()=>assert.equal(d.modelContext,undefined));
 const calls=q.calls.length;
 for(const stage of ['practice','review','teacher','preview','practice']){d.querySelector(`[data-desktop-stage="${stage}"]`).click();await tick();}
 check('stage browsing has no API call or completion mutation',()=>{assert.equal(q.calls.length,calls);assert.equal(d.querySelectorAll('[data-state="complete"]').length,0);});
 const nextPage=d.querySelector('.desktop-pagination button:last-child');nextPage.focus();nextPage.click();check('paging returns keyboard focus to persistent evidence list',()=>assert.equal(d.activeElement.className,'desktop-evidence-list'));
 const tab=d.querySelector('[role=tab][aria-selected=true]');tab.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));check('tab keyboard End selects teacher and focuses persistent tab',()=>{assert.equal(d.querySelector('[role=tabpanel]').dataset.stage,'teacher');assert.equal(d.activeElement.id,'desktop-step-teacher');});
 d.querySelector('[data-desktop-stage=practice]').click();
 const first=d.querySelector('[data-desktop-record-id]');first.querySelector('button').click();await tick();
 check('actual inline evidence includes independent domain and teacher details',()=>{const r=d.querySelector(`[data-record-container="${first.dataset.desktopRecordId}"]`);assert.equal(r.open,true);assert(r.querySelector('.domain-evidence-detail'));assert(r.querySelector('.teacher-overlay-detail'));});
 const search=d.querySelector('.desktop-search');search.value='no-fiction-match';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 check('search empty state preserves source records',()=>{assert.equal(d.querySelectorAll('.desktop-evidence-item').length,0);assert.equal(d.querySelectorAll('[data-record-id]').length,48);});
 w.dispatchEvent(new w.Event('resize'));
 for(const width of [1100,1099,768,390,320,1440]){w.happyDOM.setWindowSize({width,height:844});await tick();check(`responsive structure at ${width}px`,()=>{assert.equal(d.querySelectorAll('[data-desktop-stepper]').length,width>=1100?1:0);assert.equal(d.querySelectorAll('[data-record-id]').length,48);assert.equal(d.querySelectorAll('.student-nav').length,1);assert.equal(d.querySelectorAll('.workflow-view').length,1);});}
 w.happyDOM.setWindowSize({width:390,height:844});await tick();const selected=d.querySelector('[data-record-id][aria-expanded=true]');selected.parentElement.querySelector('[data-close-record]').click();check('mobile inline close restores focus to the original record',()=>{assert.equal(selected.parentElement.open,false);assert.equal(d.activeElement,selected);});w.happyDOM.setWindowSize({width:1440,height:1000});await tick();
 d.querySelector('[data-student-id="fiction-student-2"]').click();for(let i=0;i<10;i++)await tick();
 check('student selection replaces all fictional scope without duplicate UI',()=>{assert.equal(d.querySelector('[data-student-id][aria-pressed="true"]').dataset.studentId,'fiction-student-2');assert.equal(d.querySelectorAll('[data-desktop-stepper]').length,1);assert([...d.querySelectorAll('[data-record-id]')].every((r:any)=>r.dataset.recordId.startsWith('fiction-student-2-')));});
 d.querySelector('[data-workflow-policy]').click();for(let i=0;i<10;i++)await tick();
 check('workflow policy selection renders synthetic hierarchy',()=>{assert(d.querySelector('.workflow-tree'));assert.equal(d.querySelectorAll('[data-workflow-node]').length,2);});
 d.querySelector('[data-today-summary]').click();for(let i=0;i<5;i++)await tick();
 check('today summary safely remains unverified',()=>assert.equal(d.querySelector('.today-preparation [role=status]').textContent,'저장 요약 확인 · 오늘 학원 자료는 아직 미조회입니다.'));
 const ext=d.querySelector('a[href^="https:"]');ext.click();check('external source navigation is blocked',()=>assert(q.blocked.some((x:any)=>x.kind==='source_link')));
 await assert.rejects(w.fetch('https://example.invalid/forbidden',{method:'GET'}),/network_blocked/);check('unrecognized fetch is blocked without delegating to network',()=>assert(q.blocked.some((x:any)=>x.kind==='fetch')));
 q.failNext(401);d.querySelector('[data-student-id="fiction-student-3"]').click();for(let i=0;i<10;i++)await tick();
 check('simulated authorization loss clears protected renderers',()=>{assert.equal(d.querySelectorAll('[data-record-id]').length,0);assert.equal(d.querySelectorAll('[data-student-id]').length,0);assert.equal(d.querySelectorAll('[data-desktop-stepper]').length,0);assert(d.querySelector('a[href^="/signin"]'));});
 check('no unexpected runtime errors',()=>assert.deepEqual(q.errors,[]));
 check('fixture data is pure fictional names and IDs',()=>{const f=makeSnapshot();assert(f.studentId.startsWith('fiction-'));assert(Object.keys(f.snapshot.view.records).every(x=>x.startsWith('fiction-')));});
 const receipt={passed:true,tests,checks:tests.length,execution:'happy-dom actual v21 app bundle with fictional mocked API',realBrowserLayoutVerified:false,realMobileVerified:false,nativeIdentityVerified:false,nativeWebMcpVerified:false,realWorkerGateVerified:false,externalRequests:0,sourceDataMutations:0,calls:q.calls.map((x:any)=>x.path)};writeFileSync(dir+'/dom-validation.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
}finally{await w.happyDOM.close();}
