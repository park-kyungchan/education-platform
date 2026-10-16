# Actual harmless Linux kernel memfd/socket proof with fake exec; no SSH/config/auth/target access.
import ast,os,sys,stat,errno,re,fcntl,select,time,hashlib,json,tempfile
from pathlib import Path
source=(Path(__file__).resolve().parents[3]/'runtime/product-control/running-p1/local_ssh_boundary.py').read_text();tree=ast.parse(source);nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef)];ns={'os':os,'sys':sys,'fcntl':fcntl,'select':select,'time':time,'hashlib':hashlib,'stat':stat,'json':json,'re':re,'errno':errno};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<fixed-source-boundary-fixture>','exec'),ns)
CONFIG=b'Host fixture.invalid\n  BatchMode yes\n';INPUT=b'FICTIONAL_REMOTE_OPERATION_INPUT\n'
ns.update(CONFIG_SHA256=hashlib.sha256(CONFIG).hexdigest(),CONFIG_BYTES=len(CONFIG),SSH_ARGUMENTS=['/usr/bin/ssh','-F','/proc/self/fd/3','-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','HostKeyAlias=srv1873899','-o','ConnectTimeout=10','-o','ConnectionAttempts=1','-o','ServerAliveInterval=5','-o','ServerAliveCountMax=2','srv1873899','/usr/bin/python3.12 -I -S -B -c FIXTURE_REVIEWED_CODE'])
class InterceptedExec(Exception):pass
record={};real_exec=os.execve;original_argv=sys.argv;sys.argv=['-c'];pid=os.getpid()
with tempfile.TemporaryDirectory(prefix='p1-fake-config-') as directory:
 path=Path(directory)/'fictional-config';path.write_bytes(CONFIG);captured=path.read_bytes();path.write_bytes(b'FICTIONAL_CHANGED_SOURCE_PATH')
 def fake_exec(binary,arguments,environment):
  assert binary=='/usr/bin/ssh' and arguments[:2]==ns['SSH_ARGUMENTS'][:2] and arguments[3:]==ns['SSH_ARGUMENTS'][3:] and arguments[2].startswith('/proc/'+str(os.getppid())+'/fd/') and environment=={'HOME':'/home/palantirkc','PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'} and os.getpid()==pid
  config_path=arguments[2]
  # Model the installed SSH main's closefrom(3) before it opens configuration.
  os.closerange(3,256)
  retained=os.open(config_path,os.O_RDONLY);expected=fcntl.F_SEAL_WRITE|fcntl.F_SEAL_GROW|fcntl.F_SEAL_SHRINK|fcntl.F_SEAL_SEAL
  assert stat.S_IMODE(os.fstat(retained).st_mode)==0o600 and fcntl.fcntl(retained,fcntl.F_GET_SEALS)==expected and fcntl.fcntl(retained,fcntl.F_GETFL)&os.O_ACCMODE==os.O_RDONLY
  with open(config_path,'rb') as stream:first=stream.read(4097)
  with open(config_path,'rb') as stream:second=stream.read(4097)
  assert first==second==captured==CONFIG and first!=path.read_bytes()
  for operation in [lambda:os.write(retained,b'x'),lambda:os.ftruncate(retained,0),lambda:fcntl.fcntl(retained,fcntl.F_ADD_SEALS,0)]:
   try:operation()
   except OSError:pass
   else:raise AssertionError('sealed readonly descriptor mutated')
  os.close(retained)
  actual_input=sys.stdin.buffer.read(4097);assert actual_input==INPUT
  record.update(configSha256=hashlib.sha256(first).hexdigest(),configBytes=len(first),stdinSha256=hashlib.sha256(actual_input).hexdigest(),stdinBytes=len(actual_input),kernelSeals=expected,parentRetainedReadonly=True,clientClosefromModeled=True,reopenStable=True,sameProcessIdentity=True,originalFixturePathChanged=True,actualSSH=0,actualConfigRead=0,actualTargetCalls=0)
  raise InterceptedExec()
 os.execve=fake_exec
 try:ns['config_snapshot_exec']()
 except InterceptedExec:pass
 finally:os.execve=real_exec;sys.argv=original_argv
assert record;print(json.dumps(record))
