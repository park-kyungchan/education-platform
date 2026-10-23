import {z} from 'zod';
import {assessmentBindingSchema} from './assessment-binding.ts';
import {itemLabelUserContext,freezeLabelData} from './item-label-context.ts';

const text = z.string().min(1).max(1024).refine(value => value.trim().length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value),'invalid_label_text');
const id = text.max(256);
export const labelSnapshotSchema = z.object({
  schemaVersion:z.literal('academy.item-label-snapshot/1'),
  source:z.object({
    kind:z.enum(['retained_read_only_snapshot','synthetic_fixture']),
    origin:z.literal('https://dc.gang-a.kr'),
    entryPath:z.literal('/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main'),
    tabPath:z.literal('/common/etest_pool.jsp'),
    revision:id,observedAt:z.iso.datetime({offset:true}),evidenceRefs:z.array(text).min(1).max(32),
    coverage:z.enum(['partial','complete_in_declared_scope']),scopeHierarchyIds:z.array(id).min(1).max(100),
  }).strict(),
  hierarchy:z.array(z.object({id,parentId:id.nullable(),labelExact:text,evidenceRefs:z.array(text).min(1).max(32)}).strict()).min(1).max(10000),
  labels:z.array(z.object({id,hierarchyId:id,labelExact:text,description:text.optional(),aliases:z.array(text).max(32),evidenceRefs:z.array(text).min(1).max(32),
    nativeId:z.union([z.string().min(1).max(256),z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)]).optional(),
    sourceQuestionCountRaw:z.union([z.string().regex(/^[0-9]{1,16}$/),z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).optional(),
  }).strict()).max(10000),
}).strict();
export type LabelSnapshot = z.infer<typeof labelSnapshotSchema>;
export const findItemLabelsInputSchema = z.object({
  assessmentBinding:assessmentBindingSchema.optional(),intent:text.max(2000),hierarchyIds:z.array(id).min(1).max(100),includeDescendants:z.boolean().default(true),
  learningState:z.enum(['in_progress','teacher_reported_complete']),
  limit:z.number().int().min(1).max(50).default(10),
}).strict();
export const itemLabelScopeInputSchema = z.object({
  assessmentBinding:assessmentBindingSchema.optional(),view:z.enum(['hierarchy','labels']).default('hierarchy'),
  hierarchyId:id.optional(),
  parentId:id.nullable().optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20),
}).strict().superRefine((value,context)=>{
  if(value.view==='labels'&&(!value.hierarchyId||value.parentId!==undefined))context.addIssue({code:'custom',message:'label_view_requires_one_exact_hierarchy_id'});
  if(value.view==='hierarchy'&&value.hierarchyId!==undefined)context.addIssue({code:'custom',message:'hierarchy_id_requires_label_view'});
});

/** Normalization is for comparison only; it never rewrites source labels or IDs. */
function terms(value:string):Set<string> {
  const words=value.normalize('NFKC').toLocaleLowerCase('ko').match(/[\p{L}\p{N}]+/gu)??[];
  const tokens=new Set<string>();
  for(const word of words){tokens.add(`word:${word}`);const chars=[...word];for(let i=0;i+1<chars.length;i++)tokens.add(`pair:${chars[i]}${chars[i+1]}`);}
  return tokens;
}

