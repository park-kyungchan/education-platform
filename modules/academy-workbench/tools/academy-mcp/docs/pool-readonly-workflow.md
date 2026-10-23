# Research-bound question-pool review

`src/pool-server.ts` is the dedicated pool MCP entry point. It does not initialize preserved student, DailyRecord or CISM services. It exposes only:

| Tool | Result |
| --- | --- |
| `academy_item_label_scope` | Exact original hierarchy and scoped unranked type labels. |
| `academy_find_item_labels` | Literal overlap retrieval after a truthful teacher-reported study state; no semantic probability. |
| `academy_review_type_questions` | One bounded original question page, raw difficulty/format metadata, answers and qualified preview references. |
| `academy_pool_source_contract` | Inert selector controls/options, column/formatter references, function literals, source ranges and qualification limits. |
| `academy_pool_question_content` | One exact previously exposed, source-qualified PNG, with byte hash and bounded structural validation. |
| `academy_review_candidate_set` | Pure review of a research-bound candidate proposal against the current allocation and evidence requirements. |
| `academy_prepare_paper_plan` | Pure fingerprinted metadata plan: exact selected IDs/variants, student d2 and teacher line. |
| `academy_verify_paper_preparation` | Pure comparison of a caller-reported prepared metadata projection against that plan. |
| `academy_verify_paper_output` | Pure comparison of caller-reported PDF/visual receipt metadata; no PDF or native transport. |

The [paper-preparation workflow](paper-preparation-workflow.md) keeps source acquisition, planning, native production, receipt review, delivery and acceptance separate. Its three tools accept no raw question rows, private native locators or printed content, and add no generation action.

## Confirmed assessment policy

These are the user's current preparation decisions, not conclusions inferred from source metadata:

| Research root | Original unit | Middle / High / Highest | Slots |
| --- | --- | --- | --- |
| `U-M` | `2-1 곱셈` | 4 / 3 / 1 | 8 |
| `U-D` | `2-2 나눗셈` | 4 / 2 / 2 | 8 |
| `U-C` | `2-3 원` | 4 / 3 / 1 | 8 |

The overall policy is middle `중`: 12 questions at 3 points; high `상`: 8 at 5 points; highest `최상`: 4 at 6 points, totaling 24 questions and 100 points. All questions must use constructed/descriptive responses. Native difficulty is still an original observation: qualify its raw code and meaning from the original selector before applying this scoring policy.

Use 24 distinct primary **research detailed type IDs**, covering important types broadly. Each slot receives 2–3 preferred/alternate options within that slot's type, for 48–72 candidate options. Native labels and research types retain separate namespaces. The teacher receives a 24-slot primary/alternate review with research mappings; no final paper membership is created by these tools.

## Evidence layers

- DATA preserves research revision/path/hash/pointer, exact native hierarchy, `pat_no`, `lecture_key`, source clocks and raw metadata. File-byte SHA-256 and the source owner's canonical-JSON-string digest are different representations; compare like with like.
- LOGIC records attributed mathematical-structure and required-solution-process comparisons, microstep references, differences and unknowns. A matching answer or label alone does not support a positive reasoning comparison.
- ACTION consists of bounded discovery, original-content inspection and candidate review. Research examples, official solutions and an assistant's derived solution are distinct evidence.
- GOVERNANCE retains current constraints, qualification, known unapplied corrections and proposal status. Neither test success nor a reviewable proposal establishes acceptance, teacher learning completion or final selection.

The immutable research source remains `math-research-module@07edb2dea2e5997aea4318f0fa2efa21dde633df`; shared Ontology remains `0.2.0`. Consume Education's `apps/academy/month-end-workbench/docs/source-context.md` and the authoritative owner context before changing assessment semantics.

## Local commands

From this package:

```sh
bun run check
bun run test:pool
bun run start:pool
```

No input starts a discoverable server whose source tools report unavailable. A retained label snapshot supports labels only. Explicit native bridge input remains available under the previous `--native-bridge` contract.

For a user-authenticated one-SSH invocation, compile the selected Education source reader with `jsdom` external, verify its raw SHA-256 and keep it in private operator storage. In the user's terminal:

```sh
bun src/native-pool-operator.ts \
  --reader /ABSOLUTE/PRIVATE/pool-reader.js \
  --reader-sha256 EXACT_READER_SHA256 \
  --socket /ABSOLUTE/PRIVATE/pool.sock \
  --ssh-target EXISTING_SSH_ALIAS \
  --container-name hermes-agent-2q3y-hermes-serve-1
```

The operator requires an existing canonical parent directory owned by the current user with mode `0700`. It opens one normal SSH connection with host-key checking, with password/TOTP entry through the user's terminal. It observes the current container incarnation, image, process, mounts, UID/HOME and Bun identity before serving reads. The exact compiled reader is streamed, not installed over the native checkout. The existing native getter keeps the Academy password and fresh cookies inside its owner container.

Configure the dedicated stdio MCP with:

```sh
bun src/pool-server.ts \
  --operator-socket /ABSOLUTE/PRIVATE/pool.sock \
  --reader-sha256 EXACT_READER_SHA256
```

The loader is lazy: tool discovery and pure proposal review work before operator authentication. Source reads require the explicit private socket, matching reader identity and original scope handles. Reads serialize; an authentication refusal requires new secure input and an explicit new operator invocation. No automatic reconnection is performed.

## Source qualification and limits

Selector code is read as inert data. Difficulty codes, response modes and image roles are not inferred from variable names. A variant named `obj`, `sbj` or `des` is not independently sufficient to classify a prompt or official solution. Current raw difficulty is preserved by the source protocol; use observed controls/formatters to qualify its meaning.

Images must come from an exact qualified reference returned for that exposed question. The content reader forwards no credentials, refuses redirects and validates bounded PNG container structure. It does not establish visual legibility, mathematical suitability or which reasoning a pupil used. Record original question and solution inspection separately.

Hierarchy and label pagination preserve exact source IDs. Exhaust a question page's `nextOffset` before its `nextPage`. Whole-pool completeness remains unknown without complete scoped observations. No arbitrary URL, source handler, generated question, save, use-log, print or send operation is exposed.

Synthetic tests and SDK discovery prove only their stated local scope. Native host authentication, current source metadata and real question-content behavior need separate receipts. REA static analysis of a shipped artifact does not establish authenticated pool behavior.
