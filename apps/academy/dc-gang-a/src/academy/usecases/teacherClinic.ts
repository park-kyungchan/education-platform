import {assertExactKeys,canonicalJson,digest} from '../../learning/model';
import {readInputRecord} from '../../lms/academyReadProtocol';
import {validateAcademyRecord,observationTerminalRefusals,ObservationCommandRefusal,type TeacherObservation,type TeacherObservationRequest} from '../records';
import {classroomCyclePolicy} from '../classroomCyclePolicy';
import {workToken,clinicTerminalRefusals,ClinicCommandRefusal,type TeacherClinicRevision,type TeacherClinicRequest} from '../learningWork';
import {operationalContractShape} from '../operationalContract';
import type {TeacherStore} from '../ports/teacherStore';
import type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput,ObservationReceipt,ClinicReceipt} from '../contracts/teacherOperations';
import {assertTeacherScope,appendTeacherRequest,observationRequestInput,clinicRequestInput} from './requestRecovery';
/** Existing clinic workflow, independent of HTTP, UI and PostgreSQL driver types. */
export class TeacherClinicCommands {
constructor(readonly store:TeacherStore,readonly ownerId:string){}
async saveClinicDecision(context:TrustedTeacherContext,input:unknown):Promise<ClinicReceipt>{
    assertTeacherScope(this.ownerId,context);canonicalJson(input);const data=readInputRecord(input);
    assertExactKeys(data,['studentId','assignmentRevisionId','attemptEntityId','attemptRevisionId','assignedItemId','effectiveDate','expectedRevisionId','expectedPolicyRevision','idempotencyKey','reportedAt','decision','inspection','note']);
    for(const field of ['studentId','assignmentRevisionId','attemptEntityId','attemptRevisionId','assignedItemId','expectedPolicyRevision','idempotencyKey'])workToken(data[field] as string);
    if(data.expectedRevisionId!==null)workToken(data.expectedRevisionId as string);
    const command=data as unknown as ClinicDecisionInput;
    const student=(await this.store.students(this.ownerId)).find(row=>row.id===command.studentId);if(!student)throw Error('student_scope_conflict');
    const {studentId,expectedRevisionId,expectedPolicyRevision,idempotencyKey,...fields}=command;
    const retained=await this.store.clinicRequest(this.ownerId,studentId,context.actorId,idempotencyKey);
    const original=retained?.payload.kind==='teacher_clinic_request'?retained.payload:null;
    if(original&&canonicalJson(clinicRequestInput(studentId,original))!==canonicalJson(command))throw new ClinicCommandRefusal('idempotency_reuse',false);
    if(original?.resolution==='rejected')throw new ClinicCommandRefusal(original.refusal!,true);
    // Retain the submitted policy assertion in a rejected original; it grants no decision authority.
    const payload:TeacherClinicRevision=original?.decision??{kind:'teacher_clinic_revision',sourceStudent:student.sourceKey,...structuredClone(fields),policyRevision:expectedPolicyRevision};
    validateAcademyRecord(payload);
    const entityId='teacher-clinic-'+digest({assignmentRevisionId:payload.assignmentRevisionId,attemptEntityId:payload.attemptEntityId,assignedItemId:payload.assignedItemId});
    const intent:TeacherClinicRequest={kind:'teacher_clinic_request',sourceStudent:student.sourceKey,requestId:idempotencyKey,expectedRevisionId,decision:payload,resolution:'pending',refusal:null};
    const intentCommand={ownerId:this.ownerId,studentId,entityId:'clinic-request-'+digest({actorId:context.actorId,idempotencyKey}),actorId:context.actorId,expectedRevisionId:null,idempotencyKey:'clinic-intent-'+digest(idempotencyKey),sourceObservedAt:payload.reportedAt,payload:intent};
    const refuse=async(refusal:string,journalRevision:string|null=null):Promise<never>=>{
      const rejected:TeacherClinicRequest={...intent,resolution:'rejected',refusal};
      await appendTeacherRequest(this.store,{...intentCommand,expectedRevisionId:journalRevision,idempotencyKey:'clinic-refusal-'+digest(idempotencyKey),payload:rejected});
      const stored=await this.store.clinicRequest(this.ownerId,studentId,context.actorId,idempotencyKey);
      if(!stored||canonicalJson(stored.payload)!==canonicalJson(rejected))throw Error('clinic_refusal_retention_uncertain');
      throw new ClinicCommandRefusal(refusal,true);
    };
    // Early refusal for fresh intent; the store also checks current policy for every uncommitted decision.
    // Exact committed replay remains valid, but merely retaining an original cannot bypass that transaction gate.
    if(!original&&expectedPolicyRevision!==classroomCyclePolicy.operationalContextRevision)return refuse('stale_clinic_policy');
    let staged;
    try{staged=await appendTeacherRequest(this.store,intentCommand);}catch(error){if(error instanceof Error&&error.message==='unresolved_clinic_request')return refuse(error.message);throw error;}
    let outcome;
    try{outcome=await this.store.append({ownerId:this.ownerId,studentId,entityId,actorId:context.actorId,expectedRevisionId,idempotencyKey,sourceObservedAt:payload.reportedAt,payload});}
    catch(error){
      const refusal=error instanceof Error?error.message:'unknown';
      if(clinicTerminalRefusals.includes(refusal))return refuse(refusal,staged.revisionId);
      throw error;
    }
    const record=await this.store.clinicResult(this.ownerId,studentId,context.actorId,idempotencyKey);
    if(!record||record.revisionId!==outcome.revisionId||record.contentDigest!==outcome.contentDigest)throw Error('committed_outcome_uncertain');
    return {...outcome,record};
  }
async clinicResult(context:TrustedTeacherContext,studentId:string,requestId:string){
    assertTeacherScope(this.ownerId,context);workToken(studentId);workToken(requestId);
    if(!(await this.store.students(this.ownerId)).some(row=>row.id===studentId))throw Error('student_scope_conflict');
    const record=await this.store.clinicResult(this.ownerId,studentId,context.actorId,requestId);
    if(!record)throw Error('clinic_result_not_found');
    return {status:'recorded' as const,revisionId:record.revisionId,record,officialSaved:false as const,parentSent:false as const};
  }
}
