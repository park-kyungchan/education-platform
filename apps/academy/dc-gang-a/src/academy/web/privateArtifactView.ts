import type {PrivateArtifactList} from '../privateArtifactCatalog';

/** The existing authenticated page downloads raw preserved files as attachments. */
export function privateArtifactView(read:()=>Promise<PrivateArtifactList>){
 const section=document.createElement('section');section.id='private-artifact-workspace';section.className='card';
 const title=document.createElement('h2');title.textContent='보존 자료';
 const explanation=document.createElement('p');explanation.className='muted';explanation.textContent='보존된 원문 파일을 내려받습니다. 현재 학생 정보나 확정된 교사 판단으로 대체하지 않습니다.';
 const button=document.createElement('button');button.type='button';button.textContent='자료 목록 확인';
 const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const list=document.createElement('ul');section.append(title,explanation,button,status,list);
 button.addEventListener('click',async()=>{
  button.disabled=true;
  try{
   const result=await read();if(!section.isConnected)return;list.replaceChildren();
   if(result.state!=='ready'){status.textContent='보존 자료 연결을 확인해야 합니다.';return;}
   status.textContent=result.artifacts.length?'보존 파일 '+result.artifacts.length+'개 · 학생 연결은 별도 확인이 필요합니다.':'연결된 보존 파일이 없습니다.';
   for(const artifact of result.artifacts){
    const row=document.createElement('li'),name=document.createElement('span');name.textContent=artifact.filename+' · '+artifact.bytes.toLocaleString('ko-KR')+' bytes';row.append(name);
    if(artifact.availability==='available'){
     const download=document.createElement('a');download.href='/api/private-artifact?id='+encodeURIComponent(artifact.id);download.textContent=' 원문 내려받기';download.setAttribute('download',artifact.filename);row.append(download);
    }else{const unavailable=document.createElement('span');unavailable.textContent=artifact.availability==='withdrawn'?' · 철회된 파일':artifact.availability==='missing'?' · 원문 없음':' · 파일 확인 필요';row.append(unavailable);}
    list.append(row);
   }
  }catch{if(section.isConnected)status.textContent='보존 자료를 확인하지 못했습니다. 기존 원문은 유지됩니다.';}
  finally{button.disabled=false;}
 });
 return section;
}
