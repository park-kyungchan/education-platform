import os,sys,stat,json,hashlib,subprocess,selectors,time,signal

def need(value,code):
 if not value:raise RuntimeError(code)

def trusted_chain(path):
 need(os.path.isabs(path) and os.path.realpath(path)==path,'protected_absolute_nosymlink_path_required')
 current='/'
 for part in path.split('/')[1:]:
  current=os.path.join(current,part);value=os.lstat(current)
  need(value.st_uid==0 and value.st_mode&0o022==0 and not stat.S_ISLNK(value.st_mode),'root_owned_nonwritable_ancestor_required')
 return True

def open_regular(path,uid,cap,private=False,root_protected=False):
 if root_protected:trusted_chain(path)
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  value=os.fstat(fd)
  need(stat.S_ISREG(value.st_mode) and value.st_uid==uid and value.st_nlink==1 and 0<=value.st_size<=cap and (not private or value.st_mode&0o077==0),'bounded_regular_descriptor_required')
  return fd,value
 except BaseException:
  os.close(fd);raise

def read_regular(path,uid,cap,private=False,root_protected=False):
 fd,before=open_regular(path,uid,cap,private,root_protected)
 try:
  chunks=[];total=0
  while True:
   part=os.read(fd,min(1048576,cap-total+1))
   if not part:break
   total+=len(part);need(total<=cap and total<=before.st_size,'regular_read_grew');chunks.append(part)
  after=os.fstat(fd);need(total==before.st_size and after.st_ino==before.st_ino and after.st_dev==before.st_dev and after.st_size==before.st_size and after.st_mtime_ns==before.st_mtime_ns and after.st_ctime_ns==before.st_ctime_ns and after.st_mode==before.st_mode and after.st_uid==before.st_uid and after.st_nlink==1,'regular_read_identity_changed')
  return b''.join(chunks)
 finally:os.close(fd)

def digest_regular(path,uid,cap,private=False,root_protected=False):
 fd,before=open_regular(path,uid,cap,private,root_protected)
 try:
  h=hashlib.sha256();total=0
  while True:
   part=os.read(fd,1048576)
   if not part:break
   total+=len(part);need(total<=cap and total<=before.st_size,'regular_digest_grew');h.update(part)
  after=os.fstat(fd);need(total==before.st_size and after.st_ino==before.st_ino and after.st_dev==before.st_dev and after.st_size==before.st_size and after.st_mtime_ns==before.st_mtime_ns and after.st_ctime_ns==before.st_ctime_ns and after.st_mode==before.st_mode and after.st_uid==before.st_uid and after.st_nlink==1,'regular_digest_identity_changed')
  return h.hexdigest()
 finally:os.close(fd)

def validate_runtime(contract):
 need(sys.flags.isolated and sys.flags.no_site and sys.flags.no_user_site and sys.flags.dont_write_bytecode,'isolated_trusted_python_required')
 need(os.path.realpath(sys.executable)==contract['pythonExecutable'],'exact_host_python_required')
 need(list(sys.path)==contract['pythonSearchPath'],'trusted_python_search_path_required')
 for path in sys.path:
  if os.path.exists(path):trusted_chain(os.path.realpath(path))
  else:trusted_chain(os.path.dirname(path))
 for entry in contract['trustedHostPins']:
  need(digest_regular(entry['resolvedPath'],0,134217728,False,True)==entry['sha256'],'trusted_host_binary_library_pin_failed')
 # These values are cleared by systemd before env executes; env -i clears every inherited variable before Python.
 need(set(os.environ)<=set(['PATH','HOME','LANG','LC_ALL']) and os.environ.get('PATH')=='/usr/bin:/bin','clean_privileged_environment_required')

host_read_regular=read_regular
import os,sys,json,stat,signal,select,selectors,time,hashlib,threading

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


