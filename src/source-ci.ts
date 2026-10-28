import {bunToolchain} from './runtime';

export const educationSourceCi = {
 workflow: '.github/workflows/source.yml',
 owner: {repository:'park-kyungchan/education-platform',projectId:'education-platform',domainId:'education'},
 sourceSha: '${{ github.event.pull_request.head.sha || github.sha }}',
 permissions: {contents:'read',statuses:'read'},
 setup: {bootstrapBun:'1.4.2',script:'setup'},
 source: {
  jobId: 'source',
  action: 'park-kyungchan/agent-platform/.github/actions/bun-source@f6649663fb78261de2499f0920306c32f5e22f1f',
  fetchDepth: 0,
  bun: bunToolchain.version,
  installDependencies: 'false',
  scripts: ['setup','check:ci-projection','check'],
  // Exact owner-specific synthetic replay suffix; arbitrary inline source steps stay forbidden.
  nativePlanReplaySteps: [
  {
    "name": "Start disposable Postgres for the complete native source plan",
    "run": "mkdir -m 777 \"$RUNNER_TEMP/native-plan-socket\"\ndocker run --detach --rm --name native-plan-source-postgres --network none \\\n  -e POSTGRES_USER=e2e_qualification -e POSTGRES_DB=postgres \\\n  -e POSTGRES_HOST_AUTH_METHOD=trust \\\n  -v \"$RUNNER_TEMP/native-plan-socket:/var/run/postgresql\" \\\n  postgres@sha256:ec4dfc6571f04fe0731ce948c1500d676af49a7224392dcc6995cc1ee33a94bb\nfor attempt in $(seq 1 60); do\n  if docker exec native-plan-source-postgres pg_isready -U e2e_qualification -d postgres; then exit 0; fi\n  sleep 1\ndone\nexit 1\n"
  },
  {
    "name": "Replay all 32 native plan steps through the real source store",
    "env": {
      "NATIVE_PLAN_PG_SOCKET": "${{ runner.temp }}/native-plan-socket"
    },
    "run": "bun test --timeout 900000 apps/academy/dc-gang-a/tests/academy/isolatedNativeServer.test.ts -t 'NATIVE-PLAN all 32'"
  },
  {
    "name": "Stop the disposable source-plan provider",
    "if": "${{ always() }}",
    "run": "docker stop --time 10 native-plan-source-postgres"
  }
],
 },
 nativeReview: {jobId:'native-review',policyPath:'architecture/common-ci-provider.json'},
 gate: {jobId:'source-gate',needs:['source','native-review']},
} as const;
