import {createHash} from 'node:crypto';
import {z} from 'zod';

const sha256=z.string().regex(/^[a-f0-9]{64}$/);
const questionId=z.string().regex(/^[1-9][0-9]{0,19}$/);
const binding=z.object({sha256,jsonPointer:z.string().max(256).regex(/^(?:\/(?:[A-Za-z0-9_.-]|~[01])+)*$/)}).strict();
// These fixed roles carry hashes and pointers only: never native owners, paths or source rows.
const sourceBindings=z.object({selection:binding,nativeLayout:binding,nativeOptions:binding}).strict();
const question=z.object({questionId,variant:z.enum(['sbj','des'])}).strict();
const selection=z.array(question).min(1).max(24);
const spacer=z.number().int().min(0).max(100);
const plannedStudent=z.object({examDisposeType:z.literal('d2'),questionsPerPage:z.literal(2),examSpacer:spacer,addAnswer:z.literal(0),addExplain:z.literal(0)}).strict();
const plannedTeacher=z.object({examDisposeType:z.literal('line'),examSpacer:spacer,addAnswer:z.literal(1),addExplain:z.literal(1)}).strict();

export const paperPlanInputSchema=z.object({
  schemaVersion:z.literal('academy.paper-plan/1'),selection,student:plannedStudent,teacher:plannedTeacher,sourceBindings,
}).strict().superRefine((value,context)=>{
  if(value.selection.length%2!==0)context.addIssue({code:'custom',path:['selection'],message:'exact_two_per_page_requires_even_selection'});
  if(new Set(value.selection.map(row=>row.questionId)).size!==value.selection.length)context.addIssue({code:'custom',path:['selection'],message:'selection_question_ids_must_be_unique'});
});
export type PaperPlanInput=z.infer<typeof paperPlanInputSchema>;

const observedOptions=z.object({examDisposeType:z.enum(['d2','line']),examSpacer:spacer,addAnswer:z.union([z.literal(0),z.literal(1)]),addExplain:z.union([z.literal(0),z.literal(1)])}).strict();
export const paperPreparationInputSchema=z.object({
  plan:paperPlanInputSchema,planFingerprint:sha256,
  prepared:z.object({templateSha256:sha256,selection,student:observedOptions,teacher:observedOptions,sourceBindings}).strict(),
}).strict();

const page=z.object({pageNumber:z.number().int().min(1).max(100),questionIds:z.array(questionId).max(24)}).strict();
const pageNumber=z.number().int().min(1).max(100);
const visualFacts={
  answers:z.enum(['absent','present','unknown']),explanations:z.enum(['absent','present','unknown']),
  variants:z.enum(['match','mismatch','unknown']),rendering:z.enum(['complete','clipped_or_blank','unknown']),
};
const visualReview=z.union([
  z.object({method:z.enum(['human_visual','not_reviewed']),reviewedPages:z.array(pageNumber).max(100),...visualFacts}).strict(),
  z.object({method:z.literal('jev_first_with_human_exceptions'),model:z.literal('typesafe-ai/jev-1.14.0'),calibratedPilotReceiptSha256:sha256,
    pageReviews:z.array(z.object({pageNumber,sourcePdfSha256:sha256,pngSha256:sha256,responseReceiptSha256:sha256,
      modelStatus:z.enum(['pass','uncertain','issue'])}).strict()).min(1).max(100),
    humanReviewedPages:z.array(pageNumber).max(100),highRiskPages:z.array(pageNumber).max(100),...visualFacts,
  }).strict(),
]);
const outputReceipt=z.object({
  pdfSha256:sha256,receiptSha256:sha256,planFingerprint:sha256,pageCount:z.number().int().min(1).max(100),
  orderMethod:z.enum(['numbered_visual_order','text_extraction','unknown']),pages:z.array(page).min(1).max(100),visualReview,
}).strict().superRefine((value,context)=>{
  if(value.pages.reduce((count,item)=>count+item.questionIds.length,0)>24)context.addIssue({code:'custom',path:['pages'],message:'question_start_metadata_limit_exceeded'});
});
export const paperOutputInputSchema=z.object({
  plan:paperPlanInputSchema,planFingerprint:sha256,outputs:z.object({student:outputReceipt,teacher:outputReceipt}).strict(),
}).strict();

