import {expect,test} from 'bun:test';
import {parseItemMetadata,readItemMetadata} from '../../src/lms/itemMetadataRead';
const body=()=>({result:'OK',rows:[{id:8101,lecture_key:8101,outer_lecture_key:8201,stage_id:'invented:stage',pat_no:8301,pat_name:'Invented pattern',unit_name:'Invented unit',difficulty:2,play_seconds:90,examtext_key:8401,answer:'Invented answer',obj_option:'',sbj_option:'',des_option:'',sel_type:'1',text_height:20,exam_size_list:'',use_log:''}]});
test('binds literal item identities and returns source metadata without student or mastery inference',()=>{
  const item=parseItemMetadata(body(),'8101');
  expect(item).toMatchObject({identity:{sourceNamespace:'academy_item',lectureKey:'8101',outerLectureKey:'8201',sourceId:'8101'},sourceUnitName:'Invented unit',sourcePatternName:'Invented pattern',sourcePlaySeconds:90});
  expect(item).not.toHaveProperty('answer');expect(item).not.toHaveProperty('studentKey');expect(item.conceptMapping).toBe('unverified');
});
test('rejects wrong item keys, duplicate/missing rows and unrecognized success markers',()=>{
  for(const bad of [{...body(),result:'ok'},{...body(),rows:[]},{...body(),rows:[...body().rows,...body().rows]},
    {...body(),rows:[{...body().rows[0],lecture_key:8102}]}])expect(()=>parseItemMetadata(bad,'8101')).toThrow();
});
test('uses one reviewed fixed operation without cookies, generation or arbitrary URL input',async()=>{
  const calls:{url:string,init:RequestInit}[]=[];
  const item=await readItemMetadata('8101',{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(body());}});
  expect(item.identity.lectureKey).toBe('8101');expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toBe('/servlet/controller.common.TestPageShowExServlet?p_process=GetLectureList&lecture_list=8101');
  expect(calls[0]!.init).toMatchObject({method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store'});
  let called=false;
  await expect(readItemMetadata('08101',{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,fetcher:async()=>{called=true;throw Error('not_called')}})).rejects.toThrow();
  await expect(readItemMetadata('8101',{origin:'https://foreign.example',authenticatedTeacherVisible:true,fetcher:async()=>{called=true;throw Error('not_called')}})).rejects.toThrow('authentication_required');
  expect(called).toBe(false);
});

test('request keys require literal strings even though source responses use numeric keys',async()=>{
  let called=false;
  await expect(readItemMetadata(8101 as unknown as string,{origin:'https://dc.gang-a.kr',authenticatedTeacherVisible:true,
    fetcher:async()=>{called=true;return Response.json(body());}})).rejects.toThrow('invalid_item_request_key');
  expect(called).toBe(false);
});
