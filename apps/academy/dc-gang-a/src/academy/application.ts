import {ConceptWorkspaceCommands} from './usecases/conceptWorkspace';
import type {BookCertificationRetainedPort} from './bookCertificationEvidence';
import {TeacherWorkspaceCommands} from './usecases/teacherWorkspace';
import type {TeacherStore} from './ports/teacherStore';
import {academyConnectionStatus,type AcademySourceConnection} from './academyConnectionStatus';
import type {TrustedTeacherContext} from './contracts/teacherOperations';
import {assertTeacherScope} from './usecases/requestRecovery';
import {TeacherObservationCommands} from './usecases/teacherObservation';
import {TeacherClinicCommands} from './usecases/teacherClinic';
import {TeacherQueries} from './usecases/studentScene';
import {createRetainedQueryReader} from './retainedQuery';
import {PrerequisiteApplication} from './prerequisiteApplication';
import type {TeacherPrerequisiteStore} from './ports/teacherStore';
export type {TrustedTeacherContext,ObservationInput,ClinicDecisionInput} from './contracts/teacherOperations';
export type {NativeCommandIngress,BindTeacherInput,UpdateTeacherInput,RetireTeacherInput,CreateClassGroupInput,UpdateClassGroupInput,CreateLessonSessionInput,UpdateLessonSessionInput,UpsertTemporalBindingInput,AttachStudentRevisionInput,UpdateStudentRevisionInput,AttachActivityScopeInput,CorrectActivityScopeInput,CreateProgressInput,CorrectProgressInput,CreateAssessmentInput,CorrectAssessmentInput,CreateDraftInput,UpdateDraftInput,RecordScoreEvidenceInput,PreviewApprovalClosureInput,IssueApprovalInput,ApproveDraftInput,RevokeApprovalInput,CommandOutcomeInput,FenceCommandInput,FinalizeReadOccurrenceInput,ActivityScopeFilter} from './contracts/teacherOperations';
import type {NativeCommandIngress,BindTeacherInput,UpdateTeacherInput,RetireTeacherInput,CreateClassGroupInput,UpdateClassGroupInput,CreateLessonSessionInput,UpdateLessonSessionInput,UpsertTemporalBindingInput,AttachStudentRevisionInput,UpdateStudentRevisionInput,AttachActivityScopeInput,CorrectActivityScopeInput,CreateProgressInput,CorrectProgressInput,CreateAssessmentInput,CorrectAssessmentInput,CreateDraftInput,UpdateDraftInput,RecordScoreEvidenceInput,PreviewApprovalClosureInput,IssueApprovalInput,ApproveDraftInput,RevokeApprovalInput,CommandOutcomeInput,FenceCommandInput,FinalizeReadOccurrenceInput,ActivityScopeFilter} from './contracts/teacherOperations';
import type {ObjectRef,OwnerFamily,ReadAdmission} from './contracts/prerequisiteRecords';
/** Stable human/agent facade. Business slices own behavior; adapters own transactional enforcement. */
export class TeacherApplication {
  private readonly concepts:ConceptWorkspaceCommands;
  private readonly workspaces:TeacherWorkspaceCommands;
  private readonly observations:TeacherObservationCommands;
  private readonly clinics:TeacherClinicCommands;
  private readonly retainedQueries:ReturnType<typeof createRetainedQueryReader>;
  private readonly prerequisites:PrerequisiteApplication|null;
  constructor(readonly store:TeacherStore,readonly ownerId:string,readonly connection:()=>AcademySourceConnection=()=>academyConnectionStatus,readonly certification?:BookCertificationRetainedPort,prerequisiteStore?:TeacherPrerequisiteStore){
    this.concepts=new ConceptWorkspaceCommands(store,ownerId,certification);
    this.workspaces=new TeacherWorkspaceCommands(store,ownerId);
    this.observations=new TeacherObservationCommands(store,ownerId);
    this.clinics=new TeacherClinicCommands(store,ownerId);
    this.retainedQueries=createRetainedQueryReader(this);
    const candidate=prerequisiteStore??(/appendTeacher|admitCommand/.test(Object.getOwnPropertyNames(Object.getPrototypeOf(store)).join(','))||'appendTeacher' in store&&'admitCommand' in store?store as unknown as TeacherPrerequisiteStore:null);
    this.prerequisites=candidate?new PrerequisiteApplication(candidate,ownerId):null;
  }
  private prerequisiteFacade():PrerequisiteApplication{if(!this.prerequisites)throw Error('prerequisite_store_required');return this.prerequisites;}
  bindTeacher(context:TrustedTeacherContext,input:BindTeacherInput){return this.prerequisiteFacade().bindTeacher(context,input);}
  updateTeacher(context:TrustedTeacherContext,input:UpdateTeacherInput){return this.prerequisiteFacade().updateTeacher(context,input);}
  retireTeacher(context:TrustedTeacherContext,input:RetireTeacherInput){return this.prerequisiteFacade().retireTeacher(context,input);}
  createClassGroup(context:TrustedTeacherContext,input:CreateClassGroupInput){return this.prerequisiteFacade().createClassGroup(context,input);}
  updateClassGroup(context:TrustedTeacherContext,input:UpdateClassGroupInput){return this.prerequisiteFacade().updateClassGroup(context,input);}
  createLessonSession(context:TrustedTeacherContext,input:CreateLessonSessionInput){return this.prerequisiteFacade().createLessonSession(context,input);}
  updateLessonSession(context:TrustedTeacherContext,input:UpdateLessonSessionInput){return this.prerequisiteFacade().updateLessonSession(context,input);}
  upsertTemporalBinding(context:TrustedTeacherContext,input:UpsertTemporalBindingInput){return this.prerequisiteFacade().upsertTemporalBinding(context,input);}
  attachStudentRevision(context:TrustedTeacherContext,input:AttachStudentRevisionInput){return this.prerequisiteFacade().attachStudentRevision(context,input);}
  updateStudentRevision(context:TrustedTeacherContext,input:UpdateStudentRevisionInput){return this.prerequisiteFacade().updateStudentRevision(context,input);}
  attachActivityScope(context:TrustedTeacherContext,input:AttachActivityScopeInput){return this.prerequisiteFacade().attachActivityScope(context,input);}
  correctActivityScope(context:TrustedTeacherContext,input:CorrectActivityScopeInput){return this.prerequisiteFacade().correctActivityScope(context,input);}
  createProgress(context:TrustedTeacherContext,input:CreateProgressInput){return this.prerequisiteFacade().createProgress(context,input);}
  correctProgress(context:TrustedTeacherContext,input:CorrectProgressInput){return this.prerequisiteFacade().correctProgress(context,input);}
  createAssessment(context:TrustedTeacherContext,input:CreateAssessmentInput){return this.prerequisiteFacade().createAssessment(context,input);}
  correctAssessment(context:TrustedTeacherContext,input:CorrectAssessmentInput){return this.prerequisiteFacade().correctAssessment(context,input);}
  createDraft(context:TrustedTeacherContext,input:CreateDraftInput){return this.prerequisiteFacade().createDraft(context,input);}
  updateDraft(context:TrustedTeacherContext,input:UpdateDraftInput){return this.prerequisiteFacade().updateDraft(context,input);}
  recordScoreEvidence(context:TrustedTeacherContext,input:RecordScoreEvidenceInput){return this.prerequisiteFacade().recordScoreEvidence(context,input);}
  previewApprovalClosure(context:TrustedTeacherContext,input:PreviewApprovalClosureInput){return this.prerequisiteFacade().previewApprovalClosure(context,input);}
  issueApproval(context:TrustedTeacherContext,input:IssueApprovalInput){return this.prerequisiteFacade().issueApproval(context,input);}
  approveDraft(context:TrustedTeacherContext,input:ApproveDraftInput){return this.prerequisiteFacade().approveDraft(context,input);}
  revokeApproval(context:TrustedTeacherContext,input:RevokeApprovalInput){return this.prerequisiteFacade().revokeApproval(context,input);}
  commandOutcome(context:TrustedTeacherContext,input:CommandOutcomeInput){return this.prerequisiteFacade().commandOutcome(context,input);}
  fenceCommand(context:TrustedTeacherContext,input:FenceCommandInput){return this.prerequisiteFacade().fenceCommand(context,input);}
  admitReadOccurrence(context:TrustedTeacherContext,request:ReadAdmission){return this.prerequisiteFacade().admitReadOccurrence(context,request);}
  finalizeReadOccurrence(context:TrustedTeacherContext,input:FinalizeReadOccurrenceInput){return this.prerequisiteFacade().finalizeReadOccurrence(context,input);}
  readOccurrence(context:TrustedTeacherContext,request:ReadAdmission){return this.prerequisiteFacade().readOccurrence(context,request);}
  prerequisiteTeachers(context:TrustedTeacherContext){return this.prerequisiteFacade().teachers(context);}
  prerequisiteTeacher(context:TrustedTeacherContext,teacherKey:string){return this.prerequisiteFacade().teacher(context,teacherKey);}
  ownTeacherBinding(context:TrustedTeacherContext){return this.prerequisiteFacade().ownTeacherBinding(context);}
  prerequisiteClassGroups(context:TrustedTeacherContext){return this.prerequisiteFacade().classGroups(context);}
  prerequisiteClassGroup(context:TrustedTeacherContext,classKey:string){return this.prerequisiteFacade().classGroup(context,classKey);}
  prerequisiteLessons(context:TrustedTeacherContext){return this.prerequisiteFacade().lessons(context);}
  prerequisiteLesson(context:TrustedTeacherContext,lessonKey:string){return this.prerequisiteFacade().lesson(context,lessonKey);}
  prerequisiteTemporalBindings(context:TrustedTeacherContext){return this.prerequisiteFacade().temporalBindings(context);}
  prerequisiteActivityScopes(context:TrustedTeacherContext,filter:ActivityScopeFilter={}){return this.prerequisiteFacade().activityScopes(context,filter);}
  prerequisiteStudentRevision(context:TrustedTeacherContext,studentId:string){return this.prerequisiteFacade().studentRevision(context,studentId);}
  prerequisiteStudentRevisionHistory(context:TrustedTeacherContext,studentId:string,afterSequence=0,limit=200){return this.prerequisiteFacade().studentRevisionHistory(context,studentId,afterSequence,limit);}
  prerequisiteApproval(context:TrustedTeacherContext,approvalId:string){return this.prerequisiteFacade().approval(context,approvalId);}
  prerequisiteOwnerRevision(context:TrustedTeacherContext,family:OwnerFamily,entityKey:string,revisionId:string){return this.prerequisiteFacade().ownerRevision(context,family,entityKey,revisionId);}
  prerequisiteOwnerHistory(context:TrustedTeacherContext,family:OwnerFamily,entityKey:string,afterSequence=0,limit=200){return this.prerequisiteFacade().ownerHistory(context,family,entityKey,afterSequence,limit);}
  prerequisiteScoreEvidence(context:TrustedTeacherContext,entityKey:string){return this.prerequisiteFacade().scoreEvidence(context,entityKey);}
  prerequisiteScoreEvidenceForAttempt(context:TrustedTeacherContext,attemptRef:ObjectRef<'DailyTestAttempt'>){return this.prerequisiteFacade().scoreEvidenceForAttempt(context,attemptRef);}
  retainedQuery(context:TrustedTeacherContext,input:unknown){return this.retainedQueries.page(context,input);}
  saveConceptDefinition(context:TrustedTeacherContext,input:unknown){return this.concepts.saveDefinition(context,input);}
  saveStudentConceptLink(context:TrustedTeacherContext,input:unknown){return this.concepts.saveLink(context,input);}
  studentConceptGraph(context:TrustedTeacherContext,studentId:string){return this.concepts.graph(context,studentId);}
  conceptEvidence(context:TrustedTeacherContext,studentId:string,revisionId:string){return this.concepts.evidence(context,studentId,revisionId);}
  conceptResult(context:TrustedTeacherContext,requestId:string,studentId:string|null){return this.concepts.result(context,requestId,studentId);}
  conceptHistory(context:TrustedTeacherContext,entityId:string,studentId:string|null,afterSequence=0){return this.concepts.history(context,entityId,studentId,afterSequence);}
  bookCertification(context:TrustedTeacherContext,studentId:string,registrationRevisionId:string){return this.concepts.bookCertification(context,studentId,registrationRevisionId);}
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
