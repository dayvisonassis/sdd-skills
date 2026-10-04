---
name: e2e-test-validator
description: Use when an end-to-end test file or folder (Playwright flows of any project whose GATES.md declares an e2e suite) must be audited for conformance before it is trusted — dispatched by the evaluator or qa-preflight after an e2e-test-writer correction, guard or new test, or run directly by a user. Generic — reads the project's profiles, folders, language, fixtures and data policy from its GATES.md. Read-only — never writes, fixes or runs tests.
---

# E2E Test Validator

Audit **end-to-end test files** to ensure they comply with every rule the `e2e-test-writer`
enforces. **Read-only:** produce a compliance report; never modify test, harness or production
files, never execute tests (static analysis only).

> The full rule set is in **`../e2e-test-writer/references/e2e-rules.md`** — validate against it.
> Build its **project profile** from the project's `GATES.md` first: it says which profiles,
> folders, test language, fixtures and data policy the rules apply to here.

**Scope:** the project's e2e test directory. Out of scope, reported as such: the visual suite, and
the harness's own files — the runner config, the global setup, the seed tests, the fixtures module
and any module imported only by them (a sessions helper, say), as the e2e section of `GATES.md`
names them. A harness-like file shipped **with a feature's tests** (its own config, global setup,
or a support module shared between spec files) is not out of scope: it is a CRITICAL H2 violation.

## INPUT

- `test_file_path` (required) — test file or directory.
- `checklist_file_path` (optional) — the `e2e-test.md` for coverage cross-reference; when absent, look for `docs/<feature-id>-*/e2e-test.md` from the files' feature tag.
- `contract_path` (optional) — the feature's `contract.md`, to check that tags name real ids; when absent, look for `docs/<feature-id>-*/contract.md` from the feature tag. Ids repeat across features: never check a tag against another feature's contract.
- `severity_filter` (optional) — `critical` | `major` | `minor` (default: all).

## OUTPUT

A **compliance report** (English): the project profile it applied (a few lines), summary counts,
overall verdict — `PASS` = 0 critical and 0 major (minors are listed, not counted against it);
`PASS WITH WARNINGS` = 0 critical and ≥1 major; `FAIL` = ≥1 critical — each violation
(`[SEVERITY] Rule-ID`, location, description, expected, found, fix), traceability analysis, and
positive findings. When dispatched, the **verdict** is the signal the caller consumes.

**Directory input:** one report per file, then a summary. A finding about the feature rather than
a file (a missing checklist) is reported once, in the summary, and counted once. Several places
breaking the same rule in one file are one finding with every location listed — one per severity
when the rule has two (V2, V3).

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Structural Analysis
Build the project profile from `GATES.md` (and the harness files for its fallbacks). Inventory
`describe`/`test`/hooks/fixtures (and their scope and dependencies)/helpers and each test's tags.
Map checklist ↔ tests and contract ids ↔ tags. Identify every navigation, action, assertion,
request capture, `page.route` mock, API call (its URL base and whether its status is checked),
data-creation point and cleanup point. Note the file's path (which profile folder), its
language and its imports.

