import { mkdir, readFile, writeFile }  from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { loadPlatform, moduleRoot, sha256 } from './agent-platform';
export async function prepareContext(options: { initialize?: boolean; root?: string } = {}) {
  const owningRoot = options.root ?? moduleRoot;
  const platform = await loadPlatform();
  const selection = JSON.parse(await readFile(resolve(owningRoot,'harness/work-context.json'),'utf8'));
  const records = JSON.parse(await readFile(resolve(owningRoot,'harness/records.json'),'utf8'));
  for(const record of records){const checked=platform.validateArtifact(record);if(!checked.valid)throw Error('Invalid canonical record: '+record.id);}
  if(!platform.validateReferences(records).valid)throw Error('Invalid canonical reference set');
  const allowed=['projectId','workId','taskRef','runRef','verificationRef','kind','authority','nativePermissionGranted','checkpointProjection','historicalEffectsStatus','acceptanceDecisionObserved','note'];
  if(Object.keys(selection).some(k=>!allowed.includes(k))||selection.kind!=='module-owned-work-selection'||selection.authority!=='none'||selection.nativePermissionGranted!==false||selection.acceptanceDecisionObserved!==false)throw Error('Invalid local Work selection authority or fields');
  const task = records.find((r:any) => r.id === selection.taskRef);
  const run = records.find((r:any) => r.id === selection.runRef);
  const verification = records.find((r:any) => r.id === selection.verificationRef);
  const project = records.find((r:any)=>r.kind==='project');
  if(!project||project.projectId!==selection.projectId||task?.kind!=='task'||run?.kind!=='run'||verification?.kind!=='verification'||[task,run,verification].some(r=>r.projectId!==selection.projectId)||run.payload.taskRef!==task.id||!verification.payload.targetRefs.includes(task.id)||!run.payload.verificationRefs.includes(verification.id)||!task.payload.verificationRefs.includes(verification.id)||task.payload.details?.workId!==selection.workId||run.payload.details?.workId!==selection.workId)throw Error('Local Work selection joins do not match canonical Project/Task/Run/Verification');
  const intentLock = JSON.parse(await readFile(resolve(owningRoot,'harness/user-intent.lock.json'),'utf8'));
  const userMessages: string[] = intentLock.pins.map((p:any) => p.messageId);
  const pins = await Promise.all(intentLock.pins.map(async(p:any) => {
    const path=resolve(owningRoot,p.relativePath);
    if (!path.startsWith(owningRoot + '/')) throw Error('User-answer source outside owner root');
    if (sha256(await platform.readExact(path,owningRoot,platform.localContextIo)) !== p.sha256) throw Error(`User-answer source drift: ${p.messageId}`);
    return {path,sha256:p.sha256,role:'user-answer'};
  }));
  const checkpoint = {
    schema:'codex.continuity.checkpoint.v1',projectId:selection.projectId,workId:selection.workId,root:owningRoot,
    owner:{agentId:'math-research-module',threadId:'module-owned-portable-work-record'},version:1,updatedAt:new Date().toISOString(),
    purpose:{objective:task.payload.objective,successCriteria:task.payload.acceptanceCriteria,inScope:['standalone research UI','source preservation','module-owned Work/Artifact records','research identity pilot'],outOfScope:['native permissions','global registration','student database','empirical learning-effect claims','automatic acceptance']},
    userDecisions:await Promise.all(pins.map(async(p,i)=>({id:userMessages[i],answer:(await readFile(p.path,'utf8')).trim(),status:'accepted',source:{...p,kind:'actual-user-answer',locator:userMessages[i]}}))),
    completed:[],pending:[{id:selection.taskRef,action:'Check the current verification criteria and finish only authorized pending scope.',dependsOn:[],status:'unknown'}],
    nextAction:{taskId:selection.taskRef,action:'Read harness/current-handoff.json and docs/CONTINUE.ko.md before selecting or creating a Work; historical publication was observed separately.'},
    nativeThreads:[],evidenceRefs:[],sourcePins:pins,
    uncertainEffects:[{id:'historical-native-effects-unverified',action:'Previously reported native or remote work outside this local implementation',reason:'Not re-observed in this module run; empty completed is not proof of no historical effects.',requiredObservation:'Read exact owning Work and pinned evidence before any replay.'}],
    uninterpretedInputs:[],authority:'none',nativePermissionGranted:false
  };
  const checkpointPath=resolve(owningRoot,'.local/work-context/checkpoint.json');
  let bytes: string | undefined;
  try { bytes = new TextDecoder('utf-8',{fatal:true}).decode(await platform.readExact(checkpointPath,owningRoot,platform.localContextIo)); } catch(error:any) { if(error.code !== 'ENOENT') throw error; }
  const current = bytes !== undefined ? JSON.parse(bytes) : checkpoint;
  platform.validateCheckpoint(current);
  if(current.root !== owningRoot || current.projectId !== selection.projectId || current.workId !== selection.workId) throw Error('Existing Work checkpoint belongs to another root or Work; no reset performed.');
  const sourceStatus=await platform.checkSources(current.sourcePins,owningRoot,platform.localContextIo);
  if(sourceStatus.status!=='current')throw Error(`Existing checkpoint source check failed: ${JSON.stringify(sourceStatus.repair)}`);
  for(const decision of current.userDecisions){
    const admitted=pins.find((p:any)=>p.path===decision.source.path&&p.sha256===decision.source.sha256);
    if(!admitted)throw Error('Existing user decision is not in the reviewed source manifest');
    const original=(await readFile(admitted.path,'utf8')).trim();
    const identity=intentLock.pins.find((p:any)=>resolve(owningRoot,p.relativePath)===admitted.path);
    if(decision.answer!==original||decision.source.locator!==identity.messageId)throw Error('User decision differs from admitted original answer/locator');
  }
  const projectedBytes = bytes ?? JSON.stringify(current,null,2)+'\n';
  const request={schema:'codex.work-context.request.v1',projectId:selection.projectId,workId:selection.workId,root:owningRoot,cwd:owningRoot,checkpointPath,checkpointSha256:sha256(projectedBytes),maxChars:12000};
  platform.validateWorkContextRequest(request);
  if(bytes === undefined && options.initialize){
    const directory=resolve(owningRoot,'.local/work-context');
    let ancestor=directory;
    for(;;){
      try{if(await platform.localContextIo.canonical(ancestor)!==ancestor)throw Error('Unsafe checkpoint initialization symlink');break;}
      catch(error:any){if(error.code!=='ENOENT')throw error;const parent=dirname(ancestor);if(parent===ancestor||!parent.startsWith(owningRoot))throw Error('Unsafe checkpoint initialization root');ancestor=parent;}
    }
    await mkdir(directory,{recursive:true});
    if(await platform.localContextIo.canonical(directory)!==directory)throw Error('Unsafe checkpoint initialization directory');
    await writeFile(checkpointPath,projectedBytes,{flag:'wx'});
  }
  return {checkpoint:current,request,source:platform.source,persisted:bytes !== undefined||!!options.initialize};
}

if(import.meta.main){const result=await prepareContext({initialize:process.argv.includes('--initialize')});console.log(JSON.stringify(result.request,null,2));}
