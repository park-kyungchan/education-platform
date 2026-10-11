import {AcademyHttpClient} from '../../src/lms/academyHttpClient';
import type {SourceDiscoveryRequest} from '../../src/academy/nativeBookSource';
import type {ScopedAcademyReadPlan} from '../../src/lms/academyReadProtocol';
export const directScope={teacherLabel:'Invented Teacher',teacherKey:'99001',collegeKey:'88001',studentNames:['Invented Learner']};
export const directWitness=()=>({schemaVersion:1,observedAt:'2025-01-02T00:00:00Z',authentication:{state:'authenticated',transport:'direct_http_api',principalKey:'99001',collegeKey:'88001'},source:null,academyWrites:0,parentSends:0,
 books:{schemaVersion:1,teacherLabel:directScope.teacherLabel,collegeKey:directScope.collegeKey,principalKey:directScope.teacherKey,observedAt:'2025-01-02T00:00:00Z',source:'direct_http_api',academyMutations:0,
 students:[{name:'Invented Learner',observedAt:'2025-01-02T00:00:00Z',courseRows:[{cells:['Invented grade','Invented Teacher','Invented Learner','Invented course','v.fixture','Invented active','Non-invoked controls'],handlers:['onChangeStatus(0,88001,91001,71001,81001)','onResetCourse(71001,91001,88001)','onDeleteCourse(88001,91001,71001,81001)']}],bookRows:[{cells:['Invented Learner','Invented book','10 %','Non-invoked control','Non-invoked control'],bindings:["createBookIncorrectPapers('71001','61001','91001')"]}]}]}});

/** Invented HTTP documents exercise the real parser/client, never an academy network request. */
function syntheticHttpClient(){
 const principal='<a href="/logout">Invented Teacher- [로그아웃]</a><form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form>';
 const login='<form id="loginForm" name="loginForm" method="post"><input name="p_process"><input name="p_prino"><input name="p_groupno"><input name="userpwd"><input name="userid"><input name="cf_pc"><input name="cf_user"><input name="autoLoginCheck"><input name="autoLoginKey"></form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
 const client=new AcademyHttpClient(directScope,async(url,init)=>{
  if(url.endsWith('/c_login.jsp'))return new Response(login);
  if(url.includes('reqCmd=getTextBookProgress'))return new Response('<table><tr><td>Invented Learner</td><td>Invented book</td><td>10 %</td><td><button onclick="createBookIncorrectPapers(71001,61001,91001)">Non-invoked</button></td><td>Non-invoked</td></tr></table>');
  const course=init.method==='POST'?'<table><tr><td>Invented grade</td><td>Invented Teacher</td><td>Invented Learner</td><td>Invented course</td><td>v.fixture</td><td>Invented active</td><td><button onclick="onChangeStatus(0,88001,91001,71001,81001)">Non-invoked</button><button onclick="onResetCourse(71001,91001,88001)">Non-invoked</button><button onclick="onDeleteCourse(88001,91001,71001,81001)">Non-invoked</button></td></tr></table>':'';
  return new Response(principal+course);
 });
 return client;
}
export async function syntheticHttpDiscovery(input:{username:string;discover:SourceDiscoveryRequest}){
 const client=syntheticHttpClient();try{
  const authentication=await client.authenticate({username:input.username,password:'invented-fixture-password'}),books=await client.discoverBooks(input.discover);
  return {schemaVersion:1,observedAt:new Date().toISOString(),authentication,source:null,books,academyWrites:0,parentSends:0};
 }finally{client.close();}
}
export async function syntheticHttpRead(input:{username:string;read:ScopedAcademyReadPlan['request']}){
 const client=syntheticHttpClient();try{
  const authentication=await client.authenticate({username:input.username,password:'invented-fixture-password'}),source=await client.execute(input.read);
  return {schemaVersion:1,observedAt:new Date().toISOString(),authentication,source,academyWrites:0,parentSends:0};
 }finally{client.close();}
}
