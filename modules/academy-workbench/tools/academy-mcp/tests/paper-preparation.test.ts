import {expect,test} from 'bun:test';
import {paperPlanInputSchema,preparePaperPlan,verifyPaperPreparation,verifyPaperOutput,type PaperPlanInput} from '../src/paper-preparation.ts';

const hash=(letter:string)=>letter.repeat(64);
export function syntheticPaperPlan(count=24):PaperPlanInput{
  return {schemaVersion:'academy.paper-plan/1',selection:Array.from({length:count},(_,i)=>({questionId:String(1001+i),variant:i%3===0?'des':'sbj'})),
    student:{examDisposeType:'d2',questionsPerPage:2,examSpacer:5,addAnswer:0,addExplain:0},
    teacher:{examDisposeType:'line',examSpacer:5,addAnswer:1,addExplain:1},
    sourceBindings:{selection:{sha256:hash('a'),jsonPointer:'/selection'},nativeLayout:{sha256:hash('b'),jsonPointer:'/layout'},nativeOptions:{sha256:hash('c'),jsonPointer:'/options'}}};
}
function planned(plan=syntheticPaperPlan()){
  const result=preparePaperPlan(plan);if(!result.inputValid)throw Error('synthetic_plan_invalid');return result;
}
export function syntheticPrepared(plan=syntheticPaperPlan()){
  const {questionsPerPage:_,...student}=plan.student;
  return {plan,planFingerprint:planned(plan).planFingerprint,prepared:{templateSha256:hash('d'),selection:structuredClone(plan.selection),
    student,teacher:{...plan.teacher},sourceBindings:structuredClone(plan.sourceBindings)}};
}
export function syntheticPaperOutputs(plan=syntheticPaperPlan()){
  const planFingerprint=planned(plan).planFingerprint;
  const make=(kind:'student'|'teacher',perPage:number)=>{
    const pages=Array.from({length:Math.ceil(plan.selection.length/perPage)},(_,i)=>({pageNumber:i+1,questionIds:plan.selection.slice(i*perPage,(i+1)*perPage).map(row=>row.questionId)}));
    return {pdfSha256:hash(kind==='student'?'d':'e'),receiptSha256:hash(kind==='student'?'f':'a'),planFingerprint,pageCount:pages.length,
      orderMethod:'numbered_visual_order' as const,pages,visualReview:{method:'human_visual' as const,reviewedPages:pages.map(page=>page.pageNumber),
        answers:kind==='student'?'absent' as const:'present' as const,explanations:kind==='student'?'absent' as const:'present' as const,
        variants:'match' as const,rendering:'complete' as const}};
  };
  return {plan,planFingerprint,outputs:{student:make('student',2),teacher:make('teacher',4)}};
}
const codes=(value:{issues:Array<{code:string}>})=>value.issues.map(issue=>issue.code);
function syntheticJevOutputs(){
  const input:any=syntheticPaperOutputs();
  for(const kind of ['student','teacher'] as const){
    const output=input.outputs[kind],{method:_,reviewedPages:__,...facts}=output.visualReview;
    output.visualReview={method:'jev_first_with_human_exceptions',model:'typesafe-ai/jev-1.14.0',calibratedPilotReceiptSha256:hash('b'),
      pageReviews:output.pages.map((page:{pageNumber:number})=>({pageNumber:page.pageNumber,sourcePdfSha256:output.pdfSha256,
        pngSha256:page.pageNumber.toString(16).padStart(64,'0'),responseReceiptSha256:hash('c'),modelStatus:'pass'})),
      humanReviewedPages:[],highRiskPages:[],...facts};
  }
  return input;
}

