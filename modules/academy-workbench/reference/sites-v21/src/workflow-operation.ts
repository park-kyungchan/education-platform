/** Data-free shared descriptor for HTTP, Site MCP and native browser registration. */
export const WORK_CONTEXT_TOOL={
 name:'academy_work_context',description:'Read a bounded academy workflow-policy reference page or date/session preparation for explicitly user-confirmed members. Policy steps are never student tasks. Unloaded assignments, execution attempts, current decisions, historical membership and attendance remain unknown. Read only; no live query or writes.',
 // Keep discovery as one complete object. A native connector previously kept
 // only the top-level oneOf branch's view property and rejected preparation.
 // View-specific required/forbidden fields remain enforced by the unchanged
 // strict server parser and visible browser action, not by tool metadata.
 inputSchema:{type:'object',properties:{view:{type:'string',enum:['policy-index','preparation']},domain:{type:'string',enum:['administration','middle_school','elementary_school','teaching_coaching']},offset:{type:'integer',minimum:0,maximum:10000},limit:{type:'integer',minimum:1,maximum:20},date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},session:{oneOf:[{type:'string',const:'all'},{type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER}]},policyIds:{type:'array',items:{type:'string',minLength:1,maxLength:160,pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]*$'},maxItems:12,uniqueItems:true},expectedCatalogRevision:{type:'string',pattern:'^[a-f0-9]{64}$'},expectedMembershipRevision:{type:'string',pattern:'^[a-f0-9]{64}$'},expectedRosterRevision:{type:'string',minLength:1,maxLength:512}},required:['view'],additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
} as const;