type Issue={code:string;location:string};
const boundary=Object.freeze({classification:'caller_supplied_metadata_review',sourceBytesVerified:false,nativeExecutionVerified:false,
  acceptance:'not_inferred',effects:Object.freeze({sourceRequests:0,nativeCommands:0,fileReads:0,fileWrites:0})} as const);

/** Domain fingerprint only. This does not implement or replace shared Harness contracts. */
function canonicalJson(value:unknown):string{
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  if(value!==null&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson((value as Record<string,unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(domain:string,value:unknown){return createHash('sha256').update(`${domain}\n${canonicalJson(value)}`).digest('hex');}
function planHash(plan:PaperPlanInput){return digest('academy.paper-plan/1',plan);}
function invalid(){return {inputValid:false as const,status:'hold' as const,issues:[{code:'input_contract_invalid',location:'/'}],...boundary};}
function summary(plan:PaperPlanInput){return {questionCount:plan.selection.length,studentExpectedPages:plan.selection.length/2,studentQuestionsPerPage:2,teacherExpectedPages:null,
  variants:{sbj:plan.selection.filter(row=>row.variant==='sbj').length,des:plan.selection.filter(row=>row.variant==='des').length}};}
function issue(issues:Issue[],condition:boolean,code:string,location:string){if(condition)issues.push({code,location});}
function compareSelection(plan:PaperPlanInput,actual:PaperPlanInput['selection'],issues:Issue[]){
  issue(issues,actual.length!==plan.selection.length,'selection_count_mismatch','/prepared/selection');
  issue(issues,new Set(actual.map(row=>row.questionId)).size!==actual.length,'selection_duplicate_question','/prepared/selection');
  for(let i=0;i<Math.max(plan.selection.length,actual.length);i++){
    issue(issues,plan.selection[i]?.questionId!==actual[i]?.questionId,'selection_order_mismatch',`/prepared/selection/${i}/questionId`);
    issue(issues,plan.selection[i]?.variant!==actual[i]?.variant,'selection_variant_mismatch',`/prepared/selection/${i}/variant`);
  }
}

/** No source fetch, native payload construction, file access, transport or acceptance. */
export function preparePaperPlan(input:unknown){
  const parsed=paperPlanInputSchema.safeParse(input);if(!parsed.success)return invalid();
  const plan=parsed.data;
  return {inputValid:true as const,status:'plan_only',planFingerprint:planHash(plan),selectionFingerprint:digest('academy.paper-selection/1',plan.selection),
    summary:summary(plan),issues:[],outputVerification:'required_after_generation',...boundary};
}

export function verifyPaperPreparation(input:unknown){
  const parsed=paperPreparationInputSchema.safeParse(input);if(!parsed.success)return invalid();
  const {plan,prepared,planFingerprint}=parsed.data,issues:Issue[]=[];
  issue(issues,planHash(plan)!==planFingerprint,'plan_fingerprint_mismatch','/planFingerprint');
  compareSelection(plan,prepared.selection,issues);
  for(const role of ['selection','nativeLayout','nativeOptions'] as const){
    issue(issues,canonicalJson(plan.sourceBindings[role])!==canonicalJson(prepared.sourceBindings[role]),'source_binding_mismatch',`/prepared/sourceBindings/${role}`);
  }
  for(const kind of ['student','teacher'] as const){
    for(const field of ['examDisposeType','examSpacer','addAnswer','addExplain'] as const){
      issue(issues,plan[kind][field]!==prepared[kind][field],'native_option_mismatch',`/prepared/${kind}/${field}`);
    }
  }
  return {inputValid:true as const,status:issues.length?'hold':'consistent_caller_reported',planFingerprint:planHash(plan),
    templateSha256:prepared.templateSha256,summary:summary(plan),issues,outputVerification:'required_after_generation',...boundary};
}

export function verifyPaperOutput(input:unknown){
  const parsed=paperOutputInputSchema.safeParse(input);if(!parsed.success)return invalid();
  const {plan,planFingerprint,outputs}=parsed.data,issues:Issue[]=[];
  const fingerprint=planHash(plan),expectedIds=plan.selection.map(row=>row.questionId);
  issue(issues,fingerprint!==planFingerprint,'plan_fingerprint_mismatch','/planFingerprint');
  for(const kind of ['student','teacher'] as const){
    const output=outputs[kind],prefix=`/outputs/${kind}`,review=output.visualReview;
    issue(issues,output.planFingerprint!==fingerprint,'receipt_plan_mismatch',`${prefix}/planFingerprint`);
    issue(issues,output.pages.length!==output.pageCount,'page_metadata_incomplete',`${prefix}/pages`);
    issue(issues,output.orderMethod!=='numbered_visual_order','numbered_visual_order_unverified',`${prefix}/orderMethod`);
    const actualIds=output.pages.flatMap(value=>value.questionIds);
    issue(issues,actualIds.length!==expectedIds.length,'output_question_count_mismatch',`${prefix}/pages`);
    issue(issues,new Set(actualIds).size!==actualIds.length,'output_duplicate_question',`${prefix}/pages`);
    for(let i=0;i<Math.max(expectedIds.length,actualIds.length);i++)issue(issues,expectedIds[i]!==actualIds[i],'output_question_order_mismatch',`${prefix}/questionOrder/${i}`);
    for(let i=0;i<output.pages.length;i++){
      issue(issues,output.pages[i].pageNumber!==i+1,'page_sequence_mismatch',`${prefix}/pages/${i}/pageNumber`);
      if(kind==='student')issue(issues,output.pages[i].questionIds.length!==2,'student_questions_per_page_mismatch',`${prefix}/pages/${i}/questionIds`);
    }
    if(kind==='student')issue(issues,output.pageCount!==expectedIds.length/2,'student_page_count_mismatch',`${prefix}/pageCount`);
    if(review.method==='jev_first_with_human_exceptions'){
      const modelPages=review.pageReviews.map(item=>item.pageNumber),humanPages=new Set(review.humanReviewedPages);
      issue(issues,modelPages.length!==output.pageCount||new Set(modelPages).size!==output.pageCount||modelPages.some(number=>number>output.pageCount),
        'model_page_coverage_incomplete',`${prefix}/visualReview/pageReviews`);
      for(const [index,item]of review.pageReviews.entries())issue(issues,item.sourcePdfSha256!==output.pdfSha256,
        'model_page_pdf_binding_mismatch',`${prefix}/visualReview/pageReviews/${index}/sourcePdfSha256`);
      for(const field of ['humanReviewedPages','highRiskPages'] as const)issue(issues,new Set(review[field]).size!==review[field].length||review[field].some(number=>number>output.pageCount),
        'visual_page_reference_invalid',`${prefix}/visualReview/${field}`);
      const exceptions=new Set([...review.highRiskPages,...review.pageReviews.filter(item=>item.modelStatus!=='pass').map(item=>item.pageNumber)]);
      issue(issues,[...exceptions].some(number=>!humanPages.has(number)),'human_exception_coverage_incomplete',`${prefix}/visualReview/humanReviewedPages`);
    }else{
      issue(issues,review.method!=='human_visual','visual_review_missing',`${prefix}/visualReview/method`);
      issue(issues,review.reviewedPages.length!==output.pageCount||new Set(review.reviewedPages).size!==output.pageCount||
        review.reviewedPages.some(number=>number>output.pageCount),'visual_page_coverage_incomplete',`${prefix}/visualReview/reviewedPages`);
    }
    issue(issues,review.answers!==(kind==='student'?'absent':'present'),'answer_visibility_unqualified',`${prefix}/visualReview/answers`);
    issue(issues,review.explanations!==(kind==='student'?'absent':'present'),'explanation_visibility_unqualified',`${prefix}/visualReview/explanations`);
    issue(issues,review.variants!=='match','output_variant_match_unverified',`${prefix}/visualReview/variants`);
    issue(issues,review.rendering!=='complete','rendering_unverified',`${prefix}/visualReview/rendering`);
  }
  issue(issues,outputs.student.pdfSha256===outputs.teacher.pdfSha256,'student_teacher_pdf_identity_conflict','/outputs');
  return {inputValid:true as const,status:issues.length?'hold':'consistent_caller_reported',planFingerprint:fingerprint,summary:summary(plan),
    outputs:{student:{pdfSha256:outputs.student.pdfSha256,receiptSha256:outputs.student.receiptSha256,pageCount:outputs.student.pageCount},
      teacher:{pdfSha256:outputs.teacher.pdfSha256,receiptSha256:outputs.teacher.receiptSha256,pageCount:outputs.teacher.pageCount}},issues,...boundary};
}
