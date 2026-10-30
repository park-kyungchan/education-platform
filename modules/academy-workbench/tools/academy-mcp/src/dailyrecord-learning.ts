import {z} from 'zod';
import {readPinnedLocalBytes} from './item-label-store.ts';
import type {DailyRecordLearningPolicy} from './dailyrecord.ts';

const id=z.string().min(1).max(256),sha=z.string().regex(/^[a-f0-9]{64}$/);
const bridge=z.object({sourceNamespace:id,teacherId:id,studentId:id,retainedStudentRef:id}).strict();
const configSchema=z.object({schemaVersion:z.literal('academy.dailyrecord-learning-config/1'),catalogPath:z.string().min(1),catalogSha256:sha,students:z.array(bridge).min(1).max(1000)}).strict();
/** Explicit launch-time owner code/catalog pins. Tool callers cannot provide paths or executable code. */
export async function dailyRecordLearningConfiguration(args:readonly string[]){
  const remainingArgs:string[]=[];let learningPolicy:DailyRecordLearningPolicy|null=null;
  for(let i=0;i<args.length;i++){
    if(args[i]!=='--dailyrecord-learning'){remainingArgs.push(args[i]);continue;}
    if(learningPolicy||i+4>=args.length)throw Error('dailyrecord_learning_arguments_invalid');
    const [bundlePath,bundleSha256,configPath,configSha256]=args.slice(i+1,i+5);
    const bundle=await readPinnedLocalBytes(bundlePath,bundleSha256),configBytes=await readPinnedLocalBytes(configPath,configSha256);
    const config=configSchema.parse(JSON.parse(configBytes.bytes.toString('utf8')));
    const keys=config.students.map(s=>JSON.stringify([s.sourceNamespace,s.teacherId,s.studentId]));
    if(new Set(keys).size!==keys.length)throw Error('duplicate_learning_student_bridge');
    const catalog=await readPinnedLocalBytes(config.catalogPath,config.catalogSha256);
    // This is an explicit owner-selected pure JS bundle, like the existing pinned source-client port.
    // It is never imported from a user tool argument or model-supplied URL.
    const owner=await import('data:text/javascript;base64,'+bundle.bytes.toString('base64'));
    if(typeof owner.createDailyRecordLearningReviewer!=='function')throw Error('canonical_learning_owner_required');
    const reviewer=owner.createDailyRecordLearningReviewer(JSON.parse(catalog.bytes.toString('utf8')));
    if(reviewer.schemaVersion!=='academy.dailyrecord-learning-review/1'||typeof reviewer.review!=='function')throw Error('canonical_learning_contract_required');
    const retained=(scope:Readonly<{sourceNamespace:string;teacherId:string;studentId:string}>)=>
      config.students.find(s=>s.sourceNamespace===scope.sourceNamespace&&s.teacherId===scope.teacherId&&s.studentId===scope.studentId);
    learningPolicy={bundleSha256,configSha256,catalogSha256:config.catalogSha256,
      scopeQualified(scope){return !!retained(scope);},
      review(scope,value,entries){
        const student=retained(scope);
        if(!student)return ['student_namespace_bridge_unverified_ask_teacher'];
        try{
          const result=reviewer.review(student.retainedStudentRef,value,entries);
          if(!Array.isArray(result.blockers)||result.blockers.some((b:unknown)=>typeof b!=='string'||!/^[a-z][a-z0-9_]{0,100}$/.test(b)))return ['canonical_learning_result_unqualified'];
          return result.blockers as string[];
        }catch{return ['canonical_learning_review_unavailable'];}
      },
      suggest(scope,value,entries){
        const student=retained(scope);if(!student)return null;
        try{
          const result=reviewer.review(student.retainedStudentRef,value,entries);
          if(!Array.isArray(result.blockers)||result.blockers.length!==1||result.blockers[0]!=='learning_render_mismatch'
            ||typeof result.expected!=='string'||!result.expected.length||result.expected.length>8192
            ||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result.expected))return null;
          return result.expected;
        }catch{return null;}
      }};
    i+=4;
  }
  return {remainingArgs,learningPolicy};
}
