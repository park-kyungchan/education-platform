import {readRetainedDocument} from '../src/academy/retainedQueryClient';
import { SQL } from 'bun';
import { readFileSync } from 'node:fs';
import { PostgresAcademyStore } from '../src/academy/postgresStore';
import { TeacherApplication } from '../src/academy/application';
const home=process.env.HERMES_HOME;
if(home!=='/opt/data/profiles/dc-gang-a-dev')throw Error('active_profile_required');
const config=JSON.parse(readFileSync(home+'/academy/owner.json','utf8')) as {ownerId:string;postgresSocket:string;database:string};
const args=process.argv.slice(2);
if(args[0]==='--help'||args.length===0){console.log(JSON.stringify({command:'bun run academy:query',operations:['cohort','student --id <opaque-id>','student --name <literal-current-name>'],authority:'trusted_local_operator_only_not_HTTP_authentication',sourceEffect:'read_only',output:'private_teacher_result_never_publish_real_values'}));process.exit(0);}
if(!['cohort','student'].includes(args[0]!))throw Error('unknown_product_query');
const db=new SQL({adapter:'postgres',path:config.postgresSocket,username:'hermes',database:config.database,max:2});
try{
  const app=new TeacherApplication(new PostgresAcademyStore(db),config.ownerId);
  const actor={ownerId:config.ownerId,actorId:'native-owner-query',role:'teacher' as const};
  if(args[0]==='cohort'){if(args.length!==1)throw Error('unexpected_query_field');console.log(JSON.stringify(await readRetainedDocument({kind:'cohort'},request=>app.retainedQuery(actor,request))));}
  else{
    if(args.length!==3||!['--id','--name'].includes(args[1]!))throw Error('student_selector_required');
    let id=args[2]!;
    if(args[1]==='--name'){
      const matches=(await app.store.students(config.ownerId)).filter(student=>student.displayName===id);
      if(matches.length!==1)throw Error('unknown_or_ambiguous_student_name');id=matches[0]!.id;
    }
    console.log(JSON.stringify(await readRetainedDocument({kind:'student',studentId:id,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())},request=>app.retainedQuery(actor,request))));
  }
}finally{await db.close();}