def host_contract():
 root=os.path.dirname(os.path.realpath(__file__));trusted_chain(root);need(os.getuid()==0 and os.getgid()==0,'host_root_required')
 need(len(sys.argv)>=4 and sys.argv[1]=='--contract-sha','root_installed_contract_pin_required');raw=host_read_regular(root+'/host-contract.json',0,200000,True,True);need(hashlib.sha256(raw).hexdigest()==sys.argv[2],'protected_host_contract_pin_failed');c=json.loads(raw)
 need(c['schema']=='academy.protected-host-supervisor-contract.v3','successor_host_schema_required');need(all(isinstance(c.get(key),str) and len(c[key])==64 and all(ch in '0123456789abcdef' for ch in c[key]) for key in ['runtimePreparationDecisionSha256','runtimeClosureObservationSha256']),'current_successor_qualification_refs_required');need(root==c['protectedHostRoot'] and c['hostRootCodeFromBindMount'] is False and c['runtimeQualification']=='ROOT_ACCEPTED_EXACT_INCARNATION_SOURCE_ONLY','exact_protected_host_scope_required');validate_runtime(c)
 need(digest_regular(os.path.realpath(__file__),0,200000,True,True)==c['rootBootstrapSha256'],'protected_host_source_changed')
 need(host_read_regular(root+'/docker-empty/config.json',0,100,True,True)==b'{}\n','fixed_empty_docker_config_required')
 socket=os.path.realpath('/var/run/docker.sock');need(socket=='/run/docker.sock','fixed_docker_socket_required');s=os.lstat(socket);need(stat.S_ISSOCK(s.st_mode) and s.st_uid==0 and stat.S_IMODE(s.st_mode) in [0o600,0o660],'trusted_docker_socket_required')
 docker=['/usr/bin/docker','--host','unix:///var/run/docker.sock','--config',root+'/docker-empty'];code,out,err=finite(c,root,docker+['inspect',c['container']['id']],b'',10)
 need(code==0 and not err,'fixed_container_inspection_failed');items=json.loads(out);need(len(items)==1,'fixed_container_required');actual=items[0];wanted=c['container']
 need(actual['Id']==wanted['id'] and actual['Image']==wanted['imageId'] and actual['State']['Running'] and actual['State']['Pid']==wanted['initPid'],'container_identity_changed');raw_stat=open('/proc/'+str(wanted['initPid'])+'/stat').read(4096);need(raw_stat.rsplit(') ',1)[1].split()[19]==wanted['initStartTicks'] and os.readlink('/proc/'+str(wanted['initPid'])+'/ns/pid')==wanted['pidNamespace'] and open('/proc/sys/kernel/random/boot_id').read(100).strip()==wanted['bootId'],'container_birth_changed')
 need(any(m['Type']=='bind' and m['Source']==c['hostDataRoot'] and m['Destination']=='/opt/data' and m['RW'] for m in actual['Mounts']),'exact_bind_mount_required')
 need(isinstance(c['nativeRuntimePins'],list) and len(c['nativeRuntimePins'])>0,'current_compiler_dependency_closure_required')
 for entry in c['nativeRuntimePins']:
  path='/proc/'+str(wanted['initPid'])+'/root'+entry['resolvedPath'];fd,before=open_regular(path,entry['uid'],134217728)
  try:
   need(before.st_size==entry['bytes'] and stat.S_IMODE(before.st_mode)==entry['mode'],'native_runtime_metadata_changed');h=hashlib.sha256();size=0
   while True:
    chunk=os.read(fd,1048576)
    if not chunk:break
    size+=len(chunk);need(size<=before.st_size,'native_runtime_cap');h.update(chunk)
   after=os.fstat(fd);need(size==before.st_size and h.hexdigest()==entry['sha256'] and (before.st_ino,before.st_dev,before.st_size,before.st_mtime_ns,before.st_ctime_ns,before.st_mode,before.st_uid,before.st_nlink)==(after.st_ino,after.st_dev,after.st_size,after.st_mtime_ns,after.st_ctime_ns,after.st_mode,after.st_uid,after.st_nlink),'native_runtime_pin_changed')
  finally:os.close(fd)
 for entry in c['nativeInputPins']:
  path=entry['hostPath'];need(path.startswith(c['hostTaskRoot']+'/') and os.path.realpath(path)==path,'native_input_scope_required');need(digest_regular(path,10000,entry['cap'],True)==entry['sha256'],'native_input_pin_changed')
 return c,root,docker,hashlib.sha256(raw).hexdigest()

def docker_pin(c):
 row=[p for p in c['trustedHostPins'] if p['resolvedPath']=='/usr/bin/docker'];need(len(row)==1,'fixed_host_docker_pin_required');return {'uid':0,'bytes':row[0]['bytes'],'sha256':row[0]['sha256']}

def host_environment():return {'PATH':'/usr/bin:/bin','HOME':'/root','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'}

