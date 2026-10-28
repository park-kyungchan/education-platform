import type {TeacherPrerequisiteReadStore,TeacherPrerequisiteStore} from './ports/teacherStore';
import {assertTeacherScope} from './usecases/requestRecovery';
import {canonicalJson} from '../learning/model';
import {assertTeacherDate,nativeBusinessDate} from './nativePrerequisiteStore';
import type {TrustedTeacherContext,NativeCommandIngress,BindTeacherInput,UpdateTeacherInput,RetireTeacherInput,CreateClassGroupInput,UpdateClassGroupInput,CreateLessonSessionInput,UpdateLessonSessionInput,UpsertTemporalBindingInput,AttachStudentRevisionInput,UpdateStudentRevisionInput,AttachActivityScopeInput,CorrectActivityScopeInput,CreateProgressInput,CorrectProgressInput,CreateAssessmentInput,CorrectAssessmentInput,CreateDraftInput,UpdateDraftInput,RecordScoreEvidenceInput,PreviewApprovalClosureInput,IssueApprovalInput,ApproveDraftInput,RevokeApprovalInput,CommandOutcomeInput,FenceCommandInput,FinalizeReadOccurrenceInput,ActivityScopeFilter} from './contracts/teacherOperations';
import {assertStudentOperationKind,validateScopeMutation,requestDigest,validateContext,type ApprovalClosure,type CommandContext,type NativeObjectRef,type NativeWriteResult,type ObjectRef,type OwnerAppendCommand,type OwnerFamily,type OwnerVersion,type ReadAdmission,type TeacherBinding} from './contracts/prerequisiteRecords';

/** IG-2 facade over the complete IG-1 TeacherPrerequisiteStore port only.
 * Authenticated identity always comes from TrustedTeacherContext (ingress
 * injected). Caller teacher claims are checked against the bound Teacher
 * before any admission or store mutation. The one exemption is the first
 * self BindTeacher create. This facade allocates no native keys and
 * registers no payload validators; allocation, CAS, completeness and
 * single-use enforcement stay in the IG-1 store path. */
export class PrerequisiteApplication {
  constructor(private readonly store:TeacherPrerequisiteStore,readonly ownerId:string,private readonly now:()=>string=()=>new Date().toISOString()){}

  private commandContext(context:TrustedTeacherContext,ingress:NativeCommandIngress):CommandContext{
    assertTeacherScope(this.ownerId,context);
    if(!ingress||typeof ingress!=='object')throw Error('native_command_ingress_required');
    const value:CommandContext={ownerId:context.ownerId,actorId:context.actorId,idempotencyKey:ingress.idempotencyKey,occurrenceId:ingress.occurrenceId,admissionId:ingress.admissionId,processEpoch:ingress.processEpoch,sourceObservedAt:ingress.sourceObservedAt,verifiedSession:{ownerId:context.ownerId,actorId:context.actorId,authenticationRevision:ingress.authenticationRevision},namespace:ingress.namespace,scopeRef:ingress.scopeRef,nativeOwnerBinding:ingress.nativeOwnerBinding,nativeInterfaceBinding:ingress.nativeInterfaceBinding,action:ingress.action,requestIntentDigest:ingress.requestIntentDigest};
    validateContext(value);
    return value;
  }

  private async boundTeacher(context:TrustedTeacherContext){
    assertTeacherScope(this.ownerId,context);
    return this.store.teacherBindingByActor(context.ownerId,context.actorId);
  }

  /** Ordinary operations require a current ACTIVE binding for this actor. */
  private async requireActiveTeacher(context:TrustedTeacherContext,businessDate?:string){
    const bound=await this.boundTeacher(context);
    if(!bound)throw Error('teacher_binding_required');
    const payload=bound.payload;
    if(payload.state!=='ACTIVE'||payload.assignmentState.state!=='known'||payload.assignmentState.value!=='ACTIVE')throw Error('teacher_binding_inactive');
    if(businessDate!==undefined&&(businessDate<payload.validFrom||payload.validTo!==null&&businessDate>=payload.validTo))throw Error('teacher_binding_inactive');
    return bound;
  }

