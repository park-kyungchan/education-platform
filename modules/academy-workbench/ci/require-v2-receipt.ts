/** Academy transport policy; canonical gate still owns authentication and review validation. */
export async function runV2ReviewGate(canonicalGate: () => Promise<void>) {
  const repository = process.env.GITHUB_REPOSITORY, head = process.env.REVIEW_HEAD_SHA;
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !head || !/^[a-f0-9]{40}$/.test(head)) throw Error('Exact repository/head selection is required.');
  const originalFetch = globalThis.fetch;
  let checked = false;
  // Inspect the response consumed by the canonical gate, avoiding a second status/read race.
  // This wrapper lives only for this standalone CI command and is always restored.
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const response = await originalFetch(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === 'https://api.github.com' && url.pathname === `/repos/${repository}/contents/native-reviews/${head}.json` && response.ok) {
      const body = await response.clone().text();
      if (body.length > 65536) throw Error('Review receipt transport exceeds bound.');
      const file = JSON.parse(body);
      if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string' || file.content.length > 50000 || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 32768) throw Error('Review receipt is not a bounded file.');
      const bytes = Buffer.from(file.content, 'base64');
      if (bytes.length !== file.size || JSON.parse(bytes.toString('utf8')).schema !== 'native-independent-review.v2') throw Error('Academy successor requires a native-independent-review.v2 receipt.');
      checked = true;
    }
    return response;
  }) as typeof fetch;
  try {
    await canonicalGate();
    if (!checked) throw Error('Canonical gate did not consume the exact-head V2 review receipt.');
  } finally { globalThis.fetch = originalFetch; }
}
