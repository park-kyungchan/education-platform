import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {readPinnedLocalBytes} from './item-label-store.ts';
import {dailyRecordObservationSchema,type DailyRecordReadBackend,type DailyRecordObservation} from './dailyrecord.ts';
import type {DailyRecordScope} from './dailyrecord-context.ts';

const home='/opt/data/profiles/dc-gang-a-dev';
const key=z.string().regex(/^[1-9][0-9]{0,15}$/),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const nativeDailyRecordConfigSchema=z.object({schemaVersion:z.literal('academy.native-dailyrecord-read/1'),
  sourceBundlePath:z.string().startsWith('/'),sourceBundleSha256:hash,
  date:z.iso.date(),students:z.array(z.object({studentId:key,displayName:z.string().min(1).max(200)}).strict()).min(1).max(8),
}).strict().superRefine((v,c)=>{
  if(new Set(v.students.map(s=>s.studentId)).size!==v.students.length||new Set(v.students.map(s=>s.displayName)).size!==v.students.length)
    c.addIssue({code:'custom',message:'unique_admitted_students_required'});
});
type Target={studentName:string;date:string;groupId:string;teacherKey:string;studentKey:string;courseKey:string;recordKey:string;membershipKey:string};
type Row=Target&{fields:Record<string,string>};
interface SourcePort {
  authenticate(credential:{username:string;password:string}):Promise<unknown>;
  discoverDayRecordGroups(input:{teacherLabel:string;date:string}):Promise<{groups:{groupId:string}[]}>;
  execute(input:unknown):Promise<{dayRecords:Row[]}>;
  journalState(target:Target):Promise<{target:Target;fields:Record<string,string>;previousRecordKey:string;previousDate:string;wireDigest:string}>;
  close():void;
}
type Admission={teacherId:string;teacherLabel:string;date:string;students:{studentId:string;displayName:string}[];sourceBundleSha256:string};
const fields=['progress','homework','lessonMemo','attendance','dailyTestAssessment','previousHomeworkAssessment'] as const;
const targetOf=(row:Target):Target=>Object.fromEntries(['studentName','date','groupId','teacherKey','studentKey','courseKey','recordKey','membershipKey'].map(k=>[k,row[k as keyof Target]])) as Target;
const observationTarget=(t:Target):DailyRecordObservation['target']=>({sourceNamespace:'academy.lms.dayrecord',teacherId:t.teacherKey,studentId:t.studentKey,lessonDate:t.date,courseId:t.courseKey,membershipId:t.membershipKey,recordId:t.recordKey});

/** Consumer transport glue. The existing Education client owns authentication, parsing,
 * source/wire qualification and independent occurrence binding. This port never writes. */
export class NativeDailyRecordBackend implements DailyRecordReadBackend {
  #ready:Promise<unknown>|undefined;
  constructor(readonly client:SourcePort,readonly admission:Admission,readonly credential:()=>{username:string;password:string}){}
  async readDailyRecord(scope:Readonly<DailyRecordScope>){
    const student=this.admission.students.find(s=>s.studentId===scope.studentId);
    if(scope.sourceNamespace!=='academy.lms.dayrecord'||scope.teacherId!==this.admission.teacherId
      ||scope.lessonDate!==this.admission.date||!student)throw Error('native_dailyrecord_scope_refused');
    // Keep a failed authentication promise: subsequent calls must not retry login.
    this.#ready??=this.client.authenticate(this.credential());await this.#ready;
    const selector=await this.client.discoverDayRecordGroups({teacherLabel:this.admission.teacherLabel,date:scope.lessonDate});
    const request={family:'day_record',teacherLabel:this.admission.teacherLabel,date:scope.lessonDate,
      groupIds:selector.groups.map(g=>g.groupId),studentNames:[student.displayName]};
    const result=await this.client.execute(request);
    if(result.dayRecords.length!==1)throw Error('native_dailyrecord_occurrence_unverified');
    const row=result.dayRecords[0]!;
    if(row.studentKey!==scope.studentId||row.studentName!==student.displayName||row.teacherKey!==scope.teacherId||row.date!==scope.lessonDate)
      throw Error('native_dailyrecord_identity_conflict');
    const state=await this.client.journalState(targetOf(row));
    if(JSON.stringify(targetOf(state.target))!==JSON.stringify(targetOf(row)))throw Error('native_dailyrecord_state_conflict');
    const previous=await this.client.execute({...request,date:state.previousDate,groupIds:[row.groupId]});
    if(previous.dayRecords.length!==1)throw Error('native_dailyrecord_previous_unverified');
    const prior=previous.dayRecords[0]!;
    if(prior.studentKey!==row.studentKey||prior.teacherKey!==row.teacherKey||prior.courseKey!==row.courseKey
      ||prior.membershipKey!==row.membershipKey||prior.recordKey!==state.previousRecordKey||prior.date!==state.previousDate)
      throw Error('native_dailyrecord_previous_conflict');
    const observedAt=new Date().toISOString(),ref='native-dayrecord-read:'+randomUUID();
    const tone=[prior.fields.progress,prior.fields.homework,prior.fields.lessonMemo].filter(Boolean).join('\n');
    const observation=dailyRecordObservationSchema.parse({scope,target:observationTarget(row),previousTarget:observationTarget(prior),observedAt,
      sourceRevision:createHash('sha256').update(this.admission.sourceBundleSha256+':'+state.wireDigest).digest('hex'),wireDigest:state.wireDigest,
      fields:Object.fromEntries(fields.map(field=>[field,typeof state.fields[field]==='string'
        ?{state:'known',value:state.fields[field],evidenceRefs:[ref+(field==='previousHomeworkAssessment'?':previous':':current')]}
        :{state:'unknown',reasonCode:'native_field_not_observed'}])),
      toneSamples:tone?[{target:observationTarget(prior),observedAt,text:tone,evidenceRefs:[ref+':previous']}]:[],transmissionState:'unknown'});
    return {status:'observed' as const,observation};
  }
}

