import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
const project = resolve(import.meta.dir, '../..');
const contractPath = resolve(project, 'docs/academy-student-evidence-contract.json');
function contract() {
  expect(existsSync(contractPath), 'Detailed student evidence design schema is absent.').toBe(true);
  return JSON.parse(readFileSync(contractPath, 'utf8'));
}
function validate(definition: string, input: unknown) {
  const document = contract();
  expect(Object.hasOwn(document.definitions, definition), 'Design definition is absent: ' + definition).toBe(true);
  const schema = { $schema: document.schemaDialect, definitions: document.definitions, $ref: '#/definitions/' + definition };
  return new AjvJsonSchemaValidator().getValidator<unknown>(schema as JsonSchemaType)(input).valid;
}
describe('student evidence design schemas, not a production DB', () => {
  test('unknown knowledge preserves a reason and rejects an invented value', () => {
    expect(validate('KnowledgeString', {state: 'unknown', reason: 'Source join not established.'})).toBe(true);
    expect(validate('KnowledgeString', {state: 'unknown', reason: 'Source join not established.', value: 'complete'})).toBe(false);
    expect(validate('KnowledgeString', {state: 'known', value: 'synthetic:edition:v1', evidenceRefs: ['synthetic:evidence:binding']})).toBe(true);
    expect(validate('KnowledgeString', {state: 'known', value: 'synthetic:edition:v1', evidenceRefs: []})).toBe(false);
  });
  test('stored attempt preserves literal source keys and cannot contain teacher completion', () => {
    const unknown = {state: 'unknown', reason: 'Not bound by this source.'};
    const attempt = {
      kind: 'assessment_attempt', entityId: 'synthetic:attempt:a',
      partition: {ownerId: 'synthetic:teacher:a', studentId: 'synthetic:student:a'},
      sourceAttempt: {namespace: 'synthetic:textbook_attempt', literalKey: '001'},
      sourcePaper: unknown, occurrenceId: unknown,
      scope: {editionId: unknown, unitId: unknown, pageIds: unknown, problemIds: unknown},
      sourceTime: unknown, observedAt: '2026-01-05T01:00:00Z',
      originalScore: 86, contractRef: 'synthetic:contract:score-only:v1',
      items: [{originalOrdinal: '1', sourceItem: unknown, storedResult: 'X'}],
    };
    expect(validate('AssessmentAttempt', attempt)).toBe(true);
    expect(validate('AssessmentAttempt', {...attempt, corrected: true, mastered: true})).toBe(false);
    expect(validate('AssessmentAttempt', {...attempt, sourceAttempt: {...attempt.sourceAttempt, literalKey: 1}})).toBe(false);
    expect(validate('AssessmentAttempt', {...attempt, items: [{...attempt.items[0], storedResult: 'complete'}]})).toBe(false);
  });
  test('revision DTO keeps an agent draft separate from explicit teacher inspection', () => {
    const unknown = {state: 'unknown', reason: 'No exact binding yet.'};
    const revision = {
      schemaVersion: 1, kind: 'teacher_revision',
      partition: {ownerId: 'synthetic:teacher:a', studentId: 'synthetic:student:a'},
      revisionId: 'synthetic:revision:a', entityId: 'synthetic:note:a', sequence: 1,
      previousRevisionId: null, previousDigest: null, idempotencyKey: 'synthetic:request:a',
      actorId: 'synthetic:agent:a', actorRole: 'agent_draft', recordedAt: '2026-01-05T01:00:00Z',
      reason: 'Synthetic proposed note.', commandDigest: 'a'.repeat(64), integrityDigest: 'b'.repeat(64),
      payload: {recordKind: 'model_draft', assertion: 'draft', statement: 'Synthetic draft, not a teacher judgment.',
        occurrenceId: unknown, scope: {editionId: unknown, unitId: unknown, pageIds: unknown, problemIds: unknown},
        evidenceRefs: [], reviewedTargets: []},
    };
    expect(validate('TeacherRevision', revision)).toBe(true);
    const inspection = {...revision, actorId: 'synthetic:teacher:a', actorRole: 'teacher',
      payload: {...revision.payload, recordKind: 'inspection', assertion: 'teacher_inspected',
        evidenceRefs: ['synthetic:evidence:written-work'], reviewedTargets: ['synthetic:problem:a']}};
    expect(validate('TeacherRevision', inspection)).toBe(true);
    expect(validate('TeacherRevision', {...inspection, actorRole: 'agent_draft'})).toBe(false);
    expect(validate('TeacherRevision', {...inspection, payload: {...inspection.payload, reviewedTargets: []}})).toBe(false);
    expect(validate('TeacherRevision', {...revision, sequence: 2})).toBe(false);
    expect(validate('TeacherRevision', {...inspection, payload: {...inspection.payload, originalScore: 100}})).toBe(false);
  });
  test('source evidence cannot turn a missing row into a not-performed assertion', () => {
    const unknown = {state: 'unknown', reason: 'Not independently observed.'};
    const evidence = {
      kind: 'source_evidence', entityId: 'synthetic:evidence:a',
      partition: {ownerId: 'synthetic:teacher:a', studentId: 'synthetic:student:a'},
      activityKind: 'wrong_clinic', stage: 'written_solving', assertion: 'reported',
      sourceRecord: unknown, occurrenceId: unknown,
      scope: {editionId: unknown, unitId: unknown, pageIds: unknown, problemIds: unknown},
      sourceTime: unknown, observedAt: '2026-01-05T01:00:00Z',
      contractRef: 'synthetic:contract:teacher-report', evidenceRefs: ['synthetic:teacher:statement'],
      teacherDirective: unknown, mediaRefs: [], summary: 'Student reports solving; teacher inspection is not recorded.',
    };
    expect(validate('SourceEvidence', evidence)).toBe(true);
    expect(validate('SourceEvidence', {...evidence, assertion: 'not_performed'})).toBe(false);
    expect(validate('SourceEvidence', {...evidence, stage: 'teacher_report', assertion: 'not_performed',
      teacherDirective: {state: 'known', value: 'synthetic:teacher:explicit-statement', evidenceRefs: ['synthetic:teacher:statement']}})).toBe(true);
    expect(validate('SourceEvidence', {...evidence, mastery: true})).toBe(false);
  });
  test('unresolved source intake does not fabricate a student partition', () => {
    const intake = {kind: 'unresolved_intake', entityId: 'synthetic:intake:a', ownerId: 'synthetic:teacher:a',
      sourceRecord: {namespace: 'synthetic:prestudy', literalKey: '001'},
      candidateStudentIds: {state: 'unknown', reason: 'Name-only source, no independent student key.'},
      issue: 'missing_source_binding', summary: 'Synthetic unresolved source.',
      evidenceRefs: ['synthetic:evidence:list'], observedAt: '2026-01-05T01:00:00Z'};
    expect(validate('UnresolvedIntake', intake)).toBe(true);
    expect(validate('UnresolvedIntake', {...intake, studentId: 'synthetic:student:a'})).toBe(false);
    expect(validate('UnresolvedIntake', {...intake, partition: {ownerId: 'synthetic:teacher:a', studentId: 'synthetic:student:a'}})).toBe(false);
  });
  test('month-day source precision is preserved without an invented year or grade timestamp', () => {
    const time = {state: 'known', value: {literal: '09-30', precision: 'month_day',
      timeZone: {state: 'unknown', reason: 'Source did not provide a zone.'}, meaning: 'source_apply_date'},
      evidenceRefs: ['synthetic:evidence:source-date']};
    expect(validate('KnowledgeTime', time)).toBe(true);
    expect(validate('KnowledgeTime', {...time, value: {...time.value, year: 2026}})).toBe(false);
    expect(validate('KnowledgeTime', {...time, observedAt: '2026-01-05T01:00:00Z'})).toBe(false);
  });
  test('shared paper definition is not a per-student assignment or print receipt', () => {
    const unknown = {state: 'unknown', reason: 'Not independently joined.'};
    const paper = {kind: 'paper_instance', entityId: 'synthetic:paper:a', ownerId: 'synthetic:teacher:a',
      resourceKind: 'wrong_clinic', sourcePaper: unknown, originPaper: unknown,
      scope: {editionId: unknown, unitId: unknown, pageIds: unknown, problemIds: unknown},
      sourceVersion: unknown, printedRepresentation: unknown, evidenceRefs: ['synthetic:teacher:paper-reference']};
    expect(validate('PaperInstance', paper)).toBe(true);
    expect(validate('PaperInstance', {...paper, studentId: 'synthetic:student:a', printed: true})).toBe(false);
  });
  test('a retained empty-query observation is not a nonperformance claim', () => {
    const unknown = {state: 'unknown', reason: 'No complete expected target inventory.'};
    const observation = {kind: 'coverage_observation', entityId: 'synthetic:coverage:a', ownerId: 'synthetic:teacher:a',
      requestedScope: {kind: 'student_period', studentId: 'synthetic:student:a', fromDate: '2026-01-01', toDate: '2026-01-31', timeZone: 'Asia/Seoul'},
      sourceContractRef: 'synthetic:contract:name-query', expectedTargets: unknown, observedRefs: [], observedCount: 0,
      coverage: 'not_observed', observedAt: '2026-01-05T01:00:00Z', evidenceRefs: ['synthetic:qualified-query:receipt'],
      meaning: 'absence_of_rows_does_not_establish_not_performed'};
    expect(validate('CoverageObservation', observation)).toBe(true);
    expect(validate('CoverageObservation', {...observation, notPerformed: true})).toBe(false);
    expect(validate('CoverageObservation', {...observation, meaning: 'student_did_not_work'})).toBe(false);
  });
  test('every named data definition compiles and every student-bound DTO has a partition', () => {
    const document = contract();
    for (const name of Object.keys(document.definitions)) {
      const schema = {$schema: document.schemaDialect, definitions: document.definitions, $ref: '#/definitions/' + name};
      expect(() => new AjvJsonSchemaValidator().getValidator<unknown>(schema as JsonSchemaType)).not.toThrow();
    }
    for (const name of document.recordGroups.studentBound) {
      expect(document.definitions[name].required).toContain('partition');
      expect(document.definitions[name].additionalProperties).toBe(false);
    }
  });
});
