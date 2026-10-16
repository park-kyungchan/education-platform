# Local disposable synthetic files only. The finite scope is test-owned; no target paths are read.
import ast,os,stat,json,hashlib,re,tempfile,shutil
from pathlib import Path
owner=Path(__file__).resolve().parents[3];text=(owner/'runtime/product-control/running-p1/readonly_io.py').read_text();names=['image','finish','close_all','read_regular'];tree=ast.parse(text);nodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names]
def need(value,code):
 if not value:raise RuntimeError(code)
ns={'os':os,'stat':stat,'need':need,'HANDLES':[],'READ_SCOPE':{}};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<local-synthetic-descriptor-functions>','exec'),ns)
private=owner/'.private';private.mkdir(mode=0o700,exist_ok=True);directory=Path(tempfile.mkdtemp(prefix='running-p1-io-',dir=private));uid=os.getuid();checks=[]
def refuses(name,fn):
 try:fn()
 except (RuntimeError,OSError):checks.append(name)
 else:raise AssertionError(name)
 finally:ns['close_all']()
try:
 path=directory/'fixed.json';path.write_bytes(b'{"fictional":true}\n');path.chmod(0o600);ns['READ_SCOPE'][str(path)]=(uid,100)
 assert ns['read_regular'](str(path),uid,100)==path.read_bytes();ns['finish']();ns['close_all']();checks.append('private-single-link-bounded-local-fixture-accepted')
 refuses('out-of-scope-path-refused',lambda:ns['read_regular'](str(directory/'other'),uid,100))
 path.unlink();path.symlink_to(directory/'absent');refuses('dangling-symlink-entry-refused',lambda:ns['read_regular'](str(path),uid,100));path.unlink()
 path.write_bytes(b'x'*101);path.chmod(0o600);refuses('fixed-read-cap-refused-before-content',lambda:ns['read_regular'](str(path),uid,100))
 path.write_bytes(b'fictional');link=directory/'extra-link';os.link(path,link);refuses('multiple-links-refused',lambda:ns['read_regular'](str(path),uid,100));link.unlink()
 ns['read_regular'](str(path),uid,100);path.write_bytes(b'changed');refuses('descriptor-or-named-file-drift-refused',ns['finish'])
 path.chmod(0o644);refuses('nonprivate-file-mode-refused',lambda:ns['read_regular'](str(path),uid,100))
 print(json.dumps({'status':'pass','count':len(checks),'checks':checks,'scope':'local disposable fictional files only','actualNativeOrSSHCalls':0,'actualAuthorityReads':0}))
finally:ns['close_all']();shutil.rmtree(directory)
