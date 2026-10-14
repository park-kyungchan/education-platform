import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const root=new URL('..',import.meta.url).pathname;
const provider=JSON.parse(await readFile(root+'architecture/common-ci-provider.json','utf8'));
if(provider.schema!=='education.common-ci-projection.v1'||provider.codeOwner!=='agent-platform'||provider.nativePermissionGranted!==false)throw Error('Invalid common CI source owner');
for(const row of provider.generated){
 if(!['ci/native-review-gate.js','ci/native-review.entry.ts'].includes(row.path)||createHash('sha256').update(await readFile(root+row.path)).digest('hex')!==row.sha256)throw Error('Generated common CI projection drift');
}
console.log(JSON.stringify({status:'passed',class:'pinned-generated-common-ci-projection',canonicalSource:provider.source,nativePermissionGranted:false}));
