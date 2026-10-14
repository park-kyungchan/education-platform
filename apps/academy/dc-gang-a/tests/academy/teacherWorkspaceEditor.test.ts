import {JSDOM} from 'jsdom';
import {test,expect,afterAll} from 'bun:test';
import { workspaceDraft, workspaceControls } from '../../src/academy/web/workspaceEditor';
import { TeacherApplication } from '../../src/academy/application';
import { createTeacherServerHandler } from '../../src/academy/server';
import { signTeacherSession } from '../../src/academy/auth';
import { examWorkspaceView } from '../../src/academy/web/examWorkspaceView';
import { createExamCandidate } from '../../src/academy/examSelection';
import { teacherWorkspaceView } from '../../src/academy/web/teacherWorkspaceView';
import { workspaceEntityId } from '../../src/academy/teacherWorkspace';

// Regressions derived from independent review findings F1/F2/F3 on695d20c0. No listener, SQL or private originals.
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const scope = { ownerId: 'synthetic-review-owner', actorId: 'synthetic-review-actor' };
const originalDocument=globalThis.document,windows:any[]=[];afterAll(()=>{for(const window of windows)window.close();if(originalDocument===undefined)delete (globalThis as any).document;else globalThis.document=originalDocument;});
function dom() { const value = new JSDOM('<!doctype html>'); windows.push(value.window);Object.assign(globalThis, { document: value.window.document }); return value; }
function exam(title = 'Synthetic') {
  return { kind: 'teacher_exam_selection_draft', draftId: crypto.randomUUID(), reportedAt: new Date().toISOString(), studentBinding: null, evidenceRevisionIds: [], workspace: { kind: 'exam_selection_workspace', schemaVersion: 1, requirementRevision: 'elementary-written-24-100-v1', title, examDate: { state: 'unknown', reason: 'No date' }, timeZone: { state: 'unknown', reason: 'No zone' }, selections: [] }, candidates: [], sourceQualification: 'not_verified_by_workspace', teacherAccepted: false, printed: false, published: false, officialSaved: false };
}

async function intakeRefusal() {
  dom();
  const origin = 'https://synthetic-review.test', key = 'synthetic-only-session-key-012345678901234567890';
  const app = new TeacherApplication({} as any, scope.ownerId);
  const handler = createTeacherServerHandler({ app, origin, sessionKey: key, identity: { actorId: scope.actorId, username: 'synthetic', passwordHash: 'not-used-for-session' }, invitationDigest: null, saveIdentity: async () => { throw Error('not_used'); } });
  const payload = exam('x'.repeat(201)), state = workspaceDraft('review-invalid-' + crypto.randomUUID(), payload, null), form = document.createElement('div');
  form.append(document.createElement('textarea')); let observed: any;
  const write = async (path: string, input: unknown) => {
    const response = await handler(new Request(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: 'dc_teacher=' + signTeacherSession(key, scope.ownerId, scope.actorId), 'X-Teacher-Owner': scope.ownerId, 'X-Teacher-Actor': scope.actorId }, body: JSON.stringify(input) }));
    const reply = await response.json(); observed = { status: response.status, reply };
    // Match the actual client marker preservation in the successor; original server had no marker.
    if (!response.ok) throw Object.assign(Error(reply.error), { requestOutcome: reply.requestOutcome ?? null }); return reply;
  };
  workspaceControls(form, state, scope, null, '/api/owner-workspace', () => state.value, async () => { throw Error('workspace_result_not_found'); }, write as any);
  (form.querySelector('[data-role=workspace-save]') as HTMLButtonElement).click(); await tick();
  (form.querySelector('[data-role=workspace-recover]') as HTMLButtonElement).click(); await tick();
  return { observed, pendingRetained: !!state.pending, saveDisabled: (form.querySelector('[data-role=workspace-save]') as HTMLButtonElement).disabled, inputDisabled: form.querySelector('textarea')!.disabled, message: state.message };
}

