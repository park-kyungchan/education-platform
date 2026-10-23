import { z } from 'zod';

export const FACETS = ['books', 'sections', 'attempts', 'assignments', 'videos', 'daily_tests', 'daily_records', 'teacher_events', 'daily_record_drafts'] as const;
export type Facet = typeof FACETS[number];
export const MAX_QUERY_LIMIT = 250;
export const MAX_QUERY_BYTES = 512 * 1024;
const studentId = z.string().min(1).max(256).describe('Exact opaque studentId from the preserved roster; not a student name or a native server identifier.');
export const querySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('roster') }).strict(),
  z.object({ kind: z.literal('student_summary'), studentId }).strict(),
  z.object({ kind: z.literal('student_history'), studentId, facets: z.array(z.enum(FACETS)).min(1).max(FACETS.length).refine(values => new Set(values).size === values.length, 'duplicate_facet').meta({uniqueItems:true}).optional() }).strict(),
  z.object({ kind: z.literal('student_records'), studentId, facet: z.enum(FACETS), bookEditionId: z.string().min(1).max(256).optional() }).strict(),
  z.object({ kind: z.literal('lesson_context'), studentId, date: z.iso.date() }).strict(),
]);
export type SavedQuery = z.infer<typeof querySchema>;
export const queryInputSchema = z.object({
  sourceMode: z.literal('saved_context').default('saved_context'),
  query: querySchema,
  cursor: z.string().max(2048).optional(),
  limit: z.number().int().min(1).max(MAX_QUERY_LIMIT).default(10),
}).strict();
export type QueryInput = z.infer<typeof queryInputSchema>;

export interface SourceReference { path: string; sha256: string; jsonPointer: string }
export interface PreservedRecord {
  facet?: Facet;
  classification: 'saved_source_record' | 'teacher_report' | 'user_supplied_context' | 'source_observation_snapshot' | 'unsaved_draft' | 'derived_saved_summary';
  source: SourceReference;
  value: unknown;
}
export interface SavedQueryResult {
  schemaVersion: 1;
  status: 'partial' | 'unavailable';
  sourceMode: 'saved_context';
  retrievedAt: string;
  snapshot: { sha256: string; collectedAt: string; lessonDate: string; lessonPreparedAt: string };
  scope: {
    teacherLabel: '박경찬';
    intendedPopulation: 'all_teacher_managed_students';
    preservedStudentCount: number;
    completeTeacherRosterVerified: false;
    totalTeacherManagedStudents: null;
  };
  records: PreservedRecord[];
  page: { totalInSavedSelection: number | null; returned: number; exhausted: boolean; nextCursor: string | null; byteLimited?: boolean };
  coverage: 'bounded_preserved_evidence';
  currentAcademyServerQueried: false;
  absenceProvesNonperformance: false;
  unknowns: string[];
  code?: string;
}

export const queryResultSchema = z.object({
  schemaVersion: z.literal(1), status: z.enum(['partial', 'unavailable']), sourceMode: z.literal('saved_context'),
  retrievedAt: z.iso.datetime({ offset: true }),
  snapshot: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), collectedAt: z.iso.datetime({ offset: true }), lessonDate: z.iso.date(), lessonPreparedAt: z.iso.datetime({ offset: true }) }).strict(),
  scope: z.object({ teacherLabel: z.literal('박경찬'), intendedPopulation: z.literal('all_teacher_managed_students'), preservedStudentCount: z.number().int().nonnegative(), completeTeacherRosterVerified: z.literal(false), totalTeacherManagedStudents: z.null() }).strict(),
  records: z.array(z.object({
    facet: z.enum(FACETS).optional(),
    classification: z.enum(['saved_source_record', 'teacher_report', 'user_supplied_context', 'source_observation_snapshot', 'unsaved_draft', 'derived_saved_summary']),
    source: z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), jsonPointer: z.string().startsWith('/') }).strict(),
    value: z.unknown(),
  }).strict()),
  page: z.object({ totalInSavedSelection: z.number().int().nonnegative().nullable(), returned: z.number().int().nonnegative(), exhausted: z.boolean(), nextCursor: z.string().nullable(), byteLimited: z.boolean().optional() }).strict(),
  coverage: z.literal('bounded_preserved_evidence'), currentAcademyServerQueried: z.literal(false),
  absenceProvesNonperformance: z.literal(false), unknowns: z.array(z.string()), code: z.string().optional(),
}).strict();

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export class QueryRefusal extends Error {
  constructor(readonly code: string) { super(code); }
}
