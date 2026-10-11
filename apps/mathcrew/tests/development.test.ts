import { test, expect } from 'bun:test';
import { renderPage } from '../src/render';
import { developmentSnapshot } from '../src/development-snapshot';
import { developmentCopy, profileInventory, projectVerifiedLinks, validatePublicSnapshot, validateExternalLink, maintainedSourceURL } from '../src/development-sources';

const profiles = developmentSnapshot.repositories.map(row => row.profile);
function fixture() {
  return { schema: 'mathcrew.verified-development-links.v1', status: 'Synthetic verified fixture', repositories: developmentSnapshot.repositories.map(row => ({ profile: String(row.profile), name: String(row.name), url: String(row.url), head: 'synthetic-test-head', fileCount: 1, publicBytesVerified: true, independentSourceReview: 'PASS synthetic fixture', parentAnonymousReadback: 'synthetic/readback.json', ci: 'Not a CI claim' })), unpublishedProfiles: profileInventory.filter(profile => !profiles.includes(profile)), meaning: 'Synthetic public snapshot test', landingAdmission: 'Local only' };
}
test('selected public source rows precede contact in both languages', () => {
  for (const language of ['en', 'ko'] as const) {
    const html = renderPage('home', language);
    expect(html).toContain('id="development"');
    expect(html.indexOf('id="development"')).toBeLessThan(html.indexOf('id="contact"'));
    expect([...html.matchAll(/class="source-row"/g)]).toHaveLength(profiles.length);
    for (const profile of profiles) expect(html).toContain(`href="${maintainedSourceURL(profile)}"`);
    for(const row of developmentSnapshot.repositories)expect(html).not.toContain(`href="${row.url}"`);
    expect([...html.matchAll(/href="https:\/\/dc\.kcpalantir\.tech"/g)]).toHaveLength(2);
    expect(html).not.toContain('target="_blank"');
    for (const profile of profileInventory.filter(profile => !profiles.includes(profile))) expect(html).not.toContain(`hermes-profile-${profile}`);
    expect(html).not.toContain('CI passed');
  }
});

test('valid receipt projects only selected public identities and complete translations', () => {
  expect(projectVerifiedLinks(fixture())).toEqual(developmentSnapshot);
  expect(validatePublicSnapshot(developmentSnapshot)).toEqual(developmentSnapshot);
  expect(profileInventory).toHaveLength(6);
  expect(Object.keys(developmentCopy.en).sort()).toEqual(Object.keys(developmentCopy.ko).sort());
  expect(renderPage('home', 'en')).toContain('developed with AI assistance through Hermes');
  expect(renderPage('home', 'ko')).toContain('AI의 도움을 받아 개발하고 검토한');
  expect(renderPage('home', 'en')).toContain('Source-bound context selection examples.');
  expect(renderPage('home', 'ko')).toContain('반례로 계약을 점검하는 예제.');
});

test('receipt rejects unverified, missing, foreign, private, malformed, duplicate and injected input', () => {
  const cases: Array<(input: ReturnType<typeof fixture>) => void> = [
    x => { x.repositories[0]!.publicBytesVerified = false; },
    x => { x.repositories[0]!.independentSourceReview = 'PENDING'; },
    x => { x.repositories[0]!.url = ''; },
    x => { x.repositories[0]!.url = 'https://github.com/another-owner/hermes-profile-default'; },
    x => { x.repositories[0]!.url += '/issues'; },
    x => { x.repositories[0]!.url += '?private=true'; },
    x => { x.repositories[0]!.url = 'https://github.com/park-kyungchan/dc-gang-a'; },
    x => { x.repositories[0]!.url = '/opt/data/profiles/default'; },
    x => { x.repositories[0]!.name += '" onclick="alert(1)'; },
    x => { x.repositories[0]!.name = 'wrong-name'; },
    x => { x.repositories.push(x.repositories[0]!); },
    x => { x.meaning = '<img src=x onerror=alert(1)>'; },
    x => { x.repositories[0]!.ci = '<script>bad</script>'; },
    x => { x.unpublishedProfiles[0] = 'invented-profile'; },
    x => { x.schema = 'wrong-schema'; },
  ];
  for (const mutate of cases) { const input = fixture(); mutate(input); expect(() => projectVerifiedLinks(input)).toThrow(); }
  const missing = fixture() as unknown as Record<string, unknown>;
  delete (missing.repositories as Record<string, unknown>[])[0]!.url;
  expect(() => projectVerifiedLinks(missing)).toThrow();
  expect(() => projectVerifiedLinks({ ...fixture(), privateRoot: '/opt/data/profiles' })).toThrow();
  expect(() => validatePublicSnapshot({ ...developmentSnapshot, html: '<b>bad</b>' })).toThrow();
});

