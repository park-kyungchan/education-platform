import {spawn} from 'node:child_process';
import {z} from 'zod';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {ItemLabelIndex,findItemLabelsInputSchema,itemLabelScopeInputSchema,type LabelSnapshot} from './item-labels.ts';
import {itemLabelUserContext,freezeLabelData} from './item-label-context.ts';
import {reviewTypeQuestionsInputSchema,nativeQuestionPageSchema} from './type-questions.ts';
import {poolQuestionContentInputSchema,readPoolQuestionImage,type PoolImageTransport} from './pool-question-content.ts';

const hash=z.string().regex(/^[a-f0-9]{64}$/),coordinate=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const scopeSchema=z.object({cl1:coordinate,cl2:coordinate,cl3:coordinate,cl4:coordinate}).strict();
const nativeKey=z.union([z.string().min(1).max(256),coordinate]);
const categorySchema=z.object({nativeKey,title:z.string().min(1).max(4096),scope:scopeSchema,isLazy:z.boolean(),isFolder:z.boolean()}).strict();
const nativeLabelSchema=z.object({nativeId:nativeKey,labelExact:z.string().min(1).max(4096),sourceQuestionCountRaw:z.union([z.string().regex(/^[0-9]{1,16}$/),coordinate])}).strict();
const categoryPageSchema=z.object({sourceOperation:z.literal('test_pool_category_list'),sourceSha256:hash,observedAt:z.iso.datetime({offset:true}),selectorSha256:hash,
  selectorDefaults:z.object({make_school_key:z.string(),category_iden:z.string(),categ_type:z.string()}).strict(),scope:scopeSchema,nodes:z.array(categorySchema).max(1000),sourceHandlersExecuted:z.literal(false),academyWrites:z.literal(0)}).strict();
const labelPageSchema=z.object({sourceOperation:z.literal('test_pool_type_labels'),sourceSha256:hash,observedAt:z.iso.datetime({offset:true}),selectorSha256:hash,
  template:z.object({sourceSha256:hash,queryFields:z.array(z.string())}).strict(),categoryIden:z.string(),scope:scopeSchema,labels:z.array(nativeLabelSchema).max(10000),
  wireFormat:z.enum(['sentinel_framed_html_body','sentinel_framed_body']),payloadSha256:hash,
  coverage:z.literal('returned_scoped_response_only'),wholePoolCompleteness:z.literal('unknown'),sourceHandlersExecuted:z.literal(false),academyWrites:z.literal(0),finalItemMembershipCreated:z.literal(false)}).strict();
const configSchema=z.object({schemaVersion:z.literal('academy.native-pool-read-bridge/1'),
  sshTarget:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/),containerId:hash,ownerUid:z.literal(10000),
  readerPath:z.string().startsWith('/'),readerSha256:hash,
}).strict();
type Scope=z.infer<typeof scopeSchema>;
type NativeRequest={operation:'categories'|'labels'|'questions'|'protocol';scope:Scope;expectedSelectorSha256?:string;patNo?:string;page?:number;limit?:number;offset?:number};
type Node=z.infer<typeof categorySchema>&{id:string;parentId:string|null;evidenceRefs:string[]};
type NativeReply={status:'observed';page:unknown;requests:number;academyWrites:0;passwordExported:false;cookiesExported:false};
export type PoolReadRunner=(request:NativeRequest)=>Promise<NativeReply>;

