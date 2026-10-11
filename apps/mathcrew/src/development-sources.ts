import type { Language } from './content';
import { snapshotData } from './data-snapshot';

export const maintainedSuccessors = Object.freeze([{name:'education-platform',url:'https://github.com/park-kyungchan/education-platform'},{name:'agent-platform',url:'https://github.com/park-kyungchan/agent-platform'}] as const);
export const profileInventory = ['default', 'dc-context', 'dc-contract-audit', 'dc-gang-a-dev', 'dc-review', 'ontology-platform'] as const;
export type Profile = typeof profileInventory[number];
export function maintainedSourceURL(profile:Profile):string {if(profile==='default')return 'https://github.com/park-kyungchan/education-platform/tree/main/apps/mathcrew';if(profile==='dc-gang-a-dev')return 'https://github.com/park-kyungchan/education-platform/tree/main/examples/clinic-workbench';return 'https://github.com/park-kyungchan/agent-platform/tree/main/history/public-contracts';}

export interface PublicSource { readonly profile: Profile; readonly name: string; readonly url: string }
export interface PublicSourceSnapshot { readonly schema: 'mathcrew.public-development-snapshot.v1'; readonly repositories: readonly PublicSource[] }
const owner = 'park-kyungchan';
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
};
function safeText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[<>\u0000-\u001f]|\/opt\/|\.env\b/i.test(value)) throw new Error('Unsafe text');
  return value;
}
function rows(value: unknown, verifiedReceipt: boolean): PublicSource[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > profileInventory.length) throw new Error('Invalid source count');
  const seen = new Set<string>();
  return value.map(item => {
    const row = record(item);
    const profile = safeText(row.profile);
    if (!(profileInventory as readonly string[]).includes(profile) || seen.has(profile)) throw new Error('Unknown or duplicate profile');
    seen.add(profile);
    const name = safeText(row.name);
    const url = safeText(row.url);
    if (name !== `hermes-profile-${profile}` || url !== `https://github.com/${owner}/${name}`) throw new Error('Not an admitted public source URL');
    if (verifiedReceipt) {
      if (row.publicBytesVerified !== true || !safeText(row.independentSourceReview).startsWith('PASS ')) throw new Error('Unverified source');
      if (!Number.isSafeInteger(row.fileCount) || (row.fileCount as number) < 1) throw new Error('Invalid file count');
      for (const key of ['head', 'parentAnonymousReadback', 'ci']) safeText(row[key]);
      const keys = ['profile', 'name', 'url', 'head', 'fileCount', 'publicBytesVerified', 'independentSourceReview', 'parentAnonymousReadback', 'ci'];
      if (Object.keys(row).some(key => !keys.includes(key))) throw new Error('Unexpected receipt field');
    } else if (Object.keys(row).some(key => !['profile', 'name', 'url'].includes(key))) throw new Error('Unexpected public field');
    return Object.freeze({ profile: profile as Profile, name, url });
  });
}
// The initial operator-selected receipt is projected once; there is no watcher,
// network lookup, live profile export or synchronous native Work here.
export function projectVerifiedLinks(value: unknown): PublicSourceSnapshot {
  const input = record(snapshotData(value));
  if (input.schema !== 'mathcrew.verified-development-links.v1') throw new Error('Wrong receipt schema');
  if (Object.keys(input).some(key => !['schema', 'status', 'repositories', 'unpublishedProfiles', 'meaning', 'landingAdmission'].includes(key))) throw new Error('Unexpected receipt field');
  for (const key of ['status', 'meaning', 'landingAdmission']) safeText(input[key]);
  const repositories = rows(input.repositories, true);
  if (!Array.isArray(input.unpublishedProfiles)) throw new Error('Missing reserved inventory');
  const pending = input.unpublishedProfiles.map(safeText);
  if (new Set(pending).size !== pending.length || pending.some(profile => !(profileInventory as readonly string[]).includes(profile) || repositories.some(row => row.profile === profile))) throw new Error('Invalid reserved inventory');
  if (repositories.length + pending.length !== profileInventory.length) throw new Error('Incomplete inventory');
  return Object.freeze({ schema: 'mathcrew.public-development-snapshot.v1', repositories: Object.freeze(repositories) });
}
export function validatePublicSnapshot(value: unknown): PublicSourceSnapshot {
  const input = record(snapshotData(value));
  if (input.schema !== 'mathcrew.public-development-snapshot.v1' || Object.keys(input).some(key => !['schema', 'repositories'].includes(key))) throw new Error('Wrong public snapshot schema');
  return Object.freeze({ schema: input.schema, repositories: Object.freeze(rows(input.repositories, false)) });
}
export function validateExternalLink(tag: string, href: string, sources: readonly PublicSource[], origin: string, productURL: string): void {
  const validated = validatePublicSnapshot({ schema: 'mathcrew.public-development-snapshot.v1', repositories: sources });
  if (validated.repositories.some(row => maintainedSourceURL(row.profile) === href) || maintainedSuccessors.some(row=>row.url===href)) {
    if (tag !== 'a') throw new Error('Source navigation cannot be a remote asset');
  } else if (new URL(href).origin === origin) {
    if (!href.startsWith(origin + '/')) throw new Error('Invalid site URL');
  } else if (href !== productURL || tag !== 'a') throw new Error('Unapproved external URL');
}
const descriptions: Record<Profile, Record<Language, string>> = {
  default: { en: 'The bilingual mathCrew public site.', ko: '영어와 한국어로 소개하는 mathCrew 공개 사이트.' },
  'dc-context': { en: 'Source-bound context selection examples.', ko: '출처에 연결된 맥락 선택 예제.' },
  'dc-contract-audit': { en: 'Adversarial contract-check examples.', ko: '반례로 계약을 점검하는 예제.' },
  'dc-gang-a-dev': { en: 'Scoped application development source.', ko: '범위를 한정한 앱 개발 소스.' },
  'dc-review': { en: 'Scoped development review source.', ko: '범위를 한정한 개발 리뷰 소스.' },
  'ontology-platform': { en: 'Shared operational contract source.', ko: '공통 운영 계약 소스.' },
};
export const sourceDescription = (profile: Profile, language: Language): string => descriptions[profile][language];
export const developmentCopy = {
  en: { title: 'Historical public source snapshots.', body: 'Reviewed public source snapshots developed with AI assistance through Hermes. These are scoped code examples, not live profile applications, private records or direct student AI access. Historical originals are retained in private source custody; maintained source links require access to education-platform or agent-platform.', link: 'View private successor source' },
  ko: { title: '이전 공개 소스 스냅샷입니다.', body: 'Hermes에서 AI의 도움을 받아 개발하고 검토한 공개 소스 스냅샷입니다. 범위를 한정한 코드 예제이며, 실행 중인 프로필 앱이나 비공개 기록, 학생의 직접 AI 접근이 아닙니다. 이전 원본은 비공개 source custody로 보존하며, 현재 소스 링크에는 education-platform 또는 agent-platform 접근 권한이 필요합니다.', link: '비공개 후속 소스 보기' },
} as const;
