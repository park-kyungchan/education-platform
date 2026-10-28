import {expect,test} from 'bun:test';
import {publicReadFailure} from '../src/read-failure.ts';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {backend,context} from './dailyrecord-fixture.ts';
import {installStdioDiagnostics} from '../src/stdio-diagnostics.ts';
test('typed public categories survive service serialization without arbitrary exception payloads',async()=>{
 for(const [message,category] of [['script_digest_drift','contract_drift'],['native_metadata_method_unavailable','endpoint_absence'],['native_dailyrecord_scope_refused','policy_denial'],['native_dated_name_ambiguous','identity_ambiguity'],['private_secret_snake_case','upstream_unavailable']] as const){
  const service=new DailyRecordService(backend(()=>{throw Error(message);}));const result=await service.intake({context:context()});
  expect(result.sourceAvailability).toBe('unavailable');expect(result.blockers[0]).toBe(message==='private_secret_snake_case'?'dailyrecord_source_unqualified_no_automatic_retry':message);expect(JSON.stringify(result)).not.toContain('private_secret_snake_case');expect(publicReadFailure(Error(message)).category).toBe(category);
 }
 expect(publicReadFailure(new SyntaxError('PRIVATE_PAYLOAD'))).toMatchObject({category:'malformed_response'});
});
test('stdio diagnostics are explicit, bounded and never include exception contents',()=>{
 const server:{onerror?:(error:Error)=>void}={},lines:string[]=[];installStdioDiagnostics(server,s=>lines.push(s));
 for(let i=0;i<30;i++)server.onerror!(Error('PRIVATE_FRAME_CANARY'));
 expect(lines).toHaveLength(16);expect(lines.join('')).not.toContain('PRIVATE_FRAME_CANARY');expect(JSON.parse(lines[0]).category).toBe('protocol');
});
