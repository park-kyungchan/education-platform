import { test, expect } from 'bun:test';
import { developmentSnapshot } from '../src/development-snapshot';
import { profileInventory, projectVerifiedLinks, validatePublicSnapshot, validateExternalLink } from '../src/development-sources';
const plain = () => JSON.parse(JSON.stringify(developmentSnapshot));
const receipt = (count = 3) => ({
  schema: 'mathcrew.verified-development-links.v1', status: 'Synthetic fixture', meaning: 'Source-only fixture', landingAdmission: 'Local test',
  repositories: profileInventory.slice(0, count).map(profile => ({ profile, name: `hermes-profile-${profile}`, url: `https://github.com/park-kyungchan/hermes-profile-${profile}`, head: 'synthetic', fileCount: 1, publicBytesVerified: true, independentSourceReview: 'PASS synthetic', parentAnonymousReadback: 'synthetic', ci: 'No CI claim' })),
  unpublishedProfiles: profileInventory.slice(count),
});
test('actual predecessor decorated map counterexample rejects before caller execution', () => {
  const input = plain(); let calls = 0;
  input.repositories.map = () => { calls++; return [{ profile: 'default', name: 'fake', url: 'https://example.invalid/unapproved' }]; };
  expect(() => validatePublicSnapshot(input)).toThrow();
  expect(calls).toBe(0);
});
test('whole public ingress rejects getters, sparse lists, prototypes and method substitutions without executing callers', () => {
  const mutations: Array<(x: any, run: () => never) => void> = [
    (x, run) => Object.defineProperty(x, 'schema', { get: run }),
    (x, run) => Object.defineProperty(x.repositories[2], 'url', { get: run }),
    (x, run) => Object.defineProperty(x.repositories, '0', { get: run }),
    x => { delete x.repositories[1]; },
    x => { x.repositories.length += 1; },
    x => { x.repositories.extra = true; },
    (x, run) => { x.repositories.every = run; },
    (x, run) => { x.repositories[Symbol.iterator] = run; },
    (x, run) => Object.setPrototypeOf(x.repositories, Object.assign(Object.create(Array.prototype), { map: run })),
    x => Object.setPrototypeOf(x.repositories[0], { inherited: true }),
    (x, run) => Object.defineProperty(x.repositories[0], 'extra', { get: run }),
    x => { x[Symbol('extra')] = true; },
    x => { x.repositories[0][Symbol('extra')] = true; },
  ];
  for (const mutate of mutations) {
    const input = plain(); let calls = 0;
    const run = () => { calls++; input.repositories.push(input.repositories[0]); throw new Error('Caller executed'); };
    mutate(input, run);
    expect(() => validatePublicSnapshot(input)).toThrow(); expect(calls).toBe(0);
  }
});
test('operator receipt and pending inventory use the same inert whole-data ingress', () => {
  const mutations: Array<(x: any, run: () => never) => void> = [
    (x, run) => { x.repositories.map = run; },
    (x, run) => { x.unpublishedProfiles.map = run; },
    (x, run) => { x.unpublishedProfiles[Symbol.iterator] = run; },
    x => { delete x.unpublishedProfiles[0]; },
    (x, run) => Object.defineProperty(x.repositories[0], 'publicBytesVerified', { get: run }),
    x => { delete x.repositories[0].publicBytesVerified; Object.setPrototypeOf(x.repositories[0], { publicBytesVerified: true }); },
    (x, run) => Object.defineProperty(x, 'landingAdmission', { get: run }),
    x => { x.repositories[0].privateRoot = 'not public'; },
  ];
  for (const mutate of mutations) {
    const input = receipt(); let calls = 0;
    mutate(input, () => { calls++; throw new Error('Caller executed'); });
    expect(() => projectVerifiedLinks(input)).toThrow(); expect(calls).toBe(0);
  }
});
test('plain one-to-six projection creates independent deeply frozen snapshots and exact relations', () => {
  for (let count = 1; count <= 6; count++) {
    const input = receipt(count); const result = projectVerifiedLinks(input);
    expect(result.repositories).toHaveLength(count);
    expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result.repositories)).toBe(true);
    for (const row of result.repositories) expect(Object.isFrozen(row)).toBe(true);
    input.repositories[0].url = 'https://example.invalid';
    expect(result.repositories[0].url).not.toContain('example.invalid');
    expect(validatePublicSnapshot(result)).toEqual(result);
  }
  for (const count of [0, 7]) expect(() => projectVerifiedLinks({ ...receipt(), repositories: Array.from({ length: count }, () => receipt().repositories[0]) })).toThrow();
  const input = receipt(); input.repositories[0].profile = 'dc-review' as any;
  expect(() => projectVerifiedLinks(input)).toThrow();
  const duplicate = receipt(); duplicate.repositories[1] = duplicate.repositories[0];
  expect(() => projectVerifiedLinks(duplicate)).toThrow();
});
test('external source list cannot bypass navigation checks through caller some or getters', () => {
  const input = plain(); let calls = 0;
  input.repositories.some = () => { calls++; return true; };
  expect(() => validateExternalLink('a', 'https://example.invalid', input.repositories, 'https://kcpalantir.tech', 'https://dc.kcpalantir.tech')).toThrow();
  expect(calls).toBe(0);
  const snapshot = validatePublicSnapshot(plain());
  expect(Object.isFrozen(snapshot.repositories[0])).toBe(true);
  for (const tag of ['img', 'script', 'link', 'iframe']) expect(() => validateExternalLink(tag, snapshot.repositories[0].url, snapshot.repositories, 'https://kcpalantir.tech', 'https://dc.kcpalantir.tech')).toThrow();
});
