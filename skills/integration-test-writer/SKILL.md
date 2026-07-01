---
name: integration-test-writer
description: Plans and implements comprehensive integration tests for the PABX backend (apps/backend/__tests__/integration/) using Jest + supertest against a real test database. Runs interactively (3 phases with an approval checkpoint) when a user calls directly, or autonomously (no pause) when dispatched by implement-feature/evaluator. Also runs in correction mode to fix a specific failing integration test flagged by the evaluator. Enforces PABX rules (setupTestDatabase, try-finally cleanup, foreign-key order, English-only, NODE_ENV=testing, batches). Never modifies production code.
---

# Integration Test Writer (PABX)

Plan and implement high-quality **integration tests** that validate real API behavior against a
real test database (full request→response lifecycle: middleware, controller, model, DB).
**Never modifies production code** — if a test fails, only the test is adjusted.

> **Project scope:** PABX backend. All hard rules (file structure, `setupTestDatabase`,
> try-finally cleanup, foreign-key order, coverage minimums, execution commands) are in
> **`references/pabx-rules.md`** — read it before writing.
> Generic SDD flow docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/GUIA_DO_WORKFLOW.md`.

**Scope:** `apps/backend/__tests__/integration/`.

## INPUT

- `target_file_or_endpoint` (required) — controller, route, or endpoint (e.g. `POST /v2/calltype`).
- `mode` (optional) — `interactive` (default when a user calls) or `autonomous` (set by implement-feature/evaluator).
- `test_file_path` / `focus_areas` / `batch_size` (optional).
- `test_catalog_path` (optional) — Test Catalog entry to accelerate Phase 1.
- `evaluation_report` (optional) — when present, run in **correction mode** (fix only the flagged test).

## OUTPUT

- New/expanded integration tests in `apps/backend/__tests__/integration/`, following PABX rules.
- A `.test.md` checklist (planning may be Portuguese; **all test code is English**).
- Per-batch execution confirmation and a final coverage summary. Production code untouched.

---

## Invocation Modes

**Interactive (default):** full 3-phase process, **stop at the Phase 2 checkpoint** for explicit approval.

**Autonomous (dispatched):** same phases, **skip the checkpoint** — auto-accept the checklist and implement. Never pause.

**Correction mode (evaluator, `kind:test`):** an `evaluation_report` is provided. Fix **only** the
flagged failing test (smallest footprint) so it conforms to the PABX rules and passes; do not
touch production code or unrelated tests. Return control to the evaluator.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Analysis & Planning
1. If `test_catalog_path` given, read the entry and validate against source.
2. Study existing `apps/backend/__tests__/integration/` for patterns/helpers/utilities.
3. Read the target controller/model/route fully; map code paths.
4. Identify test utilities: `setupTestDatabase()`, `cleanupTestDatabase()`, token helpers, factories. Consult DB schema (MCP MySQL) for FK constraints if needed.
5. Map scenarios: CRUD, auth/authorization, validation, not-found, edge cases, boundaries, relationships, concurrency, security (SQLi/XSS), data integrity.

### Phase 2 — Checklist Creation
Create a `.test.md` checklist (name, objective, input, expected status + response). Cover the
minimum categories from `references/pabx-rules.md`.
- **Interactive:** ask the coverage/security/auth checkpoint questions → **WAIT for approval.**
- **Autonomous / correction:** skip the checkpoint; proceed.

### Phase 3 — Batch Implementation
GROUP into batches of 5–10 → IMPLEMENT with `setupTestDatabase`/try-finally/FK-order cleanup →
EXECUTE with `NODE_ENV=testing` and `--forceExit --detectOpenHandles` → UPDATE checklist →
REPEAT. In correction mode, implement only the corrected test(s).

---

## RULES

**Always:**
- Follow `references/pabx-rules.md` (file structure, cleanup, coverage, execution).
- Use `setupTestDatabase()`/`cleanupTestDatabase()`; `try-finally` for any test that creates data; `try-catch` inside `finally`; FK order (children before parents); delete only test-created data.
- Write ALL test content in English; independent, deterministic tests; assert status codes and response bodies.
- Set `NODE_ENV=testing`; run with `--forceExit --detectOpenHandles`.
- In correction mode, fix only the flagged test and return to the evaluator.

**Never:**
- Modify production code (`*.model.js`, `*.controller.js`, routes). Fix only tests.
- Leave test data in the DB or remove pre-existing data. Rely solely on `afterEach`/`afterAll` for created data.
- Clean in the wrong FK order; use external data-population scripts; write Portuguese in tests.
- Pause for approval in autonomous/correction mode.

---

## Edge Cases

- **Data created inside `it()`:** `try-finally` is mandatory (not just `afterAll`).
- **FK-constrained entities:** delete children before parents per the documented order.
- **> ~20 tests with `--verbose`:** redirect output to a file to avoid AI disconnections.
- **Stack not PABX backend:** this skill is PABX-specific; report that a generic approach is needed.
