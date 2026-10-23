import {OPERATIONAL_CONTRACT_PATH,OPERATIONAL_CONTRACT_REVISION,operationalTopics,operationalContractShape,type OperationalTopic} from '../contracts/operationalContractShape';
export {OPERATIONAL_CONTRACT_PATH,OPERATIONAL_CONTRACT_REVISION,operationalTopics,operationalContractShape,type OperationalTopic} from '../contracts/operationalContractShape';
/** Current source/ownership/format contract at real CLI consumers, not authentication or effect authority. */
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';

export type AcademyOperationalContract = {
  schemaVersion:1; kind:'academy_operational_contract'; revision:string; asOf:string; claimClass:'USER_APPROVED_LOCAL';
} & typeof operationalContractShape;
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_operational_contract');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  if(Object.values(descriptors).some(d=>!Object.hasOwn(d,'value')))throw Error('invalid_operational_contract');
  return value as Record<string,unknown>;
}
function exact(value:unknown,expected:Record<string,unknown>):void{
  const input=record(value);const keys=Object.keys(expected);
  if(Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))throw Error('invalid_operational_contract');
  for(const key of keys){const want=expected[key],got=input[key];
    if(Array.isArray(want)){if(!Array.isArray(got)||got.length!==want.length||got.some((v,i)=>v!==want[i]))throw Error('invalid_operational_contract');}
    else if(want&&typeof want==='object')exact(got,want as Record<string,unknown>);
    else if(got!==want)throw Error('invalid_operational_contract');
  }
}

export function validateAcademyOperationalContract(value:unknown):AcademyOperationalContract{
  const data=record(value);const keys=['schemaVersion','kind','revision','asOf','claimClass',...Object.keys(operationalContractShape)];
  if(Object.keys(data).length!==keys.length||keys.some(k=>!Object.hasOwn(data,k))||data.schemaVersion!==1||data.kind!=='academy_operational_contract'||data.claimClass!=='USER_APPROVED_LOCAL'
    ||typeof data.revision!=='string'||!/^\d{4}-\d{2}-\d{2}-r[1-9][0-9]*$/.test(data.revision)||typeof data.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOf)
    ||!Number.isFinite(Date.parse(data.asOf+'T00:00:00Z'))||new Date(data.asOf+'T00:00:00Z').toISOString().slice(0,10)!==data.asOf||!data.revision.startsWith(data.asOf+'-'))throw Error('invalid_operational_contract');
  for(const [key,expected] of Object.entries(operationalContractShape)){if(Array.isArray(expected)){if(JSON.stringify(data[key])!==JSON.stringify(expected))throw Error('invalid_operational_contract');}else exact(data[key],record(expected));}
  return structuredClone(data) as unknown as AcademyOperationalContract;
}
export function loadAcademyOperationalContract(root:string):AcademyOperationalContract{
  const base=realpathSync(root),path=resolve(base,OPERATIONAL_CONTRACT_PATH),st=lstatSync(path);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>65536)throw Error('invalid_operational_contract_source');
  const rel=relative(base,realpathSync(path));if(isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep))throw Error('invalid_operational_contract_source');
  const contract=validateAcademyOperationalContract(JSON.parse(readFileSync(path,'utf8')));
  if(contract.revision!==OPERATIONAL_CONTRACT_REVISION)throw Error('stale_operational_contract');
  return contract;
}
export function operationalContext(contract:AcademyOperationalContract){
  const valid=validateAcademyOperationalContract(contract);
  return {schemaVersion:1,contractRef:OPERATIONAL_CONTRACT_PATH,revision:valid.revision,asOf:valid.asOf,roles:valid.roles,format:valid.format,sourceAccess:valid.sourceAccess,product:valid.product,teacherReserved:valid.teacherReserved,authority:valid.authority,sourceReferences:valid.sourceReferences,limitations:valid.limitations,authorizesEffects:false as const};
}
export function selectOperationalTopic(contract:AcademyOperationalContract,topic:unknown){
  if(typeof topic!=='string'||!operationalTopics.includes(topic as OperationalTopic))throw Error('invalid_operational_topic');
  const valid=validateAcademyOperationalContract(contract);
  const selected={roles:valid.roles,format:valid.format,source_access:valid.sourceAccess,product:valid.product,meaning:valid.meaning,references:valid.sourceReferences}[topic as OperationalTopic];
  return {schemaVersion:1,contractRef:OPERATIONAL_CONTRACT_PATH,revision:valid.revision,topic,selection:structuredClone(selected),authorizesEffects:false as const};
}
