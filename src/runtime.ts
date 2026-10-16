import {appendFileSync} from 'node:fs';

export const bunToolchain = {
  packageName: '@oven/bun-linux-x64',
  version: '1.4.3',
  directory: 'bun-1.4.3',
} as const;

export function assertBunRuntime(version = Bun.version): void {
  if (version !== bunToolchain.version) throw Error('bun_runtime_mismatch:expected_' + bunToolchain.version);
}
/** The existing Actions workflow may bootstrap setup; module checks still require Bun 1.4.3. */
export function setupRuntime(options = {version:Bun.version,actions:process.env.GITHUB_ACTIONS,path:process.env.GITHUB_PATH}) {
  const actionsPath = options.actions === 'true' && options.path ? options.path : undefined;
  if(actionsPath&&/[\r\n\0]/.test(actionsPath))throw Error('invalid_actions_path');
  if (!(options.version === '1.4.2' && actionsPath)) assertBunRuntime(options.version);
  return {bootstrapVersion:options.version,actionsPath};
}

/** GitHub applies GITHUB_PATH to later steps; append without replacing other entries. */
export function publishActionsBunPath(binaryDirectory:string,actionsPath:string|undefined):void {
  if(actionsPath){
    if(/[\r\n\0]/.test(binaryDirectory)||/[\r\n\0]/.test(actionsPath))throw Error('invalid_actions_path');
    appendFileSync(actionsPath,binaryDirectory+'\n');
  }
}
