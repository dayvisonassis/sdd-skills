---
name: fix-runner
description: Specialized, lightweight corrector dispatched by the evaluator on FAIL. Reads the structured evaluation-report.json, applies the minimal fix for the reported problem, locally revalidates the failing gate/test, commits (one commit per correction), records the attempt in progress.json, and returns control to the evaluator for re-confirmation. Does not implement new features, does not orchestrate the attempt loop, and does not decide ABORTED.
---

# Fix Runner

A surgical corrector. When the `evaluator` returns **FAIL**, it dispatches `fix-runner` with a structured error report. `fix-runner` fixes **only** the reported problem, with the smallest footprint, then hands control back to the `evaluator` to re-confirm. It is deliberately smaller and more focused than `implement-feature`: it corrects, it does not build.

> Base docs: `../../docs/Skill_Fix_Runner.md` (full rationale),
> `../../docs/Contrato_de_Feature.md` (contract criteria),
> `../../docs/Fluxo_SDD_e_Implementacao_das_Skills.md` (flow, handoff, progress.json).
> Report schema: `../evaluator/references/evaluation-report-schema.md`.

**This skill is stateless about the loop.** The `evaluator` owns the attempt counter, the limit N, and the ABORTED decision. `fix-runner` performs **one** correction per invocation.

## INPUT

- **Target feature** (ID) and the **path to `evaluation-report.json`** (passed by the evaluator). The on-disk report is the source of truth.
- If no report path is given, auto-discover the feature's `evaluation-report.json` in `docs/<feature-id>-<kebab>/` and `lastEvaluationReport` in `progress.json`.
- Auto-discovers: the feature's `contract.md` and `progress.json`. Reads `spec.md`/`plan.md` lazily, only for the context the fix needs.

If no error report can be found, abort: "fix-runner requires an evaluation-report from the evaluator."

## OUTPUT

- A **minimal code correction** for the reported failure(s).
- **One commit** per correction — `fix(F<ID>): <error summary>` (or the repo's style). Stage only the touched files.
- A light update to `progress.json` recording that a correction was applied for the current `attempt` (does NOT decide the state).
- A signal back to the evaluator: **"correction applied — re-evaluate F<ID>"** or **"not resolved — <reason>"**.
- The fix-runner does **not** emit a CLEAN/FAIL verdict — the evaluator re-confirms.

---

## EXECUTION STEPS

### Step 1: Resolve Input

- Resolve the target feature and locate the `evaluation-report.json` (from the passed path, or auto-discover via `progress.json`'s `lastEvaluationReport`). No report → abort.

### Step 2: Load Minimal Context

- Read the `evaluation-report.json`: each `failures[]` entry — `kind`, `ref`, `message`, `location`, `evidence`.
- For each failure, re-read **only** the violated criterion/gate (`ref`) in `contract.md`, so the fix conforms to the contract rather than guessing.
- Read `progress.json` to know the feature and the current `attempt`.
- Read `spec.md`/`plan.md` lazily, only for the slice needed to understand the fix. No broad codebase sweep.

### Step 3: Apply the Minimal Correction

- Fix **exclusively** the reported cause(s), with the smallest footprint. No opportunistic refactoring, no "while I'm here" improvements, no scope beyond the report.
- If the report has multiple `failures[]`, address them together only if they are part of the same root cause; otherwise fix what the report lists, in order.
- Record what was changed and why (for the commit message and the handoff signal).

### Step 4: Local Revalidation

- Run **specifically** the gate/test that failed (from the report's `ref`/`location`), not the whole suite — a cheap smoke check to avoid returning an obviously broken fix.
- If it still fails, adjust **within the same error's scope** and re-run. Do not expand scope to unrelated problems.
- This local check does NOT replace the evaluator — the evaluator re-confirms against the whole contract afterward.

### Step 5: Commit

- One commit, staging **only** the files touched by this correction. Message: `fix(F<ID>): <error summary>` (or match the repo's recent commit style).
- No `git add -A` / `git add .`. Commit on the current branch — never create or switch branches. Do not skip hooks.

### Step 6: Return to the Evaluator

- Update `progress.json`: record that a correction was applied for the current `attempt` (e.g. a note/timestamp). Do **not** set CLEAN/FAIL/PENDING/ABORTED and do **not** increment `attempt` — those belong to the evaluator.
- Signal back:
  - **"correction applied — re-evaluate F<ID>"** when the local revalidation passed and the commit was made, OR
  - **"not resolved — <reason>"** when the fix could not be made within scope (no commit).

---

## RULES

**Always:**
- Act only from an evaluation-report produced by the evaluator.
- Re-read the violated criterion/gate (`ref`) in `contract.md` before fixing, so the fix conforms.
- Fix only the reported cause, with the smallest possible footprint.
- Locally revalidate the failing gate/test before returning.
- Make one commit per invocation, staging only the touched files.
- Hand control back to the evaluator for re-confirmation.

**Never:**
- Implement new features or widen the contract's scope.
- Do opportunistic refactoring outside the reported error.
- Count attempts, decide ABORTED, or emit a CLEAN/FAIL verdict (the evaluator's job).
- Write CLEAN/FAIL/PENDING/ABORTED into `progress.json` or increment `attempt`.
- Use `git add -A` / `git add .`; skip hooks; create or switch branches.
- Read the codebase with a broad upfront sweep — read lazily, scoped to the fix.

---

## Edge Cases

**No evaluation-report found**: abort — the fix-runner needs the evaluator's report to act.

**Report references a `ref` not found in contract.md**: fix from the report's `message`/`location`/`evidence`, and note the missing contract reference in the return signal so the evaluator/spec-writer can reconcile.

**Fix can't be made within scope** (the real cause is outside the reported failure, or requires a spec/contract change): do not stretch scope. Return "not resolved — <reason>" without committing, so the evaluator can decide (re-evaluate, PENDING, or eventually ABORTED).

**Local revalidation can't run in this environment** (missing toolchain/browser): make the minimal fix the report implies, commit, and return "correction applied (local revalidation skipped: <reason>) — re-evaluate F<ID>" so the evaluator runs the authoritative check.

**Multiple unrelated failures in one report**: fix each within its own scope; if one is unresolvable, fix the others, commit, and return a combined signal noting which remain.

**Working tree has unrelated changes**: stage only the files this correction touched; leave everything else untouched.

**Commit-message style inconsistent in recent history**: fall back to `fix(F<ID>): <error summary>`.