async function lateCandidate() {
  const browser = dom(), payload = exam(), entityId = 'teacher-exam-selection-' + payload.draftId;
  let candidateResolve: any, saveResolve: any, wire: any;
  const read = async () => ({ rows: [{ entityId, payload, revisionId: 'synthetic-prior', sequence: 1 }] });
  const write = async (path: string, input: any) => {
    if (path === '/api/exam-candidate') return new Promise(resolve => { candidateResolve = () => resolve({ candidate: createExamCandidate(input) }); });
    if (path === '/api/owner-workspace') { wire = structuredClone(input); return new Promise(resolve => { saveResolve = () => resolve({ revisionId: 'synthetic-new', officialSaved: false, parentSent: false, record: { ownerId: scope.ownerId, actorId: scope.actorId, idempotencyKey: wire.idempotencyKey, previousRevisionId: wire.expectedRevisionId, revisionId: 'synthetic-new', sequence: 2, payload: wire.payload } }); }); }
    throw Error('unexpected');
  };
  const card = examWorkspaceView(scope, read as any, write as any); await tick(); const form = card.querySelector('[data-entity-id]') as HTMLElement;
  for (const [role, value] of [['candidate-id', 'synthetic-item'], ['candidate-reference', 'synthetic-reference']]) { const input = form.querySelector('[data-role=' + role + ']') as HTMLTextAreaElement; input.value = value!; input.dispatchEvent(new browser.window.Event('input')); }
  [...form.querySelectorAll('button')].find(button => button.textContent === '후보로 추가')!.click(); await tick();
  (form.querySelector('[data-role=workspace-save]') as HTMLButtonElement).click(); await tick();
  const state = workspaceDraft(JSON.stringify([scope, entityId]), payload, 'synthetic-prior', 1), before = JSON.stringify(state.pending!.input);
  candidateResolve(); await tick(); const after = JSON.stringify(state.pending!.input); saveResolve(); await tick();
  return { wireCandidateCount: wire.payload.candidates.length, pendingPayloadChangedAfterPost: before !== after, pendingRetainedAfterValidAck: !!state.pending, draftCandidateCount: state.value.candidates.length, dirty: state.dirty, message: state.message };
}

async function parentRebase() {
  dom();
  const student = { id: 'synthetic-review-student', displayName: 'Synthetic', sourceKey: { namespace: 'academy_student', literalKey: 'synthetic' }, proofRefs: ['synthetic'] };
  const payload = { kind: 'teacher_parent_draft', studentBinding: { studentId: student.id, sourceStudent: student.sourceKey }, sourceStudent: student.sourceKey, reportedAt: new Date().toISOString(), evidenceRevisionIds: ['old-basis'], date: '2025-01-02', state: 'reviewed', progress: [{ text: 'Synthetic wording reviewed against old source', evidenceRevisionIds: ['old-basis'] }], homework: [], memo: [], internalNote: '', teacherReviewed: true, officialSaved: false, parentSent: false, deliveryReceipt: 'unobserved' };
  const identity = workspaceEntityId(payload as any), prior = { entityId: identity, payload, revisionId: 'synthetic-prior', sequence: 1 };
  const scene = { student, teacherScope: scope, evidence: [{ payload: { kind: 'synthetic' }, revisionId: 'old-basis' }], books: [], preparation: { date: '2025-01-02' }, teacherWorkspaces: [prior] };
  const fresh = { ...scene, evidence: [{ payload: { kind: 'synthetic' }, revisionId: 'new-basis' }] };
  const card = teacherWorkspaceView(scene as any, async () => fresh as any, async () => { throw Error('stale_evidence_basis'); }), form = card.querySelector('#parent-draft .workspace-form') as HTMLElement;
  (form.querySelector('[data-role=workspace-save]') as HTMLButtonElement).click(); await tick();
  (form.querySelector('[data-role=workspace-reconcile]') as HTMLButtonElement).click(); await tick();
  const state = workspaceDraft(JSON.stringify([scope, student.id, identity]), payload, 'synthetic-prior', 1);
  return { lineBasis: state.value.progress[0].evidenceRevisionIds, state: state.value.state, teacherReviewed: state.value.teacherReviewed, reviewCheckboxChecked: (form.querySelector('[data-role=parent-reviewed]') as HTMLInputElement).checked, staleBlockCleared: !state.blocked };
}

