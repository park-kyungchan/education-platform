import { expect, test } from 'bun:test';
import { handlePreview } from '../src/preview-handler';

for (const language of ['en', 'ko'] as const) {
  test(`nested unknown ${language} fallback resolves real assets and localized navigation`, async () => {
    const url = `http://localhost/${language === 'ko' ? 'ko/' : ''}missing/deep`;
    const response = await handlePreview(new Request(url));
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const html = await response.text();
    expect(html).toContain(`<html lang="${language}">`);
    expect(html).not.toContain('<base');
    const root = language === 'ko' ? '/ko/' : '/';
    const other = language === 'ko' ? 'en' : 'ko';
    const switchPath = language === 'ko' ? '/404.html' : '/ko/404.html';
    const patterns: [RegExp, string, string | null][] = [
      [/<link rel="stylesheet" href="([^"]+)"/, '/styles.css', null],
      [/<link rel="icon" href="([^"]+)"/, '/favicon.svg', null],
      [/<link rel="preload" href="([^"]+)"/, '/assets/fonts/NanumGothic-Regular.ttf', null],
      [/<a class="brand" href="([^"]+)"/, root, language],
      [/<a class="button" href="([^"]+)"/, root, language],
      [/<a href="([^"]+)" lang="/, switchPath, other],
      [/<a href="([^"]+privacy.html)"/, `${root}privacy.html`, language],
      [/<a href="([^"]+site-use.html)"/, `${root}site-use.html`, language],
    ];
    for (const [pattern, expected, targetLanguage] of patterns) {
      const href = pattern.exec(html)?.[1];
      expect(href).toBeDefined();
      const resolved = new URL(href!, url);
      expect(resolved.pathname).toBe(expected);
      const target = await handlePreview(new Request(resolved));
      expect(target.status).toBe(200);
      if (targetLanguage) expect(await target.text()).toContain(`<html lang="${targetLanguage}">`);
    }
    const css = await (await handlePreview(new Request(new URL('/styles.css', url)))).text();
    const font = /url\('([^']+)'\)/.exec(css)?.[1];
    expect(new URL(font!, new URL('/styles.css', url)).pathname).toBe('/assets/fonts/NanumGothic-Regular.ttf');
  });
}