test('plan fingerprints are deterministic across object key order and bind all selected metadata',()=>{
  const plan=syntheticPaperPlan(),frozen=JSON.stringify(plan),result=planned(plan);
  expect(result).toMatchObject({inputValid:true,status:'plan_only',summary:{questionCount:24,studentExpectedPages:12,studentQuestionsPerPage:2,teacherExpectedPages:null,variants:{sbj:16,des:8}},
    classification:'caller_supplied_metadata_review',sourceBytesVerified:false,nativeExecutionVerified:false,acceptance:'not_inferred'});
  const reordered={sourceBindings:{nativeOptions:plan.sourceBindings.nativeOptions,selection:plan.sourceBindings.selection,nativeLayout:plan.sourceBindings.nativeLayout},teacher:plan.teacher,
    student:{addExplain:0,addAnswer:0,examSpacer:5,questionsPerPage:2,examDisposeType:'d2'},selection:plan.selection.map(row=>({variant:row.variant,questionId:row.questionId})),schemaVersion:plan.schemaVersion};
  const reorderedResult=preparePaperPlan(reordered);if(!reorderedResult.inputValid)throw Error('synthetic_reordered_plan_invalid');
  expect(reorderedResult.planFingerprint).toBe(result.planFingerprint);
  for(const mutate of [(p:PaperPlanInput)=>p.selection.reverse(),(p:PaperPlanInput)=>{p.selection[0].variant='sbj';},
    (p:PaperPlanInput)=>{p.student.examSpacer=0;},(p:PaperPlanInput)=>{p.sourceBindings.nativeLayout.sha256=hash('f');},
    (p:PaperPlanInput)=>{p.sourceBindings.selection.jsonPointer='/other';}]){
    const changed=structuredClone(plan);mutate(changed);expect(planned(changed).planFingerprint).not.toBe(result.planFingerprint);
  }
  expect(JSON.stringify(plan)).toBe(frozen);
  expect(Object.isFrozen(result.effects)).toBe(true);
  expect(()=>{(result.effects as any).nativeCommands=1;}).toThrow();
  expect(planned(plan).effects.nativeCommands).toBe(0);
});

test('strict even unique2–24 selection and source-only layouts refuse ambiguous or private inputs without echo',()=>{
  for(const count of [0,1,3,25])expect(preparePaperPlan(syntheticPaperPlan(count))).toMatchObject({inputValid:false,status:'hold'});
  for(const count of [2,12,24])expect(planned(syntheticPaperPlan(count)).summary.studentExpectedPages).toBe(count/2);
  const duplicate=syntheticPaperPlan();duplicate.selection[1].questionId=duplicate.selection[0].questionId;expect(paperPlanInputSchema.safeParse(duplicate).success).toBe(false);
  const badInputs:unknown[]=[{...syntheticPaperPlan(),password:'PRIVATE_SECRET'},
    {...syntheticPaperPlan(),student:{...syntheticPaperPlan().student,examDisposeType:'line'}},
    {...syntheticPaperPlan(),teacher:{...syntheticPaperPlan().teacher,examDisposeType:'LINE'}},
    {...syntheticPaperPlan(),student:{...syntheticPaperPlan().student,examDisposeType:'d4'}},
    {...syntheticPaperPlan(),teacher:{...syntheticPaperPlan().teacher,addAnswer:0}},
    {...syntheticPaperPlan(),selection:[{questionId:'01001',variant:'sbj'},{questionId:'1002',variant:'des'}]},
    {...syntheticPaperPlan(),sourceBindings:{...syntheticPaperPlan().sourceBindings,nativeLayout:{sha256:hash('b'),jsonPointer:'/layout',path:'/PRIVATE_PATH'}}},
    {...syntheticPaperPlan(),selection:[{questionId:'1001',variant:'obj'},{questionId:'1002',variant:'des'}]}];
  for(const input of badInputs){const reply=preparePaperPlan(input);expect(reply.inputValid).toBe(false);expect(JSON.stringify(reply)).not.toContain('PRIVATE');}
});

test('prepared metadata preserves source-observed spacer and matches student/teacher flags without native proof',()=>{
  const input=syntheticPrepared(),before=JSON.stringify(input),reply=verifyPaperPreparation(input);
  expect(reply).toMatchObject({inputValid:true,status:'consistent_caller_reported',templateSha256:hash('d'),issues:[],sourceBytesVerified:false,nativeExecutionVerified:false,
    effects:{sourceRequests:0,nativeCommands:0,fileReads:0,fileWrites:0}});
  expect(JSON.stringify(input)).toBe(before);
  expect(JSON.stringify(reply)).not.toContain('1001');
});

test('preparation holds changed order/variant, duplicate ID, source drift, stale plan and legacy line student',()=>{
  const input=syntheticPrepared();input.prepared.selection.reverse();input.prepared.selection[0].variant='des';input.prepared.selection[1].questionId=input.prepared.selection[0].questionId;
  input.prepared.student.examDisposeType='line' as 'd2';input.prepared.student.examSpacer=0;input.prepared.student.addAnswer=1 as 0;
  input.prepared.teacher.addExplain=0 as 1;input.prepared.sourceBindings.nativeOptions.sha256=hash('e');input.planFingerprint=hash('f');
  const reply=verifyPaperPreparation(input);
  expect(reply.status).toBe('hold');
  expect(codes(reply)).toEqual(expect.arrayContaining(['selection_order_mismatch','selection_variant_mismatch','selection_duplicate_question','native_option_mismatch','source_binding_mismatch','plan_fingerprint_mismatch']));
  expect(reply.issues.some(issue=>issue.location==='/prepared/student/examSpacer')).toBe(true);
  const raw=syntheticPrepared() as any;raw.prepared.selection[0].answer='PRIVATE_PRINT_CONTENT';expect(verifyPaperPreparation(raw).inputValid).toBe(false);
});

