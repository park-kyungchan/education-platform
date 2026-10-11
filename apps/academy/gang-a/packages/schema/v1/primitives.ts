import {z} from 'zod';
import {Id,Hash,Instant} from './ids.ts';
export const SourceTime=z.strictObject({kind:z.enum(['absolute','raw_without_year','relative','unknown']),raw:z.string().nullable(),instant:Instant.nullable()}).superRefine((x,c)=>{if(x.kind!=='absolute'&&x.instant!==null)c.addIssue({code:'custom',message:'uncertain_time_cannot_supply_absolute_instant'});if(x.kind==='absolute'&&x.instant===null)c.addIssue({code:'custom',message:'absolute_time_requires_observed_instant'});});