  /** Self-attribution claims must equal the exact current scoped binding:
   * native key, current revision, namespace and scope reference. Any
   * mismatch refuses before admission; the store revalidates in its
   * transaction as well. */
  private assertSelfTeacher(bound:OwnerVersion<TeacherBinding>,ref:ObjectRef<'Teacher'>|undefined){
    if(!ref)return;
    const identity=ref.identity;
    if(!identity||identity.objectType!=='Teacher'||identity.nativeKey!==bound.entityKey||identity.namespace!==bound.namespace||ref.revision!==bound.revisionId||canonicalJson(identity.scopeRef)!==canonicalJson(bound.scopeRef))throw Error('teacher_attribution_conflict');
  }

  private assertIssuerTeacher(bound:OwnerVersion<TeacherBinding>,teacherRef:NativeObjectRef|undefined){
    if(!teacherRef||teacherRef.objectTypeId!=='Teacher'||teacherRef.objectKey!==bound.entityKey||canonicalJson(teacherRef.basis)!==canonicalJson(bound.scopeRef.basis))throw Error('teacher_attribution_conflict');
  }

  /** Ordinary business reads resolve the current actor binding inside the
   * same bounded read snapshot and refuse before any payload is returned.
   * Exact-principal recovery/status lookups stay outside this gate. */
  private async gatedRead<T>(context:TrustedTeacherContext,read:(view:TeacherPrerequisiteReadStore)=>Promise<T>):Promise<T>{
    assertTeacherScope(this.ownerId,context);
    return this.store.readSnapshot(async view=>{
      const bound=await view.teacherBindingByActor(context.ownerId,context.actorId);
      if(!bound)throw Error('teacher_binding_required');
      const payload=bound.payload;
      // Same dated validity rule as every write: an expired ACTIVE binding refuses (403).
      assertTeacherDate(bound.payload,nativeBusinessDate(this.now()));
      return read(view);
    });
  }

  /** Admit the exact durable command binding, then run the native store path. */
  private async execute<C extends {context:CommandContext},R>(operation:string,command:C,run:(command:C)=>Promise<R>):Promise<R>{
    await this.store.admitCommand({context:command.context,requestDigest:requestDigest(operation,command)});
    return run(command);
  }

