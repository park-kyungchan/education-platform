export interface StudentCourseRequest {teacherLabel:string;studentKey:string;studentName:string}
export interface CourseRowInput {cells:string[];handlers:string[]}
export interface StudentCourseObservation {
  identity:{sourceNamespace:'academy_student_course';studentKey:string;collegeKey:string;courseKey:string;userCourseKey:string};
  sourceCells:string[];coverage:'observed_row_not_all_assignments_or_pagination';handlersInvoked:false;
}
export interface StudentCourseEnvironment {origin:string;authenticatedTeacherVisible:boolean;principalKey?:string;domParser?:Pick<DOMParser,'parseFromString'>;fetcher:(url:string,init:RequestInit)=>Promise<Response>}
function literalKey(value:unknown):string {
  if(typeof value!=='string'||!/^[1-9][0-9]{0,15}$/.test(value)||BigInt(value)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('invalid_course_key');
  return value;
}
export function createStudentCourseRequest(input:unknown):StudentCourseRequest {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid_course_request');
  const d=Object.getOwnPropertyDescriptors(input);
  if(Object.keys(d).length!==3||Object.keys(d).some(k=>!['teacherLabel','studentKey','studentName'].includes(k))
    ||Object.values(d).some(v=>!Object.hasOwn(v,'value')))throw Error('invalid_course_request');
  const name=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>200)throw Error('invalid_course_name');return v;};
  return {teacherLabel:name(d.teacherLabel!.value),studentKey:literalKey(d.studentKey!.value),studentName:name(d.studentName!.value)};
}
/** Parse qualified passive identity tuples only. Never evaluate mutation handlers. */
export function bindStudentCourseRow(input:CourseRowInput,request:StudentCourseRequest):StudentCourseObservation {
  const target=createStudentCourseRequest(request);
  if(!Array.isArray(input.cells)||input.cells.length!==7||input.cells.some(c=>typeof c!=='string')||!Array.isArray(input.handlers)||![2,3].includes(input.handlers.length))throw Error('course_row_structure_drift');
  const calls=new Map<string,string[]>();
  for(const source of input.handlers){
    const match=/^\s*(onChangeStatus|onResetCourse|onDeleteCourse)\(\s*([0-9]+(?:\s*,\s*[0-9]+)*)\s*\)\s*;?\s*$/.exec(source);
    if(!match||calls.has(match[1]!))throw Error('unsafe_or_duplicate_course_handler');
    calls.set(match[1]!,match[2]!.split(',').map(x=>x.trim()));
  }
  const status=calls.get('onChangeStatus'),reset=calls.get('onResetCourse'),del=calls.get('onDeleteCourse');
  if(!status||status.length!==5||!del||del.length!==4||reset&&reset.length!==3)throw Error('course_handler_signature_drift');
  // Fresh direct source exposes no reset control on this exact started-row variant.
  if(!reset&&(input.handlers.length!==2||input.cells[5]!=='시작됨'||status[0]!=='0'||input.cells[1]!==target.teacherLabel||input.cells[2]!==target.studentName))throw Error('course_handler_signature_drift');
  const [collegeKey,studentKey,courseKey,userCourseKey]=status.slice(1).map(literalKey);
  if(studentKey!==target.studentKey||reset&&reset.join(',')!==[courseKey,studentKey,collegeKey].join(',')
    ||del.join(',')!==[collegeKey,studentKey,courseKey,userCourseKey].join(','))throw Error('course_source_identity_conflict');
  return {identity:{sourceNamespace:'academy_student_course',studentKey:studentKey!,collegeKey:collegeKey!,courseKey:courseKey!,userCourseKey:userCourseKey!},
    sourceCells:[...input.cells],coverage:'observed_row_not_all_assignments_or_pagination',handlersInvoked:false};
}
/** Current StudyCourse search shape; source acquisition is not canonical roster promotion. */
export async function readStudentCourses(input:unknown,environment:StudentCourseEnvironment):Promise<StudentCourseObservation[]> {
  if(environment.origin!=='https://dc.gang-a.kr'||environment.authenticatedTeacherVisible!==true)throw Error('authentication_required');
  const request=createStudentCourseRequest(input);
  if(typeof environment.principalKey!=='string'||!/^[1-9][0-9]{0,15}$/.test(environment.principalKey)||BigInt(environment.principalKey)>BigInt(Number.MAX_SAFE_INTEGER))throw Error('principal_binding_required');
  const parser=environment.domParser??(typeof DOMParser==='undefined'?undefined:new DOMParser());
  if(!parser)throw Error('native_browser_dom_required');
  const path='/servlet/controller.coursemanage.CourseManageServlet';
  const fetchDocument=async(url:string,init:RequestInit)=>{
    const response=await environment.fetcher(url,{...init,credentials:'same-origin',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!response.ok||response.redirected)throw Error('course_transport_failed');const text=await response.text();
    if(text.length>2000000||/webUserPass|세션이 만료/.test(text))throw Error('course_source_contract_refused');
    return parser.parseFromString(text,'text/html');
  };
  const doc=await fetchDocument(path+'?reqCmd=StudyCourse',{method:'GET'});
  const form=doc.querySelector('form[name=form1]');if(!form)throw Error('course_source_form_missing');
  const value=(name:string)=>form.querySelector<HTMLInputElement>('[name='+name+']')?.value;
  const collegeKey=literalKey(value('g_clg_no'));const memType=value('g_mem_type'),principal=value('g_pri_no');
  if(memType===undefined||principal===undefined)throw Error('course_principal_fields_missing');
  if(principal!==environment.principalKey)throw Error('course_principal_conflict');
  const query=new URLSearchParams({reqCmd:'StudyCourse',clg_no:collegeKey,cls_no:'0',student_name:request.studentName,grade_no:'0'});
  const result=await fetchDocument(path+'?'+query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({reqCmd:'StudyCourse',g_clg_no:collegeKey,g_mem_type:memType,g_pri_no:principal,grade_no:'0',cls_no:'0',student_name:request.studentName}).toString()});
  if(result.querySelector<HTMLInputElement>('form[name=form1] [name=g_pri_no]')?.value!==principal
    ||result.querySelector<HTMLInputElement>('form[name=form1] [name=g_clg_no]')?.value!==collegeKey)throw Error('course_principal_conflict');
  const rows=[...result.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(e=>/^\s*onChangeStatus\(/.test(e.getAttribute('onclick')??'')));
  const observations=rows.map(row=>bindStudentCourseRow({cells:[...row.querySelectorAll(':scope > td')].map(c=>c.textContent?.trim()??''),
    handlers:[...row.querySelectorAll('[onclick]')].map(e=>e.getAttribute('onclick')!).filter(s=>/^\s*(onChangeStatus|onResetCourse|onDeleteCourse)\(/.test(s))},request));
  const seen=new Set<string>();for(const row of observations){
    if(row.identity.collegeKey!==collegeKey)throw Error('course_source_identity_conflict');
    const identity=JSON.stringify(row.identity);if(seen.has(identity))throw Error('duplicate_course_identity');seen.add(identity);}
  return observations.sort((a,b)=>JSON.stringify(a.identity)<JSON.stringify(b.identity)?-1:JSON.stringify(a.identity)>JSON.stringify(b.identity)?1:0);
}
