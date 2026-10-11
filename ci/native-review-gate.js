// @bun
// ../agent-platform/ci/source-check.ts
import { createHash } from "crypto";
import { dirname, join, relative, resolve, sep } from "path";
var sourceRoot = resolve(import.meta.dir, "..");
var sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
var contextModules = ["index", "types", "validation", "source", "store", "context", "boundary", "sections"];
var nativeCodexModules = ["hooks", "home-context", "evaluation-ledger"];
var hermesModules = ["work-context", "contracts", "current-intent", "domain-context", "role-registry", "audit-adapter", "pinned-reader"];
var contextPaths = ["project.json", "ontology-pin.json", "package.json", "bun.lock", "packages/work-continuity/package.json", "releases/palantirkc-ontology-0.2.0.tgz", ...contextModules.map((name) => `packages/work-continuity/src/context/${name}.ts`), "packages/work-continuity/releases/palantirkc-ontology-0.2.0.tgz"];
var nativeCodexPaths = ["package.json", "bun.lock", "packages/native-codex-adapter/package.json", ...nativeCodexModules.map((name) => `packages/native-codex-adapter/src/native/${name}.ts`)];
var hermesPaths = ["package.json", "bun.lock", "releases/palantirkc-ontology-0.2.0.tgz", "packages/native-hermes-adapter/package.json", "packages/native-hermes-adapter/releases/palantirkc-ontology-0.2.0.tgz", ...hermesModules.map((name) => `packages/native-hermes-adapter/src/ontology-driven/${name}.ts`), "packages/native-hermes-adapter/src/adoption/semantic-context.ts", "packages/native-hermes-adapter/src/adoption/evaluation-budget.ts"];
var finiteOwnerSources = [
  ...["src/legacy/harness/owner-context-loader.ts", "src/legacy/harness/provider-closure.ts", "src/native/provider-closure.ts", ...nativeCodexModules.map((name) => `src/native/${name}.ts`)].map((path) => ({ owner: "codex-harness-engineering", path })),
  { owner: "hermes-harness-engineering", path: "src/ontology-driven/provider-source.ts" }
];
function validateIndependentReviewReceipt(receipt, head, tree) {
  if (!/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(tree) || receipt.schema !== "native-independent-review.v1" || receipt.headSha !== head || receipt.reviewedTreeSha !== tree || receipt.reviewer?.runtime !== "native-codex" || typeof receipt.reviewer?.taskId !== "string" || !receipt.reviewer.taskId.trim() || typeof receipt.author?.taskId !== "string" || !receipt.author.taskId.trim() || receipt.reviewer.taskId === receipt.author.taskId || receipt.conclusion !== "pass" || receipt.unresolvedFindings !== 0 || receipt.provenance?.owner !== "hermes-harness-engineering" || typeof receipt.provenance?.resultRef !== "string" || !receipt.provenance.resultRef.trim() || !/^[a-f0-9]{64}$/.test(receipt.provenance?.sha256))
    throw Error("Native independent review receipt does not prove the exact reviewed head/tree and independent native reviewer");
}
async function reviewGate() {
  const repository = process.env.GITHUB_REPOSITORY, head = process.env.REVIEW_HEAD_SHA, token = process.env.GITHUB_TOKEN;
  const expectedCreator = process.env.NATIVE_REVIEW_STATUS_CREATOR_ID, expectedLogin = process.env.NATIVE_REVIEW_STATUS_CREATOR_LOGIN;
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !head || !/^[a-f0-9]{40}$/.test(head) || !token || !expectedCreator || !/^[1-9][0-9]*$/.test(expectedCreator))
    throw Error("Exact native review head, repository, authenticated read and expected status creator are required");
  async function api(path) {
    const response = await fetch("https://api.github.com/repos/" + repository + "/" + path, { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error" });
    if (!response.ok)
      throw Error("Native review API read failed: " + response.status);
    return await response.json();
  }
  const statuses = await api(`commits/${head}/statuses?per_page=100`);
  if (!Array.isArray(statuses))
    throw Error("Exact-head native review statuses unavailable");
  const status = statuses.find((value) => value.context === "native-independent-review");
  if (!status || status.state !== "success" || String(status.creator?.id) !== expectedCreator || expectedLogin && status.creator?.login !== expectedLogin)
    throw Error("Native independent review status missing, unsuccessful or from unexpected creator");
  const target = new URL(status.target_url);
  const prefix = `/${repository}/blob/`, suffix = `/native-reviews/${head}.json`;
  if (target.protocol !== "https:" || target.hostname !== "github.com" || target.port || target.username || target.password || target.search || target.hash || !target.pathname.startsWith(prefix) || !target.pathname.endsWith(suffix))
    throw Error("Native review URL must be exact immutable same-repository receipt");
  const receiptCommit = target.pathname.slice(prefix.length, -suffix.length);
  if (!/^[a-f0-9]{40}$/.test(receiptCommit) || receiptCommit === head)
    throw Error("Native review receipt requires immutable full commit SHA");
  const content = await api(`contents/native-reviews/${head}.json?ref=${receiptCommit}`);
  if (content.type !== "file" || content.encoding !== "base64" || typeof content.content !== "string" || !Number.isSafeInteger(content.size) || content.size <= 0 || content.size > 32768)
    throw Error("Native review receipt is not a bounded repository file");
  const receipt = JSON.parse(Buffer.from(content.content, "base64").toString("utf8"));
  const commit = await api("git/commits/" + head);
  if (commit.sha !== head)
    throw Error("GitHub API returned another commit");
  validateIndependentReviewReceipt(receipt, head, commit.tree?.sha);
  console.log(JSON.stringify({ schema: "agent-platform.native-review-ci.v1", headSha: head, receiptCommit, receiptSha256: sha(Buffer.from(content.content, "base64")), reviewedTreeSha: receipt.reviewedTreeSha, status: "pass" }));
}
if (false) {}

// ci/native-review.entry.ts
await reviewGate();
