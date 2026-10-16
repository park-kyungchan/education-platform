import os,sys,json,stat,signal,select,selectors,time,hashlib,threading,re

def need(value,code):
 if not value:raise RuntimeError(code)

def read_regular(path,uid,cap,private=True):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and before.st_uid==uid and before.st_nlink==1 and 0<=before.st_size<=cap and (not private or before.st_mode&0o077==0),'regular_descriptor_refused')
  chunks=[];size=0
  while True:
   part=os.read(fd,min(65536,cap-size+1))
   if not part:break
   size+=len(part);need(size<=cap and size<=before.st_size,'regular_read_grew');chunks.append(part)
  after=os.fstat(fd);need(size==before.st_size and (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns,before.st_mode,before.st_nlink)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns,after.st_mode,after.st_nlink),'regular_descriptor_changed')
  return b''.join(chunks)
 finally:os.close(fd)

def identity(pid):
 need(type(pid)==int and pid>1,'bounded_child_pid_required');base='/proc/'+str(pid)
 with open(base+'/stat') as stream:raw=stream.read(4097)
 need(len(raw)<=4096,'proc_stat_cap');tail=raw.rsplit(') ',1)[1].split()
 with open(base+'/cmdline','rb') as stream:raw_args=stream.read(16385)
 need(len(raw_args)<=16384,'proc_argv_cap')
 return {'pid':pid,'startTicks':tail[19],'executable':os.path.realpath(base+'/exe'),'cwd':os.path.realpath(base+'/cwd'),'argv':[v.decode() for v in raw_args.split(b'\x00') if v],'namespace':os.readlink(base+'/ns/pid'),'bootId':open('/proc/sys/kernel/random/boot_id').read(100).strip()}

def parent_pid(pid):return int(open('/proc/'+str(pid)+'/stat').read(4096).rsplit(') ',1)[1].split()[1])

def birth_present(wanted):
 try:
  current=identity(wanted['pid']);return all(current[key]==wanted[key] for key in ['pid','startTicks','namespace','bootId'])
 except FileNotFoundError:return False

def checked_pidfd(pid):
 fd=os.pidfd_open(pid,0)
 try:
  value=open('/proc/self/fdinfo/'+str(fd)).read(4096);need(any(line=='Pid:\t'+str(pid) for line in value.splitlines()),'exact_pidfd_target_required');return fd
 except BaseException:os.close(fd);raise

def held_binary(spec):
 pin=spec.get('binaryPin');need(isinstance(pin,dict) and set(pin)==set(['uid','bytes','sha256']) and type(pin['uid'])==int and type(pin['bytes'])==int and 0<pin['bytes']<=134217728 and isinstance(pin['sha256'],str) and len(pin['sha256'])==64,'exact_held_binary_pin_required')
 fd=os.open(spec['argv'][0],os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and before.st_uid==pin['uid'] and before.st_nlink==1 and before.st_size==pin['bytes'] and before.st_mode&0o111 and before.st_mode&0o022==0,'held_binary_descriptor_refused');h=hashlib.sha256();size=0
  while True:
   part=os.read(fd,1048576)
   if not part:break
   size+=len(part);need(size<=before.st_size,'held_binary_grew');h.update(part)
  after=os.fstat(fd);need(size==before.st_size and h.hexdigest()==pin['sha256'] and (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns,before.st_mode,before.st_nlink)==(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns,after.st_mode,after.st_nlink),'held_binary_changed');return fd
 except BaseException:os.close(fd);raise