def finite(c,root,arguments,body,seconds=45):
 need(isinstance(body,bytes) and len(body)<=20000 and 0<seconds<=50,'fixed_finite_transport_cap');path=root+'/state/transport-'+os.urandom(12).hex()+'.json';handle=checked_launch({'argv':arguments,'cwd':'/','env':host_environment(),'binaryPin':docker_pin(c),'stdinPipe':True},path,{'taskId':c['taskId'],'role':'host-docker-transport'})
 try:
  return drain_owned(handle,seconds,200000,65536,input_data=body)
 except BaseException:
  if not handle.get('reaped'):cleanup_owned(handle)
  close_handle(handle);raise

def native_arguments(c,docker,operation,role,arguments=[]):
 need(operation in ['serve','stop','status','domain','preserve-postgres'],'fixed_native_os_operation_required');need(role in ['app','tunnel'] if operation in ['serve','stop','status'] else role=='postgres' if operation=='preserve-postgres' else role in ['ready','select-release'],'fixed_native_role_required')
 argv=docker+['exec','--interactive','--user','10000:10000','--workdir',c['nativeTaskRoot']]
 for name in ['LD_PRELOAD','LD_LIBRARY_PATH','LD_AUDIT','PYTHONPATH','PYTHONHOME','BASH_ENV','ENV']:argv+=['--env',name+'=']
 argv += [c['container']['id'],'/usr/bin/env','-i','HOME=/opt/data','PATH=/usr/bin:/bin','LANG=C.UTF-8','LC_ALL=C.UTF-8',c['nativePython'],'-I','-S','-B',c['nativeTaskRoot']+'/native-product-os.py',operation,role]+arguments
 need(sum(len(v.encode())+1 for v in argv)<=20000 and all(len(v.encode())<=4096 for v in argv),'bounded_fixed_docker_arguments_required');return argv

def authority_shape(c,root,role,value,host_sha):
 need(isinstance(value,dict) and value.get('event')=='native_role_gated' and value.get('schema')=='academy.protected-product-birth-authority.v1' and value.get('taskId')==c['taskId'] and value.get('role')==role and value.get('deploymentContractSha256')==c['deploymentContractSha256'],'native_gated_authority_scope_required')
 manager=value['manager'];child=value['gatedChild'];need(manager['argv']==[c['nativePython'],'-I','-S','-B',c['nativeTaskRoot']+'/native-product-os.py','serve',role] and manager['cwd']==c['nativeTaskRoot'] and manager['executable']==c['nativePython'],'exact_native_manager_authority_required')
 for person in [manager,child]:need(type(person['pid'])==int and person['pid']>1 and isinstance(person['startTicks'],str) and person['startTicks'].isdigit() and person['namespace']==c['container']['pidNamespace'] and person['bootId']==c['container']['bootId'],'native_gated_birth_required')
 need(child['pid']!=manager['pid'] and child['executable']==manager['executable'] and child['cwd']==manager['cwd'] and child['argv']==manager['argv'],'exact_forked_child_authority_required')
 wanted={'executable':value['expectedExecutable'],'cwd':value['expectedCwd'],'argv':value['expectedArgv']};nroot=c['nativeTaskRoot']
 if role=='postgres':valid=wanted=={'executable':c['postgresBinary'],'cwd':c['primary'],'argv':[c['postgresBinary'],'-D',c['primary'],'-c','config_file='+nroot+'/primary-runtime.conf']}
 elif role=='app':valid=any(wanted=={'executable':c['bunBinary'],'cwd':c['releaseRoot']+'/'+row['label'],'argv':[c['bunBinary'],'--no-env-file',c['releaseRoot']+'/'+row['label']+'/'+row['entrypoint'],'--retained-only']} for row in c['releases'])
 else:valid=wanted=={'executable':c['cloudflaredBinary'],'cwd':nroot,'argv':[c['cloudflaredBinary'],'tunnel','--config','/opt/data/profiles/dc-gang-a-dev/academy/tunnel-config.json','run']}
 need(valid and len(value['nativeReceiptSha256'])==64,'fixed_role_authority_required');return {**value,'hostContractSha256':host_sha,'hostManager':identity(os.getpid())}

