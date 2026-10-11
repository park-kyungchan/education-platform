import { describe, expect, test } from 'bun:test';
import { normalizeCohortDiscovery } from '../../src/academy/sourceBridge';

const raw = { schemaVersion:1, teacherLabel:'Invented Teacher', principalKey:'99001', collegeKey:'88001', observedAt:'2090-01-03T00:00:00Z', source:'native_browser_managed_auth',academyMutations:0,
  students:[{name:'Invented Learner',observedAt:'2090-01-03T00:00:00Z',courseRows:[{cells:['Invented grade','Invented Teacher','Invented Learner','2090-01-01~2090-01-02\nInvented course','ver.fixture','Invented active','Non-invoked controls'],handlers:['onChangeStatus(0,88001,91001,71001,81001)','onResetCourse(71001,91001,88001)','onDeleteCourse(88001,91001,71001,81001)']}],
    bookRows:[{cells:['Invented Learner','Invented course\nInvented edition','20 %','Non-invoked control','Non-invoked control'],bindings:["createBookIncorrectPapers('71001','61001','91001')"]}]}]};
describe('native source identity and book bridge',()=>{
  test('direct HTTP keeps its own provenance without relabeling retained browser evidence',()=>{
    const direct=normalizeCohortDiscovery({...raw,source:'direct_http_api'},['Invented Learner']);
    const legacy=normalizeCohortDiscovery(raw,['Invented Learner']);
    expect(direct.students[0].registration.id).toBe(legacy.students[0].registration.id);
    expect(direct.students[0].registration.proofRefs[0]).toStartWith('direct-http-capture:');
    expect(direct.students[0].books[0].payload.evidenceRefs[0]).toStartWith('direct-http-field-proof:');
    expect(legacy.students[0].registration.proofRefs[0]).toStartWith('native-capture:');
    expect(()=>normalizeCohortDiscovery({...raw,source:'guessed_transport'},['Invented Learner'])).toThrow('invalid_cohort_scope');
    expect(()=>normalizeCohortDiscovery({...raw,source:'direct_http_api',academyMutations:1},['Invented Learner'])).toThrow('invalid_cohort_scope');
  });
  test('binds independent literal source tuples and preserves unknown effective dates and teacher book roles',()=>{
    const result=normalizeCohortDiscovery(raw,['Invented Learner']);
    expect(result.students.length).toBe(1);
    expect(result.students[0].registration.sourceKey.literalKey).toBe('91001');
    expect(result.students[0].books[0].payload.sourceBook.literalKey).toBe('61001');
    expect(result.students[0].books[0].payload.assignmentValidity.state).toBe('unknown');
    expect(result.students[0].books[0].payload.role.state).toBe('unknown');
    expect(result.catalog[0].sourceKey.namespace).toBe('academy_book');
    expect(()=>normalizeCohortDiscovery({...raw,teacherLabel:'Foreign Teacher'},['Invented Learner'])).toThrow('source_teacher_binding');
  });
  test('a newer observation clock alone does not manufacture a changed book-source payload',()=>{
    const first=normalizeCohortDiscovery(raw,['Invented Learner']);
    const newer=normalizeCohortDiscovery({...raw,observedAt:'2090-01-04T00:00:00Z',students:raw.students.map(student=>({...student,observedAt:'2090-01-04T00:00:00Z'}))},['Invented Learner']);
    expect(newer.students[0].books[0].payload).toEqual(first.students[0].books[0].payload);
  });
});
