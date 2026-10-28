import {z} from 'zod';
import {publicReadFailure} from './read-failure.ts';

const label=z.string().regex(/^[1-9][0-9]{0,15}$/).refine(v=>BigInt(v)<=BigInt(Number.MAX_SAFE_INTEGER),'safe_item_label_required');
export const itemAnswerLookupSchema=z.object({
  labels:z.array(label).min(1).max(32).refine(v=>new Set(v).size===v.length,'unique_item_labels_required'),
  purpose:z.string().trim().min(1).max(256),currentRequestRef:z.string().trim().min(1).max(256),
}).strict();
export type ItemAnswerLookup=z.infer<typeof itemAnswerLookupSchema>;

/** The source's literal answer is neither a student's response nor a verified
 * rendering or an answer to an independently identified printed version. */
export const itemAnswerObservationSchema=z.object({
  identity:z.object({sourceNamespace:z.literal('academy_item'),lectureKey:label,outerLectureKey:label,sourceId:label}).strict(),
  answerLiteral:z.string().min(1).max(30000),
  answerAvailability:z.enum(['literal_payload_not_rendered','external_solution_reference']),
  answerMeaning:z.literal('source_official_item_answer_not_student_response'),
  rendering:z.literal('not_qualified'),paperMembership:z.literal('unqualified'),
}).strip();

/** Split an observed delimiter pattern without asserting source rendering semantics.
 * Preserve the entire literal: synthetic examples alone cannot qualify a renderer. */
export function decodeItemAnswerLiteral(answerLiteral:string):{answerPrefixCandidate:string|null;answerPayloadCandidate:string}{
  const at=answerLiteral.indexOf('|_|');
  if(at<0)return {answerPrefixCandidate:null,answerPayloadCandidate:answerLiteral};
  const code=answerLiteral.slice(0,at),text=answerLiteral.slice(at+3);
  if(!/^[0-9]{1,2}$/.test(code)||!text)return {answerPrefixCandidate:null,answerPayloadCandidate:answerLiteral};
  return {answerPrefixCandidate:code,answerPayloadCandidate:text};
}

export function projectItemAnswerRead(raw:unknown,labels:string[]){
  const value=z.object({family:z.literal('item_answer'),status:z.enum(['observed','partial','blocked']),
    requestedAnswerLabels:z.array(label),pendingAnswerLabels:z.array(label),
    answerBlockedReason:z.string().regex(/^[a-z_]{1,100}$/).nullable(),
    itemAnswers:z.array(itemAnswerObservationSchema),coverage:z.literal('exact_requested_shared_answers_not_printed_versions'),
    observedAt:z.iso.datetime({offset:true}),nativePrintInvoked:z.literal(false),automaticRetryAllowed:z.literal(false),
  }).parse(raw);
  if(JSON.stringify(value.requestedAnswerLabels)!==JSON.stringify(labels)||value.itemAnswers.length>labels.length
    ||value.itemAnswers.some((row,index)=>row.identity.lectureKey!==labels[index]||row.identity.sourceId!==labels[index])
    ||JSON.stringify(value.pendingAnswerLabels)!==JSON.stringify(labels.slice(value.itemAnswers.length))
    ||(value.status==='observed'&&(value.itemAnswers.length!==labels.length||value.answerBlockedReason!==null))
    ||(value.status==='partial'&&(value.itemAnswers.length===0||value.itemAnswers.length===labels.length||value.answerBlockedReason===null))
    ||(value.status==='blocked'&&(value.itemAnswers.length!==0||value.answerBlockedReason===null)))throw Error('item_answer_source_scope_conflict');
  if(Buffer.byteLength(JSON.stringify(value.itemAnswers),'utf8')>480*1024)throw Error('item_answer_result_too_large');
  const failure=value.answerBlockedReason===null?null:publicReadFailure(Error(value.answerBlockedReason),'item_answer_source_unqualified_no_automatic_retry');
  return {status:value.status,answers:value.itemAnswers.map(row=>({...row,...decodeItemAnswerLiteral(row.answerLiteral)})),pendingLabels:value.pendingAnswerLabels,reasonCode:failure?.code??null,...(failure?{failure}:{}),
    observedAt:value.observedAt,coverage:value.coverage,academyWrites:0,parentSends:0,nativePrintInvoked:false,automaticRetryAllowed:false};
}
