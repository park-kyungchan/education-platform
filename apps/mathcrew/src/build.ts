import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, pageFiles } from './render';
import { fontAssets, publicFiles } from './static-assets';
import { developmentSnapshot } from './development-snapshot';
import { validatePublicSnapshot } from './development-sources';
const root = new URL('../dist/', import.meta.url);
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
await mkdir(new URL('ko/', root), { recursive: true });
for (const language of ['en', 'ko'] as const) for (const page of ['home', 'privacy', 'site-use', '404'] as const) {
  await Bun.write(new URL(`${language === 'ko' ? 'ko/' : ''}${pageFiles[page]}`, root), renderPage(page, language));
}
await Bun.write(new URL('styles.css', root), Bun.file(new URL('./styles.css', import.meta.url)));
await Bun.write(new URL('favicon.svg', root), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#2451E6"/><circle cx="32" cy="32" r="19" fill="none" stroke="white" stroke-width="2"/><path d="M8 56 56 8M32 32h22" fill="none" stroke="white" stroke-width="2"/><circle cx="46" cy="18" r="5" fill="#FFBEAE"/></svg>\n');
for (const asset of fontAssets) {
  const target = new URL(asset, root);
  await mkdir(dirname(fileURLToPath(target)), { recursive: true });
  await Bun.write(target, Bun.file(new URL(`./${asset}`, import.meta.url)));
}
console.log(JSON.stringify({ status: 'BUILT', generation: 'V5', sourceLinks: validatePublicSnapshot(developmentSnapshot).repositories.length, pages: 8, publicFiles: publicFiles.length, output: 'dist/', network: false, listenerStarted: false }));
