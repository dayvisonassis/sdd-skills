---
name: evaluator
description: "Externally evaluates an already-implemented feature against its contract.md (environment, quality gates, coverage manifest, observable criteria), producing screenshots, a report, and chat findings. Owns the evaluation loop — keeps the attempt counter in progress.json, decides the state (CLEAN/FAIL/PENDING/ABORTED), and routes each failure: code failures (gate/observable) to fix-runner, test failures to the matching test-writer (then confirmed by the matching test-validator) before resuming. Loops until CLEAN, PENDING, or ABORTED."
---

# Evaluator

A second, independent layer of validation. After `implement-feature` finishes a feature, the `evaluator` looks at it **from the outside** and confirms — against `contract.md` — whether the delivery conforms. It finds deviations the implementer's self-check missed. It **does not fix code**; it evaluates and **orchestrates the correction loop**, dispatching `fix-runner` on failure.

> Base docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Skill_Evaluator.md` (full rationale),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Contrato_de_Feature.md` (contract structure),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Como_criar_gates.md` (gates),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Fluxo_SDD_e_Implementacao_das_Skills.md` (flow, states, progress.json schema).
> Report schema: `references/evaluation-report-schema.md`.

The evaluator complements automated tests — it does not replace them.

## INPUT

Free-form. The skill needs:

- **The target feature** (ID/name) — explicit and required. Abort if absent or ambiguous (list candidates).
- Auto-discovers: `progress.json` (root of `docs/`) and the feature's `contract.md` (in `docs/<feature-id>-<kebab>/`).
- Optional free-form overrides at the end — e.g. "no screenshots", "gates only", "max 5 attempts" (overrides `maxFixAttempts` for this run), "no exception: <finding>" (a human refused the gate exception `fix-runner` asked for; see the schema, "Gate exceptions").

If the feature has no `contract.md`, abort: "No contract.md for F<ID> — generate it with `spec-writer` first."

## OUTPUT

- **Screenshots** — visual evidence of observable UI criteria (when applicable).
- **Report** — consolidated ✓ / ✗ / — per contract criterion and gate.
- **Findings in chat** — textual summary for the user.
- **State in `progress.json`** — CLEAN | FAIL | PENDING | ABORTED for the feature.
- **On FAIL:** a structured `evaluation-report.json` in the feature folder, with each failure classified by `kind` (consumed by `fix-runner` for code, or a test-writer for tests).
- **Coverage-table dispute entries** — the only thing the evaluator writes in the writer's checklist: it opens a `disputed` entry when it disagrees with the writer, closes one that became moot and removes one that went stale (Disputes lifecycle, `../e2e-test-writer/references/e2e-rules.md`).
- The evaluator does **not** edit code or tests itself. Code corrections → `fix-runner`; test corrections → the matching test-writer (confirmed by the matching test-validator).

---

## EXECUTION STEPS

### Step 1: Resolve Input

- Resolve the target feature (ID/name). Abort if absent or ambiguous, listing candidates.
- Locate `progress.json` (root of `docs/`) and the feature's `contract.md`. If `contract.md` is missing → abort ("generate the contract first with `spec-writer`"). If `progress.json` is missing, create it with `config.maxFixAttempts` default 3.
- Parse any overrides (e.g. `max N attempts`, `gates only`, `no screenshots`, `no exception: <finding>`) and record them for the report. A `no exception` override sets `exceptionRefused` on the matching failure in every report this run writes.

### Step 2: Load Context

- Read `contract.md`: Environment Contract, Quality Gates (with `id`s), Coverage Manifest, Surfaces & Behaviors, Observable Criteria (with `id`s), Test-suite hint.
- Read `progress.json`: this feature's `state`, `attempt`, and `config.maxFixAttempts` (N).
- The contract is the **single source of acceptance criteria**. Do NOT invent criteria outside it.

### Step 3: Verify Environment Contract

- Check each environment prerequisite (runtime up, services reachable, tools available — e.g. dev server serving `/`, Playwright CLI present).
- If the environment is **not** satisfied → do NOT proceed to evaluation. Set `state: PENDING` (human/environment intervention needed), explain that this is an **environment** problem (not an implementation failure), and stop. Environment-invalid ≠ implementation-wrong.

