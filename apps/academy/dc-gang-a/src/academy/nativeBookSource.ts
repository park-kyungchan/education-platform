import type {SourceDiscoveryRequest} from '../contracts/sourceDiscovery';
export type {SourceDiscoveryRequest} from '../contracts/sourceDiscovery';

/** Execute only on the authorized native academy document. No source mutation handler is invoked. */
export async function collectNativeBookDiscovery(input:SourceDiscoveryRequest){
  if(typeof location==='undefined'||location.origin!=='https://dc.gang-a.kr'||!document.body?.innerText.includes(input.teacherLabel+'- [로그아웃]')||document.querySelector('input[type=password]'))throw Error('authentication_required');
  if(!Array.isArray(input.studentNames)||input.studentNames.length<1||input.studentNames.length>64||new Set(input.studentNames).size!==input.studentNames.length)throw Error('invalid_source_scope');
  const fetchDocument=async(url:string,init:RequestInit={})=>{
    const response=await fetch(url,{...init,credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
    const html=await response.text();
    if(!response.ok||response.redirected||html.length>2000000||/webUserPass|세션이 만료/.test(html))throw Error('source_contract_refused');
    return new DOMParser().parseFromString(html,'text/html');
  };
  const endpoint='/servlet/controller.coursemanage.CourseManageServlet';
  const initial=await fetchDocument(endpoint+'?reqCmd=StudyCourse');
  const sourceField=(name:string)=>initial.querySelector<HTMLInputElement>('form[name=form1] [name='+name+']')?.value;
  const principal=sourceField('g_pri_no'),college=sourceField('g_clg_no'),memberType=sourceField('g_mem_type');
  if(principal!==input.teacherKey||college!==input.collegeKey||!memberType)throw Error('source_principal_drift');
  const students=[];
  for(const name of input.studentNames){
    const query=new URLSearchParams({reqCmd:'StudyCourse',clg_no:college,cls_no:'0',grade_no:'0',student_name:name});
    const current=await fetchDocument(endpoint+'?'+query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({reqCmd:'StudyCourse',g_clg_no:college,g_pri_no:principal,g_mem_type:memberType,cls_no:'0',grade_no:'0',student_name:name}).toString()});
    if(current.querySelector<HTMLInputElement>('form[name=form1] [name=g_pri_no]')?.value!==principal||current.querySelector<HTMLInputElement>('form[name=form1] [name=g_clg_no]')?.value!==college)throw Error('source_principal_drift');
    const courseRows=[...current.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>/^\s*onChangeStatus\(/.test(element.getAttribute('onclick')??''))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),handlers:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(value=>/^\s*(onChangeStatus|onResetCourse|onDeleteCourse)\(/.test(value))}));
    const books=await fetchDocument('/servlet/controller.coursemanage.TextBookManageServlet?reqCmd=getTextBookProgress',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:new URLSearchParams({student_name:name}).toString()});
    const bookRows=[...books.querySelectorAll('tr')].filter(row=>[...row.querySelectorAll('[onclick]')].some(element=>(element.getAttribute('onclick')??'').includes('createBookIncorrectPapers('))).map(row=>({cells:[...row.querySelectorAll(':scope > td')].map(cell=>cell.textContent?.trim()??''),bindings:[...row.querySelectorAll('[onclick]')].map(element=>element.getAttribute('onclick')!).filter(value=>value.includes('createBookIncorrectPapers('))}));
    students.push({name,courseRows,bookRows,observedAt:new Date().toISOString()});
  }
  return {schemaVersion:1,teacherLabel:input.teacherLabel,principalKey:principal,collegeKey:college,source:'native_browser_managed_auth',observedAt:new Date().toISOString(),academyMutations:0,students};
}
