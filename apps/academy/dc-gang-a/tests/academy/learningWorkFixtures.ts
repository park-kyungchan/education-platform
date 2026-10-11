import {known,unknown} from '../../src/learning/model';
import {SQL} from 'bun';
import {PostgresAcademyStore} from '../../src/academy/postgresStore';
import type {CatalogNode} from '../../src/academy/domain';
import type {AcademyRecord} from '../../src/academy/records';
import {TeacherApplication} from '../../src/academy/application';
/** Invented exact-work inputs only; never evidence of a current academy binding. */
export const exactWorkFixture=()=>({
  kind:'learning_work_assignment' as const,
  sourceStudent:{namespace:'academy_student',literalKey:'91001'},
  sourceCourse:{namespace:'academy_course',literalKey:'92001'},
  sourceUserCourse:{namespace:'academy_user_course',literalKey:'93001'},registrationRevisionId:'fixture-registration-revision',
  sourceBook:{namespace:'academy_book',literalKey:'94001'},
  assignmentKey:{namespace:'fixture_assignment',literalKey:'assignment-1'},
  activity:'wrong_clinic' as const,origin:'teacher_report' as const,
  effectiveDate:'2025-01-02',dueDate:unknown<string>('No due-date evidence'),status:'assigned' as const,
  catalogRefs:['book','major','middle','minor','section','page','problem-1','problem-2'].map(nodeId=>({nodeId,revisionId:'fixture-catalog-'+nodeId})),
  sectionNodeIds:['section'],
  items:[1,2].map(n=>({assignedItemId:'assigned-'+n,itemKey:{namespace:'fixture_item',literalKey:'item-'+n},contentNodeId:'problem-'+n,sectionNodeId:'section',labelLiteral:'Invented item '+n})),
  paper:known({paperKey:{namespace:'fixture_paper',literalKey:'paper-1'},versionLiteral:'v1',issuanceKey:{namespace:'fixture_issuance',literalKey:'issuance-1'},reissueOf:null as {namespace:string;literalKey:string}|null,orderedItems:[1,2].map(n=>({assignedItemId:'assigned-'+n,printedOrdinal:String(n)}))},['fixture-print-mapping']),
  evidenceRefs:['fixture-teacher-directive'],
});
export const exactAttemptFixture=()=>({kind:'learning_work_attempt' as const,sourceStudent:exactWorkFixture().sourceStudent,attemptKey:{namespace:'fixture_attempt',literalKey:'attempt-1'},assignmentRevisionId:'fixture-assignment-revision',paperIssuanceKey:{namespace:'fixture_issuance',literalKey:'issuance-1'},previousAttemptRevisionId:null as string|null,occurredAt:unknown<string>('Exact occurrence clock not reported'),state:'graded' as const,itemResults:exactWorkFixture().items.map(item=>({assignedItemId:item.assignedItemId,grade:known('correct' as const,['fixture-grade'])})),evidenceRefs:['fixture-attempt']});
export async function learningFixture(){
  const socket=process.env.DC_ACADEMY_TEST_SOCKET;if(!socket)throw Error('synthetic_test_socket_required');
  const db=new SQL({adapter:'postgres',path:socket,username:'hermes',database:'dc_academy_test',max:4});
  const store=new PostgresAcademyStore(db);await store.migrate();
  const owner='fixture-exact-'+crypto.randomUUID(),studentId='fixture-exact-student',actor={ownerId:owner,actorId:'fixture-teacher',role:'teacher' as const};
  await store.registerStudent({ownerId:owner,id:studentId,displayName:'Invented Exact Learner',sourceKey:exactWorkFixture().sourceStudent,proofRefs:['fixture']});
  const seed=await seedLearningWorkFixture(store,owner,studentId,actor.actorId);
  return {db,store,owner,studentId,actor,...seed,app:new TeacherApplication(store,owner)};
}
export async function seedLearningWorkFixture(store:PostgresAcademyStore,owner:string,studentId:string,actorId:string,effectiveDate='2025-01-02'){
  const assignment=exactWorkFixture();assignment.effectiveDate=effectiveDate;
  const catalog:CatalogNode[]=[
    {id:'book',kind:'book_edition',sourceKey:assignment.sourceBook,label:'Invented book',parent:unknown('root')},
    ...(['major','middle','minor','section','page','problem-1','problem-2'] as const).map((id,index)=>({id,kind:({major:'major_unit',middle:'middle_unit',minor:'minor_unit',section:'learning_section',page:'printed_page','problem-1':'problem','problem-2':'problem'} as const)[id],sourceKey:{namespace:'fixture_'+id,literalKey:'node-'+index},label:'Invented '+id,parent:known(index>=5?'page':['book','major','middle','minor','section'][index]!,['fixture'])})),
  ];
  for(let i=0;i<catalog.length;i++){const node=catalog[i]!;if(node.kind==='problem')catalog[i]={...node,sourceKey:assignment.items.find(item=>item.contentNodeId===node.id)!.itemKey};}
  assignment.catalogRefs=[];
  for(const node of catalog){const saved=await store.saveCatalog(owner,node);assignment.catalogRefs.push({nodeId:node.id,revisionId:saved.revisionId});}
  const append=(entityId:string,payload:AcademyRecord,expectedRevisionId:string|null=null,idempotencyKey=crypto.randomUUID())=>store.append({ownerId:owner,studentId,actorId,entityId,payload,expectedRevisionId,idempotencyKey,sourceObservedAt:'2025-01-02T01:00:00Z'});
  const registration=await append('fixture-registration',{kind:'source_book_registration',sourceStudent:assignment.sourceStudent,sourceCourse:assignment.sourceCourse,sourceUserCourse:assignment.sourceUserCourse,sourceBook:assignment.sourceBook,catalogNodeId:'book',sourceCourseLabel:'Invented course',sourceBookLabel:'Invented book',sourceStatus:'Invented active',sourceProgressLiteral:'Invented progress',sourceLearningRangeLiteral:'Invented range',assignmentValidity:unknown('not_qualified'),role:unknown('not_qualified'),contractRef:'fixture',evidenceRefs:['fixture']});
  assignment.registrationRevisionId=registration.revisionId;
  return {assignment,catalog,append};
}
