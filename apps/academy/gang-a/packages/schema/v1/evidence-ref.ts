import {z} from 'zod';
import {Id,Hash,Instant} from './ids.ts';
import {SourceTime} from './primitives.ts';
export const EvidenceRef=z.strictObject({id:Id,sourceId:Id,sourceClass:z.enum(['native_metadata_observed','native_grading_observed','native_teacher_review_observed','user_confirmed_statement','public_book_metadata','derived_inference']),sha256:Hash,sourcePointer:z.string().nullable(),nativeEntityId:Id.nullable(),sourceLabelRaw:z.string().nullable(),sourceEventAt:SourceTime,queriedAt:Instant.nullable(),recordedAt:Instant,authorityGranted:z.literal(false)});
