import type {DailyRecordContext} from '../src/dailyrecord-context.ts';
import type {DailyRecordObservation,DailyRecordParentSafeguard,DailyRecordReadBackend,DailyRecordLearningPolicy} from '../src/dailyrecord.ts';

// Purpose-built fictional identities and dates; never sampled from runtime records.
export const clock=Date.parse('2040-01-16T09:00:00Z');
export const scope={sourceNamespace:'fictional-academy',teacherId:'teacher-synthetic',studentId:'student-synthetic',lessonDate:'2040-01-16'};
export function fact(field:DailyRecordContext['selectedFields'][number],text:string){return {ref:'user-fact:'+field,field,text,origin:'user_supplied' as const,requiredFragments:[],questionCounts:[],deadlines:[],stageClaims:[]};}
export function context():DailyRecordContext{return {schemaVersion:'academy.dailyrecord-user-context/1',purpose:'Review one fictional student lesson for parent readability.',currentRequestRef:'synthetic-current-user-request',scope:{...scope},selectedFields:['progress'],memoAnswer:{kind:'no_addition',requestRef:'synthetic-memo-answer'},facts:[fact('progress','지정 문제 12문항 풀이 진행.')]};}
const known=(value:string)=>({state:'known' as const,value,evidenceRefs:['synthetic-source-evidence']});
export function observation():DailyRecordObservation{
  const target={...scope,courseId:'course-synthetic',membershipId:'membership-synthetic',recordId:'current-record-synthetic'};
  return {scope:{...scope},target,previousTarget:{...target,lessonDate:'2040-01-14',recordId:'previous-record-synthetic'},observedAt:new Date(clock).toISOString(),sourceRevision:'1'.repeat(64),wireDigest:'2'.repeat(64),
    fields:{progress:known('기존 사용자 진도 문안'),homework:known('기존 사용자 숙제 문안'),lessonMemo:known('기존 준비물 안내'),attendance:known('Y'),dailyTestAssessment:known('8'),previousHomeworkAssessment:known('4')},
    toneSamples:[{target:{...target,lessonDate:'2040-01-12',recordId:'past-record-synthetic'},observedAt:new Date(clock).toISOString(),text:'- 지정 문제 풀이 진행.',evidenceRefs:['synthetic-tone-source']}],transmissionState:'not_sent'};
}
export function backend(read:()=>DailyRecordObservation=observation):DailyRecordReadBackend{return {async readDailyRecord(){return {status:'observed',observation:read()};}};}
export const safeguard:DailyRecordParentSafeguard={policySha256:'3'.repeat(64),safeguardSourceSha256:'4'.repeat(64),sourceRef:'synthetic-safeguard',checkLines:text=>/^- [^\r\n]+(?:\n- [^\r\n]+)*$/.test(text),check:text=>/교사\s*(?:최종\s*)?완료\s*판정|최종 승인 대기/.test(text)};
export function proposal(field:DailyRecordContext['selectedFields'][number],value:string){return {field,value:['progress','homework','lessonMemo'].includes(field)&&value&&!value.startsWith('- ')?'- '+value:value,factRefs:['user-fact:'+field],decision:{kind:'replace' as const,requestRef:'synthetic-current-user-request'}};}

// Stub only for pre-existing narrative/fact tests; canonical integration has separate owner-bundle tests.
export const learningPolicy:DailyRecordLearningPolicy={bundleSha256:'5'.repeat(64),configSha256:'6'.repeat(64),catalogSha256:'7'.repeat(64),review:()=>[]};
