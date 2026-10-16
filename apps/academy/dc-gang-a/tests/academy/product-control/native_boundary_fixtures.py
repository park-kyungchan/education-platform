import ast,json,hashlib,re,copy
from pathlib import Path
base=Path(__file__).resolve().parents[3]/'runtime/product-control'
def subset(file,names):
 tree=ast.parse((base/file).read_text());mapping={n.name:n for n in tree.body if isinstance(n,ast.FunctionDef)};nodes=[mapping[name] for name in names]
 ns={'json':json,'hashlib':hashlib,'re':re};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<owned-source-fixture-functions>','exec'),ns);return ns
native=subset('native-product-os.py',['need','require_successor_scope','require_old_non_pg_retirement','preserve_original_postgres','expected_role'])
root=subset('root-product-bootstrap.py',['need','require_successor_scope','require_old_non_pg_retirement','preserve_original_postgres'])
checks=[]
def pass_scope(ns,op,role,args):ns['require_successor_scope'](op,role,args);checks.append(op+':'+str(role)+':allowed')
def refuses(name,fn):
 try:fn()
 except (RuntimeError,KeyError,TypeError):checks.append(name);return
 raise AssertionError(name+' unexpectedly accepted')
for ns in [root,native]:
 for op in ['serve','stop','status']:
  for role in ['app','tunnel']:pass_scope(ns,op,role,[])
  refuses(op+'-postgres-forbidden',lambda ns=ns,op=op:ns['require_successor_scope'](op,'postgres',[]))
 for op in ['migrate','inspect-legacy','reset']:refuses('consumed-'+op,lambda ns=ns,op=op:ns['require_successor_scope']('domain',op,[]))
 refuses('ready-postgres-forbidden',lambda ns=ns:ns['require_successor_scope']('domain','ready',['postgres']))
