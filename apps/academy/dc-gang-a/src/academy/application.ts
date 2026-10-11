import type {TeacherStore} from './ports/teacherStore';
import {academyConnectionStatus,type AcademySourceConnection} from './nativeConnector';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import {assertTeacherScope} from './usecases/requestRecovery';
import {TeacherObservationCommands} from './usecases/teacherObservation';
import {TeacherClinicCommands} from './usecases/teacherClinic';
import {TeacherQueries} from './usecases/studentScene';
export type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput} from './contracts/teacherOperations';
/** Stable human/agent facade. Business slices own behavior; adapters own transactional enforcement. */
export class TeacherApplication {
  private readonly observations:TeacherObservationCommands;
  private readonly clinics:TeacherClinicCommands;
  constructor(readonly store:TeacherStore,readonly ownerId:string,readonly connection:()=>AcademySourceConnection=()=>academyConnectionStatus){
    this.observations=new TeacherObservationCommands(store,ownerId);
    this.clinics=new TeacherClinicCommands(store,ownerId);
  }
  saveObservation(context:TrustedTeacherContext,input:unknown){return this.observations.saveObservation(context,input);}
  observationResult(context:TrustedTeacherContext,studentId:string,requestId:string){return this.observations.observationResult(context,studentId,requestId);}
  saveClinicDecision(context:TrustedTeacherContext,input:unknown){return this.clinics.saveClinicDecision(context,input);}
  clinicResult(context:TrustedTeacherContext,studentId:string,requestId:string){return this.clinics.clinicResult(context,studentId,requestId);}
  async student(context:TrustedTeacherContext,studentId:string,date?:string){
    assertTeacherScope(this.ownerId,context);
    return this.store.readSnapshot(store=>new TeacherQueries(store,this.ownerId,this.connection).student(context,studentId,date));
  }
  async cohort(context:TrustedTeacherContext){
    assertTeacherScope(this.ownerId,context);
    return this.store.readSnapshot(store=>new TeacherQueries(store,this.ownerId,this.connection).cohort(context));
  }
  async classPreparation(context:TrustedTeacherContext,date:string){
    assertTeacherScope(this.ownerId,context);
    return this.store.readSnapshot(store=>new TeacherQueries(store,this.ownerId,this.connection).classPreparation(context,date));
  }
}
