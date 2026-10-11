import {expect,test} from 'bun:test';

const mapping={bookLabel:'Invented Gauss Volume 1',unitCode:'1-6',unitName:'Invented rounding',evidenceRefs:['source:invented-edition'],basis:'source_edition' as const};
const input={lessonDate:'2099-01-05',part:1,progress:[{content:[mapping],activity:'wrong_clinic' as const,outcome:'teacher_checked' as const,detail:'',evidenceRefs:['teacher:invented-inspection'],internalCode:'P1'}],homework:{dueDate:'2099-01-07',tasks:[{content:[mapping],action:'solve_without_grading' as const,selection:'지정한 일부 문항',evidenceRefs:['teacher:invented-assignment']}],qualification:'verified' as const},memo:[{text:'Invented announcement',parts:[1],evidenceRefs:['teacher:invented-memo']}]};
test('parent journal maps internal paper codes to attributable edition/unit names in three independent templates',async()=>{
  const module=await import('../../src/lms/lessonJournalTemplates').catch(()=>({renderLessonJournal:undefined}));
  expect(typeof module.renderLessonJournal).toBe('function');
  const result=module.renderLessonJournal!(input);
  expect(result.progress).toContain('Invented Gauss Volume 1 1-6 Invented rounding');
  expect(result.progress).toContain('오답클리닉');expect(result.progress).toContain('채점·검사 완료');
  expect(result.homework).toContain('집에서는 채점하지 않고');
  expect(result.memo).toBe('- Invented announcement');
  expect(JSON.stringify([result.progress,result.homework,result.memo])).not.toContain('P1');
  expect(result.blockers).toEqual([]);expect(result.approval).toBe('not_granted_by_rendering');
});
test('unknown clinic header blocks homework only and memo respects lesson part',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  const result=renderLessonJournal({...input,part:2,homework:{...input.homework,qualification:'unresolved_header'}});
  expect(result.blockers).toEqual(['homework:unresolved_original_header']);expect(result.progress).toContain('검사 완료');expect(result.memo).toBe('');
});
test('unattributed mappings and literal internal codes fail closed instead of reaching parent text',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  expect(()=>renderLessonJournal({...input,progress:[{...input.progress[0]!,content:[{...mapping,evidenceRefs:[]}]}]})).toThrow('journal_evidence_required');
  expect(()=>renderLessonJournal({...input,progress:[{...input.progress[0]!,detail:'P2'}]})).toThrow('internal_code_in_parent_text');
});
test('overlong fields are blocked without silent truncation or completing ungraded work',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  const result=renderLessonJournal({...input,progress:[{...input.progress[0]!,outcome:'worked_ungraded',detail:'가'.repeat(201)}]});
  expect(result.progress).toContain('미채점');expect(result.progress).toContain('가'.repeat(201));expect(result.blockers).toContain('progress:source_width_exceeded');
});
test('reviewer negatives reject coercible enums, blank source unit code and attached internal labels',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  for(const invalid of [
    {...input,progress:[{...input.progress[0],activity:['wrong_clinic']}]},
    {...input,progress:[{...input.progress[0],content:[{...mapping,unitCode:''}]}]},
    {...input,progress:[{...input.progress[0],detail:'P1_done'}]},
  ])expect(()=>renderLessonJournal(invalid as unknown as Parameters<typeof renderLessonJournal>[0])).toThrow();
});
test('multiple same-edition units share one book label without losing literal codes or names',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  const result=renderLessonJournal({...input,progress:[{...input.progress[0]!,content:[mapping,{...mapping,unitCode:'2-1',unitName:'Invented fractions'}]}]});
  expect(result.progress.split('Invented Gauss Volume 1').length).toBe(2);expect(result.progress).toContain('1-6 Invented rounding');expect(result.progress).toContain('2-1 Invented fractions');
});
test('activity wording does not repeat problem solving and excluded memo evidence is not rendered provenance',async()=>{
  const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
  const result=renderLessonJournal({...input,part:2,progress:[{...input.progress[0]!,activity:'solving',outcome:'worked_ungraded'}]});
  expect(result.progress).not.toContain('문제풀이 문제풀이');expect(result.evidenceRefs).not.toContain('teacher:invented-memo');
});
test('teacher-format revision gives each semantic entry one hyphen line, not each sentence',async()=>{
 const {renderLessonJournal}=await import('../../src/lms/lessonJournalTemplates');
 const result=renderLessonJournal({...input,progress:[input.progress[0]!,{...input.progress[0]!,activity:'daily_test',outcome:'not_performed'}],homework:{...input.homework,tasks:[input.homework.tasks[0]!,{...input.homework.tasks[0]!,action:'prestudy'}]},memo:[...input.memo,{text:'- Invented second notice. Its explanation stays in this entry.',parts:[1],evidenceRefs:['teacher:invented-notice']}]});
 expect(result.templateRevision).toBe('2');for(const value of [result.progress,result.homework,result.memo]){expect(value.split('\n')).toHaveLength(2);expect(value.split('\n').every(line=>line.startsWith('- ')&&!line.startsWith('- - '))).toBe(true);}
 expect(result.homework.match(/01\/07/g)).toHaveLength(1);expect(result.homework.split('\n')[0]).toContain('집에서는 채점하지 않고');expect(result.memo.split('\n')[1]).toBe('- Invented second notice. Its explanation stays in this entry.');
});
