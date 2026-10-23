import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {maximumPoolImageBytes,poolQuestionContentInputSchema,readPoolQuestionImage,type PoolImageTransport} from '../src/pool-question-content.ts';
import {NativePoolLabelBackend,type PoolReadRunner} from '../src/native-pool-backend.ts';

// A wholly synthetic one-pixel PNG. No Academy item or answer is a test fixture.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const url='https://storage.studyq.net/data/contents/exam/d6-000/d4-00/d2-10/ek-1001/1001-examcard-sbj.png';
const reference={url,type:'sbj' as const};
const imageResponse=(bytes:Uint8Array=png,headers:Record<string,string>={})=>new Response(new Uint8Array(bytes).buffer,{headers:{'Content-Type':'image/png',...headers}});
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

test('one exact qualified image preserves bytes and question identity without claiming a solution role',async()=>{
  const calls:Array<{url:string;init:RequestInit}>=[];
  const result=await readPoolQuestionImage(reference,'1001',async(target,init)=>{calls.push({url:target,init});return imageResponse();});
  expect(calls).toHaveLength(1);expect(calls[0].url).toBe(url);
  expect(calls[0].init).toMatchObject({method:'GET',redirect:'error',credentials:'omit'});
  expect(Object.fromEntries(new Headers(calls[0].init.headers))).toEqual({accept:'image/png'});
  expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  expect(result.metadata).toMatchObject({status:'available',lectureKey:'1001',variant:'sbj',mimeType:'image/png',bytes:png.length,width:1,height:1,
    sha256:createHash('sha256').update(png).digest('hex'),contentRole:'source_variant_role_not_inferred',sourceContentInspectedByAnalyst:false,
    officialSolutionAvailability:'not_established_by_variant_name',credentialsForwarded:false,academyWrites:0,finalItemMembershipCreated:false});
  expect(result.image).toEqual({type:'image',data:png.toString('base64'),mimeType:'image/png'});
});

test('arbitrary destinations, credential URLs, changed variants and different question IDs are refused before transport',async()=>{
  let calls=0;const transport:PoolImageTransport=async()=>{calls++;throw Error('unexpected_transport');};
  const wrongUrls=[url.replace('https:','http:'),url.replace('storage.studyq.net','storage.studyq.net.evil.test'),url.replace('https://','https://user:pass@'),
    `${url}?token=untrusted`,`${url}#fragment`,url.replace('d2-10','d2-11'),url.replaceAll('1001','1002'),url.replace('-sbj.png','-obj.png')];
  for(const wrong of wrongUrls)await expect(readPoolQuestionImage({...reference,url:wrong},'1001',transport)).rejects.toThrow('pool_content_exact_source_reference_required');
  for(const invalid of ['0','01001','-1','1000000000','1001/../1002'])await expect(readPoolQuestionImage(reference,invalid,transport)).rejects.toThrow('pool_content_question_identity_invalid');
  expect(calls).toBe(0);
  expect(poolQuestionContentInputSchema.safeParse({hierarchyId:'h',labelId:'l',lectureKey:'1001',variant:'sbj',purpose:'teacher_requested_review',url}).success).toBe(false);
});

test('redirects, unsuccessful replies, missing bodies and non-PNG media types cannot become image evidence',async()=>{
  const redirected=imageResponse();Object.defineProperty(redirected,'redirected',{value:true});
  const cases:Array<[Response,string]>=[
    [new Response(null,{status:302,headers:{Location:'https://example.invalid/elsewhere'}}),'pool_content_source_unavailable'],
    [new Response('authentication required',{status:401}),'pool_content_source_unavailable'],
    [redirected,'pool_content_source_unavailable'],[imageResponse(png,{'Content-Type':'text/html'}),'pool_content_png_required'],
    [new Response(null,{headers:{'Content-Type':'image/png'}}),'pool_content_body_missing']
  ];
  for(const [response,error]of cases)await expect(readPoolQuestionImage(reference,'1001',async()=>response)).rejects.toThrow(error);
});

test('declared size and streamed size are bounded independently, with cancellation on overflow',async()=>{
  for(const length of [String(maximumPoolImageBytes+1),'NaN','-1','1e7']){
    await expect(readPoolQuestionImage(reference,'1001',async()=>imageResponse(png,{'Content-Length':length}))).rejects.toThrow('pool_content_size_limit');
  }
  let cancelled=false;
  const body=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(maximumPoolImageBytes));controller.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
  await expect(readPoolQuestionImage(reference,'1001',async()=>new Response(body,{headers:{'Content-Type':'image/png'}}))).rejects.toThrow('pool_content_size_limit');
  expect(cancelled).toBe(true);
});

test('malformed signatures, incomplete PNGs and excessive image dimensions are refused',async()=>{
  for(const bytes of [Buffer.from('<html>login required</html>'),Buffer.from(png).fill(0,0,8),Buffer.from(png).fill(0,12,16),png.subarray(0,24),png.subarray(0,png.length-12)]){
    await expect(readPoolQuestionImage(reference,'1001',async()=>imageResponse(bytes))).rejects.toThrow(/^pool_content_png_/);
  }
  const badCrc=Buffer.from(png);badCrc[badCrc.length-1]^=1;
  await expect(readPoolQuestionImage(reference,'1001',async()=>imageResponse(badCrc))).rejects.toThrow('pool_content_png_crc_invalid');
  for(const [width,height]of [[0,1],[1,0],[10001,1],[1,10001],[8000,8000]]){
    const bytes=Buffer.from(png);bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);
    // Preserve IHDR integrity so this exercises dimension limits, independently of CRC rejection.
    bytes.writeUInt32BE(crc32(bytes.subarray(12,29)),29);
    await expect(readPoolQuestionImage(reference,'1001',async()=>imageResponse(bytes))).rejects.toThrow('pool_content_dimensions_limit');
  }
});

