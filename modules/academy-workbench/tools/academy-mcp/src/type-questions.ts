import {z} from 'zod';
import {assessmentBindingSchema} from './assessment-binding.ts';
export const reviewTypeQuestionsInputSchema=z.object({
  assessmentBinding:assessmentBindingSchema.optional(),hierarchyId:z.string().min(1).max(1024),labelId:z.string().min(1).max(1024),
  purpose:z.enum(['teacher_requested_review','protocol_verification']),
  page:z.number().int().min(1).max(100000).default(1),offset:z.number().int().min(0).max(49).default(0),limit:z.number().int().min(1).max(20).default(10),
}).strict();
const scalar=z.union([z.string().max(100000),z.number().finite(),z.boolean(),z.null()]);
const preview=z.object({type:z.enum(['obj','sbj','des']),url:z.string().regex(/^https:\/\/storage\.studyq\.net\/data\/contents\/exam\/d6-[0-9]{3}\/d4-[0-9]{2}\/d2-[0-9]{2}\/ek-[1-9][0-9]{0,8}\/[1-9][0-9]{0,8}-examcard-(obj|sbj|des)\.png$/),source:z.literal('original_previewDBExam_and_common_function_js'),contentFetched:z.literal(false)}).strict();
export const nativeQuestionPageSchema=z.object({
  sourceOperation:z.literal('test_pool_type_questions'),selectorSha256:z.string().regex(/^[a-f0-9]{64}$/),sourceSha256:z.string().regex(/^[a-f0-9]{64}$/),observedAt:z.iso.datetime({offset:true}),
  scope:z.object({cl1:z.number().int().nonnegative(),cl2:z.number().int().nonnegative(),cl3:z.number().int().positive(),cl4:z.number().int().nonnegative()}).strict(),
  patNo:z.string().regex(/^[1-9][0-9]{0,15}$/),labelExact:z.string().min(1).max(4096),templateSha256:z.string().regex(/^[a-f0-9]{64}$/),
  page:z.number().int().positive(),totalPages:z.number().int().nonnegative(),sourceRecordCount:z.number().int().nonnegative(),
  sourcePageSize:z.literal(50),sourceRowCount:z.number().int().min(0).max(50),offset:z.number().int().min(0).max(49),nextOffset:z.number().int().min(1).max(49).nullable(),
  questions:z.array(z.object({sourceNamespace:z.literal('academy_item'),lectureKey:z.string().regex(/^[1-9][0-9]{0,15}$/),patNo:z.string(),labelExact:z.string().min(1).max(4096),unitNameExact:z.string().min(1).max(4096),sourceFields:z.record(z.string(),scalar),previewReferences:z.array(preview).max(3)}).strict()).max(50),
  previewReferencesState:z.enum(['qualified_original_source','source_changed_unqualified']),
  coverage:z.literal('returned_type_page_only'),questionContent:z.literal('source_metadata_and_answer_only'),sourceOrderPreserved:z.literal(true),sourceHandlersExecuted:z.literal(false),academyWrites:z.literal(0),finalItemMembershipCreated:z.literal(false),
}).strict();
