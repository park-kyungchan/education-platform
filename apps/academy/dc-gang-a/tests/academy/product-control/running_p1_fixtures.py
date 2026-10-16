# Fictional ports only. No native module import, proc/filesystem/network/authority access.
import ast,json,hashlib,copy,re,stat,io
from pathlib import Path
from types import SimpleNamespace
owner=Path(__file__).resolve().parents[3];base=owner/'runtime/product-control';canonical=(base/'native-product-os.py').read_text()
def source_functions(text,names,ns=None):
 tree=ast.parse(text);nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names];assert len(nodes)==len(names)
 ns=ns if ns is not None else {'json':json,'hashlib':hashlib,'re':re,'stat':stat};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<fictional-source-functions>','exec'),ns);return ns
ns=source_functions(canonical,['need','expected_role'])
source_functions((base/'running-p1/readonly_io.py').read_text(),['strict','no_duplicates','parse','birth_shape','admission_metadata'],ns)
source_functions((base/'running-p1/native_observer.py').read_text(),['observe_native'],ns)
legacy='/opt/data/academy-release-staging-20261015-71c5a0e737e0';task='fixture-task';generation='a'*24;wire=lambda v:(json.dumps(v,separators=(',',':'))+'\n').encode();digest=lambda raw:hashlib.sha256(raw).hexdigest();checks=[]
container={'pidNamespace':'pid:[12]','bootId':'00000000-0000-0000-0000-000000000000'}
contract={'schema':'academy.private-retained-deployment-contract.v3','taskId':task,'nativeTaskRoot':legacy,'sourceAcquisition':False,'nativePython':'/usr/bin/python3.13','container':container,'postgresBinary':'/fixture/postgres','primary':'/fixture/primary'};raw=wire(contract)
manager={'pid':101,'startTicks':'1','namespace':'pid:[12]','bootId':'00000000-0000-0000-0000-000000000000','executable':'/usr/bin/python3.13','cwd':legacy,'argv':['/usr/bin/python3.13','-I','-S','-B',legacy+'/native-product-os.py','serve','postgres']};child={**manager,'pid':102,'startTicks':'2'};pg={**child,'executable':'/fixture/postgres','cwd':'/fixture/primary','argv':['/fixture/postgres','-D','/fixture/primary','-c','config_file='+legacy+'/primary-runtime.conf']}
gated={'schema':'academy.owned-product-process.v2','phase':'gated','manager':manager,'gatedChild':child,'expectedExecutable':pg['executable'],'expectedArgv':pg['argv'],'expectedCwd':pg['cwd'],'taskId':task,'role':'postgres','generation':generation,'logPath':legacy+'/state/postgres-'+generation+'.log'};running={**gated,'phase':'running','identity':pg};receipt_raw=wire(running);path=legacy+'/state/process-postgres-'+generation+'.json'
authority={'event':'native_role_gated','schema':'academy.protected-product-birth-authority.v1','taskId':task,'role':'postgres','generation':generation,'deploymentContractSha256':digest(raw),'manager':manager,'gatedChild':child,'expectedExecutable':pg['executable'],'expectedArgv':pg['argv'],'expectedCwd':pg['cwd'],'nativeReceiptPath':path,'nativeReceiptSha256':digest(wire(gated)),'hostContractSha256':'b'*64,'hostManager':{**manager,'pid':201}}
activation={'schema':'academy.root-product-activation-admission.v2','taskId':task,'deploymentContractSha256':digest(raw),'sourceAcquisition':False,'operations':['serve:postgres','migrate','select-release','serve:app']};migration={'schema':'academy.root-six-table-migration-admission.v1','taskId':task,'deploymentContractSha256':digest(raw),'expectedLegacySchemaSha256':'f'*64,'tablesToAdd':6}
files={legacy+'/deployment-contract.json':raw,path:receipt_raw,legacy+'/activation-admission.json':wire(activation),legacy+'/migration-admission.json':wire(migration)};live={101:manager,102:pg};reads=[];endpoints=[];finishes=[]
endpoint={'path':'/fixture/socket','filesystem':{'device':1,'inode':888,'uid':10000,'gid':10000,'mode':0o700,'ctimeNs':1780000000000000001},'kernelInode':'777','ownerPid':102,'ownerStartTicks':'2','ownerBootId':'00000000-0000-0000-0000-000000000000','ownerNamespace':'pid:[12]','listenerFds':['6']}
class FakeOS:
 getuid=lambda self:10000
 getgid=lambda self:10000
 readlink=lambda self,path:'pid:[12]'
 stat=lambda self,path,**kw:SimpleNamespace(st_uid=10000,st_gid=10000)
