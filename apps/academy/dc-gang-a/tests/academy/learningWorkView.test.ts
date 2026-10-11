import {describe,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {known,unknown} from '../../src/learning/model';
import {buildStudentPreparation} from '../../src/academy/preparationHistory';
import {buildTeacherWorkContext,type TeacherWorkContext} from '../../src/academy/teacherWorkContext';
import {learningWorkView} from '../../src/academy/web/learningWorkView';

// Explicit renderer-only synthetic data. This fixture certifies neither source intake nor native GUI.
function fixture():TeacherWorkContext {
  const studentKey={namespace:'academy_student',literalKey:'fixture-student'},date='2025-01-02';
  const base=buildTeacherWorkContext({studentId:'fixture-student',studentKey,date,revision:'fixture-scene-r1',catalog:[],preparation:buildStudentPreparation(studentKey,[],date),versions:[]});
  const sourceBook={namespace:'academy_book',literalKey:'fixture-book'},sourceMinorUnit={namespace:'academy_minor_unit',literalKey:'fixture-minor'};
  const sourceCourse=(literalKey:string)=>({namespace:'academy_course',literalKey});
  return {...base,data:{...base.data,
    curriculum:[
      {id:'book',kind:'book_edition',sourceKey:sourceBook,label:'Invented book',parent:unknown('root')},
      {id:'major',kind:'major_unit',sourceKey:{namespace:'fixture_major',literalKey:'major'},label:'Invented major',parent:known('book',['fixture'])},
      {id:'middle',kind:'middle_unit',sourceKey:{namespace:'fixture_middle',literalKey:'middle'},label:'Invented middle',parent:known('major',['fixture'])},
      {id:'minor',kind:'minor_unit',sourceKey:sourceMinorUnit,label:'Invented minor',parent:known('middle',['fixture'])},
    ],
    books:['course-a','course-b'].map((course,index)=>({catalogNodeId:'book',sourceBook,sourceCourse:sourceCourse(course),displayName:'Invented book',revisionRef:'fixture-registration-'+index,sourceObservedAt:'2025-01-01T01:00:00Z',lastVerifiedAt:'2025-01-02T02:00:00Z'})),
    sourceResults:[100,75].map((score,index)=>({revisionRef:'fixture-grade-'+index,entityRef:'fixture-evidence-'+index,sourceObservedAt:'2025-01-01T01:00:00Z',lastVerifiedAt:'2025-01-02T02:00:00Z',recordedAt:'2025-01-02T02:00:01Z',bookBinding:'current_registration',sectionBinding:'unknown',teacherCompletion:'not_inferred',record:{studentKey:'fixture-student',studentName:'Invented Learner',courseKey:'course-a',bookNo:'fixture-book',paperKey:'51001',attemptKey:String(41001+index),sourceTitle:index?'Invented section':'<img src=x onerror=alert(1)>',score,items:[{originalOrdinal:'1',lectureKey:'31001',outerLectureKey:'21001',scoring:'O'}],sourceDate:{literal:'01-02',precision:'month_day',meaning:'source_apply_date_not_exact_grade_time'}}})),
    unitWork:[
      {sourceBook,sourceCourse:sourceCourse('course-a'),sourceMinorUnit,duty:'current_duty',teacherActivities:[],evidenceGrain:'minor_unit_not_section_paper_or_item'},
      {sourceBook,sourceCourse:sourceCourse('course-b'),sourceMinorUnit,duty:'outside_current_audit_scope',teacherActivities:[],evidenceGrain:'minor_unit_not_section_paper_or_item'},
    ],
  }};
}

function render(check:(panel:HTMLElement,context:TeacherWorkContext)=>void){
  const dom=new JSDOM('<!doctype html><body></body>'),previous=globalThis.document;
  try{globalThis.document=dom.window.document;const context=fixture();check(learningWorkView(context,context.scene),context);}
  finally{globalThis.document=previous;dom.window.close();}
}

describe('course-bound learning workbench source rendering',()=>{
  test('renders original source grades as safe inline rails without turning score into teacher completion',()=>render(panel=>{
    const rows=[...panel.querySelectorAll<HTMLDetailsElement>('details.record[data-source-evidence]')];
    expect(rows).toHaveLength(2);
    expect(panel.querySelector('h4.source-record-heading')?.textContent).toBe('보존된 채점 근거');
    expect(panel.querySelector('img')).toBeNull();
    expect(rows[0]!.querySelector('summary')!.textContent).toContain('100');
    expect(rows[0]!.querySelector('summary')!.textContent).toContain('교사 판단 별도');
    expect(rows[0]!.textContent).toContain('연도 미확인');
    expect(rows[0]!.textContent).toContain('섹션 연결 미확인');
    expect(rows[0]!.querySelector('.inline-evidence')).not.toBeNull();
    rows[1]!.querySelector('summary')!.click();expect(rows[1]!.open).toBe(true);expect(rows[0]!.open).toBe(false);
  }));
  test('keeps every course duty identifiable when a shared book tree has no clinic records',()=>render(panel=>{
    expect(panel.querySelectorAll('li[data-catalog-id="book"]')).toHaveLength(1);
    const a=panel.querySelector('.course-work[data-course-key="course-a"]');
    const b=panel.querySelector('.course-work[data-course-key="course-b"]');
    expect(a?.textContent).toContain('과정 course-a');expect(a?.textContent).toContain('누적 점검 대상');
    expect(b?.textContent).toContain('과정 course-b');expect(b?.textContent).toContain('현재 누적 점검 범위 밖');
    expect(a?.getAttribute('data-course-namespace')).toBe('academy_course');
    expect(a?.textContent).not.toContain('course-b');expect(b?.textContent).not.toContain('과정 course-a');
  }));
  test('names the region and exposes exact per-course provenance without a freshness or completion claim',()=>render((panel,context)=>{
    const title=panel.querySelector('h3')!;
    expect(title.id).not.toBe('');expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel.textContent).toContain('기준 수업일 2025-01-02');
    expect(panel.querySelector('.scene-evidence')?.textContent).toContain(context.scene.revision);
    const evidence=panel.querySelector('.registration-evidence')!;
    expect(evidence).not.toBeNull();
    expect(evidence.textContent).toContain('원천 관측');expect(evidence.textContent).toContain('마지막 확인');
    for(const book of context.data.books){
      expect(evidence.textContent).toContain(book.sourceCourse.literalKey);
      expect(evidence.textContent).toContain(book.sourceObservedAt);expect(evidence.textContent).toContain(book.lastVerifiedAt);
      expect(evidence.textContent).toContain(book.revisionRef);
    }
    expect(panel.textContent).toContain('현재 원천 접속이나 최신성을 보장하지 않습니다');
    expect(panel.querySelectorAll('button')).toHaveLength(0);
    expect(panel.textContent).toContain('문항별 완료 입력은');
  }));
});
