---
name: monorepo-unit-test-writer
description: Plans and implements unit tests for any PABX monorepo app EXCEPT apps/backend and apps/frontend — auto-detecting the stack (node-express, node-worker, or python-fastapi) and applying stack-specific patterns. Runs interactively (3 phases with an approval checkpoint) when a user calls directly, or autonomously (no pause) when dispatched by implement-feature/evaluator. Also runs in correction mode to fix a specific failing test flagged by the evaluator. Enforces PABX rules (mock-before-import, Promise.all() mocks, GPU/torch mocks, English-only, batches). Never modifies production code.
---

# Monorepo Unit Test Writer (PABX)

Plan and implement fast, isolated unit tests for PABX monorepo apps across multiple stacks.
**Never modifies production code** — if a test fails, only the test is adjusted.

> **Project scope:** PABX monorepo apps other than `apps/backend`/`apps/frontend` (those use
> `unit-test-writer`). All hard rules (stack detection, node-express/worker patterns, Python
> GPU/torch mocking, file locations, test infrastructure, execution) are in
> **`references/pabx-rules.md`** — read it before writing.
> Generic SDD flow docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/GUIA_DO_WORKFLOW.md`.

**Scope:** any `apps/{app}` except backend/frontend. Stacks: `node-express`, `node-worker`, `python-fastapi`.

## INPUT

- `target_file` (required) and `app_name` (required).
- `mode` (optional) — `interactive` (default when a user calls) or `autonomous` (set by implement-feature/evaluator).
- `test_file_path` / `focus_areas` / `batch_size` (optional).
- `test_catalog_path` (optional) — Test Catalog entry to accelerate Phase 1.
- `evaluation_report` (optional) — when present, run in **correction mode** (fix only the flagged test).

## OUTPUT

- New/expanded unit tests in the stack's location (`__tests__/unit/**/*.test.ts` or `tests/test_*.py`), following PABX rules.
- A `.unit-test.md` checklist (planning may be Portuguese; **all test code is English**).
- Any missing test infrastructure created (`jest.config.ts` / `conftest.py`) when needed.
- Per-batch execution confirmation and final coverage summary. Production code untouched.

---

## Invocation Modes

**Interactive (default):** full 3-phase process, **stop at the Phase 2 checkpoint** for approval.

**Autonomous (dispatched):** same phases, **skip the checkpoint** — auto-accept and implement. Never pause.

**Correction mode (evaluator, `kind:test`):** an `evaluation_report` is provided. Fix **only** the
flagged test (smallest footprint) so it conforms to the detected stack's PABX rules and passes;
do not touch production code or unrelated tests. Return control to the evaluator.

---

## EXECUTION STEPS (3 Phases)

### Phase 1 — Analysis & Planning
1. **Detect the stack** (`references/pabx-rules.md` detection table).
2. If `test_catalog_path` given, read the entry and validate against source.
3. Study existing tests in the app for patterns.
4. Read the target file fully; map functionalities, dependencies, code paths.
5. Identify external deps to mock (DB, HTTP, queues, caches, SDKs, filesystem, GPU/ML).
6. Map scenarios (success, error, edge, boundary). **Verify test infrastructure**; note what must be set up.

### Phase 2 — Checklist Creation
Create a `.unit-test.md` checklist by stack + source type (controller/service/model/util,
worker agent/trigger/AGI/job, FastAPI app/service — see `references/pabx-rules.md`).
- **Interactive:** ask the coverage checkpoint questions → **WAIT for approval.**
- **Autonomous / correction:** skip the checkpoint; proceed.

### Phase 3 — Batch Implementation
GROUP into batches of 5–10 → set up missing infra if needed → IMPLEMENT applying stack rules
(mock-before-import, Promise.all() pattern, torch mock before app import) → EXECUTE (Node:
milliseconds; Python: < 1s) → UPDATE checklist → REPEAT. In correction mode, implement only the
corrected test(s).

---

## RULES

**Always:**
- Detect the stack first; follow `references/pabx-rules.md` for that stack.
- Node: `import` not `require`; `jest.mock()` before import; `jest.clearAllMocks()` in `beforeEach`; correct `Promise.all()` mock pattern.
- Python: mock GPU/ML (`torch`, `whisperx`, `TTS`) via `sys.modules` BEFORE any app import; `@pytest.mark.asyncio` for async; `TestClient` for routes; `conftest.py` fixtures.
- Write ALL test content in English; independent, deterministic, fast tests. Set up missing infra.
- In correction mode, fix only the flagged test and return to the evaluator.

**Never:**
- Modify production code. Use real DB/HTTP/queue/filesystem/GPU. Write Portuguese in tests.
- Import Python app modules before mocking GPU/ML. Use `require()` in TS. Pause in autonomous/correction mode.

---

## Edge Cases

- **Missing `jest.config`/`conftest.py`:** create it before writing tests.
- **Python app imports torch at module level:** mock via `sys.modules` first or tests try real model loading (minutes / OOM).
- **Route files (node-express):** integration-only — no unit tests.
- **App is `apps/backend` or `apps/frontend`:** out of scope — use `unit-test-writer` instead.
