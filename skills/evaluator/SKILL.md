---
name: evaluator
description: Externally evaluates an already-implemented feature against its contract.md (environment, quality gates, coverage manifest, observable criteria), producing screenshots, a report, and chat findings. Owns the evaluation loop — keeps the attempt counter in progress.json, decides the state (CLEAN/FAIL/PENDING/ABORTED), and dispatches the fix-runner on FAIL until CLEAN, PENDING, or ABORTED.
---

# Evaluator

A second, independent layer of validation. After `implement-feature` finishes a feature, the `evaluator` looks at it **from the outside** and confirms — against `contract.md` — whether the delivery conforms. It finds deviations the implementer's self-check missed. It **does not fix code**; it evaluates and **orchestrates the correction loop**, dispatching `fix-runner` on failure.

> Base docs: `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Skill_Evaluator.md` (full rationale),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Contrato_de_Feature.md` (contract structure),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Como_criar_gates.md` (gates),
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Fluxo_SDD_e_Implementacao_das_Skills.md` (flow, states, progress.json schema).
> Report schema: `references/evaluation-report-schema.md`.

The evaluator complements automated tests — it does not replace them.

## INPUT

Free-form. The skill needs:

- **The target feature** (ID/name) — explicit and required. Abort if absent or ambiguous (list candidates).
- Auto-discovers: `progress.json` (root of `docs/`) and the feature's `contract.md` (in `docs/<feature-id>-<kebab>/`).
- Optional free-form overrides at the end — e.g. "no screenshots", "gates only", "max 5 attempts" (overrides `maxFixAttempts` for this run).

If the feature has no `contract.md`, abort: "No contract.md for F<ID> — generate it with `spec-writer` first."

## OUTPUT

- **Screenshots** — visual evidence of observable UI criteria (when applicable).
- **Report** — consolidated ✓ / ✗ / — per contract criterion and gate.
- **Findings in chat** — textual summary for the user.
- **State in `progress.json`** — CLEAN | FAIL | PENDING | ABORTED for the feature.
- **On FAIL:** a structured `evaluation-report.json` in the feature folder (consumed by `fix-runner`).
- The evaluator does **not** edit production code. Corrections are made by `fix-runner`.

---

## EXECUTION STEPS

### Step 1: Resolve Input

- Resolve the target feature (ID/name). Abort if absent or ambiguous, listing candidates.
- Locate `progress.json` (root of `docs/`) and the feature's `contract.md`. If `contract.md` is missing → abort ("generate the contract first with `spec-writer`"). If `progress.json` is missing, create it with `config.maxFixAttempts` default 3.
- Parse any overrides (e.g. `max N attempts`, `gates only`, `no screenshots`) and record them for the report.

### Step 2: Load Context

- Read `contract.md`: Environment Contract, Quality Gates (with `id`s), Coverage Manifest, Surfaces & Behaviors, Observable Criteria (with `id`s).
- Read `progress.json`: this feature's `state`, `attempt`, and `config.maxFixAttempts` (N).
- The contract is the **single source of acceptance criteria**. Do NOT invent criteria outside it.

### Step 3: Verify Environment Contract

- Check each environment prerequisite (runtime up, services reachable, tools available — e.g. dev server serving `/`, Playwright CLI present).
- If the environment is **not** satisfied → do NOT proceed to evaluation. Set `state: PENDING` (human/environment intervention needed), explain that this is an **environment** problem (not an implementation failure), and stop. Environment-invalid ≠ implementation-wrong.

### Step 4: Run Quality Gates

- Execute each gate declared in the contract (typecheck, lint, build, tests, arch...). Use the exact commands from the contract.
- Any gate failing is a contract violation (`kind: gate`, `ref: <gate-id>`). Collect the command + log as evidence.
- (If `gates only` override is set, skip Step 5 and go to Step 6 with just gate results.)

### Step 5: Validate Surfaces & Observable Criteria

- For each surface in the Coverage Manifest, start from its declared initial state and exercise the concrete behaviors (e.g. navigate the route via Playwright CLI, capturing screenshots).
- For each Observable Criterion, collect verifiable evidence (e.g. CTA present, login in top nav, redirect behavior, visual identity). A criterion with no observable evidence is a failure (`kind: observable-criterion`, `ref: <crit-id>`).
- Map every PRD-derived acceptance back to a contract criterion/gate (the contract already did this traceability; honor it).

### Step 6: Decide State

Determine the feature's state strictly from contract adherence — never from "looks ok":

- **CLEAN** — no failures: all gates pass, all observable criteria met. → record state, proceed to Step 9.
- **FAIL** — at least one **correctable** failure (gate/test/observable). → go to Step 7 (loop).
- **PENDING** — something the evaluator **cannot test by itself** (needs a human, or an environment it cannot bring up). → record state with a note, proceed to Step 9.
- **ABORTED** — decided in Step 7 when attempts are exhausted.

List exactly which gates/criteria failed.

### Step 7: Correction Loop (when FAIL)

- Read `attempt` and `maxFixAttempts` (N) from `progress.json`.
- **If `attempt >= N`** → set `state: ABORTED`; stop and report (the loop tried N times without converging). Proceed to Step 9.
- **Else:**
  1. Write/refresh `evaluation-report.json` in the feature folder (schema in `references/evaluation-report-schema.md`) with the current `attempt` and the `failures[]`.
  2. Set `state: FAIL` in `progress.json` and persist the report path in `lastEvaluationReport`.
  3. **Dispatch `fix-runner`** via the Skill tool (or as a subagent), passing the feature ID and the path to `evaluation-report.json`. The on-disk report is the source of truth.
  4. When `fix-runner` returns:
     - If it reports "correction applied" → **increment `attempt`** in `progress.json`, then **re-evaluate**: go back to Step 3.
     - If it reports "not resolved — <reason>" → still increment `attempt` (a real attempt was spent); if `attempt >= N` set `ABORTED`, else re-evaluate (Step 3). Do not loop forever without incrementing.

The evaluator **owns** the counter, the limit N, and the ABORTED decision. The `fix-runner` is stateless and never decides when to stop.

### Step 8: (reserved — loop body lives in Step 7)

### Step 9: Persist State & Report

- Write the final `state` (CLEAN | PENDING | ABORTED) and `updatedAt` for the feature in `progress.json`. Preserve `config` and other features' entries (merge, don't replace).
- On CLEAN, you may clear or keep `lastEvaluationReport` (a stale FAIL report should not imply a current failure — prefer clearing it).
- Output the report to chat:

```
Feature F<ID> — <name>

