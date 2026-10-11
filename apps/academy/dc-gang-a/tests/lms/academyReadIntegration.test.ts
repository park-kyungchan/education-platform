import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAcademyReadPlan } from '../../src/lms/academyReadProtocol';
import { createAcademySourceAudit } from '../../src/lms/academySourceAudit';
import { endpointCli } from '../../harness/endpoints';

const courseSnapshot = () => ({
  schemaVersion: 1, family: 'student_course', status: 'observed', records: [], dailyResults: [], dayRecords: [],
  studentCourseScope: { teacherLabel: 'Invented Teacher', studentKey: '9101', studentName: 'Invented Student' },
  studentCourses: [{ identity: { sourceNamespace: 'academy_student_course', studentKey: '9101', collegeKey: '5101', courseKey: '6101', userCourseKey: '7101' },
    sourceCells: ['Invented Student', 'Invented course', '2099-01-01', '2099-12-31', 'Source status', 'Control', 'Control'],
    coverage: 'observed_row_not_all_assignments_or_pagination', handlersInvoked: false }],
  observedAt: '2099-01-01T00:00:00Z', coverage: 'observed_rows_not_all_assignments_or_pagination',
  unknownStates: ['effective_course_dates', 'complete_enrollment_pagination'], nativePrintInvoked: false, automaticRetryAllowed: false,
});

test('student-course normalized audit preserves scope, literal cells and empty-query meaning', () => {
  const input = courseSnapshot();
  const audit = createAcademySourceAudit(input);
  expect(audit.content).toMatchObject({ sourceNamespace: 'academy_student_course', requestedScope: input.studentCourseScope, rows: input.studentCourses });
  expect(audit.productionWriteAuthorized).toBe(false);
  const later = courseSnapshot(); later.observedAt = '2099-01-02T00:00:00Z';
  expect(createAcademySourceAudit(later).contentDigest).toBe(audit.contentDigest);
  const empty = createAcademySourceAudit({ ...input, studentCourses: [] });
  expect(empty.entities).toHaveLength(0);
  expect(empty.content).toMatchObject({ queryMeaning: 'absence_of_rows_does_not_establish_not_performed' });
  expect(() => createAcademySourceAudit({ ...input, studentCourses: [{ ...input.studentCourses[0], identity: { ...input.studentCourses[0]!.identity, studentKey: '9102' } }] })).toThrow('source_scope_conflict');
  expect(() => createAcademySourceAudit({ ...input, studentCourses: [...input.studentCourses, ...input.studentCourses] })).toThrow('duplicate_source_identity');
  expect(() => createAcademySourceAudit({ ...input, studentCourses: [{ ...input.studentCourses[0], handlersInvoked: true }] })).toThrow('invalid_course_audit');
});

test.each(['student_course', 'item_metadata', 'item_answer'] as const)('public %s preparation uses the same exclusive private CLI boundary', async family => {
  const home = mkdtempSync(join(tmpdir(), 'academy-integrated-'));
  const previous = process.env.HERMES_HOME;
  try {
    process.env.HERMES_HOME = home;
    const dir = join(home, 'cache', 'scratch'); mkdirSync(dir, { recursive: true });
    const request = family === 'student_course'
      ? { family, teacherLabel: 'Invented Teacher', studentKey: '9101', studentName: 'Invented Student' }
      : family === 'item_answer' ? {family,teacherLabel:'Invented Teacher',teacherKey:'9101',lectureKeys:['8201'],answerReadAdmission:true}
      : { family, teacherLabel: 'Invented Teacher', lectureKey: '8201' };
    const input = join(dir, 'request.json'), output = join(dir, 'prepared.js');
    writeFileSync(input, JSON.stringify(request));
    const receipt = await endpointCli(['--prepare-legacy-browser-read', input, '--output-script', output]);
    expect(receipt).toMatchObject({ prepared: true, family, networkRequests: 0, recordsRequested: 1 });
    expect(JSON.stringify(receipt)).not.toContain('Invented Student');
    expect(readFileSync(output, 'utf8')).toContain(family === 'student_course' ? 'StudyCourse' : 'GetLectureList');
    expect(() => createAcademyReadPlan({ ...request, ownerId: 'synthetic:forged-owner' })).toThrow();
    expect(() => createAcademyReadPlan({ ...request, credential: 'synthetic_marker' })).toThrow();
  } finally {
    if (previous === undefined) delete process.env.HERMES_HOME; else process.env.HERMES_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('public DayRecord preparation binds the source-qualified columns, not caller-supplied authority', async () => {
  const home = mkdtempSync(join(tmpdir(), 'academy-day-blocked-'));
  const previous = process.env.HERMES_HOME;
  try {
    process.env.HERMES_HOME = home;
    const dir = join(home, 'cache', 'scratch'); mkdirSync(dir, { recursive: true });
    const input = join(dir, 'request.json'), output = join(dir, 'prepared.js');
    writeFileSync(input, JSON.stringify({ family: 'day_record', teacherLabel: 'Invented Teacher', date: '2099-01-01', groupIds: ['3'], studentNames: ['Invented Student'] }));
    const receipt=await endpointCli(['--prepare-legacy-browser-read', input, '--output-script', output]);
    expect(receipt).toMatchObject({prepared:true,family:'day_record',networkRequests:0});
    expect(existsSync(output)).toBe(true);
    expect(readFileSync(output,'utf8')).toContain('academy-dayrecord-column-qualification-2026-10-04.json');
  } finally {
    if (previous === undefined) delete process.env.HERMES_HOME; else process.env.HERMES_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
});

test('new audit lanes reject foreign-family data and cannot promote item metadata into mastery', () => {
  const input = courseSnapshot();
  expect(() => createAcademySourceAudit({ ...input, itemMetadata: [{}] })).toThrow('source_family_conflict');
  const item = {
    schemaVersion: 1, family: 'item_metadata', status: 'observed', records: [], dailyResults: [], dayRecords: [],
    itemMetadata: [{ identity: { sourceNamespace: 'academy_item', lectureKey: '8201', outerLectureKey: '9201', sourceId: '8201' },
      sourceUnitName: 'Invented unit', sourcePatternName: 'Invented pattern', sourceDifficulty: 2, sourcePlaySeconds: 90, conceptMapping: 'unverified' }],
    observedAt: '2099-01-01T00:00:00Z', coverage: 'one_exact_verified_item_not_all_content_or_batch_encoding',
    unknownStates: ['concept_mapping'], nativePrintInvoked: false, automaticRetryAllowed: false,
  };
  expect(createAcademySourceAudit(item).semanticClaims).toMatchObject({ mastery: 'not_established', videoWatchHistory: 'unknown' });
  expect(() => createAcademySourceAudit({ ...item, itemMetadata: [{ ...item.itemMetadata[0], mastery: true }] })).toThrow('invalid_item_audit');
  expect(() => createAcademySourceAudit({ ...item, studentCourseScope: input.studentCourseScope })).toThrow('source_scope_conflict');
});
