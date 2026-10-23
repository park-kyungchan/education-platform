import {AcademyHttpClient,type SourceTransport} from '../../src/lms/academyHttpClient';

/** Invented source documents and credentials; transport never delegates to fetch. */
export const principal={teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001'};
export const target={teacherLabel:principal.teacherLabel,studentName:'Invented Learner',studentKey:'77001'};
export const principalHtml='<a href="/logout">로그아웃</a><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
const login='<form id="loginForm" method="post">'+['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'].map(name=>'<input name="'+name+'">').join('')+'</form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
export const credential={username:'inventedUser',password:'inventedPassword'};
export const row={priNo:77001,userName:target.studentName,pNo:82001,testingNo:81001,_id:'invented-row_1',score:0,testName:'Invented assessment'};
export function resultHtml(rows:unknown[]=[row]){
  return '<select name="sort_date"><option value="1">Invented recent</option><option value="11">Invented month</option><option value="12">Invented prior month</option></select><script>const results={testResultList:JSON.parse(\''+JSON.stringify(rows).replaceAll('\\','\\\\').replaceAll("'","\\'")+'\')};</script>';
}
export function sourceFixture(read:(url:URL,init:RequestInit)=>Response|Promise<Response>=()=>new Response(resultHtml()),loginDocument=login){
  const calls:{url:URL;init:RequestInit}[]=[];
  const transport:SourceTransport=async(url,init)=>{
    const parsed=new URL(url);calls.push({url:parsed,init});
    if(parsed.pathname==='/c_login.jsp')return new Response(loginDocument);
    if(parsed.pathname==='/servlet/controller.login.LoginServlet')return new Response(principalHtml);
    if(parsed.searchParams.get('reqCmd')==='StudyCourse')return new Response(principalHtml);
    return read(parsed,init);
  };
  return {client:new AcademyHttpClient(principal,transport),transport,calls,
    authCounts:()=>({documents:calls.filter(c=>c.url.pathname==='/c_login.jsp').length,submissions:calls.filter(c=>c.url.pathname==='/servlet/controller.login.LoginServlet').length,principalChecks:calls.filter(c=>c.url.searchParams.get('reqCmd')==='StudyCourse').length})};
}
