# evaluation-report.json — schema

Written by `evaluator` at `docs/<feature-id>-<kebab>/evaluation-report.json` whenever the
evaluation is **FAIL** (and refreshed each FAIL iteration). Consumed by `fix-runner`.

```json
{
  "feature": "F01",
  "attempt": 1,
  "status": "FAIL",
  "contract": "docs/F01-<kebab>/contract.md",
  "failures": [
    {
      "kind": "gate | test | observable-criterion",
      "ref": "<stable id of the gate/criterion declared in contract.md>",
      "message": "<objective message>",
      "location": "<file:line | route | command>",
      "evidence": "<log excerpt | screenshot path>"
    }
  ]
}
```

Field notes:
- `feature` — feature ID under evaluation.
- `attempt` — the current fix attempt (owned/incremented by the evaluator).
- `status` — always `FAIL` for a report that triggers the fix-runner.
- `contract` — path to the contract whose criteria were violated.
- `failures[]` — one entry per violated gate/test/observable criterion.
  - `kind` — which contract block the failure came from.
  - `ref` — the **stable id** from `contract.md` (gate id like `lint`/`build`, or observable
    criterion id like `register-cta`). This is how the fix-runner knows what to re-read.
  - `location` / `evidence` — present when applicable (a gate failure has a command + log;
    an observable-criterion failure may have a screenshot).

For non-FAIL outcomes the evaluator does not need a failures report; it records the state in
`progress.json` (CLEAN, PENDING, ABORTED). A PENDING outcome may still write a short report
describing what needs human intervention.
