import {canonicalJson} from '../../learning/model';
import type {TeacherStore} from '../ports/teacherStore';
import type {TrustedTeacherContext} from '../contracts/teacherOperations';
import {assertTeacherScope} from './requestRecovery';
import {conceptIntake,conceptSelector,conceptDefinitionFromInput,conceptLinkFromInput,type ConceptDefinitionInput,type ConceptLinkInput,type ConceptCommandContext} from '../conceptWorkspace';
import type {PostgresAcademyStore} from '../postgresStore';
import {projectRetainedBookCertification,certificationScope,type BookCertificationRetainedPort,type RetainedCertificationBinding} from '../bookCertificationEvidence';

export class ConceptWorkspaceCommands {
 constructor(readonly store:TeacherStore,readonly ownerId:string,readonly certification?:BookCertificationRetainedPort){}
 private provider(){
  const store=this.store as TeacherStore&Partial<PostgresAcademyStore>;
  if(!store.appendConceptDefinition||!store.appendStudentConceptLink||!store.readStudentConceptGraph||!store.conceptResult||!store.conceptHistory||!store.conceptEvidenceDetail)throw Error('concept_storage_unavailable');return store as PostgresAcademyStore;
 }
 async saveDefinition(context:TrustedTeacherContext,input:unknown){
  const {data,provider}=conceptIntake(()=>{assertTeacherScope(this.ownerId,context);const provider=this.provider(),value=JSON.parse(canonicalJson(input)) as ConceptDefinitionInput;conceptDefinitionFromInput(context,value);return {data:value,provider};});
  return provider.appendConceptDefinition({ownerId:this.ownerId,actorId:context.actorId},data);
 }
 async saveLink(context:TrustedTeacherContext,input:unknown){
  const {data,provider}=conceptIntake(()=>{assertTeacherScope(this.ownerId,context);const provider=this.provider(),value=JSON.parse(canonicalJson(input)) as ConceptLinkInput;conceptLinkFromInput(context,value,null);return {data:value,provider};});
  return provider.appendStudentConceptLink({ownerId:this.ownerId,actorId:context.actorId},data);
 }
 async graph(context:TrustedTeacherContext,studentId:string){assertTeacherScope(this.ownerId,context);conceptSelector(studentId);const result=await this.provider().readStudentConceptGraph(this.ownerId,studentId);return {...result,teacherScope:{ownerId:this.ownerId,actorId:context.actorId}};}
 evidence(context:TrustedTeacherContext,studentId:string,revisionId:string){assertTeacherScope(this.ownerId,context);conceptSelector(studentId);conceptSelector(revisionId);return this.provider().conceptEvidenceDetail(this.ownerId,studentId,revisionId);}
 async result(context:TrustedTeacherContext,requestId:string,studentId:string|null){assertTeacherScope(this.ownerId,context);conceptSelector(requestId);if(studentId!==null)conceptSelector(studentId);const record=await this.provider().conceptResult(this.ownerId,context.actorId,requestId,studentId);if(!record)throw Error('concept_result_not_found');return {revisionId:record.revisionId,record,officialSaved:false,parentSent:false};}
 async history(context:TrustedTeacherContext,entityId:string,studentId:string|null,afterSequence=0){assertTeacherScope(this.ownerId,context);conceptSelector(entityId);if(studentId!==null)conceptSelector(studentId);const rows=await this.provider().conceptHistory(this.ownerId,studentId,entityId,afterSequence);return {rows,nextAfterSequence:rows.length===200?rows.at(-1)!.sequence:null,officialSaved:false,parentSent:false};}
 async bookCertification(context:TrustedTeacherContext,studentId:string,registrationRevisionId:string){
  assertTeacherScope(this.ownerId,context);conceptSelector(studentId);conceptSelector(registrationRevisionId);
  return this.store.readSnapshot(async store=>{
   const student=(await store.students(this.ownerId)).find(row=>row.id===studentId);if(!student)throw Error('student_scope_conflict');
   const registration=(await store.current(this.ownerId,studentId)).find(row=>row.revisionId===registrationRevisionId);
   if(registration?.payload.kind!=='source_book_registration')throw Error('stale_evidence_basis');const binding:RetainedCertificationBinding={ownerId:this.ownerId,student,registration:registration as RetainedCertificationBinding['registration']};
   const retained=this.certification?await this.certification.lookup(certificationScope(binding)):null;return projectRetainedBookCertification(binding,retained);
  });
 }
}
