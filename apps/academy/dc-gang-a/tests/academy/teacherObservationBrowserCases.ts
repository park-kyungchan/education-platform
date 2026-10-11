import type {TeacherApplication} from '../../src/academy/application';
type Readback={syntheticOnly:boolean;observationPostCount:number;histories:{records:Awaited<ReturnType<TeacherApplication['store']['history']>>}[];officialSaved:boolean;parentSent:boolean};
type Input={idempotencyKey:string;text:string;expectedRevisionId:string|null;basisRevisionId:string};
/** Only the existing owned rehearsal's opt-in scratch PostgreSQL lane. Never an academy acquisition route. */
export async function runTeacherObservationBrowserCases(){
 if(location.hostname!=='127.0.0.1'||!document.getElementById('synthetic-rehearsal')?.textContent?.startsWith('SYNTHETIC REHEARSAL'))throw Error('synthetic_browser_fixture_required');
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 const wait=async(check:()=>boolean)=>{for(let n=0;n<150;n++){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('synthetic_observation_timeout');};
 const cases:{id:string;status:'PASS'|'FAIL';actual:unknown}[]=[];
 const record=(id:string,ok:boolean,actual:unknown)=>{cases.push({id,status:ok?'PASS':'FAIL',actual});if(!ok)throw Error('observation_browser_case_failed:'+id);};
 const originalFetch=window.fetch,inputs:Input[]=[];
 const readback=async()=>{const response=await originalFetch('/qa/observation-readback');if(!response.ok)throw Error('synthetic_observation_lane_required');const data=await response.json() as Readback;if(data.syntheticOnly!==true)throw Error('synthetic_readback_required');return data;};
 const setText=(value:string)=>{const field=el<HTMLTextAreaElement>('teacher-observation-text');field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));};
 const selected=(key:string)=>el('occurrence-context').textContent!.includes('record '+key)&&!!el('teacher-observation-text');
 await wait(()=>!!el('class-list').querySelector('[data-record-key="41001"]'));
 el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41001"]')!.click();await wait(()=>selected('41001'));
 if((await readback()).histories.length)throw Error('fresh_synthetic_observation_fixture_required');
 let loseAck=true,holdPost=false,holdRecovery=false,loseAfterHold=false,holdBeforePost=false,holdStudent=false,releasePost:(()=>void)|null=null,releaseRecovery:(()=>void)|null=null,releaseBeforePost:(()=>void)|null=null,releaseStudent:(()=>void)|null=null;
 window.fetch=Object.assign(async(...args:Parameters<typeof originalFetch>)=>{
  const path=String(args[0]),options=args[1];
  if(path==='/api/teacher-observation'&&options?.method==='POST'){
   inputs.push(JSON.parse(String(options.body)) as Input);
   if(holdBeforePost){holdBeforePost=false;await new Promise<void>(resolve=>{releaseBeforePost=resolve;});}
   const response=await originalFetch(...args);
   if(loseAck){loseAck=false;await response.text();throw Error('synthetic_lost_acknowledgement');}
   if(holdPost){holdPost=false;await new Promise<void>(resolve=>{releasePost=resolve;});if(loseAfterHold){loseAfterHold=false;await response.text();throw Error('synthetic_remount_lost_acknowledgement');}}
   return response;
  }
  const response=await originalFetch(...args);
  if(path.startsWith('/api/student?')&&holdStudent){holdStudent=false;await new Promise<void>(resolve=>{releaseStudent=resolve;});}
  if(path.startsWith('/api/teacher-observation-result?')&&holdRecovery){holdRecovery=false;await new Promise<void>(resolve=>{releaseRecovery=resolve;});}
  return response;
 },{preconnect:originalFetch.preconnect});
 try{
  setText('Invented native browser original');el('teacher-observation-save').click();
  await wait(()=>el('teacher-observation-status').textContent!.includes('확인하지 못했습니다'));
  let persisted=await readback(),history=persisted.histories[0]!.records;
  record('lost_acknowledgement_retains_exact_request',inputs.length===1&&persisted.observationPostCount===1&&history.length===1&&history[0]!.idempotencyKey===inputs[0]!.idempotencyKey&&el<HTMLTextAreaElement>('teacher-observation-text').value===inputs[0]!.text&&el<HTMLButtonElement>('teacher-observation-save').disabled,{posts:persisted.observationPostCount,revisionId:history[0]!.revisionId});
  el('teacher-observation-recover').click();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));
  persisted=await readback();record('recovery_without_duplicate_post',inputs.length===1&&persisted.observationPostCount===1&&persisted.histories[0]!.records.length===1,{posts:persisted.observationPostCount});
  setText('Invented native browser correction');el('teacher-observation-save').click();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인')&&inputs.length===2);
  persisted=await readback();history=persisted.histories[0]!.records;
  record('append_only_correction',history.length===2&&history[1]!.previousRevisionId===history[0]!.revisionId&&history.every((v,index)=>v.payload.kind==='teacher_observation'&&v.payload.text===inputs[index]!.text&&v.idempotencyKey===inputs[index]!.idempotencyKey),{sequence:history.map(v=>v.sequence),posts:persisted.observationPostCount});
  setText('Invented unsaved occurrence draft');el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41003"]')!.click();await wait(()=>selected('41003'));
  const otherEmpty=el<HTMLTextAreaElement>('teacher-observation-text').value==='';
  el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41001"]')!.click();await wait(()=>selected('41001'));
  record('occurrence_scoped_draft',otherEmpty&&el<HTMLTextAreaElement>('teacher-observation-text').value==='Invented unsaved occurrence draft'&&inputs.length===2,{otherOccurrenceEmpty:otherEmpty,posts:inputs.length});
  holdPost=true;holdRecovery=true;setText('Invented ordered original');el('teacher-observation-save').click();await wait(()=>releasePost!==null);
  el('teacher-observation-recover').click();await wait(()=>releaseRecovery!==null);
  releasePost!();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));
  setText('Invented ordered newer correction');el('teacher-observation-save').click();await wait(()=>inputs.length===4&&el('teacher-observation-status').textContent!.includes('저장 확인'));
  const newerStatus=el('teacher-observation-status').textContent;releaseRecovery!();await new Promise(resolve=>setTimeout(resolve,30));
  record('late_recovery_cannot_regress_confirmation',el('teacher-observation-status').textContent===newerStatus&&el<HTMLTextAreaElement>('teacher-observation-text').value===inputs[3]!.text,{status:el('teacher-observation-status').textContent});
  persisted=await readback();history=persisted.histories[0]!.records;
  record('exact_persisted_history_and_effect_boundary',persisted.histories.length===1&&history.length===4&&persisted.observationPostCount===4&&history.every((v,index)=>v.payload.kind==='teacher_observation'&&v.payload.text===inputs[index]!.text&&v.idempotencyKey===inputs[index]!.idempotencyKey&&v.previousRevisionId===inputs[index]!.expectedRevisionId&&v.payload.basisRevisionId===inputs[index]!.basisRevisionId)&&persisted.officialSaved===false&&persisted.parentSent===false&&document.body.textContent!.includes('공식 기록 저장·승인·부모 전송이 아닙니다'),{historyCount:history.length,posts:persisted.observationPostCount,officialSaved:persisted.officialSaved,parentSent:persisted.parentSent});
  for(const uncertain of [false,true]){
   holdPost=true;loseAfterHold=uncertain;releasePost=null;
   setText(uncertain?'Invented remounted uncertain draft':'Invented remounted confirmed draft');el('teacher-observation-save').click();await wait(()=>releasePost!==null);
   el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41003"]')!.click();await wait(()=>selected('41003'));
   el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41001"]')!.click();await wait(()=>selected('41001'));
   releasePost!();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인')||(uncertain&&el('teacher-observation-status').textContent!.includes('확인하지 못했습니다')));
   // A fresh authenticated scene may already carry the exact committed original before the held acknowledgement arrives.
   if(uncertain&&!el('teacher-observation-status').textContent!.includes('저장 확인')){el('teacher-observation-recover').click();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));}
   record(uncertain?'remounted_lost_acknowledgement_recovers_original':'remounted_pending_confirmation_updates_active_editor',!el<HTMLTextAreaElement>('teacher-observation-text').readOnly&&!el<HTMLButtonElement>('teacher-observation-save').disabled&&el<HTMLTextAreaElement>('teacher-observation-text').value===inputs.at(-1)!.text,{posts:inputs.length,recoveredWithoutRetry:uncertain});
  }
  const maximal='가'.repeat(16000);setText(maximal);el('teacher-observation-save').click();await wait(()=>el('teacher-observation-status').textContent!.includes('저장 확인'));
  persisted=await readback();history=persisted.histories[0]!.records;
  record('maximal_korean_observation_is_exactly_persisted',history.at(-1)!.payload.kind==='teacher_observation'&&(history.at(-1)!.payload as {text:string}).text===maximal&&history.length===7&&persisted.observationPostCount===7&&history.every((v,index)=>v.idempotencyKey===inputs[index]!.idempotencyKey&&v.previousRevisionId===inputs[index]!.expectedRevisionId)&&persisted.officialSaved===false&&persisted.parentSent===false,{characters:maximal.length,historyCount:history.length,posts:persisted.observationPostCount});
  holdBeforePost=true;releaseBeforePost=null;setText('Invented precommit snapshot original');el('teacher-observation-save').click();await wait(()=>releaseBeforePost!==null);
  el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41003"]')!.click();await wait(()=>selected('41003')&&el<HTMLTextAreaElement>('teacher-observation-text').value==='');
  holdStudent=true;releaseStudent=null;el('class-list').querySelector<HTMLButtonElement>('[data-record-key="41001"]')!.click();await wait(()=>releaseStudent!==null);
  releaseBeforePost!();await wait(()=>inputs.length===8);
  for(let n=0;n<150;n++){persisted=await readback();if(persisted.histories[0]!.records.length===8)break;await new Promise(resolve=>setTimeout(resolve,20));}
  await new Promise(resolve=>setTimeout(resolve,30));releaseStudent!();await wait(()=>selected('41001')&&el<HTMLTextAreaElement>('teacher-observation-text').value===inputs[7]!.text&&el('teacher-observation-status').textContent!.includes('저장 확인'));
  const confirmed=persisted.histories[0]!.records.at(-1)!;
  setText('Invented correction after delayed precommit scene');el('teacher-observation-save').click();await wait(()=>inputs.length===9&&el('teacher-observation-status').textContent!.includes('저장 확인'));
  persisted=await readback();history=persisted.histories[0]!.records;
  record('precommit_scene_cannot_regress_confirmed_head',inputs[8]!.expectedRevisionId===confirmed.revisionId&&history.length===9&&history.every((v,index)=>v.idempotencyKey===inputs[index]!.idempotencyKey&&v.previousRevisionId===inputs[index]!.expectedRevisionId)&&persisted.officialSaved===false&&persisted.parentSent===false,{historyCount:history.length,posts:persisted.observationPostCount});
  el('teacher-observation-text').scrollIntoView?.({block:'center'});
  return {syntheticOnly:true,productionAcceptance:false,cases,total:cases.length,pass:cases.filter(v=>v.status==='PASS').length,persistedHistoryCount:history.length,observationPostCount:persisted.observationPostCount,nativeWebMcpAccepted:false,teacherAcceptance:false};
 }finally{window.fetch=originalFetch;(releasePost as (()=>void)|null)?.();(releaseRecovery as (()=>void)|null)?.();(releaseBeforePost as (()=>void)|null)?.();(releaseStudent as (()=>void)|null)?.();}
}
Object.assign(window,{runTeacherObservationBrowserCases});
