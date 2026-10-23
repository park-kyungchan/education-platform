import {makeSnapshot,makeWorkflow,makeToday,SYNTHETIC_NOTICE} from './fixture.ts';
const calls:any[]=[],blocked:any[]=[],errors:any[]=[],clicks:any[]=[];let failNext:number|null=null;
const qa:any={fixtureOnly:true,nativeIdentityVerified:false,nativeWebMcpVerified:false,externalRequests:0,calls,blocked,errors,notice:SYNTHETIC_NOTICE,failNext:(status=401)=>{failNext=status;}};
Object.defineProperty(window,'SYNTHETIC_QA',{value:qa});
// Do not register synthetic callbacks into a real native browser tool registry.
Object.defineProperty(document,'modelContext',{value:undefined,configurable:false});
window.fetch=async (url:any,options:any={})=>{
 const path=typeof url==='string'?url:'';
 if(!['/api/init','/api/student-snapshot','/api/academy/work-context','/api/academy/today'].includes(path)||options.method!=='POST'||options.credentials!=='same-origin'||options.redirect!=='manual'){blocked.push({kind:'fetch',path});throw Error('synthetic_fixture_network_blocked');}
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 const payload=JSON.parse(options.body??'{}');calls.push({path,payload,fixtureOnly:true});
 if(failNext){const status=failNext;failNext=null;return Response.json({status:'synthetic_forced_failure'},{status});}
 const result=path==='/api/init'?makeSnapshot():path==='/api/student-snapshot'?makeSnapshot(payload.studentId):path==='/api/academy/work-context'?{status:'success',result:makeWorkflow(payload)}:makeToday(payload);
 return Response.json(result);
};
// These APIs are never needed by the production renderer. Fail closed in this harness.
for(const name of ['XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker'] as const){Object.defineProperty(window,name,{value:class {constructor(){blocked.push({kind:name});throw Error('synthetic_fixture_network_blocked');}},configurable:false});}
Object.defineProperty(window,'open',{value:()=>{blocked.push({kind:'window.open'});return null;}});
try{Object.defineProperty(navigator,'sendBeacon',{value:()=>{blocked.push({kind:'sendBeacon'});return false;}});}catch{}
document.addEventListener('click',event=>{const target=event.target as Element;const button=target?.closest('button');if(button)clicks.push({label:button.textContent,studentId:button.getAttribute('data-student-id'),inShell:!!button.closest('#app-shell'),defaultPrevented:event.defaultPrevented,trusted:event.isTrusted});const link=(event.target as Element)?.closest('a');if(link&&!link.getAttribute('href')?.startsWith('#')){event.preventDefault();blocked.push({kind:'source_link',href:link.getAttribute('href')});}},true);
document.addEventListener('submit',event=>{event.preventDefault();blocked.push({kind:'submit'});},true);
window.addEventListener('error',event=>errors.push(String(event.error??event.message)));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
qa.dimensions=()=>({innerWidth:window.innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,desktop:document.body.classList.contains('desktop-academy'),recordCount:document.querySelectorAll('[data-record-id]').length,books:document.querySelectorAll('.book').length,student:document.querySelector('[data-student-id][aria-pressed="true"]')?.textContent,errors:[...errors],lastClicks:clicks.slice(-4),studentNavUnderShell:!!document.querySelector('#app-shell .student-nav'),lastCalls:calls.slice(-4).map(c=>({path:c.path,studentId:c.payload.studentId})),loadErrors:[...document.querySelectorAll('.load-error')].map(n=>n.textContent),overflowElements:[...document.body.querySelectorAll('*')].map((node:any)=>({node:node.tagName.toLowerCase()+(node.className?' .'+String(node.className).replace(/ /g,'.'):''),left:Math.round(node.getBoundingClientRect().left),right:Math.round(node.getBoundingClientRect().right)})).filter(n=>n.left < -1 || n.right > document.documentElement.clientWidth+1).slice(0,8)});
