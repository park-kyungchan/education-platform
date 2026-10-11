import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {randomUUID} from 'node:crypto';
import {observationEditor} from '../../src/academy/web/teacherObservationEditor';
import type {TeacherApplication} from '../../src/academy/application';
import type {DateClassRow} from '../../src/academy/web/dateClassView';
type Scene=Awaited<ReturnType<TeacherApplication['student']>>;
type Input={studentId:string;occurrence:DateClassRow['occurrence'];basisRevisionId:string;expectedRevisionId:string|null;idempotencyKey:string;reportedAt:string;text:string};
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const flush=()=>Bun.sleep(0);
function fixture(){
 const dom=new JSDOM('<!doctype html><body></body>'),previous=globalThis.document;globalThis.document=dom.window.document;
 const studentId='fixture-editor-'+randomUUID(),occurrence={date:'2090-01-02',groupId:'21001',courseKey:'99001',recordKey:'41001',membershipKey:'81001'};
 const row={studentId,occurrence,revisionId:'fixture-source'} as DateClassRow;
 const teacherScope={ownerId:'fixture-editor-owner',actorId:'fixture-editor-teacher'};
 const scene={student:{id:studentId},teacherScope,preparation:{date:occurrence.date},evidence:[{revisionId:row.revisionId,payload:{kind:'source_audit'}}]} as Scene;
 const receipt=(input:Input,id:string,overrides:Record<string,unknown>={})=>({revisionId:id,officialSaved:false,parentSent:false,record:{...teacherScope,studentId,revisionId:id,sequence:input.expectedRevisionId===null?1:2,idempotencyKey:input.idempotencyKey,previousRevisionId:input.expectedRevisionId,payload:{kind:'teacher_observation',text:input.text,basisRevisionId:input.basisRevisionId,reportedAt:input.reportedAt,occurrence},...overrides}});
 let mountController:AbortController|null=null;
 const mount=(read:(path:string)=>Promise<unknown>,write:(path:string,input:Input)=>Promise<unknown>,value=scene)=>{mountController?.abort();mountController=new AbortController();dom.window.document.body.replaceChildren(observationEditor(value,row,read as never,write as never,mountController.signal));};
 const el=<T extends HTMLElement>(id:string)=>dom.window.document.getElementById('teacher-observation-'+id) as T;
 const click=(id:string)=>el(id).dispatchEvent(new dom.window.Event('click',{bubbles:true}));
 const text=(value:string)=>{el<HTMLTextAreaElement>('text').value=value;el('text').dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 return {row,scene,receipt,mount,el,click,text,close:()=>{mountController?.abort();globalThis.document=previous;dom.window.close();}};
}
describe('observation editor request ordering',()=>{
 test('actor-scoped unsaved originals are never transferred to another authenticated scene',()=>{
  const f=fixture(),read=async()=>{throw Error('unused');},write=async()=>{throw Error('unused');};
  try{
   f.mount(read,write);f.text('Invented private actor A draft');
   f.mount(read,write,{...f.scene,teacherScope:{...f.scene.teacherScope,actorId:'fixture-actor-B'}});
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('');
   f.mount(read,write,f.scene);expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented private actor A draft');
  }finally{f.close();}
 });
 test('a precommit scene snapshot cannot erase a newer confirmed observation or its predecessor',async()=>{
  const f=fixture();let input!:Input;
  const read=async()=>{throw Error('unused');},write=async(_path:string,value:Input)=>{input=value;return f.receipt(value,value.expectedRevisionId===null?'fixture-confirmed-r1':'fixture-confirmed-r2');};
  try{
   f.mount(read,write);f.text('Invented confirmed original');f.click('save');await flush();
   f.mount(read,write,f.scene);
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented confirmed original');expect(f.el('status').textContent).toContain('fixture-confirmed-r1');
   f.text('Invented next correction');f.click('save');await flush();expect(input.expectedRevisionId).toBe('fixture-confirmed-r1');
  }finally{f.close();}
 });
 test('a known pre-write oversized refusal retains an editable draft without requiring uncertain recovery',async()=>{
  const f=fixture();let posts=0,reads=0;
  try{
   f.mount(async()=>{reads++;throw Error('unused');},async(_path,input)=>{posts++;if(posts===1)throw Error('input_too_large');return f.receipt(input,'fixture-shortened');});
   f.text('Invented oversized original');f.click('save');await flush();
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented oversized original');
   expect(f.el<HTMLTextAreaElement>('text').readOnly).toBe(false);expect(f.el<HTMLButtonElement>('save').disabled).toBe(false);
   expect(f.el<HTMLButtonElement>('recover').hidden).toBe(true);expect(reads).toBe(0);
   f.text('Invented shortened original');f.click('save');await flush();expect(posts).toBe(2);expect(f.el('status').textContent).toContain('fixture-shortened');
  }finally{f.close();}
 });
 for(const completion of ['saved','uncertain'] as const)test('a remounted pending editor receives its original '+completion+' completion',async()=>{
  const f=fixture(),pending=deferred<unknown>();let input!:Input,reads=0;
  const read=async()=>{reads++;throw Error('observation_result_not_found');},write=async(_path:string,value:Input)=>{input=value;return pending.promise;};
  try{
   f.mount(read,write);f.text('Invented pending draft');f.click('save');
   const removed=f.el<HTMLTextAreaElement>('text');f.mount(read,write);
   expect(f.el<HTMLTextAreaElement>('text')).not.toBe(removed);
   if(completion==='saved')pending.resolve(f.receipt(input,'fixture-remount-confirmed'));else pending.reject(Error('transport_uncertain'));
   await flush();
   expect(f.el('status').textContent).toContain(completion==='saved'?'fixture-remount-confirmed':'저장 응답을 확인하지 못했습니다');
   expect(f.el<HTMLTextAreaElement>('text').readOnly).toBe(completion!=='saved');
   expect(f.el<HTMLButtonElement>('save').disabled).toBe(completion!=='saved');
   if(completion==='uncertain'){f.click('recover');await flush();expect(reads).toBe(1);expect(f.el<HTMLButtonElement>('retry').hidden).toBe(false);}
  }finally{f.close();}
 });
 test('a delayed original recovery cannot replace a newer correction confirmation',async()=>{
  const f=fixture(),first=deferred<unknown>(),recovery=deferred<unknown>();let original!:Input,posts=0;
  try{
   f.mount(()=>recovery.promise,async(_path,input)=>{posts++;if(posts===1){original=input;return first.promise;}return f.receipt(input,'fixture-r2');});
   f.text('Invented original');f.click('save');f.click('recover');
   first.resolve(f.receipt(original,'fixture-r1'));await flush();
   f.text('Invented correction');f.click('save');await flush();
   expect(f.el('status').textContent).toContain('fixture-r2');
   recovery.resolve(f.receipt(original,'fixture-r1'));await flush();
   expect(f.el('status').textContent).toContain('fixture-r2');
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented correction');expect(posts).toBe(2);
  }finally{f.close();}
 });
 test('a dirty draft does not silently adopt an intervening observation head',async()=>{
  const f=fixture();let posts=0,submitted:Input|null=null;
  try{
   let fresh=f.scene;
   const read=async(path:string)=>path.startsWith('/api/class?')?{kind:'date_class_preparation',date:f.row.occurrence.date,rowCount:1,rows:[f.row]}:fresh;
   const write=async(_path:string,input:Input)=>{posts++;submitted=input;return f.receipt(input,'fixture-new');};
   f.mount(read,write);f.text('Invented local unsaved draft');
   const changed={...f.scene,evidence:[...f.scene.evidence,{studentId:f.scene.student.id,revisionId:'fixture-peer-r2',sequence:2,payload:{kind:'teacher_observation',occurrence:f.row.occurrence,text:'Invented intervening correction'}}]} as Scene;fresh=changed;
   f.mount(read,write,changed);
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented local unsaved draft');
   expect(f.el<HTMLButtonElement>('save').disabled).toBe(true);
   f.click('save');await flush();expect(posts).toBe(0);
   expect(f.el('status').textContent).toContain('변경');
   f.click('reconcile');expect(f.el<HTMLButtonElement>('save').disabled).toBe(true);await flush();expect(f.el<HTMLButtonElement>('save').disabled).toBe(false);expect(posts).toBe(0);
   f.click('save');await flush();expect(posts).toBe(1);
   expect((submitted as Input|null)?.expectedRevisionId).toBe('fixture-peer-r2');
   expect((submitted as Input|null)?.text).toBe('Invented local unsaved draft');
  }finally{f.close();}
 });
 test('refreshes a clean draft from the current observation instead of keeping stale text',()=>{
  const f=fixture();
  try{
   const read=async()=>{throw Error('unused');},write=async()=>{throw Error('unused');};f.mount(read,write);
   const changed={...f.scene,evidence:[...f.scene.evidence,{revisionId:'fixture-peer-current',sequence:1,payload:{kind:'teacher_observation',occurrence:f.row.occurrence,text:'Invented current observation'}}]} as Scene;
   f.mount(read,write,changed);expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented current observation');expect(f.el<HTMLButtonElement>('save').disabled).toBe(false);
  }finally{f.close();}
 });
 for(const mismatch of [{idempotencyKey:'fixture-wrong-request'},{previousRevisionId:'fixture-wrong-predecessor'},{actorId:'fixture-other-actor'},{ownerId:'fixture-other-owner'}])test('rejects an otherwise matching receipt with '+Object.keys(mismatch)[0],async()=>{
  const f=fixture();
  try{
   f.mount(async()=>{throw Error('unused');},async(_path,input)=>f.receipt(input,'fixture-untrusted',mismatch));
   f.text('Invented exact request');f.click('save');await flush();
   expect(f.el('status').textContent).toContain('저장 응답을 확인하지 못했습니다');
   expect(f.el<HTMLButtonElement>('save').disabled).toBe(true);
   expect(f.el<HTMLTextAreaElement>('text').value).toBe('Invented exact request');
  }finally{f.close();}
 });
});
