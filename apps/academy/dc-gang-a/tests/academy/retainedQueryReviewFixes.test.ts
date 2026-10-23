import {afterEach,expect,test} from 'bun:test';
import {JSDOM} from 'jsdom';
import {retainedFixture} from './retainedQueryFixtures';
import {readRetainedDocument} from '../../src/academy/retainedQueryClient';
import {teacherWorkspaceView} from '../../src/academy/web/teacherWorkspaceView';
import {workspaceDraft,workspaceDraftKey} from '../../src/academy/web/workspaceEditor';
import {workspaceEntityId} from '../../src/academy/teacherWorkspace';
import {canonicalJson} from '../../src/learning/model';
import type {StudentLearningScene} from '../../src/academy/contracts/teacherOperations';

let browser:JSDOM|null=null,priorDocument:PropertyDescriptor|undefined;
afterEach(()=>{if(browser){browser.window.close();browser=null;if(priorDocument)Object.defineProperty(globalThis,'document',priorDocument);else delete (globalThis as any).document;}});
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
async function views(){
  browser=new JSDOM('<!doctype html><html><body></body></html>');priorDocument=Object.getOwnPropertyDescriptor(globalThis,'document');(globalThis as any).document=browser.window.document;
  const f=retainedFixture(1,0),legacy=await f.app.student(f.actor,f.student.id,f.date),retained=await readRetainedDocument<StudentLearningScene>({kind:'student',studentId:f.student.id,date:f.date},input=>f.app.retainedQuery(f.actor,input));
  const owner='synthetic-scope-'+crypto.randomUUID(),actor='synthetic-actor';legacy.teacherScope={ownerId:owner,actorId:actor};retained.teacherScope={actorId:actor,ownerId:owner};
  return {legacy,retained};
}
function identity(scene:StudentLearningScene,kind:'activity'|'parent'){
  return workspaceEntityId(kind==='activity'?{kind:'teacher_activity_review',assignmentRevisionId:'work-A-r1'} as any:{kind:'teacher_parent_draft',date:scene.preparation.date,sourceStudent:scene.student.sourceKey} as any);
}
function form(card:HTMLElement,kind:'activity'|'parent'){
  const selector=kind==='activity'?'[data-activity-assignment="work-A-r1"] .workspace-form':'#parent-draft .workspace-form';return card.querySelector<HTMLElement>(selector)!;
}
const role=(kind:'activity'|'parent')=>kind==='activity'?'final-note':'parent-progress';
test.each(['activity','parent'] as const)('F1 actual %s view reconciles reordered scope and preserves edited text with legacy recovery keys',async kind=>{
  const {legacy,retained}=await views();let writes=0;
  const read=async()=>legacy,write=async()=>{writes++;throw Error('stale_base');};
  const card=teacherWorkspaceView(retained,read as any,write),current=form(card,kind),input=current.querySelector<HTMLTextAreaElement>('[data-role='+role(kind)+']')!;
  input.value='Invented unsaved wording';input.dispatchEvent(new browser!.window.Event('input'));
  current.querySelector<HTMLButtonElement>('[data-role=workspace-save]')!.click();await tick();
  const id=identity(retained,kind),state=workspaceDraft(workspaceDraftKey(retained.teacherScope,retained.student.id,id),{},null);expect(state.blocked).toBe(true);
  current.querySelector<HTMLButtonElement>('[data-role=workspace-reconcile]')!.click();await tick();expect(state.blocked).toBe(false);expect(state.message).not.toContain('teacher_scene_actor_conflict');
  const adopted=teacherWorkspaceView(legacy,read as any,write),adoptedInput=form(adopted,kind).querySelector<HTMLTextAreaElement>('[data-role='+role(kind)+']')!;expect(adoptedInput.value).toBe('Invented unsaved wording');
  expect(workspaceDraft(JSON.stringify([legacy.teacherScope,legacy.student.id,id]),{},null)).toBe(state);expect(writes).toBe(1);
  if(kind==='parent'){expect(state.value.officialSaved).toBe(false);expect(state.value.parentSent).toBe(false);expect(state.value.teacherReviewed).toBe(false);}
});
test.each(['activity','parent'] as const)('F1 actual %s view preserves the identical pending request across retained and legacy scenes',async kind=>{
  const {legacy,retained}=await views();let writes=0;
  const write=async()=>{writes++;throw Error('synthetic_response_uncertain');};
  const card=teacherWorkspaceView(retained,async()=>legacy as any,write),current=form(card,kind),input=current.querySelector<HTMLTextAreaElement>('[data-role='+role(kind)+']')!;
  input.value='Invented pending wording';input.dispatchEvent(new browser!.window.Event('input'));current.querySelector<HTMLButtonElement>('[data-role=workspace-save]')!.click();await tick();
  const id=identity(retained,kind),state=workspaceDraft(workspaceDraftKey(retained.teacherScope,retained.student.id,id),{},null),pending=state.pending;expect(pending).not.toBeNull();const original=canonicalJson(pending!.input);
  const next=teacherWorkspaceView(legacy,async()=>legacy as any,write),nextForm=form(next,kind);
  expect(workspaceDraft(JSON.stringify([legacy.teacherScope,legacy.student.id,id]),{},null).pending).toBe(pending);expect(canonicalJson(state.pending!.input)).toBe(original);
  expect(nextForm.querySelector<HTMLTextAreaElement>('[data-role='+role(kind)+']')!.value).toBe('Invented pending wording');expect(nextForm.querySelector<HTMLButtonElement>('[data-role=workspace-save]')!.disabled).toBe(true);expect(writes).toBe(1);
});
test.each(['ownerId','actorId'] as const)('F1 actual view still refuses genuinely changed %s and keeps draft scopes separate',async field=>{
  const {legacy,retained}=await views(),fresh=structuredClone(legacy);fresh.teacherScope[field]='synthetic-other';
  const card=teacherWorkspaceView(retained,async()=>fresh as any,async()=>{throw Error('stale_base');}),current=form(card,'activity');current.querySelector<HTMLButtonElement>('[data-role=workspace-save]')!.click();await tick();current.querySelector<HTMLButtonElement>('[data-role=workspace-reconcile]')!.click();await tick();
  const id=identity(retained,'activity'),state=workspaceDraft(workspaceDraftKey(retained.teacherScope,retained.student.id,id),{},null);expect(state.blocked).toBe(true);expect(state.message).toContain('teacher_scene_actor_conflict');
  expect(workspaceDraft(workspaceDraftKey(fresh.teacherScope,fresh.student.id,id),{},null)).not.toBe(state);
});