ns.update(os=FakeOS(),open=lambda *args:io.StringIO('00000000-0000-0000-0000-000000000000'),read_regular=lambda path,*args:reads.append(path) or files[path],identity=lambda pid:copy.deepcopy(live[pid]),parent_pid=lambda pid:101,capture_original_pg_endpoint=lambda *args:copy.deepcopy(endpoint),observe_original_pg_endpoint=lambda c,p,e:endpoints.append(e) or copy.deepcopy(e),finish=lambda:finishes.append(True),READ_SCOPE=dict((p,(10000,100000)) for p in files),LEGACY=legacy)
request={'authority':authority,'authoritySha256':'c'*64,'deploymentContractSha256':digest(raw),'container':container}
def observe(req=request):return ns['observe_native'](copy.deepcopy(req))
def refuses(label,run):
 try:run()
 except (RuntimeError,KeyError,PermissionError):checks.append(label);return
 raise AssertionError(label)
result=observe();assert result['running'] is True and result['nativeGatedReceiptSha256']!=result['nativeRunningReceiptSha256'];checks.append('valid-pre-retirement-running-observation-with-distinct-gated-running-pins')
assert result['nativeActivation']['operations']==sorted(activation['operations']) and result['nativeActivation']['retired'] is False;checks.append('old-unretired-Bun-and-consumed-migration-permissions-observed-without-retirement')
assert result['postgresEndpoint']['filesystem']['ctimeNs']=='1780000000000000001' and result['postgresEndpoint']['filesystem']['inode']=='888' and result['postgresEndpoint']['kernelInode']=='777';checks.append('precise-decimal-metadata-and-distinct-inode-spaces')
assert finishes and len(endpoints)==2;checks.append('before-after-and-final-descriptor-canonical-endpoint-comparator-used')
for key,value in [('phase','exited'),('generation','b'*24),('expectedArgv',['/foreign']),('identity',{**pg,'startTicks':'3'})]:
 files[path]=wire({**running,key:value});refuses('receipt-'+key+'-drift',observe);files[path]=receipt_raw
bad=copy.deepcopy(request);bad['authority']['nativeReceiptSha256']=digest(receipt_raw);refuses('running-hash-cannot-replace-historical-gated-authority',lambda:observe(bad))
live[102]={**pg,'startTicks':'changed'};refuses('PG-birth-drift',observe);live[102]=pg
live[101]={**manager,'startTicks':'changed'};refuses('manager-birth-drift',observe);live[101]=manager
ns['parent_pid']=lambda pid:999;refuses('foreign-PG-parent',observe);ns['parent_pid']=lambda pid:101
ns['observe_original_pg_endpoint']=lambda *args:(_ for _ in ()).throw(RuntimeError('rebound'));refuses('unobservable-or-rebound-endpoint',observe);ns['observe_original_pg_endpoint']=lambda c,p,e:e
files[legacy+'/activation-admission.json']=wire({**activation,'operations':['unknown:credential']});refuses('unknown-admission-operation-held',observe);files[legacy+'/activation-admission.json']=wire(activation)
original_read=ns['read_regular'];permission_state={'rebound':False}
def permission_rebind_reader(path,*args):
 value=original_read(path,*args)
 if path==legacy+'/migration-admission.json':permission_state['rebound']=True
 return value
