import type {StudentLearningScene as Scene,ObservationReceipt as Receipt,ObservationInput} from '../contracts/teacherOperations';
import type {DateClassRow,DateClassPreparation} from './dateClassView';
import {occurrenceIdentity} from './dateClassView';
import {sameTeacherScope} from '../teacherActionScope';

type Input=ObservationInput;
interface Draft {text:string;expectedRevisionId:string|null;headSequence:number;basisRevisionId:string;pending:Input|null;message:string;blocked:boolean;dirty:boolean;retryAllowed:boolean;recovering:Input|null;reconciling:boolean;listeners:Set<()=>void>;resolved:Set<string>}
// Page-lifetime drafts only: no teacher originals in browser localStorage or shared fixtures.
const drafts=new Map<string,Draft>();
const node=(tag:string,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
const draftKey=(scene:Scene,target:Pick<DateClassRow,'studentId'|'occurrence'>)=>JSON.stringify([scene.teacherScope.ownerId,scene.teacherScope.actorId,occurrenceIdentity(target)]);
function verifiedReceipt(scene:Scene,input:Input,receipt:Pick<Receipt,'revisionId'|'record'|'officialSaved'|'parentSent'>){
  const record=receipt.record,payload=record?.payload;
  if(record?.ownerId!==scene.teacherScope.ownerId||record.actorId!==scene.teacherScope.actorId)throw Error('observation_readback_conflict');
  if(receipt.officialSaved!==false||receipt.parentSent!==false||record.studentId!==input.studentId||!Number.isSafeInteger(record.sequence)||record.sequence<1||record.revisionId!==receipt.revisionId||record.idempotencyKey!==input.idempotencyKey||record.previousRevisionId!==input.expectedRevisionId||payload?.kind!=='teacher_observation'||payload.text!==input.text||payload.basisRevisionId!==input.basisRevisionId||payload.reportedAt!==input.reportedAt||Object.entries(input.occurrence).some(([k,v])=>payload.occurrence[k as keyof typeof input.occurrence]!==v))throw Error('observation_readback_conflict');
  return record;
}
function settle(state:Draft,input:Input,record:Receipt['record']){
  if(record.sequence>=state.headSequence){state.expectedRevisionId=record.revisionId;state.headSequence=record.sequence;}
  state.resolved.add(input.idempotencyKey);state.pending=null;state.message='저장 확인 · '+record.revisionId+' · 원문과 이전 수정 이력은 보존됩니다.';state.blocked=false;state.dirty=state.text!==input.text;
  for(const listener of state.listeners)listener();
}
export function observationEditor(scene:Scene,row:DateClassRow|null,read:<T>(path:string)=>Promise<T>,write:<T>(path:string,input:unknown)=>Promise<T>,lifetime?:AbortSignal,onReconciled?:(fresh:Scene,row:DateClassRow)=>void):HTMLElement{
  const card=node('section');card.className='card';card.append(node('h3','교사 관찰 · 원문과 수정 이력'));
  card.append(node('p','개인 교사 관찰입니다. 공식 기록 저장·승인·부모 전송이 아닙니다.'));
  for(const recovery of scene.observationRecovery??[]){
    if(recovery.ownerId!==scene.teacherScope.ownerId||recovery.actorId!==scene.teacherScope.actorId||recovery.input.studentId!==scene.student.id)throw Error('observation_recovery_scope_conflict');
    if(drafts.get(draftKey(scene,recovery.input))?.resolved.has(recovery.input.idempotencyKey))continue;
    const original=node('section');original.className='notice';original.dataset.observationRequest=recovery.input.idempotencyKey;
    original.append(node('h4',recovery.resolution==='rejected'?'저장이 거부된 관찰 원문':'미확정 관찰 원문'),node('p',recovery.input.text),node('p',recovery.input.occurrence.date+' · 요청 '+recovery.input.idempotencyKey));
    original.append(node('p',recovery.resolution==='rejected'?'거부 사유: '+recovery.refusal+' · 원문은 보존되며 승인된 관찰이나 공식 기록이 아닙니다.':'원본 요청의 저장 결과를 확인하기 전에는 새 관찰로 다시 제출하지 마세요.'));
    if(recovery.resolution==='pending'){
      const input=recovery.input,recover=node('button','원본 요청 결과 확인') as HTMLButtonElement,retry=node('button','같은 원본 요청 재시도') as HTMLButtonElement,message=node('p');
      recover.type=retry.type='button';recover.dataset.role='recover';retry.dataset.role='retry';retry.hidden=true;message.setAttribute('role','status');let busy=false,resolved=false;
      const reconcile=async(replay:boolean)=>{
        if(busy||resolved||lifetime?.aborted)return;busy=true;recover.disabled=retry.disabled=true;
        try{
          const receipt=replay?await write<Receipt>('/api/teacher-observation',input):await read<Receipt>('/api/teacher-observation-result?studentId='+encodeURIComponent(input.studentId)+'&requestId='+encodeURIComponent(input.idempotencyKey));
          const record=verifiedReceipt(scene,input,receipt),state=drafts.get(draftKey(scene,input));
          if(state?.pending?.idempotencyKey===input.idempotencyKey)settle(state,input,record);
          resolved=true;retry.hidden=true;message.textContent='원본 요청 저장 확인 · '+record.revisionId;
        }catch(error){const code=(error as Error).message;retry.hidden=code!=='observation_result_not_found';message.textContent='원본 요청 확인 보류 · '+code;}
        finally{busy=false;recover.disabled=retry.disabled=resolved;}
      };
      recover.addEventListener('click',()=>void reconcile(false));retry.addEventListener('click',()=>{if(!retry.hidden)void reconcile(true);});original.append(recover,retry,message);
    }
    card.append(original);
  }
  if(!row||row.studentId!==scene.student.id||!scene.evidence.some(v=>v.revisionId===row.revisionId&&v.payload.kind==='source_audit')){
    card.append(node('p','날짜별 수업과 현재 출처 근거를 선택한 뒤 기록할 수 있습니다.'));return card;
  }
  const key=draftKey(scene,row);
  const prior=scene.evidence.find(v=>v.payload.kind==='teacher_observation'&&Object.entries(row.occurrence).every(([k,value])=>v.payload.kind==='teacher_observation'&&v.payload.occurrence[k as keyof typeof row.occurrence]===value));
  const pending=(scene.observationRecovery??[]).find(value=>value.resolution==='pending'&&occurrenceIdentity(value.input)===occurrenceIdentity(row));
  let draft=drafts.get(key);
  if(!draft){draft={text:pending?.input.text??(prior?.payload.kind==='teacher_observation'?prior.payload.text:''),expectedRevisionId:prior?.revisionId??null,headSequence:prior?.sequence??0,basisRevisionId:row.revisionId,pending:pending?.input??null,message:pending?'보호된 원본 요청을 복구했습니다. 저장 결과를 확인하세요.':'',blocked:false,dirty:false,retryAllowed:false,recovering:null,reconciling:false,listeners:new Set(),resolved:new Set()};drafts.set(key,draft);}
  // Student queries and save acknowledgements are separate clocks: a precommit snapshot is not a newer head.
  else if(!draft.pending&&(draft.headSequence===0||prior&&(prior.revisionId===draft.expectedRevisionId||prior.sequence>draft.headSequence))){
    const changed=draft.expectedRevisionId!==(prior?.revisionId??null)||draft.basisRevisionId!==row.revisionId;
    if(changed&&(draft.dirty||draft.blocked)){draft.blocked=true;draft.message='저장된 관찰 또는 출처 근거가 변경됐습니다. 내 입력은 보존했습니다. 현재 근거를 확인한 뒤 명시적으로 수정을 계속하세요.';}
    else if(changed){draft.text=prior?.payload.kind==='teacher_observation'?prior.payload.text:'';draft.expectedRevisionId=prior?.revisionId??null;draft.headSequence=prior?.sequence??0;draft.basisRevisionId=row.revisionId;draft.message='';}
  }
  const state=draft;
  if(state.pending){const input=state.pending,record=scene.evidence.find(value=>value.actorId===scene.teacherScope.actorId&&value.idempotencyKey===input.idempotencyKey&&value.payload.kind==='teacher_observation');if(record)settle(state,input,verifiedReceipt(scene,input,{record,revisionId:record.revisionId,officialSaved:false,parentSent:false}));}
  if(pending&&!state.pending&&!state.resolved.has(pending.input.idempotencyKey)){state.pending=pending.input;state.message='다른 화면의 미확정 원본 요청이 있습니다. 내 입력은 유지하며 새 저장을 중단했습니다.';}
  const label=node('label','선택 수업의 교사 관찰');label.setAttribute('for','teacher-observation-text');
  const text=document.createElement('textarea');text.id='teacher-observation-text';text.maxLength=16000;text.rows=5;text.value=state.text;text.style.cssText='width:100%;font:inherit;resize:vertical';
  const save=node('button','관찰 저장 / 수정') as HTMLButtonElement;save.id='teacher-observation-save';save.type='button';
  const recover=node('button','원본 요청의 저장 결과 확인') as HTMLButtonElement;recover.id='teacher-observation-recover';recover.type='button';
  const retry=node('button','같은 원본 요청으로 재시도') as HTMLButtonElement;retry.id='teacher-observation-retry';retry.type='button';
  const reconcile=node('button','현재 근거를 확인하고 내 입력으로 수정 계속') as HTMLButtonElement;reconcile.id='teacher-observation-reconcile';reconcile.type='button';
  const current=node('p','현재 저장된 관찰: '+(prior?.payload.kind==='teacher_observation'?prior.payload.text:'없음')+' · 관찰 revision '+(prior?.revisionId??'없음')+' · 출처 revision '+row.revisionId);

  const message=node('p');message.id='teacher-observation-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.style.overflowWrap='anywhere';
  const sync=()=>{text.readOnly=!!state.pending;save.disabled=!!state.pending||state.reconciling||state.blocked||!state.text.trim();recover.hidden=!state.pending;recover.disabled=!!state.pending&&state.recovering===state.pending;retry.hidden=!state.pending||!state.retryAllowed;reconcile.hidden=!state.blocked||!!state.pending;reconcile.disabled=state.reconciling;current.hidden=reconcile.hidden;message.textContent=state.message;};
  if(!lifetime?.aborted)state.listeners.add(sync);
  lifetime?.addEventListener('abort',()=>state.listeners.delete(sync),{once:true});
  const notify=()=>{for(const listener of state.listeners)listener();};
  const accept=(receipt:Pick<Receipt,'revisionId'|'record'|'officialSaved'|'parentSent'>,input:Input)=>{
    if(state.pending!==input)return;
    settle(state,input,verifiedReceipt(scene,input,receipt));
  };
  text.addEventListener('input',()=>{state.text=text.value;state.dirty=true;notify();});
  reconcile.addEventListener('click',async()=>{
    if(state.pending||state.reconciling||!state.blocked||lifetime?.aborted)return;
    state.reconciling=true;state.message='현재 교사·수업·관찰 근거를 다시 조회합니다…';notify();
    try{
      const date=row.occurrence.date;
      const [fresh,lessons]=await Promise.all([read<Scene>('/api/student?id='+encodeURIComponent(scene.student.id)+'&date='+encodeURIComponent(date)),read<DateClassPreparation>('/api/class?date='+encodeURIComponent(date))]);
      if(lifetime?.aborted)return;
      if(fresh.student.id!==scene.student.id||fresh.preparation.date!==date||!sameTeacherScope(scene.teacherScope,fresh.teacherScope))throw Error('teacher_scene_actor_conflict');
      if(lessons.kind!=='date_class_preparation'||lessons.date!==date||lessons.rowCount!==lessons.rows.length)throw Error('observation_reconciliation_scope_conflict');
      const rows=lessons.rows.filter(value=>occurrenceIdentity(value)===occurrenceIdentity(row));
      const nextRow=rows[0];
      if(rows.length!==1||!nextRow||!fresh.evidence.some(value=>value.revisionId===nextRow.revisionId&&value.payload.kind==='source_audit'))throw Error('observation_reconciliation_basis_conflict');
      const observations=fresh.evidence.filter(value=>value.payload.kind==='teacher_observation'&&occurrenceIdentity({studentId:value.studentId,occurrence:value.payload.occurrence})===occurrenceIdentity(row));
      const head=observations[0];
      if(observations.length>1||(head?.sequence??0)<state.headSequence)throw Error('observation_reconciliation_head_conflict');
      if((fresh.observationRecovery??[]).some(value=>value.resolution==='pending'&&occurrenceIdentity(value.input)===occurrenceIdentity(row)))throw Error('unresolved_observation_request');
      state.expectedRevisionId=head?.revisionId??null;state.headSequence=head?.sequence??0;state.basisRevisionId=nextRow.revisionId;state.blocked=false;state.message='현재 근거를 확인했습니다. 내 입력은 유지하며 다음 저장은 새 수정 요청입니다.';state.reconciling=false;
      current.textContent='현재 관찰 revision '+(head?.revisionId??'없음')+' · 출처 revision '+nextRow.revisionId;
      onReconciled?.(fresh,nextRow);
    }catch(error){if(!lifetime?.aborted){state.blocked=true;state.message='근거 재조회 보류 · '+(error as Error).message+' · 내 입력을 유지합니다.';}}
    finally{state.reconciling=false;notify();}
  });
  const submit=async(input:Input)=>{
    state.retryAllowed=false;
    state.pending=input;state.message='저장 결과 확인 중…';notify();
    try{accept(await write<Receipt>('/api/teacher-observation',input),input);}
    catch(error){
      if(state.pending!==input)return;
      const reason=(error as Error).message;
      if(reason==='future_reported_at'){
        state.pending=null;state.dirty=true;state.message='보고 시각이 서버보다 미래여서 저장 전에 거부됐습니다. 기기 시각을 수정한 후 새 요청으로 저장하세요. 원문은 현재 입력 화면에만 남아 있으며 새로고침하면 사라질 수 있습니다.';
      }else if(reason==='input_too_large'){
        state.pending=null;state.message='저장 전 크기 제한으로 거부됐습니다. 입력은 보존했습니다. 내용을 줄여 새 요청으로 저장할 수 있습니다.';
      }else if(['stale_base','stale_evidence_basis','observation_basis_conflict','idempotency_reuse','invalid_revision_transition','unresolved_observation_request','teacher_scene_actor_conflict'].includes(reason)){
        state.pending=null;state.blocked=true;state.message='저장 거부 · '+reason+' · 입력은 보존했습니다. 수업 근거를 다시 조회한 뒤 내용을 검토하세요.';
      }else state.message='저장 응답을 확인하지 못했습니다. 입력과 원본 요청을 보존했습니다. 다시 저장하지 말고 저장 결과를 확인하세요.';
    }finally{notify();}
  };
  save.addEventListener('click',()=>{
    if(state.pending||state.reconciling||state.blocked||!state.text.trim()||lifetime?.aborted)return;
    void submit({studentId:scene.student.id,occurrence:structuredClone(row.occurrence),basisRevisionId:state.basisRevisionId,expectedRevisionId:state.expectedRevisionId,idempotencyKey:crypto.randomUUID(),reportedAt:new Date().toISOString(),text:state.text});
  });
  retry.addEventListener('click',()=>{if(state.pending&&state.retryAllowed)void submit(state.pending);});
  recover.addEventListener('click',async()=>{
    const input=state.pending;if(!input||state.recovering===input)return;state.recovering=input;notify();
    try{accept(await read<Receipt>('/api/teacher-observation-result?studentId='+encodeURIComponent(input.studentId)+'&requestId='+encodeURIComponent(input.idempotencyKey)),input);}
    catch(error){if(state.pending!==input)return;state.retryAllowed=(error as Error).message==='observation_result_not_found';state.message='원본 요청의 저장 결과가 아직 확인되지 않았습니다. 입력을 유지하고 새 요청은 보내지 않습니다.';}
    finally{if(state.recovering===input)state.recovering=null;notify();}
  });
  card.append(label,text,save,recover,retry,current,reconcile,message);sync();return card;
}
