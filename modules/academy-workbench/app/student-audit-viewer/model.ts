import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
export type Row=Record<string,unknown>;
export interface Student extends Row {studentId:string;name:string;books:Row[];sections:Row[];}
export interface Audit extends Row {schemaVersion:'academy.audit.normalized/1.0.0';collectedAt:string;students:Student[];}
export function parseAudit(text:string):Audit {
 const x=JSON.parse(text);
 if(x?.schemaVersion!=='academy.audit.normalized/1.0.0'||typeof x.collectedAt!=='string'||!Array.isArray(x.students)||x.students.length!==5)throw Error('audit_schema_or_roster_invalid');
 const ids=new Set();
 for(const s of x.students){if(!s||typeof s.studentId!=='string'||!s.studentId||s.studentId.length>256||ids.has(s.studentId)||typeof s.name!=='string'||!Array.isArray(s.books)||!Array.isArray(s.sections))throw Error('student_scope_invalid');ids.add(s.studentId);}
 return x;
}
export function readPinnedAudit(path:string,expectedSha256:string):Audit {
 if(!/^[a-f0-9]{64}$/.test(expectedSha256))throw Error('explicit_audit_sha256_required');
 const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32*1024*1024)throw Error('audit_file_invalid');
 const bytes=readFileSync(path);if(createHash('sha256').update(bytes).digest('hex')!==expectedSha256)throw Error('audit_hash_mismatch');
 return parseAudit(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export function selectStudent(audit:Audit,id:string):Student {
 const s=audit.students.find(s=>s.studentId===id);if(!s)throw Error('student_outside_managed_scope');return s;
}
// Historical Page IDs are immutable provenance, not runtime locators. A local
// JSON pointer refers to the exact hash-checked audit supplied by the operator.
export interface ReferenceMap {schemaVersion:'academy.local-source-reference-map/1';entries:Record<string,Row>;}
export function archiveReference(student:Student,map?:ReferenceMap){
 const match=typeof student.pageUrl==='string'?/^https:\/\/chatgpt\.com\/space\/(page_[a-f0-9]+)$/.exec(student.pageUrl):null;
 if(!match||!map)return {state:'not_resolved',runtimeDependency:'none'};
 const item=map.entries[match[1]];
 if(!item||item.kind!=='archived_page'||item.originalPageId!==match[1]||item.runtimeDependency!=='none'||typeof item.relativePath!=='string'||!/^private\/space-migration-[0-9]+\/pages\/page_[a-f0-9]+\.json$/.test(item.relativePath)||typeof item.sha256!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256))return {state:'not_resolved',runtimeDependency:'none'};
 return {state:'archived_reference_declared',relativePath:item.relativePath,sha256:item.sha256,originalPageId:match[1],runtimeDependency:'none',archiveBytesReverifiedHere:false};
}
export function referenceFor(audit:Audit,id:string,sha256:string,map?:ReferenceMap){
 const student=selectStudent(audit,id);return {kind:'local_pinned_audit',sha256,jsonPointer:'/students/'+audit.students.indexOf(student),historicalPageReference:typeof student.pageUrl==='string'?student.pageUrl:null,externalFetch:false,currentSpaceRequired:false,archive:archiveReference(student,map)};
}