def first_event(handle,seconds=45):
 raw=bytearray();errors=0;deadline=time.monotonic()+seconds
 while True:
  need(time.monotonic()<deadline and not child_exit_reserved(handle['pid']),'native_gated_event_missing')
  for key,_ in handle['selector'].select(0.1):
   if key.data=='pidfd':continue
   try:part=os.read(key.fd,1 if key.data=='stdout' else 4096)
   except BlockingIOError:continue
   if not part:handle['selector'].unregister(key.fd);continue
   if key.data=='stderr':errors+=len(part);need(errors<=65536,'startup_stderr_cap');raise RuntimeError('native_startup_refused')
   raw+=part;need(len(raw)<=20000,'native_gated_event_cap')
   if part==b'\n':return json.loads(raw)

def native_status(c,root,docker,role,authority):
 body=(json.dumps(authority,separators=(',',':'))+'\n').encode() if authority else b'\n';code,out,err=finite(c,root,native_arguments(c,docker,'status',role),body,10);need(code==0 and not err,'native_restart_reconciliation_hold');result=json.loads(out);need(result['role']==role and result['absent'] and result['ownedEndpointAbsent'],'native_positive_absence_required');return result

def native_stop(c,root,docker,role,authority):
 code,out,err=finite(c,root,native_arguments(c,docker,'stop',role),(json.dumps(authority,separators=(',',':'))+'\n').encode(),45);need(code==0 and not err,'native_explicit_stop_hold');value=json.loads(out);need(value['event']=='exact_role_stopped' and value['childBirthAbsent'] and value['managerBirthAbsent'] and value['pidfdOnly'] and value['positiveRoleAbsence']['absent'],'native_explicit_stop_absence_required');return value

def require_successor_scope(operation,role,arguments):
 if operation=='verify-only':need(role is None and not arguments,'fixed_verify_only_required');return
 if operation in ('serve','stop','status'):need(role in ('app','tunnel') and not arguments,'preserved_postgres_lifecycle_forbidden');return
 if operation=='domain':
  need(role in ('ready','select-release'),'consumed_product_operation_forbidden')
  need((role=='ready' and len(arguments)==1 and arguments[0] in ('app','tunnel')) or (role=='select-release' and len(arguments)==2),'fixed_successor_domain_arguments');return
 raise RuntimeError('successor_operation_not_allowed')

def require_old_non_pg_retirement(raw,c,p,is_root):
 value=json.loads(raw);allowed={'status:postgres','stop:postgres','status:app','stop:app','status:tunnel','stop:tunnel'}
 need(value['schema']=='academy.root-product-activation-admission.v2' and value['taskId']==c['taskId'] and value['deploymentContractSha256']==p['deploymentContractSha256'] and value['sourceAcquisition'] is False,'original_admission_binding_required')
 if is_root:need(value['hostContractSha256']==p['hostContractSha256'],'original_root_admission_binding_required')
 operations=value['operations'];need(isinstance(operations,list) and operations and all(isinstance(op,str) and op in allowed for op in operations) and len(set(operations))==len(operations) and 'status:postgres' in operations,'old_bun_execution_eligibility_not_retired')

