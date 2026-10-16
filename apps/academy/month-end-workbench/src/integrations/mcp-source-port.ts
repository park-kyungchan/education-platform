/** Server-only official SDK transport. Never import into a browser entrypoint. */
import {compareScopeMetadata} from '../scope-compatibility.ts';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import type {AcademyTypeLabel,ComparisonAxis,Json,Projection,SourceContext,SourceFindRequest,SourceFindResult,SourcePort,SourceReviewRequest,SourceReviewResult,SourceScopeRequest,SourceScopeResult} from '../contracts.ts';

const tools={scope:'academy_item_label_scope',find:'academy_find_item_labels',review:'academy_review_type_questions'} as const;
const axes:ComparisonAxis[]=['structure','reasoning','representation','conditions','errors','transfer'];
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(v:unknown):Record<string,any>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('mcp_result_object_required');return v as Record<string,any>;};
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>4096||/[\u0000-\u001f\u007f]/.test(v))throw Error('mcp_result_text_invalid');return v;};
const nativeId=(v:unknown)=>{const s=String(v);if((typeof v!=='string'&&typeof v!=='number')||!/^\d{1,16}$/.test(s)||(typeof v==='number'&&!Number.isSafeInteger(v)))throw Error('mcp_native_identity_invalid');return s;};
const integer=(v:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw Error('mcp_integer_invalid');return Number(v);};
const clone=<T>(v:T):T=>structuredClone(v);
const frozen=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(frozen);Object.freeze(v);}return v;};
export interface PinnedFile {path:string;sha256:string}
export interface McpLaunchConfiguration {
  executable:PinnedFile;
  /** Bundle the full reviewed transitive MCP closure before pinning. */
  bundle:PinnedFile;
  source:{mode:'native-readonly';bridge:PinnedFile}|{mode:'synthetic';snapshot:PinnedFile};
}
/** Pin bytes using a bounded descriptor, no symlink, implicit discovery, dotenv or credential access. */
async function pinned(file:PinnedFile,max:number){
  if(!file||Object.keys(file).sort().join(',')!=='path,sha256'||!isAbsolute(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256)||await realpath(file.path)!==file.path)throw Error('mcp_launch_pin_invalid');
  const fd=await open(file.path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const before=await fd.stat({bigint:true});if(!before.isFile()||before.size>BigInt(max))throw Error('mcp_launch_file_invalid');
    const b=Buffer.alloc(Number(before.size)+1),read=await fd.read(b,0,b.length,0),after=await fd.stat({bigint:true});
    if(BigInt(read.bytesRead)!==before.size||before.size!==after.size||before.mtimeNs!==after.mtimeNs||before.ctimeNs!==after.ctimeNs)throw Error('mcp_launch_file_changed');
    if(createHash('sha256').update(b.subarray(0,read.bytesRead)).digest('hex')!==file.sha256)throw Error('mcp_launch_hash_mismatch');
  }finally{await fd.close();}
}
export async function createMcpSourcePort(configuration:McpLaunchConfiguration|undefined,projection:Projection):Promise<SourcePort>{
  if(!configuration)return {mode:'unavailable',async scope(){return {mode:'unavailable',availability:'unavailable',context:null,categories:[],labels:[],limitations:['Academy read adapter is not configured.']}},async find(){throw Error('academy_unavailable')},async review(){throw Error('academy_unavailable')}};
  if(Object.keys(configuration).sort().join(',')!=='bundle,executable,source'||!['native-readonly','synthetic'].includes(configuration.source.mode))throw Error('mcp_launch_configuration_invalid');
  if(projection.owner!=='math-research-module'||projection.revision!=='07edb2dea2e5997aea4318f0fa2efa21dde633df'||!projection.manifest.length)throw Error('research_projection_pin_required');
  await pinned(configuration.executable,160*1024*1024);await pinned(configuration.bundle,32*1024*1024);
  const source=configuration.source;if(Object.keys(source).sort().join(',')!==(source.mode==='native-readonly'?'bridge,mode':'mode,snapshot'))throw Error('mcp_launch_source_invalid');const selected=source.mode==='native-readonly'?source.bridge:source.snapshot;
  await pinned(selected,4*1024*1024);
  const args=['--no-env-file',configuration.bundle.path,...(source.mode==='native-readonly'?['--native-bridge',selected.path,'--native-bridge-sha256',selected.sha256]:['--label-snapshot',selected.path,'--label-sha256',selected.sha256])];
  const transport=new StdioClientTransport({command:configuration.executable.path,args,env:{PATH:'/usr/bin:/bin'},stderr:'pipe'});
  transport.stderr?.on('data',()=>{});
  const client=new Client({name:'month-end-readonly-source-port',version:'1.0.0'});
  let refused=false,closed=false,tail:Promise<unknown>=Promise.resolve();
  const contexts=new Map<string,SourceContext>(),observationContexts=new Map<string,SourceContext>(),labels=new Map<string,{label:AcademyTypeLabel;mcpId:string}>(),visited=new Set<string>(),labelCapabilities=new Map<string,boolean|null>(),cursors=new Map<string,{context:SourceContext;pat:string;page:number;offset:number;binding:string}>();
  const pins=clone(projection.manifest),revision=projection.revision;
  const binding=(context:SourceContext|null,study:SourceFindRequest['study']|null=null,intent:SourceFindRequest['intent']|null=null)=>({schemaVersion:'academy.assessment-binding/1',research:{owner:'math-research-module',revision,pins:pins.map(p=>({path:p.path,sha256:p.sha256}))},sourceContext:context?{owner:context.owner,sourceRevision:context.sourceRevision,scopeId:context.scopeId,edition:context.edition,unit:context.unit,...(context.observationHash?{observationHash:context.observationHash}:{}),...(context.sourceHandle?{sourceHandle:context.sourceHandle}:{}),...(context.observedAt?{observedAt:context.observedAt}:{})}:null,study:study?{scope:{researchTypeIds:study.scope.researchTypeIds,researchRevision:study.scope.researchRevision,edition:study.scope.edition,unit:study.scope.unit},studied:study.studied,summary:study.summary,evidenceNotes:study.evidenceNotes,attribution:study.attribution,acceptance:study.acceptance}:null,intent:intent?{axes:Object.fromEntries(axes.map(axis=>[axis,intent.axes[axis]])),notes:intent.notes}:null});
  const known=(c:SourceContext)=>{if(!c.sourceHandle||!same(contexts.get(c.sourceHandle),c))throw Error('exact_adapter_source_context_required');};
  const prepared=(r:SourceFindRequest|SourceReviewRequest)=>{known(r.context);if(r.study?.studied!==true||r.study.attribution!=='teacher-reported'||r.study.acceptance!==false||r.study.scope.researchRevision!==revision||!r.study.scope.researchTypeIds.length||r.study.scope.researchTypeIds.some(id=>!projection.types.some(t=>t.id===id))||axes.some(a=>typeof r.intent?.axes?.[a]!=='string'))throw Error('exact_research_study_intent_required');const compatibility=compareScopeMetadata(r.study.scope,r.context);if(compatibility.state==='conflict')throw Error('exact_research_study_intent_required');return compatibility;};
  const close=async()=>{if(closed)return;closed=true;await client.close().catch(()=>{});await transport.close().catch(()=>{});contexts.clear();observationContexts.clear();labels.clear();visited.clear();labelCapabilities.clear();cursors.clear();};
  const call=(operation:keyof typeof tools,input:Record<string,unknown>)=>{
    const promise=tail.then(async()=>{if(refused||closed)throw Error('mcp_source_requires_owner_resolution');
      try{const result=await client.callTool({name:tools[operation],arguments:input},{timeout:125000,maxTotalTimeout:125000});if(result.isError)throw Error('mcp_read_refused');
        const out=object(result.structuredContent);if(Buffer.byteLength(JSON.stringify(out))>2*1024*1024||!same(out.assessmentBinding,input.assessmentBinding)||out.assessmentBindingSha256!==hash(input.assessmentBinding)||out.finalItemMembershipCreated!==false)throw Error('mcp_context_or_effect_contract_drift');return frozen(clone(out));
      }catch{refused=true;await close();throw Error('mcp_source_requires_owner_resolution');}});
    tail=promise.catch(()=>{});return promise;
  };
  try{await client.connect(transport);const listed=await client.listTools();for(const name of Object.values(tools)){const tool=listed.tools.find(t=>t.name===name);if(!tool||tool.annotations?.readOnlyHint!==true||tool.annotations?.destructiveHint!==false)throw Error('mcp_read_tool_contract_required');}}
  catch{await close();throw Error('mcp_connection_unavailable');}
  const qualify=async<T>(run:()=>T):Promise<T>=>{try{return run();}catch{refused=true;await close();throw Error('mcp_source_requires_owner_resolution');}};
  const mode=source.mode;
  const limitations=['Bounded immutable process observations; currentness and whole inventory remain unknown.','Lexical retrieval is provisional evidence; mathematical suitability and final question selection remain with the teacher.'];
  const label=(row:Record<string,any>,context:SourceContext):AcademyTypeLabel=>{
    const pat=nativeId(row.nativeId),id=text(row.id),categoryId=text(row.hierarchyId??context.scopeId);if(categoryId!==context.scopeId)throw Error('mcp_label_scope_conflict');
    const count=typeof row.sourceQuestionCountRaw==='number'?row.sourceQuestionCountRaw:typeof row.sourceQuestionCountRaw==='string'?Number(row.sourceQuestionCountRaw):null;
    const result={pat_no:pat,name:text(row.labelExact),categoryId,sourceRevision:context.sourceRevision,questionCount:Number.isSafeInteger(count)&&count!>=0?count:null};
    const key=JSON.stringify([context.sourceHandle,pat]),prior=labels.get(key);if(labels.size>=20000&&!prior)throw Error('mcp_type_limit');if(prior&&prior.mcpId!==id)throw Error('mcp_type_identity_conflict');labels.set(key,{label:result,mcpId:id});return result;
  };
  return {mode,close,
    async scope(request:SourceScopeRequest):Promise<SourceScopeResult>{
      request=clone(request);
      if(request.context)known(request.context);const view=request.view??'hierarchy',parent=request.parentId??null,id=request.hierarchyId;
      if(parent&&!visited.has(parent)||id&&!visited.has(id))throw Error('exact_visited_hierarchy_required');
      const labelTarget=id??request.context?.scopeId;
      if(view==='labels'&&(!labelTarget||!visited.has(labelTarget)||labelCapabilities.get(labelTarget)===false||mode==='native-readonly'&&labelCapabilities.get(labelTarget)!==true))throw Error('exact_label_read_capable_scope_required');
      const offset=integer(request.offset??0,0,10000),limit=integer(request.limit??20,1,50);
      const input={assessmentBinding:binding(request.context),view,offset,limit,...(view==='labels'?{hierarchyId:id??request.context?.scopeId}:{parentId:parent})};
      const out=await call('scope',input);if(out.status!=='available')return {mode,availability:'unavailable',context:null,categories:[],labels:[],limitations:[...limitations,'Source reports unavailable.']};
      return qualify(()=>{const receipt=object(out.source),sourceRevision=text(receipt.selectorSha256??receipt.snapshotSha256??receipt.revision),scopeId=view==='labels'?text(id??request.context?.scopeId):parent??'academy:root';
      const observedAt=text(receipt.observedAt);if(!Number.isFinite(Date.parse(observedAt)))throw Error('mcp_observation_clock_invalid');
      const owner=mode==='native-readonly'?'academy':'synthetic-academy',observationHash=hash(receipt);
      // Pagination changes the returned rows, not the immutable source observation identity.
      const observationKey=JSON.stringify([mode,owner,sourceRevision,scopeId,null,null,observationHash,observedAt]);
      let context=observationContexts.get(observationKey);
      if(!context){
        if(contexts.size>=2048)throw Error('mcp_observation_limit');
        context=frozen({owner,sourceRevision,scopeId,edition:null,unit:null,observationHash,sourceHandle:'mcp-observation:'+randomUUID(),observedAt});
        contexts.set(context.sourceHandle!,context);observationContexts.set(observationKey,context);
      }
      const rows=out.nodes??[];if(!Array.isArray(rows)||rows.length>50||!Array.isArray(out.labels??[])||(out.labels??[]).length>50)throw Error('mcp_scope_page_invalid');
      const categories=rows.map((row:Record<string,any>)=>{
        const id=text(row.id);if(row.parentId!==parent)throw Error('mcp_hierarchy_parent_conflict');
        if(visited.size>=10000&&!visited.has(id))throw Error('mcp_hierarchy_limit');
        let capability:boolean|null=null;
        let sourceFields:{}|{nativeScope:{cl1:number;cl2:number;cl3:number;cl4:number};depth:number;isLazy:boolean;isFolder:boolean}={};
        if(mode==='native-readonly'){
          const scope=object(row.scope),nativeScope={cl1:integer(scope.cl1,0,Number.MAX_SAFE_INTEGER),cl2:integer(scope.cl2,0,Number.MAX_SAFE_INTEGER),cl3:integer(scope.cl3,0,Number.MAX_SAFE_INTEGER),cl4:integer(scope.cl4,0,Number.MAX_SAFE_INTEGER)};
          if(typeof row.isLazy!=='boolean'||typeof row.isFolder!=='boolean')throw Error('mcp_hierarchy_capability_unqualified');
          capability=nativeScope.cl3>0;
          sourceFields={nativeScope,depth:Math.max(0,...Object.values(nativeScope).map((value,index)=>value>0?index+1:0)),isLazy:row.isLazy,isFolder:row.isFolder};
        }
        visited.add(id);labelCapabilities.set(id,capability);
        return {id,parentId:parent,name:text(row.title??row.labelExact),level:'original-native-hierarchy',...sourceFields,canReadLabels:capability};
      });
      return {mode,availability:'available',context:clone(context),categories,labels:(out.labels??[]).map((r:Record<string,any>)=>label(r,context)),nextOffset:out.nextOffset===null?null:integer(out.nextOffset,1,10000),sourceEvidence:{observedAt,observationHash,page:{view,offset,limit},revisionMeaning:'selector_and_process_observation_not_global_currentness',coverage:receipt.coverage??'returned_page_only'},limitations};});
    },
    async find(request:SourceFindRequest):Promise<SourceFindResult>{
      request=clone(request);
      const compatibility=prepared(request);if(!visited.has(request.context.scopeId)||labelCapabilities.get(request.context.scopeId)===false||mode==='native-readonly'&&labelCapabilities.get(request.context.scopeId)!==true)throw Error('exact_label_read_capable_scope_required');if(request.categoryId!==null&&request.categoryId!==request.context.scopeId)throw Error('exact_source_scope_required');
      const b=binding(request.context,request.study,request.intent),out=await call('find',{assessmentBinding:b,intent:request.query,hierarchyIds:[request.context.scopeId],includeDescendants:true,learningState:'teacher_reported_complete',limit:integer(request.limit,1,50)});
      return qualify(()=>{const receipt=object(out.liveReadEvidence??out.source);if((receipt.selectorSha256??receipt.snapshotSha256??receipt.revision)!==request.context.sourceRevision)throw Error('mcp_find_revision_conflict');
      if(out.status!=='available'||!Array.isArray(out.matches)||out.matches.length>request.limit)throw Error('mcp_find_unqualified');
      return {mode,context:clone(request.context),candidates:out.matches.map((row:Record<string,any>)=>({label:label(row,request.context),retrieval:'lexical-only' as const,lexicalTerms:Array.isArray(row.overlapTerms)?row.overlapTerms.map(text):[],axes:axes.map(axis=>({axis,state:'unknown' as const,note:'Label lexical overlap does not establish this mathematical axis.',sourceRefs:[]})),status:'provisional' as const,reasons:['Original native label; semantic comparison requires inspected question evidence.']})),limitations:[...limitations,...compatibility.warnings]};});
    },
    async review(request:SourceReviewRequest):Promise<SourceReviewResult>{
      request=clone(request);
      const compatibility=prepared(request);const pat=nativeId(request.pat_no),held=labels.get(JSON.stringify([request.context.sourceHandle,pat]));if(!held)throw Error('exact_returned_type_required');
      const b=binding(request.context,request.study,request.intent),stamp=hash(b),cursor=request.cursor?cursors.get(request.cursor):null;
      if(request.cursor&&(!cursor||!same(cursor.context,request.context)||cursor.pat!==pat||cursor.binding!==stamp))throw Error('exact_bound_question_cursor_required');
      const out=await call('review',{assessmentBinding:b,hierarchyId:request.context.scopeId,labelId:held.mcpId,purpose:'teacher_requested_review',page:cursor?.page??1,offset:cursor?.offset??0,limit:integer(request.limit,1,20)});
      return qualify(()=>{if(out.status!=='available'||nativeId(out.patNo)!==pat||out.hierarchyId!==request.context.scopeId||out.labelId!==held.mcpId||out.selectorSha256!==request.context.sourceRevision||!Array.isArray(out.questions)||out.questions.length>request.limit)throw Error('mcp_question_scope_conflict');
      const seen=new Set<string>();const questions=out.questions.map((row:Record<string,any>)=>{const key=nativeId(row.lectureKey);if(seen.has(key)||nativeId(row.patNo)!==pat||row.sourceNamespace!=='academy_item')throw Error('mcp_question_identity_conflict');seen.add(key);
        const metadata=object(row.sourceFields);if(Object.keys(metadata).length>256||Object.entries(metadata).some(([key,value])=>key.length>256||!(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=100000)))throw Error('mcp_question_metadata_invalid');const answerKey=['answer','ANSWER','ans','correct_answer'].find(k=>typeof metadata[k]==='string');
        const previews=Array.isArray(row.previewReferences)?row.previewReferences:[],ref=previews.find((p:Record<string,any>)=>p.contentFetched===false&&/^https:\/\/storage\.studyq\.net\/data\/contents\/exam\/d6-\d{3}\/d4-\d{2}\/d2-\d{2}\/ek-[1-9]\d{0,8}\/[1-9]\d{0,8}-examcard-(obj|sbj|des)\.png$/.test(p.url));
        return {lecture_key:key,pat_no:pat,sourceRevision:text(out.sourceSha256),metadata:clone(metadata) as Record<string,Json>,answer:answerKey?metadata[answerKey]:null,preview:{state:ref&&out.previewReferencesState==='qualified_original_source'?'available' as const:'unavailable' as const,url:ref&&out.previewReferencesState==='qualified_original_source'?ref.url:null}};});
      let nextCursor:string|null=null;if(out.nextOffset!==null||out.nextPage!==null){if(cursors.size>=2048)throw Error('mcp_cursor_limit');nextCursor='mcp-question-page:'+randomUUID();cursors.set(nextCursor,{context:clone(request.context),pat,page:out.nextOffset!==null?integer(out.page,1,100000):integer(out.nextPage,1,100000),offset:out.nextOffset!==null?integer(out.nextOffset,1,49):0,binding:stamp});}
      return {mode,context:clone(request.context),pat_no:pat,questions,nextCursor,limitations:[...limitations,...compatibility.warnings,'Question image content was not fetched. Answers and metadata remain untrusted source observations.']};});
    }
  };
}
