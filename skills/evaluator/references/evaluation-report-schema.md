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
      "targetSurface": "<e2e only: contract surface id [+ route], or a route alone without a contract — e.g. UI-01 /agent-dashboard/tickets>",

      "exceptionRefused": true
    }
  ],
  "pending": [
    {
      "reason": "exception-approval | exception-decision",
      "ref": "<gate id>",
      "finding": "<file> — <the finding and its code, as the gate prints them>",
      "message": "<what a human must decide, and the reason given>"
    }
  ]
}
```

Field notes:
- `feature` — feature ID under evaluation.
- `attempt` — the current fix attempt (owned/incremented by the evaluator).
- `status` — `FAIL` for a report that triggers a correction; `PENDING` for a report written only
  because `pending[]` is not empty.
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

- `exceptionRefused` — present, and `true`, on a failure whose gate exception a human refused
  (see "Gate exceptions" below). `fix-runner` must correct it or return an ordinary "not
  resolved", never the allowlist signal.
- `pending[]` — what a **human** must decide, rebuilt on every evaluation from the gate output
  and the correctors' signals: nothing reads it back, and correctors never read it. Written on
  every outcome, ABORTED included. Two reasons, both defined under "Gate exceptions":
  `exception-approval` and `exception-decision`.

**Test-routing fields (present only when `kind == "test"`):**
- `testSuite` — which suite/skill pair handles it: `unit` → `unit-test-*`, `integration` →
  `integration-test-*`, `monorepo` → `monorepo-unit-test-*`, `e2e` → `e2e-test-*`.
- `ref` — for `kind: test`, the id of the gate that ran the failing test (e.g. `tests-frontend`,
  `e2e-frontend`). For missing e2e coverage, the e2e gate that should run the new test; for a
  guard requested by `qa-preflight`, the QA case id, as for `qa-finding`.
- `testFile` — path to the failing test file (also lets the evaluator re-derive the suite).
  **Absent for `e2e` when the test does not exist yet** — missing coverage found by the
  `evaluator`, or a guard requested by `qa-preflight`; `e2e-test-writer` then runs in guard mode.
  **Also absent for `integration` when a query-growth test is missing** (evaluator Step 5): the
  endpoint goes in `message`, and `integration-test-writer` writes that one test.
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
describing what needs human intervention. **When `pending[]` is not empty, the report is always
written**, whatever the state, so the open decisions stay on disk.

### Gate exceptions

This section is the one definition. The evaluator, `fix-runner` and `implement-feature` refer
to it.

A **gate exception** is any change that makes a gate accept something it rejected before:
- an allowlist or baseline entry;
- a raised ratchet count (lowering one is always allowed);
- an edit to a gate's rules, configuration or runner that narrows what it rejects;
- an inline disable, where the gate honours one.

**Only a human decides a gate exception.** No skill makes one to turn a gate green.
`implement-feature` may add an **allowlist entry** only when the accepted pattern cannot
express the code, and only in a category the gate's section of the project's gate
documentation accepts, recording its feature where that documentation says (on the PABX, the
`feature` field). Only a human records the approval (on the PABX, the `approved` field of the
entry). No skill makes the other kinds.

**Hiding the rejected pattern from a gate's detection is not a correction either.** Examples are
renaming the handle a rule recognises, wrapping the call in a helper the rule cannot see, and
moving the code out of the scanned path. The accepted fix is the pattern the gate's section
describes.

How the evaluator treats each kind:

| What | Effect on the state | Closes when |
|---|---|---|
| an allowlist entry **awaiting approval**, whatever feature it names: listed so by the gate, or found in the branch's diff of the allowlist file without the approval (the evaluator reads the file even when the contract does not declare that gate) | `pending[]` item `exception-approval`: the feature cannot end CLEAN | a human records the approval |
| `fix-runner` returns only "not resolved — needs an allowlist decision" claims, and every claim holds (evaluator Step 7.4) | `pending[]` item `exception-decision` per finding, **and the loop stops**: PENDING, no increment | a human decides. If the human adds and approves the entry, the next evaluation finds the gate green. If the human refuses, the evaluation is re-run with the override `no exception: <finding>`, which sets `exceptionRefused` on that failure |
| any other gate exception in the branch's diff against the base (a raised ratchet, an edited gate rule or runner, an inline disable): kinds that no gate records an approval for | a **Finding**, at the top of the report, for the PR reviewer. It does not change the state | — the PR review decides |
| a failure whose only cause is a finding under an open item above, or a per-item query allowed by an entry awaiting approval (a red query-growth test, say) | attached to that item: it is not a failure, and a claim may name it through that finding | with the item |

A branch that carries several features shares its allowlist: an entry awaiting approval blocks
CLEAN for every feature evaluated on it until a human approves it. The approval is the way
out, and it is one edit.
