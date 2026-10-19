import {readFileSync} from 'node:fs';
import {AcademyHttpClient} from '../src/lms/academyHttpClient';
import {testPoolReadRequest} from '../src/lms/testPoolReadProtocol';

/** Runs only as an explicit native credential child. It never reads or writes DB/auth/session stores. */
if(process.argv.includes('--help')){console.log(JSON.stringify({scope:'read_only_TestPool_metadata_and_labels',credentialOwner:'supported_native_profile_getter',
  operations:['index','--tab-document','--selector-document','--category-tree','--probe-label-schema','--question-protocol','--presentation-protocol'],
  nativeRequestOperations:['categories','labels','questions','protocol'],sourceHandlersExecuted:false,sourceWrites:false}));process.exit(0);}
if(process.env.HERMES_HOME!=='/opt/data/profiles/dc-gang-a-dev'||!process.env.DC_ACADEMY_HTTP_PASSWORD)throw Error('supported_native_credential_child_required');
const requestedRead=process.env.ACADEMY_POOL_READ_REQUEST?testPoolReadRequest(JSON.parse(process.env.ACADEMY_POOL_READ_REQUEST)):null;
const owner=JSON.parse(readFileSync('/opt/data/profiles/dc-gang-a-dev/academy/owner.json','utf8'));
if(!owner.sourceUsername)throw Error('native_http_identifier_required');
let requests=0;const operations:Record<string,number>={};
const transport=async(url:string,init:RequestInit)=>{
  const target=new URL(url);operations[target.pathname]=(operations[target.pathname]??0)+1;requests++;
  return fetch(url,init);
};
const client=new AcademyHttpClient({teacherLabel:owner.teacherLabel,teacherKey:owner.teacherSourceKey,collegeKey:owner.collegeSourceKey},transport);
let completedObservation:unknown=null;
try{
  await client.authenticate({username:owner.sourceUsername,password:process.env.DC_ACADEMY_HTTP_PASSWORD});
  let page:unknown;
  if(requestedRead){
    if(requestedRead.operation==='protocol')page=await client.inspectTestPoolPresentationProtocol(requestedRead.expectedSelectorSha256);
    else if(requestedRead.operation==='categories')page=await client.inspectTestPoolCategoryTree(requestedRead.scope,requestedRead.expectedSelectorSha256);
    else if(requestedRead.operation==='questions')page=await client.readTestPoolQuestions(requestedRead.scope,requestedRead.patNo,requestedRead.page,requestedRead.limit,requestedRead.expectedSelectorSha256,requestedRead.offset);
    else page=await client.readTestPoolTypeLabels(requestedRead.scope,requestedRead.expectedSelectorSha256);
  }else if(process.argv.includes('--probe-label-schema')){
    const root=await client.inspectTestPoolCategoryTree();
    const grade=root.nodes.find(node=>node.title==='초3');if(!grade)throw Error('requested_grade_source_node_missing');
    let node=grade;const path=[node];completedObservation={purpose:'schema_probe_not_teacher_exam_scope',path};
    while(!node.scope.cl3){if(path.length>=4)throw Error('test_pool_probe_depth_limit');
      const next=(await client.inspectTestPoolCategoryTree(node.scope)).nodes[0];if(!next)throw Error('test_pool_probe_source_children_unknown');
      node=next;path.push(node);}
    const labels=await client.readTestPoolTypeLabels(node.scope);
    page={purpose:'bounded_live_label_schema_probe_not_teacher_exam_scope',path,labelResult:labels,examUnitScope:'not_selected'};
  }else page=process.argv.includes('--presentation-protocol')?await client.inspectTestPoolPresentationProtocol():process.argv.includes('--question-protocol')?await client.inspectTestPoolQuestionProtocol():process.argv.includes('--category-tree')?await client.inspectTestPoolCategoryTree():process.argv.includes('--selector-document')?await client.inspectTestPoolSelector():process.argv.includes('--tab-document')?await client.inspectTestPoolTab():await client.inspectTestPoolIndex();
  console.log(JSON.stringify({status:'observed',authentication:'fresh_supported_native_getter',page,requests,operations,
    passwordExported:false,cookiesExported:false,rawSourceRetained:false,academyWrites:0,directDatabaseConnections:0}));
}catch(error){console.log(JSON.stringify({status:'blocked',code:error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'test_pool_inspection_failed',
  requests,operations,completedObservation,safeResponseMetadata:(error as {safeResponseMetadata?:unknown}).safeResponseMetadata,
  automaticRetryAllowed:false,passwordExported:false,cookiesExported:false,academyWrites:0}));process.exitCode=1;}
finally{client.close();}