export class ItemLabelIndex {
  readonly snapshot:LabelSnapshot;
  readonly #nodes:Map<string,LabelSnapshot['hierarchy'][number]>;
  readonly #paths=new Map<string,readonly LabelSnapshot['hierarchy'][number][]>();
  readonly #terms:readonly Set<string>[];
  constructor(value:unknown,readonly snapshotSha256:string) {
    if(!/^[a-f0-9]{64}$/.test(snapshotSha256))throw Error('invalid_snapshot_sha256');
    this.snapshot=freezeLabelData(labelSnapshotSchema.parse(value));
    this.#nodes=new Map();
    for(const node of this.snapshot.hierarchy){if(this.#nodes.has(node.id))throw Error('duplicate_hierarchy_id');this.#nodes.set(node.id,node);}
    // Iterative traversal avoids stack exhaustion for deep or malformed source hierarchies.
    for(const node of this.snapshot.hierarchy){const seen=new Set<string>(),path=[];let current:typeof node|undefined=node;
      while(current){if(seen.has(current.id))throw Error('cyclic_label_hierarchy');seen.add(current.id);path.unshift(current);
        if(path.length>64)throw Error('label_hierarchy_depth_limit');
        if(current.parentId===null)break;current=this.#nodes.get(current.parentId);if(!current)throw Error('missing_hierarchy_parent');}
      this.#paths.set(node.id,Object.freeze(path));
    }
    const scope=new Set(this.snapshot.source.scopeHierarchyIds);
    if(scope.size!==this.snapshot.source.scopeHierarchyIds.length)throw Error('duplicate_snapshot_scope');
    for(const key of scope)if(!this.#nodes.has(key))throw Error('snapshot_scope_not_found');
    const labels=new Set<string>();
    for(const label of this.snapshot.labels){if(labels.has(label.id))throw Error('duplicate_label_id');labels.add(label.id);
      const path=this.#paths.get(label.hierarchyId);if(!path)throw Error('label_hierarchy_not_found');
      if(!path.some(node=>scope.has(node.id)))throw Error('label_outside_declared_scope');}
    this.#terms=this.snapshot.labels.map(label=>terms([label.labelExact,label.description??'',...label.aliases].join(' ')));
  }
  #source() {return {snapshotSha256:this.snapshotSha256,...this.snapshot.source,liveCurrentness:'not_verified',
    qualification:'source_declared_snapshot_not_authenticated_by_index',academyRequests:0};}
  scope(value:unknown) {
    const input=itemLabelScopeInputSchema.parse(value);
    if(input.view==='labels'){
      if(!this.#nodes.has(input.hierarchyId!))throw Error('query_hierarchy_not_found');
      const labels=this.snapshot.labels.filter(label=>label.hierarchyId===input.hierarchyId);
      if(input.offset>labels.length)throw Error('label_offset_out_of_range');const end=Math.min(labels.length,input.offset+input.limit);
      return {status:'available',userContext:itemLabelUserContext,source:this.#source(),labels:labels.slice(input.offset,end),total:labels.length,
        nextOffset:end<labels.length?end:null,sourceOrderPreserved:true,finalItemMembershipCreated:false};
    }
    if(input.parentId!==undefined&&input.parentId!==null&&!this.#nodes.has(input.parentId))throw Error('query_hierarchy_not_found');
    const nodes=this.snapshot.hierarchy.filter(node=>input.parentId===undefined||node.parentId===input.parentId);
    if(input.offset>nodes.length)throw Error('hierarchy_offset_out_of_range');
    const end=Math.min(nodes.length,input.offset+input.limit);
    return {status:'available',userContext:itemLabelUserContext,source:this.#source(),nodes:nodes.slice(input.offset,end),total:nodes.length,
      nextOffset:end<nodes.length?end:null,totalLabelsInSnapshot:this.snapshot.labels.length,
      totalLabelsInAcademy:'unknown',sourceHierarchyPreserved:true};
  }
  find(value:unknown) {
    const input=findItemLabelsInputSchema.parse(value);
    if(input.learningState!=='teacher_reported_complete')return {status:'held' as const,reason:'detailed_type_study_not_reported_complete',userContext:itemLabelUserContext,source:this.#source(),finalItemMembershipCreated:false};
    if(new Set(input.hierarchyIds).size!==input.hierarchyIds.length)throw Error('duplicate_query_hierarchy');
    const roots=new Set(input.hierarchyIds),declared=new Set(this.snapshot.source.scopeHierarchyIds);
    for(const key of roots){const path=this.#paths.get(key);if(!path)throw Error('query_hierarchy_not_found');
      if(!path.some(node=>declared.has(node.id)))throw Error('query_outside_declared_scope');}
    const query=terms(input.intent);
    if(!query.size)throw Error('query_has_no_comparable_terms');
    const scoped=this.snapshot.labels.map((label,index)=>({label,index})).filter(({label})=>input.includeDescendants
      ? this.#paths.get(label.hierarchyId)!.some(node=>roots.has(node.id)):roots.has(label.hierarchyId));
    const ranked=scoped.flatMap(({label,index})=>{
      const tokens=this.#terms[index],overlap=[...query].filter(token=>tokens.has(token));
      if(!overlap.length)return [];
      const union=query.size+tokens.size-overlap.length;
      return [{...label,hierarchyPath:this.#paths.get(label.hierarchyId),lexicalSimilarity:overlap.length/union,
        overlapTerms:overlap.sort(),sourceOrdinal:index}];
    }).sort((a,b)=>b.lexicalSimilarity-a.lexicalSimilarity||a.sourceOrdinal-b.sourceOrdinal);
    return {status:'available' as const,userContext:itemLabelUserContext,source:this.#source(),query:{...input},method:'literal_terms_and_character_bigrams_jaccard_v1',
      matches:ranked.slice(0,input.limit),matchedLabelsInSnapshot:ranked.length,examinedLabelsInScope:scoped.length,
      truncated:ranked.length>input.limit,finalItemMembershipCreated:false,questionSelectionPerformed:false,
      interpretation:{score:'lexical_overlap_not_semantic_probability',teacherComparisonRequired:true,
        zeroMatchesProveSourceAbsence:false,pointsUsedAsDifficultyOrSimilarity:false,sourceLabelsOrHierarchyInferred:false}};
  }
}
