import type { Application, ApplicationState, AssessmentContext, Projection, SourcePort, SourceContext, StudyScope, SourceFindRequest, SourceReviewRequest, Json, AcademyQuestion, AlignmentProposalRequest, AlignmentProposal, AlignmentQuestionEvidence } from './contracts.ts';
import { compareScopeMetadata } from './scope-compatibility.ts';
import { AXES, assertIntent, assertProjection, assertSourceContext, assertStudy, assertStudyScope, equal, requireValue, exactKeys } from './validation.ts';
export const unavailableSourcePort: SourcePort={mode:'unavailable',async scope(){return {mode:'unavailable',availability:'unavailable',context:null,categories:[],labels:[],limitations:['Academy source is unavailable. Research content is original; Academy questions are not fabricated.']};},async find(){throw new Error('Academy source unavailable');},async review(){throw new Error('Academy source unavailable');}};
export function emptyIntent(){return {axes:{structure:'',reasoning:'',representation:'',conditions:'',errors:'',transfer:''},notes:''};}
const admittedProjections=new WeakMap<Projection,Projection>();
function admit(projection:Projection):Projection {let p=admittedProjections.get(projection);if(!p){assertProjection(projection);p=structuredClone(projection);const freeze=(x:any)=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}};freeze(p);admittedProjections.set(projection,p);}return p;}
export function createApplication(projection:Projection,port:SourcePort=unavailableSourcePort):Application {
 const p=admit(projection);
 const observedTypes=new Map<string,string>();
 const inspectedQuestions=new Map<string,{context:SourceContext;pat_no:string;question:AcademyQuestion}>();
 let alignmentCounter=0;
 let dependencyEpoch=0,scopeSequence=0;
 let state:ApplicationState={scope:{researchTypeIds:[],researchRevision:p.revision,edition:null,unit:null},study:null,intent:emptyIntent(),sourceContext:null,alignmentProposals:[],history:[]};
 const history=(kind:string,message:string,evidence?:Json)=>{state.history.push({kind,message,...(evidence?{evidence:structuredClone(evidence)}:{})});if(state.history.length>80)state.history.shift();};
 const snapshot=()=>structuredClone(state);
 const invalidate=(reason:string)=>{history('dependency-invalidated',reason,{previousStudy:state.study as unknown as Json});state.study=null;};
 const changeDependency=(reason:string)=>{dependencyEpoch++;inspectedQuestions.clear();for(const proposal of state.alignmentProposals)if(proposal.current){proposal.current=false;proposal.historicalReason=reason;}};
 const sourceLimitations=(existing:unknown,context:SourceContext|null)=>{requireValue(Array.isArray(existing)&&existing.length<=100&&existing.every(note=>typeof note==='string'&&note.length<=4000),'Invalid source limitations');return [...new Set([...existing,...(context?compareScopeMetadata(state.scope,context).warnings:[])])];};
 const questionKey=(pat:string,key:string,revision:string)=>JSON.stringify([pat,key,revision]);
 const binding=(r:{context:SourceContext;study:SourceFindRequest['study'];intent:SourceFindRequest['intent']})=>{
  assertSourceContext(r.context);assertStudy(r.study,p);assertIntent(r.intent);
  requireValue(state.sourceContext&&equal(r.context,state.sourceContext),'Source context changed or was not observed');
  requireValue(state.study&&equal(r.study,state.study)&&equal(r.study.scope,state.scope),'Explicit study report for this exact scope required');
  requireValue(equal(r.intent,state.intent),'Desired intent changed; repeat current request');
  requireValue(compareScopeMetadata(state.scope,r.context).state!=='conflict','Known teacher and Academy edition/unit metadata conflict; comparison held');

 };
 const records=(p.assessmentResearch.records as unknown as any[]);
 return {
  snapshot,
  async context(){
   const exam=records.find(r=>r.key==='math-exam-context').assessmentFacts, timing=records.find(r=>r.key==='math-exam-timing').timingFacts;
   const deadline=records.find(r=>r.key==='math-exam-deadline').summary.match(/\d{4}-\d{2}-\d{2}/)?.[0];requireValue(deadline==='2026-10-19','Source deadline requires explicit review');
   const architecture=p.assessmentResearch.ontologyArchitecture as any;
   return {title:'월말평가 연구·문항 검토',sourceRevision:p.revision,sourceMode:port.mode,constraints:{items:exam.questionCount,points:exam.totalPoints,durationMinutes:timing.durationMinutes,startTime:timing.startLocal,bands:exam.scoreBands,deadline,examDate:timing.date,timezone:timing.timeZone,edition:null,unitInventory:null},coverage:p.coverage,warnings:p.warnings,limitations:['Research designs and capability mappings are hypotheses, not learner diagnoses or validated effects.','Exact exam date/timezone, textbook edition, final unit inventory and final question membership remain unknown.','Preparation deadline is not exam date. General100-minute interview is a separate scope.','Hash integrity, currentness, source availability, mathematical verification and teacher acceptance are distinct.'],stages:['연구 내용 탐색','유형·예시·행동 연구','공부한 범위와 원하는 문항 특성 보고','기존 Academy 유형 발견','원본 문항 페이지 검토','제약과 미확인 사항 분석'],governance:['DATA','LOGIC','ACTION','GOVERNANCE'].map(layer=>({layer,children:Object.values(architecture[layer]??{}).flat().filter((v):v is string=>typeof v==='string'),crossesLayers:layer==='GOVERNANCE'}))} as AssessmentContext;
  },
  async research({typeId}){
   const type=p.types.find(t=>t.id===typeId);requireValue(type,'Unknown research type');
   const mappings=p.capabilityResearch.mapping; const capabilityMappings=Array.isArray(mappings)?mappings.filter((m:any)=>m.typeId===typeId||m.subtypeId===typeId):[];
   return structuredClone({type,design:p.designs.find(d=>d.typeId===typeId)??null,links:p.links.filter(l=>l.from===typeId||l.to===typeId),warnings:p.warnings.filter(w=>w.typeId===typeId),capabilityMappings});
  },
  async navigate(pathIds){
   requireValue(Array.isArray(pathIds)&&pathIds.length<=4&&pathIds.every(id=>typeof id==='string'),'Invalid hierarchy path');
   let parentId:string|null=null;const levels=[];
   for(let i=0;i<=pathIds.length;i++){
    const siblings=p.units.filter(u=>u.parentId===parentId); if(!siblings.length) break;
    const selectedId=pathIds[i]??null; requireValue(selectedId===null||siblings.some(s=>s.id===selectedId),'Path is not containment');
    levels.push({level:siblings[0]!.level,parentId,siblings,selectedId});if(!selectedId)break;parentId=selectedId;
   }
   requireValue(levels.filter(l=>l.selectedId).length===pathIds.length,'Unresolved hierarchy path');
   return structuredClone({pathIds,levels,types:p.types.filter(t=>t.detailId===pathIds.at(-1))});
  },
  async setScope(scope){assertStudyScope(scope,p);if(!equal(scope,state.scope)){changeDependency('Research study scope changed');state.scope=structuredClone(scope);invalidate('Research type, edition/unit or source version changed.');}return snapshot();},
  async study(report){assertStudy(report,p);requireValue(equal(report.scope,state.scope),'Study report does not cover current scope');changeDependency('Teacher study report changed');state.study=structuredClone(report);history('teacher-study','Teacher explicitly reported study of this scope; no learning acceptance inferred.',{report:report as unknown as Json});return snapshot();},
  async intent(intent){assertIntent(intent);if(!equal(intent,state.intent)){changeDependency('Desired question intent changed');state.intent=structuredClone(intent);history('intent-revised','Comparison dependencies changed; previous source reviews are historical only.');}return snapshot();},
  async sourceScope(request){
   request=structuredClone(request);const startedEpoch=dependencyEpoch,sequence=++scopeSequence;
   exactKeys(request,['context','view','hierarchyId','parentId','offset','limit']);
   requireValue(request&&typeof request==='object','Scope request required');
   requireValue(request.view===undefined||['hierarchy','labels'].includes(request.view),'Unknown source view');
   for(const id of [request.hierarchyId,request.parentId])requireValue(id===undefined||id===null||typeof id==='string'&&id.length>0&&id.length<=256,'Invalid hierarchy identity');
   if(request.context){assertSourceContext(request.context);requireValue(state.sourceContext&&equal(request.context,state.sourceContext),'Foreign or stale source traversal');requireValue(compareScopeMetadata(state.scope,request.context).state!=='conflict','Known teacher and Academy edition/unit metadata conflict; comparison held');}
   if(request.offset!==undefined)requireValue(Number.isInteger(request.offset)&&request.offset>=0&&request.offset<=10000,'Invalid source offset');
   if(request.limit!==undefined)requireValue(Number.isInteger(request.limit)&&request.limit>=1&&request.limit<=100,'Invalid scope limit');
   const result=structuredClone(await port.scope(structuredClone(request)));requireValue(startedEpoch===dependencyEpoch&&sequence===scopeSequence,'Source traversal dependencies changed; repeat current request');requireValue(result.mode===port.mode,'Source mode mismatch');
   if(result.context){assertSourceContext(result.context);requireValue(compareScopeMetadata(state.scope,result.context).state!=='conflict','Known teacher and Academy edition/unit metadata conflict; comparison held');}
   requireValue(Array.isArray(result.labels)&&Array.isArray(result.categories)&&result.labels.length<=(request.limit??100)&&result.categories.length<=(request.limit??100),'Unbounded source scope page');
   requireValue(result.context!==null||result.labels.length===0,'Source labels require qualified context');
   requireValue(result.labels.every(l=>l.sourceRevision===result.context?.sourceRevision&&typeof l.pat_no==='string'&&l.pat_no.length>0&&l.pat_no.length<=128),'Label observation revision mismatch');
   const stagedTypes=result.labels.filter(label=>label.categoryId===result.context?.scopeId).map(label=>[label.pat_no,JSON.stringify(result.context)] as const);
   result.limitations=sourceLimitations(result.limitations,result.context);
   // Publish only after the complete page has passed admission. Failed responses establish no source authority.
   if(!equal(state.sourceContext,result.context)){changeDependency('Academy source observation changed');history('source-observation','Source scope/revision observed; dependent reviews must be repeated.',{previousContext:state.sourceContext as unknown as Json,context:result.context as unknown as Json});state.sourceContext=structuredClone(result.context);observedTypes.clear();}
   for(const [pat,context] of stagedTypes)observedTypes.set(pat,context);
   return structuredClone(result);
  },
  async find(request){
   request=structuredClone(request);exactKeys(request,['context','study','intent','query','categoryId','limit']);binding(request);const startedEpoch=dependencyEpoch;requireValue(Number.isInteger(request.limit)&&request.limit>=1&&request.limit<=20,'Read page limit1–20');requireValue(typeof request.query==='string'&&request.query.length<=500,'Invalid discovery query');
   const result=structuredClone(await port.find(structuredClone(request)));requireValue(startedEpoch===dependencyEpoch,'Discovery dependencies changed; repeat current request');binding(request);requireValue(result.mode===port.mode&&equal(result.context,state.sourceContext),'Foreign source discovery result');requireValue(result.candidates.length<=request.limit,'Unbounded source discovery');
   for(const c of result.candidates){requireValue(c.label.sourceRevision===result.context.sourceRevision&&typeof c.label.pat_no==='string'&&c.label.categoryId===result.context.scopeId,'Invalid native type namespace/revision');requireValue(c.status==='provisional'||c.status==='held','Source candidate promoted to acceptance');requireValue(c.axes.length===6&&new Set(c.axes.map(a=>a.axis)).size===6&&c.axes.every(a=>AXES.includes(a.axis)),'Missing comparison axes');for(const axis of c.axes){requireValue(['unknown','evidenced','conflicting'].includes(axis.state),'Invalid axis evidence state');if(axis.state!=='unknown')requireValue(axis.sourceRefs.length>0&&axis.sourceRefs.every(ref=>ref.owner===result.context.owner&&!!ref.revision&&/^[a-f0-9]{64}$/.test(ref.sha256)),'Semantic axis requires inspected source evidence');}if(c.retrieval==='lexical-only')requireValue(c.axes.every(a=>a.state==='unknown'),'Lexical evidence cannot establish semantic axes');}
   result.limitations=sourceLimitations(result.limitations,result.context);
   for(const c of result.candidates)observedTypes.set(c.label.pat_no,JSON.stringify(result.context));
   history('source-discovery','Provisional existing type candidates observed. No final question membership.');return structuredClone(result);
  },
  async review(request){
   request=structuredClone(request);exactKeys(request,['context','study','intent','pat_no','cursor','limit']);binding(request);const startedEpoch=dependencyEpoch;requireValue(Number.isInteger(request.limit)&&request.limit>=1&&request.limit<=20,'Read page limit1–20');requireValue(observedTypes.get(request.pat_no)===JSON.stringify(state.sourceContext),'Review requires a type returned by this source scope');requireValue(typeof request.pat_no==='string'&&request.pat_no.length>0&&request.pat_no.length<=128&&!request.pat_no.startsWith('lecture:'),'Expected native pat_no');requireValue(request.cursor===null||typeof request.cursor==='string'&&request.cursor.length<=300,'Invalid source cursor');
   const result=structuredClone(await port.review(structuredClone(request)));requireValue(startedEpoch===dependencyEpoch,'Review dependencies changed; repeat current request');binding(request);requireValue(result.mode===port.mode&&equal(result.context,state.sourceContext)&&result.pat_no===request.pat_no,'Wrong-source question review');requireValue(result.questions.length<=request.limit,'Unbounded source question page');
   const ids=new Set();for(const q of result.questions){requireValue(q.pat_no===request.pat_no&&typeof q.lecture_key==='string'&&q.lecture_key.length>0&&!ids.has(q.lecture_key),'Wrong native question membership/identity');ids.add(q.lecture_key);requireValue(typeof q.sourceRevision==='string'&&q.sourceRevision.length>0,'Question observation missing');if(q.preview.url){const url=new URL(q.preview.url);requireValue(url.protocol==='https:'&&url.hostname==='storage.studyq.net'&&url.port===''&&url.username===''&&url.password===''&&url.search===''&&url.hash===''&&/^\/data\/contents\/exam\/d6-\d{3}\/d4-\d{2}\/d2-\d{2}\/ek-[1-9]\d{0,8}\/[1-9]\d{0,8}-examcard-(obj|sbj|des)\.png$/.test(url.pathname),'Unsafe qualified preview reference');}}
   result.limitations=sourceLimitations(result.limitations,result.context);
   const stagedInspected=new Map(inspectedQuestions);for(const question of result.questions)stagedInspected.set(questionKey(result.pat_no,question.lecture_key,question.sourceRevision),{context:structuredClone(result.context),pat_no:result.pat_no,question:structuredClone(question)});
   requireValue(stagedInspected.size<=100&&new TextEncoder().encode(JSON.stringify([...stagedInspected.values()])).byteLength<=2*1024*1024,'Ephemeral inspected question evidence limit reached');
   inspectedQuestions.clear();for(const [key,value] of stagedInspected)inspectedQuestions.set(key,value);
   history('source-review','Bounded original questions inspected as analysis; no selection saved.',{context:result.context as unknown as Json,pat_no:result.pat_no,questionRefs:result.questions.map(q=>({lecture_key:q.lecture_key,sourceRevision:q.sourceRevision})),studyScope:request.study.scope as unknown as Json,intent:request.intent as unknown as Json});return structuredClone(result);
  },
  async alignmentProposal(input){
   const request=structuredClone(input);exactKeys(request,['context','study','intent','pat_no','axes']);binding(request);const startedEpoch=dependencyEpoch;
   requireValue(state.alignmentProposals.length<40,'Ephemeral alignment review limit reached');
   requireValue(observedTypes.get(request.pat_no)===JSON.stringify(state.sourceContext),'Alignment requires a type returned by this source scope');
   const inspected=[...inspectedQuestions.values()].filter(q=>q.pat_no===request.pat_no&&equal(q.context,request.context));
   requireValue(inspected.length>0,'Alignment requires inspected question evidence for this exact source/type/study/intent');
   exactKeys(request.axes,AXES);requireValue(Object.keys(request.axes).length===AXES.length,'Six alignment axes required');
   for(const name of AXES){const axis=request.axes[name];exactKeys(axis,['state','note','questionRefs']);requireValue(['unknown','supports','conflicts'].includes(axis.state)&&typeof axis.note==='string'&&axis.note.length<=2000&&Array.isArray(axis.questionRefs)&&axis.questionRefs.length<=20,'Invalid alignment axis');
    const seen=new Set<string>();for(const ref of axis.questionRefs){exactKeys(ref,['lecture_key','sourceRevision']);requireValue(typeof ref.lecture_key==='string'&&typeof ref.sourceRevision==='string','Exact inspected question revision required');const key=questionKey(request.pat_no,ref.lecture_key,ref.sourceRevision),q=inspectedQuestions.get(key);requireValue(q&&equal(q.context,request.context)&&!seen.has(key),'Uninspected, foreign, duplicate or stale question evidence');seen.add(key);}
    if(axis.state!=='unknown')requireValue(axis.note.trim().length>0&&axis.questionRefs.length>0,'Supported/conflicting axes require a teacher note and inspected question');
   }
   // Derive evidence from admitted question projections; the caller cannot supply source hashes or authority.
   const evidence=new Map<string,AlignmentQuestionEvidence>();
   for(const entry of inspected){const q=entry.question,bytes=new TextEncoder().encode(JSON.stringify(q)),digest=await crypto.subtle.digest('SHA-256',bytes);const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');evidence.set(questionKey(request.pat_no,q.lecture_key,q.sourceRevision),{question:{lecture_key:q.lecture_key,sourceRevision:q.sourceRevision},source:{owner:request.context.owner,revision:q.sourceRevision,path:`academy_item:lecture_key:${q.lecture_key}`,sha256,pointer:'/'},digestMeaning:'validated-question-projection-sha256',contentScope:'returned-source-fields-only'});}
   requireValue(startedEpoch===dependencyEpoch,'Alignment dependencies changed; repeat current review');binding(request);requireValue(state.alignmentProposals.length<40,'Ephemeral alignment review limit reached');
   const axes=Object.fromEntries(AXES.map(axis=>[axis,{state:request.axes[axis].state,note:request.axes[axis].note,evidence:request.axes[axis].questionRefs.map(ref=>evidence.get(questionKey(request.pat_no,ref.lecture_key,ref.sourceRevision))!)}])) as AlignmentProposal['axes'];
   const proposal:AlignmentProposal={id:`session-alignment-${++alignmentCounter}`,status:'proposal_not_accepted',attribution:'teacher-proposed',acceptance:false,finalMembership:false,current:true,historicalReason:null,context:structuredClone(request.context),studyScope:structuredClone(request.study.scope),intent:structuredClone(request.intent),pat_no:request.pat_no,researchRefs:request.study.scope.researchTypeIds.map(id=>structuredClone(p.types.find(type=>type.id===id)!.source)),inspectedQuestions:[...evidence.values()],axes,limitations:['Teacher-proposed qualitative comparison, not validated mathematical equivalence or semantic confidence.','Question evidence covers only returned source fields; an available preview reference does not establish acquired question content.','No final item membership, acceptance, persistence or native action is created.',...compareScopeMetadata(state.scope,request.context).warnings]};
   state.alignmentProposals.push(proposal);history('alignment-proposal','Teacher proposed a source/research comparison; no acceptance or final membership.',{id:proposal.id,pat_no:proposal.pat_no,sourceContext:proposal.context as unknown as Json});return structuredClone(proposal);
  }
 };
}
