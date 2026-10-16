HOSTROOT='/opt/academy-product-supervisor/71c5a0e737e0'
LEGACY='/opt/data/academy-release-staging-20261015-71c5a0e737e0'
READ_SCOPE={HOSTROOT+'/host-contract.json':(0,70000),HOSTROOT+'/state/authority-postgres.json':(0,20000),HOSTROOT+'/activation-admission.json':(0,20000),HOSTROOT+'/migration-admission.json':(0,20000),HOSTROOT+'/docker-empty/config.json':(0,100)}

def container_observation(c,docker):
 fmt='{{json .Id}}\n{{json .Image}}\n{{json .State.Pid}}\n{{json .State.Running}}\n{{range .Mounts}}{{if eq .Destination "/opt/data"}}{{json .Type}}\n{{json .Source}}\n{{json .Destination}}\n{{json .RW}}{{end}}{{end}}'
 lines=bounded_transport(docker+['inspect','--format',fmt,c['container']['id']],b'',8,4096).decode('ascii').splitlines();need(len(lines)==8,'fixed_container_inspection_required');value=[parse(line) for line in lines];wanted=c['container'];pid=wanted['initPid']
 need(value[:4]==[wanted['id'],wanted['imageId'],pid,True] and value[4:]==['bind',c['hostDataRoot'],'/opt/data',True],'container_identity_or_mount_changed')
 raw=open('/proc/'+str(pid)+'/stat').read(4097);need(len(raw)<=4096 and raw.rsplit(') ',1)[1].split()[19]==wanted['initStartTicks'] and os.readlink('/proc/'+str(pid)+'/ns/pid')==wanted['pidNamespace'] and open('/proc/sys/kernel/random/boot_id').read(100).strip()==wanted['bootId'],'container_birth_changed')
 return {'id':wanted['id'],'imageId':wanted['imageId'],'initPid':pid,'initStartTicks':wanted['initStartTicks'],'pidNamespace':wanted['pidNamespace'],'bootId':wanted['bootId']}

