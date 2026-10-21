import {assertExactKeys,canonicalJson,digest} from '../../learning/model';
import {readInputRecord} from '../../contracts/readInputRecord';
import {validateAcademyRecord,observationTerminalRefusals,ObservationCommandRefusal,type TeacherObservation,type TeacherObservationRequest} from '../records';
import {classroomCyclePolicy} from '../classroomCyclePolicy';
import {workToken,clinicTerminalRefusals,ClinicCommandRefusal,type TeacherClinicRevision,type TeacherClinicRequest} from '../learningWork';
import {operationalContractShape} from '../operationalContract';
import type {TeacherStore} from '../ports/teacherStore';
import type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput,ObservationReceipt,ClinicReceipt} from '../contracts/teacherOperations';
import {assertTeacherScope,appendTeacherRequest,observationRequestInput,clinicRequestInput} from './requestRecovery';
/** Existing observation workflow; transaction enforcement remains at the store boundary. */
export class TeacherObservationCommands {
constructor(readonly store:TeacherStore,readonly ownerId:string){}
async saveObservation(context:TrustedTeacherContext,input:unknown):Promise<ObservationReceipt>{
    assertTeacherScope(this.ownerId,context);
    const data=readInputRecord(input);
    canonicalJson(data);
    assertExactKeys(data,['studentId','occurrence','basisRevisionId','expectedRevisionId','idempotencyKey','reportedAt','text']);
    for(const key of ['studentId','basisRevisionId','idempotencyKey','reportedAt','text'])if(typeof data[key]!=='string'||!data[key].trim())throw Error('invalid_observation_input');
    if((data.studentId as string).length>200||(data.idempotencyKey as string).length>200||!(data.expectedRevisionId===null||typeof data.expectedRevisionId==='string'&&data.expectedRevisionId.length>0&&data.expectedRevisionId.length<=200))throw Error('invalid_observation_input');
    const student=(await this.store.students(this.ownerId)).find(row=>row.id===data.studentId);
    if(!student)throw Error('student_scope_conflict');
    const payload:TeacherObservation={kind:'teacher_observation',sourceStudent:student.sourceKey,occurrence:structuredClone(data.occurrence) as TeacherObservation['occurrence'],basisRevisionId:data.basisRevisionId as string,reportedAt:data.reportedAt as string,text:data.text as string};
    validateAcademyRecord(payload);
    const command=data as unknown as ObservationInput;
    const retained=await this.store.observationRequest(this.ownerId,student.id,context.actorId,command.idempotencyKey);
    const original=retained?.payload.kind==='teacher_observation_request'?retained.payload:null;
    if(original&&canonicalJson(observationRequestInput(student.id,original))!==canonicalJson(command))throw new ObservationCommandRefusal('idempotency_reuse',false);
    if(original?.resolution==='rejected')throw new ObservationCommandRefusal(original.refusal!,true);
    const intent:TeacherObservationRequest={kind:'teacher_observation_request',sourceStudent:student.sourceKey,requestId:command.idempotencyKey,expectedRevisionId:command.expectedRevisionId,observation:payload,resolution:'pending',refusal:null};
    const intentCommand={ownerId:this.ownerId,studentId:student.id,entityId:'observation-request-'+digest({actorId:context.actorId,idempotencyKey:command.idempotencyKey}),actorId:context.actorId,idempotencyKey:'observation-intent-'+digest(command.idempotencyKey),expectedRevisionId:null,sourceObservedAt:payload.reportedAt,payload:intent};
    const refuse=async(refusal:string,journalRevision:string|null=null):Promise<never>=>{
      const rejected:TeacherObservationRequest={...intent,resolution:'rejected',refusal};
      await appendTeacherRequest(this.store,{...intentCommand,expectedRevisionId:journalRevision,idempotencyKey:'observation-refusal-'+digest(command.idempotencyKey),payload:rejected});
      const stored=await this.store.observationRequest(this.ownerId,student.id,context.actorId,command.idempotencyKey);
      if(!stored||canonicalJson(stored.payload)!==canonicalJson(rejected))throw Error('observation_refusal_retention_uncertain');
      throw new ObservationCommandRefusal(refusal,true);
    };
    let staged;
    try{staged=await appendTeacherRequest(this.store,intentCommand);}catch(error){if(error instanceof Error&&error.message==='unresolved_observation_request')return refuse(error.message);throw error;}
    const entityId='teacher-observation-'+digest({studentId:student.id,occurrence:payload.occurrence});
    let outcome;
    try{outcome=await this.store.append({ownerId:this.ownerId,studentId:student.id,entityId,actorId:context.actorId,idempotencyKey:command.idempotencyKey,expectedRevisionId:command.expectedRevisionId,sourceObservedAt:payload.reportedAt,payload});}
    catch(error){const refusal=error instanceof Error?error.message:'unknown';if(observationTerminalRefusals.includes(refusal))return refuse(refusal,staged.revisionId);throw error;}
    const records=await this.store.history(this.ownerId,student.id,entityId,outcome.sequence-1,1);
    const record=records[0];if(!record||record.revisionId!==outcome.revisionId||record.contentDigest!==outcome.contentDigest)throw Error('committed_outcome_uncertain');
    return {...outcome,record,teacherObservationPolicy:operationalContractShape.meaning.teacherAcceptance};
  }
async observationResult(context:TrustedTeacherContext,studentId:string,requestId:string){
    assertTeacherScope(this.ownerId,context);
    if(typeof studentId!=='string'||!studentId||studentId.length>200||typeof requestId!=='string'||!requestId||requestId.length>200)throw Error('invalid_observation_input');
    if(!(await this.store.students(this.ownerId)).some(row=>row.id===studentId))throw Error('student_scope_conflict');
    const record=await this.store.observationResult(this.ownerId,studentId,context.actorId,requestId);
    if(!record)throw Error('observation_result_not_found');
    return {status:'recorded' as const,revisionId:record.revisionId,record,officialSaved:false,parentSent:false};
  }
}
