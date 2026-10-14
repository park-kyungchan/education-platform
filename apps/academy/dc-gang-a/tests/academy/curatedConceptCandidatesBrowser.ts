import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createTeacherServerHandler } from "../../src/academy/server";
import {
  createCuratedConceptCandidateAccess,
  curatedConceptSnapshotSha256,
} from "../../src/academy/curatedConceptCandidates";
import type { TeacherApplication } from "../../src/academy/application";

const output = process.env.DC_CURATED_CATALOG_BROWSER_OUTPUT;
if (
  !output ||
  !resolve(output).includes("/.local/reorganization-kickoff/current-session/")
)
  throw Error("task_local_browser_output_required");
mkdirSync(output, { recursive: true, mode: 0o700 });
const keyFile = resolve(output, "synthetic-tls-key.pem"),
  certFile = resolve(output, "synthetic-tls-cert.pem");
assert.equal(
  Bun.spawnSync(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
      "-keyout",
      keyFile,
      "-out",
      certFile,
    ],
    { stdout: "ignore", stderr: "pipe" },
  ).exitCode,
  0,
);
const build = await Bun.build({
  entrypoints: [
    resolve(import.meta.dir, "curatedConceptCandidatesBrowserEntry.ts"),
  ],
  target: "browser",
  format: "esm",
});
assert.equal(build.success, true);
const script = await build.outputs[0]!.text();
const bytes = readFileSync(
  new URL(
    "../../data/curated-concepts/elementary-2022-candidates.json",
    import.meta.url,
  ),
);
const actor = {
  ownerId: "synthetic-browser-catalog-owner",
  actorId: "synthetic-browser-catalog-teacher",
};
const password = "synthetic-browser-only-password-0123456789",
  sessionKey = "synthetic-browser-only-session-key-0123456789";
let held = false,
  teacherWrites = 0,
  sourceReads = 0;
const requests: { method: string; path: string }[] = [],
  errors: string[] = [],
  blockedExternalRequests: string[] = [];
const app = {
  ownerId: actor.ownerId,
  saveConceptDefinition: async () => {
    teacherWrites++;
    throw Error("unexpected_teacher_write");
  },
  saveStudentConceptLink: async () => {
    teacherWrites++;
    throw Error("unexpected_link_write");
  },
} as unknown as TeacherApplication;
let handler: ReturnType<typeof createTeacherServerHandler>;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { key: Bun.file(keyFile), cert: Bun.file(certFile) },
  fetch: (request) => {
    requests.push({
      method: request.method,
      path: new URL(request.url).pathname,
    });
    return handler(request);
  },
});
const origin = "https://127.0.0.1:" + server.port;
handler = createTeacherServerHandler({
  app,
  origin,
  sessionKey,
  identity: {
    actorId: actor.actorId,
    username: "synthetic-browser-teacher",
    passwordHash: await Bun.password.hash(password),
  },
  invitationDigest: null,
  saveIdentity: async () => {
    throw Error("unexpected_auth_write");
  },
  script,
  page: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic candidate catalog verification</title><style>body{font:16px sans-serif;max-width:1100px;margin:30px auto;padding:16px;line-height:1.7}details{border-top:1px solid #bbb;padding:10px}small{display:block;overflow-wrap:anywhere}button{padding:12px}input{display:block;margin:10px}summary{cursor:pointer}.concept-node{margin:8px 0}</style><form id="synthetic-login"><label>교사 계정<input name="username"></label><label>비밀번호<input name="password" type="password"></label><button>로그인</button></form><p id="manual-flow-marker">기존 교사 작성 정의는 별도 흐름으로 보존됩니다.</p><main id="candidate-mount"></main><script type="module" src="/client.js"></script></html>',
  curatedConceptCandidates: createCuratedConceptCandidateAccess(
    actor.ownerId,
    () => {
      sourceReads++;
      if (held) throw Error("synthetic_missing_source");
      return bytes;
    },
  ),
});
const browser = await chromium.launch({ headless: true }),
  context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1365, height: 900 },
  }),
  page = await context.newPage();
const cases: string[] = [],
  screenshots: string[] = [];