def atomic_receipt(path,value,expected='absent'):
 parent=os.path.dirname(path);root=os.lstat(parent);need(stat.S_ISDIR(root.st_mode) and not stat.S_ISLNK(root.st_mode) and root.st_uid==os.getuid() and stat.S_IMODE(root.st_mode)==0o700,'private_receipt_parent_required')
 if expected=='absent':need(not os.path.lexists(path),'receipt_absent_cas_failed')
 else:need(hashlib.sha256(read_regular(path,os.getuid(),65536)).hexdigest()==expected,'receipt_byte_cas_failed')
 raw=(json.dumps(value,separators=(',',':'))+'\n').encode();need(len(raw)<=65536,'ownership_receipt_cap');temporary=path+'.'+os.urandom(8).hex()+'.tmp';fd=os.open(temporary,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_NONBLOCK,0o600)
 try:
  offset=0
  while offset<len(raw):offset+=os.write(fd,raw[offset:])
  os.fsync(fd)
 finally:os.close(fd)
 os.replace(temporary,path);directory=os.open(parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:os.fsync(directory)
 finally:os.close(directory)
 return hashlib.sha256(raw).hexdigest()

def child_exit_reserved(pid):
 try:return os.waitid(os.P_PID,pid,os.WEXITED|os.WNOHANG|os.WNOWAIT) is not None
 except ChildProcessError:raise RuntimeError('direct_child_reservation_lost')

def reap_reserved(pid,seconds):
 deadline=time.monotonic()+seconds
 while True:
  ended,status=os.waitpid(pid,os.WNOHANG)
  if ended==pid:
   need(not os.path.exists('/proc/'+str(pid)),'reaped_child_pid_absence_unconfirmed');return os.waitstatus_to_exitcode(status)
  need(time.monotonic()<deadline,'reserved_child_reap_deadline');time.sleep(0.01)

def close_fd(fd):
 if fd is not None:
  try:os.close(fd)
  except OSError:pass

class OwnedCleanupUncertainty(RuntimeError):
 def __init__(self,handle):super().__init__('owned_child_cleanup_uncertain');self.handle=handle

def cleanup_owned(handle,seconds=35):
 if handle.get('reaped') is True:return handle.get('exitCode',0)
 try:
  if not child_exit_reserved(handle['pid']):signal.pidfd_send_signal(handle['pidfd'],signal.SIGINT if handle.get('role')=='postgres' else signal.SIGTERM)
  code=reap_reserved(handle['pid'],seconds);handle['reaped']=True;handle['exitCode']=code;return code
 except BaseException:raise OwnedCleanupUncertainty(handle) from None

def close_handle(handle):
 handle['selector'].close()
 for fd in handle['handles']:close_fd(fd)
 handle['handles']=[]

def checked_launch(spec,receipt_path,receipt_extra,expected_receipt='absent',fault=None,before_release=None):
 # Prepare every finite resource before fork. No target code can execute before durable parent ownership.
 need(signal.getsignal(signal.SIGCHLD)==signal.SIG_DFL and threading.active_count()==1 and len(os.listdir('/proc/self/task'))==1,'single_reaper_default_sigchld_required')
 need(isinstance(spec,dict) and isinstance(spec.get('argv'),list) and 0<len(spec['argv'])<=64 and all(isinstance(v,str) and 0<len(v.encode())<=4096 for v in spec['argv']) and sum(len(v.encode())+1 for v in spec['argv'])<=16384,'bounded_launch_arguments_required')
 need(os.path.isabs(spec['argv'][0]) and os.path.isabs(spec['cwd']) and isinstance(spec['env'],dict),'exact_launch_scope_required')
 handles=[];selector=None;pid=None;pidfd=None;released=False;recorded=None;retain=False;gate_r=gate_w=out_r=out_w=err_r=err_w=None
 try:
  binary_fd=held_binary(spec);handles.append(binary_fd);selector=selectors.DefaultSelector();gate_r,gate_w=os.pipe2(os.O_CLOEXEC);handles += [gate_r,gate_w];out_r,out_w=os.pipe2(os.O_CLOEXEC);handles += [out_r,out_w];err_r,err_w=os.pipe2(os.O_CLOEXEC);handles += [err_r,err_w]
  input_w=None
  if spec.get('stdinPipe') is True:input_r,input_w=os.pipe2(os.O_CLOEXEC);handles += [input_r,input_w]
  else:
   input_r=os.open('/dev/null',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK|os.O_CLOEXEC);value=os.fstat(input_r);need(stat.S_ISCHR(value.st_mode) and os.major(value.st_rdev)==1 and os.minor(value.st_rdev)==3,'fixed_null_input_required');handles.append(input_r)
  os.set_blocking(out_r,False);os.set_blocking(err_r,False);selector.register(out_r,selectors.EVENT_READ,'stdout');selector.register(err_r,selectors.EVENT_READ,'stderr')
  parent=os.getpid();parent_birth=identity(parent);pid=os.fork()
  if pid==0:
   try:
    for fd in [gate_w,out_r,err_r,input_w]:close_fd(fd)
    signal.signal(signal.SIGALRM,signal.SIG_DFL);signal.alarm(6)
    if not select.select([gate_r],[],[],5)[0] or os.read(gate_r,1)!=b'G' or os.getppid()!=parent or not birth_present(parent_birth):os._exit(72)
    close_fd(gate_r);signal.alarm(0);os.dup2(input_r,0);os.dup2(out_w,1);os.dup2(err_w,2);close_fd(input_r);close_fd(out_w);close_fd(err_w);os.chdir(spec['cwd']);os.execve(binary_fd,spec['argv'],spec['env'])
   except BaseException:os._exit(73)
  for fd in [gate_r,out_w,err_w,input_r]:close_fd(fd);handles.remove(fd)
  gate_r=out_w=err_w=None
  if fault:fault('after_fork',pid)
  pidfd=checked_pidfd(pid);handles.append(pidfd);recorded=identity(pid);need(parent_pid(pid)==parent and recorded['namespace']==parent_birth['namespace'] and recorded['bootId']==parent_birth['bootId'],'exact_gated_direct_child_required')
  if fault:fault('before_pidfd_selector',pid)
  selector.register(pidfd,selectors.EVENT_READ,'pidfd')
  if fault:fault('before_receipt',pid)
  state={'schema':'academy.owned-product-process.v2','phase':'gated','manager':parent_birth,'gatedChild':recorded,'expectedExecutable':spec['argv'][0],'expectedArgv':spec['argv'],'expectedCwd':spec['cwd'],**receipt_extra};receipt_sha=atomic_receipt(receipt_path,state,expected_receipt)
  if before_release:before_release(state,receipt_sha)
  if fault:fault('before_ack',pid)
  need(os.write(gate_w,b'G')==1,'child_gate_ack_short_write');released=True;close_fd(gate_w);handles.remove(gate_w);gate_w=None
  deadline=time.monotonic()+5
  while True:
   need(not child_exit_reserved(pid),'owned_child_early_exit')
   current=identity(pid)
   if current['startTicks']==recorded['startTicks'] and current['namespace']==recorded['namespace'] and current['bootId']==recorded['bootId'] and current['executable']==os.path.realpath(spec['argv'][0]) and current['cwd']==spec['cwd'] and current['argv']==spec['argv']:break
   need(time.monotonic()<deadline,'owned_target_exec_unconfirmed');time.sleep(0.01)
  if fault:fault('before_exec_receipt',pid)
  state={**state,'phase':'running','identity':current};receipt_sha=atomic_receipt(receipt_path,state,receipt_sha)
  return {'pid':pid,'pidfd':pidfd,'selector':selector,'stdout':out_r,'stderr':err_r,'stdin':input_w,'identity':current,'gatedIdentity':recorded,'manager':parent_birth,'receipt':state,'receiptSha256':receipt_sha,'receiptPath':receipt_path,'handles':handles,'role':receipt_extra.get('role')}
 except BaseException:
  close_fd(gate_w)
  if gate_w in handles:handles.remove(gate_w)
  if pid is not None and pid>0:
   # If pidfd acquisition failed, close the gate and wait for EOF/alarm. The unreaped direct child reserves its PID.
   if pidfd is None:reap_reserved(pid,7)
   else:
    held={'pid':pid,'pidfd':pidfd,'selector':selector,'stdout':out_r,'stderr':err_r,'gatedIdentity':recorded,'manager':identity(os.getpid()),'handles':handles,'role':receipt_extra.get('role'),'receiptPath':receipt_path}
    try:cleanup_owned(held,35)
    except OwnedCleanupUncertainty:retain=True;raise
  raise
 finally:
  # A successful handle owns every descriptor; failed setup closes all prepared resources.
  if sys.exc_info()[0] is not None and not retain:
   if selector is not None:selector.close()
   for fd in handles:close_fd(fd)

def drain_owned(handle,seconds,stdout_cap,stderr_cap,log_descriptor=None,stop_requested=lambda:False,input_data=None):
 sizes={'stdout':0,'stderr':0};chunks={'stdout':[],'stderr':[]};deadline=time.monotonic()+seconds if seconds is not None else None;sent=False;retain=False
 try:
  input_offset=0
  if input_data is not None:
   need(isinstance(input_data,bytes) and len(input_data)<=33554432 and handle.get('stdin') is not None,'bounded_owned_stdin_required')
   if input_data:os.set_blocking(handle['stdin'],False);handle['selector'].register(handle['stdin'],selectors.EVENT_WRITE,'stdin')
   else:close_fd(handle['stdin']);handle['handles'].remove(handle['stdin']);handle['stdin']=None
  while True:
   if stop_requested() and not sent:signal.pidfd_send_signal(handle['pidfd'],signal.SIGINT if handle.get('role')=='postgres' else signal.SIGTERM);sent=True
   need(deadline is None or time.monotonic()<deadline,'owned_process_deadline')
   for key,_ in handle['selector'].select(0.1):
    name=key.data
    if name=='pidfd':continue
    if name=='stdin':
     written=os.write(key.fd,memoryview(input_data)[input_offset:input_offset+65536]);need(written>0,'owned_stdin_short_write');input_offset+=written
     if input_offset==len(input_data):handle['selector'].unregister(key.fd);close_fd(key.fd);handle['handles'].remove(key.fd);handle['stdin']=None
     continue
    part=os.read(key.fd,65536)
    if not part:handle['selector'].unregister(key.fd);continue
    sizes[name]+=len(part);need(sizes[name]<={'stdout':stdout_cap,'stderr':stderr_cap}[name],'owned_process_output_cap')
    if log_descriptor is None:chunks[name].append(part)
    else:
     offset=0
     while offset<len(part):offset+=os.write(log_descriptor,part[offset:])
   if child_exit_reserved(handle['pid']) and all(key.data=='pidfd' for key in handle['selector'].get_map().values()):break
  code=reap_reserved(handle['pid'],2);handle['reaped']=True;handle['exitCode']=code;state={**handle['receipt'],'phase':'exited','exitCode':code,'positivePidAbsence':True};atomic_receipt(handle['receiptPath'],state,handle['receiptSha256']);return code,b''.join(chunks['stdout']),b''.join(chunks['stderr'])
 except BaseException:
  try:cleanup_owned(handle)
  except OwnedCleanupUncertainty:retain=True;raise
  raise
 finally:
  if not retain:close_handle(handle)

import fcntl,re

def task_contract():
 root=os.path.dirname(os.path.realpath(__file__));raw=read_regular(root+'/deployment-contract.json',10000,200000);c=json.loads(raw)
 need(os.getuid()==10000 and os.getgid()==10000 and root==c['nativeTaskRoot'] and c['schema']=='academy.private-retained-deployment-contract.v4' and c['sourceAcquisition'] is False,'exact_native_owner_required')
 need(c['bunBinary']=='/opt/data/.local/bin/bun' and c['releaseRoot']==c['preservedPostgres']['nativeTaskRoot']+'/releases','current_compiler_and_retained_source_scope_required')
 need(all(isinstance(c.get(key),str) and re.fullmatch('[a-f0-9]{64}',c[key]) for key in ['runtimePreparationDecisionSha256','runtimeClosureObservationSha256']),'current_successor_qualification_refs_required')
 need(c['runtimeQualification']=='ROOT_ACCEPTED_EXACT_INCARNATION_SOURCE_ONLY','runtime_preparation_only_hold')
 need(os.readlink('/proc/self/ns/pid')==c['container']['pidNamespace'] and open('/proc/sys/kernel/random/boot_id').read(100).strip()==c['container']['bootId'],'native_boot_namespace_changed')
 for folder in [root,root+'/state']:
  s=os.lstat(folder);need(stat.S_ISDIR(s.st_mode) and not stat.S_ISLNK(s.st_mode) and s.st_uid==10000 and stat.S_IMODE(s.st_mode)==0o700 and os.path.realpath(folder)==folder,'private_native_task_required')
 for entry in c['nativeSourcePins']:
  need(entry['path'] in ['product-domain-controller.ts','guarded-io.ts','product-readback.ts'],'fixed_native_domain_closure_required')
  need(hashlib.sha256(read_regular(root+'/'+entry['path'],10000,200000)).hexdigest()==entry['sha256'],'native_domain_pin_changed')
 admission=json.loads(read_regular(root+'/activation-admission.json',10000,20000))
 need(admission['schema']=='academy.root-product-activation-admission.v2' and admission['taskId']==c['taskId'] and admission['deploymentContractSha256']==hashlib.sha256(raw).hexdigest() and admission['sourceAcquisition'] is False,'separate_native_admission_required')
 return c,root,admission

def binary_pin(c,path):
 values=[row for row in c['runtimePins'] if row['path']==path];need(len(values)==1,'fixed_native_binary_required');row=values[0];return {'uid':10000,'bytes':row['bytes'],'sha256':row['sha256']}

def environment():return {'HOME':'/opt/data','HERMES_HOME':'/opt/data/profiles/dc-gang-a-dev','PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'}

def controller_spec(c,root,operation,arguments):
 need(operation in ['prepare-role','ready','select-release'],'fixed_domain_operation_required')
 return {'argv':[c['bunBinary'],'--no-env-file',root+'/product-domain-controller.ts',operation]+arguments,'cwd':root,'env':environment(),'binaryPin':binary_pin(c,c['bunBinary'])}

def run_domain(c,root,operation,arguments):
 suffix=os.urandom(8).hex();handle=checked_launch(controller_spec(c,root,operation,arguments),root+'/state/domain-'+suffix+'.json',{'taskId':c['taskId'],'role':'domain:'+operation})
 code,out,err=drain_owned(handle,45,100000,65536)
 need(code==0 and not err,'bounded_domain_operation_refused');return json.loads(out)

def listening(port):
 for table in ['tcp','tcp6']:
  with open('/proc/net/'+table) as stream:raw=stream.read(1048577)
  need(len(raw)<=1048576,'kernel_network_inventory_cap')
  for line in raw.splitlines()[1:]:
   parts=line.split()
   if len(parts)>3 and parts[3]=='0A' and int(parts[1].split(':')[1],16)==port:return True
 return False

def role_matches(c,root,role,current):
 if role=='postgres':return current['executable']==c['postgresBinary'] and (c['primary'] in current['argv'] or current['cwd']==c['primary'])
 if role=='app':return current['executable'] in [c['bunBinary'],'/opt/data/toolchains/bun/1.4.2/bin/bun'] and any(c['releaseRoot']+'/'+row['label']+'/'+row['entrypoint'] in current['argv'] for row in c['releases'])
 return current['executable']==c['cloudflaredBinary'] and '/opt/data/profiles/dc-gang-a-dev/academy/tunnel-config.json' in current['argv']

def role_absence(c,root,role):
 names=os.listdir('/proc');need(len(names)<=10000,'native_process_inventory_cap');matches=[];managers=[]
 for name in names:
  if not name.isdigit() or int(name)<=1 or int(name)==os.getpid():continue
  try:
   if os.stat('/proc/'+name).st_uid!=10000:continue
   current=identity(int(name))
   if role_matches(c,root,role,current):matches.append(current['pid'])
   if any(current['argv']==[c['nativePython'],'-I','-S','-B',candidate+'/native-product-os.py','serve',role] for candidate in [root,c['preservedPostgres']['nativeTaskRoot']]):managers.append(current['pid'])
  except (FileNotFoundError,ProcessLookupError):continue
  except PermissionError:raise RuntimeError('native_process_inventory_unobservable') from None
 endpoint=False
 if role=='app':endpoint=listening(c['appPort'])
 if role=='postgres':
  with open('/proc/net/unix') as stream:raw=stream.read(1048577)
  need(len(raw)<=1048576,'kernel_unix_inventory_cap');endpoint=listening(c['postgresPort']) or any(line.split() and line.split()[-1]==c['postgresSocket'] for line in raw.splitlines()) or os.path.lexists(c['primary']+'/postmaster.pid') or os.path.lexists(c['postgresSocket'])
 return {'role':role,'absent':not matches and not managers and not endpoint,'scopedRoleProcesses':len(matches),'otherOwnedManagers':len(managers),'ownedEndpointAbsent':not endpoint,'tlsProof':False,'processScope':'UID10000 product role processes; all-owner kernel endpoint conflicts separately refused'}

def read_stdin_json(cap=20000,seconds=3):
 raw=bytearray();deadline=time.monotonic()+seconds
 while True:
  remaining=deadline-time.monotonic();need(remaining>0 and select.select([0],[],[],remaining)[0],'bounded_operator_input_deadline');part=os.read(0,min(4096,cap-len(raw)+1))
  if not part or b'\n' in part:
   raw+=part;break
  raw+=part;need(len(raw)<=cap,'bounded_operator_input_cap')
 need(len(raw)<=cap,'bounded_operator_input_cap');return json.loads(raw) if raw.strip() else None

def expected_role(c,root,role,authority):
 need(authority['schema']=='academy.protected-product-birth-authority.v1' and authority['taskId']==c['taskId'] and authority['role']==role,'protected_role_authority_scope_required')
 need(authority['deploymentContractSha256']==hashlib.sha256(read_regular(root+'/deployment-contract.json',10000,200000)).hexdigest(),'protected_role_contract_pin_required')
 child=authority['gatedChild'];manager=authority['manager'];need(child['namespace']==c['container']['pidNamespace'] and manager['namespace']==child['namespace'] and child['bootId']==c['container']['bootId'] and manager['bootId']==child['bootId'],'protected_birth_namespace_required')
 need(manager['argv']==[c['nativePython'],'-I','-S','-B',root+'/native-product-os.py','serve',role] and manager['cwd']==root and manager['executable']==c['nativePython'],'fixed_native_manager_required')
 wanted={'executable':authority['expectedExecutable'],'cwd':authority['expectedCwd'],'argv':authority['expectedArgv']}
 if role=='postgres':valid=wanted=={'executable':c['postgresBinary'],'cwd':c['primary'],'argv':[c['postgresBinary'],'-D',c['primary'],'-c','config_file='+root+'/primary-runtime.conf']}
 elif role=='app':valid=any(wanted=={'executable':c['bunBinary'],'cwd':c['releaseRoot']+'/'+row['label'],'argv':[c['bunBinary'],'--no-env-file',c['releaseRoot']+'/'+row['label']+'/'+row['entrypoint'],'--retained-only']} for row in c['releases'])
 else:valid=wanted=={'executable':c['cloudflaredBinary'],'cwd':root,'argv':[c['cloudflaredBinary'],'tunnel','--config','/opt/data/profiles/dc-gang-a-dev/academy/tunnel-config.json','run']}
 need(valid,'fixed_role_launch_authority_required');return child,manager,wanted

def stop_exact(c,root,role,authority):
 child,manager,wanted=expected_role(c,root,role,authority);descriptors=[]
 try:
  manager_alive=birth_present(manager)
  if manager_alive:
   managerfd=checked_pidfd(manager['pid']);descriptors.append(managerfd);need(identity(manager['pid'])==manager,'manager_incarnation_mismatch');signal.pidfd_send_signal(managerfd,signal.SIGTERM)
  if birth_present(child):
   childfd=checked_pidfd(child['pid']);descriptors.append(childfd);now=identity(child['pid']);need(all(now[k]==child[k] for k in ['pid','startTicks','namespace','bootId']),'protected_child_birth_changed')
   need(now==child or all(now[k]==wanted[k] for k in ['executable','cwd','argv']),'protected_child_role_changed')
   parent=parent_pid(child['pid']);need(parent==manager['pid'] and birth_present(manager) or parent==1 and not birth_present(manager),'exact_manager_or_pid1_parent_required')
   signal.pidfd_send_signal(childfd,signal.SIGINT if role=='postgres' else signal.SIGTERM)
  deadline=time.monotonic()+40
  while birth_present(child) or birth_present(manager):need(time.monotonic()<deadline,'owned_product_stop_uncertain');time.sleep(0.05)
  result=role_absence(c,root,role);need(result['absent'],'owned_product_endpoint_absence_unconfirmed');return {'event':'exact_role_stopped','taskId':c['taskId'],'role':role,'childBirthAbsent':True,'managerBirthAbsent':True,'pidfdOnly':True,'positiveRoleAbsence':result,'pathnameMutation':False}
 finally:
  for fd in descriptors:close_fd(fd)

def require_successor_scope(operation,role,arguments):
 if operation in ('serve','stop','status'):
  need(role in ('app','tunnel') and not arguments,'preserved_postgres_lifecycle_forbidden');return
 if operation=='domain':
  need(role in ('ready','select-release'),'consumed_product_operation_forbidden')
  need((role=='ready' and len(arguments)==1 and arguments[0] in ('app','tunnel')) or (role=='select-release' and len(arguments)==2),'fixed_successor_domain_arguments');return
 if operation=='preserve-postgres':need(role=='postgres' and not arguments,'fixed_preservation_arguments');return
 raise RuntimeError('successor_operation_not_allowed')

def require_old_non_pg_retirement(raw,c,p,is_root):
 value=json.loads(raw);allowed={'status:postgres','stop:postgres','status:app','stop:app','status:tunnel','stop:tunnel'}
 need(value['schema']=='academy.root-product-activation-admission.v2' and value['taskId']==c['taskId'] and value['deploymentContractSha256']==p['deploymentContractSha256'] and value['sourceAcquisition'] is False,'original_admission_binding_required')
 if is_root:need(value['hostContractSha256']==p['hostContractSha256'],'original_root_admission_binding_required')
 operations=value['operations'];need(isinstance(operations,list) and operations and all(isinstance(op,str) and op in allowed for op in operations) and len(set(operations))==len(operations) and 'status:postgres' in operations,'old_bun_execution_eligibility_not_retired')

def observe_original_pg_endpoint(c,child,expected):
 need(isinstance(expected,dict),'original_pg_endpoint_pin_required')
 port=c.get('postgresPort');path=c.get('postgresSocket');directory='/opt/data/profiles/dc-gang-a-dev/academy/socket'
 need(type(port)==int and 0<port<65536 and path==directory+'/.s.PGSQL.'+str(port),'original_pg_endpoint_scope_required')
 current='/';parent_before=None
 for part in directory.split('/')[1:]:
  current=os.path.join(current,part);item=os.lstat(current);need(stat.S_ISDIR(item.st_mode) and not stat.S_ISLNK(item.st_mode) and item.st_uid in (0,10000) and item.st_mode&0o022==0,'original_pg_socket_parent_refused')
  if current==directory:parent_before=(item.st_dev,item.st_ino,item.st_mode,item.st_uid,item.st_gid)
 before=os.lstat(path);need(stat.S_ISSOCK(before.st_mode) and before.st_uid==10000 and before.st_gid==10000 and before.st_nlink==1,'original_pg_socket_entry_refused')
 proc='/proc/'+str(child['pid']);need(identity(child['pid'])==child,'original_pg_socket_owner_birth_changed')
 # procfs socket inode identifies the kernel listener, independently of the filesystem entry inode.
 with open(proc+'/net/unix','rb') as stream:raw=stream.read(1048577)
 need(len(raw)<=1048576,'original_pg_unix_inventory_cap');matches=[]
 for line in raw.decode('ascii').splitlines()[1:]:
  row=line.split()
  if len(row)==8 and row[7]==path:
   need(row[3]=='00010000' and row[4]=='0001' and row[5]=='01' and row[6].isdigit(),'original_pg_kernel_listener_refused');matches.append(row[6])
 need(len(matches)==1,'original_pg_kernel_listener_missing_or_ambiguous');inode=matches[0];fds=[];count=0
 with os.scandir(proc+'/fd') as entries:
  for entry in entries:
   count+=1;need(count<=1024 and entry.name.isdigit(),'original_pg_fd_inventory_cap')
   if os.readlink(proc+'/fd/'+entry.name)=='socket:['+inode+']':fds.append(entry.name)
 need(fds,'original_pg_kernel_socket_foreign_owner')
 after=os.lstat(path);parent_after=os.lstat(directory)
 need((before.st_dev,before.st_ino,before.st_uid,before.st_gid,before.st_mode,before.st_nlink,before.st_ctime_ns)==(after.st_dev,after.st_ino,after.st_uid,after.st_gid,after.st_mode,after.st_nlink,after.st_ctime_ns) and parent_before==(parent_after.st_dev,parent_after.st_ino,parent_after.st_mode,parent_after.st_uid,parent_after.st_gid) and identity(child['pid'])==child,'original_pg_socket_observation_drift')
 value={'path':path,'filesystem':{'device':before.st_dev,'inode':before.st_ino,'uid':before.st_uid,'gid':before.st_gid,'mode':stat.S_IMODE(before.st_mode),'ctimeNs':before.st_ctime_ns},'kernelInode':inode,'ownerPid':child['pid'],'ownerStartTicks':child['startTicks'],'ownerBootId':child['bootId'],'ownerNamespace':child['namespace'],'listenerFds':sorted(fds,key=int)}
 need(value==expected,'original_pg_endpoint_pin_changed');return value

def preserve_original_postgres(c,authority):
 p=c['preservedPostgres'];need(isinstance(p,dict) and all(isinstance(p.get(key),str) and re.fullmatch('[a-f0-9]{64}',p[key]) for key in ['deploymentContractSha256','rootAuthoritySha256','nativeGatedReceiptSha256','nativeRunningReceiptSha256','migrationReceiptSha256','oldRootActivationSha256','oldNativeActivationSha256']),'preserved_pg_authority_binding_required')
 legacy_root=p['nativeTaskRoot'];need(legacy_root=='/opt/data/academy-release-staging-20261015-71c5a0e737e0' and c['nativeTaskRoot']!=legacy_root,'exact_original_pg_root_required')
 old_admission_path=legacy_root+'/activation-admission.json';old_admission_raw=read_regular(old_admission_path,10000,20000);need(hashlib.sha256(old_admission_raw).hexdigest()==p['oldNativeActivationSha256'],'original_native_retirement_admission_changed');require_old_non_pg_retirement(old_admission_raw,c,p,False)
 raw=read_regular(legacy_root+'/deployment-contract.json',10000,200000);need(hashlib.sha256(raw).hexdigest()==p['deploymentContractSha256'],'original_pg_contract_changed');legacy=json.loads(raw)
 need(legacy['schema']=='academy.private-retained-deployment-contract.v3' and legacy['taskId']==c['taskId'] and legacy['nativeTaskRoot']==legacy_root and legacy['sourceAcquisition'] is False,'original_pg_contract_scope_required')
 child,manager,wanted=expected_role(legacy,legacy_root,'postgres',authority)
 generation=authority['generation'];need(isinstance(generation,str) and re.fullmatch('[a-f0-9]{24}',generation) is not None,'original_pg_generation_required')
 receipt_path=legacy_root+'/state/process-postgres-'+generation+'.json';need(authority['nativeReceiptPath']==receipt_path and p['nativeReceiptPath']==receipt_path and authority['nativeReceiptSha256']==p['nativeGatedReceiptSha256'],'original_pg_receipt_binding_required')
 receipt_raw=read_regular(receipt_path,10000,100000);need(hashlib.sha256(receipt_raw).hexdigest()==p['nativeRunningReceiptSha256'],'original_pg_receipt_changed');receipt=json.loads(receipt_raw)
 need(receipt['schema']=='academy.owned-product-process.v2' and receipt['phase']=='running','original_pg_running_receipt_required');gated={**receipt,'phase':'gated'};gated.pop('identity',None);need(hashlib.sha256((json.dumps(gated,separators=(',',':'))+'\n').encode()).hexdigest()==p['nativeGatedReceiptSha256'],'original_pg_gated_to_running_reconciliation_failed')
 need(receipt['taskId']==c['taskId'] and receipt['role']=='postgres' and receipt['generation']==generation and receipt['manager']==manager and receipt['gatedChild']==child and receipt['expectedExecutable']==wanted['executable'] and receipt['expectedCwd']==wanted['cwd'] and receipt['expectedArgv']==wanted['argv'],'original_pg_receipt_scope_required')
 before_manager=identity(manager['pid']);before_child=identity(child['pid']);need(receipt['identity']==before_child,'original_pg_running_receipt_birth_changed');endpoint_before=observe_original_pg_endpoint(legacy,before_child,p.get('postgresEndpoint'))
 need(before_manager==manager and all(before_child[key]==child[key] for key in ['pid','startTicks','namespace','bootId']) and all(before_child[key]==wanted[key] for key in ['executable','cwd','argv']) and parent_pid(child['pid'])==manager['pid'],'original_pg_live_birth_or_role_changed')
 need(observe_original_pg_endpoint(legacy,before_child,p.get('postgresEndpoint'))==endpoint_before,'original_pg_endpoint_observation_drift')
 need(hashlib.sha256(read_regular(old_admission_path,10000,20000)).hexdigest()==p['oldNativeActivationSha256'] and identity(manager['pid'])==before_manager and identity(child['pid'])==before_child and hashlib.sha256(read_regular(legacy_root+'/deployment-contract.json',10000,200000)).hexdigest()==p['deploymentContractSha256'] and hashlib.sha256(read_regular(receipt_path,10000,100000)).hexdigest()==p['nativeRunningReceiptSha256'],'original_pg_observation_drift')
 return {'schema':'academy.original-postgres-preservation.v1','taskId':c['taskId'],'preserved':True,'originalDeploymentContractSha256':p['deploymentContractSha256'],'originalNativeGatedReceiptSha256':p['nativeGatedReceiptSha256'],'originalNativeRunningReceiptSha256':p['nativeRunningReceiptSha256'],'postgresEndpoint':endpoint_before,'manager':before_manager,'postgres':before_child,'readOnly':True,'PGAction':False}

def main():
 need(len(sys.argv)>=3,'fixed_native_os_operation_required');operation,role=sys.argv[1:3];require_successor_scope(operation,role,sys.argv[3:]);c,root,admission=task_contract()
 if operation=='preserve-postgres':
  need('preserve-postgres' in admission['operations'],'explicit_preservation_read_scope_required');print(json.dumps(preserve_original_postgres(c,read_stdin_json())));return
 if operation in ['serve','stop','status']:need(len(sys.argv)==3 and role in ['postgres','app','tunnel'],'fixed_native_role_required')
 if operation=='status':
  previous=read_stdin_json();result=role_absence(c,root,role)
  if previous is not None:
   child,manager,_=expected_role(c,root,role,previous);result['previousChildBirthAbsent']=not birth_present(child);result['previousManagerBirthAbsent']=not birth_present(manager);need(result['previousChildBirthAbsent'] and result['previousManagerBirthAbsent'],'prior_incarnation_still_present')
  need(result['absent'],'role_restart_absence_required');print(json.dumps(result));return
 if operation=='stop':
  need('stop:'+role in admission['operations'],'explicit_stop_admission_required');print(json.dumps(stop_exact(c,root,role,read_stdin_json())));return
 if operation=='domain':
  need(role in ['ready','select-release'],'fixed_domain_arguments_required');need('preserve-postgres' in admission['operations'],'explicit_preservation_read_scope_required');context=read_stdin_json();preserve_original_postgres(c,context)
  if role=='select-release':need(role_absence(c,root,'app')['absent'] and role_absence(c,root,'tunnel')['absent'],'both_control_versions_ingress_absent_required')
  print(json.dumps(run_domain(c,root,role,sys.argv[3:])));return
 need(operation=='serve' and 'serve:'+role in admission['operations'],'explicit_role_start_admission_required')
 lockfd=os.open(root+'/state/serve-'+role+'.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW|os.O_NONBLOCK,0o600);lockstat=os.fstat(lockfd);need(stat.S_ISREG(lockstat.st_mode) and lockstat.st_uid==10000 and lockstat.st_nlink==1 and stat.S_IMODE(lockstat.st_mode)==0o600,'private_role_lock_required');fcntl.flock(lockfd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 stopped=[False];signal.signal(signal.SIGTERM,lambda *_:stopped.__setitem__(0,True));signal.signal(signal.SIGINT,lambda *_:stopped.__setitem__(0,True))
 context=read_stdin_json(20000,3);need('preserve-postgres' in admission['operations'],'explicit_preservation_read_scope_required');preserve_original_postgres(c,context['originalPostgresAuthority']);need(context['schema']=='academy.protected-role-start-context.v1' and context['taskId']==c['taskId'] and context['role']==role and context.get('allowKnownPostgresCrashRecovery') is False,'protected_clean_startup_context_required');need(role_absence(c,root,role)['absent'],'role_start_conflict')
 spec=run_domain(c,root,'prepare-role',[role]);need(spec['schema']=='academy.product-role-launch.v1' and spec['taskId']==c['taskId'] and spec['role']==role and spec['sourceAcquisition'] is False,'typed_role_preparation_required')
 need(not stopped[0],'stop_before_role_release');generation=os.urandom(12).hex();receipt_path=root+'/state/process-'+role+'-'+generation+'.json';log_path=root+'/state/'+role+'-'+generation+'.log';logfd=os.open(log_path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_NONBLOCK,0o600)
 def root_ack(state,receipt_sha):
  need(not stopped[0],'stop_before_root_ack');event={'event':'native_role_gated','schema':'academy.protected-product-birth-authority.v1','taskId':c['taskId'],'role':role,'generation':generation,'deploymentContractSha256':hashlib.sha256(read_regular(root+'/deployment-contract.json',10000,200000)).hexdigest(),'manager':state['manager'],'gatedChild':state['gatedChild'],'expectedExecutable':state['expectedExecutable'],'expectedCwd':state['expectedCwd'],'expectedArgv':state['expectedArgv'],'nativeReceiptPath':receipt_path,'nativeReceiptSha256':receipt_sha};print(json.dumps(event,separators=(',',':')),flush=True)
  ack=read_stdin_json(1000,3);need(not stopped[0] and ack=={'taskId':c['taskId'],'role':role,'nativeReceiptSha256':receipt_sha,'release':True},'protected_root_ack_required')
 try:
  handle=checked_launch(spec,receipt_path,{'taskId':c['taskId'],'role':role,'generation':generation,'logPath':log_path},before_release=root_ack)
  code,_,_=drain_owned(handle,None,32*1024*1024,32*1024*1024,logfd,lambda:stopped[0]);need(role_absence(c,root,role)['absent'],'role_exit_endpoint_absence_unconfirmed');print(json.dumps({'event':'owned_role_exited','role':role,'exitCode':code,'positiveAbsence':True}),flush=True);sys.exit(code)
 finally:os.fsync(logfd);os.close(logfd);os.close(lockfd)

if __name__=='__main__':
 try:main()
 except OwnedCleanupUncertainty as error:
  # Remain the direct reaper on uncertainty. Exiting would orphan the known child.
  print(json.dumps({'status':'hold','code':'owned_child_cleanup_uncertain','nativeState':'known owned child retained; no restart or retry'}),file=sys.stderr,flush=True)
  handle=error.handle
  while True:
   try:
    if child_exit_reserved(handle['pid']):reap_reserved(handle['pid'],2);close_handle(handle);break
   except BaseException:pass
   time.sleep(0.2)
  sys.exit(78)
 except BaseException as error:
  if isinstance(error,SystemExit):raise
  code=str(error);code=code if len(code)<100 and code.replace('_','').isalnum() else 'bounded_native_os_refusal';print(json.dumps({'status':'refused','code':code,'rawExceptionEmitted':False,'dependentEffectsHeld':True}),file=sys.stderr);sys.exit(78)
