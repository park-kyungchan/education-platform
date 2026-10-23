export const mathSourceCi = {
  workflow: '.github/workflows/source.yml',
  owner: {
    repository: 'park-kyungchan/math-research-module',
    projectId: 'math-research-module',
    domainId: 'mathematics-education',
  },
  sharedAction: 'park-kyungchan/agent-platform/.github/actions/bun-source@8a91a8837d3b6454d7bba5e90d25651cb898f69b',
  sourceAuthorMetadata: '.github/source-author.json',
  sourceSha: '${{ github.event.pull_request.head.sha || github.sha }}',
  runtime: { bun: '1.4.2', node: '24.19.0' },
  permissions: { contents: 'read' },
  sourceJobs: {
    synthetic: {
      scripts: ['check:ci-projection', 'test:ci-workflow', 'check'],
      env: {},
    },
    contracts: {
      scripts: ['check:ci-projection', 'verify', 'check:ci-identity'],
      env: { AGENT_PLATFORM_SOURCE_MODE: 'compiled-canonical-ci-projection' },
    },
  },
  nativeReview: {
    jobId: 'native-review',
    policyPath: 'harness/common-ci-provider.json',
  },
  gate: {
    jobId: 'source-gate',
    needs: ['synthetic', 'contracts', 'native-review'],
  },
} as const;
