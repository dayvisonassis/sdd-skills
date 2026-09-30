# evaluation-report.json — schema

Written by `evaluator` at `docs/<feature-id>-<kebab>/evaluation-report.json` whenever the
evaluation is **FAIL** (and refreshed each FAIL iteration). Consumed by the correction skills
the evaluator dispatches: **`fix-runner`** for code failures, and a **test-writer**
(`unit`/`integration`/`monorepo-unit`/`e2e`) for test failures.

**Second producer — `qa-preflight`.** After a feature is finished, `qa-preflight` writes a
report in this same schema for the defects it finds and dispatches the same correctors.
Everything below applies unchanged, plus the `qa-finding` kind.

```json
{
  "feature": "F01",
  "attempt": 1,
  "status": "FAIL",
  "contract": "docs/F01-<kebab>/contract.md",
  "failures": [
    {
      "kind": "gate | test | observable-criterion | qa-finding",
      "ref": "<stable id from contract.md — or, for qa-finding, the QA case id>",
      "message": "<objective message>",
      "location": "<file:line | route | command>",
      "evidence": "<log excerpt | screenshot path>",

      "testSuite": "unit | integration | monorepo | e2e",
      "testFile": "apps/.../*.spec.ts | *.test.js | *.test.ts | test_*.py | tests/e2e/.../*.spec.js",
      "targetFile": "apps/.../<source under test>",
      "targetSurface": "<e2e only: contract surface id [+ route] — e.g. UI-01 /agent-dashboard/tickets>"
    }
  ]
}
```

Field notes:
- `feature` — feature ID under evaluation.
- `attempt` — the current fix attempt (owned/incremented by the evaluator).
- `status` — always `FAIL` for a report that triggers a correction.
- `contract` — path to the contract whose criteria were violated.
- `failures[]` — one entry per violated gate/test/observable criterion.
  - `kind` — routing key:
    - `gate` / `observable-criterion` → **code failure** → dispatched to **`fix-runner`**.
    - `test` → **test failure** → dispatched to the matching **test-writer** (then confirmed by
      the matching **test-validator**), never to `fix-runner`.
    - `qa-finding` → a real defect that **no contract criterion covered**, found by
      `qa-preflight` after the feature was done → dispatched to **`fix-runner`**. It exists
      because the most expensive defect is the one no contract anticipated: insufficient
      contrast violates no declared criterion and passes every green gate.
  - `ref` — the **stable id** from `contract.md` (gate id like `lint`/`build`, or observable
    criterion id like `register-cta`). **For `qa-finding` there is no contract id**: `ref` is
    the **QA case id** that found the defect (e.g. `CT-ACESSIBILIDADE-002`), which keeps
    traceability without inventing a retroactive criterion.
  - `location` / `evidence` — present when applicable (a gate failure has a command + log; an
    observable-criterion failure may have a screenshot; a test failure has the failing
    test's file:line and the runner output).

**Test-routing fields (present only when `kind == "test"`):**
- `testSuite` — which suite/skill pair handles it: `unit` → `unit-test-*`, `integration` →
  `integration-test-*`, `monorepo` → `monorepo-unit-test-*`, `e2e` → `e2e-test-*`.
- `ref` — for `kind: test`, the id of the gate that ran the failing test (e.g. `tests-frontend`,
  `e2e-frontend`). For missing e2e coverage, the e2e gate that should run the new test; for a
  guard requested by `qa-preflight`, the QA case id, as for `qa-finding`.
- `testFile` — path to the failing test file (also lets the evaluator re-derive the suite).
  **Absent for `e2e` when the test does not exist yet** — missing coverage found by the
  `evaluator`, or a guard requested by `qa-preflight`; `e2e-test-writer` then runs in guard mode.
- `targetFile` — the production source the test covers (passed to the test-writer as
  `target_file`). An e2e test covers a flow, not one source file: for `e2e` it is optional.
- `targetSurface` — **`e2e` only, required there:** the contract surface id, followed by its
  route when the surface has one (e.g. `UI-01 /agent-dashboard/tickets`, or just `UI-02`), or the
  route alone when there is no contract (a `qa-preflight` guard on a feature without one),
  passed to `e2e-test-writer` as its `target`.

**Deterministic suite selection** (the evaluator sets `testSuite` from `testFile`):
- `*.spec.ts` in `apps/frontend/` **or** `*.test.js` in `apps/backend/__tests__/unit/` → `unit`
- any file under `apps/backend/__tests__/integration/` → `integration`
- any other app under `apps/` (`*.test.ts` or `test_*.py`) → `monorepo`
- any file under `tests/e2e/` → `e2e`
- a file under `tests/visual/` is **not** a test-writer suite — no writer owns it. When the
  product is what is wrong, report `kind: gate` with the visual gate's id as `ref`. When the
  assertion itself is wrong, no corrector can take it: record it as **PENDING** for a human,
  never as `kind: test` and never to `fix-runner`, which would change product code to satisfy a
  broken measurement.

For non-FAIL outcomes the evaluator does not need a failures report; it records the state in
`progress.json` (CLEAN, PENDING, ABORTED). A PENDING outcome may still write a short report
describing what needs human intervention.