export async function nativeDailyRecordConfiguration(args:readonly string[]){
  if(!args.length)return null;
  if(args.length!==3||args[0]!=='--dailyrecord-native')throw Error('dailyrecord_native_arguments_invalid');
  if(process.getuid?.()!==10000||process.env.HERMES_HOME!==home)throw Error('native_dailyrecord_owner_required');
  const configPath=resolve(args[1]!),stat=lstatSync(configPath);
  if(!configPath.startsWith(home+'/artifacts/')||realpathSync(dirname(configPath))!==dirname(configPath)
    ||stat.uid!==10000||(stat.mode&0o077)!==0||!stat.isFile()||stat.isSymbolicLink())throw Error('native_dailyrecord_private_config_required');
  const pinned=await readPinnedLocalBytes(configPath,hash.parse(args[2]));
  const config=nativeDailyRecordConfigSchema.parse(JSON.parse(pinned.bytes.toString('utf8')));
  const owner=JSON.parse(readFileSync(home+'/academy/owner.json','utf8'));
  if(config.students.some(s=>!owner.expectedStudentNames.includes(s.displayName)))throw Error('native_dailyrecord_managed_student_required');
  const bundle=await readPinnedLocalBytes(config.sourceBundlePath,config.sourceBundleSha256);
  const jsdom='/opt/data/workspace/dc-gang-a/node_modules/jsdom/lib/api.js';
  const dependency=JSON.parse(readFileSync(resolve(jsdom,'../../package.json'),'utf8'));
  if(dependency.version!=='30.1.2')throw Error('native_dailyrecord_dependency_drift');
  const source=bundle.bytes.toString('utf8');
  if(source.split('from "jsdom"').length!==2)throw Error('native_dailyrecord_bundle_contract_rejected');
  // Import the exact verified bytes; never reopen a mutable source pathname for execution.
  const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace('from "jsdom"','from '+JSON.stringify(pathToFileURL(jsdom).href))).toString('base64'));
  if(typeof module.AcademyHttpClient!=='function')throw Error('native_dailyrecord_client_required');
  const password=process.env.DC_ACADEMY_HTTP_PASSWORD;delete process.env.DC_ACADEMY_HTTP_PASSWORD;
  if(!password)throw Error('native_http_secret_required');
  const client=new module.AcademyHttpClient({teacherLabel:owner.teacherLabel,teacherKey:owner.teacherSourceKey,collegeKey:owner.collegeSourceKey}) as SourcePort;
  const backend=new NativeDailyRecordBackend(client,{teacherId:owner.teacherSourceKey,teacherLabel:owner.teacherLabel,
    date:config.date,students:config.students,sourceBundleSha256:config.sourceBundleSha256},()=>({username:owner.sourceUsername,password}));
  return {backend,close:()=>client.close()};
}
