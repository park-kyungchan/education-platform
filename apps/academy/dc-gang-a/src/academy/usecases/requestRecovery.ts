import type {TeacherStore} from '../ports/teacherStore';
import type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput} from '../contracts/teacherOperations';
import {ObservationCommandRefusal,type TeacherObservationRequest} from '../records';
import {ClinicCommandRefusal,type TeacherClinicRequest} from '../learningWork';
export function assertTeacherScope(ownerId:string,context:TrustedTeacherContext):void{if(context.ownerId!==ownerId||context.role!=='teacher'||!context.actorId)throw Error('owner_scope_conflict');}
export function observationRequestInput(studentId:string,request:TeacherObservationRequest):ObservationInput{
  const {kind,sourceStudent,...observation}=request.observation;
  return {studentId,...observation,expectedRevisionId:request.expectedRevisionId,idempotencyKey:request.requestId};
}
export function clinicRequestInput(studentId:string,request:TeacherClinicRequest):ClinicDecisionInput{
  const {kind,sourceStudent,policyRevision,...decision}=request.decision;
  return {studentId,...decision,expectedPolicyRevision:policyRevision,expectedRevisionId:request.expectedRevisionId,idempotencyKey:request.requestId};
}
export async function appendTeacherRequest(store:TeacherStore,command:Parameters<TeacherStore['append']>[0]&{payload:TeacherObservationRequest|TeacherClinicRequest}){
    try{return await store.append(command);}catch(error){
      // Only a proven pre-transaction clock refusal plus absent protected intent permits a new request.
      if(error instanceof Error&&error.message==='future_source_observation'){
        const observation=command.payload.kind==='teacher_observation_request';
        const retained=observation?await store.observationRequest(command.ownerId,command.studentId,command.actorId,command.payload.requestId):await store.clinicRequest(command.ownerId,command.studentId,command.actorId,command.payload.requestId);
        if(!retained)throw observation?new ObservationCommandRefusal('future_reported_at',false):new ClinicCommandRefusal('future_reported_at',false);
      }
      throw error;
    }
  }
