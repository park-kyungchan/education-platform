import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const hash = text => createHash('sha256').update(text).digest('hex');
const schemas = Object.fromEntries(await Promise.all(['sources','records','verification'].map(async name => [name, JSON.parse(await readFile(path.join(root,'schemas',name+'.schema.json'),'utf8'))])));
/** Strict evaluator for every validation keyword used by the bundled schemas, not a general Draft 2020-12 engine. */
export function schemaErrors(value, schema, at='$') {
  const errors=[]; const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const typeIs=t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?value!==null&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t;
  if(schema.type && !(Array.isArray(schema.type)?schema.type:[schema.type]).some(typeIs)) return [at+': type'];
  if('const' in schema&&!same(value,schema.const))errors.push(at+': const');
  if(schema.enum&&!schema.enum.some(x=>same(x,value)))errors.push(at+': enum');
  if(typeof value==='string') {if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(at+': minLength');if(schema.pattern&&!new RegExp(schema.pattern).test(value))errors.push(at+': pattern');}
  if(Array.isArray(value)){if(schema.minItems!==undefined&&value.length<schema.minItems)errors.push(at+': minItems');if(schema.uniqueItems&&new Set(value.map(x=>JSON.stringify(x))).size!==value.length)errors.push(at+': uniqueItems');if(schema.items)value.forEach((x,i)=>errors.push(...schemaErrors(x,schema.items,at+'['+i+']')));}
  if(value!==null&&typeof value==='object'&&!Array.isArray(value)){
    for(const key of schema.required||[])if(!(key in value))errors.push(at+'.'+key+': required');
    for(const [key,x] of Object.entries(value)){if(schema.properties?.[key])errors.push(...schemaErrors(x,schema.properties[key],at+'.'+key));else if(schema.additionalProperties===false)errors.push(at+'.'+key+': additionalProperties');}
  }
  for(const part of schema.allOf||[])errors.push(...schemaErrors(value,part,at));
  if(schema.if){const branch=schemaErrors(value,schema.if,at).length===0?schema.then:schema.else;if(branch)errors.push(...schemaErrors(value,branch,at));}
  if(schema.not&&schemaErrors(value,schema.not,at).length===0)errors.push(at+': not');
  return errors;
}
export async function loadPackage(base = root) {
  const files = ['sources/source-excerpts.json', 'source-aliases.json', 'records.json', 'coverage.json', 'sources/repository-evidence.json'];
  const raw = Object.fromEntries(await Promise.all(files.map(async f => [f, await readFile(path.join(base, f), 'utf8')])));
  return { sources: JSON.parse(raw[files[0]]), aliases: JSON.parse(raw[files[1]]), records: JSON.parse(raw[files[2]]), coverage: JSON.parse(raw[files[3]]), repository: JSON.parse(raw[files[4]]), raw };
}
export function validatePackage(p) {
  const errors = [...schemaErrors(p.sources,schemas.sources,'sources'),...schemaErrors(p.records,schemas.records,'records')], passed = [];
  if (errors.length) return {errors,passed,sourceMap:new Map(),recordMap:new Map()};
  const ok = (value, message) => { if (!value) errors.push(message); };
  const kinds = ['intent','decision','proposal','evidence','verification','acceptance'];
  const statuses = ['active','proposed','rejected','superseded','future','open_to_revision','reported','observed','accepted_scoped'];
  const bases = ['explicit_user_message','assistant_interpretation','user_hypothesis','assistant_report','observed_source_snapshot'];
  const sources = p.sources.sources || [], records = p.records.records || [];
  const sourceMap = new Map(), recordMap = new Map();
  ok(p.sources.schemaVersion === 'module-user-context.sources/1.0.0', 'source schemaVersion');
  ok(p.records.schemaVersion === 'module-user-context.records/1.0.0', 'record schemaVersion');
  ok(p.records.authority === 'none' && p.records.nativePermissionGranted === false, 'context cannot grant authority');
  for (const s of sources) {
    ok(!sourceMap.has(s.sourceKey), `duplicate source ${s.sourceKey}`); sourceMap.set(s.sourceKey, s);
    ok(typeof s.originalText === 'string' && s.originalText.length > 0, `empty original ${s.sourceKey}`);
    ok(s.textSha256 === hash(s.originalText), `source text changed ${s.sourceKey}`);
    ok(s.authority === 'none' && s.nativePermissionGranted === false, `source authority ${s.sourceKey}`);
    ok(!/JSESSIONID\s*=|(?:sk-[A-Za-z0-9]{20,})|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY/.test(s.originalText), `possible secret ${s.sourceKey}`);
    if (s.sourceType === 'conversation_message') {
      ok(s.sourceKey === s.messageId && s.locator.messageId === s.messageId, `message identity ${s.sourceKey}`);
      ok(typeof s.sentAt === 'string' && !Number.isNaN(Date.parse(s.sentAt)), `message time ${s.sourceKey}`);
      ok(['user','assistant'].includes(s.author), `message author ${s.sourceKey}`);
      ok(s.url === null && s.urlStatus === 'not_returned_by_message_tool', `unverified message URL ${s.sourceKey}`);
    } else if (s.sourceType === 'space_block') {
      ok(s.sourceKey === s.locator.pageId + '#' + s.locator.blockId, `block identity ${s.sourceKey}`);
      ok(s.url === 'https://chatgpt.com/space/' + s.locator.pageId, `page URL ${s.sourceKey}`);
      ok(s.author === 'unknown' && !!s.pageSnapshot, `page not a user utterance ${s.sourceKey}`);
    } else ok(false, `unknown source type ${s.sourceKey}`);
  }
  for (const [alias, id] of Object.entries(p.aliases)) ok(sourceMap.has(id) && sourceMap.get(id).alias === alias, `invalid alias ${alias}`);
  for (const r of records) {
    ok(!recordMap.has(r.key), `duplicate record ${r.key}`); recordMap.set(r.key, r);
    ok(kinds.includes(r.kind) && r.kind !== 'verification', `record kind ${r.key}; verification is generated separately`);
    ok(statuses.includes(r.status), `status ${r.key}`); ok(bases.includes(r.basis), `basis ${r.key}`);
    ok(Array.isArray(r.modules) && r.modules.length > 0 && r.modules.every(x => ['math','academy'].includes(x)), `scope ${r.key}`);
    ok(Array.isArray(r.sourceKeys) && r.sourceKeys.length > 0 && r.sourceKeys.every(x => sourceMap.has(x)), `unresolved source ${r.key}`);
    ok(Array.isArray(r.links) && Array.isArray(r.limitations), `missing boundary fields ${r.key}`);
    if (r.basis === 'explicit_user_message') ok(r.sourceKeys.some(x => sourceMap.get(x)?.author === 'user'), `user decision without user source ${r.key}`);
    if (r.kind === 'proposal') ok(r.status !== 'accepted_scoped' && !r.acceptance, `proposal cannot imply acceptance ${r.key}`);
    if (r.kind === 'acceptance') {
      ok(r.status === 'accepted_scoped' && r.acceptance?.outcome === 'accepted', `unscoped acceptance ${r.key}`);
      ok(r.sourceKeys.some(x => sourceMap.get(x)?.author === 'user'), `acceptance lacks user source ${r.key}`);
      ok(typeof r.acceptance?.scope === 'string' && r.acceptance.scope.length > 0 && r.acceptance.excluded?.length > 0, `acceptance boundary ${r.key}`);
    }
  }
  for (const r of records) for (const link of r.links) ok(recordMap.has(link.targetKey), `unresolved relation ${r.key} -> ${link.targetKey}`);
  for (const r of records.filter(r=>r.kind==='acceptance')) ok(recordMap.has(r.acceptance.targetKey), `acceptance target ${r.key}`);
  const expected = ['academy-full-scope','math-core-scope','math-connected-scope','math-curriculum-version','math-micro-actions','math-backward-tracing','math-no-causal-certainty','math-research-disagreement','math-tone-change-boundary','math-id-boundary','math-object-id-pilot','module-cloud-work','module-resume','math-exam-context','math-exam-timing','math-exam-distribution'];
  for (const key of expected) ok(recordMap.has(key), `missing required context ${key}`);
  ok(recordMap.get('module-research-hold')?.status === 'superseded', 'old hold cannot remain current');
  ok(recordMap.get('module-resume')?.links.some(l=>l.relation==='supersedes'&&l.targetKey==='module-research-hold'), 'resume link missing');
  ok(recordMap.get('math-exam-distribution')?.kind === 'proposal' && recordMap.get('math-exam-distribution')?.status === 'proposed', 'distribution not user acceptance');
  ok(recordMap.get('math-no-causal-certainty')?.basis === 'assistant_interpretation', 'inference boundary is not a fabricated user quote');
  ok(recordMap.get('math-tone-previous-interpretation')?.status === 'superseded', 'tone correction missing');
  ok(p.coverage.scopeStatus === 'partial' && p.coverage.fullConversationTransferComplete === false && p.coverage.fullSpaceReconciliationComplete === false, 'false completeness');
  ok(p.coverage.coveragePercent === null && p.coverage.conversationDenominator === null, 'invented completeness denominator');
  ok(p.coverage.included.messages === sources.filter(s=>s.sourceType==='conversation_message').length && p.coverage.included.spaceBlocks === sources.filter(s=>s.sourceType==='space_block').length && p.coverage.included.records === records.length, 'coverage count mismatch');
  ok(p.repository.allConversationsReconciled === false && p.repository.newStudentDetailCollection === false, 'repository scope drift');
  const exam=recordMap.get('math-exam-context')?.assessmentFacts;
  const timing=recordMap.get('math-exam-timing')?.timingFacts;
  const derived=recordMap.get('math-exam-timing')?.derivedValues;
  ok(!!exam&&!!timing&&Array.isArray(derived),'assessment structured facts missing');
  if(exam&&timing&&Array.isArray(derived)){
    const toMinutes=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
    ok(exam.scoreBands.every(b=>b.count>0&&b.points>0)&&exam.scoreBands.reduce((n,b)=>n+b.count,0)===exam.questionCount&&exam.scoreBands.reduce((n,b)=>n+b.count*b.points,0)===exam.totalPoints,'assessment score-band totals');
    const examOriginal=sourceMap.get(p.aliases['math.exam'])?.originalText||'';
    ok(examOriginal.includes('총 '+exam.questionCount+'문항')&&examOriginal.includes('총 '+exam.totalPoints+'점')&&exam.scoreBands.every(b=>examOriginal.includes(b.count+'문항은 '+b.points+'점')),'assessment facts do not match selected source');
    const timeOriginal=sourceMap.get(p.aliases['math.examTime'])?.originalText||'';
    ok(timeOriginal.includes('총 '+timing.durationMinutes+'분')&&timeOriginal.includes(timing.startLocal)&&timeOriginal.includes(timing.sessionEndLocal),'timing facts do not match selected source');
    const start=toMinutes(timing.startLocal),finish=toMinutes(timing.sessionEndLocal),end=start+timing.durationMinutes;
    ok(Number.isFinite(start)&&Number.isFinite(finish)&&timing.durationMinutes>0&&end<=finish,'assessment time bounds');
    const endValue=derived.find(x=>x.field==='examEnd')?.value,post=derived.find(x=>x.field==='postExamMinutes')?.value;
    ok(typeof endValue==='string'&&toMinutes(endValue)===end&&post===finish-end,'assessment derivedValues mismatch');
  }
  if (!errors.length) passed.push(...['bundled-source-and-record-schema','source-text-sha256','source-identity-time-locator','no-authority-escalation','selected-secret-pattern-scan','typed-kinds-status-basis','source-and-relation-referential-integrity','explicit-user-versus-assistant-distinction','scoped-acceptance','correction-and-resumption-chain','exam-context-arithmetic','coverage-counts-and-incomplete-claims']);
  return { errors, passed, sourceMap, recordMap };
}
export async function run({writeReceipt=false}={}) {
  const p = await loadPackage(); const v=validatePackage(p);
  const fingerprint=hash(Object.keys(p.raw).sort().map(f=>f+'\0'+hash(p.raw[f])).join('\n'));
  const receipt={schemaVersion:'module-user-context.verification/1.0.0',kind:'verification',status:v.errors.length?'failed':'passed',verifiedAt:new Date().toISOString(),implementation:'scripts/validate.mjs',checks:v.passed.map(name=>({name,status:'passed'})),errors:v.errors,sourceFingerprint:fingerprint,scope:'Selected source bytes, local typed records, reference integrity, correction links and explicitly bounded acceptance only.',doesNotEstablish:['complete conversation/Space migration','truth of every historical assistant report','mathematical or psychological validity','student ability or learning outcomes','actual exam question selection','WSL2/VPS runtime success','remote publication','user acceptance of the new implementation'],acceptanceDecision:'not_made',executionEffects:'none',authority:'none',nativePermissionGranted:false};
  if(writeReceipt){
    const receiptErrors=schemaErrors(receipt,schemas.verification,'verification');
    if(receiptErrors.length)throw new Error(receiptErrors.join('; '));
    await writeFile(path.join(root,'verification.json'),JSON.stringify(receipt,null,2)+'\n');
  const mapping=p.sources.sources.map(s=>({sourceKey:s.sourceKey,textSha256:s.textSha256,recordKeys:p.records.records.filter(r=>r.sourceKeys.includes(s.sourceKey)).map(r=>r.key)})).map(x=>({...x,projectionStatus:x.recordKeys.length?'mapped':'preserved_not_interpreted'}));
  await writeFile(path.join(root,'source-to-record-map.json'),JSON.stringify({schemaVersion:'module-user-context.source-map/1.0.0',sourceFingerprint:fingerprint,mapping},null,2)+'\n');
    async function files(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.filter(e=>e.name!=='node_modules'&&e.name!=='.git').map(async e=>e.isDirectory()?files(path.join(dir,e.name)):path.join(dir,e.name)))).flat();}
    const paths=(await files(root)).filter(f=>path.basename(f)!=='SHA256SUMS').sort();
    const sums=await Promise.all(paths.map(async f=>hash(await readFile(f))+'  '+path.relative(root,f)+'\n'));
    await writeFile(path.join(root,'SHA256SUMS'),sums.join(''));
  }
  console.log(JSON.stringify({status:receipt.status,mode:writeReceipt?'receipt-refresh':'read-only',sources:p.sources.sources.length,records:p.records.records.length,checks:v.passed.length,errors:v.errors,sourceFingerprint:fingerprint},null,2));
  if(v.errors.length) process.exitCode=1;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await run({writeReceipt:process.argv.includes('--write-receipt')});
