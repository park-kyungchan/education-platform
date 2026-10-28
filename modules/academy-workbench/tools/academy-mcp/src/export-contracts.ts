import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { capabilitiesInputSchema, sourceStatusInputSchema } from './service.ts';
import { queryInputSchema, queryResultSchema } from './contracts.ts';
import { hierarchy, WORKFLOW_RELATIONS } from './taxonomy.ts';
import { packageRoot } from './paths.ts';
import {findItemLabelsInputSchema,itemLabelScopeInputSchema} from './item-labels.ts';
import {reviewTypeQuestionsInputSchema} from './type-questions.ts';
import {dailyRecordIntakeSchema,dailyRecordReviewSchema,cismSectionSchema,studentMetadataGetSchema} from './dailyrecord.ts';
import {dailyRecordGetSchema} from './dailyrecord-read.ts';

const directory = resolve(packageRoot, 'schemas');
await mkdir(directory, { recursive: true });
const contracts = {
  schemaVersion: 'academy.operations-mcp-contracts/1',
  sourceOwner: 'src/contracts.ts, src/service.ts, src/item-labels.ts and src/dailyrecord.ts',
  transport: 'stdio', sourceMode: 'saved_context',
  tools: {
    academy_student_metadata_get: {input:z.toJSONSchema(studentMetadataGetSchema),runtimeRefinements:'Separate hash-pinned metadata owner policy. Exact dated owner identity and permitted query batch in one backend process; no cross-namespace proof propagation. Relative selectors require explicit owner admission and never imply exact calendar coverage.'},
    academy_dailyrecord_get:{input:z.toJSONSchema(dailyRecordGetSchema,{io:'input'}),runtimeRefinements:'Read-only name -> exact native resolution -> qualified intake. Today uses Asia/Seoul. Owner scope is never caller input; unavailable/ambiguous/out-of-admission requests stop without retry. Authoring interviews do not block an observed read.'},
    academy_capabilities: { input: z.toJSONSchema(capabilitiesInputSchema), runtimeRefinements: 'source_contract requires exact operationId; workflow_rules has no invented domain assignment; the server validates cross-field combinations.' },
    academy_query: { input: z.toJSONSchema(queryInputSchema,{io:'input'}), output: z.toJSONSchema(queryResultSchema) },
    academy_source_status: { input: z.toJSONSchema(sourceStatusInputSchema) },
    academy_item_label_scope: {input:z.toJSONSchema(itemLabelScopeInputSchema),runtimeRefinements:'labels view requires one exact hierarchyId and no parentId; hierarchy view disallows hierarchyId. Live IDs must first be returned by the configured source, not guessed.'},
    academy_find_item_labels: {input:z.toJSONSchema(findItemLabelsInputSchema),runtimeRefinements:'Exact retained hierarchy scope and teacher-reported completed type study; lexical overlap is not semantic probability or final question membership.'},
    academy_review_type_questions: {input:z.toJSONSchema(reviewTypeQuestionsInputSchema),runtimeRefinements:'Native adapter requires a previously returned exact type/hierarchy; bounded source metadata/answers only, no image fetch, ranking or final selection. Retained labels do not establish questions.'},
    academy_dailyrecord_intake: {input:z.toJSONSchema(dailyRecordIntakeSchema),runtimeRefinements:'Current user context is required before any backend read. Existing field values are preserved; unknown assessment/attendance require explicit values. Today memo no-addition never authorizes deletion. Default source backend is unavailable.'},
    academy_dailyrecord_review: {input:z.toJSONSchema(dailyRecordReviewSchema),runtimeRefinements:'Pure text review is available without source, but no patch is prepared without a fresh backend-owned scoped observation handle. Canonical safeguard, exact before-state and selected-field facts are required; semantic equivalence still needs teacher review. No source writer or approval flag.'},
    academy_cism_section: {input:z.toJSONSchema(cismSectionSchema),runtimeRefinements:'Exact source-owner read backend, teacher/student, report, period and learning-support section required; default unavailable. No generic URL execution, submission, memo save or send.'},
  },
};
await writeFile(resolve(directory, 'contracts.json'), JSON.stringify(contracts, null, 2) + '\n');
await writeFile(resolve(directory, 'hierarchy.json'), JSON.stringify({ hierarchy: hierarchy(), relationships: WORKFLOW_RELATIONS }, null, 2) + '\n');
console.log(JSON.stringify({ generated: ['schemas/contracts.json', 'schemas/hierarchy.json'], authorityGranted: false }));