const malformedPages:[string,(page:any)=>void][]=[
  ['exhausted string false',p=>p.page.exhausted='false'],['exhausted string true',p=>p.page.exhausted='true'],
  ['missing binding',p=>delete p.callerBinding],['bad binding',p=>p.callerBinding='invented'],['missing coverage',p=>delete p.coverage],
  ['missing effects',p=>delete p.effects],['source writes',p=>p.effects.sourceWrites=true],['source acquisition',p=>p.effects.sourceAcquisition=true],['parent send',p=>p.effects.parentSends=true],
  ['empty clock',p=>p.retrievedAt=''],['invalid clock',p=>p.retrievedAt='2090-02-30T01:00:00Z'],['clock wrong scalar',p=>p.retrievedAt=42],
  ['missing coverage clock',p=>delete p.coverage.clocks],['false authoritative currentness',p=>p.coverage.authoritativeCurrentness='current'],['missing effect flag',p=>delete p.effects.sourceWrites],
  ['unsafe total',p=>p.page.totalRecords=Number.MAX_SAFE_INTEGER+1],['infinite total',p=>p.page.totalRecords=Infinity],['fractional offset',p=>p.page.offset=0.5],['returned string',p=>p.page.returned=String(p.page.returned)],
  ['negative source count',p=>p.coverage.sourceRowCount=-1],['missing cursor',p=>delete p.page.nextCursor],['contradictory cursor',p=>p.page.nextCursor='invented.cursor'],['fractional max bytes',p=>p.page.maxBytes=65536.5],
  ['missing selector date',p=>p.selector={kind:'student',studentId:'synthetic'}],['unknown metadata',p=>p.untrustedOriginal='synthetic-private-marker'],['wrong record kind',p=>p.records[0].kind='unknown'],
];
function measured(page:any){let bytes=Buffer.byteLength(JSON.stringify(page));while(bytes!==page.page.serializedBytes){page.page.serializedBytes=bytes;bytes=Buffer.byteLength(JSON.stringify(page));}return page;}
test.each(malformedPages)('F2 rejects %s with correct JSON byte count and unchanged valid document hash',async(_name,change)=>{
  const f=retainedFixture(1,0),selector={kind:'cohort'} as const,valid=await f.app.retainedQuery(f.actor,{selector,limit:250,maxBytes:65536});if(valid.status!=='page')throw Error('genuine page required');
  const changed=structuredClone(valid);change(changed);measured(changed);expect(changed.snapshot).toBe(valid.snapshot);
  await expect(readRetainedDocument(selector,async()=>changed)).rejects.toThrow(/^retained_page_contract_conflict$/);
});
test.each([
  {schema:'academy.retained-query.v1',status:'refused',code:'synthetic-private-marker',records:[],automaticRetry:false},
  {schema:'academy.retained-query.v1',status:'refused',code:'retained_query_unavailable',records:[],automaticRetry:true},
  {schema:'academy.retained-query.v1',status:'refused',code:'retained_query_unavailable',records:[{}],automaticRetry:false},
])('F2 rejects malformed refusal without echoing its fields',async value=>{
  await expect(readRetainedDocument({kind:'cohort'},async()=>value as any)).rejects.toThrow(/^retained_page_contract_conflict$/);
});
test('F2 genuine refusal keeps its bounded code and never returns a retained document',async()=>{
  await expect(readRetainedDocument({kind:'cohort'},async()=>({schema:'academy.retained-query.v1',status:'refused',code:'retained_query_unavailable',records:[],automaticRetry:false}))).rejects.toThrow(/^retained_query_unavailable$/);
});
