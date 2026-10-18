import {bunToolchain} from './runtime';

export const educationSourceCi = {
 workflow: '.github/workflows/source.yml',
 owner: {repository:'park-kyungchan/education-platform',projectId:'education-platform',domainId:'education'},
 sourceSha: '${{ github.event.pull_request.head.sha || github.sha }}',
 permissions: {contents:'read',statuses:'read'},
 setup: {bootstrapBun:'1.4.2',command:'bun scripts/setup.ts'},
 source: {
  jobId: 'source',
  action: 'park-kyungchan/agent-platform/.github/actions/bun-source@6933ca88c815f5e6e5490f9232c81e0dc5663af5',
  bun: bunToolchain.version,
  installDependencies: 'false',
  scripts: ['check:ci-projection','check'],
 },
 nativeReview: {jobId:'native-review',policyPath:'architecture/common-ci-provider.json'},
 gate: {jobId:'source-gate',needs:['source','native-review']},
} as const;
