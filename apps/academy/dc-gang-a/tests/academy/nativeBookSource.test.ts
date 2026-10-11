import { describe, expect, test } from 'bun:test';
import { collectNativeBookDiscovery } from '../../src/academy/nativeBookSource';
describe('native source acquisition preflight',()=>{
  test('refuses a foreign origin before any source fetch',async()=>{
    const previous=Object.getOwnPropertyDescriptor(globalThis,'location');
    Object.defineProperty(globalThis,'location',{value:{origin:'https://foreign.example.invalid'},configurable:true});
    try{await expect(collectNativeBookDiscovery({teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:['Invented Learner']})).rejects.toThrow('authentication_required');}
    finally{if(previous)Object.defineProperty(globalThis,'location',previous);else delete (globalThis as {location?:unknown}).location;}
  });
});