def observe_root(profile,native_program):
 need(os.getuid()==0 and os.getgid()==0,'original_root_read_role_required')
 strict(profile,['hostContractSha256','deploymentContractSha256','nativeProgramSha256']);need(profile['hostContractSha256']=='cc15984302e48265bc852d8274d8cb0002c632249a45e6ce9c06ba05a396ed90' and profile['deploymentContractSha256']=='04c1fef0049b64f9fdcc62a0c9c6b4aac06fef63e92d2d1052e6fc68c8a8016c','original_contract_lineage_required')
 need(hashlib.sha256(native_program.encode()).hexdigest()==profile['nativeProgramSha256'],'native_source_image_changed')
 contract_raw=read_regular(HOSTROOT+'/host-contract.json',0,70000);host_sha=hashlib.sha256(contract_raw).hexdigest();need(host_sha==profile['hostContractSha256'],'original_host_contract_changed');c=parse(contract_raw)
 need(c['schema']=='academy.protected-host-supervisor-contract.v2' and c['taskId']=='71c5a0e737e0' and c['protectedHostRoot']==HOSTROOT and c['nativeTaskRoot']==LEGACY and c['nativePython']=='/usr/bin/python3.13' and c['pythonExecutable']=='/usr/bin/python3.12' and c['deploymentContractSha256']==profile['deploymentContractSha256'],'fixed_original_control_scope_required')
 need(read_regular(HOSTROOT+'/docker-empty/config.json',0,100)==b'{}\n','fixed_empty_docker_transport_config_required')
 docker=['/usr/bin/docker','--host','unix:///var/run/docker.sock','--config',HOSTROOT+'/docker-empty'];before_container=container_observation(c,docker)
 authority_raw=read_regular(HOSTROOT+'/state/authority-postgres.json',0,20000);authority=parse(authority_raw)
 strict(authority,['schema','taskId','role','generation','deploymentContractSha256','manager','gatedChild','expectedExecutable','expectedCwd','expectedArgv','nativeReceiptPath','nativeReceiptSha256','hostContractSha256','hostManager','event','priorPositiveAbsence','hostTransportIdentity'])
 need(authority['event']=='native_role_gated' and authority['schema']=='academy.protected-product-birth-authority.v1' and authority['taskId']==c['taskId'] and authority['role']=='postgres' and authority['hostContractSha256']==host_sha and authority['deploymentContractSha256']==profile['deploymentContractSha256'],'original_root_authority_scope_required')
 manager=authority['hostManager'];birth_shape(manager);birth_shape(authority['manager']);birth_shape(authority['gatedChild']);need(type(manager['pid'])==int and manager['pid']>1,'root_manager_pid_required');owner=os.stat('/proc/'+str(manager['pid']),follow_symlinks=False)
 need(owner.st_uid==0 and owner.st_gid==0 and os.readlink('/proc/self/ns/pid')==manager['namespace'] and identity(manager['pid'])==manager and manager['executable']=='/usr/bin/python3.12' and manager['cwd']==HOSTROOT and manager['argv']==['/usr/bin/python3.12','-I','-S','-B',HOSTROOT+'/root-product-bootstrap.py','--contract-sha',host_sha,'serve','postgres'],'original_root_manager_birth_changed')
 historical=authority['priorPositiveAbsence'];strict(historical,['role','absent','scopedRoleProcesses','otherOwnedManagers','ownedEndpointAbsent','tlsProof','processScope']);need(all(type(historical[k])==bool for k in ['absent','ownedEndpointAbsent','tlsProof']) and all(type(historical[k])==int for k in ['scopedRoleProcesses','otherOwnedManagers']) and historical=={'role':'postgres','absent':True,'scopedRoleProcesses':0,'otherOwnedManagers':0,'ownedEndpointAbsent':True,'tlsProof':False,'processScope':'UID10000 product role processes; all-owner kernel endpoint conflicts separately refused'},'original_historical_absence_shape_required')
 clean=[]
 for name in ['LD_PRELOAD','LD_LIBRARY_PATH','LD_AUDIT','PYTHONPATH','PYTHONHOME','BASH_ENV','ENV']:clean+=['--env',name+'=']
 prefix=docker+['exec','--interactive','--user','10000:10000','--workdir',LEGACY]+clean+[c['container']['id'],'/usr/bin/env','-i','HOME=/opt/data','PATH=/usr/bin:/bin','LANG=C.UTF-8','LC_ALL=C.UTF-8','/usr/bin/python3.13','-I','-S','-B']
 transport=authority['hostTransportIdentity'];birth_shape(transport);transport_owner=os.stat('/proc/'+str(transport['pid']),follow_symlinks=False);need(transport_owner.st_uid==0 and transport_owner.st_gid==0 and identity(transport['pid'])==transport and parent_pid(transport['pid'])==manager['pid'] and transport['executable']=='/usr/bin/docker' and transport['cwd']=='/' and transport['namespace']==manager['namespace'] and transport['bootId']==manager['bootId'] and transport['argv']==prefix+[LEGACY+'/native-product-os.py','serve','postgres'],'original_root_transport_birth_changed')
 activation=admission_metadata(read_regular(HOSTROOT+'/activation-admission.json',0,20000),c['taskId'],profile['deploymentContractSha256'],host_sha)
 migration=admission_metadata(read_regular(HOSTROOT+'/migration-admission.json',0,20000),c['taskId'],profile['deploymentContractSha256'],host_sha,migration=True)
 projected_authority={k:v for k,v in authority.items() if k not in ['priorPositiveAbsence','hostTransportIdentity']}
 request={'authority':projected_authority,'authoritySha256':hashlib.sha256(authority_raw).hexdigest(),'deploymentContractSha256':profile['deploymentContractSha256'],'container':c['container']}
 argv=prefix+['-c',native_program]
 result=parse(bounded_transport(argv,(json.dumps(request,separators=(',',':'))+'\n').encode()))
 need(result['schema']=='academy.running-pg-native-observation.v1' and result['taskId']==c['taskId'] and result['running'] is True and result['authoritySha256']==request['authoritySha256'] and result['deploymentContractSha256']==profile['deploymentContractSha256'] and result['nativeGatedReceiptSha256']==authority['nativeReceiptSha256'] and result['beforeAfterStable'] is True and result['PGActions'] is False,'native_running_observation_scope_required')
 need(container_observation(c,docker)==before_container and identity(manager['pid'])==manager and identity(transport['pid'])==transport and parent_pid(transport['pid'])==manager['pid'],'original_root_or_container_final_drift');owner_after=os.stat('/proc/'+str(manager['pid']),follow_symlinks=False);need((owner.st_uid,owner.st_gid)==(owner_after.st_uid,owner_after.st_gid),'root_process_owner_drift');finish()
 return {'schema':'academy.running-pg-p1-observation.v1','hostContractSha256':host_sha,'container':before_container,'rootManager':manager,'rootActivation':activation,'rootMigrationPermission':migration,'native':result,'beforeAfterStable':True,'readOnly':True,'retirementPerformed':False,'PGActions':False,'P1Accepted':False}

if __name__=='__main__':
 try:
  raw=sys.stdin.buffer.read(200001);need(len(raw)<=200000,'root_request_cap');request=parse(raw);strict(request,['profile','nativeProgram']);result=observe_root(request['profile'],request['nativeProgram']);print(json.dumps(result,separators=(',',':')))
 except BaseException:print('{"status":"HOLD","code":"finite_running_pg_observation_refused"}');sys.exit(1)
 finally:close_all()