const sha='a'.repeat(64),observedAt='2026-10-19T00:00:00Z';
const grade={cl1:3,cl2:0,cl3:0,cl4:0},book={cl1:3,cl2:20,cl3:0,cl4:0},unit={cl1:3,cl2:20,cl3:21,cl4:0};
function nativeFixture(qualification:'qualified_original_source'|'source_changed_unqualified'='qualified_original_source'){
  let questionCalls=0,imageCalls=0;
  const run:PoolReadRunner=async request=>{
    let page:unknown;
    if(request.operation==='categories'){
      const scope=request.scope.cl2?unit:request.scope.cl1?book:grade;
      page={sourceOperation:'test_pool_category_list',sourceSha256:sha,observedAt,selectorSha256:sha,
        selectorDefaults:{make_school_key:'1',category_iden:'1',categ_type:'3'},scope:request.scope,
        nodes:[{scope,title:'Synthetic scope',nativeKey:Object.values(scope).filter(Boolean).at(-1),isLazy:true,isFolder:true}],sourceHandlersExecuted:false,academyWrites:0};
    }else if(request.operation==='labels')page={sourceOperation:'test_pool_type_labels',sourceSha256:sha,observedAt,selectorSha256:sha,
      template:{sourceSha256:sha,queryFields:[]},categoryIden:'1',scope:request.scope,labels:[{nativeId:31,labelExact:'Synthetic type',sourceQuestionCountRaw:2}],
      wireFormat:'sentinel_framed_body',payloadSha256:sha,coverage:'returned_scoped_response_only',wholePoolCompleteness:'unknown',sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false};
    else if(request.operation==='questions'){
      questionCalls++;
      page={sourceOperation:'test_pool_type_questions',sourceSha256:sha,selectorSha256:sha,observedAt,scope:unit,patNo:'31',labelExact:'Synthetic type',templateSha256:sha,
        page:1,totalPages:1,sourceRecordCount:2,sourcePageSize:50,sourceRowCount:2,offset:0,nextOffset:null,
        questions:['1001','1002'].map(lectureKey=>({sourceNamespace:'academy_item',lectureKey,patNo:'31',labelExact:'Synthetic type',unitNameExact:'Synthetic unit',sourceFields:{},
          previewReferences:[{type:'sbj',url:url.replaceAll('1001',lectureKey),source:'original_previewDBExam_and_common_function_js',contentFetched:false}]})),
        previewReferencesState:qualification,coverage:'returned_type_page_only',questionContent:'source_metadata_and_answer_only',sourceOrderPreserved:true,sourceHandlersExecuted:false,academyWrites:0,finalItemMembershipCreated:false};
    }else throw Error('unexpected_fixture_operation');
    return {status:'observed',page,requests:1,academyWrites:0,passwordExported:false,cookiesExported:false};
  };
  const backend=new NativePoolLabelBackend(run,async()=>{imageCalls++;return imageResponse();});
  return {backend,counters:()=>({questionCalls,imageCalls})};
}
async function exposeType(backend:NativePoolLabelBackend){
  let page:any=await backend.scope({});for(let i=0;i<2;i++)page=await backend.scope({parentId:page.nodes[0].id});
  const hierarchyId=page.nodes[0].id;const labels:any=await backend.scope({view:'labels',hierarchyId});
  return {hierarchyId,labelId:labels.labels[0].id,purpose:'teacher_requested_review' as const};
}

test('question content requires actually exposed hierarchy, type and question tuple, not a cached hidden row',async()=>{
  const {backend,counters}=nativeFixture();const handle=await exposeType(backend);
  const input={...handle,lectureKey:'1001',variant:'sbj'};
  await expect(backend.content(input)).rejects.toThrow('exact_previously_returned_question_required');
  await expect(backend.review({...handle,offset:3,limit:1})).rejects.toThrow('question_offset_out_of_range');
  await expect(backend.content(input)).rejects.toThrow('exact_previously_returned_question_required');
  await backend.review({...handle,limit:1});
  await expect(backend.content({...input,lectureKey:'1002'})).rejects.toThrow('exact_previously_returned_question_required');
  await expect(backend.content({...input,hierarchyId:'invented'})).rejects.toThrow('exact_previously_returned_question_required');
  await expect(backend.content({...input,labelId:'invented'})).rejects.toThrow('exact_previously_returned_question_required');
  const absent=await backend.content({...input,variant:'des'});expect(absent.metadata).toMatchObject({status:'unavailable',reason:'question_preview_reference_not_source_qualified',academyRequests:0});
  expect(counters()).toEqual({questionCalls:1,imageCalls:0});
  expect((await backend.content(input)).metadata.status).toBe('available');
  await backend.review({...handle,offset:1,limit:1});
  expect((await backend.content({...input,lectureKey:'1002'})).metadata.lectureKey).toBe('1002');
  expect(counters()).toEqual({questionCalls:1,imageCalls:2});
});

test('source-changed preview state cannot authorize content even when a contradictory reference is present',async()=>{
  const {backend,counters}=nativeFixture('source_changed_unqualified');const handle=await exposeType(backend);
  await backend.review({...handle,limit:1});
  const result=await backend.content({...handle,lectureKey:'1001',variant:'sbj'});
  expect(result.metadata).toMatchObject({status:'unavailable',reason:'question_preview_reference_not_source_qualified',academyRequests:0,academyWrites:0});
  expect(counters().imageCalls).toBe(0);
});