pass_scope(native,'preserve-postgres','postgres',[])
refuses('root-preservation-not-public-lifecycle-CLI',lambda:root['require_successor_scope']('preserve-postgres','postgres',[]))
legacy='/opt/data/academy-release-staging-20261015-71c5a0e737e0';oldroot='/opt/academy-product-supervisor/71c5a0e737e0';newroot='/fixture/new-owner-version'
task='fixture-task';generation='a'*24
manager={'pid':101,'startTicks':'11','namespace':'pid:[fixture]','bootId':'fixtureboot','executable':'/fixture/python','cwd':legacy,'argv':['/fixture/python','-I','-S','-B',legacy+'/native-product-os.py','serve','postgres']}
child={**manager,'pid':102,'startTicks':'12'}
wanted={'executable':'/fixture/postgres','cwd':'/fixture/primary','argv':['/fixture/postgres','-D','/fixture/primary','-c','config_file='+legacy+'/primary-runtime.conf']}
current_child={**child,**wanted}
legacy_contract={'schema':'academy.private-retained-deployment-contract.v3','taskId':task,'nativeTaskRoot':legacy,'sourceAcquisition':False,'nativePython':'/fixture/python','container':{'pidNamespace':'pid:[fixture]','bootId':'fixtureboot'},'postgresBinary':'/fixture/postgres','primary':'/fixture/primary'}
wire=lambda value:(json.dumps(value,separators=(',',':'))+'\n').encode();digest=lambda body:hashlib.sha256(body).hexdigest()
legacy_raw=wire(legacy_contract)
authority={'schema':'academy.protected-product-birth-authority.v1','taskId':task,'role':'postgres','generation':generation,'deploymentContractSha256':digest(legacy_raw),'manager':manager,'gatedChild':child,'expectedExecutable':wanted['executable'],'expectedCwd':wanted['cwd'],'expectedArgv':wanted['argv'],'nativeReceiptPath':legacy+'/state/process-postgres-'+generation+'.json'}
gated={'schema':'academy.owned-product-process.v2','phase':'gated','taskId':task,'role':'postgres','generation':generation,'manager':manager,'gatedChild':child,'expectedExecutable':wanted['executable'],'expectedCwd':wanted['cwd'],'expectedArgv':wanted['argv']}
gated_raw=wire(gated);receipt_raw=wire({**gated,'phase':'running','identity':current_child})
authority['nativeReceiptSha256']=digest(gated_raw)
p={'nativeTaskRoot':legacy,'protectedHostRoot':oldroot,'deploymentContractSha256':digest(legacy_raw),'nativeReceiptPath':authority['nativeReceiptPath'],'nativeGatedReceiptSha256':digest(gated_raw),'nativeRunningReceiptSha256':digest(receipt_raw),'migrationReceiptSha256':'f'*64,'rootAuthoritySha256':'e'*64,'postgresEndpoint':{'fixture':'stable exact binding'}}
c={'taskId':task,'nativeTaskRoot':newroot,'preservedPostgres':p}
native_admission={'schema':'academy.root-product-activation-admission.v2','taskId':task,'deploymentContractSha256':p['deploymentContractSha256'],'sourceAcquisition':False,'operations':['status:postgres','stop:postgres','status:app','stop:app','status:tunnel','stop:tunnel']}
native_admission_raw=wire(native_admission);p['oldNativeActivationSha256']=digest(native_admission_raw);p['oldRootActivationSha256']='d'*64
files={legacy+'/activation-admission.json':native_admission_raw,legacy+'/deployment-contract.json':legacy_raw,authority['nativeReceiptPath']:receipt_raw};live={101:manager,102:current_child};reads=[]
native.update(read_regular=lambda path,*args:reads.append(path) or files[path],identity=lambda pid:copy.deepcopy(live[pid]),parent_pid=lambda pid:101,observe_original_pg_endpoint=lambda contract,child,expected:copy.deepcopy(expected))
result=native['preserve_original_postgres'](c,copy.deepcopy(authority));assert result['preserved'] and result['readOnly'] and result['PGAction'] is False;checks.append('native-original-PG-live-readonly-preserved')
assert reads and all(path in files for path in reads);checks.append('native-only-original-contract-and-receipt-reads')
missing=copy.deepcopy(c);missing['preservedPostgres']['rootAuthoritySha256']=None;before=len(reads);refuses('unknown-P1-refuses-before-read',lambda:native['preserve_original_postgres'](missing,authority));assert len(reads)==before
bad=copy.deepcopy(c);bad['preservedPostgres']['deploymentContractSha256']='0'*64;refuses('global-repin-does-not-rebind-original-PG',lambda:native['preserve_original_postgres'](bad,authority))
bad=copy.deepcopy(c);bad['preservedPostgres']['nativeRunningReceiptSha256']='0'*64;refuses('native-receipt-rebind-refused',lambda:native['preserve_original_postgres'](bad,authority))
live[101]={**manager,'startTicks':'changed'};refuses('native-manager-birth-drift',lambda:native['preserve_original_postgres'](c,authority));live[101]=manager
live[102]={**current_child,'startTicks':'changed'};refuses('native-PG-birth-drift',lambda:native['preserve_original_postgres'](c,authority));live[102]=current_child
live[102]={**current_child,'executable':'/fixture/foreign'};refuses('native-PG-role-drift',lambda:native['preserve_original_postgres'](c,authority));live[102]=current_child
native['parent_pid']=lambda pid:999;refuses('native-PG-parent-drift',lambda:native['preserve_original_postgres'](c,authority));native['parent_pid']=lambda pid:101
host_manager={'pid':201,'startTicks':'21','namespace':'pid:[hostfixture]','bootId':'fixtureboot','executable':'/fixture/python','cwd':oldroot,'argv':['fixture-original-PG-root-owner']}
old_host_raw=wire({'taskId':task,'deploymentContractSha256':p['deploymentContractSha256'],'nativeTaskRoot':legacy});p['hostContractSha256']=digest(old_host_raw)
# Explicit assignment avoids any actual Root authority content.
authority['hostContractSha256']=p['hostContractSha256'];authority['hostManager']=host_manager
authority_raw=wire(authority);p['rootAuthoritySha256']=digest(authority_raw)
root_admission={**native_admission,'hostContractSha256':p['hostContractSha256']};root_admission_raw=wire(root_admission);p['oldRootActivationSha256']=digest(root_admission_raw)
rootfiles={oldroot+'/activation-admission.json':root_admission_raw,oldroot+'/host-contract.json':old_host_raw,oldroot+'/state/authority-postgres.json':authority_raw};rootreads=[];transports=[]
root.update(host_read_regular=lambda path,*args:rootreads.append(path) or rootfiles[path],identity=lambda pid:copy.deepcopy(host_manager),native_arguments=lambda *args:transports.append(args[2:]) or ['fixture-readonly-preserve-postgres'],finite=lambda *args:(0,wire(result),b''))
value,forwarded=root['preserve_original_postgres'](c,newroot,[],{'operations':['preserve-postgres']});assert value['preserved'] and forwarded==authority_raw;checks.append('Root-forwards-exact-verified-original-authority-bytes')
assert transports[0]==('preserve-postgres','postgres');checks.append('Root-only-readonly-native-preservation-route')
before=len(rootreads);refuses('Root-no-read-scope-refused-before-read',lambda:root['preserve_original_postgres'](c,newroot,[],{'operations':[]}));assert len(rootreads)==before
bad=copy.deepcopy(c);bad['preservedPostgres']['rootAuthoritySha256']=None;refuses('Root-missing-P1-binding',lambda:root['preserve_original_postgres'](bad,newroot,[],{'operations':['preserve-postgres']}))
bad=copy.deepcopy(c);bad['preservedPostgres']['hostContractSha256']='0'*64;refuses('Root-original-contract-repin-refused',lambda:root['preserve_original_postgres'](bad,newroot,[],{'operations':['preserve-postgres']}))
bad=copy.deepcopy(c);bad['preservedPostgres']['rootAuthoritySha256']='0'*64;refuses('Root-authority-rebind-refused',lambda:root['preserve_original_postgres'](bad,newroot,[],{'operations':['preserve-postgres']}))
root['identity']=lambda pid:{**host_manager,'startTicks':'changed'};refuses('Root-supervisor-drift-refused',lambda:root['preserve_original_postgres'](c,newroot,[],{'operations':['preserve-postgres']}));root['identity']=lambda pid:copy.deepcopy(host_manager)
for ns,is_root,ad in [(root,True,root_admission),(native,False,native_admission)]:
 for operation in ['serve:app','serve:tunnel','serve:postgres','ready:app','ready:tunnel','ready:postgres','select-release','migrate','inspect-legacy']:
  bad={**ad,'operations':ad['operations']+[operation]};refuses('old-'+operation+'-eligibility-refused',lambda bad=bad,ns=ns,is_root=is_root:ns['require_old_non_pg_retirement'](wire(bad),c,p,is_root))
 for operations in ['status:postgres', ['status:postgres','status:postgres'], ['status:postgres',1]]:
  bad={**ad,'operations':operations};refuses('retirement-invalid-operation-shape',lambda bad=bad,ns=ns,is_root=is_root:ns['require_old_non_pg_retirement'](wire(bad),c,p,is_root))
 missing=copy.deepcopy(c);missing['preservedPostgres']['oldNativeActivationSha256']=None;refuses('missing-retirement-pins-refused',lambda ns=ns,is_root=is_root,missing=missing:ns['preserve_original_postgres'](missing,newroot,[],{'operations':['preserve-postgres']}) if is_root else ns['preserve_original_postgres'](missing,authority))
