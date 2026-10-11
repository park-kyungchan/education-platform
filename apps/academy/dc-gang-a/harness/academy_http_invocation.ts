import {privateJsonPath,reservePrivateJson,openOwnedPrivateJson} from './academy_private_io';

/** Boundary shared by the manual CLI and app's caller-reserved exchange. No authentication occurs here. */
export function parseHttpInvocation(home:string,args:readonly string[]){
 if(![4,8].includes(args.length)||args[0]!=='--request'||args[2]!=='--output'
  ||args.length===8&&(args[4]!=='--owned-input-inode'||args[6]!=='--owned-output-inode'||!/^\d+:\d+$/.test(args[5]!)||!/^\d+:\d+$/.test(args[7]!)))throw Error('invalid_http_arguments');
 const input=privateJsonPath(home,args[1]!),output=privateJsonPath(home,args[3]!);
 if(input===output)throw Error('distinct_http_exchange_paths_required');
 const inputIdentity=args.length===8?args[5]:undefined,outputIdentity=args.length===8?args[7]:undefined;
 return {input,output,inputIdentity,openResult:()=>outputIdentity===undefined?reservePrivateJson(home,output):openOwnedPrivateJson(home,output,outputIdentity,131072)};
}
