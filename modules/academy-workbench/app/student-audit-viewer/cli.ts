import {readPinnedAudit,selectStudent} from './model.ts';
// Local OS-authorized file access only. No HTTP listener, credentials, writes,
// remote refresh, Sites or Space calls. Do not redirect output to public logs.
const [path,sha,id]=process.argv.slice(2);
if(!path||!sha){console.error('Usage: node cli.ts <private-audit.json> <sha256> [studentId]');process.exitCode=2;}
else{try{const audit=readPinnedAudit(path,sha);console.log(JSON.stringify(id?{student:selectStudent(audit,id),collectedAt:audit.collectedAt,sourceMode:'saved_audit'}:{collectedAt:audit.collectedAt,students:audit.students.map(s=>({studentId:s.studentId,name:s.name})),sourceMode:'saved_audit'},null,2));}catch{console.error('Invalid audit input, hash or student scope');process.exitCode=1;}}