for key,value in [('phase','gated'),('generation','b'*24),('expectedExecutable','/fixture/foreign'),('identity',{**current_child,'startTicks':'changed'})]:
 bad_receipt={**json.loads(receipt_raw),key:value};bad_raw=wire(bad_receipt);bad=copy.deepcopy(c);bad['preservedPostgres']['nativeRunningReceiptSha256']=digest(bad_raw);files[authority['nativeReceiptPath']]=bad_raw;refuses('running-receipt-'+key+'-drift',lambda bad=bad:native['preserve_original_postgres'](bad,authority));files[authority['nativeReceiptPath']]=receipt_raw
bad=copy.deepcopy(c);bad['preservedPostgres']['nativeRunningReceiptSha256']=p['nativeGatedReceiptSha256'];refuses('gated-pin-cannot-replace-running-pin',lambda:native['preserve_original_postgres'](bad,authority))
bad=copy.deepcopy(c);bad['preservedPostgres']['nativeGatedReceiptSha256']=p['nativeRunningReceiptSha256'];refuses('running-pin-cannot-replace-gated-pin',lambda:native['preserve_original_postgres'](bad,authority))
endpoint_calls=[]
def endpoint_intercept(contract,observed,pin):
 endpoint_calls.append(pin)
 if not isinstance(pin,dict):raise RuntimeError('original_pg_endpoint_pin_required')
 return copy.deepcopy(pin)
native['observe_original_pg_endpoint']=endpoint_intercept
native['preserve_original_postgres'](c,authority);assert len(endpoint_calls)==2;checks.append('preservation-observes-owned-endpoint-before-and-after')
bad=copy.deepcopy(c);bad['preservedPostgres']['postgresEndpoint']=None;refuses('preservation-missing-endpoint-pin-refused',lambda:native['preserve_original_postgres'](bad,authority))
endpoint_calls.clear()
def rebound_endpoint(contract,observed,pin):
 endpoint_calls.append(pin);return copy.deepcopy(pin) if len(endpoint_calls)==1 else {'fixture':'rebound'}
native['observe_original_pg_endpoint']=rebound_endpoint;refuses('preservation-between-observations-endpoint-drift',lambda:native['preserve_original_postgres'](c,authority))
native['observe_original_pg_endpoint']=lambda *args:(_ for _ in ()).throw(PermissionError('unobservable'))
try:native['preserve_original_postgres'](c,authority)
except PermissionError:checks.append('preservation-unobservable-endpoint-held')
else:raise AssertionError('unobservable endpoint accepted')
for filename in ['root-product-bootstrap.py','native-product-os.py']:
 tree=ast.parse((base/filename).read_text());guard=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='preserve_original_postgres')
 calls={n.func.attr if isinstance(n.func,ast.Attribute) else n.func.id if isinstance(n.func,ast.Name) else '?' for n in ast.walk(guard) if isinstance(n,ast.Call)}
 assert not calls.intersection({'pidfd_send_signal','kill','killpg','Popen','checked_launch','run_domain','stop_exact','atomic_receipt','write','open'})
 checks.append(filename+'-preservation-no-lifecycle-or-write-calls')
print(json.dumps({'status':'pass','count':len(checks),'checks':checks,'fixtureScope':'fictional in-memory source contracts/receipts/births and intercepted read-only transport only','actualRootOrNativeAuthorityReads':0,'SSH':0,'DB':0,'PGActions':0,'actualNativeCalls':0,'sourceFunctionsOnlyExecuted':True}))
