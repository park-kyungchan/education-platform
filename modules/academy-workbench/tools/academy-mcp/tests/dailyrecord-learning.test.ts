import {expect,test} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DailyRecordService} from '../src/dailyrecord.ts';
import {dailyRecordLearningConfiguration} from '../src/dailyrecord-learning.ts';
import {backend,clock,context,observation,proposal,safeguard,learningPolicy} from './dailyrecord-fixture.ts';

test('changed text requires hyphen lines and owner mapping; untouched legacy text stays unchanged',async()=>{
 const c=context(),service=new DailyRecordService(backend(),safeguard,()=>clock),intake=await service.intake({context:c});
 const changed=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[{...proposal('progress','x'),value:'1. 지정 문제 12문항 풀이 진행.'}]});
 expect(changed.rows[0].blockers).toContain('parent_hyphen_lines_required');expect(changed.rows[0].blockers).toContain('canonical_learning_policy_not_connected');expect(changed.patch).toEqual([]);
 const noop=await service.review({context:c,observationHandle:intake.observationHandle,proposals:[{...proposal('progress','x'),value:observation().fields.progress.state==='known'?(observation().fields.progress as any).value:''}]});
 expect(noop.rows[0].disposition).toBe('noop');expect(noop.patch).toEqual([]);
});
test('non-hyphen historical samples are ignored as tone and structured refs enter the review digest',async()=>{
 const o=observation();o.toneSamples.push({...o.toneSamples[0],text:'1. 다른 형식'});
 const s=new DailyRecordService(backend(()=>o),safeguard,()=>clock,learningPolicy),c=context(),i=await s.intake({context:c});
 expect(i.toneSamples).toHaveLength(1);expect(i.toneSamples[0].text).toStartWith('- ');
 const p=proposal('progress','지정 문제 12문항 풀이 진행.'),a=await s.review({context:c,observationHandle:i.observationHandle,proposals:[p]});
 const b=await s.review({context:c,observationHandle:i.observationHandle,proposals:[{...p,learningEntries:[{bookRef:'fictional-book',unitRef:'fictional-unit',scope:'unit',sectionRefs:[],activity:'풀이',deadline:null}]}]});
 expect(a.reviewDigest).not.toBe(b.reviewDigest);
});
test('pinned owner bundle gets only the configured retained identity; tools cannot replace its catalog',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(),'fictional-learning-owner-')),sha=(b:string)=>createHash('sha256').update(b).digest('hex');
 try{
  const catalog=JSON.stringify({fictionalMarker:'owner-only'}),catalogPath=resolve(dir,'catalog.json');await writeFile(catalogPath,catalog);
  // Transport stub only. Business rules are tested in the canonical Education owner.
  const code=`export function createDailyRecordLearningReviewer(c){if(c.fictionalMarker!=='owner-only')throw Error('wrong_catalog');return {schemaVersion:'academy.dailyrecord-learning-review/1',review(student,text,entries){return {blockers:student==='retained-fictional'&&Array.isArray(entries)?[]:['learning_entries_required']}}}}`;
  const bundle=resolve(dir,'owner.mjs');await writeFile(bundle,code);
  const scope=context().scope,config=JSON.stringify({schemaVersion:'academy.dailyrecord-learning-config/1',catalogPath,catalogSha256:sha(catalog),students:[{sourceNamespace:scope.sourceNamespace,teacherId:scope.teacherId,studentId:scope.studentId,retainedStudentRef:'retained-fictional'}]}),configPath=resolve(dir,'config.json');await writeFile(configPath,config);
  const args=['--dailyrecord-learning',bundle,sha(code),configPath,sha(config),'--other'];
  const result=await dailyRecordLearningConfiguration(args);expect(result.remainingArgs).toEqual(['--other']);
  expect(result.learningPolicy!.review(scope,'',undefined)).toEqual(['learning_entries_required']);expect(result.learningPolicy!.review(scope,'',[])).toEqual([]);
  expect(result.learningPolicy!.review({...scope,teacherId:'foreign'},'',[])).toEqual(['student_namespace_bridge_unverified_ask_teacher']);
  await writeFile(catalogPath,'{}');await expect(dailyRecordLearningConfiguration(args)).rejects.toThrow();
  const service=new DailyRecordService();await expect(service.review({context:context(),catalog:{verified:true},proposals:[proposal('progress','x')]})).rejects.toThrow();
 }finally{await rm(dir,{recursive:true,force:true});}
});
