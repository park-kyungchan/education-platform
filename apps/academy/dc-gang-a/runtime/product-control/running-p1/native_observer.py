# Canonical exact PG function projection and readonly_io are prepended by the Bun owner.
LEGACY='/opt/data/academy-release-staging-20261015-71c5a0e737e0'
READ_SCOPE={LEGACY+'/deployment-contract.json':(10000,200000),LEGACY+'/activation-admission.json':(10000,20000),LEGACY+'/migration-admission.json':(10000,20000)}

def observe_native(request):
 need(os.getuid()==10000 and os.getgid()==10000,'native_uid10000_required')
 strict(request,['authority','authoritySha256','deploymentContractSha256','container'])
 authority=request['authority'];strict(authority,['schema','taskId','role','generation','deploymentContractSha256','manager','gatedChild','expectedExecutable','expectedCwd','expectedArgv','nativeReceiptPath','nativeReceiptSha256','hostContractSha256','hostManager','event'])
 need(authority['event']=='native_role_gated','original_gated_authority_event_required')
 raw=read_regular(LEGACY+'/deployment-contract.json',10000,200000);digest=hashlib.sha256(raw).hexdigest();need(digest==request['deploymentContractSha256']==authority['deploymentContractSha256'],'original_deployment_pin_changed');c=parse(raw)
 need(c['schema']=='academy.private-retained-deployment-contract.v3' and c['nativeTaskRoot']==LEGACY and c['sourceAcquisition'] is False and c['nativePython']=='/usr/bin/python3.13','original_native_scope_required')
 need(c['container']==request['container'] and os.readlink('/proc/self/ns/pid')==c['container']['pidNamespace'] and open('/proc/sys/kernel/random/boot_id').read(100).strip()==c['container']['bootId'],'native_container_incarnation_changed')
 child,manager,wanted=expected_role(c,LEGACY,'postgres',authority);birth_shape(manager);birth_shape(child);birth_shape(authority['hostManager']);need(child['pid']!=manager['pid'] and all(child[k]==manager[k] for k in ['executable','cwd','argv','namespace','bootId']),'original_forked_birth_shape_changed')
 generation=authority['generation'];need(isinstance(generation,str) and re.fullmatch('[a-f0-9]{24}',generation),'original_generation_required');path=LEGACY+'/state/process-postgres-'+generation+'.json';need(authority['nativeReceiptPath']==path,'fixed_original_receipt_path_required');READ_SCOPE[path]=(10000,100000)
 receipt_raw=read_regular(path,10000,100000);receipt=parse(receipt_raw);birth_shape(receipt['identity'])
 strict(receipt,['schema','phase','manager','gatedChild','expectedExecutable','expectedArgv','expectedCwd','taskId','role','generation','logPath','identity'])
 need(receipt['schema']=='academy.owned-product-process.v2' and receipt['phase']=='running' and receipt['taskId']==c['taskId'] and receipt['role']=='postgres' and receipt['generation']==generation and receipt['logPath']==LEGACY+'/state/postgres-'+generation+'.log','current_running_receipt_scope_required')
 gated={**receipt,'phase':'gated'};gated.pop('identity');gated_sha=hashlib.sha256((json.dumps(gated,separators=(',',':'))+'\n').encode()).hexdigest();need(gated_sha==authority['nativeReceiptSha256'],'original_gated_receipt_reconciliation_failed')
 need(receipt['manager']==manager and receipt['gatedChild']==child and all(receipt['expected'+suffix]==wanted[key] for suffix,key in [('Executable','executable'),('Argv','argv'),('Cwd','cwd')]),'running_receipt_launch_or_birth_changed')
 before_manager=identity(manager['pid']);before_pg=identity(child['pid'])
 for pid in [manager['pid'],child['pid']]:
  owner=os.stat('/proc/'+str(pid),follow_symlinks=False);need(owner.st_uid==10000 and owner.st_gid==10000,'native_process_owner_changed')
 need(before_manager==manager and before_pg==receipt['identity'] and all(before_pg[k]==child[k] for k in ['pid','startTicks','namespace','bootId']) and all(before_pg[k]==wanted[k] for k in wanted) and parent_pid(child['pid'])==manager['pid'],'running_pg_birth_or_role_changed')
 endpoint=capture_original_pg_endpoint(c,before_pg)
 # Reuse the unmodified canonical pinned comparator for the second independent observation.
 need(observe_original_pg_endpoint(c,before_pg,endpoint)==endpoint,'running_pg_endpoint_drift')
 activation=admission_metadata(read_regular(LEGACY+'/activation-admission.json',10000,20000),c['taskId'],digest)
 migration=admission_metadata(read_regular(LEGACY+'/migration-admission.json',10000,20000),c['taskId'],digest,migration=True)
 need(observe_original_pg_endpoint(c,before_pg,endpoint)==endpoint,'running_pg_final_endpoint_drift')
 need(identity(manager['pid'])==before_manager and identity(child['pid'])==before_pg and parent_pid(child['pid'])==manager['pid'],'running_pg_final_birth_drift')
 for pid in [manager['pid'],child['pid']]:
  owner=os.stat('/proc/'+str(pid),follow_symlinks=False);need(owner.st_uid==10000 and owner.st_gid==10000,'native_process_final_owner_changed')
 finish()
 exported_endpoint={**endpoint,'filesystem':{**endpoint['filesystem'],**{k:str(endpoint['filesystem'][k]) for k in ['device','inode','ctimeNs']}}}
 return {'schema':'academy.running-pg-native-observation.v1','taskId':c['taskId'],'running':True,'authoritySha256':request['authoritySha256'],'deploymentContractSha256':digest,'nativeGatedReceiptSha256':gated_sha,'nativeRunningReceiptSha256':hashlib.sha256(receipt_raw).hexdigest(),'nativeReceiptPath':path,'generation':generation,'manager':before_manager,'postgres':before_pg,'postgresEndpoint':exported_endpoint,'nativeActivation':activation,'migrationPermission':migration,'beforeAfterStable':True,'PGActions':False}

if __name__=='__main__':
 try:
  raw=sys.stdin.buffer.read(20001);need(len(raw)<=20000,'native_request_cap');result=observe_native(parse(raw));print(json.dumps(result,separators=(',',':')))
 except BaseException:print('{"status":"HOLD","code":"finite_running_pg_observation_refused"}');sys.exit(1)
 finally:close_all()
