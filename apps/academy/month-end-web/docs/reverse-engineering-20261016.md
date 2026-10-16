# Independent source reconstruction · 2026-10-16

Historical prototype evidence. The user subsequently rejected that frontend as insufficiently grounded in their research context. The current implementation and source decisions are described in [the source-context entrypoint](../../month-end-workbench/docs/source-context.md). Earlier APK/static observations retain their original limits; this record is not current frontend acceptance.

This work follows the user's independent month-end source instruction. Academy remains read-only. Local commits are review artifacts; push, PR, merge and deployment await the user's later approval. No Harness changes, shared main edits, private database migration or final exam membership are part of this source change.

## Sources and reconstruction

- REA: `morluto/rea`, fresh main `781d5751ad18b25a1fe1ffa8c6035388be8c3283`, package 6.5.0. Built with the repository's supported `build:termux` TypeScript fallback after the standard compiler exceeded this host's memory. No REA source changes.
- Custom MCP: `park-kyungchan/academy-workbench`, main `6808c783457e73f8535b1e83ab7fcd82606e1b50`, isolated source/spec/synthetic-only checkout. Original private histories, credentials, student records and runtime stores were not copied.
- Preserved synthetic v21 JavaScript was analyzed with REA: evidence `ev_99f2dd5ae99af3b12f28f5bb100cfa42b5f3280a49b5ba96744c07f4497ffd0c`, one parsed JS file, 21,008 AST nodes, zero parse failures. Six files were outside this selected analysis; no complete application/runtime graph is claimed.
- The provided MagicPath file could not be inspected: the connected API reported exhausted quota, and the ordinary URL redirected to the homepage. The new frontend reconstructs repository-owned requirements and recorded visual preferences; original screen fidelity is unverified.

The resulting static frontend has no MagicPath runtime, remote design service, external fonts, accounts or API credentials. It reuses the Education assessment requirement and preselection analysis owners. Its eight synthetic examples demonstrate study, label exploration, desired-question description and preselection analysis. They are not Academy questions or a generated examination paper. A normal Pages artifact and a self-contained `dist/review.html` are built locally.

The confirmed user workflow is **type label first → review questions under that type → user decides final membership**. Type `pat_no`/`pat_name`, question `lecture_key`, historical paper identity and mobile `q_code` remain separate namespaces. The agent must not claim that the teacher has completed detailed type study.

## APK: bounded static REA analysis

The user-provided short URL resolved to `https://vod.studyq.net/pds/Gang-A_WIFI.apk`. Acquired artifact: 25,012,846 bytes, SHA-256 `ffc8850b8781d05267d4b2b912fbf80a60a34abf466f4b8110fd061f68ce87b5`. Package metadata: `com.otwoline.ganga`, version 7.7 / code 71, min SDK 15, target SDK 30; 3,225 decompiler class rows, 1,468 archive resources. Publisher authenticity and APK signature have not been verified. This is one supplied APK, not proof of the current installed release or a separate parent app.

REA used the repository-pinned JADX headless MCP 0.7.1 JAR (SHA-256 `6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75`) and an isolated JDK. The APK was not installed or executed. Thirty selected package/class/method observations plus package metadata were exported privately before ending the analysis session. Decompiled method observations retain representation and coverage; they are not runtime traces. APK bytes, decompiled source, possible embedded application keys and evidence bundles remain outside Git and public assets.

