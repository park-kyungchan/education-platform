/** Teacher-confirmed operational policy, not authentication, source proof or a deployed refresh loop. */
export type ClassroomSeries='gauss'|'davinci';
export const clinicDecisionKinds=['grading','correction_required','explanation_required','review_pending','completed','reopened'] as const;
export type ClinicDecision=typeof clinicDecisionKinds[number];
export type CycleActivity='prestudy_review'|'concept_note_inspection'|'solution_note_inspection'|'app_problem_grading'|'concept_blank_test'|'wrong_clinic'|'similar_clinic'|'daily_test'|'havruta';
export interface CycleRequirement {
  activity:CycleActivity;
  responsibleActor:'teacher'|'student';
  completionAuthority:'explicit_teacher_judgment'|'verified_app_grading_for_exact_assigned_range';
}
const gauss:readonly CycleRequirement[]=[
  {activity:'prestudy_review',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'concept_note_inspection',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'solution_note_inspection',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'app_problem_grading',responsibleActor:'student',completionAuthority:'verified_app_grading_for_exact_assigned_range'},
  {activity:'concept_blank_test',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'wrong_clinic',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'similar_clinic',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'daily_test',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
  {activity:'havruta',responsibleActor:'teacher',completionAuthority:'explicit_teacher_judgment'},
];
export const classroomCyclePolicy={
  schemaVersion:1,
  authority:'teacher_interview_2026_10_05',
  operationalContextRevision:'teacher_interview_2026_10_07',
  sectionWork:{
    expectedWork:'assigned_section_and_item_range',
    catalogEntryImpliesAssignment:false,
    prerequisiteCompletionImpliesAssignment:false,
    missingEvidenceState:'unknown',
    comprehensiveAssessment:{scope:'major_unit',prerequisite:'designated_minor_unit_boundary'},
  },
  clinicWorkflow:{
    recordDestination:'protected_product_history',
    officialProjection:'separate_exact_approved_dayrecord_or_teacher_final_send',
    automaticCompletion:false,
    decisionKinds:clinicDecisionKinds,
    completionInvalidatingDecisions:['correction_required','explanation_required','reopened'] as readonly ClinicDecision[],
    completionTrigger:'explicit_teacher_record_after_correction_and_explanation',
    repeatedStage:'correction_and_explanation',
    stages:[
      {stage:'written_solving',responsibleActor:'student'},
      {stage:'grading',responsibleActor:'teacher'},
      {stage:'correction_and_explanation',responsibleActor:'student'},
      {stage:'review',responsibleActor:'teacher'},
      {stage:'completion',responsibleActor:'teacher'},
    ],
  },
  auditRange:'every_progressed_minor_unit_through_latest_assigned_homework',
  auditOwnership:'teacher_owned_progress_prior_evidence_retained_as_history',
  naming:'source_book_edition_volume_and_literal_minor_unit_number_and_name',
  hierarchy:['owner','student','book_edition','minor_unit','assigned_range','activity','source_evidence','teacher_revision'],
  seriesRules:{gauss:'prestudy_video_is_always_required',davinci:'no_prestudy_video_duty_ignore_accidental_uploads_for_readiness'},
  evidenceRules:{
    resubmission:'latest_teacher_resubmission_or_correction_request_must_be_resolved_prior_acceptance_retained',
    newUnrequestedVideo:'retain_prior_completion_new_video_is_reference_only_reopen_on_explicit_teacher_instruction',
    prestudyHistory:{
      visibleRetention:'teacher_reported_about_two_weeks_not_a_system_ttl',
      priorCompletion:'retain_attributable_teacher_completion_when_source_list_ages_out',
      missingOriginal:'do_not_fabricate_upload_identity_or_media',
      reviewedVideo:'explicit_teacher_inspection_resolves_video_only',
      refresh:'new_or_changed_evidence_or_explicit_reopening_not_repeated_completed_detail_reads',
      otherFamilies:'qualify_retention_mutability_and_invalidation_per_source',
    },
    journalRecordingFailure:{
      operationalAssignment:'attributable_teacher_assignment_beside_unchanged_official_source',
      staleDueDate:'preserve_literal_do_not_shift_to_current_lesson',
      communication:'homework_notice_separate_from_final_lesson_report',
      teacherReportedSentIsReceipt:false,
      automaticReplay:false,
    },
    sourceGradeIsTeacherInspection:false,
    missingRowIsNonperformance:false,
    teacherCompletion:'Retain an explicit attributable teacher completion for the exact student/book/minor-unit/range. An agent or student report cannot replace it.',
    prestudy:'Keep upload, awaiting teacher review, reviewed source label and attributable teacher judgment separate; surface every waiting review to the teacher.',
    notebooks:'Concept/handwriting and solution notebooks require separate teacher-inspected evidence in the classroom; source grades cannot certify the paper work.',
    conceptBlankTest:'Teacher requests the test, provides feedback and explicitly judges completion.',
    clinics:'Original wrong and similar clinics are separate obligations; the teacher inspects the final written solution before either is complete.',
    dailyTest:'Keep student app entry/grading beside teacher-inspected printed solutions; the app score alone cannot complete the classroom activity.',
    missingCoverage:'A wrong-note index, name-only video row, missing stage row or observed latest unit is not a complete expected-unit or history inventory.',
    carryover:'Assessment-day omissions remain explicit carryover, not implicit completion or exemption.',
  },
  havrutaTiming:{usualMinutesBeforeLessonEnd:30,meaning:'teacher_reported_usual_timing_not_a_hard_deadline_or_scheduler'},
  refresh:{
    activeTeacherScreen:'automatic_source_change_reflection_plus_manual_refresh',
    runtimeInstalledByPolicy:false,
    classes:[
      {kind:'shared_content_version',rule:'Reuse version-pinned book/major/middle/minor/page/problem definitions. Refresh on a qualified source version change or explicit invalidation; do not reload unchanged catalogs per student.'},
      {kind:'student_book_assignment',rule:'Long-lived mappings survive normal lessons; teacher-reported books can take over three months. Reconcile at assignment/book/edition changes and explicit validation, not an invented daily or three-month TTL.'},
      {kind:'lesson_and_homework',rule:'Refresh the selected date/occurrence and current approved assignment revisions on scene selection or a qualified change. Preserve literal old due dates and unknown carryover.'},
      {kind:'submission_and_grading',rule:'Reflect new submissions/grading while the teacher screen is active, plus manual refresh. Qualify supported events or bounded reads, authentication, page coverage and exact joins before activating a loop.'},
      {kind:'teacher_judgment_revision',rule:'Append explicit teacher observations/reviews/corrections when reported. Preserve prior versions and original source grades; never reread the source to manufacture a teacher judgment.'},
    ],
    failure:'Retain last successful scope/time and explicit blocked or unknown lanes. No cookie export, native-control bypass, keepalive workaround or fabricated current data.',
  },
  developmentGuidance:[
    {phase:'requirements_and_domain',duty:'Use these actor-owned obligations and latest-homework audit range before interviewing or choosing a source.'},
    {phase:'source_and_storage',duty:'Qualify complete expected units and separate source namespaces; retain source originals and append-only teacher revisions. Never promote label matches or digests to source authority.'},
    {phase:'frontend_and_webmcp',duty:'Expose the same per-minor-unit gap and teacher-attention meaning to human scenes and typed agent operations. Complete every scheduled student, not only the selected one.'},
    {phase:'evaluation_and_closeout',duty:'Test Gauss/Davinci divergence, pending teacher review, unknown coverage, source outage, explicit classroom completion and later correction. Official save and parent send remain separate human-owned effects.'},
  ],
} as const;
export function requirementsForSeries(series:ClassroomSeries):CycleRequirement[]{
  if(series!=='gauss'&&series!=='davinci')throw Error('unsupported_classroom_series');
  const selected=series==='gauss'?gauss:gauss.filter(x=>x.activity==='wrong_clinic'||x.activity==='similar_clinic');
  return selected.map(x=>({...x}));
}
