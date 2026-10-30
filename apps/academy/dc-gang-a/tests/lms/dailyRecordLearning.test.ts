import {expect,test} from 'bun:test';
import {createDailyRecordLearningReviewer,qualifyLearningCatalog,resolveLearningNotation,type LearningBook,type LearningCatalog,type LearningEntry} from '../../src/lms/dailyRecordLearning';
import {parentDailyRecordLines} from '../../src/academy/teacherWorkspace';
const refs=['fictional-teacher-source'];
const unit=(unitRef:string,code='2-4')=>({unitRef,code,title:'가상 단원',kind:'minor' as const,evidenceRefs:refs,sections:[{sectionRef:unitRef+':a',label:'실력다지기',basis:'source_catalog' as const,evidenceRefs:refs},{sectionRef:unitRef+':b',label:'실력올리기',basis:'source_catalog' as const,evidenceRefs:refs}]});
const book=(bookRef:string,series=1):LearningBook=>({studentRef:'fictional-student',bookRef,label:`가우스 초5-1 시리즈${series} v1`,brand:'가우스',schoolLevel:'elementary',grade:5,term:1,series,seriesKind:'numbered',edition:'v1',bindingState:'confirmed',evidenceRefs:refs,units:[unit(bookRef+':unit')]});
const catalog=():LearningCatalog=>({schemaVersion:'academy.learning-catalog/1',coverage:'observed_only',books:[book('fictional-book')]});
const entry=(overrides:Partial<LearningEntry>={}):LearningEntry=>({bookRef:'fictional-book',unitRef:'fictional-book:unit',scope:'sections',sectionRefs:['fictional-book:unit:a'],activity:'문제풀이',deadline:null,...overrides});
test('three parts select series; four select major/minor independently and ambiguity always interviews',()=>{
 const c=catalog();c.books.push(book('fictional-series2',2));c.books[1]!.units[0]!.code='4-1';
 expect(resolveLearningNotation(c,'fictional-student','가우스 5-1-2')).toMatchObject({status:'resolved',kind:'book',bookRef:'fictional-series2'});
 expect(resolveLearningNotation(c,'fictional-student','가우스 5-1-2-4')).toMatchObject({status:'resolved',kind:'minor_unit',bookRef:'fictional-book'});
 c.books[1]!.units[0]!.code='2-4';expect(resolveLearningNotation(c,'fictional-student','가우스 5-1-2-4').status).toBe('interview_required');
 for(const n of ['5-1-2-4','가우스 5-1','가우스 5-1-2-4-1','다른교재 5-1-2'])expect(resolveLearningNotation(c,'fictional-student',n).status).toBe('interview_required');
 expect(resolveLearningNotation(c,'foreign-student','가우스 5-1-2').status).toBe('interview_required');
});
test('group every section only for identical edition/unit/activity/deadline',()=>{
 const c=catalog(),r=createDailyRecordLearningReviewer(c),a=entry(),b=entry({sectionRefs:['fictional-book:unit:b']});
 expect(r.render('fictional-student',[a,b])).toBe('- 가우스5-1-1 2-4 가상 단원 실력다지기·실력올리기 문제풀이');
 expect(r.render('fictional-student',[a,{...b,activity:'오답 정리'}]).split('\n')).toHaveLength(3);
 expect(r.render('fictional-student',[a,{...b,deadline:'2040-01-17'}]).split('\n')).toHaveLength(5);
 c.books[0]!.units.push(unit('different-unit','2-5'));const r2=createDailyRecordLearningReviewer(c);
 expect(r2.render('fictional-student',[a,entry({unitRef:'different-unit',sectionRefs:['different-unit:a']})]).split('\n')).toHaveLength(3);
 expect(r.review('fictional-student','- arbitrary text',[a]).blockers).toEqual(['learning_render_mismatch']);
});
test('shared deadline and book appear once while distinct sections and activity tracks remain visible',()=>{
 const c=catalog();c.books[0]!.units.push(unit('second','2-5'));const r=createDailyRecordLearningReviewer(c);
 const rows=[entry({deadline:'2040-01-17',activity:'원본 오답클리닉'}),entry({sectionRefs:['fictional-book:unit:b'],deadline:'2040-01-17',activity:'원본 오답클리닉'}),entry({unitRef:'second',sectionRefs:['second:a'],deadline:'2040-01-17',activity:'유사문제 클리닉'})];
 const text=r.render('fictional-student',rows);
 expect(text.match(/1월 17일\(화\)까지/g)).toHaveLength(1);expect(text.match(/가우스5-1-1/g)).toHaveLength(1);
 expect(text).toContain('2-4 가상 단원 실력다지기·실력올리기 오답클리닉');
 expect(text).toContain('2-5 가상 단원 실력다지기 유사문제 클리닉');expect(text).not.toContain('원본');
 expect(parentDailyRecordLines.test(text)).toBe(true);expect(r.review('fictional-student',text,rows).blockers).toEqual([]);
});
test('whole minor units group only for the same book, activity and deadline',()=>{
 const c=catalog();c.books[0]!.units.push(unit('second','2-5'),unit('third','2-6'));const r=createDailyRecordLearningReviewer(c);
 const base=entry({scope:'unit',sectionRefs:[],activity:'DailyTest 완료'});
 const text=r.render('fictional-student',[base,{...base,unitRef:'second'},{...base,unitRef:'third',activity:'오답 수정'}]);
 expect(text).toContain('2-4·2-5 DailyTest 완료');expect(text).toContain('2-6 가상 단원 오답 수정');
 expect(text).not.toContain('2-4·2-5·2-6');
});
test('different or unknown deadlines never inherit a shared date and track labels stay distinct',()=>{
 const c=catalog();c.books[0]!.units.push(unit('second','2-5'),unit('third','2-6'));const r=createDailyRecordLearningReviewer(c);
 const base=entry({scope:'unit',sectionRefs:[],activity:'원본 오답클리닉',deadline:'2040-01-17'});
 const text=r.render('fictional-student',[base,{...base,unitRef:'second',deadline:'2040-01-18'},{...base,unitRef:'third',deadline:null}]);
 const lines=text.split('\n');expect(lines[0]).toBe('- 가우스5-1-1');
 expect(lines[1]).toContain('2-6 가상 단원');expect(lines[1]).not.toContain('2040-');
 expect(lines[2]).toBe('- 1월 17일(화)까지');expect(lines[4]).toContain('2-4 가상 단원');
 expect(lines[5]).toBe('- 1월 18일(수)까지');expect(lines[7]).toContain('2-5 가상 단원');
 const collision=r.render('fictional-student',[base,{...base,activity:'오답클리닉'}]);
 expect(collision).toContain('원본 오답클리닉');expect(collision).toContain('가상 단원 오답클리닉');
});
test('cross-student/book/unit/section joins and unknown aliases are held',()=>{
 const r=createDailyRecordLearningReviewer(catalog());
 expect(r.review('foreign-student','', [entry()]).blockers).toContain('student_book_binding_unverified_ask_teacher');
 expect(r.review('fictional-student','', [entry({unitRef:'another-unit'})]).blockers).toContain('book_unit_unverified_ask_teacher');
 for(const sectionRefs of [['foreign-section'],['실력쌓기']])expect(r.review('fictional-student','',[entry({sectionRefs})]).blockers).toContain('edition_unit_section_unverified_ask_teacher');
 expect(r.review('fictional-student','',undefined).blockers).toContain('learning_entries_required');
});
test('catalog cloning prevents later widening and presence never establishes homework',()=>{
 const c=catalog(),r=createDailyRecordLearningReviewer(c);c.books[0]!.studentRef='foreign-student';
 expect(r.review('foreign-student','',[entry()]).blockers).toContain('student_book_binding_unverified_ask_teacher');
 expect(r.render('fictional-student',[entry()])).toStartWith('- ');expect(qualifyLearningCatalog(catalog()).coverage).toBe('observed_only');
});
test('parent book notation uses grade, term and supported volume without internal labels',()=>{
 const c=catalog(),r=createDailyRecordLearningReviewer(c),value=r.render('fictional-student',[entry({deadline:'2040-01-17'})]);
 expect(value).toContain('1월 17일(화)까지 가우스5-1-1');expect(value).not.toContain('시리즈');expect(value).not.toContain('v1');
 c.books.push({...book('another-edition'),edition:'v2'});
 expect(createDailyRecordLearningReviewer(c).review('fictional-student','',[entry(),entry({bookRef:'another-edition',unitRef:'another-edition:unit',sectionRefs:['another-edition:unit:a']})]).blockers).toContain('book_parent_notation_ambiguous_ask_teacher');
});
test('chapter assessment retains major identity and middle Davinci has no inferred series',()=>{
 const c=catalog();c.books[0]!.units=[{...unit('chapter','2'),kind:'chapter_assessment',title:'대단원총괄평가'}];
 expect(createDailyRecordLearningReviewer(c).render('fictional-student',[entry({unitRef:'chapter',scope:'unit',sectionRefs:[]})])).toContain('2단원 대단원총괄평가');
 c.books[0]!.units[0]!.code='2-0';expect(()=>qualifyLearningCatalog(c)).toThrow('assessment_major_only');
 const d=catalog();Object.assign(d.books[0]!,{brand:'다빈치',schoolLevel:'middle',grade:1});expect(()=>qualifyLearningCatalog(d)).toThrow('middle_davinci_has_no_series');
 Object.assign(d.books[0]!,{series:null,seriesKind:'not_applicable'});expect(()=>qualifyLearningCatalog(d)).not.toThrow();
});
test('parent fields require literal hyphen and LF on every line',()=>{
 expect(parentDailyRecordLines.test('- 단원 섹션 풀이\n- 다른 단원 오답 정리')).toBe(true);
 for(const text of ['1. 항목','### 제목','내용','- 내용\n들여쓰기','- 내용\r\n- 내용','- 내용\n\n- 내용',''])expect(parentDailyRecordLines.test(text)).toBe(false);
});