test('GitHub is exact source navigation, never remote resources or broad host permission', () => {
  const sources = developmentSnapshot.repositories;
  const check = (tag: string, url: string) => validateExternalLink(tag, url, sources, 'https://kcpalantir.tech', 'https://dc.kcpalantir.tech');
  for (const row of sources) {expect(() => check('a', maintainedSourceURL(row.profile))).not.toThrow();expect(()=>check('a',row.url)).toThrow();}
  for (const url of [sources[0].url + '/', sources[0].url + '/issues', 'https://github.com/park-kyungchan/dc-gang-a', 'https://github.com/park-kyungchan/hermes-profile-unknown', 'http://github.com/park-kyungchan/hermes-profile-default', 'https://dc.kcpalantir.tech/private', 'https://evil.example']) expect(() => check('a', url)).toThrow();
  for (const tag of ['link', 'img', 'script', 'iframe']) expect(() => check(tag, maintainedSourceURL(sources[0].profile))).toThrow();
});

test('localized legal copy separates development host from sign-in and provider permission', () => {
  for (const language of ['en', 'ko'] as const) {
    const privacy = renderPage('privacy', language);
    const use = renderPage('site-use', language);
    expect(privacy).toContain('GitHub');
    expect(privacy).toContain(language === 'en' ? 'no GitHub login or provider permission' : 'GitHub 로그인 및 제공자 권한을 요청하지 않습니다');
    expect(use).toContain('npm');
    expect(use).toContain(language === 'en' ? 'does not make a GitHub repository private' : 'GitHub 저장소를 비공개로 만드는 설정이 아닙니다');
    expect([...privacy.matchAll(/href="https:\/\/github/g)]).toHaveLength(0);
  }
});

test('unchanged V4 fallback, font, license and favicon retain reviewed bytes', async () => {
  const pins = {
    '404.html': '2e9c97f9c6bf9e3402b0ad7de61264380a72dbed7fc44ebfcf6ecff8a1111717',
    'ko/404.html': '8716734b2243349f696eab5e33f40c2e80bf26ab35f4325ff51b56727a64dbc7',
    'assets/fonts/NanumGothic-Regular.ttf': '76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31',
    'assets/fonts/nanum-gothic-license.txt': '90f6a909ffb2af7f6422ea20042a26180fe5520cba80bbbf75a5e660320d7924',
    'favicon.svg': 'a05b468785609306fa2009716afe954b6cf3b073743442eae973f55684495824',
  };
  for (const [path, hash] of Object.entries(pins)) {
    const bytes = new Uint8Array(await Bun.file(new URL(`../dist/${path}`, import.meta.url)).arrayBuffer());
    expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(hash);
  }
});

test('private maintained successors are explicit navigation only',()=>{for(const language of ['en','ko'] as const){const html=renderPage('home',language);for(const name of ['agent-platform','education-platform'])expect(html).toContain('href="https://github.com/park-kyungchan/'+name+'"');expect(html).toContain(language==='en'?'repository access required':'저장소 접근 권한 필요');}for(const name of ['agent-platform','education-platform']){const url='https://github.com/park-kyungchan/'+name;expect(()=>validateExternalLink('a',url,developmentSnapshot.repositories,'https://kcpalantir.tech','https://dc.kcpalantir.tech')).not.toThrow();for(const tag of ['script','img'])expect(()=>validateExternalLink(tag,url,developmentSnapshot.repositories,'https://kcpalantir.tech','https://dc.kcpalantir.tech')).toThrow();}});