ns['read_regular']=permission_rebind_reader
ns['observe_original_pg_endpoint']=lambda c,p,e:(_ for _ in ()).throw(RuntimeError('endpoint rebound during permission metadata read')) if permission_state['rebound'] else e
refuses('endpoint-rebind-during-permission-read-refused-at-final-boundary',observe)
ns['read_regular']=original_read;ns['observe_original_pg_endpoint']=lambda c,p,e:e
ns['finish']=lambda:(_ for _ in ()).throw(RuntimeError('drift'));refuses('named-file-parent-drift-held',observe)
# Source scopes exclude lifecycle primitives and business/native-module imports.
for file in ['native_observer.py','root_observer.py']:
 tree=ast.parse((base/'running-p1'/file).read_text());functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name.startswith('observe_')]
 calls={n.func.attr if isinstance(n.func,ast.Attribute) else n.func.id if isinstance(n.func,ast.Name) else '?' for fn in functions for n in ast.walk(fn) if isinstance(n,ast.Call)}
 assert not calls&{'kill','killpg','pidfd_send_signal','write','atomic_receipt','checked_launch','connect','SQL','run_domain'};checks.append(file+'-no-write-lifecycle-DB-or-business-dispatch')
print(json.dumps({'status':'pass','count':len(checks),'checks':checks,'actualNativeCalls':0,'actualRootAuthorityOrProcReads':0,'actualSSH':0,'actualDB':0,'fictionalOnly':True}))
# Root boundary is separately exercised with fictional accepted-hash ports, never real bodies.
rootns={'json':json,'re':re,'stat':stat};source_functions(canonical,['need'],rootns);source_functions((base/'running-p1/readonly_io.py').read_text(),['strict','no_duplicates','parse','birth_shape','admission_metadata'],rootns);source_functions((base/'running-p1/root_observer.py').read_text(),['observe_root'],rootns)
hostroot='/opt/academy-product-supervisor/71c5a0e737e0';hostsha='cc15984302e48265bc852d8274d8cb0002c632249a45e6ce9c06ba05a396ed90';depsha='04c1fef0049b64f9fdcc62a0c9c6b4aac06fef63e92d2d1052e6fc68c8a8016c';host_manager={'pid':201,'startTicks':'3','namespace':'pid:[13]','bootId':'00000000-0000-0000-0000-000000000000','executable':'/usr/bin/python3.12','cwd':hostroot,'argv':['/usr/bin/python3.12','-I','-S','-B',hostroot+'/root-product-bootstrap.py','--contract-sha',hostsha,'serve','postgres']}
host_contract={'schema':'academy.protected-host-supervisor-contract.v2','taskId':'71c5a0e737e0','protectedHostRoot':hostroot,'nativeTaskRoot':legacy,'nativePython':'/usr/bin/python3.13','pythonExecutable':'/usr/bin/python3.12','deploymentContractSha256':depsha,'container':{'id':'fixture-container'},'hostDataRoot':'/fixture/host-data'};host_raw=wire(host_contract)
historical_absence={'role':'postgres','absent':True,'scopedRoleProcesses':0,'otherOwnedManagers':0,'ownedEndpointAbsent':True,'tlsProof':False,'processScope':'UID10000 product role processes; all-owner kernel endpoint conflicts separately refused'}
transport_prefix=['/usr/bin/docker','--host','unix:///var/run/docker.sock','--config',hostroot+'/docker-empty','exec','--interactive','--user','10000:10000','--workdir',legacy]
for name in ['LD_PRELOAD','LD_LIBRARY_PATH','LD_AUDIT','PYTHONPATH','PYTHONHOME','BASH_ENV','ENV']:transport_prefix+=['--env',name+'=']
transport_prefix+=['fixture-container','/usr/bin/env','-i','HOME=/opt/data','PATH=/usr/bin:/bin','LANG=C.UTF-8','LC_ALL=C.UTF-8','/usr/bin/python3.13','-I','-S','-B']
host_transport={**host_manager,'pid':301,'executable':'/usr/bin/docker','cwd':'/','argv':transport_prefix+[legacy+'/native-product-os.py','serve','postgres']}
root_authority={**authority,'priorPositiveAbsence':historical_absence,'hostTransportIdentity':host_transport,'taskId':'71c5a0e737e0','hostManager':host_manager,'hostContractSha256':hostsha,'deploymentContractSha256':depsha};root_authority_raw=wire(root_authority)
root_activation={**activation,'taskId':'71c5a0e737e0','deploymentContractSha256':depsha,'hostContractSha256':hostsha};rootfiles={hostroot+'/host-contract.json':host_raw,hostroot+'/state/authority-postgres.json':root_authority_raw,hostroot+'/activation-admission.json':wire(root_activation),hostroot+'/migration-admission.json':wire({**migration,'taskId':'71c5a0e737e0','deploymentContractSha256':depsha,'hostContractSha256':hostsha}),hostroot+'/docker-empty/config.json':b'{}\n'}
class FixtureHashes:
 @staticmethod
 def sha256(value):return SimpleNamespace(hexdigest=lambda:hostsha) if value==host_raw else hashlib.sha256(value)
