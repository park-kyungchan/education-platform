import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPinnedAudit, type Audit } from '../../../app/student-audit-viewer/model.ts';
import { readPinnedLesson, type LessonOverlay, type TeacherEvent } from '../../../app/student-audit-viewer/lesson.ts';
import { FACETS, MAX_QUERY_BYTES, QueryRefusal, queryInputSchema, type QueryInput, type PreservedRecord, type SavedQuery, type SavedQueryResult, type SourceReference } from './contracts.ts';
import { digest, paginate } from './pagination.ts';
import {toolResultBytes,recordTransportBytes} from './tool-result.ts';

const AUDIT_PATH = 'private/student-audit-20261014/audit.json';
const LESSON_PATH = 'private/lesson-20261014/overlay.json';
interface Pin { path: string; sha256: string }
export interface SavedInputs { audit: Audit; lesson: LessonOverlay; auditHash: string; lessonHash: string }
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const classifyEvent = (event: TeacherEvent) => event.sourceKind === 'teacher_report' ? 'teacher_report' as const : 'user_supplied_context' as const;
function freezeSnapshot(value: unknown): void {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
}

export class SavedContext {
  readonly snapshotHash: string;
  readonly scope;
  constructor(readonly inputs: SavedInputs) {
    if (!/^[a-f0-9]{64}$/.test(inputs.auditHash) || !/^[a-f0-9]{64}$/.test(inputs.lessonHash)) throw new QueryRefusal('snapshot_hash_required');
    freezeSnapshot(inputs);
    this.snapshotHash = digest(inputs.auditHash + ':' + inputs.lessonHash);
    this.scope = {
      teacherLabel: '박경찬' as const,
      intendedPopulation: 'all_teacher_managed_students' as const,
      preservedStudentCount: inputs.audit.students.length,
      completeTeacherRosterVerified: false as const,
      totalTeacherManagedStudents: null,
    };
  }
  private reference(path: string, sha256: string, jsonPointer: string): SourceReference { return { path, sha256, jsonPointer }; }
  private records(query: SavedQuery): PreservedRecord[] {
    const audit = this.inputs.audit;
    const auditRef = (pointer: string) => this.reference(AUDIT_PATH, this.inputs.auditHash, pointer);
    const lessonRef = (pointer: string) => this.reference(LESSON_PATH, this.inputs.lessonHash, pointer);
    if (query.kind === 'roster') return audit.students.map((student, index) => ({
      classification: 'saved_source_record', source: auditRef(`/students/${index}`),
      value: { studentId: student.studentId, name: student.name, membershipBasis: 'preserved_authorized_managed_roster', completeTeacherRosterVerified: false },
    }));
    const index = audit.students.findIndex(student => student.studentId === query.studentId);
    if (index < 0) throw new QueryRefusal('student_not_in_preserved_roster');
    const student = audit.students[index]!;
    if (query.kind === 'student_history') return (query.facets??FACETS).flatMap(facet =>
      this.records({ kind: 'student_records', studentId: query.studentId, facet }).map(record => ({ ...record, facet })));
    const prefix = `/students/${index}`;
    const lessonIndex = this.inputs.lesson.students.findIndex(student => student.studentId === query.studentId);
    const supplement = this.inputs.lesson.students[lessonIndex];
    if (query.kind === 'student_summary') return [{
      classification: 'derived_saved_summary', source: auditRef(prefix),
      value: {
        studentId: student.studentId, name: student.name,
        observedCounts: { books: student.books.length, sectionRows: student.sections.length, historicalAttemptObservations: array(student.attempts).length, historicalVideoObservations: array(student.prepVideosHistorical).length },
        availableFacets: FACETS,
        lessonSupplementPresent: !!supplement,
        recordedHistoryCoverageClaim: student.fullCurrentHistoryVerified ?? null,
        countsMeaning: 'Preserved rows and observations; not unique assignments, current roster completeness or completion.',
      },
    }];
    if (query.kind === 'lesson_context') {
      if (query.date !== this.inputs.lesson.lessonDate || !supplement) return [];
      return [
        ...supplement.teacherEvents.map((value, row) => ({ classification: classifyEvent(value), source: lessonRef(`/students/${lessonIndex}/teacherEvents/${row}`), value })),
        ...supplement.observations.map((value, row) => ({ classification: 'source_observation_snapshot' as const, source: lessonRef(`/students/${lessonIndex}/observations/${row}`), value })),
      ];
    }
    if (query.bookEditionId && !['books', 'sections'].includes(query.facet)) throw new QueryRefusal('book_filter_not_supported_for_facet');
    if (query.bookEditionId && !student.books.some(book => book.sourceBookEditionId === query.bookEditionId)) throw new QueryRefusal('book_edition_not_in_preserved_student_scope');
    if (query.facet === 'teacher_events') return (supplement?.teacherEvents ?? []).map((value, row) => ({
      classification: classifyEvent(value), source: lessonRef(`/students/${lessonIndex}/teacherEvents/${row}`), value,
    }));
    if (query.facet === 'daily_record_drafts') return supplement?.dailyRecordDraft ? [{
      classification: 'unsaved_draft', source: lessonRef(`/students/${lessonIndex}/dailyRecordDraft`), value: supplement.dailyRecordDraft,
    }] : [];
    const field = ({ books: 'books', sections: 'sections', attempts: 'attempts', assignments: 'effectiveAssignments', videos: 'prepVideosHistorical', daily_tests: 'DTZT', daily_records: 'liveDailyRecords' } as const)[query.facet];
    const original = student[field];
    const rows = query.facet === 'daily_tests' && original && typeof original === 'object' && !Array.isArray(original)
      ? Object.entries(original).map(([key, value]) => ({ key, value })) : array(original).map((value, row) => ({ key: String(row), value }));
    return rows.filter(({ value }) => {
      if (!query.bookEditionId) return true;
      const book = value as Record<string, unknown>;
      return (query.facet === 'books' ? book.sourceBookEditionId : book.bookEditionId) === query.bookEditionId;
    }).map(({ key, value }) => ({
      classification: query.facet === 'daily_records' ? 'source_observation_snapshot' : 'saved_source_record',
      source: auditRef(`${prefix}/${field}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`), value,
    }));
  }
  query(value: unknown): SavedQueryResult {
    const input: QueryInput = queryInputSchema.parse(value);
    const base = {
      schemaVersion: 1 as const, sourceMode: 'saved_context' as const, retrievedAt: new Date().toISOString(),
      snapshot: { sha256: this.snapshotHash, collectedAt: this.inputs.audit.collectedAt, lessonDate: this.inputs.lesson.lessonDate, lessonPreparedAt: this.inputs.lesson.preparedAt },
      scope: this.scope, coverage: 'bounded_preserved_evidence' as const,
      currentAcademyServerQueried: false as const, absenceProvesNonperformance: false as const,
      unknowns: ['The complete teacher-managed roster and complete current history are not established by this preserved subset.'],
    };
    try {
      const selected = this.records(input.query);
      if(input.query.kind==='student_history')base.unknowns.push('student_history includes only the selected saved facets; dated lesson_context source observations require a separate lesson_context query.');
      // Budget both text and structuredContent, JSON escaping, worst-case cursor/page metadata and framing allowance.
      const envelope={...base,status:'partial',records:[],page:{totalInSavedSelection:selected.length,returned:input.limit,exhausted:false,nextCursor:'A'.repeat(2048),byteLimited:true}};
      const recordBudget = MAX_QUERY_BYTES - toolResultBytes(envelope) - 1024;
      const { items, page } = paginate(selected, input.query, this.snapshotHash, input.limit, input.cursor, recordBudget,recordTransportBytes,2);
      const result: SavedQueryResult = { ...base, status: 'partial', records: items, page };
      if (!selected.length) result.unknowns.push('No matching preserved records; activity, historical existence and server deletion remain unknown.');
      if (toolResultBytes(result) > MAX_QUERY_BYTES) throw new QueryRefusal('selected_records_exceed_response_budget');
      return result;
    } catch (error) {
      if (!(error instanceof QueryRefusal)) throw error;
      const refusal:SavedQueryResult = { ...base, status: 'unavailable', code: error.code, records: [], page: { totalInSavedSelection: null, returned: 0, exhausted: false, nextCursor: null } };
      // Fixed source metadata can itself exceed the budget. Keep its original bytes in the snapshot,
      // and let the MCP runtime return this short error rather than echoing or truncating that metadata.
      if(toolResultBytes(refusal)>MAX_QUERY_BYTES-1024)throw new QueryRefusal('fixed_source_metadata_exceeds_response_budget');
      return refusal;
    }
  }
}

