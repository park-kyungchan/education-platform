import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), "utf8"));
}

test("foundation fixes the source-independent TypeScript and Node boundary", async () => {
  const packageJson = await readJson("package.json");
  const tsconfig = await readJson("tsconfig.json");
  const agents = await readFile(new URL("AGENTS.md", root), "utf8");

  assert.equal(packageJson.name, "mathematics-cartography");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.packageManager, "npm@11.17.0");
  assert.deepEqual(packageJson.devDependencies, { typescript: "7.0.2" });
  assert.deepEqual(Object.keys(packageJson.devDependencies), ["typescript"]);
  assert.equal(packageJson.scripts.verify, "npm run typecheck && npm test");

  assert.equal(tsconfig.compilerOptions.strict, true);
  assert.equal(tsconfig.compilerOptions.noUncheckedIndexedAccess, true);
  assert.equal(tsconfig.compilerOptions.exactOptionalPropertyTypes, true);
  assert.equal(tsconfig.compilerOptions.noEmit, true);

  assert.match(agents, /academy-independent Mathematics Cartography/);
  assert.match(agents, /Model output is proposal-only/);
  assert.match(agents, /Bun is deferred/);
  assert.match(agents, /Rust is deferred/);
  assert.match(agents, /PROJECT_FOUNDATION_VERIFIED_NO_DOMAIN_IMPLEMENTATION/);

  for (const forbidden of ["@osdk", "@palantir", "bun-types", "napi-rs"]) {
    assert.equal(JSON.stringify(packageJson).includes(forbidden), false);
  }
});

const foundationStopToken = "PROJECT_FOUNDATION_VERIFIED_NO_DOMAIN_IMPLEMENTATION";
const offlineRestoreCommand =
  "npm_config_offline=true npm_config_audit=false npm ci --ignore-scripts";

test("status contract separates foundation, reviewed R9, and Human authority", async () => {
  const agents = await readFile(new URL("AGENTS.md", root), "utf8");
  const readme = await readFile(new URL("README.md", root), "utf8");

  assert.equal(agents.split(foundationStopToken).length - 1, 1);

  const historicalStart = agents.indexOf("## Historical foundation entry gate");
  const currentStart = agents.indexOf("## Current checkpoint and stop condition");
  assert.ok(historicalStart >= 0);
  assert.ok(currentStart > historicalStart);

  const historicalSection = agents.slice(historicalStart, currentStart);
  assert.match(historicalSection, /explicitly satisfied/);
  assert.match(historicalSection, new RegExp(foundationStopToken));
  assert.doesNotMatch(agents.slice(currentStart), new RegExp(foundationStopToken));

  for (const statusDocument of [agents, readme]) {
    assert.match(
      statusDocument,
      /INTERVIEW_AND_TDD_FRAGMENT_EVIDENCE_REVIEW_PACKET_001-R9/,
    );
    assert.match(statusDocument, /proposal-only/);
    assert.match(statusDocument, /REVIEWED_PASS_UNCOMMITTED/);
    assert.match(statusDocument, /REVIEWED_PASS_COMMITTED_LOCAL_NO_PUSH/);
    assert.match(statusDocument, /humanDecision=PENDING/);
    assert.match(statusDocument, /canonicalApplication=NOT_PERFORMED/);
    assert.match(
      statusDocument,
      /Human disposition and canonical application remain separate/,
    );
    assert.ok(statusDocument.includes(offlineRestoreCommand));
  }
});