class RootOS(FakeOS):
 getuid=lambda self:0
 getgid=lambda self:0
 readlink=lambda self,path:'pid:[13]'
 stat=lambda self,path,**kw:SimpleNamespace(st_uid=0,st_gid=0)
root_result={**result,'taskId':'71c5a0e737e0','deploymentContractSha256':depsha,'authoritySha256':digest(root_authority_raw)};transports=[];rootreads=[];container_reads=[]
rootns.update(hashlib=FixtureHashes,HOSTROOT=hostroot,LEGACY=legacy,os=RootOS(),read_regular=lambda path,*args:rootreads.append(path) or rootfiles[path],identity=lambda pid:copy.deepcopy(host_manager if pid==201 else host_transport),parent_pid=lambda pid:201,finish=lambda:None,container_observation=lambda *args:container_reads.append(True) or {'fixture':'same-container'},bounded_transport=lambda argv,*args:transports.append(argv) or wire(root_result))
program='fictional-native-source';profile={'hostContractSha256':hostsha,'deploymentContractSha256':depsha,'nativeProgramSha256':digest(program.encode())}
rootchecks=[]
def root_observe():return rootns['observe_root'](profile,program)
root_value=root_observe();assert root_value['P1Accepted'] is False and root_value['retirementPerformed'] is False and len(container_reads)==2;rootchecks.append('valid-Root-before-after-observation-without-retirement-or-P1-acceptance')
assert len(transports)==1 and transports[0][-6:]==['/usr/bin/python3.13','-I','-S','-B','-c',program] and '--user' in transports[0] and '10000:10000' in transports[0];rootchecks.append('fixed-Docker-UID10000-isolated-Python-route-only')
rootfiles[hostroot+'/state/authority-postgres.json']=wire({**root_authority,'unknown':'must hold'})
try:root_observe()
except RuntimeError:rootchecks.append('unknown-Root-authority-fields-held')
else:raise AssertionError('unknown authority accepted')
rootfiles[hostroot+'/state/authority-postgres.json']=root_authority_raw
rootns['identity']=lambda pid:{**host_manager,'startTicks':'changed'}
try:root_observe()
except RuntimeError:rootchecks.append('Root-manager-birth-drift-held')
else:raise AssertionError('Root manager drift accepted')
rootns['identity']=lambda pid:host_manager if pid==201 else host_transport;rootns['finish']=lambda:(_ for _ in ()).throw(RuntimeError('named parent drift'))
try:root_observe()
except RuntimeError:rootchecks.append('Root-named-parent-or-file-drift-held')
else:raise AssertionError('Root file drift accepted')
print(json.dumps({'status':'pass','rootChecks':rootchecks,'rootCount':len(rootchecks),'nativeCount':len(checks),'actualNativeCalls':0,'actualRootAuthorityOrProcReads':0,'actualSSH':0,'actualDB':0,'fictionalOnly':True,'rootHashPort':'known nonsecret source-hash labels mapped to explicitly fictional body, never actual proof'}))