try {
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (!url.startsWith(origin + "/")) {
      blockedExternalRequests.push(url);
      await route.abort();
    } else await route.continue();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  assert.equal(
    (
      await context.request.get(origin + "/api/curated-concept-candidates")
    ).status(),
    401,
  );
  assert.equal(sourceReads, 0);
  await page.goto(origin);
  await page.getByLabel("교사 계정").fill("synthetic-browser-teacher");
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const section = page.locator("#curated-concept-candidates-workspace");
  await section.waitFor();
  assert.equal(sourceReads, 0);
  await section
    .getByRole("button", { name: "개념 후보와 출처 보기", exact: true })
    .click();
  await section
    .getByRole("status")
    .filter({ hasText: "정의 후보 52개" })
    .waitFor();
  assert.equal(await section.locator("[data-band-domain]").count(), 12);
  assert.equal(await section.locator("[data-candidate-id]").count(), 52);
  assert.equal(await section.locator("form,input,textarea,select").count(), 0);
  assert.equal(await section.locator("button").count(), 1);
  assert.match(
    await section.getByRole("status").innerText(),
    /121개 중 59개.*미연결 62개.*검토 미확정/,
  );
  assert.equal(teacherWrites, 0);
  cases.push(
    "real HTTPS login plus actual handler GET and maintained component expose 52 unknown candidates across 12 cells with no write action",
  );
  await section.locator("[data-role=curated-catalog-gaps]>summary").click();
  const unmapped = await section
    .locator("[data-role=unmapped-standard-codes]")
    .innerText();
  assert.equal(unmapped.split(" · ").length, 62);
  cases.push("all 62 unmapped official codes visible on explicit disclosure");
  await section
    .locator('[data-band-domain="1-2/number-and-operations"]>summary')
    .click();
  await section
    .locator('[data-candidate-id="zero-cardinality"]>summary')
    .click();
  const candidate = section.locator('[data-candidate-id="zero-cardinality"]');
  assert.match(await candidate.innerText(), /record 1637.*byte 77066/);
  assert.match(await candidate.innerText(), /물리적 쪽수 미확인/);
  assert.match(await candidate.innerText(), /SHA256 aab8eed/);
  assert.match(await candidate.innerText(), /출판사·교재 배치: 미확정/);
  assert.equal(
    await candidate.getByRole("link").first().getAttribute("href"),
    "https://www.moe.go.kr/boardCnts/fileDown.do?m=0404&s=moe&fileSeq=1512facbda6c234a1641ac7e9c156ca2",
  );
  cases.push(
    "official edition, HWP binary record locator and source SHA shown without invented physical page or publisher placement",
  );
  const readyShot = resolve(output, "candidate-catalog-ready.png");
  await page.screenshot({ path: readyShot, fullPage: true });
  screenshots.push(readyShot);
  for (const query of [
    "?studentId=synthetic-foreign",
    "?ownerId=synthetic-foreign",
    "?edition=unknown",
  ])
    assert.equal(
      (
        await context.request.get(
          origin + "/api/curated-concept-candidates" + query,
        )
      ).status(),
      400,
    );
  for (const method of ["POST", "PUT", "DELETE"])
    assert.equal(
      (
        await context.request.fetch(
          origin + "/api/curated-concept-candidates",
          { method, headers: { Origin: origin } },
        )
      ).status(),
      405,
    );
  held = true;
  await section
    .getByRole("button", { name: "개념 후보와 출처 보기", exact: true })
    .click();
  await section
    .getByRole("status")
    .filter({ hasText: "출처와 버전을 확인하지 못했습니다" })
    .waitFor();
  assert.equal(await section.locator("[data-candidate-id]").count(), 0);
  assert.equal(
    await page.locator("#manual-flow-marker").innerText(),
    "기존 교사 작성 정의는 별도 흐름으로 보존됩니다.",
  );
  cases.push(
    "source hold clears candidate content and preserves independent manual teacher flow marker without cached success",
  );
  const heldShot = resolve(output, "candidate-catalog-held.png");
  await page.screenshot({ path: heldShot, fullPage: true });
  screenshots.push(heldShot);
  held = false;
  await section
    .getByRole("button", { name: "개념 후보와 출처 보기", exact: true })
    .click();
  await section
    .getByRole("status")
    .filter({ hasText: "정의 후보 52개" })
    .waitFor();
  assert.deepEqual(errors, []);
  assert.deepEqual(blockedExternalRequests, []);
  assert.equal(teacherWrites, 0);
  assert.equal(
    requests.some(
      (row) =>
        row.path === "/api/concept-definition" ||
        row.path === "/api/concept-link" ||
        row.path === "/api/refresh",
    ),
    false,
  );
  const screenshotPins = screenshots.map((path) => ({
    path,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  }));
  const report = {
    schema: "academy.curated-concept-candidate-browser-verification.v1",
    actor: "/root/integrated_program_context",
    observedAt: new Date().toISOString(),
    classification: "ordinary-engineering-synthetic-HTTPS-and-real-browser",
    result: "PASS",
    origin,
    viewport: { width: 1365, height: 900 },
    browser: await browser.version(),
    snapshotSha256: curatedConceptSnapshotSha256,
    cases,
    screenshots: screenshotPins,
    requests,
    errors,
    blockedExternalRequests,
    teacherWrites,
    studentLinksCreated: 0,
    sourceAcquisition: 0,
    databaseAccess: 0,
    privateStudentDataUsed: false,
    nativeRuntimeEffects: 0,
    modelEvaluationRequests: 0,
    semanticAcceptance: "unknown",
    limits:
      "Exact maintained candidate component and actual handler tested in an isolated synthetic page; whole deployed teacher UI and actual teacher acceptance are not established",
  };
  writeFileSync(
    resolve(output, "browser-verification.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
  await server.stop(true);
}
