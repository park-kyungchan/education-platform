import {bunToolchain} from './runtime';

export const educationSourceCi = {
 workflow: '.github/workflows/source.yml',
 owner: {repository:'park-kyungchan/education-platform',projectId:'education-platform',domainId:'education'},
 sourceSha: '${{ github.event.pull_request.head.sha || github.sha }}',
 permissions: {contents:'read',statuses:'read',actions:'read','pull-requests':'read'},
 setup: {bootstrapBun:'1.4.2',script:'setup'},
 source: {
  jobId: 'source',
  action: 'park-kyungchan/agent-platform/.github/actions/bun-source@f6649663fb78261de2499f0920306c32f5e22f1f',
  fetchDepth: 0,
  bun: bunToolchain.version,
  installDependencies: 'false',
  scripts: ['setup','check:ci-projection','check'],
 },
 nativeReview: {jobId:'native-review',policyPath:'architecture/common-ci-provider.json'},
 r07Slice: {jobId:'r07-slice',name:'R07 slice scope and size',script:'apps/academy/dc-gang-a/scripts/check-r07-slice-size.ts'},
 unit: {command:'bun --no-env-file apps/academy/dc-gang-a/scripts/check-r07-slice-size.ts ci-unit',artifactAction:'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02'},
 gate: {jobId:'source-gate',needs:['source','native-review','r07-slice']},
} as const;
