import {teacherFixture,sourceRoot} from './teacher-fixture.ts';

/** Invented source-owned read-store seam; the real TeacherApplication/projection/reader still run. */
export async function reviewedTeacherFixture(printed:'done'|'not_done'|'unknown',distributed:'done'|'not_done'|'unknown',mismatchedIssuance=false){
  const f=await teacherFixture(0);
  const {known,unknown,digest}=await import(sourceRoot+'/apps/academy/dc-gang-a/src/learning/model.ts');
  const {validateTeacherWorkspace,workspaceEntityId}=await import(sourceRoot+'/apps/academy/dc-gang-a/src/academy/teacherWorkspace.ts');
  const work:any=f.source.rows.find((record:any)=>record.entityId==='work-A')!;
  const attempt:any=f.source.rows.find((record:any)=>record.entityId==='attempt-A')!;
  const issuance=structuredClone(work.payload.paper);
  if(mismatchedIssuance)issuance.value.issuanceKey.literalKey+='-different';
  const reportedAt='2090-01-01T14:59:59.000Z',recordedAt='2090-01-02T00:00:00.000Z',observedAt='2090-01-01T14:00:00.000Z';
  const observation=(state:string)=>state==='unknown'?unknown('Invented no observation'):known({issuanceKey:issuance.value.issuanceKey,state,observedAt},['invented-'+state+'-stage']);
  const payload={kind:'teacher_activity_review',studentBinding:{studentId:f.source.student.id,sourceStudent:work.payload.sourceStudent},sourceStudent:work.payload.sourceStudent,
    reportedAt,evidenceRevisionIds:[work.revisionId,attempt.revisionId],assignmentRevisionId:work.revisionId,selectedItemIds:work.payload.items.map((item:any)=>item.assignedItemId),coverage:'whole_assigned_items',
    originalScore:100,originalWrong:'not_applicable',similarPrinted:'unknown',similar:'unknown',appEntry:'not_entered',
    paper:{issuance,corrections:[],stages:{printed:observation(printed),distributed:observation(distributed)}},
    video:{upload:'unknown',reference:'',review:'not_reviewed',note:''},mindmap:{state:'not_requested',note:'',explanation:null},
    final:{decision:'accepted',checkedSolutionAndUnderstanding:true,note:'Invented scoped teacher judgment'},
    attemptBinding:known({attemptEntityId:attempt.entityId,attemptRevisionId:attempt.revisionId},[attempt.revisionId])};
  validateTeacherWorkspace(payload);
  const review={ownerId:f.source.owner,studentId:f.source.student.id,entityId:workspaceEntityId(payload),sequence:1,revisionId:'invented-review-r1',previousRevisionId:null,previousDigest:null,payload,
    contentDigest:digest(payload),integrityDigest:'invented',recordedAt,actorId:f.source.actor.actorId,idempotencyKey:'invented-review',commandDigest:'invented'};
  const readSnapshot=f.source.store.readSnapshot.bind(f.source.store);
  f.source.store.readSnapshot=async(callback:any)=>readSnapshot((read:any)=>callback({...read,studentWorkspaces:async()=>[structuredClone(review)]}));
  return {...f,review,reportedAt,recordedAt,observedAt};
}

export async function branchedTeacherFixture(){
  const f=await teacherFixture(0);
  const {known}=await import(sourceRoot+'/apps/academy/dc-gang-a/src/learning/model.ts');
  const {validateLearningAssignment}=await import(sourceRoot+'/apps/academy/dc-gang-a/src/academy/learningWork.ts');
  const extra=[
    {revisionId:'invented-section-2-r1',node:{id:'section-2',kind:'learning_section',sourceKey:{namespace:'synthetic_catalog',literalKey:'section-2'},label:'Sibling section',parent:known('minor',['invented-parent'])}},
    {revisionId:'invented-page-2-r1',node:{id:'page-2',kind:'printed_page',sourceKey:{namespace:'synthetic_catalog',literalKey:'page-2'},label:'Separate branch page',parent:known('section-2',['invented-parent'])}},
    {revisionId:'invented-section-3-r1',node:{id:'section-3',kind:'learning_section',sourceKey:{namespace:'synthetic_catalog',literalKey:'section-3'},label:'Sibling section with no parent body',parent:known('not-returned-parent',['invented-parent'])}},
  ];
  for(const record of f.source.rows as any[]){
    if(record.payload.kind!=='learning_work_assignment')continue;
    record.payload=structuredClone(record.payload);
    record.payload.catalogRefs.push(...extra.map(row=>({nodeId:row.node.id,revisionId:row.revisionId})));
    record.payload.sectionNodeIds.push('section-2','section-3');record.payload.items[1].sectionNodeId='section-2';
    validateLearningAssignment(record.payload);
  }
  const readSnapshot=f.source.store.readSnapshot.bind(f.source.store);
  f.source.store.readSnapshot=async(callback:any)=>readSnapshot((read:any)=>callback({...read,pinnedCatalog:async(...args:any[])=>{
    const pinned=await read.pinnedCatalog(...args);
    for(const entry of pinned)if(entry.node.id==='problem-2')entry.node.parent=known('page-2',['invented-parent']);
    return [...pinned,...structuredClone(extra)];
  }}));
  return f;
}
