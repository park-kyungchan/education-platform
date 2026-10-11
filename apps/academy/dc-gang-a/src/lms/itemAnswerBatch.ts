import {readItemAnswer,type ItemAnswerObservation} from './itemAnswerRead';
import type {ItemMetadataEnvironment} from './itemMetadataRead';

export interface ItemAnswerBatchResult {
  status:'observed'|'partial'|'blocked';
  requestedLabels:string[];
  observations:ItemAnswerObservation[];
  pendingLabels:string[];
  blockedReason:string|null;
  automaticRetryAllowed:false;
}
/** Persist each observation through the caller before advancing; never replay a failed request automatically. */
export async function readItemAnswerBatch(labels:readonly string[],environment:ItemMetadataEnvironment,onObservation:(item:ItemAnswerObservation)=>void|Promise<void>):Promise<ItemAnswerBatchResult> {
  if(!Array.isArray(labels)||labels.length<1||labels.length>32||labels.some(key=>typeof key!=='string'||!/^[1-9][0-9]{0,15}$/.test(key)||BigInt(key)>BigInt(Number.MAX_SAFE_INTEGER))||new Set(labels).size!==labels.length)throw Error('invalid_answer_batch_scope');
  const observations:ItemAnswerObservation[]=[];
  let blockedReason:string|null=null;
  for(const label of labels){
    let answer:ItemAnswerObservation;
    try{answer=await readItemAnswer(label,environment);}catch(error){blockedReason=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'item_answer_read_failed';break;}
    observations.push(answer);
    // Persistence failures propagate: a source success is not a successful durable batch.
    await onObservation(answer);
  }
  return {status:observations.length===labels.length?'observed':observations.length?'partial':'blocked',requestedLabels:[...labels],observations,pendingLabels:labels.slice(observations.length),blockedReason,automaticRetryAllowed:false};
}