/** Fixed local files and immutable pins; no URL, credential, transport, write or automatic refresh. */
export async function loadSavedContext(repoRoot: string): Promise<SavedContext> {
  const pinPath = resolve(repoRoot, 'tools/academy-mcp/architecture/source-pins.json');
  const pins = JSON.parse(await readFile(pinPath, 'utf8')) as { files: Pin[] };
  const hashFor = async (path: string) => {
    const pin = pins.files.find(pin => pin.path === path);
    if (!pin || !/^[a-f0-9]{64}$/.test(pin.sha256)) throw new QueryRefusal('input_pin_missing');
    const file = resolve(repoRoot, path), info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 32 * 1024 * 1024) throw new QueryRefusal('pinned_input_file_invalid');
    const bytes = await readFile(file);
    if (digest(bytes) !== pin.sha256) throw new QueryRefusal('pinned_input_changed');
    return pin.sha256;
  };
  const auditHash = await hashFor(AUDIT_PATH), lessonHash = await hashFor(LESSON_PATH);
  const audit = readPinnedAudit(resolve(repoRoot, AUDIT_PATH), auditHash);
  const lesson = readPinnedLesson(resolve(repoRoot, LESSON_PATH), lessonHash, audit).data;
  return new SavedContext({ audit, lesson, auditHash, lessonHash });
}
