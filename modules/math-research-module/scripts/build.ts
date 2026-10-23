import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export async function build() {
  await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
  await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
  const result = await Bun.build({ entrypoints: [root + 'src/main.tsx'], outdir: root + 'dist', target: 'browser', minify: true, sourcemap: 'none', naming: '[name].[ext]', define: { 'process.env.NODE_ENV': JSON.stringify('production') } });
  if (!result.success) throw new Error(result.logs.map(String).join('\n'));
  const css = result.outputs.filter(x => x.path.endsWith('.css')).map(x => `<link rel="stylesheet" href="./${x.path.split('/').at(-1)}" />`).join('');
  const html = (await readFile(root + 'index.html', 'utf8')).replace('</head>', css + '</head>');
  await writeFile(root + 'dist/index.html', html);
  console.log(`Built ${result.outputs.length} bundled assets; no host SDK or external font requests required.`);
}
if (import.meta.main) await build();