### Step 4: Run Quality Gates

- Execute each gate declared in the contract (typecheck, lint, build, tests, arch...). Use the exact commands from the contract.
- Any gate failing is a contract violation. Collect the command + log as evidence.
- **Classify each failure by cause** (this drives the correction routing in Step 7):
  - The failure is a **code failure** (`kind: gate` or `observable-criterion`) when production code is wrong — a type error, lint/build/arch violation, or a missing observable behavior.
  - The failure is a **test failure** (`kind: test`) when the test itself is broken/non-conforming — e.g. the `tests` gate fails and the cause is the test file (missing/incorrect mock, wrong pattern, a test that no longer matches correct behavior), not the production code. For a `kind: test` failure, fill the routing fields (`testSuite`, `testFile`, `targetFile`) per `references/evaluation-report-schema.md`.
  - When ambiguous (a failing test that might reflect a real code bug), prefer `kind: gate`/`observable-criterion` and let `fix-runner` handle the code; only route to a test-writer when the test is clearly the thing that is wrong.
  - **A browser-gate failure (e2e or visual) has a third possible cause — the environment — and it is checked first.** A `429`, every case failing on the sign-in screen, the app not answering, or a dev server serving a stale bundle (its last build failed — read the dev server's log) is **PENDING (environment)**: neither `kind: test` nor `kind: gate`, no corrector is dispatched, and the evaluation stops as in Step 3. Only after the environment is ruled out classify the failure as test or code. For `kind: test` in an e2e file, also fill `targetSurface`.
  - **A red e2e test is not automatically a product failure.** With the environment ruled out, re-observe the behavior yourself (Step 5) against the contract line before classifying. A test with a `disputed` entry in the coverage table (matched by title **and** path) follows the **Disputes** lifecycle of `../e2e-test-writer/references/e2e-rules.md`: diverges → code failure as below; matches → PENDING for a human with both readings, never routed. The same lifecycle, applied here — from a run that included that test, made here when the gate's run did not — closes a disputed test that passed (moot, back as `unproven`), closes one whose contract line was changed, parks a skipped one as PENDING and removes the entry of one that no longer exists (stale). For any other red e2e test: the product diverges from the line → code failure: `kind: observable-criterion` with the criterion id as `ref` when the failing test carries a criterion tag, `kind: gate` with the e2e gate id otherwise — and put the failing test's path and the contract line in `location`/`message`, since a gate id alone tells `fix-runner` nothing. The product matches the line → the test is wrong: `kind: test`, with the contract line and your observation in `message`.
  - **A failing `tests/visual/` assertion that is itself wrong** (e.g. it measures mid-animation) belongs to no test-writer: record it as PENDING for a human, never as `kind: test` and never to `fix-runner` (see the schema).
  - **A gate exception is a human decision, even when its gate passes.** Treat each kind as the table in `references/evaluation-report-schema.md` ("Gate exceptions") says; that table is the one definition. In short:
    - every allowlist entry awaiting approval is an `exception-approval` item, whatever feature it names: the ones the gate's output lists, and the ones in the branch's diff of the allowlist file without the approval (read the file even when the contract does not declare that gate) (on the PABX, `raw-sql-backend` and `query-loop-backend` print them under `NEEDS HUMAN APPROVAL`);
    - every other gate exception in the branch's diff against the base goes at the top of Findings.

    Do not judge an exception acceptable yourself, and never route it to a corrector.
  - **A red query-growth test whose every repeated statement is a per-item query with an approved allowlist entry** is a test to adjust, not code to fix: `kind: test`, so the writer records the `per-item query allowlisted` outcome of `../integration-test-writer/references/pabx-rules.md`.
- (If `gates only` override is set, skip Step 5 and go to Step 6 with just gate results — except that a red e2e test, which cannot be classified without re-observing it, is then PENDING, never sent to `fix-runner` by default.)

### Step 5: Validate Surfaces & Observable Criteria

- For each surface in the Coverage Manifest, start from its declared initial state and exercise the concrete behaviors (e.g. navigate the route via Playwright CLI, capturing screenshots).
- **Exercising a write flow acts on records you create and remove afterwards, never on pre-existing data.** This is D1–D7 of `../e2e-test-writer/references/e2e-rules.md`, with the project's data policy from `GATES.md`, with or without the e2e harness — the dev database is shared. Create and remove them through the backend API with your browser session's own token (read from the live page, never from a storage-state file), or through the UI, and remove through the product's delete route, checking each status. When nothing your session can use removes what the flow creates, observe the flow up to the submit and record the rest as PENDING for a human.
- For each Observable Criterion, collect verifiable evidence (e.g. CTA present, login in top nav, redirect behavior, visual identity). A criterion with no observable evidence is a failure (`kind: observable-criterion`, `ref: <crit-id>`).
- **When the project has an e2e suite (`GATES.md` lists an e2e gate proven green)**, the e2e tests tagged with a criterion's id are part of its evidence. Get them from **one run per feature**, not one per criterion — every run costs the harness its logins against the auth rate limit. Reuse the run of Step 4 — the e2e gate's, or the feature run made there for a dispute — when it ran the feature's tests and its output can be mapped by tag; otherwise run once with the e2e config from `GATES.md` and `--grep "@<feature-id>(?![\w-])" --reporter=json`, and map the results by tag. Criterion ids repeat across features and `@F08` is a prefix of `@F08-v2`, so always pair the **anchored** feature tag with the criterion. The tests complement the screenshots, never replace the observation.
- **When the project has an e2e suite, missing e2e coverage is a failure — per row, not per surface.** Every row the contract's `Test-suite hint` maps to `e2e` must carry one outcome of the closed list in `../e2e-test-writer/references/e2e-rules.md` ("Coverage outcomes") in the writer's coverage table (`docs/<feature-id>-<kebab>/e2e-test.md`): test titles that exist, carry the feature and surface tags and are **not** marked `unproven`, or a `not e2e-testable` reason worded as that list words it. Check an accepted reason against the product before trusting it (a "no removal path" where a delete route exists is not one); an accepted reason makes that row yours to check by hand, like a `runtime-only` row, and it goes in Findings (the contract expected automation). "No removal path — harness lacks `<fixture>`" is an environment gap: PENDING, naming the fixture. `disputed` entries are arbitrated, closed or removed in Step 4, per the Disputes lifecycle; a row holding only open `disputed` entries awaits arbitration and is not missing coverage; the row's other tests still count. A row the writer marks `out of e2e scope — <suite>` (a computed value, say) is a mistake of the contract's mapping: record it as PENDING for a human, with the suite it belongs to — never route it back to the writer. A row with none of the outcomes above — including one marked `unproven` or carrying any other reason → `kind: test`, `testSuite: e2e`, `ref` = the e2e gate id, `targetSurface` = its surface, the behavior in `message`, no `testFile` — routed to `e2e-test-writer`, which runs in guard mode — whatever the stack: the writer is generic and reads the harness from `GATES.md`. When `GATES.md` does not declare what the writer needs (its e2e section names no profiles, and the harness reveals none), record it as PENDING for a human instead — routing it would only burn attempts.
- **When the project's gate documentation describes a query-growth (N+1) check**, every row the contract's `Test-suite hint` marks `integration — query growth` must have, in the integration writer's `.test.md` checklist, a growth test title or one outcome of the closed list in `../integration-test-writer/references/pabx-rules.md` ("Query growth — Scope and outcomes"). Check each row like an e2e reason, not by its presence:
  - a growth test title must exist in the suite and have **run** in this evaluation, green. A red one is a code failure, as in Step 4. The integration gate selects suites by name, so when its run did not include that suite, run the test by title once;
  - a `not measurable` outcome must hold against the code;
  - a `pre-existing N+1` outcome holds only when **neither** the loop **nor** the call that repeats is in the branch's diff against the base. Check both locations the outcome names. A loop the feature wrote around a legacy helper is the feature's N+1.

  A missing, unrun or false one → `kind: test`, `testSuite: integration`, `ref` = the integration gate id, `targetFile` = the endpoint's controller, the endpoint and what is wrong in `message`, routed to `integration-test-writer` and confirmed by its validator (Step 8). A `pre-existing N+1` outcome that holds goes in Findings, for the legacy migration.
- Map every PRD-derived acceptance back to a contract criterion/gate (the contract already did this traceability; honor it).

### Step 6: Decide State

Determine the feature's state strictly from contract adherence — never from "looks ok":

- **CLEAN** — no failures and nothing pending: all gates pass, all observable criteria met, `pending[]` empty. → record state, proceed to Step 9.
- **FAIL** — at least one **correctable** failure (gate/test/observable). Items in `pending[]` are not failures and do not make a FAIL. → go to Step 7 (loop).
- **PENDING** — no correctable failure left, and something the evaluator **cannot decide or test by itself** (needs a human, or an environment it cannot bring up), including any `pending[]` item. Step 7.4 also stops the loop as PENDING when `fix-runner`'s only answer is exception claims that hold. → record state with a note, proceed to Step 9.
- **ABORTED** — decided in Step 7 when attempts are exhausted.

List exactly which gates/criteria failed.

### Step 7: Correction Loop (when FAIL) — route by failure kind

- Read `attempt` and `maxFixAttempts` (N) from `progress.json`.
- **If `attempt >= N`** → set `state: ABORTED`; stop and report (the loop tried N times without converging). Proceed to Step 9.
- **Else:**
  1. Write/refresh `evaluation-report.json` in the feature folder (schema in `references/evaluation-report-schema.md`) with the current `attempt`, the classified `failures[]` and the `pending[]` items of this evaluation.
  2. Set `state: FAIL` in `progress.json` and persist the report path in `lastEvaluationReport`.
  3. **Route each failure by `kind`:**
     - **`kind: gate` / `observable-criterion` (code)** → **dispatch `fix-runner`**, passing the feature ID and the report path. Unchanged behavior — the on-disk report is the source of truth.
     - **`kind: test`** → run the **test-correction sub-flow (Step 8)** for that failure. Never send test failures to `fix-runner`.
  4. When the dispatched correction returns:
     - Correction applied → **increment `attempt`** in `progress.json`, then **re-evaluate**: go back to Step 3. **A signal that comes with a committed correction always increments**, whatever else it carries.
     - "not resolved — needs an allowlist decision: <why>" → **check every claim; do not take `fix-runner`'s word for it.** A claim holds only when all of these are true:
       - the finding it names is a finding of that gate, and it is not marked `exceptionRefused`;
       - the gate's section accepts an exception for that kind of finding (on the PABX, never for an `interpolated` or `dynamic` raw);
       - `<why>` names one of the categories the section accepts, and the code matches it.

       When the signal carries **only** claims, every one holds, and no other correction (a test-writer's, say) was applied in this round, **the loop stops**. Record one `exception-decision` item per finding, set **PENDING**, and go to Step 9, with no increment: a human decides next (schema, "Gate exceptions"). When the signal also carries a committed correction, increment and re-evaluate, as above; the claim returns on the next round if the finding is still there. A claim that does not hold turns the whole signal into an ordinary "not resolved", below.
     - "not resolved — <reason>" → still increment `attempt`; if `attempt >= N` set `ABORTED`, else re-evaluate. Do not loop without incrementing.
     - The two `e2e-test-writer` signals of Step 8 are the exceptions, handled there: no correction was applied, so they do not increment by themselves (a guard the writer adds is judged by its validator, as a new test).

The evaluator **owns** the counter, the limit N, and the ABORTED decision. Correction skills are stateless and never decide when to stop.

### Step 8: Test-correction sub-flow (`kind: test`)

For a test failure, correcting the code is the wrong move — fix the test, then re-confirm it
conforms. Select the suite from `testSuite`/`testFile` (deterministic rule in the schema):
`unit` → `unit-test-*`, `integration` → `integration-test-*`, `monorepo` → `monorepo-unit-test-*`,
`e2e` → `e2e-test-*`.

1. **Fix the test** — dispatch the matching **test-writer** in **correction mode** (autonomous),
   passing the feature ID, the `evaluation-report.json` path, `testFile`, and `targetFile`
   (for `e2e`, `targetSurface` instead; with no `testFile`, `e2e-test-writer` runs in guard mode
   and writes the missing test). It fixes only the flagged test (smallest footprint), never
   production code. `e2e-test-writer` may instead return one of two signals:
   - **"not resolved — product diverges from `<ref>`"** → do not take the writer's word for it.
     If it came with a test the writer wrote or changed, first run the validator on that file
     (step 2) — a test that does not conform is a spent attempt like any other — and on PASS
     come back here instead of resuming. Then re-observe the criterion yourself (Step 5) and
     compare with the contract line it quotes.
     - The product diverges → reclassify the failure as code with the same rule as Step 4
       (`kind: observable-criterion` with the criterion id as `ref` when the test carries a
       criterion tag, `kind: gate` with the e2e gate id otherwise, the test's path and the
       contract line in `location`/`message`), refresh the report, and dispatch `fix-runner`
       **in the same round** — the writer's round applied no correction, so it costs no
       attempt; the `fix-runner` round increments as in Step 7.4. A failure reclassified this way is never sent back to a test-writer in this
       evaluation, and a guard the writer kept red turns green when the fix lands.
     - The product does not diverge → you and the writer disagree — about what the contract
       means, or because the test itself is wrong in a way no static check sees. Record
       **PENDING** for a human with both observations and the contract line; do not re-dispatch
       the writer. **Open a dispute** on that test — a `disputed — <test title> (<path>) —
       <contract line>` entry replacing its title in the coverage table, per the Disputes lifecycle — and name the
       test first in the PENDING note; the next evaluations arbitrate it as in Step 4.
   - **"not resolved — environment: <which>"** (environment red, harness missing, or a stack the
     writer does not cover) → PENDING (environment), as in Step 3. No increment.
2. **Confirm conformance** — for any test the writer returned — corrected, new, or newly proven
   — dispatch the matching **test-validator** on that file (for `e2e`, also pass the
   `contract.md` and the writer's checklist, so the tags are checked against real ids). An environment signal skips
   this step: whatever tests it names are unproven — they stay marked `unproven` in the coverage
   table and count as missing coverage on the next evaluation (Step 5), where the writer proves
   them before anything relies on them.
   - Verdict **PASS** (or PASS WITH WARNINGS) → the test now conforms; **resume the evaluation
     where it left off** (re-run Step 3+ / the failing gate) and continue.
   - Verdict **FAIL** → the correction did not conform. Treat this round as a spent attempt:
     increment `attempt`; if `attempt >= N` → `ABORTED`; else loop (dispatch the test-writer again
     with the validator's findings, then re-validate). For a new e2e test, first set its path as
     `testFile` in the report, so the writer corrects that file instead of writing another.
3. When a test was corrected or written, only after the test-validator returns PASS does the
   evaluator continue its own evaluation.

> The test-writer/validator pair is a **sub-loop inside** the evaluator's main loop. It still
> consumes the single `attempt`/N budget — never iterate the sub-loop without incrementing.

### Step 9: Persist State & Report

- Write the final `state` (CLEAN | PENDING | ABORTED) and `updatedAt` for the feature in `progress.json`. Preserve `config` and other features' entries (merge, don't replace).
- On CLEAN, you may clear or keep `lastEvaluationReport` (a stale FAIL report should not imply a current failure — prefer clearing it).
- Output the report to chat:

```
Feature F<ID> — <name>

State: CLEAN | FAIL→(looped) | PENDING | ABORTED
Attempts used: <attempt> / <maxFixAttempts>

Quality gates:
✓ <gate-id> passed
✗ <gate-id> failed: <message> (<command>)

Observable criteria:
✓ <crit-id> — <evidence / screenshot path>
✗ <crit-id> — <what was missing>

Surfaces evaluated:
- <surface-id>: <result>

Environment:
✓ contract met  |  ✗ not met → PENDING (<which prerequisite>)

Findings:
- Uncommitted test files left by this evaluation's correctors, for the human to commit: <paths>
- <key deviations the evaluation found>

Next:
- CLEAN → feature ready for the next stage
- PENDING → needs human intervention: <what>
- ABORTED → tried <N> fixes without converging; see last evaluation-report.json
```

---

## RULES

**Always:**
- Treat `contract.md` as the single source of acceptance criteria.
- Abort the evaluation if the Environment Contract is not met, and say it is an environment problem (→ PENDING).
- Run the contract's Quality Gates as objective checks before/with functional inspection.
- Derive the state from contract adherence, with evidence per criterion.
- Own the loop: keep `attempt`/`maxFixAttempts` in `progress.json` and decide CLEAN/FAIL/PENDING/ABORTED.
- Classify each failure by kind and route it: `gate`/`observable-criterion` → `fix-runner`; `test` → the matching test-writer (then confirmed by the matching test-validator).
- Rule out the environment before classifying a browser-gate failure as test or code.
- Get e2e evidence from one run per feature, never one per criterion.
- After a `kind: test` correction, require the **test-validator PASS** before resuming the evaluation.
- Re-evaluate after each correction until CLEAN, PENDING, or ABORTED.
- Increment `attempt` once per correction round (code or test); never loop without incrementing.
- Treat every gate exception as the schema's "Gate exceptions" table says, never as fixed, failed or acceptable by your own judgement.

**Never:**
- Alter production code or "fix" the feature yourself — code corrections are the `fix-runner`'s job, test corrections are the test-writers' job.
- Send a `kind: test` failure to `fix-runner`, or a `kind: gate`/`observable-criterion` failure to a test-writer.
- Approve based on visual perception without running the objective gates.
- Evaluate a feature without a `contract.md`.
- Invent criteria not present in the contract.
- Exceed `maxFixAttempts` without marking ABORTED (the test sub-loop shares the same budget).
- Write `PENDING_EVALUATION` into `progress.json` — that is the implementer's pre-state; the evaluator writes CLEAN/FAIL/PENDING/ABORTED.
- Confuse an environment failure (PENDING) with an implementation failure (FAIL).

---

## Edge Cases

**No contract.md for the feature**: abort and direct the user to `spec-writer`.

**progress.json missing**: create it with `config.maxFixAttempts` = 3 and this feature's entry.

**Environment Contract not met**: state = PENDING, clearly labeled as environment, no fix-runner dispatch.

**Gate command not runnable in this environment** (e.g. missing toolchain): treat as PENDING for that gate (needs environment), not FAIL — do not send the fix-runner after an environment gap. Note it in the report.

**Browser-gate run (e2e or visual) red for a harness reason** (login rate limit `429`, sign-in screen on every case, stale bundle, app down): PENDING (environment). Do not re-run it in a loop to "see if it passes" — each run spends logins against the same limit that caused the failure.

**maxFixAttempts reached**: state = ABORTED; keep the last `evaluation-report.json` for inspection.

**fix-runner reports "not resolved"**: increment `attempt`; abort to ABORTED if the limit is hit, otherwise re-evaluate. The exception is a signal made only of claims that hold: it stops the loop as PENDING, with no increment (Step 7.4).

**After a human decided an `exception-decision`**: an added and approved entry makes the gate green on the next evaluation. A refusal comes back as the override `no exception: <finding>`, and that failure then goes to `fix-runner` marked `exceptionRefused`.

**Override `max N attempts`**: use N for `maxFixAttempts` this run (and persist it to `config` if the user intends it to stick — otherwise apply for the session only and note it).

**Observable criterion is runtime-only and the runtime can't be exercised**: PENDING for that criterion (human/environment), not FAIL.

**Feature already CLEAN in progress.json**: re-running is allowed (idempotent re-check); report the result and refresh state.

**Cross-feature criteria**: if the contract references behavior provided by another feature, evaluate only this feature's surface; note cross-feature dependencies in findings rather than failing on another feature's gap.