test('24-question12-page student plus unconstrained6-page line teacher is only consistent caller-reported metadata',()=>{
  const input=syntheticPaperOutputs(),before=JSON.stringify(input),reply=verifyPaperOutput(input);
  expect(reply).toMatchObject({inputValid:true,status:'consistent_caller_reported',issues:[],outputs:{student:{pageCount:12},teacher:{pageCount:6}},
    nativeExecutionVerified:false,sourceBytesVerified:false,acceptance:'not_inferred'});
  expect(JSON.stringify(input)).toBe(before);
  expect(JSON.stringify(reply)).not.toContain('1001');
  const teacher24=syntheticPaperOutputs();teacher24.outputs.teacher.pages=teacher24.plan.selection.map((row,i)=>({pageNumber:i+1,questionIds:[row.questionId]}));
  teacher24.outputs.teacher.pageCount=24;teacher24.outputs.teacher.visualReview.reviewedPages=Array.from({length:24},(_,i)=>i+1);
  expect(verifyPaperOutput(teacher24).status).toBe('consistent_caller_reported');
});

test('old four-page student receipt cannot satisfy12pages even when all24questions exist',()=>{
  const input=syntheticPaperOutputs(),student=input.outputs.student;
  student.pages=Array.from({length:4},(_,i)=>({pageNumber:i+1,questionIds:input.plan.selection.slice(i*6,i*6+6).map(row=>row.questionId)}));
  student.pageCount=4;student.visualReview.reviewedPages=[1,2,3,4];
  expect(codes(verifyPaperOutput(input))).toEqual(expect.arrayContaining(['student_questions_per_page_mismatch','student_page_count_mismatch']));
});

test('page-count alone cannot hide wrong order, extra/missing questions, blank/clipped pages or stale receipt',()=>{
  const input=syntheticPaperOutputs(),student=input.outputs.student;
  [student.pages[0],student.pages[1]]=[student.pages[1],student.pages[0]];
  student.pages[2].questionIds=[];student.pages[3].questionIds[1]=student.pages[3].questionIds[0];student.planFingerprint=hash('a');
  student.visualReview.rendering='clipped_or_blank' as 'complete';student.visualReview.variants='mismatch' as 'match';
  expect(codes(verifyPaperOutput(input))).toEqual(expect.arrayContaining(['receipt_plan_mismatch','output_question_order_mismatch','output_question_count_mismatch',
    'output_duplicate_question','student_questions_per_page_mismatch','page_sequence_mismatch','rendering_unverified','output_variant_match_unverified']));
});

test('receipt metadata does not convert extraction order or incomplete visual review into verified answers',()=>{
  const input=syntheticPaperOutputs();input.outputs.student.orderMethod='text_extraction' as 'numbered_visual_order';
  input.outputs.student.visualReview.reviewedPages=[1,2,3,4];input.outputs.student.visualReview.answers='present' as 'absent';
  input.outputs.teacher.visualReview.method='not_reviewed' as 'human_visual';input.outputs.teacher.visualReview.answers='unknown' as 'present';
  input.outputs.teacher.visualReview.explanations='unknown' as 'present';
  expect(codes(verifyPaperOutput(input))).toEqual(expect.arrayContaining(['numbered_visual_order_unverified','visual_page_coverage_incomplete','answer_visibility_unqualified',
    'visual_review_missing','explanation_visibility_unqualified']));
});

test('output summary rejects covert content/paths, unbound hash and samePDFstudent/teacher substitution',()=>{
  for(const mutate of [(v:any)=>{v.outputs.student.path='/PRIVATE_FILE';},(v:any)=>{v.outputs.teacher.pages[0].text='PRIVATE_CONTENT';},
    (v:any)=>{v.outputs.student.pdfSha256='not-a-hash';},(v:any)=>{v.outputs.teacher.visualReview.accepted=true;}]){
    const input=syntheticPaperOutputs();mutate(input);const reply=verifyPaperOutput(input);expect(reply.inputValid).toBe(false);expect(JSON.stringify(reply)).not.toContain('PRIVATE');
  }
  const same=syntheticPaperOutputs();same.outputs.teacher.pdfSha256=same.outputs.student.pdfSha256;
  expect(codes(verifyPaperOutput(same))).toContain('student_teacher_pdf_identity_conflict');
  const excessive=syntheticPaperOutputs();excessive.outputs.teacher.pages[0].questionIds.push('9999');
  expect(verifyPaperOutput(excessive).inputValid).toBe(false);
});

