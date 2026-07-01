---
name: integration-test-validator
description: Audits PABX backend integration tests (apps/backend/__tests__/integration/) against the integration-test-writer rules, producing a compliance report with a PASS/FAIL/PASS WITH WARNINGS verdict, per-violation severity, and fix suggestions. Read-only — never writes or fixes tests. Dispatched by the evaluator to confirm a corrected integration test conforms before resuming evaluation, or run directly by a user.
---

# Integration Test Validator (PABX)

Audit **integration test files** to ensure they comply with every rule the
`integration-test-writer` enforces. **Read-only:** produce a compliance report; never modify
test/production files, never execute tests (static analysis only).

> **Project scope:** PABX backend. The full rule set is in
> **`../integration-test-writer/references/pabx-rules.md`** — validate against it.

**Scope:** `apps/backend/__tests__/integration/`.

## INPUT

- `test_file_path` (required) — test file or directory.
- `checklist_file_path` (optional) — the `.test.md` for coverage cross-reference.
- `target_file_or_endpoint` (optional) — the controller/endpoint under test.
- `severity_filter` (optional) — `critical` | `major` | `minor` (default: all).

## OUTPUT

A **compliance report** (English): summary counts, overall verdict (`PASS` = 0 critical + 0
major; `PASS WITH WARNINGS` = 0 critical, some major/minor; `FAIL` = ≥1 critical), each violation
(`[SEVERITY] Rule-ID`, location, description, expected, found, fix), coverage analysis, and
positive findings. When dispatched by the evaluator, the **verdict** is the signal it consumes.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Structural Analysis
Inventory `describe`/`it`/hooks/helpers. Map checklist ↔ tests and endpoint ↔ tests (if provided).
Identify every data-creation point and every cleanup point (`try-finally`, `afterEach`,
`afterAll`, direct deletes). Note imports.

### Phase 2 — Rule-by-Rule Validation
Check EVERY rule from `../integration-test-writer/references/pabx-rules.md`:
- **Language & Naming** [CRITICAL] — English only; descriptive names; no double blank lines.
- **Test Structure** [MAJOR] — AAA; independence; deterministic; `setupTestDatabase`/`cleanupTestDatabase`/`supertest`/`app` file pattern; no prod modification.
- **Data Cleanup** [CRITICAL] — `try-finally` per data-creating test; `try-catch` inside `finally`; FK order (`audit_logs` → `users_permissions`/`user_permissions_group` → `group_permissions` → `permissions` → `users` → `dr_agent` → `dr_domain`); only test-created data; no data left behind; ≥2 cleanup levels.
- **Execution Setup** [MAJOR] — `setupTestDatabase()` in `beforeAll` (destructure `token`); `cleanupTestDatabase()` in `afterAll`; correct imports.
- **Coverage** [MAJOR] — CRUD, auth/authorization, validation errors, not-found, edge cases, security (SQLi/XSS), checklist alignment.
- **Forbidden Practices** [CRITICAL] — no prod modification; no external data scripts; no pre-existing-data removal; no afterEach-only cleanup for created data; no Portuguese.
- **API Behavior** [MINOR] — status assertions; response-body assertions; correct HTTP methods; `Authorization` header on authenticated requests.

Do not skip rules after finding criticals. State which were skipped and why.

### Phase 3 — Compliance Report
Emit the full report per OUTPUT. Verdict is derived strictly from the counts.

---

## RULES

**Always:**
- Validate against `../integration-test-writer/references/pabx-rules.md`; check every rule.
- Give exact line/block locations and a concrete fix per violation; report positives. Output in English.
- Derive the verdict strictly from severity counts.

**Never:**
- Modify any test or production file (read-only). Execute the tests. Mark PASS with any CRITICAL. Produce partial reports.

---

## Edge Cases

- **Empty test file:** CRITICAL. **Missing `setupTestDatabase`/imports:** report each individually.
- **Data created without `try-finally`:** CRITICAL (F4). **Wrong FK cleanup order:** CRITICAL (C3).
- **Directory input:** one report per file + a summary.
