import {JSDOM} from 'jsdom';
import {randomInt} from 'node:crypto';
import {createAcademyReadPlan,executeAcademyRead,readInputRecord,readLiteralKey,readLiteralName,sourceResponseKey,parseTextbookScopeBinding,type AcademyReadResult,type ScopedAcademyReadPlan} from './academyReadProtocol';
import {currentDayRecordColumns} from './dayRecordColumnContract';
import type {SourceDiscoveryRequest} from '../academy/nativeBookSource';
import {canonicalJson,digest,assertExactKeys} from '../learning/model';
import {applyJournalHttpAction,validateJournalHttpAction,assertJournalWireQualified,assertJournalAssessmentOptions,JOURNAL_HTTP_SOURCE_CONTRACT,type JournalHttpTarget,type JournalHttpState,type JournalHttpAction,type JournalHttpAdmission} from './lessonJournalHttp';
import {parseItemMetadata} from './itemMetadataRead';
import {selectSourceFunction} from './sourceFunctionText';
import {inspectAssessmentSearchMetadata} from './assessmentReadProtocol';

export const ACADEMY_ORIGIN='https://dc.gang-a.kr' as const;
export interface AcademyPrincipal {teacherLabel:string;teacherKey:string;collegeKey:string}
export interface AcademyCredential {username:string;password:string}
export type SourceTransport=(url:string,init:RequestInit)=>Promise<Response>;
/** Failure metadata deliberately excludes URL parameters, bodies, headers and session values. */
export class AcademyHttpFailure extends Error {
  constructor(readonly httpStatus:number,readonly sourceOperation:string){super('source_http_failed');this.name='AcademyHttpFailure';}
}
/** Inert standards DOM: no resources, scripts or event handlers execute. */
export const sourceDomParser={parseFromString:(text:string,mime:DOMParserSupportedType):Document=>new JSDOM(text,{contentType:mime}).window.document as unknown as Document};
/** Fresh client-issued session only. No vault/cookie export, persistent jar or automatic login retry. */
export class AcademyHttpClient {
  #cookies=new Map<string,{value:string;path:string}>();
  #authenticated=false;
  #loginAttempted=false;
  #principal:AcademyPrincipal;
  #transport:SourceTransport;
  constructor(principal:AcademyPrincipal,transport:SourceTransport=fetch){
    this.#principal={teacherLabel:readLiteralName(principal.teacherLabel),teacherKey:readLiteralKey(principal.teacherKey),collegeKey:readLiteralKey(principal.collegeKey)};
    this.#transport=transport;
  }
  get authenticated(){return this.#authenticated;}
  close(){this.#cookies.clear();this.#authenticated=false;}
  async #request(path:string,init:RequestInit={},followLoginRedirect=false,sourceOperation?:string):Promise<Response>{
    const url=new URL(path,ACADEMY_ORIGIN);
    if(url.origin!==ACADEMY_ORIGIN||url.username||url.password||url.hash)throw Error('fixed_academy_origin_required');
    const headers=new Headers(init.headers);
    if(headers.has('cookie')||headers.has('authorization'))throw Error('caller_credentials_rejected');
    const cookie=[...this.#cookies].filter(([,v])=>url.pathname.startsWith(v.path)).map(([k,v])=>k+'='+v.value).join('; ');
    if(cookie)headers.set('Cookie',cookie);
    headers.set('Origin',ACADEMY_ORIGIN);headers.set('Referer',ACADEMY_ORIGIN+'/c_login.jsp');
    let response:Response;
    try{response=await this.#transport(url.href,{...init,headers,redirect:'manual',cache:'no-store',signal:init.signal??AbortSignal.timeout(20000)});}catch{throw Error('academy_transport_failed');}
    for(const raw of response.headers.getSetCookie()){
      const [pair,...attributes]=raw.split(';');const equal=pair!.indexOf('=');const name=pair!.slice(0,equal).trim(),value=pair!.slice(equal+1);
      if(equal<1||name!=='JSESSIONID')continue;
      const domain=attributes.find(x=>/^\s*domain=/i.test(x))?.split('=')[1]?.trim().replace(/^\./,'');
      if(domain&&domain!=='dc.gang-a.kr')throw Error('foreign_session_cookie_rejected');
      const pathValue=attributes.find(x=>/^\s*path=/i.test(x))?.slice(attributes.find(x=>/^\s*path=/i.test(x))!.indexOf('=')+1).trim()??'/';
      if(!pathValue.startsWith('/')||/[\r\n;]/.test(value))throw Error('session_cookie_contract_rejected');
      if(!value||attributes.some(x=>/^\s*max-age=0\s*$/i.test(x)))this.#cookies.delete(name);else this.#cookies.set(name,{value,path:pathValue});
    }
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');if(!location)throw Error('source_redirect_contract_rejected');
      const next=new URL(location,url);
      if(next.origin!==ACADEMY_ORIGIN||next.username||next.password||next.hash)throw Error('foreign_source_redirect_rejected');
      if(!followLoginRedirect)throw Error('source_redirect_rejected');
      return this.#request(next.href,{method:'GET'},false);
    }
    if(!response.ok)throw new AcademyHttpFailure(response.status,sourceOperation??(url.pathname==='/c_login.jsp'?'login_document':url.pathname==='/servlet/controller.login.LoginServlet'?'login_submission':'owned_source_request'));
    return response;
  }
  async authenticate(credential:AcademyCredential){
    if(this.#loginAttempted)throw Error('fresh_authentication_attempt_required');this.#loginAttempted=true;
    if(typeof credential.username!=='string'||!credential.username||typeof credential.password!=='string'||!credential.password)throw Error('native_http_credentials_required');
    try{
      const html=await (await this.#request('/c_login.jsp')).text();
      const doc=sourceDomParser.parseFromString(html,'text/html'),form=doc.querySelector('form#loginForm');
      const names=['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'];
      if(!form||form.getAttribute('method')?.toLowerCase()!=='post'
        ||names.some(name=>!form.querySelector('[name='+name+']'))
        ||!html.includes('document.loginForm.action = "/servlet/controller.login.LoginServlet"')
        ||!html.includes('document.loginForm.p_process.value = "c_login"'))throw Error('login_wire_contract_drift');
      const alphabet='abcdefghijklmnopqrstuvwxyz0123456789';
      const encode=(literal:string)=>Buffer.from(literal+'  '+Array.from({length:30},()=>alphabet[randomInt(alphabet.length)]).join(''),'utf8').toString('base64');
      const body=new URLSearchParams({p_process:'c_login',p_prino:'',p_groupno:'',cf_pc:'',cf_user:'',autoLoginCheck:'',autoLoginKey:'',userid:encode(credential.username),userpwd:encode(credential.password)});
      await this.#request('/servlet/controller.login.LoginServlet',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()},true);
      const current=sourceDomParser.parseFromString(await (await this.#request('/servlet/controller.coursemanage.CourseManageServlet?reqCmd=StudyCourse')).text(),'text/html');
      const value=(selector:string)=>current.querySelector<HTMLInputElement>(selector)?.value;
      if(current.querySelector('input[type=password]'))throw Error('source_login_challenge');
      if(value('form[name=userForm] [name=pri_no]')!==this.#principal.teacherKey)throw Error('teacher_user_principal_conflict');
      if(value('form[name=form1] [name=g_pri_no]')!==this.#principal.teacherKey)throw Error('teacher_course_principal_conflict');
      if(value('form[name=form1] [name=g_clg_no]')!==this.#principal.collegeKey)throw Error('teacher_college_conflict');
      if(!value('form[name=form1] [name=g_mem_type]'))throw Error('teacher_member_type_missing');
      // StudyCourse's current account menu says "내정보", not the teacher's name.
      // The two independent opaque principal fields above establish identity.
      if(![...current.querySelectorAll('a,span')].some(node=>/로그아웃/.test(node.textContent??'')))throw Error('teacher_logout_marker_drift');
      this.#authenticated=true;
      return {state:'authenticated' as const,principalKey:this.#principal.teacherKey,collegeKey:this.#principal.collegeKey,transport:'direct_http_api' as const};
    }catch(error){this.close();throw error;}
  }
  async discoverBooks(input:SourceDiscoveryRequest){
    if(input.teacherLabel!==this.#principal.teacherLabel||input.teacherKey!==this.#principal.teacherKey||input.collegeKey!==this.#principal.collegeKey)throw Error('source_principal_drift');
    if(!Array.isArray(input.studentNames)||!input.studentNames.length||input.studentNames.length>64||new Set(input.studentNames).size!==input.studentNames.length)throw Error('invalid_source_scope');
    input.studentNames.forEach(readLiteralName);if(!this.#authenticated)throw Error('authentication_required');
    const fetchDocument=async(path:string,init:RequestInit={})=>{
      const response=await this.#request(path,init),html=await response.text();
      if(html.length>2000000||/webUserPass|세션이 만료/.test(html))throw Error('source_contract_refused');
      return sourceDomParser.parseFromString(html,'text/html');
    };
    const endpoint='/servlet/controller.coursemanage.CourseManageServlet';
    const initial=await fetchDocument(endpoint+'?reqCmd=StudyCourse');
    const value=(name:string)=>initial.querySelector<HTMLInputElement>('form[name=form1] [name='+name+']')?.value;
    const principal=value('g_pri_no'),college=value('g_clg_no'),memberType=value('g_mem_type');
    if(principal!==input.teacherKey||college!==input.collegeKey||!memberType)throw Error('source_principal_drift');
    const students=[];
    for(const name of input.studentNames){
      const query=new URLSearchParams({reqCmd:'StudyCourse',clg_no:college,cls_no:'0',grade_no:'0',student_name:name});
      const current=await fetchDocument(endpoint+'?'+query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({reqCmd:'StudyCourse',g_clg_no:college,g_pri_no:principal,g_mem_type:memberType,cls_no:'0',grade_no:'0',student_name:name}).toString()});
      if(current.querySelector<HTMLInputElement>('form[name=form1] [name=g_pri_no]')?.value!==principal||current.querySelector<HTMLInputElement>('form[name=form1] [name=g_clg_no]')?.value!==college)throw Error('source_principal_drift');
      const courseRows=[...current.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>/^\s*onChangeStatus\(/.test(element.getAttribute('onclick')??''))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),handlers:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(v=>/^\s*(onChangeStatus|onResetCourse|onDeleteCourse)\(/.test(v))}));
      const books=await fetchDocument('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({student_name:name}).toString()});
      const bookRows=[...books.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>(element.getAttribute('onclick')??'').includes('createBookIncorrectPapers('))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),bindings:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(v=>v.includes('createBookIncorrectPapers('))}));
      students.push({name,courseRows,bookRows,observedAt:new Date().toISOString()});
    }
    return {schemaVersion:1,teacherLabel:input.teacherLabel,principalKey:principal,collegeKey:college,source:'direct_http_api',observedAt:new Date().toISOString(),academyMutations:0,students};
  }
  async inspectDayRecordWire(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='day_record'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('day_record_wire_scope_required');
    const output=[];
    for(const groupId of plan.request.groupIds){
      const response=await this.#readRequest(plan,'/servlet/controller.cct.tutor.DayRecordServlet',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({p_process:'Main',std_ymd:plan.request.date.replaceAll('-',''),grp_seq:groupId}).toString()});
      const html=await response.text();if(html.length>2000000)throw Error('source_response_too_large');
      const doc=sourceDomParser.parseFromString(html,'text/html');
      const functions:Record<string,string>={};
      for(const script of doc.querySelectorAll('script')){
        const source=script.textContent??'';
        for(const name of ['onAttn','onFoPrg','onFoHw','onFoMm','setDailyTest','openHomeWorkRate','reallength']){
          const match=new RegExp('function\\s+'+name+'\\s*\\(').exec(source);if(!match)continue;
          const next=/\n\s*function\s+/.exec(source.slice(match.index+match[0].length));
          const end=next?match.index+match[0].length+next.index:source.length;
          const definition=source.slice(match.index,end).trim();if(definition.length>20000)throw Error('source_handler_selection_too_large');functions[name]=definition;
        }
      }
      const popupEvents:string[]=[];
      for(const script of doc.querySelectorAll('script')){
        const lines=(script.textContent??'').split('\n');const selected=new Set<number>();
        for(let i=0;i<lines.length;i++)if(/SetDailyTest|SetHomeWorkRate|daily_test_radio|homework_radio|CourseCommonServlet|daily_test_confirm|homework_confirm/.test(lines[i]!))
          for(let n=Math.max(0,i-12);n<=Math.min(lines.length-1,i+14);n++)selected.add(n);
        if(selected.size)popupEvents.push([...selected].sort((a,b)=>a-b).map(i=>lines[i]).join('\n'));
      }
      const rows=[...doc.querySelectorAll('[onclick]')].filter(node=>plan.request.studentNames.includes(node.textContent?.trim()??'')&&(node.getAttribute('onclick')??'').includes('onOpenDaysMain')).map(node=>{
        let row=node.closest('tr');while(row&&![...row.querySelectorAll('[onfocusout]')].some(e=>(e.getAttribute('onfocusout')??'').includes('onFoPrg(')))row=row.parentElement?.closest('tr')??null;
        return {studentName:node.textContent?.trim(),controls:row?[...row.querySelectorAll('input,select,textarea,[onclick]')].map(e=>({id:e.id,name:e.getAttribute('name'),type:e.getAttribute('type'),value:['INPUT','SELECT','TEXTAREA'].includes(e.tagName)?(e as HTMLInputElement).value:null,handler:e.getAttribute('onclick')??e.getAttribute('onfocusout')??e.getAttribute('onchange')})):[]};
      });
      const assessmentOptions=[...doc.querySelectorAll<HTMLInputElement>('input[name=homework_radio],input[name=daily_test_radio]')].map(node=>({field:node.name,value:node.value,label:(node.closest('td')?.textContent??node.parentElement?.textContent??'').replace(/\s+/g,' ').trim()}));
      output.push({groupId,date:plan.request.date,sourceHandlersInvoked:false as const,functions,popupEvents,rows,assessmentOptions});
    }
    return output;
  }
  async inspectStudentPaperForm(input:{teacherLabel:string;studentName:string;studentKey:string}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey']);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('student_paper_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    // Canonical UserByMain read shell only: no guessed student-filter request or branch row retention.
    const response=await this.#request('/servlet/controller.tutor.base.TestPageListServlet?p_process=UserByMain&ass_no=1001',{method:'GET'});
    const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('student_paper_source_rejected');
    const doc=sourceDomParser.parseFromString(text,'text/html');if(doc.querySelector('input[type=password]'))throw Error('source_login_challenge');
    const forms=[...doc.querySelectorAll('form')].map(form=>({name:form.getAttribute('name'),action:form.getAttribute('action'),method:form.getAttribute('method'),fields:[...new Set([...form.querySelectorAll('[name]')].map(e=>e.getAttribute('name')!))]}));
    const functions:string[]=[],fieldAssignments:string[]=[],searchFunctions:Record<string,string>={};
    for(const script of doc.querySelectorAll('script')){
      const code=script.textContent??'';for(const match of code.matchAll(/function\s+(\w+)\s*\(/g))functions.push(match[1]!);
      for(const line of code.split('\n'))if(line.length<512&&/^\s*document\.\w+\.\w+\.(value|action|method)\s*=/.test(line)&&!/pwd|pass|cookie|JSON\.parse/i.test(line))fieldAssignments.push(line.trim());
      for(const name of ['goPage','onSearchPage','onClsChange','onStudentNameKeyDown']){const selected=selectSourceFunction(code,name);if(selected)searchFunctions[name]=selected;}
    }
    return {sourceOperation:'UserByMain' as const,requestedStudent:input,forms,functions:[...new Set(functions)],fieldAssignments,searchFunctions,studentRowsRetained:0 as const,filteredStudentReadQualified:false as const,handlersInvoked:false as const};
  }
  async searchStudentPaperMetadata(input:{teacherLabel:string;studentName:string;studentKey:string}){
    assertExactKeys(input,['teacherLabel','studentName','studentKey']);readLiteralName(input.studentName);readLiteralKey(input.studentKey);
    if(input.teacherLabel!==this.#principal.teacherLabel)throw Error('student_paper_principal_conflict');if(!this.#authenticated)throw Error('authentication_required');
    const path='/servlet/controller.tutor.base.TestPageListServlet';
    const initial=await (await this.#request(path+'?p_process=UserByMain&ass_no=1001',{method:'GET'})).text();
    if(initial.length>2000000)throw Error('student_paper_source_rejected');const doc=sourceDomParser.parseFromString(initial,'text/html');
    if(doc.querySelector('form[name=userForm] [name=pri_no]')?.getAttribute('value')!==this.#principal.teacherKey)throw Error('student_paper_owner_drift');
    const form=doc.querySelector<HTMLFormElement>('form[name=search]');if(!form||form.getAttribute('method')?.toLowerCase()!=='post')throw Error('student_paper_search_method_drift');
    const definitions=[...doc.querySelectorAll('script')].map(s=>selectSourceFunction(s.textContent??'','onSearchPage')).filter(Boolean);
    if(definitions.length!==1||digest(definitions[0])!=='e1973c2ee678d321fd81c351e75f9af7e254aef077befe59ad1e649bb2cb6f09')throw Error('student_paper_search_wire_drift');
    const body=new URLSearchParams();
    for(const name of ['clg_no','cls_no','p_pageno','check_da_test','check_fa_test','check_na_test','stu_name','chioce_cls','sort_date1','sort_date2']){
      const nodes=form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[name='+name+']');if(nodes.length!==1)throw Error('student_paper_filter_drift');const node=nodes[0]!;
      if(node.getAttribute('type')==='checkbox'&&!(node as HTMLInputElement).checked)continue;body.set(name,node.value);
    }
    if(body.get('clg_no')!==this.#principal.collegeKey||input.studentName.length<2)throw Error('student_paper_college_scope_conflict');
    body.set('stu_name',input.studentName);body.set('p_pageno','1');body.set('cls_no',body.get('chioce_cls')!);
    const response=await this.#request(path+'?p_process=UserBySearchTestResult&ass_no=1001',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()});
    const html=await response.text();if(html.length>2000000)throw Error('student_paper_response_too_large');const selected=sourceDomParser.parseFromString(html,'text/html');
    if(selected.querySelector('form[name=userForm] [name=pri_no]')?.getAttribute('value')!==this.#principal.teacherKey)throw Error('student_paper_owner_drift');
    return {...inspectAssessmentSearchMetadata(html,input),operation:'UserBySearchTestResult',page:1,sourcePeriod:{from:body.get('sort_date1'),to:body.get('sort_date2')},observedAt:new Date().toISOString(),browserRequests:0,academyWrites:0};
  }
  async inspectTextbookIndex(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='textbook'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('textbook_index_scope_required');
    const post=async(path:string,fields:Record<string,string>)=>{
      const response=await this.#readRequest(plan,path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'},body:new URLSearchParams(fields).toString()});
      const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('textbook_index_source_rejected');return text;
    };
    const request=plan.request;
    const progress=await post('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{student_name:request.studentName});
    parseTextbookScopeBinding(progress,request);
    const data=readInputRecord(JSON.parse(await post('/servlet/controller.common.TestpageSelectExServlet',{
      p_process:'getWrongAnswerNoteResult',answerNoteResult:JSON.stringify({courseKeyList:[request.courseKey],bookNoList:[request.bookNo],userKeyList:[request.studentKey]}),
    })));
    if(data.result!=='ok'||!Array.isArray(data.noteResultList)||data.noteResultList.length>1000)throw Error('wrong_note_contract_rejected');
    const identities=new Set<string>();
    const rows=data.noteResultList.map(readInputRecord).map(row=>{
      if(sourceResponseKey(row.pri_no)!==request.studentKey||row.name!==request.studentName)throw Error('source_subject_conflict');
      const paperKey=sourceResponseKey(row.p_no),attemptKey=sourceResponseKey(row.testing_no),identity=JSON.stringify([paperKey,attemptKey]);
      if(identities.has(identity))throw Error('ambiguous_textbook_index');identities.add(identity);
      return {sourceTitle:readLiteralName(row.testing_name),paperKey,attemptKey,fieldNames:Object.keys(row).sort(),sourceDate:{literal:typeof row.apply_date==='string'?row.apply_date:null,meaning:'source_apply_date_not_exact_grade_time' as const}};
    });
    return {schemaVersion:1,sourceOperation:'getWrongAnswerNoteResult' as const,scope:{teacherLabel:request.teacherLabel,studentKey:request.studentKey,studentName:request.studentName,courseKey:request.courseKey,bookNo:request.bookNo},rows,rowCount:rows.length,sourceHandlersInvoked:false as const,generatedPaperMembership:'unqualified' as const,observedAt:new Date().toISOString()};
  }
  async inspectItemHeader(input:unknown){
    const plan=createAcademyReadPlan(input);
    if(plan.family!=='item_metadata'||plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('item_header_scope_required');
    const query=new URLSearchParams({p_process:'GetLectureList',lecture_list:plan.request.lectureKey});
    const response=await this.#readRequest(plan,'/servlet/controller.common.TestPageShowExServlet?'+query,{method:'GET'});
    const text=await response.text();if(text.length>2000000)throw Error('item_header_response_rejected');
    const raw=JSON.parse(text),metadata=parseItemMetadata(raw,plan.request.lectureKey),row=raw.rows[0] as Record<string,unknown>;
    const fieldNames=Object.keys(row).sort(),candidateFields:Record<string,string|number>={};
    for(const key of ['pat_no','pat_seq','pat_order','type_no','type_num','type_seq','type_order','book_no','unit_no','unit_seq']){
      const value=row[key];if(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<200)candidateFields[key]=value as string|number;
    }
    return {metadata,fieldNames,candidateFields,printedTypeOrdinal:'not_qualified' as const,generatedPaperMembership:'unqualified' as const,answersRetained:false as const};
  }
  async journalState(target:JournalHttpTarget):Promise<JournalHttpState>{
    if(target.teacherKey!==this.#principal.teacherKey)throw Error('journal_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const request={family:'day_record',teacherLabel:this.#principal.teacherLabel,date:target.date,groupIds:[target.groupId],studentNames:[target.studentName]};
    const result=await this.execute(request);const row=result.dayRecords.find(r=>r.studentName===target.studentName);
    if(!row)throw Error('journal_target_not_observed');
    const {fields,...identity}=row;if(canonicalJson(identity)!==canonicalJson(target))throw Error('journal_target_conflict');
    const wire=(await this.inspectDayRecordWire(request))[0];const controls=wire?.rows.find(r=>r.studentName===target.studentName)?.controls;
    if(!wire||!controls)throw Error('journal_wire_not_observed');
    const wireDigest=digest({functions:wire.functions,popupEvents:wire.popupEvents,assessmentOptions:wire.assessmentOptions});assertJournalWireQualified(wireDigest);
    assertJournalAssessmentOptions(wire.assessmentOptions);
    for(const [handler,selector] of [['onAttn','udtAttn'],['onFoPrg','udtPrg'],['onFoHw','udtHw'],['onFoMm','udtMemo'],['setDailyTest','SetDailyTest'],['openHomeWorkRate','SetHomeWorkRate']])
      if(!wire.functions[handler!] || !wire.functions[handler!].includes('reqCmd='+selector))throw Error('journal_wire_drift');
    const assessment=(field:string)=>{const matches=controls.filter(c=>c.name===field);if(matches.length!==1||typeof matches[0]!.value!=='string')throw Error('journal_assessment_not_observed');return matches[0]!.value;};
    const dailyHandlers=controls.map(c=>c.handler??'').filter(h=>/^setDailyTest\(/.test(h));
    const dailyTuple=dailyHandlers.length===1?/^setDailyTest\(([1-9][0-9]*),([1-9][0-9]*),[0-9]+\)$/.exec(dailyHandlers[0]!):null;
    if(!dailyTuple||dailyTuple[1]!==target.recordKey||dailyTuple[2]!==target.membershipKey)throw Error('journal_daily_tuple_conflict');
    const previousHandlers=controls.map(c=>c.handler??'').filter(h=>/^openHomeWorkRate\(/.test(h));
    if(previousHandlers.length!==1)throw Error('journal_previous_tuple_ambiguous');
    const match=/^openHomeWorkRate\(([1-9][0-9]*),([1-9][0-9]*),[0-9]+\)$/.exec(previousHandlers[0]!);
    if(!match||match[2]!==target.membershipKey||match[1]===target.recordKey)throw Error('journal_previous_tuple_conflict');
    const previousRecordKey=readLiteralKey(match[1]);
    const plan=createAcademyReadPlan(request);
    const query=new URLSearchParams({reqCmd:'SelSglRecord',course_seq:target.courseKey,stu_pri_no:target.studentKey,record_seq:previousRecordKey,sel_grp_seq:target.groupId,tut_pri_no:target.teacherKey,cm_seq:target.membershipKey});
    const response=await this.#readRequest(plan,'/servlet/controller.cct.tutor.CourseScheduleServlet?'+query,{method:'GET'});
    const text=await response.text();if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('journal_previous_source_rejected');
    const xml=sourceDomParser.parseFromString(text,'text/xml'),records=xml.querySelectorAll('record'),values=records[0]?.textContent?.split('!');
    if(xml.querySelector('parsererror')||records.length!==1||!values||values[2]!==target.courseKey||values[4]!==target.studentName||values[10]!==previousRecordKey||values[11]!==target.studentKey||values[12]!==target.membershipKey||!values[1]||values[1]>=target.date)throw Error('journal_previous_occurrence_conflict');
    return {target:{...target},fields:{...fields,dailyTestAssessment:assessment('h_daily_test'),previousHomeworkAssessment:assessment('h_homework_rate')},previousRecordKey,previousDate:values[1],wireDigest};
  }
  async applyJournalAction(action:JournalHttpAction,admission:JournalHttpAdmission){
    validateJournalHttpAction(action);
    if(action.target.teacherKey!==this.#principal.teacherKey)throw Error('journal_principal_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    return applyJournalHttpAction(action,{...admission,read:target=>this.journalState(target),write:async selected=>{
      const contract=JOURNAL_HTTP_SOURCE_CONTRACT.fields[selected.field];
      if(contract.method==='GET'){
        const t=selected.target,query=new URLSearchParams({reqCmd:contract.selector,[contract.valueParameter]:selected.after,course_seq:t.courseKey,stu_pri_no:t.studentKey,record_seq:selected.effectRecordKey,cm_seq:t.membershipKey,dummy:new Date().toISOString()});
        await this.#request(contract.path+'?'+query,{method:contract.method});
      }else{
        const body=new URLSearchParams({reqCmd:contract.selector,cm_seq:selected.target.membershipKey,record_seq:selected.effectRecordKey,tutor_pri_no:selected.target.teacherKey,[contract.valueParameter]:selected.after});
        await this.#request(contract.path,{method:contract.method,headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:body.toString()});
      }
    }});
  }
  async execute(input:unknown):Promise<AcademyReadResult>{
    const plan=createAcademyReadPlan(input);
    if(plan.request.teacherLabel!==this.#principal.teacherLabel)throw Error('teacher_scope_conflict');
    if(!this.#authenticated)throw Error('authentication_required');
    const result=await executeAcademyRead(plan,{origin:ACADEMY_ORIGIN,authenticatedTeacherVisible:true,authenticationMode:'direct_http_api',principalKey:this.#principal.teacherKey,
      domParser:sourceDomParser,dayRecordColumnContract:currentDayRecordColumns,fetcher:(url,init)=>this.#readRequest(plan,url,init)});
    if(!this.#authenticated)throw Error('authentication_required');return result;
  }
  async #readRequest(plan:ScopedAcademyReadPlan,path:string,init:RequestInit):Promise<Response>{
    if(!this.#authenticated)throw Error('authentication_required');
    const url=new URL(path,ACADEMY_ORIGIN),query=url.searchParams,body=new URLSearchParams(typeof init.body==='string'?init.body:'');
    const method=init.method??'GET';
    const operation=plan.operations.find(op=>op.path===url.pathname&&op.method===method
      &&(op.selectorPlacement==='query'?query:body).getAll(op.selectorKey).length===1
      &&(op.selectorPlacement==='query'?query:body).get(op.selectorKey)===op.selector);
    if(url.origin!==ACADEMY_ORIGIN||!operation||query.getAll(operation.selectorKey).length+body.getAll(operation.selectorKey).length>2)throw Error('reviewed_read_operation_required');
    let response:Response;
    try{response=await this.#request(path,init,false,operation.selector);}catch(error){
      if(error instanceof AcademyHttpFailure&&[401,403].includes(error.httpStatus)||error instanceof Error&&error.message==='source_redirect_rejected'){this.close();throw Error('authentication_required');}
      throw error;
    }
    // Bound the actual body, then let every family parser consume the same unchanged text.
    const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let length=0;
    if(reader)try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>2000000){await reader.cancel();throw Error('source_response_too_large');}chunks.push(part.value);}}finally{reader.releaseLock();}
    const text=Buffer.concat(chunks).toString('utf8');
    if(/webUserPass|세션이 만료|<input\b[^>]*\btype\s*=\s*["']?password\b|<form\b[^>]*\bname\s*=\s*["']?loginForm\b/i.test(text)){this.close();throw Error('authentication_required');}
    return new Response(text,{status:response.status,headers:response.headers});
  }
}
