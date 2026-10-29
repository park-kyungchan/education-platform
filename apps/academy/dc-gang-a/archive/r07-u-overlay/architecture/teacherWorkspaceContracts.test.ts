import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import type { JsonSchemaType } from '@modelcontextprotocol/sdk/validation/types.js';
const project = resolve(import.meta.dir, '../..');
const studentPath = resolve(project, 'docs/academy-student-evidence-contract.json');
const workspacePath = resolve(project, 'docs/academy-teacher-workspace-tool-contract.json');
function documents() {
  expect(existsSync(workspacePath), 'Teacher scene/tool design contract is absent.').toBe(true);
  return {student: JSON.parse(readFileSync(studentPath, 'utf8')), workspace: JSON.parse(readFileSync(workspacePath, 'utf8'))};
}
function validate(definition: string, input: unknown) {
  const {student, workspace} = documents();
  const definitions = {...student.definitions, ...workspace.definitions};
  expect(Object.hasOwn(definitions, definition), 'Workspace design definition is absent: ' + definition).toBe(true);
  const schema = {$schema: student.schemaDialect, definitions, $ref: '#/definitions/' + definition};
  return new AjvJsonSchemaValidator().getValidator<unknown>(schema as JsonSchemaType)(input).valid;
}
describe('teacher scene and WebMCP design contracts, not browser interoperability', () => {
  test('student query input has exact scene/student/period scope and no owner or executor override', () => {
    const input = {
      scene: {sceneId: 'synthetic:scene:student:a', sceneRevision: 'synthetic:scene-revision:1'},
      studentId: 'synthetic:student:a', period: {fromDate: '2026-01-01', toDate: '2026-01-31'},
      timeZone: 'Asia/Seoul', page: {limit: 20}, revisionSelection: {mode: 'current_view'},
    };
    expect(validate('StudentLearningInput', input)).toBe(true);
    expect(validate('StudentLearningInput', {...input, ownerId: 'synthetic:other-owner'})).toBe(false);
    expect(validate('StudentLearningInput', {...input, url: 'https://example.invalid/raw', sql: 'SELECT *'})).toBe(false);
    expect(validate('StudentLearningInput', {...input, studentName: 'Synthetic name'})).toBe(false);
    expect(validate('StudentLearningInput', {...input, page: {limit: 0}})).toBe(false);
    expect(validate('StudentLearningInput', {...input, period: {fromDate: '2026-02-30', toDate: '2026-03-01'}})).toBe(false);
  });
  test('student audit history has an explicit entity/sequence range instead of a current-only timeline', () => {
    const input = {scene: {sceneId: 'synthetic:scene:student:a', sceneRevision: 'synthetic:scene-revision:1'},
      studentId: 'synthetic:student:a', timeZone: 'Asia/Seoul', page: {limit: 20},
      revisionSelection: {mode: 'retained_history', entityRef: 'synthetic:note:a', fromSequence: 1, toSequence: 5}};
    expect(validate('StudentLearningInput', input)).toBe(true);
    expect(validate('StudentLearningInput', {...input, revisionSelection: {mode: 'retained_history'}})).toBe(false);
    expect(validate('StudentLearningInput', {...input, revisionSelection: {...input.revisionSelection, fromSequence: 0}})).toBe(false);
    expect(validate('StudentLearningInput', {...input, period: {fromDate: '2026-01-01', toDate: '2026-01-31'}})).toBe(false);
  });
  test('a partial class result must retain its continuation and cannot be labelled fully observed', () => {
    const result = {
      schemaVersion: 1, toolName: 'query_class_preparation',
      scene: {sceneId: 'synthetic:scene:date:a', sceneRevision: 'synthetic:scene-revision:1'},
      status: 'partial', refusalReason: null, observedAt: '2026-01-05T01:00:00Z',
      coverage: [{sourceContractRef: 'synthetic:contract:roster', coverage: 'partial', freshness: 'last_verified',
        lastVerifiedAt: '2026-01-04T01:00:00Z', limitations: ['Only the first source page is available.']}],
      pagination: {hasMore: true, nextCursor: 'synthetic:cursor:page2'},
      data: {viewKind: 'class_preparation', lessonDate: '2026-01-05', rowCount: 0, rosterCoverage: 'partial', rows: [], unresolvedRefs: []},
    };
    expect(validate('ToolReadResult', result)).toBe(true);
    expect(validate('ToolReadResult', {...result, status: 'observed'})).toBe(false);
    expect(validate('ToolReadResult', {...result, pagination: {hasMore: true, nextCursor: null}})).toBe(false);
    expect(validate('ToolReadResult', {...result, readinessComplete: true})).toBe(false);
  });
  test('write acknowledgement distinguishes received input from readback and verified recovery', () => {
    const unknown = {state: 'unknown', reason: 'No verified persistence/recovery result.'};
    const ack = {
      schemaVersion: 1, toolName: 'record_teacher_observation',
      scene: {sceneId: 'synthetic:scene:student:a', sceneRevision: 'synthetic:scene-revision:1'},
      requestRef: 'synthetic:request:a', entityRef: 'synthetic:evidence:a', recordKind: 'source_evidence',
      stage: 'input_received', revisionRef: unknown, independentCopyRef: unknown, restoreProofRef: unknown,
      officialSaved: false, parentSent: false,
    };
    expect(validate('WriteAcknowledgement', ack)).toBe(true);
    expect(validate('WriteAcknowledgement', {...ack, stage: 'history_saved_read_back'})).toBe(false);
    const saved = {...ack, stage: 'history_saved_read_back', revisionRef: {state: 'known', value: 'synthetic:revision:a', evidenceRefs: ['synthetic:readback:a']}};
    expect(validate('WriteAcknowledgement', saved)).toBe(true);
    expect(validate('WriteAcknowledgement', {...saved, stage: 'restore_verified'})).toBe(false);
    expect(validate('WriteAcknowledgement', {...saved, officialSaved: true})).toBe(false);
    expect(validate('WriteAcknowledgement', {...saved, parentSent: true})).toBe(false);
  });
  test('projection cannot use a source observation as teacher inspection', () => {
    const known = {state: 'known', value: 'synthetic:teacher-inspection:a', evidenceRefs: ['synthetic:teacher:review:a']};
    const cell = {stage: 'teacher_inspection', sourceLiteral: known, basisType: 'teacher_review', coverage: 'fully_observed', claimRef: known};
    expect(validate('StageCell', cell)).toBe(true);
    expect(validate('StageCell', {...cell, basisType: 'source_observation'})).toBe(false);
    expect(validate('StageCell', {...cell, coverage: 'not_observed'})).toBe(false);
  });
  test('class completeness requires roster coverage and blocked results disclose no data', () => {
    const complete = {schemaVersion: 1, toolName: 'query_class_preparation',
      scene: {sceneId: 'synthetic:scene:date:a', sceneRevision: 'synthetic:scene-revision:1'},
      status: 'observed', refusalReason: null, observedAt: '2026-01-05T01:00:00Z',
      coverage: [{sourceContractRef: 'synthetic:contract:roster', coverage: 'complete', freshness: 'current', lastVerifiedAt: '2026-01-05T01:00:00Z', limitations: []}],
      pagination: {hasMore: false, nextCursor: null},
      data: {viewKind: 'class_preparation', lessonDate: '2026-01-05', rowCount: 0, rosterCoverage: 'complete', rows: [], unresolvedRefs: []}};
    expect(validate('ToolReadResult', complete)).toBe(true);
    expect(validate('ToolReadResult', {...complete, data: {...complete.data, rosterCoverage: 'unknown'}})).toBe(false);
    const blocked = {...complete, status: 'blocked', refusalReason: 'authentication_required', coverage: [], data: null};
    expect(validate('ToolReadResult', blocked)).toBe(true);
    expect(validate('ToolReadResult', {...blocked, data: complete.data})).toBe(false);
    expect(validate('ToolReadResult', {...blocked, coverage: complete.coverage})).toBe(false);
  });
  test('teacher-report input cannot carry actor/inspection/approval claims', () => {
    const unknown = {state: 'unknown', reason: 'Not bound to an occurrence.'};
    const input = {scene: {sceneId: 'synthetic:scene:student:a', sceneRevision: 'synthetic:scene-revision:1'},
      studentId: 'synthetic:student:a', occurrenceId: unknown,
      scope: {editionId: unknown, unitId: unknown, pageIds: unknown, problemIds: unknown}, activityKind: 'concept_blank_test',
      teacherDirectiveRef: 'synthetic:teacher:directive:a', statement: 'Synthetic teacher-reported observation.',
      evidenceRefs: [], entityRef: 'synthetic:evidence:a', expectedRevisionRef: null, idempotencyKey: 'synthetic:request:a'};
    expect(validate('TeacherReportInput', input)).toBe(true);
    expect(validate('TeacherReportInput', {...input, actorRole: 'teacher', teacherInspected: true, approved: true})).toBe(false);
    expect(validate('TeacherReportInput', {...input, idempotencyKey: ''})).toBe(false);
    expect(validate('TeacherReportInput', {...input, teacherDirectiveRef: ''})).toBe(false);
  });
  test('draft is an unsaved proposal and cannot claim official reflection', () => {
    const draft = {schemaVersion: 1, toolName: 'draft_lesson_review',
      scene: {sceneId: 'synthetic:scene:student:a', sceneRevision: 'synthetic:scene-revision:1'},
      studentId: 'synthetic:student:a', occurrenceRef: 'synthetic:occurrence:a', basisRefs: ['synthetic:evidence:a'],
      sections: [{section: 'lesson_memo', text: 'Synthetic proposal with unresolved source scope.'}],
      unknownIssues: ['Written solving has not been inspected.'], status: 'proposed', persistence: 'not_saved', officialSaved: false, parentSent: false};
    expect(validate('DraftProposal', draft)).toBe(true);
    expect(validate('DraftProposal', {...draft, status: 'approved', persistence: 'saved'})).toBe(false);
    expect(validate('DraftProposal', {...draft, officialSaved: true})).toBe(false);
  });
  test('registration contract does not invent a browser outputSchema field or activate a writer', () => {
    const {student, workspace} = documents();
    expect(workspace.browserRegistrationBoundary.standardFields).toEqual(['name', 'description', 'inputSchema', 'execute', 'annotations']);
    expect(workspace.browserRegistrationBoundary.status).toBe('not_registered_not_exercised');
    expect(workspace.tools).toHaveLength(5);
    for (const tool of workspace.tools) {
      expect(tool.availability).not.toBe('callable');
      expect(workspace.definitions[tool.inputDefinition]).toBeDefined();
      expect(workspace.definitions[tool.resultDefinition]).toBeDefined();
    }
    expect(workspace.tools.find((tool: {name: string}) => tool.name === 'record_teacher_observation').annotations.readOnlyHint).toBe(false);
    expect(Object.keys(workspace.definitions).filter(name => Object.hasOwn(student.definitions, name))).toEqual([]);
  });
  test('every workspace input/result/view definition compiles with the shared data definitions', () => {
    const {student, workspace} = documents();
    const definitions = {...student.definitions, ...workspace.definitions};
    for (const name of Object.keys(workspace.definitions)) {
      const schema = {$schema: student.schemaDialect, definitions, $ref: '#/definitions/' + name};
      expect(() => new AjvJsonSchemaValidator().getValidator<unknown>(schema as JsonSchemaType)).not.toThrow();
    }
    for (const scene of workspace.scenes) {
      expect(workspace.tools.some((tool: {name: string}) => tool.name === scene.primaryTool)).toBe(true);
      expect(workspace.definitions[scene.dataDefinition]).toBeDefined();
    }
  });
});
