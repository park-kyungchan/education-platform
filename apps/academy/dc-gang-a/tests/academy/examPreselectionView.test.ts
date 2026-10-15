import {JSDOM} from 'jsdom';
import {expect,test,afterEach} from 'bun:test';
import {known,unknown} from '../../src/learning/model';
import {createExamCandidate,elementaryExamRequirement,type ExamSelectionWorkspace} from '../../src/academy/examSelection';
import {examPreselectionView} from '../../src/academy/web/examPreselectionView';
import {examWorkspaceView} from '../../src/academy/web/examWorkspaceView';

const priorDocument=globalThis.document;
let browser:JSDOM|undefined;
afterEach(()=>{browser?.window.close();if(priorDocument===undefined)delete(globalThis as any).document;else globalThis.document=priorDocument;});
function dom(){browser=new JSDOM('<!doctype html><body></body>');globalThis.document=browser.window.document;return browser;}
function workspace():ExamSelectionWorkspace{return {kind:'exam_selection_workspace',schemaVersion:1,requirementRevision:elementaryExamRequirement.revision,title:'Synthetic analysis',examDate:unknown('Exact date unknown'),timeZone:unknown('Time zone unknown'),selections:[]};}

test('analysis is immediately visible without creating a draft or calling a write path',async()=>{
  dom();let reads=0,writes=0;
  const card=examWorkspaceView({ownerId:'synthetic-analysis-owner',actorId:'synthetic-analysis-teacher'},async<T>(path:string)=>{reads++;expect(path).toBe('/api/owner-workspaces');return {rows:[]} as T;},async()=>{writes++;throw Error('analysis_must_not_write');});
  await Promise.resolve();
  const view=card.querySelector('[data-role=exam-preselection]')!;
  expect(view.getAttribute('data-state')).toBe('analysis');expect(view.textContent).toContain('월말평가 · 문항 선택 전 분석');
  expect(view.textContent).toContain('16:20');expect(view.textContent).toContain('선택한 문항 0개');
  expect(view.querySelectorAll('button,input,textarea,select,form')).toHaveLength(0);
  (view.querySelector('summary') as HTMLElement).click();
  expect(reads).toBe(1);expect(writes).toBe(0);expect(card.querySelector('[data-entity-id]')).toBeNull();
  expect(card.querySelector('[data-role=workspace-save]')).toBeNull();
});

test('untrusted source text is rendered as text with unknown coverage and no effect controls',()=>{
  dom();const content='<img src=x onerror=alert(1)>',candidate=createExamCandidate({sourceItem:{namespace:'synthetic_item',literalKey:'item-1'},edition:unknown('No edition'),observedAt:'2026-10-16T00:00:00Z',sourceRef:content,evidenceRefs:['synthetic'],content:known('Synthetic retained content',['synthetic']),answer:unknown('No answer'),responseMode:unknown('No format'),difficulty:unknown('No difficulty')});
  const view=examPreselectionView(workspace(),[candidate]);
  expect(view.textContent).toContain(content);expect(view.querySelectorAll('img,script,button,input,textarea,select,form')).toHaveLength(0);
  expect(view.textContent).toContain('원천 문항 목록의 완전성 미검증');expect(view.textContent).toContain('답 미확인');
  expect(view.querySelector('h4')?.textContent).toContain('선택 전 분석');
});

test('readonly view refuses an already selected workspace and forged source without showing stale analysis',()=>{
  dom();const chosen=examPreselectionView({...workspace(),selections:[{candidateId:'synthetic-item',candidateRevisionId:'synthetic-revision',points:3,rationale:'Synthetic user selection'}]},[]);
  expect(chosen.dataset.state).toBe('held');expect(chosen.querySelector('[role=status]')?.textContent).toContain('exam_preselection_requires_empty_selections');
  expect(chosen.textContent).not.toContain('선택한 문항 0개');
  const forged=examPreselectionView(workspace(),[{sourceRef:'forged'}] as any);
  expect(forged.dataset.state).toBe('held');expect(forged.querySelector('[role=status]')).not.toBeNull();
});
