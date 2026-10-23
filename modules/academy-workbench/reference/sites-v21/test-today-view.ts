import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {mountTodayPreparation} from './src/today-view.ts';
const w=new Window({url:'https://academy.example.invalid'}),root=w.document.createElement('div');w.document.body.append(root);
let authFailures=0,calls=0;const pending:Array<(response:Response)=>void>=[];
const oldFetch=globalThis.fetch;
globalThis.fetch=(async(path:any,options:any)=>{assert.equal(path,'/api/academy/today');assert.equal(options.method,'POST');assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'manual');assert.deepEqual(Object.keys(JSON.parse(options.body)).sort(),['date','session']);calls++;return new Promise<Response>(resolve=>pending.push(resolve));}) as typeof fetch;
const mount=()=>mountTodayPreparation(root as any,()=>{authFailures++;root.innerHTML='';});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const click=()=>root.querySelector<HTMLButtonElement>('button')!.click();
try{
 let handle=mount();assert.equal(calls,0);assert(root.textContent.includes('오늘 학원 자료 미조회'));assert(root.textContent.includes('1부'));assert(root.textContent.includes('2부'));assert(!root.textContent.includes('0개'));
 click();assert.equal(calls,1);assert(root.querySelector('button')!.disabled);pending.shift()!(Response.json({status:'success',result:{domain:'academy',kind:'daily_preparation',sourceMode:'saved_snapshot',liveRefreshConnected:false,current:{state:'unverified'},taskCount:null,requestedDate:'2026-10-12'}}));await tick();assert(root.textContent.includes('오늘 학원 자료는 아직 미조회'));assert(!root.querySelector('button')!.disabled);
 click();pending.shift()!(Response.json({status:'unavailable'},{status:503}));await tick();assert(root.textContent.includes('미확인 상태로 유지'));assert.equal(authFailures,0);
 click();pending.shift()!(Response.json({status:'unauthorized'},{status:401}));await tick();assert.equal(authFailures,1);assert.equal(root.textContent,'');handle.dispose();
 handle=mount();click();const stale=pending.shift()!;handle.dispose();const current=mount();stale(Response.json({status:'unauthorized'},{status:403}));await tick();assert.equal(authFailures,1);assert(root.textContent.includes('오늘 학원 자료 미조회'));current.dispose();assert.equal(root.children.length,0);
 handle=mount();click();pending.shift()!(new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}}));await tick();assert.equal(authFailures,2);handle.dispose();
 console.log(JSON.stringify({passed:true,checks:8,execution:'synthetic_DOM',networkRequests:0,sourceRefreshes:0}));
}finally{globalThis.fetch=oldFetch;await w.happyDOM.close();}