test('a proven semantic intake refusal keeps the draft editable instead of pending forever',async()=>{const result=await intakeRefusal();expect(result.observed.status).toBe(400);expect(result.observed.reply).toMatchObject({error:'invalid_exam_text',requestOutcome:'rejected_before_commit'});expect(result.pendingRetained).toBe(false);expect(result.saveDisabled).toBe(false);expect(result.inputDisabled).toBe(false);});
test('a candidate reply after save cannot mutate the exact pending request and remains an unsaved edit after valid acknowledgement',async()=>{const result=await lateCandidate();expect(result.wireCandidateCount).toBe(0);expect(result.pendingPayloadChangedAfterPost).toBe(false);expect(result.pendingRetainedAfterValidAck).toBe(false);expect(result.draftCandidateCount).toBe(1);expect(result.dirty).toBe(true);expect(result.message).toContain('추가 수정은 아직 저장되지 않았습니다');});
test('rebasing a parent draft onto changed evidence preserves wording and invalidates the old teacher review',async()=>{const result=await parentRebase();expect(result.lineBasis).toEqual(['new-basis']);expect(result.state).toBe('draft');expect(result.teacherReviewed).toBe(false);expect(result.reviewCheckboxChecked).toBe(false);expect(result.staleBlockCleared).toBe(true);});

test('postcommit readback failure stays uncertain even when its error name resembles a precommit refusal',async()=>{
 dom();const origin='https://synthetic-postcommit.test',key='synthetic-only-postcommit-key-0123456789012345';let committed:any=null,posts=0,observed:any;
 const store={appendOwnerWorkspace:async(command:any)=>{committed={ownerId:command.ownerId,actorId:command.actorId,idempotencyKey:command.idempotencyKey,previousRevisionId:command.expectedRevisionId,revisionId:'synthetic-committed-revision',sequence:1,payload:command.payload};return {status:'saved',revisionId:committed.revisionId,sequence:1,officialSaved:false,parentSent:false};},ownerWorkspaceHistory:async()=>{throw Error('stale_base');},ownerWorkspaces:async()=>[],ownerWorkspaceResult:async()=>committed};
 const app=new TeacherApplication(store as any,scope.ownerId),handler=createTeacherServerHandler({app,origin,sessionKey:key,identity:{actorId:scope.actorId,username:'synthetic',passwordHash:'not-used'},invitationDigest:null,saveIdentity:async()=>{throw Error('unused');}}),headers={Cookie:'dc_teacher='+signTeacherSession(key,scope.ownerId,scope.actorId)};
 const decode=async(response:Response)=>{const reply=await response.json();if(!response.ok)throw Object.assign(Error(reply.error),{requestOutcome:reply.requestOutcome??null});return reply;};
 const write=async(path:string,input:any)=>{posts++;const response=await handler(new Request(origin+path,{method:'POST',headers:{...headers,Origin:origin,'Content-Type':'application/json','X-Teacher-Owner':scope.ownerId,'X-Teacher-Actor':scope.actorId},body:JSON.stringify(input)}));const reply=await response.clone().json();observed={status:response.status,reply};return decode(response);};
 const read=async(path:string)=>decode(await handler(new Request(origin+path,{headers}))),payload=exam(),state=workspaceDraft('postcommit-'+crypto.randomUUID(),payload,null),form=document.createElement('div');workspaceControls(form,state,scope,null,'/api/owner-workspace',()=>state.value,read as any,write as any);
 (form.querySelector('[data-role=workspace-save]') as HTMLButtonElement).click();await tick();expect(observed.status).toBe(503);expect(observed.reply.error).toBe('committed_outcome_uncertain');expect(observed.reply.requestOutcome).toBeUndefined();expect(state.pending).not.toBeNull();expect(posts).toBe(1);const original=JSON.stringify(state.pending!.input);
 (form.querySelector('[data-role=workspace-recover]') as HTMLButtonElement).click();await tick();expect(state.pending).toBeNull();expect(state.expectedRevisionId).toBe('synthetic-committed-revision');expect(posts).toBe(1);expect(JSON.parse(original).idempotencyKey).toBe(committed.idempotencyKey);
});
