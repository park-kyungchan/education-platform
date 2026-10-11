import {z} from 'zod';
import {Id,Hash,Instant} from '../schema/v1/ids.ts';
import {EvidenceRef} from '../schema/v1/evidence-ref.ts';
export const AssessmentDefinition=z.strictObject({id:Id,nativeId:Id.nullable(),sourceId:Id,sourceLabelRaw:z.string(),nativeHierarchyPath:z.array(Id),definitionEvidence:EvidenceRef});
export const DailyRestudyRelation=z.strictObject({assessmentDefinitionId:Id,dailyRestudyEntityId:Id,relation:z.enum(['unknown','related','same_native_entity']),evidence:EvidenceRef.nullable()}).superRefine((x,c)=>{if(x.relation==='same_native_entity'&&(x.evidence?.sourceClass!=='native_metadata_observed'||!x.evidence.nativeEntityId))c.addIssue({code:'custom',message:'DT_ZT_name_or_diary_mention_cannot_establish_native_identity'});});
