import {z} from 'zod';
import {Id,Hash,Instant} from '../schema/v1/ids.ts';
export function checkRevisionAppend(current:{studentId:string;headSha256:string},proposed:{studentId:string;expectedHeadSha256:string;correctionOfEventId:string|null}){if(current.studentId!==proposed.studentId)return {allowed:false,code:'student_scope_mismatch'};if(current.headSha256!==proposed.expectedHeadSha256)return {allowed:false,code:'revision_conflict'};return {allowed:true,mode:'append_only',preservePriorEvents:true,correctionOfEventId:proposed.correctionOfEventId};}
