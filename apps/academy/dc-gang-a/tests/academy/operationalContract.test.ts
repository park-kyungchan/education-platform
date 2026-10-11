import {describe,test,expect,afterEach} from 'bun:test';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadAcademyOperationalContract,validateAcademyOperationalContract,operationalContext,selectOperationalTopic,OPERATIONAL_CONTRACT_PATH} from '../../src/academy/operationalContract';
import {endpointCli} from '../../harness/endpoints';
import {catalogLevels} from '../../src/academy/domain';
const root=resolve(import.meta.dir,'../..');const fixture=()=>JSON.parse(readFileSync(resolve(root,OPERATIONAL_CONTRACT_PATH),'utf8'));
const dirs:string[]=[];afterEach(()=>{for(const p of dirs.splice(0))rmSync(p,{recursive:true,force:true});});
describe('operational contract semantic and transport boundaries',()=>{
 test('the selected product hierarchy matches the real section-capable catalog',()=>{
  expect(loadAcademyOperationalContract(root).product.contentHierarchy).toEqual(catalogLevels);
 });
 test('current loader refuses missing and stale policy sources without a browser fallback',()=>{
  const p=mkdtempSync(join(tmpdir(),'dc-operation-missing-'));dirs.push(p);mkdirSync(join(p,'docs'));
  expect(()=>loadAcademyOperationalContract(p)).toThrow();
  const old=fixture();old.asOf='2026-10-05';old.revision='2026-10-05-r1';
  writeFileSync(join(p,OPERATIONAL_CONTRACT_PATH),JSON.stringify(old));
  expect(()=>loadAcademyOperationalContract(p)).toThrow('stale_operational_contract');
 });
 test('current contract is validated and the actual CLI selects one structured topic',()=>{
  const c=validateAcademyOperationalContract(fixture());
  expect(c.roles.academyOwner).toBe('dc-gang-a-dev');
  expect(c.roles.defaultPermanentAcademyOwner).toBe(false);
  const result=endpointCli(['--contract-topic','source_access']) as ReturnType<typeof selectOperationalTopic>;
  expect(result.authorizesEffects).toBe(false);expect(result.topic).toBe('source_access');
  expect(result.selection).toMatchObject({requiredTransport:'direct_http_api',automaticBrowserFallback:false,academyEffect:'read_only',directSqlAccess:'not_admitted'});
 });
 test.each([
  (c:any)=>c.roles.academyOwner='default',
  (c:any)=>c.roles.defaultPermanentAcademyOwner=true,
  (c:any)=>c.roles.profileIsFilesystemSandbox=true,
  (c:any)=>c.sourceAccess.requiredTransport='native_browser',
  (c:any)=>c.sourceAccess.automaticBrowserFallback=true,
  (c:any)=>c.sourceAccess.academyEffect='write',
  (c:any)=>c.authority.contractFileGrantsEffects=true,
  (c:any)=>c.authority.historicalSuccessGrantsCurrentEffects=true,
  (c:any)=>c.limitations.newDirectHttpClientActivated=true,
  (c:any)=>c.format.opaqueProseWrappedInJsonIsContractImplementation=true,
  (c:any)=>c.meaning.schoolName.valueKind='course_grade',
 ])('refuses a policy upgrade or contradictory owner/meaning at ingress',change=>{
  const c=fixture();change(c);expect(()=>validateAcademyOperationalContract(c)).toThrow(/^invalid_operational_contract$/);
 });
 test('unknown fields, impossible dates and metadata pretending to grant rights are rejected',()=>{
  for(const change of [(c:any)=>c.writeAuthorized=true,(c:any)=>c.sourceAccess.cookie='synthetic_marker',(c:any)=>{c.asOf='2026-02-30';c.revision='2026-02-30-r1';},(c:any)=>c.revision='2026-10-04-r1']){
   const c=fixture();change(c);expect(()=>validateAcademyOperationalContract(c)).toThrow(/^invalid_operational_contract$/);
  }
 });
 test('correctness and absent written solution stay independently required, with an explicit persistence gap',()=>{
  const c=validateAcademyOperationalContract(fixture());const result=selectOperationalTopic(c,'meaning').selection as typeof c.meaning;
  expect(result.itemJudgment.requiredLanes).toContain('correctness');expect(result.itemJudgment.requiredLanes).toContain('written_solution_state');expect(result.itemJudgment.requiredLanes).toContain('item_reasons');
  expect(result.itemJudgment.correctAnswerWithoutSolution).toBe('O_and_missing_solution_are_independent');
  expect(result.itemJudgment.applicationPersistenceQualification).toBe('not_implemented_by_this_contract');
 });
 test('selected results cannot mutate later validated current context',()=>{
  const c=validateAcademyOperationalContract(fixture());const first=operationalContext(c);
  (first.roles as any).academyOwner='synthetic:foreign';(first.sourceAccess.scope as any).push('synthetic:foreign');
  const next=operationalContext(c);expect(next.roles.academyOwner).toBe('dc-gang-a-dev');expect(next.sourceAccess.scope).not.toContain('synthetic:foreign');
  const selected=selectOperationalTopic(c,'source_access');(selected.selection as any).automaticBrowserFallback=true;
  expect((selectOperationalTopic(c,'source_access').selection as any).automaticBrowserFallback).toBe(false);
 });
 test('unknown topic and arbitrary file selectors fail before accessing any path',()=>{
  for(const topic of ['all','../auth.json','/synthetic/private'])expect(()=>endpointCli(['--contract-topic',topic])).toThrow(/^invalid_operational_topic$/);
  expect(()=>endpointCli(['--contract-topic','roles','--id','arbitrary'])).toThrow(/^invalid_operational_topic$/);
 });
 test('loader refuses a symbolic source instead of following another owner',()=>{
  const p=mkdtempSync(join(tmpdir(),'dc-operation-contract-'));dirs.push(p);mkdirSync(join(p,'docs'));
  const outside=join(p,'outside.json');writeFileSync(outside,JSON.stringify(fixture()));symlinkSync(outside,join(p,OPERATIONAL_CONTRACT_PATH));
  expect(()=>loadAcademyOperationalContract(p)).toThrow(/^invalid_operational_contract_source$/);
 });
});
