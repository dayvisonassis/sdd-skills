---
name: e2e-test-writer
description: Use when a feature needs end-to-end tests (Playwright flows against the running app) for any project whose GATES.md declares an e2e suite, when implement-feature/evaluator/qa-preflight dispatch e2e coverage, a correction of a failing e2e test, or a guard for a missing flow, or when a user asks to plan or write e2e tests for a contract's UI surfaces. Generic — the profiles, folders, language, fixtures and data policy come from the project's GATES.md, never from another project. Never modifies production code nor the e2e harness.
---

# E2E Test Writer

Plan and implement **end-to-end tests** that drive the running app through a real browser: a
user acts on the screen and the test asserts what observably follows. **Never modifies
production code, the e2e harness, or the visual suite** — if a test fails, only the test is
adjusted, and only when the test is what is wrong.

> **The project defines the harness; this skill defines the discipline.** All hard rules
> (project profile, boundary, harness, structure, session, assertions, data, coverage outcomes,
> execution) are in **`references/e2e-rules.md`** — read it before writing. Its first section
> tells you what to read from the project's `GATES.md`: profiles, folders, test language,
> fixtures, API origin, build log, gate and data policy.
> Mechanics for exploring a live flow and turning actions into code come from the
> `playwright-cli` skill: `../playwright-cli/references/spec-driven-testing.md` and
> `../playwright-cli/references/test-generation.md`. **Where they conflict with
> `e2e-rules.md`** (one test per file, `specs/*.plan.md`, a seed that logs in), **`e2e-rules.md`
> wins.**
> Generic SDD flow docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/GUIA_DO_WORKFLOW.md`.

**Scope:** the e2e test directory the project profile names — one folder per profile.

## INPUT

- `feature` (required when a contract exists) — the feature folder's id (`F14`, `F08-v2`); locates `docs/<feature-id>-<kebab>/contract.md`.
- `target` (required) — what to cover: contract surface ids (`UI-02`), criterion ids (`OC-08`), or a route for work outside a contract (then the route's slug stands in for the surface id in the file name and tags — rule S1). A report's `targetSurface` is a surface id optionally followed by its route (`UI-01 /orders`, or `UI-02` alone), or a route alone when there is no contract. When the caller names specific behaviors, only those are in scope; otherwise every flow behavior of the surface is.
- `mode` (optional) — `interactive` (default when a user calls) or `autonomous` (set by implement-feature/evaluator/qa-preflight).
- `test_file_path` / `profile` (any profile the project profile declares) / `batch_size` (optional; default 4, up to 5).
- `evaluation_report` (optional) — its `kind: test` entry selects the mode: an existing `testFile` → **correction mode**; a `testFile` that does not exist yet, or none → **guard mode**.

## OUTPUT

- New/expanded spec files under `<testDir>/<profile>/`, in the project's test language, each test tagged per rule S3.
- A checklist `docs/<feature-id>-<kebab>/e2e-test.md` (in the project's documentation language; test code follows rule S4) whose **coverage table** gives every row of the contract's `Test-suite hint` mapped to `e2e` an outcome from **the closed list in `e2e-rules.md` ("Coverage outcomes")** — rows this dispatch covers get their result, rows it does not touch keep what a previous dispatch wrote (or `not in this request` when new), and **no `disputed` entry is ever removed by the writer** (only the `evaluator` closes a dispute). The `evaluator`, `implement-feature` and the validator reject anything else. Without a feature, next to the spec with the same basename and `.e2e-test.md`.
- Per-batch execution result.
- **One signal to the caller**, always one of: *done* (paths); **"not resolved — product diverges from `<ref>`: <observed>"** (with the path of every new test kept red); **"not resolved — environment: <which>"** (environment red, harness missing or undeclared, a runner this skill does not cover, or tests written whose two proving runs could not happen — with their paths, marked unproven).
- Production code, the harness and the visual suite untouched.

---

## Invocation Modes

**Interactive (default):** full 3-phase process, **stop at the Phase 2 checkpoint** for explicit approval.

**Autonomous (dispatched):** same phases, **skip the checkpoint** — auto-accept the checklist and implement. Never pause.

**In every mode, a new test that is red with the environment green and right against its
reference is kept**, and the signal is "not resolved — product diverges" with its path. Its
reference is the contract line — or, for a QA finding, the QA case's expected result, which the
report carries in `message`. Never bend a new assertion to go green (V8): a red test that is
right is the finding.

**Correction mode (evaluator, `kind:test`, existing `testFile`):** fix **only** the flagged test
so it conforms to `e2e-rules.md` and passes — **when the test is what is wrong**. If the product
is what is wrong, return that instead of editing the assertion (Phase C).

**Guard mode (qa-preflight or evaluator, `kind:test`, no existing `testFile`):** the report names
a flow that has no test yet — a QA finding to guard, or a row of the contract's `Test-suite
hint` with no tagged test. Run Phases 1–3 autonomously for the behaviors the report names (or
every flow behavior of `targetSurface` when it names none). When the coverage table already
lists a test for the behavior marked `unproven`, prove that test (Phase 3) instead of writing
another. A guard written against a defect is supposed to come back red until the fix lands —
see the rule above.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Analysis & Planning
1. Read the e2e section of `GATES.md` and build the **project profile** (`e2e-rules.md`, first section). A required item missing from both `GATES.md` and the harness files → return **"not resolved — environment: e2e harness not declared (<item>)"**. A runner other than `@playwright/test` → **"not resolved — environment: runner not covered (<runner>)"**.
2. Confirm the harness exists (rule H1). Missing → **"not resolved — environment: e2e harness not built (<piece>)"**.
3. Environment preflight (rule E2): frontend answers, backend answers, **the dev server's last build succeeded** (read the build log the profile names). Any failure → **"not resolved — environment: <which>"**.
4. Read the contract: the target surfaces (initial state, behaviors), the observable criteria, the test-suite hint, the Environment Contract (declared seed data). Keep the in-scope behaviors that are **flows**; list the rest as out of scope with the suite they belong to (Boundary table).
5. Read the existing suite for helpers and to avoid duplicating a flow already covered. **An existing test on the target surface that breaks the rules** (logs in, writes on pre-existing data, skips on missing data) is not yours to fix outside correction mode: name it, with the rules it breaks, in your report and in the checklist. It does not count as coverage for its row ("Coverage outcomes").
6. Explore each flow live with `playwright-cli`, **through a harness run** — `--config <config> --debug=cli` on a test of the right profile (its seed, for instance), then `attach` — so the stored session is reused, never a fresh login. **A write flow is explored under rule D6.** Note the locators, the requests each action fires and the shape of each response the test will read. When something cannot be explored, keep each assumption in one place in the spec (a helper that fails loudly) and list it in the checklist.
7. For every flow that writes: what it creates (parents before children), what pre-existing configuration it only references, which API fixture removes it, and through which delete route (D1–D5, the data policy). For every precondition it cannot create: where it is declared (D7).

### Phase 2 — Checklist Creation
One row per behavior: contract id, profile, precondition data (existing and declared, or
created by the test), action, observable result, request assertion (V6), cleanup and its
fixture. A flow that cannot be e2e gets a `not e2e-testable` outcome, and a behavior that is not
a flow at all (a computed value, a theme) gets `out of e2e scope — <suite>` — both **only as the
closed list in `e2e-rules.md` words them**; any other wording is rejected downstream and burns an
attempt. Such rows stay with the evaluator or the human QA.
- **Interactive:** ask — is every flow behavior covered? does any test write without a removal path? is any filter validated with data in which it cannot fail? → **WAIT for approval.**
- **Autonomous / correction / guard:** skip the checkpoint; proceed.

### Phase 3 — Batch Implementation
GROUP up to 5 tests per batch (same surface and profile) → IMPLEMENT per `e2e-rules.md` →
**prove each new test can fail**: in **every** new test invert the expectation on **the result of
the action** — not a precondition — and run the batch once, confirming each is red at that line →
restore and run the batch once more (two runs per batch, never one per test — rule E3). A guard
against a defect still present flips the other way — inverted green, restored red — and that is
its proof. → UPDATE the checklist and its coverage table (a test whose two runs could not happen
stays `unproven`) → REPEAT.

### Phase C — Correction mode
1. Read the report's `testFile`, `targetSurface`, `message`, `evidence`.
2. Re-check the environment (E2/E3). A stale bundle, a `429` or every case on the sign-in screen → return **"not resolved — environment: <which>"**; do not touch the test.
3. Run only the failing test with `--config <config> --debug=cli`, attach, and diagnose.
4. Decide, and act on exactly one:
   - **The test is wrong** (selector drift, timing, wrong expectation against the contract, leaked data) → fix the smallest footprint, run it, return *done*. If the fixed test is still red and the product is what diverges, return "product diverges" instead (the rule under Invocation Modes).
   - **The product diverges from the contract** → return **"not resolved — product diverges from `<ref>`: <observed>"**, quoting the contract line, so the caller re-routes it as code. Never weaken the assertion (rule V8).

---

## RULES

**Always:**
- Build the project profile from `GATES.md` before anything else, and follow `references/e2e-rules.md` exactly.
- Put each flow in the folder of the profile whose session it needs, in the project's test language, importing from the fixtures module.
- Tag every test per S3; every e2e row of the test-suite hint carries an outcome of the closed list, and `disputed` entries are left as they are.
- Reuse the harness sessions and API fixtures; spend runs per rule E3 — two to prove a batch, one to verify a feature, never one per test.
- Create the test's own records, parents before children, one test-scoped fixture per record, and remove them through the product; cleanup always runs and fails loudly.
- Write test names, comments and variables in English; match product copy verbatim in locators and assertions.
- Format the files you write the way the project's instructions say (its formatter and style).
- End with exactly one of the three signals in OUTPUT.

**Never:**
- Modify production code, the harness (config, global setup, seed tests, fixtures module and what only they import) or the visual suite.
- Take a profile, folder, fixture name or data rule from another project or from memory instead of the project profile.
- Log in inside a test, hook or fixture, read a storage-state file directly, forge a session, or bypass an anti-bot check.
- Submit a write flow against pre-existing data — in a test or while exploring.
- Skip on missing data, validate a filter with data in which it cannot fail, or bend an assertion — existing or new — to match the screen.
- Add retries, sleeps, `waitForTimeout` or `networkidle`, or mock the happy path.
- Measure computed styles or boxes — that is the visual suite's job.
- Touch the database directly (SQL, ORM, database client, database MCP).
- Pause for approval in autonomous, correction or guard mode.

---

## Edge Cases

- **`GATES.md` has no e2e section, or it lacks a required item the harness does not reveal either:** "not resolved — environment: e2e harness not declared (<item>)". Declaring it is the `gate-builder` e2e gate type's job.
- **Harness missing, or the API fixture a write flow's setup needs is missing:** the first is "not resolved — environment: e2e harness not built (<piece>)"; the second puts that flow under D5 — report the gap. Building either is the `gate-builder`'s job.
- **`GATES.md` says the e2e gate is not proven green yet:** the project has no e2e suite for the SDD skills; write only when a user asks directly, and say the tests cannot be proven until the gate is.
- **Environment red** (stale bundle, `429`, sign-in screen, app unreachable): "not resolved — environment: <which>".
- **The contract's test-suite hint predates the e2e suite** and maps a flow to the visual suite: follow the Boundary table, write the e2e test, note the old hint in the checklist, leave the visual suite alone.
- **The behavior is a computed value** (contrast, height, density): `out of e2e scope — <visual gate id>` in the coverage table, or `out of e2e scope — runtime-only` when the project has no visual suite.
- **A hint row mapped to a suite other than e2e:** not in the coverage table.
- **A precondition no route can create:** read it from declared data (D7), or `not e2e-testable — no creation path`.
- **A date-relative precondition** (records "older than 7 days, this month"): pick a starting state that holds on any day, and flag the contract line in the checklist when none does.
- **Work without a feature** (a route outside any contract): no feature tag exists; the route's slug stands in for both the surface id and the feature tag (S1, S3).
- **The target file belongs to the visual suite:** out of scope — report it; do not migrate it.
- **A person watches an exploration session headed:** follow the project's instructions for smoke tests (a theme to start with, say).
- **> ~20 tests in one run:** redirect the reporter output to a file to avoid AI disconnections.
- **Called autonomously and the checklist reveals an ambiguity:** apply a best-practice default, note it in the checklist, and proceed.