def preserve_original_postgres(c,root,docker,admission):
 need('preserve-postgres' in admission['operations'],'explicit_preservation_read_scope_required')
 p=c['preservedPostgres'];need(isinstance(p,dict) and all(isinstance(p.get(key),str) and len(p[key])==64 and all(ch in '0123456789abcdef' for ch in p[key]) for key in ['hostContractSha256','deploymentContractSha256','rootAuthoritySha256','nativeGatedReceiptSha256','nativeRunningReceiptSha256','migrationReceiptSha256','oldRootActivationSha256','oldNativeActivationSha256']),'preserved_pg_authority_binding_required')
 original_root=p['protectedHostRoot'];need(original_root=='/opt/academy-product-supervisor/71c5a0e737e0' and original_root!=root and p['nativeTaskRoot']=='/opt/data/academy-release-staging-20261015-71c5a0e737e0','exact_original_pg_root_required')
 old_admission_path=original_root+'/activation-admission.json';old_admission_raw=host_read_regular(old_admission_path,0,20000,True,True);need(hashlib.sha256(old_admission_raw).hexdigest()==p['oldRootActivationSha256'],'original_root_retirement_admission_changed');require_old_non_pg_retirement(old_admission_raw,c,p,True)
 old_raw=host_read_regular(original_root+'/host-contract.json',0,200000,True,True);need(hashlib.sha256(old_raw).hexdigest()==p['hostContractSha256'],'original_pg_host_contract_changed');old=json.loads(old_raw)
 need(old['taskId']==c['taskId'] and old['deploymentContractSha256']==p['deploymentContractSha256'] and old['nativeTaskRoot']==p['nativeTaskRoot'],'original_pg_host_scope_required')
 path=original_root+'/state/authority-postgres.json';raw=host_read_regular(path,0,20000,True,True);need(hashlib.sha256(raw).hexdigest()==p['rootAuthoritySha256'],'original_pg_root_authority_changed');authority=json.loads(raw)
 need(authority['schema']=='academy.protected-product-birth-authority.v1' and authority['taskId']==c['taskId'] and authority['role']=='postgres' and authority['hostContractSha256']==p['hostContractSha256'] and authority['deploymentContractSha256']==p['deploymentContractSha256'] and authority['nativeReceiptSha256']==p['nativeGatedReceiptSha256'] and authority['nativeReceiptPath']==p['nativeReceiptPath'],'original_pg_authority_scope_required')
 supervisor=identity(authority['hostManager']['pid']);need(supervisor==authority['hostManager'],'original_pg_root_supervisor_changed')
 code,out,err=finite(c,root,native_arguments(c,docker,'preserve-postgres','postgres'),(json.dumps(authority,separators=(',',':'))+'\n').encode(),10)
 need(code==0 and not err,'original_pg_preservation_hold');value=json.loads(out);need(value['schema']=='academy.original-postgres-preservation.v1' and value['taskId']==c['taskId'] and value['preserved'] is True and value['readOnly'] is True and value['PGAction'] is False and value['originalDeploymentContractSha256']==p['deploymentContractSha256'] and value['originalNativeGatedReceiptSha256']==p['nativeGatedReceiptSha256'] and value['originalNativeRunningReceiptSha256']==p['nativeRunningReceiptSha256'] and value['postgresEndpoint']==p['postgresEndpoint'],'original_pg_preservation_result_required')
 need(hashlib.sha256(host_read_regular(old_admission_path,0,20000,True,True)).hexdigest()==p['oldRootActivationSha256'] and identity(authority['hostManager']['pid'])==supervisor and hashlib.sha256(host_read_regular(path,0,20000,True,True)).hexdigest()==p['rootAuthoritySha256'] and hashlib.sha256(host_read_regular(original_root+'/host-contract.json',0,200000,True,True)).hexdigest()==p['hostContractSha256'],'original_pg_root_observation_drift')
 return value,raw

