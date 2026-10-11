import {z} from 'zod';
import {Id,Hash,Instant} from './ids.ts';
import {SourceTime} from './primitives.ts';
export const SourceResult=z.discriminatedUnion('status',[z.strictObject({status:z.literal('success'),sourceId:Id,studentId:Id,queriedAt:Instant,sourceEventAt:SourceTime,completeWithinDeclaredScope:z.boolean(),recordIds:z.array(Id)}),z.strictObject({status:z.literal('failure'),sourceId:Id,studentId:Id,attemptedAt:Instant,code:z.enum(['AUTH_REQUIRED','ACCESS_DENIED','RATE_LIMITED','NETWORK_ERROR','IDENTITY_MISMATCH','UNVERIFIED_ROUTE'])})]);
