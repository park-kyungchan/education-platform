import {accessSync, constants, existsSync, readFileSync, openSync, readSync, closeSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {inventoryCanonical, writableProbe} from './validate-runtime.ts';

type RuntimeManifest = {runtime: {bun: string; typescript: string; bunTypes: string; lockSha256: string}};
const root = resolve(import.meta.dir, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'runtime.manifest.json'), 'utf8')) as RuntimeManifest;
const required = ['package.json', 'bun.lock', 'tsconfig.json', 'canonical/required-sources.json', 'provenance/export-coverage.json', 'source/contracts/canonical.schema.json', 'derived/ui/ui-source-manifest.json'];
const missing = required.filter(p => !existsSync(resolve(root, p)));
const errors: string[] = [];
if (missing.length) errors.push('Required project inputs are missing.');
if (Bun.version !== manifest.runtime.bun) errors.push('Bun runtime does not match the exact project pin.');
if (process.platform !== 'linux' || !['x64', 'arm64'].includes(process.arch)) errors.push('This runtime variant supports Linux x64/arm64.');
if (!missing.includes('bun.lock') && createHash('sha256').update(readFileSync(resolve(root, 'bun.lock'))).digest('hex') !== manifest.runtime.lockSha256) errors.push('bun.lock differs from the preserved project lock.');

const require = createRequire(import.meta.url);
const dependencies: Record<string, unknown> = {};
for (const [name, wanted] of [['typescript', manifest.runtime.typescript], ['bun-types', manifest.runtime.bunTypes]] as const) {
  try {
    const path = require.resolve(name + '/package.json');
    const value = JSON.parse(readFileSync(path, 'utf8')) as {version: string};
    const local = path.startsWith(resolve(root, 'node_modules') + '/');
    const matched = value.version === wanted && local;
    dependencies[name] = {version: value.version, wanted, projectLocal: local, path, matched};
    if (!matched) errors.push(name + ' must resolve to the pinned project-local package.');
  } catch (error) {
    dependencies[name] = {available: false, error: String(error)};
    errors.push(name + ' is unavailable.');
  }
}
let nativeCompiler: Record<string, unknown> = {executionVerified: false};
if (process.platform === 'linux' && ['x64', 'arm64'].includes(process.arch)) {
  try {
    const packageName = '@typescript/typescript-linux-' + process.arch;
    const packagePath = fileURLToPath(import.meta.resolve(packageName + '/package.json'));
    const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8')) as {version: string};
    const executable = join(dirname(packagePath), 'lib', 'tsc');
    accessSync(executable, constants.X_OK);
    const header = Buffer.alloc(64);
    const fd = openSync(executable, 'r');
    try { readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
    const elf = header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
    const machine = elf && header[5] === 1 ? header.readUInt16LE(18) : null;
    const architectureMatched = machine === (process.arch === 'x64' ? 62 : 183);
    const local = packagePath.startsWith(resolve(root, 'node_modules') + '/');
    if (packageInfo.version !== manifest.runtime.typescript || !architectureMatched || !local) throw new Error('Native compiler must match the pinned project-local version and current architecture before execution.');
    const result = Bun.spawnSync([executable, '--version']);
    const versionOutput = new TextDecoder().decode(result.stdout).trim();
    const executionVerified = result.exitCode === 0 && versionOutput === 'Version ' + manifest.runtime.typescript;
    nativeCompiler = {packageName, version: packageInfo.version, executable, elf, machine, architectureMatched, projectLocal: local, executionVerified, versionOutput, exitCode: result.exitCode};
    if (packageInfo.version !== manifest.runtime.typescript || !architectureMatched || !local || !executionVerified) errors.push('The project-local native compiler is not compatible or executable here.');
  } catch (error) {
    nativeCompiler = {executionVerified: false, error: String(error)};
    errors.push('The required TypeScript native platform package is missing or cannot execute.');
  }
}
const cachePath = process.env.BUN_INSTALL_CACHE_DIR ?? resolve(process.env.BUN_INSTALL ?? join(homedir(), '.bun'), 'install/cache');
const writes = [writableProbe(resolve(root, '.generated/ui-projections')), writableProbe(cachePath)];
if (writes.some(p => !p.writable)) errors.push('A project output or package cache location is not writable.');
let canonicalInputs: ReturnType<typeof inventoryCanonical> | {error: string};
try { canonicalInputs = inventoryCanonical(root); }
catch (error) { canonicalInputs = {error: String(error)}; errors.push('Canonical input inventory cannot be read.'); }
console.log(JSON.stringify({
  kind: 'MathEducationRuntimeDoctor',
  runtime: {bun: Bun.version, executable: process.execPath, platform: process.platform, architecture: process.arch, cwd: process.cwd(), projectRoot: root, toolHome: homedir()},
  targetVpsRuntimeVerified: false, requiredInputsMissing: missing,
  dependencies, nativeCompiler, writes,
  canonicalInputs, errors,
}, null, 2));
if (errors.length) process.exit(1);
