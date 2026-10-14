import {test,expect} from 'bun:test';
import {JSDOM} from 'jsdom';
import {privateArtifactView} from '../../src/academy/web/privateArtifactView';
import type {PrivateArtifactList} from '../../src/academy/privateArtifactCatalog';

const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('explicit owner download list is inert, encodes selectors and separates unavailable files',async()=>{
 const browser=new JSDOM('<!doctype html><body></body>'),old=globalThis.document;Object.assign(globalThis,{document:browser.window.document});
 try{let calls=0;const data:PrivateArtifactList={state:'ready',sourceIdentity:'unverified_preservation',artifacts:[{id:'synthetic:source',filename:'<img src=x onerror=alert(1)>.json',mime:'application/json',bytes:12,sha256:'1'.repeat(64),studentId:null,availability:'available'},{id:'synthetic:withdrawn',filename:'Synthetic withdrawn.md',mime:'text/plain',bytes:9,sha256:'2'.repeat(64),studentId:null,availability:'withdrawn'}]};const view=privateArtifactView(async()=>{calls++;return data;});document.body.append(view);expect(calls).toBe(0);(view.querySelector('button') as HTMLButtonElement).click();await tick();expect(calls).toBe(1);expect(view.querySelector('img')).toBeNull();expect(view.textContent).toContain('<img src=x onerror=alert(1)>');expect(view.querySelectorAll('a')).toHaveLength(1);expect(view.querySelector('a')!.getAttribute('href')).toBe('/api/private-artifact?id=synthetic%3Asource');expect(view.textContent).toContain('철회된 파일');expect(view.textContent).toContain('학생 연결은 별도 확인');}finally{browser.window.close();if(old===undefined)delete(globalThis as any).document;else globalThis.document=old;}
});
test('a removed owner view cannot receive a late metadata response',async()=>{
 const browser=new JSDOM('<!doctype html><body></body>'),old=globalThis.document;Object.assign(globalThis,{document:browser.window.document});
 try{let finish!:(value:PrivateArtifactList)=>void;const pending=new Promise<PrivateArtifactList>(resolve=>{finish=resolve;});const view=privateArtifactView(()=>pending);document.body.append(view);(view.querySelector('button') as HTMLButtonElement).click();view.remove();finish({state:'ready',sourceIdentity:'unverified_preservation',artifacts:[]});await tick();expect(view.querySelector('ul')!.childElementCount).toBe(0);expect(view.querySelector('[role=status]')!.textContent).toBe('');}finally{browser.window.close();if(old===undefined)delete(globalThis as any).document;else globalThis.document=old;}
});
