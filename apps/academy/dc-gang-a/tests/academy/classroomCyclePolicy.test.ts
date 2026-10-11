import {describe,expect,test} from 'bun:test';
import {classroomCyclePolicy,requirementsForSeries} from '../../src/academy/classroomCyclePolicy';

describe('teacher-admitted classroom cycle requirements',()=>{
  test('section eligibility and clinic completion retain the confirmed actors and effect destinations',()=>{
    expect(classroomCyclePolicy).toMatchObject({
      sectionWork:{expectedWork:'assigned_section_and_item_range',catalogEntryImpliesAssignment:false,prerequisiteCompletionImpliesAssignment:false,missingEvidenceState:'unknown',comprehensiveAssessment:{scope:'major_unit',prerequisite:'designated_minor_unit_boundary'}},
      clinicWorkflow:{recordDestination:'protected_product_history',automaticCompletion:false,completionTrigger:'explicit_teacher_record_after_correction_and_explanation',stages:[
        {stage:'written_solving',responsibleActor:'student'},
        {stage:'grading',responsibleActor:'teacher'},
        {stage:'correction_and_explanation',responsibleActor:'student'},
        {stage:'review',responsibleActor:'teacher'},
        {stage:'completion',responsibleActor:'teacher'},
      ]},
    });
  });
  test('current duties begin at teacher-owned progress and unresolved later revision requests prevent completion',()=>{
    expect(classroomCyclePolicy.auditOwnership).toBe('teacher_owned_progress_prior_evidence_retained_as_history');
    expect(classroomCyclePolicy.evidenceRules.resubmission).toBe('latest_teacher_resubmission_or_correction_request_must_be_resolved_prior_acceptance_retained');
    expect(classroomCyclePolicy.naming).toBe('source_book_edition_volume_and_literal_minor_unit_number_and_name');
  });
  test('journal failure preserves an off-channel teacher assignment without pretending a save or receipt',()=>{
    expect(classroomCyclePolicy.evidenceRules.journalRecordingFailure).toEqual({
      operationalAssignment:'attributable_teacher_assignment_beside_unchanged_official_source',
      staleDueDate:'preserve_literal_do_not_shift_to_current_lesson',
      communication:'homework_notice_separate_from_final_lesson_report',
      teacherReportedSentIsReceipt:false,
      automaticReplay:false,
    });
  });
  test('aging source lists cannot erase teacher-confirmed video completion or freeze mutable grading',()=>{
    expect(classroomCyclePolicy.evidenceRules.prestudyHistory).toEqual({
      visibleRetention:'teacher_reported_about_two_weeks_not_a_system_ttl',
      priorCompletion:'retain_attributable_teacher_completion_when_source_list_ages_out',
      missingOriginal:'do_not_fabricate_upload_identity_or_media',
      reviewedVideo:'explicit_teacher_inspection_resolves_video_only',
      refresh:'new_or_changed_evidence_or_explicit_reopening_not_repeated_completed_detail_reads',
      otherFamilies:'qualify_retention_mutability_and_invalidation_per_source',
    });
  });
  test('an unsolicited later video does not reopen an already accepted activity',()=>{
    expect(classroomCyclePolicy.evidenceRules.newUnrequestedVideo).toBe('retain_prior_completion_new_video_is_reference_only_reopen_on_explicit_teacher_instruction');
  });
  test('every Gauss minor unit requires prestudy review and all separately owned cycle checks',()=>{
    const requirements=requirementsForSeries('gauss');
    expect(requirements.map(x=>x.activity)).toEqual(['prestudy_review','concept_note_inspection','solution_note_inspection','app_problem_grading','concept_blank_test','wrong_clinic','similar_clinic','daily_test','havruta']);
    expect(requirements.find(x=>x.activity==='app_problem_grading')?.completionAuthority).toBe('verified_app_grading_for_exact_assigned_range');
    expect(requirements.filter(x=>x.activity!=='app_problem_grading').every(x=>x.completionAuthority==='explicit_teacher_judgment')).toBe(true);
    expect(classroomCyclePolicy.auditRange).toBe('every_progressed_minor_unit_through_latest_assigned_homework');
  });
  test('Davinci requires only wrong and similar clinic inspection, not accidental prestudy uploads',()=>{
    expect(requirementsForSeries('davinci').map(x=>x.activity)).toEqual(['wrong_clinic','similar_clinic']);
    expect(requirementsForSeries('davinci').every(x=>x.completionAuthority==='explicit_teacher_judgment')).toBe(true);
  });
  test('callers cannot change the shared requirements through a returned array',()=>{
    const first=requirementsForSeries('gauss');first[0]!.activity='daily_test';first.pop();
    expect(requirementsForSeries('gauss')[0]!.activity).toBe('prestudy_review');
    expect(requirementsForSeries('gauss')).toHaveLength(9);
    expect(()=>requirementsForSeries('unknown' as never)).toThrow('unsupported_classroom_series');
  });
  test('evidence and refresh guidance never installs a loop or substitutes source grades for teacher review',()=>{
    expect(classroomCyclePolicy.evidenceRules.sourceGradeIsTeacherInspection).toBe(false);
    expect(classroomCyclePolicy.evidenceRules.missingRowIsNonperformance).toBe(false);
    expect(classroomCyclePolicy.refresh.activeTeacherScreen).toBe('automatic_source_change_reflection_plus_manual_refresh');
    expect(classroomCyclePolicy.refresh.runtimeInstalledByPolicy).toBe(false);
    expect(classroomCyclePolicy.refresh.classes.map(x=>x.kind)).toEqual(['shared_content_version','student_book_assignment','lesson_and_homework','submission_and_grading','teacher_judgment_revision']);
    expect(classroomCyclePolicy.havrutaTiming).toEqual({usualMinutesBeforeLessonEnd:30,meaning:'teacher_reported_usual_timing_not_a_hard_deadline_or_scheduler'});
  });
});