State: CLEAN | FAIL→(looped) | PENDING | ABORTED
Attempts used: <attempt> / <maxFixAttempts>

Quality gates:
✓ <gate-id> passed
✗ <gate-id> failed: <message> (<command>)

Observable criteria:
✓ <crit-id> — <evidence / screenshot path>
✗ <crit-id> — <what was missing>

Surfaces evaluated:
- <surface-id>: <result>

Environment:
✓ contract met  |  ✗ not met → PENDING (<which prerequisite>)

Findings:
- <key deviations the evaluation found>

Next:
- CLEAN → feature ready for the next stage
- PENDING → needs human intervention: <what>
- ABORTED → tried <N> fixes without converging; see last evaluation-report.json
```

---

## RULES

**Always:**
- Treat `contract.md` as the single source of acceptance criteria.
- Abort the evaluation if the Environment Contract is not met, and say it is an environment problem (→ PENDING).
- Run the contract's Quality Gates as objective checks before/with functional inspection.
- Derive the state from contract adherence, with evidence per criterion.
- Own the loop: keep `attempt`/`maxFixAttempts` in `progress.json` and decide CLEAN/FAIL/PENDING/ABORTED.
- On FAIL, write `evaluation-report.json` and dispatch `fix-runner`; re-evaluate after each correction until CLEAN, PENDING, or ABORTED.
- Increment `attempt` once per fix-runner round; never loop without incrementing.

**Never:**
- Alter production code or "fix" the feature yourself — correcting is the `fix-runner`'s job.
- Approve based on visual perception without running the objective gates.
- Evaluate a feature without a `contract.md`.
- Invent criteria not present in the contract.
- Exceed `maxFixAttempts` without marking ABORTED.
- Write `PENDING_EVALUATION` into `progress.json` — that is the implementer's pre-state; the evaluator writes CLEAN/FAIL/PENDING/ABORTED.
- Confuse an environment failure (PENDING) with an implementation failure (FAIL).

---

## Edge Cases

**No contract.md for the feature**: abort and direct the user to `spec-writer`.

**progress.json missing**: create it with `config.maxFixAttempts` = 3 and this feature's entry.

**Environment Contract not met**: state = PENDING, clearly labeled as environment, no fix-runner dispatch.

**Gate command not runnable in this environment** (e.g. missing toolchain): treat as PENDING for that gate (needs environment), not FAIL — do not send the fix-runner after an environment gap. Note it in the report.

**maxFixAttempts reached**: state = ABORTED; keep the last `evaluation-report.json` for inspection.

**fix-runner reports "not resolved"**: increment `attempt`; abort to ABORTED if the limit is hit, otherwise re-evaluate.

**Override `max N attempts`**: use N for `maxFixAttempts` this run (and persist it to `config` if the user intends it to stick — otherwise apply for the session only and note it).

**Observable criterion is runtime-only and the runtime can't be exercised**: PENDING for that criterion (human/environment), not FAIL.

**Feature already CLEAN in progress.json**: re-running is allowed (idempotent re-check); report the result and refresh state.

**Cross-feature criteria**: if the contract references behavior provided by another feature, evaluate only this feature's surface; note cross-feature dependencies in findings rather than failing on another feature's gap.
