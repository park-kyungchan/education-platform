import type {TeacherApplication,ClinicDecisionInput} from '../../src/academy/application';
type Readback={syntheticOnly:boolean;histories:{records:Awaited<ReturnType<TeacherApplication['store']['history']>>}[];officialSaved:boolean;parentSent:boolean};
/** Actual browser DOM + HTTP/PostgreSQL cases, never a WebMCP polyfill or live academy route. */
export async function runTeacherClinicBrowserCases(){
  if(location.hostname!=='127.0.0.1'||!document.getElementById('synthetic-rehearsal')?.textContent?.startsWith('SYNTHETIC REHEARSAL'))throw Error('synthetic_browser_fixture_required');
  const cases:{id:string;status:'PASS';actual:unknown}[]=[],originalFetch=window.fetch,inputs:ClinicDecisionInput[]=[];
  let lastActionHeaders:HeadersInit={};
  const check=(id:string,condition:boolean,actual:unknown)=>{if(!condition)throw Error('clinic_browser_case_failed:'+id);cases.push({id,status:'PASS',actual});};
  const wait=async(fn:()=>boolean)=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('clinic_browser_timeout');};
  const item=()=>document.querySelector<HTMLElement>('[data-clinic-item="assigned-1"]');
  const el=<T extends HTMLElement>(role:string)=>item()!.querySelector<T>('[data-role="'+role+'"]')!;
  const readback=async()=>{const r=await originalFetch('/qa/clinic-readback');if(!r.ok)throw Error('synthetic_clinic_lane_required');const data=await r.json() as Readback;if(!data.syntheticOnly)throw Error('synthetic_readback_required');return data;};
  const date=document.getElementById('lesson-date') as HTMLInputElement;date.value='2090-01-02';date.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>!!item());if((await readback()).histories.length)throw Error('fresh_clinic_fixture_required');
  (item() as HTMLDetailsElement).open=true;
  check('graded_source_does_not_complete_items',item()!.textContent!.includes('교사 판정 미확인')&&item()!.textContent!.includes('정답'),{state:'source_unknown',sourceGrade:'correct'});
  const set=(role:string,value:string)=>{const control=el<HTMLTextAreaElement|HTMLSelectElement>(role);control.value=value;control.dispatchEvent(new Event(role==='note'?'input':'change',{bubbles:true}));};
  set('decision','completed');set('note','Invented native clinic inspection');
  check('completion_requires_explicit_inspection',el<HTMLButtonElement>('save').disabled,{disabled:el<HTMLButtonElement>('save').disabled});
  for(const role of ['written','explanation','confirm']){const control=el<HTMLInputElement>(role);control.checked=true;control.dispatchEvent(new Event('change',{bubbles:true}));}
  el('note').focus();check('actual_keyboard_focus_target',document.activeElement===el('note'),{tag:document.activeElement?.tagName});
  let loseAck=true;
  window.fetch=Object.assign(async(...args:Parameters<typeof originalFetch>)=>{if(String(args[0])==='/api/teacher-clinic'&&args[1]?.method==='POST'){lastActionHeaders=args[1].headers??{};inputs.push(JSON.parse(String(args[1].body)));const result=await originalFetch(...args);if(loseAck){loseAck=false;await result.text();throw Error('synthetic_lost_clinic_ack');}return result;}return originalFetch(...args);},{preconnect:originalFetch.preconnect});
  try{
    el<HTMLButtonElement>('save').click();await wait(()=>el('status').textContent!.includes('확인하지 못했습니다'));
    let stored=await readback();check('lost_ack_committed_once_and_blocks_new_intent',stored.histories.length===1&&stored.histories[0]!.records.length===1&&inputs.length===1&&el<HTMLButtonElement>('save').disabled,{posts:inputs.length,revisionId:stored.histories[0]!.records[0]!.revisionId});
    el<HTMLButtonElement>('recover').click();await wait(()=>item()?.querySelector('summary')?.textContent?.includes('교사 완료')??false);
    stored=await readback();check('exact_readback_without_replaying_post',inputs.length===1&&stored.histories[0]!.records[0]!.idempotencyKey===inputs[0]!.idempotencyKey,{posts:inputs.length});
    (item() as HTMLDetailsElement).open=true;set('decision','reopened');set('note','Invented native repeated correction request');const confirm=el<HTMLInputElement>('confirm');confirm.checked=true;confirm.dispatchEvent(new Event('change',{bubbles:true}));el<HTMLButtonElement>('save').click();
    await wait(()=>item()?.querySelector('summary')?.textContent?.includes('다시 점검')??false);
    stored=await readback();const history=stored.histories[0]!.records;
    check('reopen_appends_exact_teacher_history',history.length===2&&history[1]!.previousRevisionId===history[0]!.revisionId&&history[1]!.idempotencyKey===inputs[1]!.idempotencyKey&&history[1]!.payload.kind==='teacher_clinic_revision'&&history[1]!.payload.decision==='reopened',{sequences:history.map(row=>row.sequence)});
    check('other_item_not_promoted',document.querySelector('[data-clinic-item="assigned-2"] summary')!.textContent!.includes('미확인'),{otherItem:'source_unknown'});
    const denied=await originalFetch('/api/teacher-clinic',{method:'POST',headers:lastActionHeaders,body:JSON.stringify({...inputs[0],studentId:'foreign-fixture',idempotencyKey:'foreign-fixture'})});
    check('foreign_subject_refused',denied.status===403,{status:denied.status});
    check('no_official_effects',stored.officialSaved===false&&stored.parentSent===false,{officialSaved:stored.officialSaved,parentSent:stored.parentSent});
    (item() as HTMLDetailsElement).open=true;item()!.scrollIntoView({block:'start'});
    return {syntheticOnly:true,cases,total:cases.length,pass:cases.length,nativeDom:true,nativeWebMcpAccepted:false,nativeWebMcpApi:typeof (document as Document&{modelContext?:unknown}).modelContext,teacherAcceptance:false,production:false};
  }finally{window.fetch=originalFetch;}
}
Object.assign(window,{runTeacherClinicBrowserCases});
