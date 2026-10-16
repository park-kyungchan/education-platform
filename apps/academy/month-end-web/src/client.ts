import {createApplication} from '../../month-end-workbench/src/application';
import {createSyntheticSourcePort} from '../../month-end-workbench/src/synthetic';
import type {Application, ApplicationState, Projection} from '../../month-end-workbench/src/contracts';

export interface Bootstrap {schema:'month-end.web.v2';projection:Projection;delivery:'http'|'standalone'}
export function readBootstrap():Bootstrap{const data:Bootstrap=JSON.parse(document.querySelector('#preview-data')?.textContent??'null');if(data?.schema!=='month-end.web.v2'||data.projection?.schema!=='month-end.research-projection.v1'||data.projection.authority.grantsExecution!==false)throw Error('검토 자료의 형식과 실행 경계를 확인할 수 없습니다.');return data;}
/** Pure application is shared with the server; HTTP owns source access and session validation. */
export async function createClient(bootstrap:Bootstrap,synthetic=false):Promise<Application>{
 const local=createApplication(bootstrap.projection,synthetic?createSyntheticSourcePort():undefined);
 if(bootstrap.delivery==='standalone'||location.protocol==='file:')return local;
 let state=local.snapshot();
 const request=async<T>(path:string,body?:unknown):Promise<T>=>{const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json','x-month-end-csrf':token},...(body===undefined?{}:{body:JSON.stringify(body)})});const envelope=await response.json();if(!response.ok||envelope.ok!==true)throw Error(envelope.error??'자료를 읽지 못했습니다.');return envelope.data as T;};
 const {csrfToken:token}=await request<{csrfToken:string}>('/api/session');
 const update=async(path:string,body:unknown)=>state=await request<ApplicationState>(path,body);
 return {context:()=>request('/api/context'),research:({typeId})=>request('/api/research?typeId='+encodeURIComponent(typeId)),navigate:pathIds=>request('/api/navigation?path='+encodeURIComponent(pathIds.join(','))),setScope:scope=>update('/api/study-scope',scope),study:report=>update('/api/study',report),intent:intent=>update('/api/intent',intent),sourceScope:async input=>{const result=await request<Awaited<ReturnType<Application['sourceScope']>>>('/api/scope',input);state=await request<ApplicationState>('/api/state');return result;},find:async input=>{const result=await request<Awaited<ReturnType<Application['find']>>>('/api/find',input);state=await request<ApplicationState>('/api/state');return result;},review:async input=>{const result=await request<Awaited<ReturnType<Application['review']>>>('/api/review',input);state=await request<ApplicationState>('/api/state');return result;},alignmentProposal:async input=>{const result=await request<Awaited<ReturnType<Application['alignmentProposal']>>>('/api/alignment',input);state=await request<ApplicationState>('/api/state');return result;},snapshot:()=>structuredClone(state)};
}
