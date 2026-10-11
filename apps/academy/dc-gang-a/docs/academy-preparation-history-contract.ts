/** Product-owned preparation contracts. Native Hermes remains the lifecycle and authentication owner. */
export const academyPreparationHistoryContract={
  schemaVersion:1,
  owner:'dc-gang-a architecture Lead',
  producers:'The operational analysis session may append admitted evidence through existing validated student-partition contracts; it does not own schema/code changes.',
  consumers:['TeacherApplication.student(context,studentId,date)','TeacherApplication.classPreparation(context,date)','GET /api/student?id=<owned-id>&date=<ISO-date>','GET /api/class?date=<ISO-date>','Teacher UI preparationView','Browser query_student_learning through the same authenticated API'],
  records:{
    source_course_inventory:'Exact student/course/user-course/book keys, source unit order/major/minor keys, literal labels/version and uninterpreted progress cells. Returned-table coverage is not all editions/printed pages/history or item grading.',
    source_prestudy_snapshot:'Exact student/teacher/course/minor-unit/video keys, separate source version and confirmed/unconfirmed lane. Comments from a compose field do not establish stored comment history.',
    teacher_preparation_assignment:'Attributable beginning-to-upper-bound cumulative audit scope, source student/course/book and series, with an effective date. This is not effective enrollment or a full lesson-homework-item join.',
    teacher_activity_revision:'Explicit teacher acceptance/reopening for a namespaced student/course/book/minor-unit teacher-owned activity. Student app grading is excluded from teacher-issued grading claims. Effective/report date is not an inferred performance timestamp.',
  },
  storage:{
    implementation:'Existing PostgreSQL record_versions/record_heads and validated append/CAS/idempotency; no new SQL schema or per-student database.',
    identity:'New typed record subject/course/book/user-course/minor-unit/activity scope cannot be rebound within an existing entity. Current qualified source-book registration is required where applicable.',
    unchanged:'Keep content-equivalent evidence on the same revision, updating only verified-observation metadata under the existing store contract.',
    history:'Read applicable typed teacher revision history as well as current source heads. Reopening retains earlier acceptance. The scene does not reconstruct an immutable final historical journal.',
  },
  compatibility:{
    legacyKind:'teacher_reported_note',
    recognizedInnerKind:'teacher_confirmed_video_history_with_source_attachments',
    validation:'Bind the legacy source student, exact outer/inner directive, course and retained unit references to one qualified registered book. Validate explicit completion basis and refuse invented uploads or app-completion promotion.',
    unsupported:'Keep unstructured or other structured notes in original evidence; do not guess completion from prose or stars.',
    writes:'Compatibility projection performs no rewrite, source acquisition or production backfill. Existing analyst writes remain valid.',
    rollout:'Deploy compatible validators/readers before any producer writes new record kinds to production. Old deployed readers may refuse unknown kinds. Confirm actual runtime version and do not assume Git merge activates it.',
  },
  resolution:{
    sourceAbsence:'A time-bounded list cannot erase an explicit retained completion.',
    unsolicitedVideo:'New source uploads are reference-only after acceptance; only an explicit applicable teacher instruction reopens the activity.',
    independence:'Video, notebooks, concept blank-test, original/similar clinics, Daily Test and Havruta retain independent judgments; no grade or source label establishes mastery or whole-cycle completion.',
    calendar:'Use Asia/Seoul for source observation cutoffs and validate literal ISO lesson dates. Teacher effective dates and recorded/observed clocks remain distinct.',
    duty:'Only a qualified audit scope marks current duty; rows beyond its bound are outside that audit, not proof of nonperformance. Davinci has no video duty.',
  },
  boundedLeaf:{
    implemented:'Typed record validation/storage compatibility and persistent teacher-history query integration; human/agent bindings consume the same application result.',
    notEstablished:['Automatic source refresh runtime','Full page/problem/attempt denominator','Stored video comment history','Independent recovery for all later captured data','Live teacher-site deployment','Actual browser-standard WebMCP invocation','Teacher classroom acceptance'],
    excluded:['Academy writes','Clinic generation','Physical print','Official journal finalization','Parent sending','New gateway/job/account/billing effects','Native engine/Host/other-container changes'],
  },
} as const;
