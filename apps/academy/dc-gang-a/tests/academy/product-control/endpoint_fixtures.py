import ast,json,stat,io,copy
from types import SimpleNamespace
from pathlib import Path
b=Path(__file__).resolve().parents[3]
source=ast.parse((b/'runtime/product-control/native-product-os.py').read_text());nodes=[n for n in source.body if isinstance(n,ast.FunctionDef) and n.name in ['need','observe_original_pg_endpoint']]
ns={'stat':stat};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<source-endpoint-fixture>','exec'),ns)
path='/opt/data/profiles/dc-gang-a-dev/academy/socket/.s.PGSQL.9999';child={'pid':102,'startTicks':'12','bootId':'fictional','namespace':'pid:[fixture]'}
def item(mode,ino,uid=10000):return SimpleNamespace(st_mode=mode,st_ino=ino,st_dev=7,st_uid=uid,st_gid=uid,st_nlink=1,st_ctime_ns=99)
socket=item(stat.S_IFSOCK|0o700,888);parent=item(stat.S_IFDIR|0o700,11)
expected={'path':path,'filesystem':{'device':7,'inode':888,'uid':10000,'gid':10000,'mode':0o700,'ctimeNs':99},'kernelInode':'777','ownerPid':102,'ownerStartTicks':'12','ownerBootId':'fictional','ownerNamespace':'pid:[fixture]','listenerFds':['6']}
c={'postgresSocket':path,'postgresPort':9999};state={};checks=[]
class Entries:
 def __enter__(self):return iter([SimpleNamespace(name='6')])
 def __exit__(self,*args):pass
class FixtureOS:
 path=SimpleNamespace(join=lambda left,right:left.rstrip('/')+'/'+right)
 def lstat(self,name):
  state['statCalls']=state.get('statCalls',0)+1
  if name==path:
   if state.get('absent'):raise FileNotFoundError(name)
   value=copy.copy(socket)
   if state.get('foreign'):value.st_uid=42
   if state.get('symlink'):value.st_mode=stat.S_IFLNK|0o700
   if state.get('rebound') and state.get('socketSeen'):value.st_ino+=1
   state['socketSeen']=True;return value
  return parent
 def scandir(self,name):
  if state.get('unobservable'):raise PermissionError(name)
  return Entries()
 def readlink(self,name):return 'socket:[999]' if state.get('foreignKernel') else 'socket:[777]'
def fake_open(name,mode):
 assert name=='/proc/102/net/unix' and mode=='rb'
 line='00000000: 00000002 00000000 00010000 0001 01 777 '+path+'\n'
 if state.get('missingKernel'):line=''
 return io.BytesIO(('Num RefCount Protocol Flags Type St Inode Path\n'+line).encode())
ns.update(os=FixtureOS(),identity=lambda pid:copy.deepcopy(child),open=fake_open)
def observe(contract=c,pin=expected):return ns['observe_original_pg_endpoint'](contract,child,pin)
assert observe()==expected;checks.append('stable-owned-endpoint-with-distinct-filesystem888-and-kernel777-inodes-accepted')
for label,flag in [('absent','absent'),('foreign-filesystem-owner','foreign'),('symlink-entry','symlink'),('rebound-filesystem-entry','rebound'),('missing-kernel-listener','missingKernel'),('kernel-listener-not-owned-by-PG-FD','foreignKernel'),('unobservable-PG-FD-inventory','unobservable')]:
 state.clear();state[flag]=True
 try:observe()
 except (RuntimeError,FileNotFoundError,PermissionError):checks.append(label+'-refused')
 else:raise AssertionError(label)
state.clear()
for contract,pin,label in [({},expected,'missing-original-socket-fields'),(c,None,'missing-qualified-endpoint-pin'),(c,{**expected,'kernelInode':'other'},'rebound-kernel-pin')]:
 state.clear()
 try:observe(contract,pin)
 except RuntimeError:checks.append(label+'-refused')
 else:raise AssertionError(label)
print(json.dumps({'status':'pass','checks':checks,'count':len(checks),'actualProcOrSocketReads':0,'actualNativeCalls':0,'DBOrNetworkConnections':0,'scope':'AST extracted source endpoint function, fake OS/proc metadata only'}))
