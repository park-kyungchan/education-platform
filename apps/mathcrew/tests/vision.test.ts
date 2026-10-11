import { expect, test } from 'bun:test';
import { renderPage } from '../src/render';
import { developmentSnapshot } from '../src/development-snapshot';
import { validateExternalLink } from '../src/development-sources';

test('latest public vision leads the first viewport in both languages', () => {
  const en = renderPage('home', 'en');
  const ko = renderPage('home', 'ko');
  const hero = (s: string) => /<section class="hero"[\s\S]*?<\/section>/.exec(s)?.[0] ?? '';
  expect(hero(en)).toContain('Mathematics');
  expect(hero(en)).toContain('made thinkable.');
  expect(hero(en)).toContain('3D thought experiments');
  expect(hero(en)).toContain('real-world digital twins');
  expect(hero(en)).toContain('Planned direction');
  expect(hero(en)).toContain('class="spatial-construction"');
  expect(hero(ko)).toContain('스스로 추론');
  expect(hero(ko)).toContain('3D 사고실험');
  expect(hero(ko)).toContain('디지털 트윈');
  expect(hero(ko)).toContain('계획된 방향');
  expect(hero(ko)).toContain('공간');
});

test('planned inquiry, grounding and evaluation do not imply delivered capabilities', () => {
  const en = renderPage('home', 'en');
  const ko = renderPage('home', 'ko');
  for (const phrase of ['concept relationships', 'classroom context', 'Claude-native', 'Claude API is not currently integrated', 'conceptual understanding', 'learner independence', 'grounded reliability', 'cost', 'Teachers retain', 'founder', 'private']) expect(en).toContain(phrase);
  for (const phrase of ['개념', '수업 맥락', 'Claude API', '아직', '개념 이해', '독립', '근거', '비용', '교사', '비공개']) expect(ko).toContain(phrase);
  expect(en).toContain('not a working digital twin');
  expect(ko).toContain('작동하는 디지털 트윈이');
});

test('every public page preserves privacy, external URL and auth boundaries', () => {
  for (const language of ['en', 'ko'] as const) for (const page of ['home', 'privacy', 'site-use', '404'] as const) {
    const html = renderPage(page, language);
    expect(html).not.toMatch(/<script|<form|<iframe|<input|application-authored|public-vision|sourceNarrative|subscription|payment|Bible|SPT|console\.anthropic/i);
    for (const [, tag, href] of html.matchAll(/<(\w+)\b[^>]*?\b(?:href|src)="(https?:\/\/[^\"]+)"/g)) expect(() => validateExternalLink(tag!, href!, developmentSnapshot.repositories, 'https://kcpalantir.tech', 'https://dc.kcpalantir.tech')).not.toThrow();
    expect(html).toContain('mailto:kcpalantir@kcpalantir.tech');
    expect(html).toContain('href="https://dc.kcpalantir.tech"');
    expect(html).toContain(language === 'en' ? 'Teacher sign-in' : '교사 로그인');
    const local = [...html.matchAll(/(?:href|src)="([^\"]+)"/g)].map(m => m[1]!).filter(x => !/^(https?:|mailto:|#)/.test(x));
    expect(local.every(x => x.startsWith('/'))).toBe(true);
  }
});
