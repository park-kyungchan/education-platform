# Exact source function with fictional subprocess/selector/OS ports. No real transport or target I/O.
import ast,json,threading
from pathlib import Path
from types import SimpleNamespace
source=(Path(__file__).resolve().parents[3]/'runtime/product-control/running-p1/readonly_io.py').read_text()
nodes=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='bounded_transport']
assert len(nodes)==1
class TimeoutExpired(Exception):pass
def need(value,code):
 if not value:raise RuntimeError(code)
checks=[]
def scenario(mode):
 events=[];waiting=threading.Event();release=threading.Event();returned=threading.Event();errors=[]
 class Stream:
  def __init__(self,name):self.name=name;self.closed=False
  def fileno(self):return 71
  def close(self):
   self.closed=True;events.append('close:'+self.name)
   assert child.reaped,'pipe_closed_before_reap'
   if mode=='pipe-close' and self.name=='stdin':raise OSError('FICTIONAL_PIPE_CLOSE')
 class Child:
  def __init__(self):self.reaped=False;self.waits=0;self.stdin=Stream('stdin');self.stdout=Stream('stdout');self.stderr=Stream('stderr')
  def poll(self):return 0 if self.reaped else None
  def kill(self):events.append('KILL')
  def wait(self,timeout=None):
   events.append('wait:'+str(timeout));self.waits+=1
   if mode=='interrupted-reap' and self.waits<=2:raise InterruptedError('FICTIONAL_INTERRUPTED_WAIT')
   if mode=='delayed-reap':
    if timeout is not None:raise TimeoutExpired('FICTIONAL_KERNEL_PENDING')
    waiting.set();assert release.wait(2),'fixture_release_timeout'
   self.reaped=True;events.append('reaped');return 0
 child=Child()
 class Selector:
  def __init__(self):
   events.append('selector-init')
   if mode=='selector-init':raise OSError(24,'FICTIONAL_EMFILE')
  def register(self,*args):
   events.append('register')
   if mode in ('register','delayed-reap','interrupted-reap'):raise RuntimeError('FICTIONAL_REGISTER')
  def get_map(self):return {}
  def close(self):
   events.append('selector-close');assert child.reaped,'selector_cleanup_before_reap'
   if mode=='selector-close':raise OSError('FICTIONAL_SELECTOR_CLOSE')
 def popen(argv,**options):
  assert argv==['FICTIONAL_NO_TRANSPORT'] and options=={'stdin':-1,'stdout':-1,'stderr':-1,'close_fds':True,'env':{'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'}}
  events.append('spawn');return child
 ns={'need':need,'subprocess':SimpleNamespace(Popen=popen,PIPE=-1,TimeoutExpired=TimeoutExpired),'selectors':SimpleNamespace(DefaultSelector=Selector,EVENT_READ=1,EVENT_WRITE=2),'time':SimpleNamespace(monotonic=lambda:0),'os':SimpleNamespace(set_blocking=lambda *args:None)}
 exec(compile(ast.Module(body=nodes,type_ignores=[]),'<fictional-owned-transport>','exec'),ns)
 def run():
  try:assert ns['bounded_transport'](['FICTIONAL_NO_TRANSPORT'],b'fixture')==b''
  except BaseException as error:errors.append(error)
  finally:returned.set()
 if mode=='delayed-reap':
  worker=threading.Thread(target=run);worker.start()
  try:
   assert waiting.wait(2),'blocking_reaper_not_reached'
   assert not returned.is_set() and not child.reaped,'returned_before_definitive_reap'
   assert events.count('KILL')==1 and not any(v.startswith('close:') for v in events)
  finally:release.set();worker.join(2)
  assert not worker.is_alive(),'fixture_waiter_not_released'
 else:run()
 assert returned.is_set() and child.reaped,'owned_child_not_reaped'
 assert all(stream.closed for stream in (child.stdin,child.stdout,child.stderr)),'remaining_pipe_cleanup_skipped'
 assert events.index('reaped')<min(events.index('close:'+name) for name in ('stdin','stdout','stderr'))
 if mode=='success':assert not errors and 'KILL' not in events
 else:
  assert len(errors)==1 and events.count('KILL')==(0 if mode in ('selector-close','pipe-close') else 1)
  expected={'selector-init':'FICTIONAL_EMFILE','register':'FICTIONAL_REGISTER','delayed-reap':'FICTIONAL_REGISTER','interrupted-reap':'FICTIONAL_REGISTER','selector-close':'FICTIONAL_SELECTOR_CLOSE','pipe-close':'FICTIONAL_PIPE_CLOSE'}[mode]
  assert expected in str(errors[0]),str(errors[0])
 checks.append({'case':mode,'events':events,'returnedOnlyAfterReap':True})
for mode in ('success','selector-init','register','delayed-reap','interrupted-reap','selector-close','pipe-close'):scenario(mode)
print(json.dumps({'status':'pass','count':len(checks),'checks':checks,'realChildSpawns':0,'actualSSH':0,'actualNativeCalls':0,'actualTargetReads':0}))
