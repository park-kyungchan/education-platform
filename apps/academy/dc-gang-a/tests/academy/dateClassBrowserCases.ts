interface BrowserCase { id:string; expected:unknown; actual:unknown; status:'PASS'|'FAIL' }
/** Run ONLY in academy:rehearse. Exercises the actual shipped client/application, not a copied UI. */
export async function runDateClassBrowserCases(){
  if(location.hostname!=='127.0.0.1'||!document.getElementById('synthetic-rehearsal')?.textContent?.startsWith('SYNTHETIC REHEARSAL'))throw Error('synthetic_browser_fixture_required');
  const byId=(id:string)=>document.getElementById(id)!;
  const cases:BrowserCase[]=[];
  const record=(id:string,expected:unknown,actual:unknown,ok:boolean)=>{cases.push({id,expected,actual,status:ok?'PASS':'FAIL'});if(!ok)throw Error('browser_case_failed:'+id);};
  const wait=async(check:()=>boolean)=>{for(let n=0;n<100;n++){if(check())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('synthetic_state_timeout');};
  const ready=()=>byId('scene').textContent!.includes('typed 업무 맥락');
  const rows=()=>Array.from(byId('class-list').querySelectorAll<HTMLButtonElement>('button'));
  const state=()=>({date:(byId('lesson-date') as HTMLInputElement).value,recordKeys:rows().map(row=>row.dataset.recordKey!),classStatus:byId('class-status').textContent!,student:byId('student-title').textContent!,context:byId('occurrence-context').textContent!});
  const date=(value:string)=>{const input=byId('lesson-date') as HTMLInputElement;input.value=value;if(input.value!==value)throw Error('literal_date_not_preserved');input.dispatchEvent(new Event('change',{bubbles:true}));};
  await wait(()=>rows().length===3&&ready());
  let s=state();record('all_observed_occurrences',{date:'2090-01-02',records:['41001','41002','41003'],uniqueStudents:2},s,s.date==='2090-01-02'&&s.recordKeys.slice().sort().join(',')==='41001,41002,41003'&&s.classStatus.includes('학생 2명')&&s.classStatus.includes('완전성 미확인'));
  byId('class-list').querySelector<HTMLButtonElement>('[data-record-key="41002"]')!.click();await wait(()=>byId('student-title').textContent==='Invented Learner B'&&ready());
  s=state();record('literal_N_not_hidden',{student:'Invented Learner B',record:'41002',attendance:'N'},s,s.student==='Invented Learner B'&&s.context.includes('41002')&&s.context.includes('attendanceN'));
  byId('class-list').querySelector<HTMLButtonElement>('[data-record-key="41003"]')!.click();await wait(()=>byId('student-title').textContent==='Invented Learner A'&&ready());
  s=state();record('exact_other_group_selection',{record:'41003',group:'22001',selectedRows:1,joins:'unknown'},s,s.context.includes('22001')&&s.context.includes('41003')&&byId('class-list').querySelectorAll('.selected').length===1&&s.context.includes('모두 연결 미확인'));
  date('2090-01-04');await wait(()=>byId('class-status').textContent!.includes('학생 없음·결석·미수행을 뜻하지 않습니다.'));
  s=state();record('exact_empty_date',{date:'2090-01-04',rowCount:0,registeredStudents:2,studentEvidenceEmpty:true},s,s.date==='2090-01-04'&&s.recordKeys.length===0&&byId('students').children.length===2&&byId('scene').children.length===0);
  date('2090-01-02');await wait(()=>rows().length===3&&ready());
  const verifiedRows=rows().map(row=>row.textContent);
  const control=async(failure:boolean)=>{const response=await fetch('/qa/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({failure})});if(!response.ok)throw Error('synthetic_control_failed');};
  try{
    await control(true);date('2090-01-03');await wait(()=>byId('class-status').textContent!.includes('조회 실패'));
    s=state();record('outage_retains_old_date_and_clocks',{requestedDate:'2090-01-03',retainedDate:'2090-01-02',oldRowsDisabled:true,timestampsUnchanged:true},s,s.date==='2090-01-03'&&s.classStatus.includes('이전 2090-01-02')&&rows().every(row=>row.disabled)&&JSON.stringify(rows().map(row=>row.textContent))===JSON.stringify(verifiedRows));
  }finally{await control(false);}
  date('2090-01-03');await wait(()=>rows().length===1&&ready());
  s=state();record('different_date_occurrence',{date:'2090-01-03',records:['41004']},s,s.date==='2090-01-03'&&s.recordKeys.join(',')==='41004'&&s.context.includes('2090-01-03'));
  const originalFetch=window.fetch;
  try{
    window.fetch=Object.assign(async(...args:Parameters<typeof originalFetch>)=>{const url=String(args[0]);if(url.includes('/api/class?date=2090-01-02')||url.includes('/api/student?id=fixture-screen-student-A'))await new Promise(resolve=>setTimeout(resolve,200));return originalFetch(...args);},{preconnect:originalFetch.preconnect});
    date('2090-01-02');date('2090-01-03');await wait(()=>rows().length===1&&ready());await new Promise(resolve=>setTimeout(resolve,350));
    s=state();record('late_date_response_refused',{date:'2090-01-03',records:['41004']},s,s.date==='2090-01-03'&&s.recordKeys.join(',')==='41004');
    byId('students').querySelector<HTMLButtonElement>('[data-student-id="fixture-screen-student-A"]')!.click();
    byId('students').querySelector<HTMLButtonElement>('[data-student-id="fixture-screen-student-B"]')!.click();
    await wait(()=>byId('student-title').textContent==='Invented Learner B'&&ready());await new Promise(resolve=>setTimeout(resolve,350));
    s=state();record('late_student_response_refused',{student:'Invented Learner B',context:'registered_student_not_lesson_join'},s,s.student==='Invented Learner B'&&s.context.includes('특정 수업·과제와의 연결을 뜻하지 않습니다.'));
  }finally{window.fetch=originalFetch;}
  // The actual shipped app currently refuses unqualified source refresh. Do not
  // fabricate a qualified connection merely to click the fixture's refresh stub.
  const beforeRefresh=state(),refresh=byId('refresh-student') as HTMLButtonElement;
  record('unqualified_source_refresh_is_disabled',{disabled:true,reasonVisible:true},{disabled:refresh.disabled,connection:byId('source-connection').textContent},refresh.disabled&&byId('source-connection').textContent!.includes('직접 HTTP 인증 연결 필요'));
  const refreshRequests=()=>performance.getEntriesByType('resource').filter(row=>new URL(row.name).pathname==='/api/refresh').length;
  const requestsBefore=refreshRequests();refresh.click();await new Promise(resolve=>setTimeout(resolve,80));
  s=state();record('disabled_refresh_preserves_selection_without_request',{student:beforeRefresh.student,date:beforeRefresh.date,context:beforeRefresh.context,additionalRequests:0},s,s.student===beforeRefresh.student&&s.date===beforeRefresh.date&&s.context===beforeRefresh.context&&refreshRequests()===requestsBefore);
  const faces=await Promise.all([document.fonts.load('14px "Noto Sans KR"','수업 준비'),document.fonts.load('24px "Noto Serif KR"','교재의 흐름')]);record('same_origin_korean_fonts',{sans:true,serif:true},{sans:faces[0]!.length>0,serif:faces[1]!.length>0},faces.every(face=>face.length>0));
  date('2090-01-02');await wait(()=>rows().length===3&&ready());
  byId('class-list').scrollIntoView({block:'center'});
  const resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const requestCounts:Record<string,number>={};for(const resource of resources){const path=new URL(resource.name).pathname;if(path.startsWith('/api/'))requestCounts[path]=(requestCounts[path]??0)+1;}
  return {syntheticOnly:true,productionAcceptance:false,cases,total:cases.length,pass:cases.filter(row=>row.status==='PASS').length,actualApiResourceCounts:requestCounts,fontTransferBytes:resources.filter(row=>new URL(row.name).pathname.includes('/assets/noto-')).reduce((sum,row)=>sum+row.encodedBodySize,0),finalState:state(),userTakeover:'not_exercised'};
}
Object.assign(window,{runDateClassBrowserCases});
