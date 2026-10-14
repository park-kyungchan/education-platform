import {TeacherWorkspaceCommands} from './usecases/teacherWorkspace';
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
  private readonly workspaces:TeacherWorkspaceCommands;
  private readonly observations:TeacherObservationCommands;
  private readonly clinics:TeacherClinicCommands;
  constructor(readonly store:TeacherStore,readonly ownerId:string,readonly connection:()=>AcademySourceConnection=()=>academyConnectionStatus){
    this.workspaces=new TeacherWorkspaceCommands(store,ownerId);
    this.observations=new TeacherObservationCommands(store,ownerId);
    this.clinics=new TeacherClinicCommands(store,ownerId);
  }
  saveTeacherWorkspace(context:TrustedTeacherContext,input:unknown){return this.workspaces.save(context,input);}
  teacherWorkspaceResult(context:TrustedTeacherContext,studentId:string,requestId:string){return this.workspaces.result(context,studentId,requestId);}
  teacherWorkspaceHistory(context:TrustedTeacherContext,studentId:string,entityId:string,afterSequence=0){return this.workspaces.history(context,studentId,entityId,afterSequence);}
  operatingCatalog(context:TrustedTeacherContext){return this.workspaces.operatingCatalog(context);}
  operatingSelection(context:TrustedTeacherContext,policyIds:string[],revision:string){return this.workspaces.operatingSelection(context,policyIds,revision);}
  projectExamCandidate(context:TrustedTeacherContext,input:unknown){return this.workspaces.projectExamCandidate(context,input);}
  saveOwnerWorkspace(context:TrustedTeacherContext,input:unknown){return this.workspaces.saveOwner(context,input);}
  ownerWorkspaces(context:TrustedTeacherContext){return this.workspaces.ownerCurrent(context);}
  ownerWorkspaceResult(context:TrustedTeacherContext,requestId:string){return this.workspaces.ownerResult(context,requestId);}
  ownerWorkspaceHistory(context:TrustedTeacherContext,entityId:string,afterSequence=0){return this.workspaces.ownerHistory(context,entityId,afterSequence);}
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
