import type {SQL} from 'bun';
import {createHash} from 'node:crypto';
export const legacyTables=['students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links'] as const;
export const additiveTables=['owner_workspace_versions','owner_workspace_heads','owner_workspace_outcomes','concept_domain_versions','concept_domain_heads','concept_domain_outcomes'] as const;
export const productTables=[...legacyTables,...additiveTables] as const;
export type ProductTable=typeof productTables[number];
export interface ProductSqlScope {database:string;username:string;dataDirectory:string;socketDirectory:string;port:number}
export interface TableReadback {count:number;digest:string}
export interface ProductReadback {allPartitions:Partial<Record<ProductTable,TableReadback>>;owner:{counts:Partial<Record<ProductTable,number>>;tableDigests:Partial<Record<ProductTable,string>>}}
export type CanonicalJson=(value:unknown)=>string;
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
function need(value:unknown,code:string):asserts value {if(!value)throw Error(code);}
const normal=(rows:Iterable<unknown>)=>Array.from(rows,row=>JSON.parse(JSON.stringify(row)));
export async function assertOwnedSql(tx:SQL,scope:ProductSqlScope){
 const [row]=await tx`SELECT current_database() AS database,current_user AS username,inet_server_addr() IS NULL AS local_socket,current_setting('data_directory') AS data,current_setting('unix_socket_directories') AS socket,current_setting('port') AS port,current_setting('listen_addresses') AS listen`;
 need(row.database===scope.database&&row.username===scope.username&&row.local_socket===true&&row.data===scope.dataDirectory&&row.socket===scope.socketDirectory&&row.port===String(scope.port)&&row.listen==='','own_product_sql_identity_required');
}
export async function schemaTables(tx:SQL){const [size]=await tx`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='academy'`;need(size.n<=32,'product_table_inventory_cap');const rows=normal(await tx`SELECT tablename FROM pg_tables WHERE schemaname='academy' ORDER BY tablename LIMIT 33`);need(rows.length===size.n,'product_table_inventory_changed');return rows.map(row=>(row as {tablename:string}).tablename);}
function exactTables(actual:string[],expected:readonly string[]){need(JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort()),'exact_product_table_shape_required');}
export async function snapshotTables(tx:SQL,tables:readonly ProductTable[],ownerId:string,canonicalJson:CanonicalJson,availableMemory:()=>number):Promise<ProductReadback>{
 need(tables.length<=12&&tables.every(table=>productTables.includes(table)),'fixed_product_table_scope_required');
 const sizes=new Map<string,{count:number;bytes:number}>();let total=0;
 for(const table of tables){
  const [size]=await tx.unsafe('SELECT count(*)::int AS n,coalesce(sum(octet_length(to_jsonb(t)::text)),0)::bigint AS bytes,coalesce(max(octet_length(to_jsonb(t)::text)),0)::int AS largest FROM academy.'+table+' t');
  total+=Number(size.bytes);need(Number.isSafeInteger(size.n)&&size.n>=0&&size.n<=100000&&Number(size.largest)<=1024*1024&&total<=32*1024*1024&&availableMemory()>=total*12+256*1024*1024,'product_snapshot_resource_cap');sizes.set(table,{count:size.n,bytes:Number(size.bytes)});
 }
 const result:ProductReadback={allPartitions:{},owner:{counts:{},tableDigests:{}}};
 for(const table of tables){
  const expected=sizes.get(table)!,all:string[]=[],own:string[]=[];let bytes=0;
  for(let offset=0;offset<expected.count;offset+=64){
   const rows=await tx.unsafe('SELECT to_jsonb(t) AS data FROM academy.'+table+' t ORDER BY to_jsonb(t)::text LIMIT 64 OFFSET '+offset);
   need(rows.length===Math.min(64,expected.count-offset),'product_snapshot_count_changed');
   for(const item of rows){const value=JSON.parse(JSON.stringify(item.data)),encoded=canonicalJson(value);bytes+=Buffer.byteLength(encoded);need(Buffer.byteLength(encoded)<=1024*1024&&bytes<=expected.bytes,'product_snapshot_serialized_cap');all.push(encoded);if(value.owner_id===ownerId)own.push(encoded);}
  }
  need(all.length===expected.count,'product_snapshot_incomplete');result.allPartitions[table]={count:all.length,digest:sha(all.sort().join('\n'))};result.owner.counts[table]=own.length;result.owner.tableDigests[table]=sha(own.sort().join('\n'));
 }
 return result;
}
export async function legacySchema(tx:SQL,canonicalJson:CanonicalJson){
 const metadata=async(query:string)=>{const [size]=await tx.unsafe('SELECT count(*)::int AS n,coalesce(sum(octet_length(to_jsonb(m)::text)),0)::bigint AS bytes,coalesce(max(octet_length(to_jsonb(m)::text)),0)::int AS largest FROM ('+query+') m');need(Number.isSafeInteger(size.n)&&size.n<=2048&&Number(size.bytes)<=2*1024*1024&&Number(size.largest)<=256*1024,'legacy_schema_metadata_preallocation_cap');const rows=normal(await tx.unsafe(query+' LIMIT 2049'));need(rows.length===size.n,'legacy_schema_metadata_changed');return rows;};
 const tables=await metadata("SELECT c.relname,c.relkind,c.relpersistence,pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,c.relrowsecurity,c.relforcerowsecurity,c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') ORDER BY c.relname");
 const columns=await metadata("SELECT c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value,a.attidentity,a.attgenerated FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum");
 const constraints=await metadata("SELECT c.relname,k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,false) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') ORDER BY c.relname,k.conname");
 const indexes=await metadata("SELECT c.relname,i.indisunique,i.indisprimary,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') ORDER BY c.relname,i.indexrelid");
 const triggers=await metadata("SELECT c.relname,t.tgname,t.tgtype,t.tgenabled,pn.nspname AS function_namespace,p.proname AS function_name,pg_get_triggerdef(t.oid,false) AS definition,pg_get_functiondef(p.oid) AS function_body,pg_get_userbyid(p.proowner) AS function_owner,p.proacl::text AS function_acl FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') AND NOT t.tgisinternal ORDER BY c.relname,t.tgname");
 const internal=await metadata("SELECT c.relname,t.tgname,t.tgtype,t.tgenabled,pn.nspname AS function_namespace,p.proname AS function_name,pg_get_triggerdef(t.oid,false) AS definition,rc.relname AS constraint_table,pg_get_constraintdef(k.oid,false) AS constraint_definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace LEFT JOIN pg_constraint k ON k.oid=t.tgconstraint LEFT JOIN pg_class rc ON rc.oid=k.conrelid WHERE n.nspname='academy' AND c.relname IN ('students','record_versions','record_heads','command_outcomes','catalog_versions','source_catalog_links') AND t.tgisinternal ORDER BY c.relname,t.tgname");
 const stable={tables,columns,constraints,indexes,triggers};need([...Object.values(stable),internal].every(rows=>rows.length<=2048)&&Buffer.byteLength(canonicalJson({...stable,internal}))<=2*1024*1024,'legacy_schema_metadata_cap');
 return {sha256:sha(canonicalJson(stable)),stable,internal};
}