def main():
 need(len(sys.argv)>=4,'fixed_successor_root_arguments');operation=sys.argv[3];role=sys.argv[4] if len(sys.argv)>4 else None;arguments=sys.argv[5:];require_successor_scope(operation,role,arguments);c,root,docker,host_sha=host_contract()
 if operation=='verify-only':need(role is None,'fixed_verify_only_required');print(json.dumps({'status':'verified','nativeCodeExecutedAsRoot':False,'productActivation':False}));return
 admission=json.loads(host_read_regular(root+'/activation-admission.json',0,20000,True,True));need(admission['schema']=='academy.root-product-activation-admission.v2' and admission['taskId']==c['taskId'] and admission['hostContractSha256']==host_sha and admission['deploymentContractSha256']==c['deploymentContractSha256'] and admission['sourceAcquisition'] is False,'separate_root_activation_admission_required')
 if operation=='domain':
  need(role in ['ready','select-release'],'fixed_domain_operation_required');key=role+':'+arguments[0] if role=='ready' and len(arguments)==1 else role;need(key in admission['operations'],'root_domain_operation_not_admitted')
  preserved,original_authority=preserve_original_postgres(c,root,docker,admission)
  code,out,err=finite(c,root,native_arguments(c,docker,operation,role,arguments),original_authority+b'\n',50);need(code==0 and not err,'domain_effect_outcome_hold_no_retry');sys.stdout.buffer.write(out);return
 need(operation in ['serve','stop','status'] and role in ['app','tunnel'] and not arguments,'fixed_host_role_operation_required');need(operation+':'+role in admission['operations'],'root_role_operation_not_admitted');path=root+'/state/authority-'+role+'.json';prior=host_read_regular(path,0,20000,True,True) if os.path.lexists(path) else None;authority=json.loads(prior) if prior else None
 if operation=='status':print(json.dumps(native_status(c,root,docker,role,authority)));return
 if operation=='stop':need(authority is not None and authority['hostContractSha256']==host_sha,'protected_root_birth_authority_required');print(json.dumps(native_stop(c,root,docker,role,authority)));return
 # Ordinary automatic restart is allowed only after exact previous incarnation and endpoint absence.
 preserved,original_authority_raw=preserve_original_postgres(c,root,docker,admission);original_authority=json.loads(original_authority_raw)
 absence=native_status(c,root,docker,role,authority);need(not prior or admission.get('restartOnlyAfterPositiveAbsence') is True,'automatic_restart_not_admitted');handle=None;current=None;released=False;stop_attempted=[False]
 try:
  handle=checked_launch({'argv':native_arguments(c,docker,'serve',role),'cwd':'/','env':host_environment(),'binaryPin':docker_pin(c),'stdinPipe':True},root+'/state/serve-transport-'+os.urandom(12).hex()+'.json',{'taskId':c['taskId'],'role':'host-serve:'+role})
  context=(json.dumps({'schema':'academy.protected-role-start-context.v1','taskId':c['taskId'],'role':role,'priorAuthority':authority,'priorPositiveAbsence':absence,'allowKnownPostgresCrashRecovery':False,'originalPostgresAuthority':original_authority},separators=(',',':'))+'\n').encode();need(len(context)<=20000,'startup_context_cap');offset=0
  while offset<len(context):n=os.write(handle['stdin'],context[offset:]);need(n>0,'startup_context_short_write');offset+=n
  current=authority_shape(c,root,role,first_event(handle),host_sha);current['priorPositiveAbsence']=absence;current['hostTransportIdentity']=handle['identity'];atomic_receipt(path,current,hashlib.sha256(prior).hexdigest() if prior else 'absent')
  ack=(json.dumps({'taskId':c['taskId'],'role':role,'nativeReceiptSha256':current['nativeReceiptSha256'],'release':True},separators=(',',':'))+'\n').encode();offset=0
  while offset<len(ack):n=os.write(handle['stdin'],ack[offset:]);need(n>0,'root_ack_short_write');offset+=n
  released=True;close_fd(handle['stdin']);handle['handles'].remove(handle['stdin']);handle['stdin']=None
  stopping=[False];signal.signal(signal.SIGTERM,lambda *_:stopping.__setitem__(0,True));signal.signal(signal.SIGINT,lambda *_:stopping.__setitem__(0,True));sent=[False]
  def stop_requested():
   if stopping[0] and not sent[0]:stop_attempted[0]=True;native_stop(c,root,docker,role,current);sent[0]=True
   return False
  code,out,err=drain_owned(handle,None,200000,65536,stop_requested=stop_requested);need(not err,'native_serve_refusal');native_status(c,root,docker,role,current);sys.stdout.buffer.write(out);sys.exit(code)
 except BaseException as error:
  if isinstance(error,SystemExit):raise
  cleanup_error=None
  # Every stop is attempted once. A failed stop is uncertain, never a reason to repeat it.
  if current is not None and not stop_attempted[0]:
   stop_attempted[0]=True
   try:native_stop(c,root,docker,role,current)
   except BaseException:cleanup_error=RuntimeError('native_cleanup_outcome_uncertain_no_retry')
  try:
   if handle is not None and not handle.get('reaped'):cleanup_owned(handle)
  finally:
   if handle is not None and handle.get('reaped'):close_handle(handle)
  if cleanup_error is not None:raise cleanup_error
  # Read-only reconciliation may fail; it cannot authorize another start or stop.
  native_status(c,root,docker,role,current);raise

if __name__=='__main__':
 try:main()
 except OwnedCleanupUncertainty as error:
  print(json.dumps({'status':'hold','code':'owned_host_transport_cleanup_uncertain','nativeOutcome':'unverified; no restart or retry'}),file=sys.stderr,flush=True);handle=error.handle
  while True:
   try:
    if child_exit_reserved(handle['pid']):reap_reserved(handle['pid'],2);close_handle(handle);break
   except BaseException:pass
   time.sleep(0.2)
  sys.exit(78)
 except BaseException as error:
  if isinstance(error,SystemExit):raise
  code=str(error);code=code if len(code)<100 and code.replace('_','').isalnum() else 'bounded_protected_host_refusal';print(json.dumps({'status':'hold','code':code,'rawExceptionEmitted':False,'nativeEffectsNotInferredFromHostTransport':True}),file=sys.stderr);sys.exit(78)