  // Teacher binding lifecycle. BindTeacher create is the only exemption from
  // the ACTIVE-binding requirement, and only for the caller's own actorId.
  async bindTeacher(context:TrustedTeacherContext,input:BindTeacherInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    if(!input.payload||input.payload.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    const existing=await this.boundTeacher(context);
    if(existing&&existing.idempotencyKey!==ctx.idempotencyKey)throw Error(existing.payload.state==='RETIRED'?'teacher_binding_inactive':'teacher_binding_exists');
    const command:OwnerAppendCommand<TeacherBinding>={context:ctx,entityKey:null,expectedRevisionId:null,payload:input.payload};
    return this.execute('append:teacher',command,cmd=>this.store.appendTeacher(cmd));
  }
  async updateTeacher(context:TrustedTeacherContext,input:UpdateTeacherInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    if(!input.payload||input.payload.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    await this.requireActiveTeacher(context);
    const command:OwnerAppendCommand<TeacherBinding>={context:ctx,entityKey:input.teacherKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('append:teacher',command,cmd=>this.store.appendTeacher(cmd));
  }
  async retireTeacher(context:TrustedTeacherContext,input:RetireTeacherInput):Promise<NativeWriteResult>{
    if(!input?.payload||input.payload.state!=='RETIRED')throw Error('invalid_transition');
    return this.updateTeacher(context,input);
  }

  async createClassGroup(context:TrustedTeacherContext,input:CreateClassGroupInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,entityKey:null,expectedRevisionId:null,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendClassGroup']>[0];
    return this.execute('append:class',command,cmd=>this.store.appendClassGroup(cmd));
  }
  async updateClassGroup(context:TrustedTeacherContext,input:UpdateClassGroupInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,entityKey:input.classKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendClassGroup']>[0];
    return this.execute('append:class',command,cmd=>this.store.appendClassGroup(cmd));
  }

  async createLessonSession(context:TrustedTeacherContext,input:CreateLessonSessionInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.businessDate);
    const command={context:ctx,entityKey:null,expectedRevisionId:null,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendLesson']>[0];
    return this.execute('append:lesson',command,cmd=>this.store.appendLesson(cmd));
  }
  async updateLessonSession(context:TrustedTeacherContext,input:UpdateLessonSessionInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.businessDate);
    const command={context:ctx,entityKey:input.lessonKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendLesson']>[0];
    return this.execute('append:lesson',command,cmd=>this.store.appendLesson(cmd));
  }

  async upsertTemporalBinding(context:TrustedTeacherContext,input:UpsertTemporalBindingInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,entityKey:input.bindingKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendTemporalBinding']>[0];
    return this.execute('append:binding',command,cmd=>this.store.appendTemporalBinding(cmd));
  }

  async attachStudentRevision(context:TrustedTeacherContext,input:AttachStudentRevisionInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,studentId:input.studentId,expectedRevisionId:null,payload:input.payload};
    return this.execute('append:student',command,cmd=>this.store.appendStudentRevision(cmd));
  }
  async updateStudentRevision(context:TrustedTeacherContext,input:UpdateStudentRevisionInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,studentId:input.studentId,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('append:student',command,cmd=>this.store.appendStudentRevision(cmd));
  }

  async attachActivityScope(context:TrustedTeacherContext,input:AttachActivityScopeInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    validateScopeMutation(input.payload,ctx.action,false);
    const command={context:ctx,entityKey:null,expectedRevisionId:null,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendActivityScope']>[0];
    return this.execute('append:scope',command,cmd=>this.store.appendActivityScope(cmd));
  }
  async correctActivityScope(context:TrustedTeacherContext,input:CorrectActivityScopeInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    validateScopeMutation(input.payload,ctx.action,true);
    if(typeof input.scopeKey!=='string'||!input.scopeKey||typeof input.expectedRevisionId!=='string'||!input.expectedRevisionId)throw Error('invalid_activity_scope');
    const command={context:ctx,entityKey:input.scopeKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload} as Parameters<TeacherPrerequisiteStore['appendActivityScope']>[0];
    return this.execute('append:scope',command,cmd=>this.store.appendActivityScope(cmd));
  }

  async createProgress(context:TrustedTeacherContext,input:CreateProgressInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    const command={context:ctx,studentId:input.studentId,payload:input.payload};
    return this.execute('createProgress',command,cmd=>this.store.createProgress(cmd));
  }
  async correctProgress(context:TrustedTeacherContext,input:CorrectProgressInput):Promise<NativeWriteResult>{
    assertStudentOperationKind('correctProgress',input?.payload);
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    const command={context:ctx,studentId:input.studentId,entityId:input.entityId,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('correctPrerequisiteRecord',command,cmd=>this.store.correctPrerequisiteRecord(cmd));
  }

  async createAssessment(context:TrustedTeacherContext,input:CreateAssessmentInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context,input?.payload?.assessmentScope?.businessDate);
    if(input?.payload?.assessedBy?.state==='known')this.assertSelfTeacher(bound,input.payload.assessedBy.value);
    const command={context:ctx,studentId:input.studentId,payload:input.payload};
    return this.execute('createAssessment',command,cmd=>this.store.createAssessment(cmd));
  }
  async correctAssessment(context:TrustedTeacherContext,input:CorrectAssessmentInput):Promise<NativeWriteResult>{
    assertStudentOperationKind('correctAssessment',input?.payload);
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context,input?.payload?.assessmentScope?.businessDate);
    if(input?.payload?.assessedBy?.state==='known')this.assertSelfTeacher(bound,input.payload.assessedBy.value);
    const command={context:ctx,studentId:input.studentId,entityId:input.entityId,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('correctPrerequisiteRecord',command,cmd=>this.store.correctPrerequisiteRecord(cmd));
  }

  async createDraft(context:TrustedTeacherContext,input:CreateDraftInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    if(input?.payload?.responsibleTeacherRef?.state==='known')this.assertSelfTeacher(bound,input.payload.responsibleTeacherRef.value);
    const command={context:ctx,studentId:input.studentId,payload:input.payload};
    return this.execute('createDraft',command,cmd=>this.store.createDraft(cmd));
  }
  async updateDraft(context:TrustedTeacherContext,input:UpdateDraftInput):Promise<NativeWriteResult>{
    assertStudentOperationKind('updateDraft',input?.payload);
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    if(input?.payload?.responsibleTeacherRef?.state==='known')this.assertSelfTeacher(bound,input.payload.responsibleTeacherRef.value);
    const command={context:ctx,studentId:input.studentId,entityId:input.entityId,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('correctPrerequisiteRecord',command,cmd=>this.store.correctPrerequisiteRecord(cmd));
  }

  async recordScoreEvidence(context:TrustedTeacherContext,input:RecordScoreEvidenceInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context,input?.payload?.recordScope?.businessDate);
    if(input?.payload)this.assertSelfTeacher(bound,input.payload.recordedBy);
    const command={context:ctx,entityKey:input.entityKey,expectedRevisionId:input.expectedRevisionId,payload:input.payload};
    return this.execute('appendScoreEvidence',command,cmd=>this.store.appendScoreEvidence(cmd));
  }

  // Approval issuer: preview derives the exact closure in a read snapshot;
  // issue and consume are separate native command occurrences. No caller
  // supplied proof object is ever accepted as an approval.
  async previewApprovalClosure(context:TrustedTeacherContext,input:PreviewApprovalClosureInput):Promise<ApprovalClosure>{
    const ctx=this.commandContext(context,input?.command);
    return this.gatedRead(context,view=>view.approvalClosurePreview(ctx,input.draftRef));
  }
  async issueApproval(context:TrustedTeacherContext,input:IssueApprovalInput){
    const ctx=this.commandContext(context,input?.command);
    const bound=await this.requireActiveTeacher(context);
    this.assertIssuerTeacher(bound,input?.closure?.teacherRef);
    const command={context:ctx,draftRef:input.draftRef,closure:input.closure,validForSeconds:input.validForSeconds};
    return this.execute('issueApproval',command,cmd=>this.store.issueApproval(cmd));
  }
  async approveDraft(context:TrustedTeacherContext,input:ApproveDraftInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,draftRef:input.draftRef,approvalProofHandle:input.approvalProofHandle};
    return this.execute('consumeApprovalAndApproveDraft',command,cmd=>this.store.consumeApprovalAndApproveDraft(cmd));
  }
  async revokeApproval(context:TrustedTeacherContext,input:RevokeApprovalInput):Promise<NativeWriteResult>{
    const ctx=this.commandContext(context,input?.command);
    await this.requireActiveTeacher(context);
    const command={context:ctx,approvalId:input.approvalId,expectedRevisionId:input.expectedRevisionId};
    return this.execute('revokeApproval',command,cmd=>this.store.revokeApproval(cmd));
  }

  // Outcome and read-occurrence lookup facades: metadata only, principal
  // bound, never a re-execution of the original command.
  async commandOutcome(context:TrustedTeacherContext,input:CommandOutcomeInput){
    assertTeacherScope(this.ownerId,context);
    if(!input?.request||input.request.ownerId!==context.ownerId||input.request.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    return this.store.commandOutcomeLookup(input.request);
  }
  async fenceCommand(context:TrustedTeacherContext,input:FenceCommandInput){
    assertTeacherScope(this.ownerId,context);
    if(!input?.request||input.request.ownerId!==context.ownerId||input.request.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    await this.requireActiveTeacher(context);
    return this.store.fenceCommand({request:input.request,fenceOccurrenceId:input.fenceOccurrenceId,reason:input.reason});
  }
  async admitReadOccurrence(context:TrustedTeacherContext,request:ReadAdmission){
    assertTeacherScope(this.ownerId,context);
    if(!request||request.ownerId!==context.ownerId||request.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    await this.requireActiveTeacher(context);
    return this.store.admitReadOccurrence(request);
  }
  async finalizeReadOccurrence(context:TrustedTeacherContext,input:FinalizeReadOccurrenceInput){
    assertTeacherScope(this.ownerId,context);
    if(!input?.request||input.request.ownerId!==context.ownerId||input.request.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    // REFUSED/UNKNOWN cleanup for an already admitted occurrence must reach
    // the metadata finalizer even after binding authorization fails. A
    // successful COMPLETED audit is never accepted on this ordinary facade:
    // it is produced only by the private owner gate inside the store
    // commitReadOutput path. No caller-supplied field can confer that
    // authority, so a runtime COMPLETED value is refused before dispatch.
    // This never authorizes a business read or write.
    if((input as {status?:unknown}).status==='COMPLETED')throw Error('read_completion_owner_witness_required');
    return this.store.finalizeReadOccurrence({request:input.request,status:input.status,snapshotDigest:input.snapshotDigest,refusalCode:input.refusalCode});
  }
  async readOccurrence(context:TrustedTeacherContext,request:ReadAdmission){
    assertTeacherScope(this.ownerId,context);
    if(!request||request.ownerId!==context.ownerId||request.actorId!==context.actorId)throw Error('teacher_attribution_conflict');
    return this.store.readOccurrenceLookup(request);
  }

  // Ordinary business reads behind the current-binding gate. The actor's own
  // binding lookup and the exact-principal outcome/read-occurrence lookups
  // above stay ungated so retirement state and recovery remain observable;
  // a historical ACTIVE revision never authorizes a retired caller because
  // the gate always reads the current actor-index head.
  async teachers(context:TrustedTeacherContext){return this.gatedRead(context,view=>view.teachers(context.ownerId));}
  async teacher(context:TrustedTeacherContext,teacherKey:string){return this.gatedRead(context,view=>view.teacherCurrent(context.ownerId,teacherKey));}
  async ownTeacherBinding(context:TrustedTeacherContext){assertTeacherScope(this.ownerId,context);return this.store.teacherBindingByActor(context.ownerId,context.actorId);}
  async classGroups(context:TrustedTeacherContext){return this.gatedRead(context,view=>view.classGroups(context.ownerId));}
  async classGroup(context:TrustedTeacherContext,classKey:string){return this.gatedRead(context,view=>view.classCurrent(context.ownerId,classKey));}
  async lessons(context:TrustedTeacherContext){return this.gatedRead(context,view=>view.lessons(context.ownerId));}
  async lesson(context:TrustedTeacherContext,lessonKey:string){return this.gatedRead(context,view=>view.lessonCurrent(context.ownerId,lessonKey));}
  async temporalBindings(context:TrustedTeacherContext){return this.gatedRead(context,view=>view.temporalBindings(context.ownerId));}
  async activityScopes(context:TrustedTeacherContext,filter:ActivityScopeFilter={}){return this.gatedRead(context,view=>view.activityScopes(context.ownerId,filter));}
  async studentRevision(context:TrustedTeacherContext,studentId:string){return this.gatedRead(context,view=>view.studentRevisionCurrent(context.ownerId,studentId));}
  async studentRevisionHistory(context:TrustedTeacherContext,studentId:string,afterSequence=0,limit=200){return this.gatedRead(context,view=>view.studentRevisionHistory(context.ownerId,studentId,afterSequence,limit));}
  async approval(context:TrustedTeacherContext,approvalId:string){return this.gatedRead(context,view=>view.approvalCurrent(context.ownerId,approvalId));}
  async ownerRevision(context:TrustedTeacherContext,family:OwnerFamily,entityKey:string,revisionId:string){return this.gatedRead(context,view=>view.ownerRevision(context.ownerId,family,entityKey,revisionId));}
  async ownerHistory(context:TrustedTeacherContext,family:OwnerFamily,entityKey:string,afterSequence=0,limit=200){return this.gatedRead(context,view=>view.ownerHistory(context.ownerId,family,entityKey,afterSequence,limit));}
  async scoreEvidence(context:TrustedTeacherContext,entityKey:string){return this.gatedRead(context,view=>view.scoreEvidenceCurrent(context.ownerId,entityKey));}
  async scoreEvidenceForAttempt(context:TrustedTeacherContext,attemptRef:ObjectRef<'DailyTestAttempt'>){return this.gatedRead(context,view=>view.scoreEvidenceForAttempt(context.ownerId,attemptRef));}
}
