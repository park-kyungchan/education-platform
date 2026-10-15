import type {ArchivedJson,PreservedHistoryIndex,PreservedHistoryPage,PreservedHistoryDetail,PreservedSelection} from '../contracts/preservedHistory';

/** Preserved text is rendered as inert text. This workspace has no teacher-save action. */
export function preservedHistoryView(read:<T>(path:string)=>Promise<T>){
 const node=<T extends keyof HTMLElementTagNameMap>(tag:T,text='')=>{const value=document.createElement(tag);value.textContent=text;return value;};
 const section=node('section');section.id='preserved-history-workspace';section.className='card';
 const title=node('h2','과거 보존 이력'),explanation=node('p','이 archive의 학생·원문·정정 참조는 보존된 주장입니다. 현재 학원 학생과의 동일성, 최신성, 확정 교사 판단은 확인되지 않았습니다. 이름으로 현재 학생에 연결하지 않습니다.');
 const open=node('button','보존 이력 확인');open.type='button';const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const controls=node('div'),rows=node('div'),details=node('div'),artifacts=node('details'),artifactTitle=node('summary','보존 원천 파일');artifacts.append(artifactTitle);
 section.append(title,explanation,open,status,controls,rows,details,artifacts);
 let index:PreservedHistoryIndex|null=null,selection:PreservedSelection|null=null,epoch=0,detailEpoch=0,nextCursor:string|null=null;
 const active=(ticket:number)=>section.isConnected&&!section.closest('[hidden]')&&ticket===epoch;
 const query=(selected:PreservedSelection)=>new URLSearchParams({namespace:selected.namespace,scope:selected.scope,...(selected.scope==='student'?{studentId:selected.studentId!}:{}),snapshot:index!.snapshotSha256});
 const sourceLink=(id:string,label:string)=>{const link=node('a',label);link.href='/api/preserved-history-artifact?'+new URLSearchParams({id,snapshot:index!.snapshotSha256});link.setAttribute('download','');return link;};
 const textJson=(value:ArchivedJson|object)=>{const pre=node('pre',JSON.stringify(value,null,2));pre.style.whiteSpace='pre-wrap';pre.style.maxHeight='40rem';pre.style.overflow='auto';return pre;};
 const showDetail=async(id:string)=>{
  if(!selection||!index)return;const ticket=epoch,detailTicket=++detailEpoch,chosen={...selection},q=query(chosen);q.set('recordId',id);details.replaceChildren(node('p','보존 원문 조회 중…'));
  try{
   const value=await read<PreservedHistoryDetail>('/api/preserved-history-record?'+q);if(!active(ticket)||detailTicket!==detailEpoch)return;
   if(value.snapshotSha256!==index.snapshotSha256||value.record.id!==id||value.record.studentId!==(chosen.scope==='owner'?null:chosen.studentId))throw Error('archive_detail_scope_changed');
   const record=value.record;details.replaceChildren(node('h3','보존 record · '+record.id),node('p','정정·철회·충돌 참조는 원형대로 표시하며, 현재 사실이나 전체 record 무효화로 적용하지 않습니다.'));
   for(const kind of ['supersedes','retracts','conflicts'] as const)for(const reference of record[kind]){const button=node('button',kind+' 참조 · '+reference);button.type='button';button.addEventListener('click',()=>void showDetail(reference));details.append(button);}
   if(record.data&&typeof record.data==='object'&&!Array.isArray(record.data)){
    const sourcePage=record.data.sourcePageRecordId;
    if(typeof sourcePage==='string'){const button=node('button','원천 page 보존 record · '+sourcePage);button.type='button';button.addEventListener('click',()=>void showDetail(sourcePage));details.append(button);}
    const sourceFile=record.data.sourceFile;
    if(typeof sourceFile==='string'){const matches=index.artifacts.filter(artifact=>artifact.archivePath==='sources/'+sourceFile);if(matches.length===1&&matches[0]!.availability==='available')details.append(sourceLink(matches[0]!.id,'원천 파일 원문 내려받기'));}
   }
   const provenance=node('details'),provenanceTitle=node('summary','원본 provenance와 시각·범위·완전성');provenance.append(provenanceTitle,textJson(record.provenance));
   const raw=node('details'),rawTitle=node('summary','원본 record 전체 · raw JSON 및 correction 참조');raw.open=true;raw.append(rawTitle,textJson(record));details.append(provenance,raw);
  }catch{if(active(ticket)&&detailTicket===detailEpoch)details.replaceChildren(node('p','이 범위의 보존 원문을 확인하지 못했습니다. 학생 연결이나 정정 의미를 추정하지 않습니다.'));}
 };
 const showPage=async(cursor:string|null)=>{
  if(!selection||!index)return;const ticket=++epoch,q=query(selection);if(cursor)q.set('cursor',cursor);rows.replaceChildren();details.replaceChildren();status.textContent='선택 archive 범위 조회 중…';
  try{
   const value=await read<PreservedHistoryPage>('/api/preserved-history-records?'+q);if(!active(ticket))return;
   if(value.snapshotSha256!==index.snapshotSha256||JSON.stringify(value.selection)!==JSON.stringify(selection))throw Error('archive_snapshot_changed');
   nextCursor=value.nextCursor;status.textContent='이 보존 범위 '+value.total+'건 중 이번 page '+value.records.length+'건 · 원본 배열 순서 · 최신순 또는 원천 전체 목록을 뜻하지 않습니다.';
   for(const record of value.records){const row=node('article'),button=node('button',record.kind+' · '+record.id);button.type='button';button.addEventListener('click',()=>void showDetail(record.id));row.append(button,node('p',record.domain+' · '+String(record.verification)+' / '+String(record.completeness)+' · 기록 '+String(record.recordedAt)+' · 원래 시각 '+String(record.originalTimeLabel??'unknown')));if(record.supersedes.length||record.retracts.length||record.conflicts.length)row.append(node('p','보존 관계: supersedes '+record.supersedes.length+' · retracts '+record.retracts.length+' · conflicts '+record.conflicts.length+' · 자동 적용 없음'));rows.append(row);}
   if(nextCursor){const next=node('button','다음 보존 page');next.type='button';next.addEventListener('click',()=>void showPage(nextCursor));rows.append(next);}
   else rows.append(node('p','이 saved scope의 마지막 page입니다. 원천 전체 이력의 완전성은 미확인입니다.'));
  }catch{if(active(ticket))status.textContent='보존 범위를 확인하지 못했습니다. Snapshot이 바뀐 경우 보존 이력 확인부터 다시 시작하세요.';}
 };
 open.addEventListener('click',async()=>{
  const ticket=++epoch;open.disabled=true;controls.replaceChildren();rows.replaceChildren();details.replaceChildren();artifacts.replaceChildren(artifactTitle);index=null;selection=null;status.textContent='보존 archive 조회 중…';
  try{
   const value=await read<PreservedHistoryIndex>('/api/preserved-history');if(!active(ticket))return;index=value;
   const label=node('label','과거 보존 범위 '),choose=node('select');choose.setAttribute('aria-label','과거 보존 범위');const global=node('option','Owner-global 보존 record');global.value='';choose.append(global);
   for(const student of value.students){const option=node('option','Archived · '+student.displayName+' · '+student.id);option.value=student.id;choose.append(option);}
   label.append(choose);const dataset=node('a','Dataset 원문 내려받기');dataset.href=value.datasetDownload;dataset.setAttribute('download','portable-dataset.json');controls.append(label,dataset,node('p','Archive '+value.datasetId+' · '+value.createdAt+' · snapshot '+value.snapshotSha256+' · projection '+value.projectionCount+'개도 현재 사실로 적용하지 않습니다.'));
   for(const artifact of value.artifacts){const row=node('p',artifact.id+' · '+artifact.filename+' · '+artifact.availability+' ');if(artifact.availability==='available')row.append(sourceLink(artifact.id,'원문 확인·내려받기'));else row.append(node('span','원문 download 보류'));artifacts.append(row);}
   const select=()=>{selection={namespace:value.namespace,scope:choose.value?'student':'owner',...(choose.value?{studentId:choose.value}:{})};void showPage(null);};choose.addEventListener('change',select);select();
  }catch{if(active(ticket))status.textContent='보존 archive 연결을 확인해야 합니다. 현재 학생 근거와 원문 파일은 변경하지 않았습니다.';}
  finally{open.disabled=false;}
 });
 return section;
}
