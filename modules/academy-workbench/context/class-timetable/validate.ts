import { readFile } from 'node:fs/promises';
import { existsSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
/** Education-platform root: context/class-timetable is four levels below it. */
export const platformRoot = resolve(dir, '..', '..', '..', '..');

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type Weekday = (typeof WEEKDAYS)[number];
const SESSIONS = ['1부', '2부'] as const;
const PROVENANCE_KINDS = ['user_confirmed', 'inferred', 'unknown'] as const;

export interface TimetableProvenance {
  kind: (typeof PROVENANCE_KINDS)[number];
  date: string;
  detail: string;
}
export interface TimetableStudent {
  name: string;
  classDays: Weekday[];
  session: (typeof SESSIONS)[number];
  courseId: number | null;
  provenance: TimetableProvenance;
}
export interface Timetable {
  schema: 'academy.class-timetable/1';
  students: TimetableStudent[];
  [key: string]: unknown;
}
export interface Routing {
  schema: 'academy.class-timetable-routing/1';
  routes: Array<{ question: string; target: string; anchor?: string }>;
  [key: string]: unknown;
}

function fail(message: string): never {
  throw Error(message);
}
function requireValue(value: unknown, error: string): asserts value {
  if (!value) fail(error);
}

/** Structural/integrity checks only. Never establishes attendance or completion. */
export function validateTimetable(value: unknown): Timetable {
  requireValue(value && typeof value === 'object', 'timetable_object_required');
  const x = value as Timetable;
  requireValue(x.schema === 'academy.class-timetable/1', 'timetable_schema_version');
  requireValue(Array.isArray(x.students) && x.students.length > 0, 'timetable_students_required');
  const names = new Set<string>();
  for (const s of x.students) {
    requireValue(typeof s.name === 'string' && !!s.name && !names.has(s.name), 'student_identity');
    names.add(s.name);
    requireValue(
      Array.isArray(s.classDays) && s.classDays.length > 0 && s.classDays.every(d => (WEEKDAYS as readonly string[]).includes(d)),
      'class_days_weekday_enum',
    );
    requireValue(new Set(s.classDays).size === s.classDays.length, 'class_days_unique');
    requireValue((SESSIONS as readonly string[]).includes(s.session), 'session_enum');
    requireValue(s.courseId === null || Number.isInteger(s.courseId), 'course_id_or_null');
    requireValue(
      s.provenance && (PROVENANCE_KINDS as readonly string[]).includes(s.provenance.kind) && validDate(s.provenance.date) && !!s.provenance.detail,
      'provenance_required',
    );
  }
  return x;
}

/** Every route must resolve to an existing repo file. Unknown questions stay unknown. */
export function validateRouting(value: unknown, root: string = platformRoot): Routing {
  requireValue(value && typeof value === 'object', 'routing_object_required');
  const x = value as Routing;
  requireValue(x.schema === 'academy.class-timetable-routing/1', 'routing_schema_version');
  requireValue(Array.isArray(x.routes) && x.routes.length > 0, 'routing_routes_required');
  for (const r of x.routes) {
    requireValue(typeof r.question === 'string' && !!r.question, 'route_question_required');
    requireValue(typeof r.target === 'string' && !!r.target, 'route_target_required');
    const parts = r.target.split('/');
    if (isAbsolute(r.target) || r.target.includes('\\') || parts.some(p => !p || p === '.' || p === '..')) fail('route_target_invalid');
    let target = resolve(root);
    for (const part of parts) {
      target = resolve(target, part);
      if (!existsSync(target)) fail(`route_target_missing:${r.target}`);
      if (lstatSync(target).isSymbolicLink()) fail('route_target_symlink');
    }
    if (!lstatSync(target).isFile()) fail('route_target_not_file');
  }
  return x;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A separately supplied confirmed timetable window is required; DailyRecord admission is not a timetable validity window. */
export function isClassDay(student: TimetableStudent, lessonDate: string, window?: {from: string; to: string}): boolean | null {
  if (!validDate(lessonDate)) fail('lesson_date_invalid');
  if (window && (!validDate(window.from) || !validDate(window.to) || window.from > window.to)) fail('timetable_window_invalid');
  if (!window || student.provenance?.kind !== 'user_confirmed' || !validDate(student.provenance.date) || lessonDate < student.provenance.date || lessonDate < window.from || lessonDate > window.to) return null;
  const date = new Date(`${lessonDate}T00:00:00Z`);
  const day = date.getUTCDay();
  return student.classDays.includes(WEEKDAYS[(day + 6) % 7] as Weekday);
}

if (import.meta.main) {
  const timetable = validateTimetable(JSON.parse(await readFile(resolve(dir, 'timetable.json'), 'utf8')));
  const routing = validateRouting(JSON.parse(await readFile(resolve(dir, 'routing.json'), 'utf8')));
  console.log(
    JSON.stringify({
      status: 'pass',
      students: timetable.students.length,
      routes: routing.routes.length,
    }),
  );
}
