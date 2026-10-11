import {expect,test} from 'bun:test';
import {classifyTeacherRuntime} from '../../src/academy/runtimeStatus';
test('healthy service is retained without restart or session interview',()=>{
  expect(classifyTeacherRuntime({postgres:'running',local:'healthy',public:'healthy'})).toEqual({state:'available',next:'keep_existing_runtime',automaticEffects:false,sessionClosureProvesStop:false});
});
test('a missing tunnel is not a reason to restart healthy app and DB',()=>{
  expect(classifyTeacherRuntime({postgres:'running',local:'healthy',public:'unreachable'}).next).toBe('inspect_existing_tunnel_only');
});
test('stopped components require exact owned recovery, not a new deployment queue',()=>{
  expect(classifyTeacherRuntime({postgres:'stopped',local:'unreachable',public:'unreachable'}).next).toBe('verify_existing_targets_then_recover');
  expect(classifyTeacherRuntime({postgres:'unknown',local:'unexpected',public:'unreachable'}).next).toBe('resolve_unknown_ownership_no_restart');
});
