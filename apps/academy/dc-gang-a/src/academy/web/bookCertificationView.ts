import type {StudentLearningScene as Scene} from '../contracts/teacherOperations';
import type {projectRetainedBookCertification} from '../bookCertificationEvidence';
import {workspaceNode as node,editorSelect} from './workspaceEditor';
type Reply=ReturnType<typeof projectRetainedBookCertification>;
/** Read-only retained lookup. This view never acquires results, selects a retake or advances a book. */
export function bookCertificationView(scene:Scene,read:<T>(path:string)=>Promise<T>,signal?:AbortSignal):HTMLElement {
 const card=node('section');card.id='book-certification';card.className='concept-graph card';card.append(node('h3','동일 교재 · 판본의 최종 학력인증'),node('p','최종 인증평가 기준은 70점 이상입니다. 정확한 교재·최종 시험 연결, 조회 범위와 점수 단위를 먼저 확인하며 DT·Daily Restudy 결과를 대신 쓰지 않습니다.'));
 let selected=scene.books[0]?.revisionId??'',request=0;const form=node('div');form.className='workspace-form';card.append(form);editorSelect(form,'정확한 등록 교재 / 판본',selected,scene.books.map(book=>[book.revisionId,book.displayName] as const),value=>{selected=value;request++;button.disabled=!selected;result.replaceChildren(node('p','선택한 교재의 보존 근거를 다시 조회하세요.'));},'certification-book');
 const button=node('button','보존된 인증 근거 조회') as HTMLButtonElement;button.type='button';button.dataset.role='certification-read';button.disabled=!selected;const result=node('div');result.dataset.role='certification-result';form.append(button,result);if(!selected)result.append(node('p','등록된 교재 근거가 없습니다. 실제 미배정이나 미응시를 뜻하지 않습니다.'));
 button.addEventListener('click',async()=>{if(!selected||signal?.aborted)return;const ticket=++request,registrationRevisionId=selected;button.disabled=true;result.textContent='보존된 정확한 인증 근거 조회 중…';try{
  const reply=await read<Reply>('/api/book-certification?studentId='+encodeURIComponent(scene.student.id)+'&registrationRevisionId='+encodeURIComponent(registrationRevisionId));if(signal?.aborted||ticket!==request)return;if(reply.scope.ownerId!==scene.teacherScope.ownerId||reply.scope.studentId!==scene.student.id||reply.scope.registrationRevisionId!==registrationRevisionId)throw Error('certification_scene_scope_conflict');result.replaceChildren();
  if(reply.state==='held'){result.append(node('p','최종 시험 / 조회 범위 / 점수 단위 미확인 · 미응시 또는 실패 판정이 아닙니다.'));for(const reason of reply.unknowns)result.append(node('p',reason));}
  else {const projection=reply.projection;result.append(node('p','선택한 교재·최종 시험에 공급된 보존 결과입니다. 이 화면은 원본 서버 조회를 수행하지 않습니다.'));if(!projection.attempts.length)result.append(node('p','공급된 정확한 시험 조회 범위에는 응시 결과가 없습니다. 다른 범위나 과거 전체 이력의 부재를 뜻하지 않습니다.'));
   for(const attempt of projection.attempts){const row=node('p');row.dataset.certificationAttempt=attempt.attemptId;row.textContent=attempt.nativeAttemptId+' · '+(attempt.state==='ungraded'?'미채점 · 점수 미확인':attempt.score+'점 · '+(attempt.outcome==='passed'?'해당 응시 기준 충족':'해당 응시 기준 미충족'));result.append(row);}
  }
  result.append(node('p','재응시 선택 기준은 미확정입니다. 최고·최근 점수를 자동 선택하지 않습니다. 교사 교재 완료 판정과 다음 교재 진행은 별개입니다.'));const details=node('details');details.append(node('summary','정확한 교재·시험 연결과 출처 상태'),node('pre',JSON.stringify(reply,null,2)));result.append(details);
 }catch(error){if(!signal?.aborted&&ticket===request)result.textContent='인증 근거 조회 보류 · '+(error as Error).message+' · 미응시나 실패로 바꾸지 않습니다.';}finally{if(!signal?.aborted&&ticket===request)button.disabled=!selected;}});return card;
}
