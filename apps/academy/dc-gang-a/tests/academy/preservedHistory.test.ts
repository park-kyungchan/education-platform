import {test,expect} from 'bun:test';
import {createPreservedHistoryReader,parsePreservedDataset,preservedNamespace} from '../../src/academy/preservedHistory';
import type {PreservedSelection} from '../../src/academy/contracts/preservedHistory';
import {archiveActor,archivedFixture,fakeArchive,digest} from './preservedHistoryFixtures';
const chosen:PreservedSelection={namespace:preservedNamespace,scope:'student',studentId:'synthetic-archived-a'};
test('variable-size archived paging and exact-ID details preserve every original including correction and superseded records',async()=>{
 const {dataset,original}=archivedFixture(47),source=fakeArchive(dataset,original),reader=createPreservedHistoryReader(source.access,archiveActor.ownerId),index=await reader.index(archiveActor),ids:string[]=[];
 expect(index.currentStudentBinding).toBeNull();expect(index.archivedOwnerId).toBe(dataset.ownerId);expect(index.recordCount).toBe(49);expect(index.currentness).toBe('unknown');let cursor:string|null=null;
 do{const page=await reader.page(archiveActor,chosen,cursor,index.snapshotSha256);expect(page.records.length).toBeLessThanOrEqual(20);expect(JSON.stringify(page)).not.toContain('rawJson');ids.push(...page.records.map(record=>record.id));cursor=page.nextCursor;}while(cursor);
 expect(ids).toEqual(dataset.records.filter(record=>record.studentId===chosen.studentId).map(record=>record.id));
 for(const id of ids){const detail=await reader.detail(archiveActor,chosen,id,index.snapshotSha256);expect(detail.record).toEqual(dataset.records.find(record=>record.id===id)!);expect(detail.correctionSemantics).toBe('preserved_not_applied');}
 const correction=await reader.detail(archiveActor,chosen,'archived-1',index.snapshotSha256);expect(correction.record.supersedes).toEqual([]);expect(correction.record.data).toHaveProperty('correctionScope','book_label_and_attribution_only');expect((await reader.detail(archiveActor,chosen,'archived-0',index.snapshotSha256)).record.id).toBe('archived-0');
 expect((await reader.page(archiveActor,{namespace:preservedNamespace,scope:'owner'},null,index.snapshotSha256)).records.map(record=>record.id)).toEqual(['archived-global']);
});
test('owner, namespace, archived student and record scope refuse before any native student lookup or name join',async()=>{
 const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original),reader=createPreservedHistoryReader(source.access,archiveActor.ownerId);
 await expect(reader.index({...archiveActor,ownerId:'foreign-owner'})).rejects.toThrow('owner_scope_conflict');expect(source.reads()).toBe(0);const index=await reader.index(archiveActor);
 for(const selection of [{...chosen,namespace:'academy_student'},{...chosen,studentId:'synthetic-current-student-id'},{...chosen,studentId:dataset.students[0]!.displayName}])await expect(reader.page(archiveActor,selection,null,index.snapshotSha256)).rejects.toThrow();
 await expect(reader.detail(archiveActor,chosen,'archived-b',index.snapshotSha256)).rejects.toThrow('preserved_record_scope_conflict');await expect(reader.detail(archiveActor,chosen,'archived-global',index.snapshotSha256)).rejects.toThrow('preserved_record_scope_conflict');
 dataset.records[0]!.supersedes=['archived-b'];expect(()=>parsePreservedDataset(source.encode())).toThrow('preserved_history_scope_conflict');
});
test('snapshot drift and replay into a different archived scope cannot silently mix pages or details',async()=>{
 const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original),reader=createPreservedHistoryReader(source.access,archiveActor.ownerId),index=await reader.index(archiveActor),page=await reader.page(archiveActor,chosen,null,index.snapshotSha256);
 await expect(reader.page(archiveActor,{...chosen,studentId:'synthetic-archived-b'},page.nextCursor,index.snapshotSha256)).rejects.toThrow('preserved_cursor_scope_conflict');await expect(reader.page(archiveActor,chosen,'../arbitrary-path',index.snapshotSha256)).rejects.toThrow('preserved_cursor_invalid');
 const foreignCursor=JSON.parse(Buffer.from(page.nextCursor!,'base64url').toString('utf8'));foreignCursor.ownerId='synthetic-other-owner';await expect(reader.page(archiveActor,chosen,Buffer.from(JSON.stringify(foreignCursor)).toString('base64url'),index.snapshotSha256)).rejects.toThrow('preserved_cursor_scope_conflict');
 dataset.records.push({...dataset.records[0]!,id:'new-archived-record'});await expect(reader.page(archiveActor,chosen,page.nextCursor,index.snapshotSha256)).rejects.toThrow('preserved_snapshot_conflict');await expect(reader.detail(archiveActor,chosen,'archived-0',index.snapshotSha256)).rejects.toThrow('preserved_snapshot_conflict');
});
test('large correction-reference metadata uses a byte budget as well as a finite row count without skipping originals',async()=>{
 const {dataset,original}=archivedFixture();for(const record of dataset.records.slice(0,25))record.supersedes=Array(1600).fill('archived-42');const source=fakeArchive(dataset,original),reader=createPreservedHistoryReader(source.access,archiveActor.ownerId),index=await reader.index(archiveActor);let cursor:string|null=null;const ids:string[]=[];let pages=0;
 do{const page=await reader.page(archiveActor,chosen,cursor,index.snapshotSha256);if(pages===0)expect(page.records.length).toBeLessThan(20);expect(Buffer.byteLength(JSON.stringify(page.records))).toBeLessThan(262200);ids.push(...page.records.map(record=>record.id));cursor=page.nextCursor;pages++;}while(cursor);
 expect(ids).toEqual(dataset.records.filter(record=>record.studentId===chosen.studentId).map(record=>record.id));expect(pages).toBeGreaterThan(3);
});
test('original artifact identity stays intact while download requires unique exact owned bytes, MIME and owner-global custody',async()=>{
 const {dataset,original}=archivedFixture(),source=fakeArchive(dataset,original),reader=createPreservedHistoryReader(source.access,archiveActor.ownerId),index=await reader.index(archiveActor),id=dataset.artifacts[0]!.id;
 const file=await reader.artifact(archiveActor,id,index.snapshotSha256);expect(file.body.equals(original)).toBe(true);expect(file.archivedArtifactId).toBe(id);expect(file.filename).toBe(dataset.artifacts[0]!.filename);expect(file.headers['Content-Disposition']).toContain('Invented%20original.json');expect(file.binding).toBe('exact_archived_bytes_only_not_student_identity');
 source.catalogEntry.sha256=digest('different original');await expect(reader.artifact(archiveActor,id,index.snapshotSha256)).rejects.toThrow('preserved_artifact_custody_ambiguous');source.catalogEntry.sha256=digest(original);source.catalog.artifacts.push({...source.catalogEntry,id:'synthetic-duplicate'});await expect(reader.artifact(archiveActor,id,index.snapshotSha256)).rejects.toThrow('preserved_artifact_custody_ambiguous');source.catalog.artifacts.pop();source.catalogEntry.studentId='synthetic-current-student' as any;await expect(reader.artifact(archiveActor,id,index.snapshotSha256)).rejects.toThrow('preserved_artifact_custody_ambiguous');
 await expect(reader.artifact(archiveActor,'../private-source',index.snapshotSha256)).rejects.toThrow('preserved_artifact_scope_conflict');
});
test('foreign declared source namespace, invalid provenance and deep JSON remain held rather than becoming current facts',()=>{
 for(const change of [(dataset:any)=>dataset.students[0].sourceIdentities[0].namespace='native-student',(dataset:any)=>dataset.records[0].provenance.observedAt='not-a-clock',(dataset:any)=>dataset.records[0].supersedes=['not-in-saved-scope']]){const {dataset}=archivedFixture();change(dataset);expect(()=>parsePreservedDataset(Buffer.from(JSON.stringify(dataset)))).toThrow();}
 const {dataset}=archivedFixture();let deep:any=null;for(let n=0;n<45;n++)deep={value:deep};dataset.records[0]!.data=deep;expect(()=>parsePreservedDataset(Buffer.from(JSON.stringify(dataset)))).toThrow('preserved_dataset_invalid');
});
