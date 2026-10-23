import {z} from 'zod';
import {freezeLabelData} from './item-label-context.ts';

const text=z.string().min(1).max(4096).refine(value=>value.trim().length>0&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),'nonempty_safe_text_required');
export const dailyRecordFields=['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment'] as const;
export type DailyRecordField=typeof dailyRecordFields[number];
export const dailyRecordFieldSchema=z.enum(dailyRecordFields);
export const dailyRecordIdSchema=text.max(256);
export const dailyRecordDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;},'real_calendar_date_required');
export const dailyRecordScopeSchema=z.object({sourceNamespace:dailyRecordIdSchema,teacherId:dailyRecordIdSchema,studentId:dailyRecordIdSchema,lessonDate:dailyRecordDateSchema}).strict();
export const dailyRecordFactSchema=z.object({ref:dailyRecordIdSchema,field:dailyRecordFieldSchema,text,origin:z.enum(['user_supplied','cism_section']).default('user_supplied'),
  explicitValue:z.string().max(8192).optional(),
  requiredFragments:z.array(text).max(32),
  questionCounts:z.array(z.object({count:z.number().int().nonnegative().max(100000),rendering:text.max(256)}).strict().refine(v=>new RegExp('(?<!\\d)'+v.count+'\\s*문항(?!\\d)').test(v.rendering),'count_rendering_must_preserve_count')).max(32),
  deadlines:z.array(z.object({date:dailyRecordDateSchema,rendering:text.max(256)}).strict().refine(v=>{
    const [year,month,day]=v.date.split('-').map(Number);
    return [...v.rendering.matchAll(/(?:(\d{4})[-./](\d{1,2})[-./](\d{1,2})|(\d{1,2})\s*월\s*(\d{1,2})\s*일)/g)]
      .every(m=>m[1]?Number(m[1])===year&&Number(m[2])===month&&Number(m[3])===day:Number(m[4])===month&&Number(m[5])===day);
  },'deadline_rendering_must_preserve_date')).max(16),
  stageClaims:z.array(z.object({activity:text.max(256),stage:z.enum(['solving','grading','correction','teacher_review','assigned_homework']),status:z.enum(['in_progress','complete','unconfirmed','assigned']),rendering:text.max(256)}).strict()).max(32),
}).strict().superRefine((value,context)=>{
  if(value.explicitValue===undefined)return;
  const allowed=value.field==='attendance'?['Y','N','L',' ','']:value.field==='dailyTestAssessment'?['-1','0','1','2','3','4','5','6','7','8','9','10']:value.field==='previousHomeworkAssessment'?['-1','0','1','2','3','4','5']:null;
  if(allowed&&!allowed.includes(value.explicitValue))context.addIssue({code:'custom',message:'explicit_source_option_required'});
});
export const dailyRecordContextSchema=z.object({schemaVersion:z.literal('academy.dailyrecord-user-context/1'),purpose:text,
  currentRequestRef:dailyRecordIdSchema,scope:dailyRecordScopeSchema,
  selectedFields:z.array(dailyRecordFieldSchema).min(1).max(6),
  memoAnswer:z.discriminatedUnion('kind',[
    z.object({kind:z.literal('not_supplied')}).strict(),
    z.object({kind:z.literal('no_addition'),requestRef:dailyRecordIdSchema}).strict(),
    z.object({kind:z.literal('content'),requestRef:dailyRecordIdSchema,text}).strict(),
  ]),facts:z.array(dailyRecordFactSchema).max(64),
}).strict().superRefine((value,context)=>{
  if(new Set(value.selectedFields).size!==value.selectedFields.length)context.addIssue({code:'custom',message:'duplicate_selected_field'});
  if(new Set(value.facts.map(f=>f.ref)).size!==value.facts.length)context.addIssue({code:'custom',message:'duplicate_fact_ref'});
});
export type DailyRecordContext=z.infer<typeof dailyRecordContextSchema>;
export type DailyRecordScope=z.infer<typeof dailyRecordScopeSchema>;
export const dailyRecordWorkflowContext=freezeLabelData({schemaVersion:'academy.dailyrecord-workflow-context/1',
  purpose:'Prepare exact student/date DailyRecord intake and parent-facing field review using the current user context.',
  policyOwner:'Education/apps/academy/dc-gang-a/docs/daily-record-authoring-policy.md',
  workflow:['exact_owned_scope','qualified_before_state','missing_only_interview','field_local_review','separate_trusted_save_and_readback'],
  rules:['Preserve existing homework assessment, DailyTest and attendance unless the user explicitly changes that exact field.',
    'Ask for today\'s student-specific memo unless today\'s content or no-addition answer is supplied.',
    'No additional memo does not mean erase an existing memo.',
    'Counts, rates and narratives never establish assessment or attendance codes.',
    'Previous homework assessment belongs to an independently identified previous lesson record.',
    'Preserve supplied counts including duplicate-inclusive counts; preserve deadlines and learning stages.',
    'CISM requires exact teacher, student, reporting period, report and relevant section.',
    'User context explains meaning; caller approval flags and source pins do not grant effect authority.'],
  boundaries:{academyWrites:0,parentSends:0,automaticRewrite:false,automaticRetry:false,credentialInput:false,sourceTruthFromCaller:false},
});
