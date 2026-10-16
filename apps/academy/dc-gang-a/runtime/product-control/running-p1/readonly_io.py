# Injected exact-reviewed source, not an import of installed product/controller modules.
import os,sys,json,stat,hashlib,re,time,selectors,subprocess
HANDLES=[]
def no_duplicates(pairs):
 value={}
 for key,item in pairs:
  need(key not in value,'duplicate_json_key');value[key]=item
 return value

def parse(raw):return json.loads(raw,object_pairs_hook=no_duplicates)
def image(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def finish():
 for fd,parent,name,before in HANDLES:
  need(image(os.fstat(fd))==before and image(os.stat(name,dir_fd=parent,follow_symlinks=False))==before,'descriptor_or_named_parent_drift')
def close_all():
 for fd,_,_,_ in reversed(HANDLES):os.close(fd)
 HANDLES.clear()
def read_regular(path,uid,cap,private=True):
 need(path in READ_SCOPE and READ_SCOPE[path]==(uid,cap),'outside_finite_read_scope')
 flags=os.O_RDONLY|os.O_NONBLOCK|os.O_NOFOLLOW|os.O_CLOEXEC;parent=os.open('/',flags|os.O_DIRECTORY);s=os.fstat(parent)
 HANDLES.append((parent,None,'/',image(s)));need(stat.S_ISDIR(s.st_mode) and s.st_uid==0 and s.st_mode&0o022==0,'trusted_root_required')
 parts=path.split('/')[1:];need(parts and all(p not in ('','.','..') for p in parts),'fixed_absolute_path_required')
 for name in parts[:-1]:
  fd=os.open(name,flags|os.O_DIRECTORY,dir_fd=parent);s=os.fstat(fd);HANDLES.append((fd,parent,name,image(s)));need(stat.S_ISDIR(s.st_mode) and s.st_uid in (0,uid) and s.st_mode&0o022==0,'trusted_parent_required');parent=fd
 fd=os.open(parts[-1],flags,dir_fd=parent);s=os.fstat(fd);HANDLES.append((fd,parent,parts[-1],image(s)))
 need(stat.S_ISREG(s.st_mode) and s.st_uid==uid and s.st_gid==uid and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600 and 0<s.st_size<=cap,'private_bounded_single_link_required')
 raw=os.read(fd,s.st_size+1);need(len(raw)==s.st_size,'fixed_size_read_required');finish();return raw

def strict(value,keys):need(isinstance(value,dict) and set(value)==set(keys),'unexpected_metadata_shape');return value

def birth_shape(value):
 strict(value,['pid','startTicks','executable','cwd','argv','namespace','bootId']);need(type(value['pid'])==int and value['pid']>1 and isinstance(value['startTicks'],str) and re.fullmatch('[0-9]{1,24}',value['startTicks']) and isinstance(value['namespace'],str) and re.fullmatch(r'pid:\[[0-9]+\]',value['namespace']) and isinstance(value['bootId'],str) and re.fullmatch('[a-f0-9-]{36}',value['bootId']),'process_birth_metadata_shape_hold')
 need(all(isinstance(value[k],str) and value[k].startswith('/') and len(value[k])<=300 and '\x00' not in value[k] for k in ['executable','cwd']) and isinstance(value['argv'],list) and len(value['argv'])<=128 and all(isinstance(arg,str) and len(arg)<=4096 and '\x00' not in arg for arg in value['argv']),'process_launch_metadata_shape_hold')

def admission_metadata(raw,task,contract_sha,host_sha=None,migration=False):
 value=parse(raw);keys=['schema','taskId','deploymentContractSha256','sourceAcquisition','operations']
 if host_sha is not None:keys+=['hostContractSha256']
 if migration:
  migration_keys=['schema','taskId','deploymentContractSha256','expectedLegacySchemaSha256','tablesToAdd']
  if host_sha is not None or 'hostContractSha256' in value:migration_keys+=['hostContractSha256'];need(value.get('hostContractSha256')==(host_sha or 'cc15984302e48265bc852d8274d8cb0002c632249a45e6ce9c06ba05a396ed90'),'migration_host_binding_changed')
  strict(value,migration_keys);need(value['schema']=='academy.root-six-table-migration-admission.v1' and type(value['tablesToAdd'])==int and value['tablesToAdd']==6 and isinstance(value['expectedLegacySchemaSha256'],str) and re.fullmatch('[a-f0-9]{64}',value['expectedLegacySchemaSha256']),'migration_permission_metadata_hold');operations=['migrate']
 else:
  if host_sha is None and 'hostContractSha256' in value:keys+=['hostContractSha256'];need(value['hostContractSha256']=='cc15984302e48265bc852d8274d8cb0002c632249a45e6ce9c06ba05a396ed90','native_admission_host_binding_changed')
  if 'restartOnlyAfterPositiveAbsence' in value:keys+=['restartOnlyAfterPositiveAbsence'];need(type(value['restartOnlyAfterPositiveAbsence'])==bool,'restart_flag_type_hold')
  strict(value,keys);need(value['schema']=='academy.root-product-activation-admission.v2' and value['sourceAcquisition'] is False,'activation_metadata_hold');operations=value['operations']
  if host_sha is not None:need(value['hostContractSha256']==host_sha,'root_admission_contract_changed')
  allowed={'inspect-legacy','migrate','select-release'}|{op+':'+role for op in ('serve','stop','status','ready') for role in ('postgres','app','tunnel')}
  need(isinstance(operations,list) and len(operations)<=32 and all(isinstance(op,str) and op in allowed for op in operations) and len(set(operations))==len(operations),'unknown_admission_operation_hold')
 need(value['taskId']==task and value['deploymentContractSha256']==contract_sha,'admission_original_binding_changed')
 return {'sha256':hashlib.sha256(raw).hexdigest(),'operations':sorted(operations),'readOnly':True,'retired':False}

def bounded_transport(argv,body,seconds=15,cap=24576):
 # Cancel only directly owned docker CLI transport, never a PG/service process.
 need(len(body)<=20000,'native_transport_input_cap');child=subprocess.Popen(argv,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'});selector=None
 try:
  selector=selectors.DefaultSelector();streams={'stdout':bytearray(),'stderr':bytearray()};deadline=time.monotonic()+seconds;offset=0
  for name,stream in [('stdout',child.stdout),('stderr',child.stderr)]:os.set_blocking(stream.fileno(),False);selector.register(stream,selectors.EVENT_READ,name)
  os.set_blocking(child.stdin.fileno(),False)
  if body:selector.register(child.stdin,selectors.EVENT_WRITE,'stdin')
  else:child.stdin.close()
  while selector.get_map():
   remaining=deadline-time.monotonic();need(remaining>0,'owned_transport_deadline_hold')
   for key,_ in selector.select(min(remaining,0.1)):
    if key.data=='stdin':
     offset+=os.write(key.fd,body[offset:offset+4096])
     if offset==len(body):selector.unregister(key.fileobj);child.stdin.close()
     continue
    limit=cap if key.data=='stdout' else 1024;chunk=os.read(key.fd,min(4096,limit-len(streams[key.data])+1))
    if not chunk:selector.unregister(key.fileobj);continue
    streams[key.data].extend(chunk);need(len(streams[key.data])<=limit,'owned_transport_output_cap')
  need(child.wait(timeout=max(0.01,deadline-time.monotonic()))==0 and not streams['stderr'],'owned_transport_hold');return bytes(streams['stdout'])
 finally:
  # Ownership begins immediately after Popen; no selector/pipe cleanup can bypass reap.
  try:
   try:
    if child.poll() is None:
     try:child.kill()
     except ProcessLookupError:pass
   finally:
    try:child.wait(timeout=2)
    except (subprocess.TimeoutExpired,InterruptedError):
     # Kernel-uncertain exit retains this waiter; never complete while the child is unreaped.
     while True:
      try:child.wait();break
      except InterruptedError:continue
  finally:
   try:
    if selector is not None:selector.close()
   finally:
    error=None
    for stream in [child.stdin,child.stdout,child.stderr]:
     try:
      if stream and not stream.closed:stream.close()
     except BaseException as failure:
      if error is None:error=failure
    if error is not None:raise error