export class NativePoolLabelBackend {
  readonly openWorldHint=true;
  readonly idempotentHint=false;
  readonly #nodes=new Map<string,Node>();
  readonly #exposedNodes=new Set<string>();
  readonly #categories=new Map<string,z.infer<typeof categoryPageSchema>>();
  readonly #labels=new Map<string,z.infer<typeof labelPageSchema>>();
  readonly #questions=new Map<string,z.infer<typeof nativeQuestionPageSchema>>();
  readonly #exposedLabels=new Map<string,Set<string>>();
  readonly #exposedQuestions=new Map<string,{question:z.infer<typeof nativeQuestionPageSchema>['questions'][number];previewQualified:boolean}>();
  #presentationProtocol:Record<string,unknown>|undefined;
  #selectorSha:string|undefined;
  #defaults:z.infer<typeof categoryPageSchema>['selectorDefaults']|undefined;
  constructor(readonly run:PoolReadRunner,readonly imageTransport:PoolImageTransport=fetch){}
  async protocol(){
    if(!this.#presentationProtocol){
      const result=await this.run({operation:'protocol',scope:{cl1:0,cl2:0,cl3:0,cl4:0},expectedSelectorSha256:this.#selectorSha});
      const page=z.object({schemaVersion:z.literal(1),sourceOperation:z.literal('test_pool_presentation_protocol'),selectorSha256:hash,helpersSha256:hash,
        sourceHandlersExecuted:z.literal(false),academyWrites:z.literal(0),controls:z.array(z.unknown()).max(256),gridColumns:z.array(z.unknown()).max(256),
      }).passthrough().parse(result.page);
      if(this.#selectorSha&&page.selectorSha256!==this.#selectorSha)throw Error('live_label_selector_source_changed');
      this.#selectorSha=page.selectorSha256;
      this.#presentationProtocol=freezeLabelData(page);
    }
    return {...this.#context(),status:'available',...this.#presentationProtocol,contentIsUntrustedSourceData:true,
      difficultyMeaning:'Only literal original control evidence is returned; no inferred code mapping',sourceCurrentness:'observed_at_source_clock_not_automatic_refresh'};
  }
  async content(value:unknown){
    const input=poolQuestionContentInputSchema.parse(value);
    const exposed=this.#exposedQuestions.get(JSON.stringify([input.hierarchyId,input.labelId,input.lectureKey]));
    if(!exposed)throw Error('exact_previously_returned_question_required');
    const question=exposed.question;
    const reference=exposed.previewQualified?question.previewReferences.find(row=>row.type===input.variant):undefined;
    if(!reference)return {metadata:{status:'unavailable',reason:'question_preview_reference_not_source_qualified',lectureKey:input.lectureKey,variant:input.variant,academyRequests:0,academyWrites:0}};
    return readPoolQuestionImage(reference,input.lectureKey,this.imageTransport);
  }
  #node(id:string){const node=this.#nodes.get(id);if(!node)throw Error('exact_previously_returned_hierarchy_id_required');return node;}
  #callerNode(id:string){if(!this.#exposedNodes.has(id))throw Error('exact_previously_returned_hierarchy_id_required');return this.#node(id);}
  #context(){return {userContext:itemLabelUserContext,actualWholePool:'unknown',finalItemMembershipCreated:false};}
  #labelId(nativeId:string|number){return ['academy-pat',this.#defaults!.category_iden,typeof nativeId,nativeId].join(':');}
  #exposeLabels(id:string,labelIds:string[]){const seen=this.#exposedLabels.get(id)??new Set<string>();for(const labelId of labelIds)seen.add(labelId);this.#exposedLabels.set(id,seen);}
  async #labelPage(id:string){
    const node=this.#callerNode(id);if(!node.scope.cl3)throw Error('exact_existing_level3_or4_scope_required');
    let page=this.#labels.get(id);
    if(!page){const result=await this.run({operation:'labels',scope:node.scope,expectedSelectorSha256:this.#selectorSha});
      page=freezeLabelData(labelPageSchema.parse(result.page));
      if(page.selectorSha256!==this.#selectorSha||JSON.stringify(page.scope)!==JSON.stringify(node.scope))throw Error('live_label_source_scope_conflict');
      this.#labels.set(id,page);}
    return page;
  }
  async scope(value:unknown){
    const input=itemLabelScopeInputSchema.parse(value);
    if(input.view==='labels'){
      const page=await this.#labelPage(input.hierarchyId!);
      if(input.offset>page.labels.length)throw Error('label_offset_out_of_range');const end=Math.min(page.labels.length,input.offset+input.limit);
      this.#exposeLabels(input.hierarchyId!,page.labels.slice(input.offset,end).map(label=>this.#labelId(label.nativeId)));
      return {...this.#context(),status:'available',sourceMode:'native_read_only_snapshot',source:{observedAt:page.observedAt,sha256:page.sourceSha256,selectorSha256:page.selectorSha256,scope:page.scope,coverage:page.coverage},
        labels:page.labels.slice(input.offset,end).map(label=>({...label,id:['academy-pat',this.#defaults!.category_iden,typeof label.nativeId,label.nativeId].join(':'),hierarchyId:input.hierarchyId})),total:page.labels.length,nextOffset:end<page.labels.length?end:null,
        sourceOrderPreserved:true,currentness:'observed_at_source_clock_not_automatic_refresh'};
    }
    const parent=input.parentId?this.#callerNode(input.parentId):null,key=parent?.id??'root';
    let page=this.#categories.get(key);
    if(!page){const result=await this.run({operation:'categories',scope:parent?.scope??{cl1:0,cl2:0,cl3:0,cl4:0},expectedSelectorSha256:this.#selectorSha});
      page=freezeLabelData(categoryPageSchema.parse(result.page));
      if(this.#selectorSha&&page.selectorSha256!==this.#selectorSha)throw Error('live_label_selector_source_changed');
      if(JSON.stringify(page.scope)!==JSON.stringify(parent?.scope??{cl1:0,cl2:0,cl3:0,cl4:0}))throw Error('live_label_category_scope_conflict');
      const ids=new Set<string>(),pending:Node[]=[];
      for(const row of page.nodes){const id=['academy-category',page.selectorDefaults.category_iden,page.selectorDefaults.make_school_key,page.selectorDefaults.categ_type,...Object.values(row.scope)].join(':');
        if(ids.has(id)||id===parent?.id)throw Error('live_label_hierarchy_identity_conflict');ids.add(id);
        for(const coordinate of ['cl1','cl2','cl3','cl4'] as const)if(parent?.scope[coordinate]&&parent.scope[coordinate]!==row.scope[coordinate])throw Error('live_label_category_scope_conflict');
        const prior=this.#nodes.get(id);if(prior&&prior.parentId!==(parent?.id??null))throw Error('live_label_hierarchy_parent_conflict');
        pending.push(freezeLabelData({...row,id,parentId:parent?.id??null,evidenceRefs:[`sha256:${page.sourceSha256}`]}));}
      this.#selectorSha=page.selectorSha256;this.#defaults=page.selectorDefaults;
      for(const node of pending)this.#nodes.set(node.id,node);
      this.#categories.set(key,page);}
    const nodes=page.nodes.map(row=>this.#nodes.get(['academy-category',page.selectorDefaults.category_iden,page.selectorDefaults.make_school_key,page.selectorDefaults.categ_type,...Object.values(row.scope)].join(':'))!);
    if(input.offset>nodes.length)throw Error('hierarchy_offset_out_of_range');const end=Math.min(nodes.length,input.offset+input.limit);
    const exposed=nodes.slice(input.offset,end);
    const response={...this.#context(),status:'available',sourceMode:'native_read_only_snapshot',source:{observedAt:page.observedAt,sha256:page.sourceSha256,selectorSha256:page.selectorSha256,scope:page.scope},
      nodes:exposed,total:nodes.length,nextOffset:end<nodes.length?end:null,
      sourceHierarchyPreserved:true,currentness:'observed_at_source_clock_not_automatic_refresh'};
    for(const node of exposed)this.#exposedNodes.add(node.id);
    return response;
  }
  async find(value:unknown){
    const input=findItemLabelsInputSchema.parse(value);
    if(input.learningState!=='teacher_reported_complete')return {...this.#context(),status:'held',reason:'detailed_type_study_not_reported_complete'};
    if(input.hierarchyIds.length!==1)throw Error('live_comparison_requires_one_exact_studied_scope');
    if(!input.includeDescendants)throw Error('live_direct_only_label_membership_not_qualified');
    const id=input.hierarchyIds[0],page=await this.#labelPage(id),node=this.#node(id),path:Node[]=[];let current:Node|null=node;
    while(current){if(path.some(row=>row.id===current!.id)||path.length>=64)throw Error('live_label_hierarchy_cycle');path.unshift(current);current=current.parentId?this.#node(current.parentId):null;}
    const snapshot:LabelSnapshot={schemaVersion:'academy.item-label-snapshot/1',source:{kind:'retained_read_only_snapshot',origin:'https://dc.gang-a.kr',entryPath:'/servlet/controller.tutor.etest.TestPoolServlet?reqCmd=Main',tabPath:'/common/etest_pool.jsp',
      revision:page.sourceSha256,observedAt:page.observedAt,evidenceRefs:[`sha256:${page.sourceSha256}`],coverage:'partial',scopeHierarchyIds:[id]},
      hierarchy:path.map(row=>({id:row.id,parentId:row.parentId,labelExact:row.title,evidenceRefs:row.evidenceRefs})),
      labels:page.labels.map(label=>({id:['academy-pat',this.#defaults!.category_iden,typeof label.nativeId,label.nativeId].join(':'),hierarchyId:id,labelExact:label.labelExact,aliases:[],evidenceRefs:[`sha256:${page.sourceSha256}`],nativeId:label.nativeId,sourceQuestionCountRaw:label.sourceQuestionCountRaw}))};
    const found=new ItemLabelIndex(snapshot,page.sourceSha256).find(input);
    this.#exposeLabels(id,(found.matches??[]).map(label=>label.id));
    return {...found,liveReadEvidence:{observedAt:page.observedAt,responseSha256:page.sourceSha256,selectorSha256:page.selectorSha256,scope:page.scope},
      sourceMode:'native_read_only_snapshot'};
  }
  async review(value:unknown){
    const input=reviewTypeQuestionsInputSchema.parse(value),node=this.#callerNode(input.hierarchyId);
    if(!this.#exposedLabels.get(node.id)?.has(input.labelId))throw Error('exact_previously_returned_type_label_required');
    const labels=await this.#labelPage(node.id);
    const label=labels.labels.find(row=>['academy-pat',this.#defaults!.category_iden,typeof row.nativeId,row.nativeId].join(':')===input.labelId);
    if(!label)throw Error('exact_previously_returned_type_label_required');
    const patNo=String(label.nativeId);if(!/^[1-9][0-9]{0,15}$/.test(patNo))throw Error('source_type_id_not_qualified_for_question_read');
    const key=JSON.stringify([node.id,input.labelId,input.page]);let page=this.#questions.get(key);
    if(!page){const result=await this.run({operation:'questions',scope:node.scope,expectedSelectorSha256:this.#selectorSha,patNo,page:input.page,offset:0,limit:50});
      page=freezeLabelData(nativeQuestionPageSchema.parse(result.page));
      if(page.selectorSha256!==this.#selectorSha||JSON.stringify(page.scope)!==JSON.stringify(node.scope)||page.patNo!==patNo||page.labelExact!==label.labelExact||page.page!==input.page||page.offset!==0||page.questions.length!==page.sourceRowCount||page.questions.some(row=>row.patNo!==patNo)||page.nextOffset!==null)throw Error('live_question_source_scope_conflict');
      this.#questions.set(key,page);}
    if(input.offset>page.questions.length)throw Error('question_offset_out_of_range');
    const end=Math.min(input.offset+input.limit,page.questions.length),nextOffset=end<page.questions.length?end:null;
    for(const question of page.questions.slice(input.offset,end))this.#exposedQuestions.set(JSON.stringify([node.id,input.labelId,question.lectureKey]),{question,previewQualified:page.previewReferencesState==='qualified_original_source'});
    return {...this.#context(),status:'available',sourceMode:'native_read_only_snapshot',purpose:input.purpose,hierarchyId:node.id,labelId:input.labelId,
      ...page,questions:page.questions.slice(input.offset,end),offset:input.offset,nextOffset,nextPage:nextOffset===null&&page.page<page.totalPages?page.page+1:null,contentIsUntrustedSourceData:true,semanticSuitability:'teacher_review_pending',
      actualQuestionImages:'not_fetched',finalQuestionSelection:'not_performed'};
  }
}

// The fixed native Python API keeps the password and fresh cookies inside the existing owner container.
export const nativePoolDriver=`import os,sys,json,subprocess\nfrom hermes_cli.config import get_env_value_prefer_dotenv\ndef refuse(code):\n print(json.dumps({'status':'blocked','code':code,'academyWrites':0,'passwordExported':False,'cookiesExported':False}),flush=True)\n raise SystemExit(1)\nif os.environ.get('HERMES_HOME')!='/opt/data/profiles/dc-gang-a-dev': refuse('active_profile_required')\nenvelope=json.load(sys.stdin)\nsecret=get_env_value_prefer_dotenv('DC_ACADEMY_HTTP_PASSWORD')\nif not secret: refuse('native_http_secret_required')\nenv={k:os.environ[k] for k in ('HOME','PATH','HERMES_HOME','TMPDIR') if k in os.environ}\nenv['DC_ACADEMY_HTTP_PASSWORD']=secret\nenv['ACADEMY_POOL_READ_REQUEST']=json.dumps(envelope['request'])\nr=subprocess.run(['bun','--no-env-file','-'],input=envelope['source'],text=True,env=env,cwd='/opt/data/workspace/dc-gang-a',stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=105)\ntry: print(json.dumps(json.loads(r.stdout.strip().splitlines()[-1])))\nexcept Exception: print(json.dumps({'status':'blocked','code':'native_child_no_valid_result'}))\nsys.exit(r.returncode)\n`;
function shellQuote(value:string){return "'"+value.replaceAll("'","'\\''")+"'";}

export async function loadNativePoolBackend(args:readonly string[]){
  if(args.length!==4||args[0]!=='--native-bridge'||args[2]!=='--native-bridge-sha256')throw Error('native_bridge_arguments_invalid');
  const config=configSchema.parse(JSON.parse((await readPinnedLocalBytes(args[1],args[3])).bytes.toString('utf8')));
  const source=(await readPinnedLocalBytes(config.readerPath,config.readerSha256)).bytes.toString('utf8');
  const remote=['docker','exec','-i','--user','10000:10000','--env','HOME=/opt/data','--env','HERMES_HOME=/opt/data/profiles/dc-gang-a-dev',config.containerId,'/opt/hermes/.venv/bin/python','-B','-c',nativePoolDriver].map(shellQuote).join(' ');
  const run:PoolReadRunner=request=>new Promise((resolve,reject)=>{
    const child=spawn('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8',config.sshTarget,remote],{stdio:['pipe','pipe','pipe']});
    let output='',bytes=0,reason:string|undefined;const deadline=setTimeout(()=>{reason='native_pool_read_timeout';child.kill();},115000);
    child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){reason='native_pool_result_size_limit';child.kill();}else output+=chunk.toString('utf8');});
    child.stderr.on('data',()=>{});child.on('error',()=>{clearTimeout(deadline);reject(Error('native_pool_read_start_failed'));});
    child.on('close',code=>{clearTimeout(deadline);if(reason)return reject(Error(reason));
      try{const result=JSON.parse(output.trim());if(code!==0||result.status!=='observed'||result.academyWrites!==0||result.passwordExported!==false||result.cookiesExported!==false)
        throw Error(typeof result.code==='string'&&/^[a-z_]{1,100}$/.test(result.code)?result.code:'native_pool_read_unqualified');resolve(result);}
      catch(error){reject(error instanceof Error&&/^[a-z_]{1,100}$/.test(error.message)?error:Error('native_pool_result_invalid'));}});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source,request}));
  });
  return new NativePoolLabelBackend(serializePoolReadRunner(run));
}

/** Do not overlap fresh logins for one account or retry a failed credential generation. */
export function serializePoolReadRunner(run:PoolReadRunner):PoolReadRunner {
  let tail:Promise<unknown>=Promise.resolve(),authenticationRefused=false;
  return request=>{
    const result=tail.then(async()=>{
      if(authenticationRefused)throw Error('native_pool_authentication_requires_new_input');
      try{return await run(request);}catch(error){
        if(error instanceof Error&&/test_pool_authentication_required|source_login_challenge|native_http_secret_required|teacher_.*conflict|login_wire_contract_drift/.test(error.message))authenticationRefused=true;
        throw error;
      }
    });
    tail=result.catch(()=>{});return result;
  };
}
