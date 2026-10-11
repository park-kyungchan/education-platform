import {z} from 'zod';
import {Id,Hash,Instant} from '../schema/v1/ids.ts';
export function publicSourceFailure(code:'AUTH_REQUIRED'|'ACCESS_DENIED'|'NETWORK_ERROR'|'RATE_LIMITED',runId:string){return {status:'failure',code,runId};}
