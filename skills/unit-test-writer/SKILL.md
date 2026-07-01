---
name: unit-test-writer
description: Plans and implements comprehensive unit tests for the PABX monorepo — Angular frontend (Jest + jest-preset-angular, .spec.ts) and Node.js backend (Jest, apps/backend/__tests__/unit/). Runs interactively (3 phases with an approval checkpoint) when called by a user, or autonomously (no pause) when dispatched by implement-feature/evaluator. Also runs in correction mode to fix a specific failing test flagged by the evaluator. Enforces PABX rules (real component imports, manual service instantiation, localStorage/jQuery mock order, Promise.all() mock correctness, cleanup, English-only). Never modifies production code.
---

# Unit Test Writer (PABX)

Plan and implement fast, isolated, high-quality **unit tests** for the PABX monorepo. Validates
logic without hitting real databases, HTTP, or filesystems. **Never modifies production code** —
if a test fails, only the test is adjusted.

> **Project scope:** this skill assumes the **PABX monorepo** structure. All the hard,
> project-specific rules (jQuery/localStorage mock order, `Promise.all()` mock pattern, file
> locations, execution commands) are in **`references/pabx-rules.md`** — read it before writing.
> Generic SDD flow docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/GUIA_DO_WORKFLOW.md`.

**Scope:**
- **Frontend:** `apps/frontend/` — Jest + jest-preset-angular, `*.spec.ts` co-located with the source.
- **Backend:** `apps/backend/__tests__/unit/` — Jest, `*.test.js` mirroring `src/` (1:1).

## INPUT

- `target_file` (required) — the source file to test.
- `mode` (optional) — `interactive` (default when a user calls directly) or `autonomous` (set by implement-feature/evaluator).
- `test_file_path` (optional) — existing test file to expand; otherwise created automatically.
- `focus_areas` / `batch_size` (optional) — prioritized methods; tests per batch (default 8, 5–10).
- `test_catalog_path` (optional) — a Test Catalog entry to accelerate Phase 1.
- `evaluation_report` (optional) — when present, run in **correction mode** (fix only the failing test named in the report).

## OUTPUT

- New/expanded `.spec.ts` / `.test.js` unit tests following the PABX rules, in the correct location.
- A `.unit-test.md` checklist (planning may be Portuguese; **all test code is English**).
- Per-batch execution confirmation (tests run in milliseconds) and a final coverage summary.
- No production code is ever modified.

---

## Invocation Modes

**Interactive (user-invoked, default):** run the full 3-phase process and **stop at the Phase 2
checkpoint** to get explicit user approval before implementing.

**Autonomous (dispatched by implement-feature / evaluator):** run the same 3 phases but **skip
the approval checkpoint** — auto-accept the checklist and proceed to batch implementation. Never
pause for a human. This mirrors spec-writer's Batch Mode.

**Correction mode (dispatched by evaluator on a `kind:test` failure):** an `evaluation_report`
is provided. Read the failing test's `testFile`/`location`/`message`, and **fix only that test**
(smallest footprint) so it conforms to the PABX rules and passes. Do not rewrite unrelated tests
and do not touch production code. Return control to the evaluator.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Analysis & Planning
1. If `test_catalog_path` given, read the catalog entry (priority, gaps, methods, mocks, pattern) and validate it against the actual source.
2. **Backend:** study existing `apps/backend/__tests__/unit/` for patterns. **Frontend:** IGNORE legacy Karma/Jasmine; write fresh Jest tests.
3. Read the target file fully; map functionalities, dependencies, code paths.
4. Identify every external dependency to mock (HttpClient, DB, services, localStorage, jQuery, Router, ActivatedRoute).
5. Map scenarios: success, error handling, edge cases, boundary conditions.

### Phase 2 — Checklist Creation
Create a `.unit-test.md` checklist organized by method/function, using the minimum categories
for the target type (component / service / backend util / controller / model — see
`references/pabx-rules.md`).

- **Interactive:** present the checklist and ask: does it guarantee max coverage of success+failure? missing edge cases? all deps identified? → **WAIT for explicit approval.**
- **Autonomous / correction:** skip the checkpoint; treat the checklist as approved and proceed.

### Phase 3 — Batch Implementation (only after approval / autonomously)
1. GROUP similar tests into batches of 5–10 (same method/scenario/mocks).
2. IMPLEMENT the batch in one operation, applying the PABX rules (`references/pabx-rules.md`).
3. EXECUTE the batch — confirm milliseconds; a test > 1s means a broken mock.
4. UPDATE the checklist; REPEAT until complete.

In **correction mode**, Phases 1–2 collapse to reading the report + the failing test; implement
only the corrected test(s) and run them.

---

## RULES

**Always:**
- Follow `references/pabx-rules.md` exactly (component/service/model/controller patterns, mock order, cleanup, performance).
- Write ALL test content in English; keep tests independent, deterministic, fast.
- Import the REAL component; instantiate services manually; mock localStorage/jQuery before imports.
- Use the correct `Promise.all()` mock pattern (new builder per call, `.then` via `Promise.resolve().then.bind`).
- Place files per the location standard (frontend co-located; backend 1:1 mirror).
- In correction mode, fix only the flagged test (smallest footprint) and return to the evaluator.

**Never:**
- Modify production code (components, services, utils, controllers, models). Fix only tests.
- Use real DB/HTTP/filesystem; `TestBed.inject()`/`HttpClientTestingModule` for services; inline test components.
- Write anything in Portuguese in test files.
- Pause for approval in autonomous/correction mode.
- Leave shared mutable state between tests or create slow tests.

---

## Edge Cases

- **Test file missing:** create it in the correct location.
- **Component uses jQuery:** global `$` mock BEFORE all imports (else CRITICAL failure).
- **Model uses `Promise.all()`:** apply the dedicated mock pattern or tests hang for minutes.
- **Stack not PABX (no `apps/` layout):** this skill is PABX-specific; report that the caller should use a generic approach instead.
- **Called autonomously but the checklist reveals a blocking ambiguity:** apply a best-practice default, note it, and proceed (do not pause).