### Phase 2 — Rule-by-Rule Validation
Check EVERY rule from `../e2e-test-writer/references/e2e-rules.md`:
- **Forbidden Practices** [CRITICAL] — `waitForTimeout`, fixed sleeps or `networkidle` (V2); `retries` or `describe.configure({ retries })` (E4); a mocked happy path (V7); a filter validated only by an empty result (V5); a test with no action, load-only (V1); computed-style or box measurement (Boundary); creating or editing production code, the harness or the visual suite (H2); direct database access — SQL, ORM, database client (D2); `test.describe.serial`, state carried between tests, or a data-creating fixture that is not test-scoped (S5); acting on an item whose identity the test does not know — whatever renders first (`nth-child`, `.nth(n)`, `getByRole('option').first()`) — or XPath (V3). Choosing an item from data (a record the test created, an entry of a captured response) and acting on it by name or id is correct.
- **Traceability & placement** [CRITICAL] — the `evaluator` finds coverage only by tag and the session only by folder, so a miss here re-opens the gap on every evaluation: S1 the file sits in the folder of the profile whose session the flow needs (per the project profile), named per S1; S3 every test carries the anchored feature tag (the route's slug tag for work without a feature) and the id of every surface it touches, and a criterion tag only where it proves that criterion completely. With a contract, every surface and criterion tag must name a real id.
- **Session** [CRITICAL] — A1 no login in a test, hook or fixture (no filling the sign-in form, no `POST` to the login route); A2 no forged token/session, no anti-bot bypass; A3 no storage-state file read directly — another profile's session only through its harness API fixture. The flow under test runs in the profile folder's session.
- **Data** [CRITICAL] — against the project's data policy: D1 no mutation of a protected or pre-existing record, no child created under one, and no submit pressed on a form bound to one — referencing configuration is allowed, editing it is not; D2 the test creates its own records, parents before children, with a run token, through the UI or HTTP API; D3 one test-scoped fixture per created record, each depending on its parent's (or a single record in `try/finally`) — a fixture that creates a parent and then a child, so the parent leaks when the child's creation fails, is CRITICAL; every removal attempted, each status checked, a throw naming what was left; a `catch` that swallows a failed removal is CRITICAL; D4 removal through a delete route and an API fixture allowed to use it; D5 no creation without a removal path; D7 a precondition the test cannot create is read from declared data and asserted; A3 API calls to the API origin, never relative to the page, with setup statuses checked.
- **Missing data** [CRITICAL] — V4 no `test.skip`, early `return` or count-guarded branch that lets an absent precondition pass; the precondition is asserted.
- **Language** [CRITICAL] — S4 English in test/describe names, comments, variables and helper names. **Product copy is exempt:** labels, button names and messages inside locators and assertions are matched in the product's language, which is correct, not a violation.
- **Naming** [MINOR] — S4 names state the behavior they check: an English name that states something else (a predicate named for another request) is MINOR.
- **Checklist** [MAJOR] — when validating a feature's tests, its `docs/<feature-id>-<kebab>/e2e-test.md` exists, its coverage table has one row per `e2e` row of the contract's `Test-suite hint` (and none for other suites), lists every test title and records the D4 residue, and every row carries an outcome of the closed list in `../e2e-test-writer/references/e2e-rules.md` ("Coverage outcomes"), worded as that list words it — tests (`unproven` until proven), `disputed` entries naming one test each (alone or next to the row's tests), a `not e2e-testable` reason, `out of e2e scope — <suite>`, or `not in this request`. The `evaluator` reads coverage from it and rejects any other wording.
- **Structure** [MAJOR] — S2 the project's test language and import form; `test`/`expect` from the fixtures module when one exists; no module system mixed with the harness's.
- **Assertions** [MAJOR] — V3 role/label/text locators first; structural markers only where the accessible name is unstable or absent; an item matched exactly (an unanchored `#12` also matches `#123`). V5 a filter or scoped list checked with data in which it can fail. V2 a snapshot read (`count()`, `allTextContents()`) only after a web-first assertion proved the state it reads. Requests captured before the action that fires them.
- **Requests** [MINOR] — V6 the requests the action should fire are captured and asserted; exactly-once asserted for every request whose duplicate would be a defect (a submit that creates, a search).
- **Execution** [MAJOR] — nothing that forces headed mode (E1).

V8 (never weaken an assertion) is a behavior of the writer, not a static property — flag it only
when a comment or diff context shows an expectation changed to match an observed defect.

**Overlaps, counted once:** a test that writes on a record it did not create is one D1 finding;
a proof too weak for its data is one V5 finding (MAJOR), plus an S3 finding (CRITICAL) only when
the contract's criterion needs the missing proof; a wrong profile folder is one S1 finding.
**H1** is the writer's precondition: note missing harness pieces in the summary, uncounted.

Do not skip rules after finding criticals. State which were skipped and why.

### Phase 3 — Compliance Report
Emit the full report per OUTPUT. Verdict is derived strictly from the counts.

---

## RULES

**Always:**
- Build the project profile from `GATES.md`, then validate against `../e2e-test-writer/references/e2e-rules.md`; check every rule.
- Give exact line/block locations and a concrete fix per violation; report positives. Output in English.
- Derive the verdict strictly from severity counts.

**Never:**
- Modify any test, harness or production file (read-only). Execute the tests. Mark PASS with any CRITICAL. Produce partial reports.
- Judge a project by another project's profiles, folders, language or data rules.

---

## Edge Cases

- **Empty test file:** CRITICAL. **Load-only test:** CRITICAL (V1).
- **Data created with no cleanup, a cleanup that swallows a failed removal, or a parent that leaks when its child's setup fails:** CRITICAL (D3). **Delete of an id the test did not create:** CRITICAL (D1).
- **Login in a `beforeAll`:** CRITICAL (A1) — one login per file still multiplies across files and spends the rate limit.
- **Product copy inside `getByRole`/`getByLabel`/`toHaveText` in the product's language:** not a Language violation.
- **File of the visual suite, or a harness file of the repository:** out of scope — say so; do not validate it against these rules.
- **`GATES.md` has no e2e section and the harness reveals no profiles:** report that the project profile cannot be built, and validate only the rules that do not depend on it, stating which were skipped.
- **No contract can be found for the feature tag:** state that S3 ids and criterion completeness were not verified.
