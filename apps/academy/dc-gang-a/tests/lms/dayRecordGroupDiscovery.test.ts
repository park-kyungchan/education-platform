import {expect,test} from 'bun:test';
import {AcademyHttpClient} from '../../src/lms/academyHttpClient';

const login='<form id="loginForm" method="post">'+['p_process','p_prino','p_groupno','userpwd','userid','cf_pc','cf_user','autoLoginCheck','autoLoginKey'].map(name=>`<input name="${name}">`).join('')+'</form><script>document.loginForm.action = "/servlet/controller.login.LoginServlet"; document.loginForm.p_process.value = "c_login";</script>';
const principal='<form name="userForm"><input name="pri_no" value="99001"></form><form name="form1"><input name="g_pri_no" value="99001"><input name="g_clg_no" value="88001"><input name="g_mem_type" value="teacher"></form><span>로그아웃</span>';
const page='<input name="std_date" value="2040-01-04"><input name="teacher_pri_no" value="99001"><select name="grp_seq"><option value="0">All groups</option><option value="31" selected>First class</option><option value="42">Second class</option></select>';
const scope={teacherLabel:'Invented Teacher',date:'2040-01-04'};
async function connected(html=page){
  const calls:{url:string;init:RequestInit}[]=[];
  const client=new AcademyHttpClient({teacherLabel:scope.teacherLabel,teacherKey:'99001',collegeKey:'88001'},async(url,init)=>{
    calls.push({url,init});return new Response(calls.length===1?login:calls.length<=3?principal:html);
  });
  await client.authenticate({username:'fictional-user',password:'fictional-password'});return {client,calls};
}
test('missing local groups are discoverable from the exact live teacher/date selector without guessing a group or executing handlers',async()=>{
  const {client,calls}=await connected(page+'<script>throw Error("must remain inert")</script>');
  try{
    const result=await client.discoverDayRecordGroups(scope);
    expect(result).toMatchObject({date:scope.date,teacherKey:'99001',selectedGroupId:'31',groups:[{groupId:'31',label:'First class'},{groupId:'42',label:'Second class'}],academyWrites:0,parentSends:0});
    const last=calls.at(-1)!;expect(last.url).toBe('https://dc.gang-a.kr/servlet/controller.cct.tutor.DayRecordServlet');
    expect(last.init.method).toBe('POST');const body=new URLSearchParams(last.init.body as string);
    expect([...body]).toEqual([['p_process','Main'],['std_ymd','20400104']]);expect(body.has('grp_seq')).toBe(false);
    expect(result.coverage).toBe('current_date_selector_only_not_student_membership');
  }finally{client.close();}
});
test('invalid date, foreign teacher and unauthenticated discovery make no request',async()=>{
  let calls=0;const client=new AcademyHttpClient({teacherLabel:scope.teacherLabel,teacherKey:'99001',collegeKey:'88001'},async()=>{calls++;return new Response('');});
  await expect(client.discoverDayRecordGroups({...scope,date:'2040-02-31'})).rejects.toThrow();
  await expect(client.discoverDayRecordGroups({...scope,teacherLabel:'Other teacher'})).rejects.toThrow('day_record_group_principal_conflict');
  await expect(client.discoverDayRecordGroups(scope)).rejects.toThrow('authentication_required');expect(calls).toBe(0);
});
test('changed teacher/date or ambiguous selectors do not establish current group scope',async()=>{
  for(const html of [page.replace('99001','99002'),page.replace('2040-01-04','2040-01-05'),page+'<select name="grp_seq"></select>']){
    const {client}=await connected(html);try{await expect(client.discoverDayRecordGroups(scope)).rejects.toThrow('day_record_group_scope_conflict');}finally{client.close();}
  }
});
test('duplicate, nonnumeric, empty and disabled-only options are refused rather than used as fallback routes',async()=>{
  for(const html of [page.replace('value="42"','value="31"'),page.replace('value="42"','value="not-a-key"'),page.replace('First class','').replace('Second class',''),page.replaceAll('<option value="31"','<option disabled value="31"').replaceAll('<option value="42"','<option disabled value="42"')]){
    const {client}=await connected(html);try{await expect(client.discoverDayRecordGroups(scope)).rejects.toThrow();}finally{client.close();}
  }
});
test('login challenge closes the client and never becomes an empty group list',async()=>{
  const {client,calls}=await connected('<input type="password">');
  await expect(client.discoverDayRecordGroups(scope)).rejects.toThrow('authentication_required');expect(client.authenticated).toBe(false);
  const before=calls.length;await expect(client.discoverDayRecordGroups(scope)).rejects.toThrow('authentication_required');expect(calls).toHaveLength(before);
});
