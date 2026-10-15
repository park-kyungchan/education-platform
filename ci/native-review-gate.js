// @bun
// agent-platform:ci/quality/receipt-validator.ts
import { createHash } from "crypto";
var hash = (value) => createHash("sha256").update(value).digest("hex");
var object = (value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
var fullSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
var digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
var taskId = (value) => typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value && !/[\s\u0000-\u001f\u007f]/.test(value);
function validateLegacyReceipt(receipt, head, tree) {
  const value = object(receipt);
  const reviewer = object(value.reviewer);
  const author = object(value.author);
  const provenance = object(value.provenance);
  if (!fullSha(head) || !fullSha(tree) || value.schema !== "native-independent-review.v1" || value.headSha !== head || value.reviewedTreeSha !== tree || reviewer.runtime !== "native-codex" || typeof reviewer.taskId !== "string" || !reviewer.taskId.trim() || typeof author.taskId !== "string" || !author.taskId.trim() || reviewer.taskId === author.taskId || value.conclusion !== "pass" || value.unresolvedFindings !== 0 || provenance.owner !== "hermes-harness-engineering" || typeof provenance.resultRef !== "string" || !provenance.resultRef.trim() || !digest(provenance.sha256)) {
    throw new Error("Native independent review receipt does not prove the exact reviewed head/tree and independent native reviewer");
  }
}
function deriveReviewedSourceManifest(response, tree) {
  const value = object(response);
  if (!fullSha(tree) || value.sha !== tree || value.truncated !== false || !Array.isArray(value.tree) || value.tree.length < 1 || value.tree.length > 4096) {
    throw new Error("Reviewed source tree is unavailable, truncated or outside the manifest bound");
  }
  const seen = new Set;
  const entries = value.tree.map((entry) => {
    const item = object(entry);
    if (typeof item.path !== "string" || !item.path || item.path.length > 512 || /[\\\u0000-\u001f\u007f]/.test(item.path) || item.path.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment === ".git") || seen.has(item.path) || !fullSha(item.sha) || !(item.type === "tree" && item.mode === "040000" || item.type === "blob" && ["100644", "100755", "120000"].includes(String(item.mode)))) {
      throw new Error("Reviewed source tree contains duplicate, unsafe or unsupported entries");
    }
    seen.add(item.path);
    return {
      path: item.path,
      mode: String(item.mode),
      type: item.type,
      sha: item.sha
    };
  });
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const blobCount = entries.filter((entry) => entry.type === "blob").length;
  if (!blobCount)
    throw new Error("Reviewed source manifest contains no source blobs");
  return {
    schema: "agent-platform.reviewed-source-manifest.v1",
    reviewedTreeSha: tree,
    entryCount: entries.length,
    blobCount,
    sha256: hash(`agent-platform.reviewed-source-manifest.v1
` + JSON.stringify(entries))
  };
}
function validateV2Binding(receipt, head, tree, manifestSha256) {
  const binding = object(receipt.binding);
  const reviewer = object(receipt.reviewer);
  const author = object(receipt.author);
  if (!fullSha(head) || !fullSha(tree) || !digest(manifestSha256) || binding.codeOwner !== "agent-platform" || binding.evidenceOwner !== "codex-harness-engineering" || binding.scope !== "canonical-source-ci-quality" || Object.keys(binding).sort().join("|") !== "codeOwner|evidenceOwner|scope" || receipt.headSha !== head || receipt.reviewedTreeSha !== tree || receipt.reviewedSourceManifestSha256 !== manifestSha256 || reviewer.runtime !== "native-codex" || author.runtime !== "native-codex" || !taskId(reviewer.taskId) || !taskId(author.taskId) || reviewer.taskId === author.taskId || receipt.conclusion !== "pass" || receipt.unresolvedFindings !== 0) {
    throw new Error("Receipt does not prove the exact v2 ownership, scope, head, tree, manifest and independent native identities");
  }
}
function validateIndependentReviewReceipt(receipt, head, tree, context) {
  const value = object(receipt);
  if (value.schema === "native-independent-review.v1") {
    validateLegacyReceipt(value, head, tree);
    return;
  }
  if (value.schema !== "native-independent-review.v2" || !context || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repository)) {
    throw new Error("Unsupported native independent review receipt schema or missing v2 context");
  }
  validateV2Binding(value, head, tree, context.sourceManifestSha256);
  const provenance = object(value.provenance);
  if (provenance.owner !== "codex-harness-engineering" || typeof provenance.resultRef !== "string" || !digest(provenance.sha256)) {
    throw new Error("v2 independent review provenance owner or digest mismatch");
  }
  const target = new URL(provenance.resultRef);
  const prefix = `/${context.repository}/blob/`;
  const path = `native-review-results/${head}.json`;
  const suffix = "/" + path;
  if (target.protocol !== "https:" || target.hostname !== "github.com" || target.port || target.username || target.password || target.search || target.hash || !target.pathname.startsWith(prefix) || !target.pathname.endsWith(suffix)) {
    throw new Error("v2 result provenance must be an immutable same-repository result file");
  }
  const commit = target.pathname.slice(prefix.length, -suffix.length);
  if (!fullSha(commit) || commit === head) {
    throw new Error("v2 result provenance requires a separate immutable commit");
  }
  return { commit, path, sha256: provenance.sha256 };
}
function decodeBoundedReviewFile(content, path, maximumBytes) {
  const value = object(content);
  if (value.type !== "file" || value.path !== path || value.encoding !== "base64" || typeof value.content !== "string" || !Number.isSafeInteger(value.size) || typeof value.size !== "number" || value.size <= 0 || value.size > maximumBytes) {
    throw new Error("Independent review file is not a bounded repository file");
  }
  const base64 = value.content.replace(/\n/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Independent review file is not valid base64");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length !== value.size)
    throw new Error("Independent review file byte size mismatch");
  return bytes;
}
function verifyIndependentReviewResult(receipt, bytes, expected, head, tree, manifestSha256) {
  if (hash(bytes) !== expected.sha256)
    throw new Error("Immutable independent review result digest mismatch");
  const result = object(JSON.parse(Buffer.from(bytes).toString("utf8")));
  if (result.schema !== "agent-platform.independent-review-result.v1" || result.recordClass !== "verification") {
    throw new Error("Immutable independent review result schema mismatch");
  }
  validateV2Binding(result, head, tree, manifestSha256);
  const value = object(receipt);
  if (object(result.reviewer).taskId !== object(value.reviewer).taskId || object(result.author).taskId !== object(value.author).taskId) {
    throw new Error("Immutable independent review result identities differ from its receipt");
  }
}

// agent-platform:ci/quality/receipt-validation-gate.ts
async function validateReceiptWithEvidence(receipt, head, tree, repository, reader) {
  if (typeof receipt !== "object" || receipt === null || !("schema" in receipt)) {
    throw new Error("Independent review receipt is unavailable");
  }
  if (receipt.schema === "native-independent-review.v1") {
    validateIndependentReviewReceipt(receipt, head, tree);
    return { version: 1 };
  }
  if (receipt.schema !== "native-independent-review.v2") {
    throw new Error("Unsupported native independent review receipt schema");
  }
  const manifest = deriveReviewedSourceManifest(await reader.readTree(tree), tree);
  const result = validateIndependentReviewReceipt(receipt, head, tree, {
    repository,
    sourceManifestSha256: manifest.sha256
  });
  if (!result)
    throw new Error("v2 receipt did not resolve immutable result provenance");
  const bytes = decodeBoundedReviewFile(await reader.readFile(result.path, result.commit), result.path, 65536);
  verifyIndependentReviewResult(receipt, bytes, result, head, tree, manifest.sha256);
  return { version: 2, manifest };
}

// agent-platform:ci/source-check.ts
import { createHash as createHash2 } from "crypto";
import { dirname, join, relative, resolve, sep } from "path";
var sourceRoot = resolve(import.meta.dir, "..");
var sha = (bytes) => createHash2("sha256").update(bytes).digest("hex");
var contextModules = [
  "index",
  "types",
  "validation",
  "source",
  "store",
  "context",
  "boundary",
  "sections"
];
var nativeCodexModules = ["hooks", "home-context", "evaluation-ledger"];
var hermesModules = [
  "work-context",
  "contracts",
  "current-intent",
  "domain-context",
  "role-registry",
  "audit-adapter",
  "pinned-reader"
];
var gitWorkPaths = [
  ...["index", "source", "records", "context", "types"].map((name) => `packages/work-continuity/src/git-work/${name}.ts`),
  "packages/work-continuity/src/logical-identity.ts",
  "packages/work-continuity/src/operational-state.ts"
];
var contextPaths = [
  "project.json",
  "ontology-pin.json",
  "package.json",
  "bun.lock",
  "packages/work-continuity/package.json",
  "releases/palantirkc-ontology-0.2.0.tgz",
  ...contextModules.map((name) => `packages/work-continuity/src/context/${name}.ts`),
  "packages/work-continuity/releases/palantirkc-ontology-0.2.0.tgz",
  ...gitWorkPaths
];
var nativeCodexPaths = [
  "package.json",
  "bun.lock",
  "packages/native-codex-adapter/package.json",
  ...nativeCodexModules.map((name) => `packages/native-codex-adapter/src/native/${name}.ts`)
];
var hermesPaths = [
  "package.json",
  "bun.lock",
  "releases/palantirkc-ontology-0.2.0.tgz",
  "packages/native-hermes-adapter/package.json",
  "packages/native-hermes-adapter/releases/palantirkc-ontology-0.2.0.tgz",
  ...hermesModules.map((name) => `packages/native-hermes-adapter/src/ontology-driven/${name}.ts`),
  "packages/native-hermes-adapter/src/adoption/semantic-context.ts",
  "packages/native-hermes-adapter/src/adoption/evaluation-budget.ts"
];
var nativePluginNames = ["source-review-readonly", "ocp-readonly-review", "native-task-controls"];
var nativePluginPaths = nativePluginNames.flatMap((name) => ["__init__.py", "plugin.yaml"].map((file) => "packages/native-hermes-adapter/native/plugins/" + name + "/" + file)).sort();
var finiteOwnerSources = [
  ...[
    "src/legacy/harness/owner-context-loader.ts",
    "src/legacy/harness/provider-closure.ts",
    "src/native/provider-closure.ts",
    "src/native/hook-cli.ts",
    ...nativeCodexModules.map((name) => `src/native/${name}.ts`)
  ].map((path) => ({ owner: "codex-harness-engineering", path })),
  { owner: "hermes-harness-engineering", path: "src/ontology-driven/provider-source.ts" }
];
async function reviewGate() {
  const repository = process.env.GITHUB_REPOSITORY, head = process.env.REVIEW_HEAD_SHA, token = process.env.GITHUB_TOKEN;
  const expectedCreator = process.env.NATIVE_REVIEW_STATUS_CREATOR_ID, expectedLogin = process.env.NATIVE_REVIEW_STATUS_CREATOR_LOGIN;
  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !head || !/^[a-f0-9]{40}$/.test(head) || !token || !expectedCreator || !/^[1-9][0-9]*$/.test(expectedCreator))
    throw Error("Exact native review head, repository, authenticated read and expected status creator are required");
  async function api(path) {
    const response = await fetch("https://api.github.com/repos/" + repository + "/" + path, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      redirect: "error"
    });
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
  await validateReceiptWithEvidence(receipt, head, commit.tree?.sha, repository, {
    readTree: async (treeSha) => api(`git/trees/${treeSha}?recursive=1`),
    readFile: async (path, ref) => api(`contents/${path}?ref=${ref}`)
  });
  console.log(JSON.stringify({
    schema: "agent-platform.native-review-ci.v1",
    headSha: head,
    receiptCommit,
    receiptSha256: sha(Buffer.from(content.content, "base64")),
    reviewedTreeSha: receipt.reviewedTreeSha,
    status: "pass"
  }));
}
if (false) {}

// education-entry:ci/native-review.entry.ts
await reviewGate();
