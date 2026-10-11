import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeUi } from '../scripts/project-ui.ts';
const root = resolve(import.meta.dir,'..');
const read = (p:string):unknown => JSON.parse(readFileSync(resolve(root,p),'utf8'));
test('canonical and UI coverage remain separate',()=>{
 const c = read('provenance/export-coverage.json') as {publishedViews:number;nativePageSnapshots:number;canonicalWorkpacksExported:number;relationAssertionsIndividuallyRead:number;relationAssertionsUnread:number;canonicalRelationsDeclared:number;fullEducationalValidation:boolean;cloudTaskLaunched:boolean};
 expect(c.publishedViews).toBe(48);expect(c.nativePageSnapshots).toBe(73);expect(c.canonicalWorkpacksExported).toBe(0);expect(c.relationAssertionsIndividuallyRead).toBe(143);expect(c.relationAssertionsUnread).toBe(775);expect(c.canonicalRelationsDeclared).toBe(918);expect(c.fullEducationalValidation).toBe(false);expect(c.cloudTaskLaunched).toBe(false);
});
test('actual contract versions use manifest-linked 1.3 files',()=>{
 const s = read('source/contracts/canonical.schema.json') as {$id:string};const r=read('source/contracts/extension-registry.json') as {version:string};const b=read('source/contracts/content-build-contract.json') as {version:string};
 expect(s.$id).toBe('urn:matheducation:canonical:1.3.0');expect(r.version).toBe('1.3.0');expect(b.version).toBe('1.1.0');
});
test('all48 published UI envelopes decode with declared hash',()=>{
 const m=read('derived/ui/ui-source-manifest.json') as {views:Array<{currentFile:string}>};expect(m.views).toHaveLength(48);
 for(const v of m.views)expect(decodeUi(readFileSync(resolve(root,'derived/ui',v.currentFile),'utf8'))).toBeTruthy();
});
test('notice denial is not labeled completed',()=>{
 const c=read('provenance/export-coverage.json') as {uiManagementNotices:{present:number;total:number;blockedPageId:string}};
 expect(c.uiManagementNotices.present).toBe(47);expect(c.uiManagementNotices.total).toBe(48);expect(c.uiManagementNotices.blockedPageId).toBe('page_150f2a56cefc81918fdede1fc804561d');
});
