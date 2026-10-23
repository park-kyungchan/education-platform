/** Portable HTTP smoke check. Does not replace browser rendering QA. */
import { moduleRoot } from './agent-platform';
const port=Number(process.env.TEST_PORT||4282),base=`http://127.0.0.1:${port}`;
const server=Bun.spawn([process.execPath,'scripts/serve.ts'],{cwd:moduleRoot,env:{...process.env,HOST:'127.0.0.1',PORT:String(port)},stdout:'pipe',stderr:'pipe'});
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
try{
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await Bun.sleep(100);}if(!ready)throw Error('Server did not start');
 const home=await fetch(base);const html=await home.text();assert(home.status===200&&html.includes('lang="ko"'),'Korean HTML entry');assert(home.headers.get('Content-Security-Policy')?.includes("connect-src 'none'"),'No backend connectivity policy');
 const js=await fetch(base+'/main.js');assert(js.ok&&(await js.text()).length>1000,'Production JS served');
 const css=await fetch(base+'/main.css');assert(css.ok&&(await css.text()).includes('@font-face'),'Bundled font/CSS served');
 assert((await fetch(base+'/source/archive/README.md')).status===404,'Source files not served');
 assert((await fetch(base+'/package.json')).status===404,'Package metadata not served');
 assert((await fetch(base+'/..%2fpackage.json')).status===403,'Encoded traversal blocked');
 assert((await fetch(base,{method:'POST'})).status===405,'Mutation methods blocked');
 const head=await fetch(base+'/main.js',{method:'HEAD'});assert(head.ok&&(await head.text())==='','HEAD response');
 console.log('PASS HTTP smoke: Korean HTML, JS/CSS/font, security headers, 404 private source, traversal/method guards, HEAD. Browser rendering remains a separate check.');
}finally{server.kill();await server.exited;}
