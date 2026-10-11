import type {ClinicDecisionInput,StudentLearningScene as Scene,ClinicReceipt as Receipt} from '../contracts/teacherOperations';
import {clinicDecisionKinds,type ClinicDecision} from '../classroomCyclePolicy';
import {clinicReconciliationRefusals,sameClinicTarget} from '../learningWork';
import {sameTeacherScope} from '../teacherActionScope';

type Assignment=Scene['workContext']['data']['exactWork']['assignments'][number];
type Attempt=Assignment['attempts'][number];type Item=Attempt['items'][number];

type Read=<T>(path:string)=>Promise<T>;type Write=<T>(path:string,input:unknown)=>Promise<T>;
export const clinicLabels:Record<ClinicDecision|'source_unknown'|'prior_revision_completed',string>={grading:'교사 채점',correction_required:'오답 보완 요청',explanation_required:'설명 요청',review_pending:'교사 검토 대기',completed:'교사 완료',reopened:'다시 점검',source_unknown:'교사 판정 미확인',prior_revision_completed:'기존 근거 교사 완료 · 최신 근거 검사 미확인'};
interface Draft {note:string;decision:ClinicDecision;written:boolean;explanation:boolean;confirmed:boolean;expected:string|null;sequence:number;attemptRevision:string;attemptSequence:number;policyRevision:string;reconciling:boolean;pending:ClinicDecisionInput|null;dirty:boolean;blocked:boolean;message:string;retry:boolean;recovering:boolean;listeners:Set<()=>void>;resolved:Set<string>}
// Only page-lifetime unsaved edits. Submitted originals are recovered from protected server records.
const drafts=new Map<string,Draft>();
const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const targetEqual=(a:Pick<ClinicDecisionInput,'assignmentRevisionId'|'attemptEntityId'|'assignedItemId'|'effectiveDate'>,b:typeof a)=>a.assignmentRevisionId===b.assignmentRevisionId&&a.attemptEntityId===b.attemptEntityId&&a.assignedItemId===b.assignedItemId&&a.effectiveDate===b.effectiveDate;
const draftKey=(scene:Scene,target:Pick<ClinicDecisionInput,'assignmentRevisionId'|'attemptEntityId'|'assignedItemId'|'effectiveDate'>)=>JSON.stringify([scene.teacherScope.ownerId,scene.teacherScope.actorId,scene.student.id,target.assignmentRevisionId,target.attemptEntityId,target.assignedItemId,target.effectiveDate]);
function acceptReceipt(scene:Scene,input:ClinicDecisionInput,receipt:Pick<Receipt,'record'|'revisionId'|'officialSaved'|'parentSent'>){
  const row=receipt.record,payload=row?.payload;
  if(receipt.officialSaved!==false||receipt.parentSent!==false||row?.ownerId!==scene.teacherScope.ownerId||row.actorId!==scene.teacherScope.actorId||row.studentId!==input.studentId||row.idempotencyKey!==input.idempotencyKey||row.previousRevisionId!==input.expectedRevisionId||row.revisionId!==receipt.revisionId||!Number.isSafeInteger(row.sequence)||row.sequence<1||payload?.kind!=='teacher_clinic_revision')throw Error('clinic_readback_conflict');
  if(!targetEqual(input,payload)||payload.attemptRevisionId!==input.attemptRevisionId||payload.note!==input.note||payload.reportedAt!==input.reportedAt||payload.decision!==input.decision||payload.inspection.writtenSolution!==input.inspection.writtenSolution||payload.inspection.correctionExplanation!==input.inspection.correctionExplanation||payload.sourceStudent.namespace!==scene.student.sourceKey.namespace||payload.sourceStudent.literalKey!==scene.student.sourceKey.literalKey||payload.policyRevision!==input.expectedPolicyRevision)throw Error('clinic_readback_conflict');
  return row;
}
function settle(s:Draft,input:ClinicDecisionInput,row:Receipt['record']){
  if(row.sequence>=s.sequence){s.expected=row.revisionId;s.sequence=row.sequence;}
  s.resolved.add(input.idempotencyKey);s.pending=null;s.blocked=false;s.dirty=s.note!==input.note||s.decision!==input.decision;s.confirmed=false;s.retry=false;s.message='저장 확인 · '+clinicLabels[input.decision]+' · '+row.revisionId;
}
function editor(scene:Scene,assignment:Assignment,attempt:Attempt,item:Item,read:Read,write:Write,lifetime:AbortSignal,onSaved:(fresh?:Scene)=>void){
  const target={assignmentRevisionId:assignment.record.revisionId,attemptEntityId:attempt.record.entityId,assignedItemId:item.item.assignedItemId,effectiveDate:scene.preparation.date};
  const key=draftKey(scene,target);
  const recovery=scene.clinicRecovery.find(row=>row.resolution==='pending'&&sameClinicTarget(row.input,target));
  let state=drafts.get(key);
  if(!state){state={note:recovery?.input.note??'',decision:recovery?.input.decision??'review_pending',written:false,explanation:false,confirmed:false,expected:item.expectedRevisionId,sequence:item.decision?.sequence??0,attemptRevision:attempt.record.revisionId,attemptSequence:attempt.record.sequence,policyRevision:scene.workContext.logic.policyRevision,reconciling:false,pending:recovery?.input??null,dirty:false,blocked:false,message:recovery?'보호된 원본 요청을 복구했습니다. 저장 결과를 확인하세요.':'',retry:false,recovering:false,listeners:new Set(),resolved:new Set()};drafts.set(key,state);}
  const s=state;
  if(s.pending){const input=s.pending,row=item.history.find(row=>row.idempotencyKey===input.idempotencyKey&&row.actorId===scene.teacherScope.actorId);if(row)settle(s,input,acceptReceipt(scene,input,{record:row,revisionId:row.revisionId,officialSaved:false,parentSent:false}));}
  if(recovery&&!s.pending&&!s.resolved.has(recovery.input.idempotencyKey)){s.pending=recovery.input;s.confirmed=false;s.retry=false;s.message='다른 화면의 미확정 원본 요청이 있습니다. 내 입력은 보존했고 새 저장은 중단했습니다.';}
  if(!s.pending){
    const newer=(item.decision?.sequence??0)>s.sequence||attempt.record.sequence>s.attemptSequence||scene.workContext.logic.policyRevision!==s.policyRevision;
    if(newer){s.confirmed=false;if(s.dirty){s.blocked=true;s.message='다른 저장 또는 풀이 근거가 변경됐습니다. 내 입력은 보존했습니다.';}else{if(s.attemptRevision!==attempt.record.revisionId)s.written=s.explanation=false;s.expected=item.expectedRevisionId;s.sequence=item.decision?.sequence??0;s.attemptRevision=attempt.record.revisionId;s.attemptSequence=attempt.record.sequence;s.policyRevision=scene.workContext.logic.policyRevision;}}
  }
  const panel=node('details','','clinic-item');panel.dataset.clinicItem=item.item.assignedItemId;panel.dataset.assignment=assignment.record.revisionId;panel.dataset.attempt=attempt.record.entityId;
  panel.append(node('summary',item.item.labelLiteral+' — '+clinicLabels[item.state]));
  const paper=assignment.record.payload.paper;
  const ordinal=paper.state==='known'?paper.value.orderedItems.find(row=>row.assignedItemId===item.item.assignedItemId)?.printedOrdinal:null;
  panel.append(node('p',`섹션 ${assignment.catalog.find(n=>n.id===item.item.sectionNodeId)?.label??item.item.sectionNodeId}${ordinal?' / 프린트 '+ordinal+'번':''}`));
  panel.append(node('p','원천 채점: '+(item.sourceGrade.state==='known'?({correct:'정답',incorrect:'오답',ungraded:'미채점'} as const)[item.sourceGrade.value]:'미확인')+' · 교사 검사와 별개입니다.','muted'));
  if(item.inspectionBasis==='prior_attempt_revision')panel.append(node('p','기존 완료 판정은 보존합니다. 검사한 풀이 근거 '+item.retainedCompletion!.payload.attemptRevisionId+' 이후 자료가 변경되어, 최신 근거 '+attempt.record.revisionId+'에 대한 검사는 아직 확인되지 않았습니다.','notice'));
  const form=node('div','','clinic-form'),selection=node('select');selection.dataset.role='decision';
  for(const value of clinicDecisionKinds){const option=node('option',clinicLabels[value]);option.value=value;selection.append(option);}selection.value=s.decision;
  const textarea=node('textarea');textarea.rows=3;textarea.maxLength=4000;textarea.value=s.note;textarea.dataset.role='note';
  const field=(label:string,el:HTMLElement)=>{const wrapper=node('label',label);wrapper.append(el);form.append(wrapper);};
  field('기록할 교사 판단',selection);field('검사 내용 · 보완 또는 재점검 이유',textarea);
  const check=(role:string,label:string,checked:boolean)=>{const input=node('input');input.type='checkbox';input.dataset.role=role;input.checked=checked;field(label,input);return input;};
  const written=check('written','이 문항의 작성 풀이를 직접 확인했습니다',s.written),explanation=check('explanation','이 문항의 보완·설명을 직접 확인했습니다',s.explanation),confirm=check('confirm','위 배정·풀이·문항에 이 판단을 기록합니다',s.confirmed);
  const button=(role:string,label:string)=>{const el=node('button',label);el.type='button';el.dataset.role=role;return el;};
  const save=button('save','교사 판단 저장'),recover=button('recover','원본 요청 결과 확인'),retry=button('retry','같은 원본 요청 재시도'),reconcile=button('reconcile','현재 조회 근거로 입력 계속');
  const status=node('p','','clinic-status');status.dataset.role='status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const sync=()=>{panel.dataset.dirty=String(s.dirty);panel.dataset.pending=String(!!s.pending);written.checked=s.written;explanation.checked=s.explanation;confirm.checked=s.confirmed;textarea.readOnly=!!s.pending;selection.disabled=written.disabled=explanation.disabled=confirm.disabled=!!s.pending||s.reconciling;save.disabled=!!s.pending||s.reconciling||s.blocked||!item.writable||!s.note.trim()||!s.confirmed||(s.decision==='completed'&&(!s.written||!s.explanation));recover.hidden=!s.pending;recover.disabled=s.recovering;retry.hidden=!s.pending||!s.retry;reconcile.hidden=!s.blocked||!!s.pending;reconcile.disabled=s.reconciling;status.textContent=s.message;};
  const notify=()=>{for(const listener of s.listeners)listener();};s.listeners.add(sync);lifetime.addEventListener('abort',()=>s.listeners.delete(sync),{once:true});
  const accept=(receipt:Receipt,input:ClinicDecisionInput)=>{if(s.pending!==input)return;settle(s,input,acceptReceipt(scene,input,receipt));confirm.checked=false;notify();onSaved();};
  textarea.addEventListener('input',()=>{s.note=textarea.value;s.dirty=true;s.confirmed=false;confirm.checked=false;notify();});
  for(const el of [selection,written,explanation,confirm])el.addEventListener('change',()=>{if(el!==confirm)confirm.checked=false;s.decision=selection.value as ClinicDecision;s.written=written.checked;s.explanation=explanation.checked;s.confirmed=confirm.checked;s.dirty=true;notify();});
  const submit=async(input:ClinicDecisionInput)=>{
    s.pending=input;s.retry=false;s.message='저장 결과 확인 중…';notify();
    try{accept(await write<Receipt>('/api/teacher-clinic',input),input);}catch(error){if(s.pending!==input)return;const reason=(error as Error).message;
      if(reason==='future_reported_at'){s.pending=null;s.dirty=true;s.confirmed=false;s.message='보고 시각이 서버보다 미래여서 저장 전에 거부됐습니다. 기기 시각을 수정하고 판단을 다시 확인한 후 새 요청으로 저장하세요. 원문은 현재 입력 화면에만 남아 있으며 새로고침하면 사라질 수 있습니다.';}
      else if(clinicReconciliationRefusals.includes(reason)||reason==='teacher_scene_actor_conflict'){s.pending=null;s.blocked=true;s.message='저장 거부 · '+reason+' · 입력을 보존했습니다. 근거를 다시 조회하고 확인하세요.';}
      else{s.message='저장 응답을 확인하지 못했습니다. 원본 요청 결과부터 확인하세요.';}
    }finally{notify();}
  };
  save.addEventListener('click',()=>{if(save.disabled||lifetime.aborted)return;void submit({studentId:scene.student.id,...target,attemptRevisionId:s.attemptRevision,expectedRevisionId:s.expected,expectedPolicyRevision:s.policyRevision,idempotencyKey:crypto.randomUUID(),reportedAt:new Date().toISOString(),decision:s.decision,inspection:{writtenSolution:s.written,correctionExplanation:s.explanation},note:s.note});});
  recover.addEventListener('click',async()=>{const input=s.pending;if(!input||s.recovering)return;s.recovering=true;notify();try{accept(await read<Receipt>('/api/teacher-clinic-result?studentId='+encodeURIComponent(input.studentId)+'&requestId='+encodeURIComponent(input.idempotencyKey)),input);}catch(error){if(s.pending===input){s.retry=(error as Error).message==='clinic_result_not_found';s.message='아직 결과 미확인 · 새 요청은 보내지 않습니다. 같은 원본 요청만 재시도할 수 있습니다.';}}finally{s.recovering=false;notify();}});
  retry.addEventListener('click',()=>{if(s.pending&&s.retry)void submit(s.pending);});
  reconcile.addEventListener('click',async()=>{
    if(s.pending||s.reconciling||!s.blocked||lifetime.aborted)return;
    s.reconciling=true;s.confirmed=false;confirm.checked=false;s.message='현재 교사·정책·배정 근거를 다시 조회합니다…';notify();
    try{
      const fresh=await read<Scene>('/api/student?id='+encodeURIComponent(scene.student.id)+'&date='+encodeURIComponent(scene.preparation.date));
      if(lifetime.aborted)return;
      if(fresh.student.id!==scene.student.id||fresh.preparation.date!==scene.preparation.date||!sameTeacherScope(scene.teacherScope,fresh.teacherScope))throw Error('teacher_scene_actor_conflict');
      const nextAssignment=fresh.workContext.data.exactWork.assignments.find(row=>row.record.revisionId===target.assignmentRevisionId);
      const nextAttempt=nextAssignment?.attempts.find(row=>row.record.entityId===target.attemptEntityId);
      const nextItem=nextAttempt?.items.find(row=>row.item.assignedItemId===target.assignedItemId);
      if(!nextItem?.writable||!nextAttempt||nextAttempt.record.sequence<s.attemptSequence||(nextItem.decision?.sequence??0)<s.sequence)throw Error('clinic_reconciliation_target_conflict');
      if(fresh.clinicRecovery.some(row=>row.resolution==='pending'&&sameClinicTarget(row.input,target)))throw Error('unresolved_clinic_request');
      if(s.attemptRevision!==nextAttempt.record.revisionId)s.written=s.explanation=false;
      s.expected=nextItem.expectedRevisionId;s.sequence=nextItem.decision?.sequence??0;s.attemptRevision=nextAttempt.record.revisionId;s.attemptSequence=nextAttempt.record.sequence;s.policyRevision=fresh.workContext.logic.policyRevision;
      s.blocked=false;s.message='현재 조회 근거를 선택했습니다. 새 판단을 확인하고 저장하세요.';s.reconciling=false;
      onSaved(fresh);
    }catch(error){if(!lifetime.aborted){s.blocked=true;s.message='근거 재조회 보류 · '+(error as Error).message+' · 내 입력을 유지합니다.';}}
    finally{s.reconciling=false;notify();}
  });
  form.append(save,recover,retry,reconcile,status);panel.append(form);
  if(!item.writable)panel.append(node('p','과거 또는 변경된 근거입니다. 원본 이력은 유지하며 이 화면에서 새 완료를 기록하지 않습니다.','notice'));
  const history=node('details');history.append(node('summary','판정 이력 · '+item.history.length+'건'));
  for(const row of item.history)history.append(node('p',`${row.payload.effectiveDate} ${clinicLabels[row.payload.decision]}: ${row.payload.note}`),node('small',`보고 ${row.payload.reportedAt} / 저장 ${row.recordedAt} / ${row.revisionId}`));panel.append(history);sync();return panel;
}
export function clinicWorkView(scene:Scene,read:Read,write:Write,lifetime:AbortSignal,onSaved:(fresh?:Scene)=>void):HTMLElement{
  const panel=node('section','','card clinic-work');panel.id='clinic-work';panel.append(node('h3','배정 문항 · 풀이와 교사 판단'),node('p','확인된 배정만 표시합니다. 학원 원천 읽기·생성·인쇄·공식 기록·부모 전송은 실행하지 않습니다.','muted'));
  for(const assignment of scene.workContext.data.exactWork.assignments){
    const detail=node('details');detail.open=true;const work=assignment.record.payload;
    detail.append(node('summary',`${work.activity==='wrong_clinic'?'오답클리닉':work.activity==='similar_clinic'?'유사클리닉':work.activity} / 배정 ${work.assignmentKey.literalKey} / ${work.effectiveDate}`));
    detail.append(node('p','과정 '+work.sourceCourse.literalKey+' · 교재 '+work.sourceBook.literalKey+(work.paper.state==='known'?` · 프린트 ${work.paper.value.paperKey.literalKey} (${work.paper.value.versionLiteral}) · 발행 ${work.paper.value.issuanceKey.literalKey}`:' · 프린트 연결 미확인')));
    for(const attempt of assignment.attempts){const section=node('section','','clinic-attempt');section.append(node('h4',`풀이 ${attempt.record.payload.attemptKey.literalKey} · ${attempt.completed?'배정 문항 전체 교사 완료':'문항별 점검 필요'}`));for(const item of attempt.items)section.append(editor(scene,assignment,attempt,item,read,write,lifetime,onSaved));detail.append(section);}
    if(!assignment.attempts.length)detail.append(node('p','연결된 풀이 시도가 없습니다. 미수행으로 판정하지 않습니다.'));
    if(assignment.archived.length){
      const versions=node('details');versions.append(node('summary','다른 배정 버전과 판단 이력 · 읽기 전용'));
      for(const prior of assignment.archived){
        const archive=node('section');archive.dataset.archivedAssignment=prior.record.revisionId;
        archive.append(node('h4',`배정 버전 ${prior.record.sequence} / 적용일 ${prior.record.payload.effectiveDate}`),node('p',prior.record.revisionId,'muted'));
        const paper=prior.record.payload.paper;archive.append(node('p',paper.state==='known'?`프린트 ${paper.value.paperKey.literalKey} / 버전 ${paper.value.versionLiteral} / 발행 ${paper.value.issuanceKey.literalKey}`:'프린트 연결 미확인'));
        for(const attempt of prior.attempts){archive.append(node('h5','풀이 '+attempt.record.payload.attemptKey.literalKey));for(const item of attempt.items){const history=node('details');history.append(node('summary',item.item.labelLiteral+' / '+clinicLabels[item.state]));for(const row of item.history)history.append(node('p',`${row.payload.effectiveDate} ${clinicLabels[row.payload.decision]}: ${row.payload.note}`),node('small',`보고 ${row.payload.reportedAt} / 저장 ${row.recordedAt} / ${row.revisionId}`));archive.append(history);}}
        versions.append(archive);
      }
      detail.append(versions);
    }
    panel.append(detail);
  }
  if(!scene.workContext.data.exactWork.assignments.length)panel.append(node('p','정확한 배정·문항·풀이 연결이 아직 없습니다. 목차만으로 과제나 완료를 만들지 않습니다.'));
  for(const recovery of scene.clinicRecovery){
    const input=recovery.input;
    if(drafts.get(draftKey(scene,input))?.resolved.has(input.idempotencyKey))continue;
    const section=node('section','','notice');section.dataset.recoveryRequest=input.idempotencyKey;
    section.append(node('h4',recovery.resolution==='rejected'?'저장이 거부된 원본 요청':'미확정 원본 요청'),node('p',input.note),node('p',`${input.effectiveDate} / ${input.assignedItemId} / 요청 ${input.idempotencyKey}`));
    if(recovery.resolution==='rejected'){section.append(node('p','거부 사유: '+recovery.refusal+' · 이 원본은 변경하지 않습니다. 현재 대상을 조회·확인한 후 새 요청으로 기록하세요.'));panel.append(section);continue;}
    const recover=node('button','원본 요청 결과 확인'),retry=node('button','같은 원본 요청 재시도'),message=node('p');
    recover.type=retry.type='button';recover.dataset.role='recover';retry.dataset.role='retry';retry.hidden=true;message.setAttribute('role','status');let busy=false;
    const reconcile=async(replay:boolean)=>{if(busy||lifetime.aborted)return;busy=true;recover.disabled=retry.disabled=true;
      try{const receipt=replay?await write<Receipt>('/api/teacher-clinic',input):await read<Receipt>('/api/teacher-clinic-result?studentId='+encodeURIComponent(input.studentId)+'&requestId='+encodeURIComponent(input.idempotencyKey));acceptReceipt(scene,input,receipt);message.textContent='원본 요청 저장 확인 · '+receipt.revisionId;retry.hidden=true;onSaved();}
      catch(error){const code=(error as Error).message;retry.hidden=code!=='clinic_result_not_found';message.textContent=code==='clinic_result_not_found'?'아직 결과 미확인 · 원본 요청을 보존합니다.':'요청 보류 · '+code;if(clinicReconciliationRefusals.includes(code))onSaved();}
      finally{busy=false;recover.disabled=retry.disabled=false;}
    };
    recover.addEventListener('click',()=>void reconcile(false));retry.addEventListener('click',()=>{if(!retry.hidden)void reconcile(true);});section.append(recover,retry,message);panel.append(section);
  }
  return panel;
}
export function revealClinicProposal(panel:HTMLElement,target:{assignmentRevisionId:string;attemptEntityId:string;assignedItemId:string;decision:ClinicDecision}){
  const item=[...panel.querySelectorAll<HTMLDetailsElement>('[data-clinic-item]')].find(el=>el.dataset.assignment===target.assignmentRevisionId&&el.dataset.attempt===target.attemptEntityId&&el.dataset.clinicItem===target.assignedItemId);
  if(!item)throw Error('clinic_proposal_target_missing');
  if(item.dataset.dirty==='true')throw Error('clinic_proposal_dirty_draft');
  if(item.dataset.pending==='true')throw Error('clinic_proposal_pending_request');
  item.open=true;
  const selection=item.querySelector<HTMLSelectElement>('[data-role="decision"]')!;if(selection.disabled)throw Error('clinic_proposal_pending_request');selection.value=target.decision;selection.dispatchEvent(new Event('change'));
  item.querySelector<HTMLElement>('[data-role="note"]')!.focus();item.scrollIntoView?.({block:'nearest'});
}
