import {test,expect} from 'bun:test';
import {renderTeacherReport} from '../src/teacher-report.ts';
import {TeacherRetainedService} from '../src/teacher-retained.ts';
import {toolResultBytes} from '../src/tool-result.ts';
import {loadTeacherSource} from '../src/teacher-source-binding.ts';
import {teacherFixture,sourceRoot} from './teacher-fixture.ts';

test('qualified loader requires explicit exact source root; no default/auth discovery',async()=>{
  await expect(loadTeacherSource('')).rejects.toThrow('teacher_source_root_required');
  await expect(loadTeacherSource(import.meta.dir+'/../../..')).rejects.toThrow('teacher_source_revision_conflict');
  const binding=await loadTeacherSource(sourceRoot);
  expect(binding.source.commit).toBe('8f8c9bd61bd5e55445780b5569ecc40effcecef6');
  await binding.assertCurrent();
});
test('canonical projections render original100, explicit similar assignment and unknowns without second reducer',async()=>{
  const f=await teacherFixture(0),doc:any=await f.binding.readDocument(f.selector,f.fetchPage);
  const report=renderTeacherReport(doc,f.selector).join('\n');
  expect(report).toContain('[2090-01-03 학원 수업 맥락 /');
  expect(report).toContain('1.1 당일 흐름');expect(report).toContain('Invented book');
  expect(report).toContain('excluded_exact_100');expect(report).toContain('explicit-r1');
  expect(report).toContain('명시 배정');
  expect(report).toContain('미확인');expect(report).toContain('발행·점수만으로 실제 출력·배부를 확정하지 않음');
  expect(report).not.toContain('미완료 숙제 1');expect(f.source.counters.append).toBe(0);
});
test('scoped final survives old low score; cancellation/replacement and distinct attempts remain separate',async()=>{
  const f=await teacherFixture(0),doc:any=await f.binding.readDocument(f.selector,f.fetchPage);
  const exact=doc.workContext.data.exactWork,assignment=exact.assignments[0];
  const attempt=assignment.attempts[0];attempt.scoreBasis={state:'known',value:{score:20},evidenceRefs:['invented-old-score']};
  attempt.items[0].state='completed';attempt.items[0].completion={revisionId:'invented-final'};
  attempt.items[0].retainedCompletion={revisionId:'invented-final'};
  const later=structuredClone(attempt);later.record.revisionId='invented-later-attempt';later.record.payload.attemptKey.literalKey='new-attempt';
  later.items[0].state='source_unknown';later.items[0].completion=null;later.items[0].retainedCompletion=null;
  assignment.attempts.push(later);
  const cancelled=structuredClone(assignment);cancelled.record.revisionId='invented-cancelled';cancelled.obligationState='withdrawn';
  const replaced=structuredClone(assignment);replaced.record.revisionId='invented-replaced';replaced.obligationState='replaced';
  exact.assignments.push(cancelled,replaced);exact.currentObligations=[{assignmentRevisionId:assignment.record.revisionId}];
  const lines=renderTeacherReport(doc,f.selector),report=lines.join('\n');
  expect(report).toContain('교사 최종완료');expect(report).toContain('invented-final');expect(report).toContain('"score":20');
  expect(report).toContain('new-attempt');expect(report).toContain('배정 취소');expect(report).toContain('대체됨');
  const current=lines.filter(line=>line.includes('현재 명시 배정'));
  expect(current).toHaveLength(1);expect(current[0]).not.toContain('invented-cancelled');expect(current[0]).not.toContain('invented-replaced');
});
test('teacher corrections follow exact canonical unit/activity, preserve prior completion refs and missing edition',()=>{
  const selector={kind:'student' as const,studentId:'invented',date:'2090-01-03'};
  const unit=(label:string,state:string)=>({labelLiteral:label,sourceMinorUnit:{literalKey:label},duty:'teacher_scope_not_recorded',video:{state:'source_not_loaded'},teacherActivities:[{activity:'daily_test',state,currentRevisionRefs:['corrected-scope'],priorAcceptanceRevisionRefs:['prior-complete']}]});
  const doc={kind:'student_learning_scene',student:{id:'invented',displayName:'Invented Student'},preparation:{date:selector.date,books:[{labelLiteral:'Invented edition A',sourceBook:{literalKey:'A'},units:[unit('Unit A','teacher_confirmed_resolved'),unit('Unit B','teacher_evidence_not_reported')]}]},workContext:{scene:{studentId:'invented',date:selector.date},data:{exactWork:{assignments:[],currentObligations:[]}}}};
  const result=renderTeacherReport(doc,selector).join('\n');
  expect(result).toContain('판본·권 연결 미확인');expect(result).toContain('교사 확인 완료');expect(result).toContain('교사 판정 미확인');expect(result).toContain('prior-complete');
  expect(result).not.toContain('미제출');expect(result).not.toContain('미완료 확정');
  expect(()=>renderTeacherReport(doc,{...selector,studentId:'foreign'})).toThrow('teacher_report_scope_conflict');
});
test('class occurrence scope preserves raw fields and multiple occurrences; no inferred attendance or full roster',async()=>{
  const f=await teacherFixture(0),selector={kind:'class_preparation' as const,date:f.source.date};
  const document=await f.binding.readDocument(selector,f.fetchPage);
  const result=renderTeacherReport(document,selector).join('\n');
  expect(result.match(/수업 발생 /g)).toHaveLength(2);expect(result).toContain('Synthetic raw field');
  expect(result).toContain('현재 전체 반 명단은 확인되지 않음');expect(result).not.toContain('출석 확정');
  expect(()=>renderTeacherReport(document,{...selector,groupId:'foreign'})).toThrow('teacher_report_scope_conflict');
});
test('full report paging is bounded and cursor binds snapshot, selector, format and caller',async()=>{
  const f=await teacherFixture(30),service=new TeacherRetainedService(f.binding,f.fetchPage);
  let cursor:string|undefined,pages=0;const all:string[]=[];
  do{
    const result:any=await service.report({selector:f.selector,maxBytes:12000,limit:10,...(cursor?{cursor}:{})});
    expect(result.status).toBe('page');expect(toolResultBytes(result)).toBeLessThanOrEqual(12000);
    expect(result.provenance.canonicalPagesConsumed).toBeGreaterThan(1);
    all.push(result.text);cursor=result.page.nextCursor??undefined;pages++;expect(pages).toBeLessThan(100);
  }while(cursor);
  expect(pages).toBeGreaterThan(1);expect(all.join('\n')).toContain('오늘 할 일·확인 필요');
  const first:any=await service.report({selector:f.selector,maxBytes:12000,limit:1});
  const wrong:any=await service.report({selector:f.selector,maxBytes:12001,limit:1,cursor:first.page.nextCursor});
  expect(wrong.code).toBe('teacher_report_cursor_scope_conflict');
  const oversized:any=await service.report({selector:f.selector,maxBytes:1024});
  expect(oversized.status).toBe('refused');expect(toolResultBytes(oversized)).toBeLessThan(1024);
  const tinyLine:any=await service.report({selector:f.selector,maxBytes:4000,limit:250});
  expect(toolResultBytes(tinyLine)).toBeLessThanOrEqual(4000);
},30000);
test('a single oversized report line is refused without skipping; later report caller change invalidates continuation',async()=>{
  const f=await teacherFixture(1);
  const note=f.source.rows.find((version:any)=>version.payload.kind==='teacher_reported_note')!;
  (note.payload as any).text='한'.repeat(5000);
  const service=new TeacherRetainedService(f.binding,f.fetchPage);
  let cursor:string|undefined,refused=false;
  for(let n=0;n<20;n++){
    const result:any=await service.report({selector:f.selector,maxBytes:8000,limit:250,...(cursor?{cursor}:{})});
    if(result.status==='refused'){expect(result.code).toBe('teacher_report_line_exceeds_budget');refused=true;break;}
    cursor=result.page.nextCursor??undefined;if(!cursor)break;
  }
  expect(refused).toBe(true);
  const first:any=await service.report({selector:f.selector,maxBytes:65536,limit:1});
  f.source.actor.actorId='synthetic-other-actor';
  const changed:any=await service.report({selector:f.selector,maxBytes:65536,limit:1,cursor:first.page.nextCursor});
  expect(changed.code).toBe('teacher_report_cursor_scope_conflict');
},15000);