test('Jev-first review covers every page and routes uncertain, issue and declared high-risk pages to humans',()=>{
  const input=syntheticJevOutputs(),review=input.outputs.student.visualReview;
  review.pageReviews[0].modelStatus='uncertain';review.pageReviews[1].modelStatus='issue';review.highRiskPages=[2,3];review.humanReviewedPages=[1,2,3];
  const before=JSON.stringify(input),reply=verifyPaperOutput(input);
  expect(reply).toMatchObject({inputValid:true,status:'consistent_caller_reported',issues:[],classification:'caller_supplied_metadata_review',
    nativeExecutionVerified:false,sourceBytesVerified:false,acceptance:'not_inferred',effects:{sourceRequests:0,nativeCommands:0,fileReads:0,fileWrites:0}});
  expect(JSON.stringify(input)).toBe(before);expect(JSON.stringify(reply)).not.toContain('1001');
  // A receipt may contain one batched response: page identity, not receipt-hash uniqueness, binds coverage.
  expect(new Set(review.pageReviews.map((item:any)=>item.responseReceiptSha256)).size).toBe(1);
  input.outputs.teacher.visualReview=syntheticPaperOutputs().outputs.teacher.visualReview;
  expect(verifyPaperOutput(input).status).toBe('consistent_caller_reported');
});

test('Jev-first review holds missing human exceptions even when final aggregate facts say complete',()=>{
  for(const kind of ['student','teacher'] as const){
    for(const reason of ['uncertain','issue','high_risk']){
      const input=syntheticJevOutputs(),review=input.outputs[kind].visualReview;
      if(reason==='high_risk')review.highRiskPages=[1];else review.pageReviews[0].modelStatus=reason;
      const result=verifyPaperOutput(input);
      expect(result.status).toBe('hold');expect(codes(result)).toContain('human_exception_coverage_incomplete');
      review.humanReviewedPages=[1];expect(verifyPaperOutput(input).status).toBe('consistent_caller_reported');
    }
  }
});

test('Jev-first coverage requires complete unique in-range model, human and high-risk page references',()=>{
  for(const mutate of [(r:any)=>r.pageReviews.pop(),(r:any)=>{r.pageReviews[1].pageNumber=1;},(r:any)=>{r.pageReviews[0].pageNumber=99;}]){
    const input=syntheticJevOutputs();mutate(input.outputs.student.visualReview);
    expect(codes(verifyPaperOutput(input))).toContain('model_page_coverage_incomplete');
  }
  for(const field of ['humanReviewedPages','highRiskPages'])for(const pages of [[1,1],[99]]){
    const input=syntheticJevOutputs();input.outputs.student.visualReview[field]=pages;
    expect(codes(verifyPaperOutput(input))).toContain('visual_page_reference_invalid');
  }
});

test('Jev-first schema requires exact model, pilot and per-page evidence hashes without accepting private extras',()=>{
  for(const mutate of [(r:any)=>{r.model='jev-1.14.0';},(r:any)=>{r.model='typesafe-ai/jev-1.13.0';},
    (r:any)=>{delete r.calibratedPilotReceiptSha256;},(r:any)=>{r.calibratedPilotReceiptSha256='not-a-hash';},
    (r:any)=>{r.pageReviews[0].pngSha256='not-a-hash';},(r:any)=>{delete r.pageReviews[0].responseReceiptSha256;},
    (r:any)=>{r.pageReviews[0].modelStatus='confident';},(r:any)=>{r.pageReviews[0].imagePath='/PRIVATE_IMAGE';},
    (r:any)=>{r.confidence=0.99;},(r:any)=>{r.reviewedPages=[1];}]){
    const input=syntheticJevOutputs();mutate(input.outputs.student.visualReview);const reply=verifyPaperOutput(input);
    expect(reply).toMatchObject({inputValid:false,status:'hold'});expect(JSON.stringify(reply)).not.toContain('PRIVATE');
  }
});

test('Jev-first review rejects stale per-page PDF bindings and preserves final visibility/variant/rendering holds',()=>{
  const input=syntheticJevOutputs();input.outputs.student.visualReview.pageReviews[0].sourcePdfSha256=hash('e');
  input.outputs.student.visualReview.answers='present';input.outputs.student.visualReview.variants='unknown';
  input.outputs.teacher.visualReview.explanations='unknown';input.outputs.teacher.visualReview.rendering='clipped_or_blank';
  const result=verifyPaperOutput(input);expect(result.inputValid).toBe(true);expect(result.status).toBe('hold');
  expect(codes(result)).toEqual(expect.arrayContaining(['model_page_pdf_binding_mismatch','answer_visibility_unqualified','output_variant_match_unverified',
    'explanation_visibility_unqualified','rendering_unverified']));
});