| Observed code path | Static evidence and implication |
| --- | --- |
| `LogingActivity.getCommandMemberCheck` | `ev_f84517cb51d41564b4ea479972df8fd72ee27c4ca63b433d8026f035b94ab50d`: constructs `http://www.gang-a.kr/servlet/controller.first.RegAppCommandServlet`, `getDeviceLoginCheckJsonData`, an academy subdomain and `parent=0`; runtime user ID/password/device values are Base64-encoded. Base64 provides no confidentiality. This historical app authentication path is not invoked or reused. |
| `LogingActivity.getCommandServerVersion` | `ev_ffabe1dd32b7ddb582c2fa85ee54dbe2fc6ca3bba4758458a7c77cf237aed194`: HTTP `application/server_data.html` version metadata request; not queried in this task. |
| `AsyncHttpRequestCommand.threadRun`, overload 1 | `ev_c843e0e9e16dff2b2b45b1078d8e760ae0fdffb1c2a6f68eb4b35516e36160cc`: Apache HTTP GET/POST transport and form-body construction. Declared requests are not evidence of completed requests. |
| `TestListFragment.getCommandTestList` | `ev_4bc5f9f0addecc22859e1a2b633634aa15d8801fdf01e1a44533f685843bd379`: HTTP `MobileRedirectServlet`, `request_servlet=first.RegAppCommandServlet`, `reqCmd=appTestingList`, runtime principal. No mobile endpoint was replayed. |
| `AnswerManager.parseExamInfoData` | `ev_67d113751a4ca6f4e2f15fdb1bd830cfca6d5e704a6d11aca8da6ecbde12c6e9`: reads `q_code`, `q_rank`, `answer_type`, `answer_counts`, `q_difficulty`, `score_mode`, `play_seconds`. Mapping `q_code` to web `lecture_key` remains unverified. |
| `CommDefine.getSharedLoginData` | `ev_6337574b866bfac55969ece7137e5f595c4a62a5c0afb812668fb394027115e3`: local `shared_test` SharedPreferences. No device profile or stored credentials were acquired. |
| Student/teacher exam views | Both `ExamActivity` and `TeacherExamActivity` contain answer-format presentation branches. Teacher classes in this APK do not identify a separate parent application. |

The APK and web sources refer to the Gang-A service family. **Shared physical database, shared schema, tenant isolation, parent-app identity and current mobile/server behavior remain unknown.** Common host names and similar question fields do not establish a shared database. No SQL connection or live database inspection occurred. The private MCP keeps the existing HTTPS fixed-origin teacher-principal qualification instead of adopting historical mobile HTTP or inferred cross-role access.

## Prior academy-workbench gaps

The historical seven operational gates in `migration/current-status.json` are preserved. This work improves specific source-owned parts without declaring those broader gates closed:

| Prior gate | Improvement here | Still required for the broader gate |
| --- | --- | --- |
| real_data | Actual TestPool hierarchy/type read contracts; exact namespaces, source hashes/clocks and partial coverage | Edition/unit decisions, full inventory and identity/semantic reconciliation |
| credential_setup | Supported native getter used inside its existing owner process; no credential/cookie export | Operational rotation/revocation, multi-user and browser authentication validation |
| private_storage | Explicit pinned local inputs; private evidence kept out of Git/public bundle | Approved operational storage/import design and access review |
| recovery | Process-local immutable observations and no business writes | Operational database/WAL backup, restore and migration tests |
| hosting | Design-service-independent Pages build and local browser review | User release approval, repository Pages configuration and published readback |
| scope_parity | Context-rich type discovery/comparison and bounded question review; adversarial source tests | Other attendance/consultation/Clinic/delivery workflows, real semantics and teacher acceptance |
| release_hash | Build/test receipts and local source commits | Final approved release tree, packaged hash and deployment evidence |

Backend evaluation is scoped to this workflow: DATA preserves exact IDs/text and unknown coverage; LOGIC holds comparison until teacher-reported study completion and explains lexical scores; ACTION admits only bounded source reads and no final selection; SECURITY/GOVERNANCE checks input pins, source scope/drift, owned credentials, serialized access and private/public separation. This is not an exhaustive security audit of all 95 historical operations or all mobile code.

## Local review references

Education's qualified TestPool source is committed locally as `e291a5b`. Custom MCP is committed locally on `work/month-end-item-labels-20261016` as `704d6433456df1d0d0cba66efeab2aa9c3ebae6a`, in this worktree's ignored `.private/source-refs/academy-workbench` source clone. Neither repository has been pushed. The dedicated MCP entry point is `tools/academy-mcp/src/label-server.ts`; its explicitly selected local bridge inputs remain private and are not part of a public frontend or global MCP registration.

[Live read verification](live-read-verification-20261016.json) records minimized counts/digests and the successful official-SDK-to-source flow. [Frontend verification](frontend-verification-20261016.json) records source/synthetic checks, isolated Chromium flows and the exact self-contained HTML digest. Source question images were checked in memory; no question image bytes were retained or included in the public artifact. No requested October unit, teacher study completion or final question selection was inferred from the engineering probe.
