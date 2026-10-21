import {retainedQueryLimits as bounds,type RetainedSelector,type RetainedQueryRequest,type RetainedQueryReply,type RetainedFragment,type QueryJson} from './contracts/retainedQuery';
/** Transport reconstruction only; no domain projections, eligibility or teacher-state logic. */
export async function readRetainedDocument<T>(selector:RetainedSelector,fetchPage:(request:RetainedQueryRequest)=>Promise<RetainedQueryReply>):Promise<T>{
  selector=JSON.parse(JSON.stringify(selector));
  let cursor:string|null=null,snapshot:string|null=null,binding:string|null=null,total:number|null=null;
  const fragments:RetainedFragment[]=[],seen=new Set<string>();let transferred=0;
  const identity=(s:RetainedSelector)=>JSON.stringify(Object.entries(s).sort(([a],[b])=>a.localeCompare(b)));
  for(let pageIndex=0;pageIndex<1024;pageIndex++){
    const page=await fetchPage({selector,cursor,limit:bounds.maxPageRecords,maxBytes:bounds.pageBytes});
    if(page.status!=='page')throw Error(page.code);
    const bytes=new TextEncoder().encode(JSON.stringify(page)).byteLength;transferred+=bytes;
    if(page.schema!=='academy.retained-query.v1'||identity(page.selector)!==identity(selector)||page.page.offset!==fragments.length||page.page.returned!==page.records.length||!page.records.length||page.records.length>bounds.maxPageRecords||page.page.maxBytes!==bounds.pageBytes||bytes!==page.page.serializedBytes||bytes>bounds.pageBytes||transferred>32*1024*1024||fragments.length+page.records.length>bounds.documentRecords)throw Error('retained_page_contract_conflict');
    if(snapshot!==null&&(snapshot!==page.snapshot||binding!==page.callerBinding||total!==page.page.totalRecords))throw Error('retained_page_snapshot_conflict');
    snapshot=page.snapshot;binding=page.callerBinding;total=page.page.totalRecords;
    for(const fragment of page.records){if(fragment.ordinal!==fragments.length)throw Error('retained_page_order_conflict');fragments.push(fragment);}
    if(page.page.exhausted){
      if(page.page.nextCursor!==null||fragments.length!==total)throw Error('retained_page_continuation_conflict');
      const document=assemble(fragments);
      const canonical=(value:QueryJson):string=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key]!)).join(',')+'}';
      const encoded=new TextEncoder().encode(canonical(document));if(encoded.byteLength>bounds.documentBytes)throw Error('retained_document_client_scope_too_large');
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hash!==snapshot)throw Error('retained_document_digest_conflict');
      return document as T;
    }
    if(typeof page.page.nextCursor!=='string'||seen.has(page.page.nextCursor)||fragments.length>=total)throw Error('retained_page_continuation_conflict');
    cursor=page.page.nextCursor;seen.add(cursor);
  }
  throw Error('retained_document_client_scope_too_large');
}
function assemble(fragments:RetainedFragment[]):QueryJson{
  let root:QueryJson=null;const containers=new Map<string,QueryJson>(),paths=new Set<string>();
  for(const fragment of fragments){
    if(!Array.isArray(fragment.path)||fragment.path.length>bounds.depth||fragment.path.some(s=>typeof s!=='string'&&(!Number.isSafeInteger(s)||s<0)))throw Error('retained_fragment_path_invalid');
    const key=JSON.stringify(fragment.path);if(paths.has(key))throw Error('retained_fragment_duplicate');paths.add(key);
    const value:QueryJson=fragment.kind==='object'?{}:fragment.kind==='array'?[]:fragment.kind==='value'?JSON.parse(JSON.stringify(fragment.value)):(()=>{throw Error('retained_fragment_kind_invalid');})();
    if(!fragment.path.length){if(fragment.ordinal!==0)throw Error('retained_fragment_root_conflict');root=value;}
    else{
      const parent=containers.get(JSON.stringify(fragment.path.slice(0,-1))),field=fragment.path.at(-1)!;
      if(parent===undefined||parent===null||typeof parent!=='object')throw Error('retained_fragment_parent_missing');
      if(Array.isArray(parent)){if(typeof field!=='number'||field!==parent.length)throw Error('retained_fragment_array_conflict');parent.push(value);}
      else{if(typeof field!=='string'||Object.hasOwn(parent,field))throw Error('retained_fragment_object_conflict');Object.defineProperty(parent,field,{value,enumerable:true,configurable:true,writable:true});}
    }
    if(fragment.kind!=='value')containers.set(key,value);
  }
  return root;
}
