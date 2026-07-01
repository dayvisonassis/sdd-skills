---
name: monorepo-unit-test-validator
description: Audits PABX monorepo unit tests (node-express, node-worker, python-fastapi apps outside apps/backend and apps/frontend) against the monorepo-unit-test-writer rules, auto-detecting the stack and producing a compliance report with a PASS/FAIL/PASS WITH WARNINGS verdict, per-violation severity, and fix suggestions. Read-only — never writes or fixes tests. Dispatched by the evaluator to confirm a corrected test conforms before resuming evaluation, or run directly by a user.
---

# Monorepo Unit Test Validator (PABX)

Audit **unit test files** across the PABX monorepo (excluding backend/frontend) to ensure they
comply with every rule the `monorepo-unit-test-writer` enforces. **Read-only:** produce a
compliance report; never modify test/production files, never execute tests (static analysis only).

> **Project scope:** PABX monorepo apps (not backend/frontend). The full rule set is in
> **`../monorepo-unit-test-writer/references/pabx-rules.md`** — validate against it.

**Scope:** any `apps/{app}` except backend/frontend. Stacks: `node-express`, `node-worker`, `python-fastapi`.

## INPUT

- `test_file_path` (required) and `app_name` (required).
- `checklist_file_path` (optional) — the `.unit-test.md` for coverage cross-reference.
- `target_file` (optional) — the source under test.
- `severity_filter` (optional) — `critical` | `major` | `minor` (default: all).

## OUTPUT

A **compliance report** (English): summary counts, detected stack, applicable rule categories,
overall verdict (`PASS` = 0 critical + 0 major; `PASS WITH WARNINGS` = 0 critical, some
major/minor; `FAIL` = ≥1 critical), each violation (`[SEVERITY] Rule-ID`, stack, location,
description, expected, found, fix), coverage/performance analysis, and positive findings. When
dispatched by the evaluator, the **verdict** is the signal it consumes.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Structural Analysis
Detect the stack (`node-express` / `node-worker` / `python-fastapi`). Inventory test blocks
(Node: `describe`/`it`/hooks/helpers; Python: `class Test*`/`def test_*`/fixtures/`conftest.py`).
Map checklist ↔ tests and source ↔ tests (if provided). Note imports and **mock-vs-import order**
(Node `jest.mock()`; Python `sys.modules` patching). Identify mocks and cleanup points.

### Phase 2 — Rule-by-Rule Validation
Check EVERY applicable rule from `../monorepo-unit-test-writer/references/pabx-rules.md`:
- **Language & Naming** [Common, CRITICAL] · **Test Structure** [Common, MAJOR] · **Mock & Isolation** [Common, CRITICAL].
- **Node common** [NE+NW, CRITICAL] — `import` not `require`; `jest.mock()` before import; `jest.clearAllMocks()`; `.test.ts`; location mirrors source.
- **Node Express** [NE, CRITICAL] — controller `req/res/next`; service mocks; model Promise.all() (new mock per call, `.then` bind, `clone()` new); routes excluded; middleware `next()` flow.
- **Node Worker** [NW, CRITICAL] — connections mocked (DB/Redis/BullMQ/Qdrant/Neo4j); AGI session mock; dbevents source mock; job payload valid+invalid; graceful shutdown; pipeline isolation.
- **Python FastAPI** [PF, CRITICAL] — GPU/ML mocked before imports; `TestClient`; no real model loading; `@pytest.mark.asyncio`; `conftest.py`; correct `@patch` target; no hardcoded paths.
- **Coverage** [Common, MAJOR] · **Forbidden Practices** [Common, CRITICAL] · **Resource Cleanup** [Common, MAJOR] (incl. Python fixture scoping).

Do not skip rules after finding criticals. Apply only the detected stack's rules; state skipped categories and why.

### Phase 3 — Compliance Report
Emit the full report per OUTPUT. Verdict is derived strictly from the counts.

---

## RULES

**Always:**
- Detect the stack; validate against `../monorepo-unit-test-writer/references/pabx-rules.md`; check every applicable rule.
- Give exact locations and a concrete fix per violation; report positives. Output in English.
- Apply only the detected stack's rules (never cross-apply Python rules to Node tests or vice versa).

**Never:**
- Modify any test or production file (read-only). Execute the tests. Mark PASS with any CRITICAL. Produce partial reports.

---

## Edge Cases

- **Empty test file:** CRITICAL. **Mixed-stack patterns** (Jest in a Python test): CRITICAL structural issue.
- **Missing `conftest.py`:** MAJOR. **Missing `jest.config`:** MAJOR.
- **Passing tests with bad patterns:** still flag (they hide real bugs). **Directory input:** one report per file + summary.
