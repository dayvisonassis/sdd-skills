---
name: implement-feature
description: Implements a feature autonomously based on its spec, plan, AND contract.md, committing one commit per phase, satisfying the contract's quality gates and observable criteria, writing progress.json, and reporting results against the feature's acceptance criteria.
---

# Implement Feature

Autonomously implement a feature from its existing `spec.md` + `plan.md` + `contract.md`. It implements phase-by-phase with per-phase commits, retry policy, and a final verification/AC report, and is **contract-aware** — it must satisfy the contract's environment, quality gates, and observable criteria, and it records the feature's state in `progress.json` so the `evaluator` can pick it up.

> Base docs (in this package): `../../docs/Contrato_de_Feature.md`,
> `../../docs/Como_criar_gates.md`,
> `../../docs/Fluxo_SDD_e_Implementacao_das_Skills.md` (flow + progress.json schema).
> Start with `../../docs/GUIA_DO_WORKFLOW.md` for how the skills fit together.

## INPUT

Free-form. The skill figures out what was passed. Any combination works:

- A feature identifier: `F09`, `Video Upload`, or similar.
- A feature folder: `docs/F09-in-video-transcription-search/`, `./F09/`, etc.
- A file inside the feature folder: `docs/F09-in-video-transcription-search/spec.md`.
- A PRD path: `@docs/PRD.md`, `docs/PRD.md`, `@PRD.md`.
- Extra natural-language instructions appended anywhere (see **Overrides**).

The skill needs to locate three feature files and one reference source:

1. **`spec.md`, `plan.md`, and `contract.md`** for the target feature. If the input points to a folder, look inside. If it points to a file, look in its parent folder. If it points to an ID or name, search under `docs/` for a folder matching `<ID>-*` or whose name kebab-cases to the given name.
2. **The PRD**. If explicitly passed, use it. Otherwise, auto-discover: `docs/PRD.md` → `PRD.md` → any top-level `*.md` whose content reads like a product spec. If none found, abort. If multiple are plausible, abort and list them.

If `contract.md` is missing, the feature was spec'd without a contract. Abort: "contract.md missing in `<folder>` — regenerate the spec with `spec-writer`." (Do not silently proceed without the contract.)

## OUTPUT

- **Commits**: one per phase of `plan.md`, on the current branch (no branch creation, no branch switching).
- **`progress.json`** at the root of `docs/`: the target feature's entry is set to `state: PENDING_EVALUATION`, `attempt: 0` on successful completion (ready for the `evaluator`). See the schema in the flow doc.
- **Chat report** at the end: the feature's acceptance-criteria checklist marked ✓ / ✗ / — against actual test results, plus a **Contract gates** section, plus sections for Deviations, Soft-fails, Pre-existing failures, Overrides applied, Overrides ignored, and Phase status.

No files are written besides code changes, commit objects, and `progress.json`. The chat report is ephemeral.

---

## EXECUTION STEPS

### Step 1: Resolve Input

Parse the entire input as free-form. Extract:

- **Feature reference**: the first token that resolves to a folder containing `spec.md` + `plan.md` + `contract.md`. Matches: ID patterns like `F\d+`, folder paths, file paths (parent folder = target), feature names (kebab-case + fuzzy match to folder names under `docs/`).
- **PRD reference**: an explicit `*.md` path prefixed with `@` or written literally; if it looks like a PRD, accept it. Otherwise auto-discover.
- **Extra instructions**: any remaining text that isn't a path/ID/name — treat as natural-language overrides (Step 3).

If resolution fails:

- No `spec.md` or `plan.md` in the resolved folder → abort: "spec.md/plan.md missing in `<folder>`."
- No `contract.md` in the resolved folder → abort: "contract.md missing in `<folder>` — regenerate with `spec-writer`."
- No PRD found → abort: "No PRD found. Pass the path explicitly."
- Multiple plausible PRDs → abort and list candidates.
- Ambiguous feature reference (multiple folders match) → abort and list candidates.

### Step 2: Load Context

Read in full:

- `spec.md` of the target feature — Component Overview, Data Model, API Contracts, Business Rules, UX Flows, Error Handling, Testing Strategy, Assumptions/Decisions.
- `plan.md` — phases and steps in order.
- **`contract.md`** — Environment Contract, Quality Gates (with their `id`s), Coverage Manifest, Surfaces & Behaviors, Observable Criteria (with their `id`s). These define the technical floor and the observable acceptance the `evaluator` will later check.
- **The PRD's acceptance-criteria content for this feature** — locate it semantically, not by section number. Typical headings: "Acceptance Criteria", "Critérios de Aceitação", "AC". Also locate any cross-feature/integration checklist that references this feature.

If the PRD has no acceptance-criteria content for this feature, proceed with an empty AC checklist and note it under soft-fails.

Do NOT explore the codebase eagerly. Open files lazily as each phase requires them.

### Step 3: Apply Overrides

Interpret extra instructions as natural-language overrides on the defaults:

| Default | Example overrides |
|---|---|
| Hard-fail retry limit = 3 | "no retry limit", "max 5 tries" |
| Fully autonomous | "pause between phases" — skill waits in chat for a reply containing `ok`, `continue`, `segue`, `yes`, or similar |
| 1 commit per phase | "single commit at the end", "no commits, just implement" |
| Run lint + typecheck + tests + contract gates | "skip tests", "skip lint", "skip typecheck" |
| Implement all phases | "only phases 1 and 2", "skip phase 3" — phase positions are ordinal; labels like `A/B/C` map to `1/2/3` |
| Abort tests on external dep missing | "stub missing services", "assume empty response for missing APIs" — substitutes stubs **ONLY in test code**, never in production modules |

For each recognized override, record before/after for the final report's "Overrides applied" section.

**Immutable core (cannot be overridden):** the final AC checklist, its traceability to the PRD, and writing `progress.json` on completion. Instructions that would disable the report or skip the contract gates entirely are logged under "Overrides ignored" with the reason. (Individual gate skips like "skip lint" are allowed and logged as soft-fails.)

Ambiguous or contradictory instructions → default wins; logged under "Overrides ignored" with "ambiguous, kept default".

### Step 4: Pre-flight Dependency Check

Locate the dependency content in the PRD semantically (typical headings: "Dependency Graph", "Dependencies"). For each listed dependency of the target feature, verify it appears implemented in the codebase (look for the characteristic files described in that dependency's own `spec.md` Component Overview, or obvious source-level markers).

- Any dependency missing → **abort before any implementation**. Report: "F<target> depends on F<N>, which is not implemented yet."
- All dependencies present → proceed to Step 5.

If the PRD has no dependency content, skip this step.

### Step 5: Execute Phases

For each phase of `plan.md`, in order:

**5.1 — Skip if already done**

Inspect the last ~20 commits on the current branch. If any commit message indicates this exact phase already ran (same feature ID + phase name or ordinal), skip the phase with status `— already committed` and move on. Detection is best-effort: match on feature ID plus normalized phase name or phase index.

**5.2 — Implement**

Read spec.md sections relevant to the phase. Edit/create files to fulfill the phase's steps.

**What counts as "done" for a phase** — all of the following, not just "I wrote the code":

- Every file listed for this phase in spec.md's Component Overview exists and contains the described content.
- Every contract (API, schema, function signature) described for this phase matches what was written.
- Validation in 5.3 passes (hard fails resolved).
- If the phase produces runtime behavior that isn't covered by unit tests (UI pages, server routes, migrations, CLI commands), actually exercise it before claiming done: run the dev server / build / migration / command against a local environment and confirm it behaves. If the environment can't be brought up in this run, log the runtime-check under `Soft-fails`.

Writing code without running it is not "done". Declaring completion without meeting the checklist above is a violation of the skill's contract.

Adapt when reality diverges from the spec (column named `pinned` in DB vs `isPinned` in spec, different component file name, slightly different path, structurally compatible types). Specs are never 100% faithful to reality — adaptation is expected. Record every adaptation in a `Deviations` list. Do NOT abort on minor divergences.

**Abort the entire run only on:**

- Dependency feature missing (usually caught in Step 4; if discovered mid-phase, abort here).
- Hard fail past the retry limit in Step 5.3 below.

Missing external dependencies needed only by *tests* (e.g., `OPENAI_API_KEY` unavailable) do NOT abort the run — they soft-fail the affected test. The implementation code that calls the service is still written.

**5.3 — Validate**

Discover validation commands at runtime: inspect `package.json` `scripts`, or for non-Node stacks inspect the equivalent (`Makefile`, `pyproject.toml`, `Cargo.toml`, `vitest.config.*`, `jest.config.*`). Run the available ones. **Additionally, prefer the gate commands declared in `contract.md`'s Quality Gates** when they exist — those are the canonical commands the `evaluator` will run.

- **Hard fail** = non-zero exit from lint, typecheck, unit tests, or a **contract quality gate**, where the failure is attributable to code this run changed. Retry up to the configured limit (default 3). Each retry reads the error, adjusts the code, re-runs. After the limit, abort the whole run and go to Step 6.
- **Soft fail** = validation cannot execute in this environment (e2e requiring browser/server not present; integration test requiring an external credential not set; suite explicitly marked non-runnable; command not found). Skip, log under `Soft-fails`, proceed.
- **Pre-existing failure** = validation fails but the failure is not attributable to code this run changed. Log under `Pre-existing failures`, do NOT count against the retry budget, proceed.

Warnings without non-zero exit are never failures.

**5.4 — Commit**

If validation passed (all hard fails resolved; only soft fails and pre-existing failures remain), stage only the files this phase touched and commit with a message summarizing the phase. Match the project's commit style by inspecting the last ~10 commit messages. Fallback: `feat(F<ID>): <phase name>`.

Stage specific files only (no `git add -A` / `git add .`). Commit on the current branch. Do not skip hooks.

If an override disabled commits, skip this sub-step and keep working-tree changes.

**5.5 — Proceed**

Move to the next phase. A run-level abort (hard fail past retry limit, dependency missing mid-phase) stops execution and goes to Step 6 with whatever phases already committed.

### Step 6: Final Verification

After the last phase commits (or when the run aborted), run an independent verification pass over the whole feature before writing the report. This step exists because per-phase checks can miss regressions, and because AI commonly claims "done" when it isn't.

Perform all of the following — no step is optional:

**6.1 — Full-suite validation (including contract gates)**

Run the full validation suite on the entire repo (not just touched files): lint, typecheck, and the complete test suite as defined by the project, **plus every Quality Gate declared in `contract.md`** (typecheck, lint, build, tests, arch, etc.). Do NOT filter to files this run changed.

- If failures appear that weren't flagged per-phase → they count as **regressions**. Attempt to fix up to the retry limit. If still failing, do NOT declare success — status becomes `completed with regressions` and the failures are listed under `Regressions`.
- A failing **contract gate** that this run's code caused is a regression; record which gate `id` failed.
- Pre-existing failures already logged in Step 5.3 stay categorized as pre-existing.

**6.2 — Component Overview walk-through**

Read spec.md's Component Overview and, for every file listed, verify: the file exists, its described role is visible in the content, and its contracts (exports, routes, schemas) match the spec within the adaptation rules of Step 5.2. Any missing file/export/contract → add to `Missing from spec`. Do NOT claim success if this list is non-empty.

**6.3 — AC + Observable Criteria re-check**

For each acceptance criterion loaded in Step 2, locate the test(s) mapped to it via spec.md's Testing Strategy. Run those tests fresh right now. Mark the AC ✓ only if the test passes. If the test no longer passes → mark ✗, add to `Regressions`.

**(v2) Additionally**, for each **Observable Criterion** in `contract.md` that is unit/integration-testable, confirm a test or check covers it. Observable criteria that require runtime exercise (UI rendering, redirects) are checked in 6.4; the rest should have coverage. ACs/criteria without mapped tests remain `—` (no test) — they will be the `evaluator`'s job.

**6.4 — Environment smoke check (when applicable)**

If the feature produces runtime surfaces that per-phase validation couldn't exercise (UI page, HTTP endpoint, migration, CLI command), do one final exercise of each against a local environment. Use the **Environment Contract** in `contract.md` to know what must be up. A quick load-and-interact is enough.

If the environment cannot be brought up in this run, log each skipped smoke check under `Soft-fails`.

**6.5 — Status decision**

The run's final status is determined by this step, not by whether phases committed:

- `success` — full suite + contract gates green, every Component Overview item present, every AC's test passes in 6.3, every smoke check passed or soft-failed.
- `completed with regressions` — phases committed but 6.1 or 6.3 uncovered failures (including contract-gate failures) that the skill couldn't resolve.
- `incomplete` — `Missing from spec` (6.2) is non-empty.
- `aborted at phase <N>` — run stopped during Step 5 before reaching here.

Never report `success` when any of the checks above has an unresolved failure, even if every phase individually committed clean.

### Step 7: Write progress.json

Update (creating if absent) `progress.json` at the **root of `docs/`**, setting the target feature's entry:

```json
{
  "config": { "maxFixAttempts": 3 },
  "features": {
    "F<ID>": {
      "state": "<see below>",
      "attempt": 0,
      "lastEvaluationReport": null,
      "updatedAt": "<ISO timestamp>"
    }
  }
}
```

- On `success` → `state: "PENDING_EVALUATION"` (ready for the `evaluator`).
- On `completed with regressions` / `incomplete` / `aborted` → `state: "PENDING_EVALUATION"` as well **only if** the user should still run the evaluator; otherwise leave a clear note in the report. Default: write `PENDING_EVALUATION` only on `success`, and for non-success leave `state` unset/untouched so the user fixes the build first. (The evaluator owns CLEAN/FAIL/PENDING/ABORTED — never write those here.)
- Preserve any existing `config.maxFixAttempts`; do not overwrite other features' entries. Merge, don't replace the file.

### Step 8: Final Report

Output the report to chat. Status comes from Step 6.5, never from "I think I finished":

```
Feature F<ID> — <name>

Status: success | completed with regressions | incomplete | aborted at phase <N>
Phases: <N> committed / <M> total
Branch: <current-branch>
progress.json: state set to <PENDING_EVALUATION | untouched>

Acceptance Criteria (re-checked in Step 6.3):
✓ <AC text> (covered by <test name>)
✗ <AC text> (test failed after <K> retries: <error summary>)
— <AC text> (no test covers this AC — evaluator will check)

Contract gates (from Step 6.1):
✓ <gate-id> passed (<command>)
✗ <gate-id> failed: <error summary>

Observable criteria coverage (from Step 6.3):
✓ <crit-id> covered by <test>
— <crit-id> runtime-only (evaluator will check)

Cross-feature integration (if any):
✓ <criterion> (covered by <test name>)

Missing from spec (from Step 6.2):
- <file/export/contract that the spec required and is missing>

Regressions (from Step 6.1 or 6.3):
- <test or gate-id> started failing during this run: <error>

Deviations:
- <what was adapted and why>

Soft-fails:
- <what was skipped and why, including runtime smoke checks not exercised>

Pre-existing failures:
- <test name>: failed on entry to this run; left as-is

Overrides applied:
- Retry limit: 3 → unlimited

Overrides ignored:
- "<text>" (reason)

Abort reason (if status is aborted): <error>
```

If aborted, the report still lists whatever committed phases achieved and clearly marks which phase failed and why.

---

## RULES

**Always:**
- Require `spec.md` + `plan.md` + `contract.md` in the target folder; abort without any of them.
- Locate AC and dependency content in the PRD semantically, never by fixed section number.
- Commit 1 per phase (default), staging only the files that phase touched.
- Match the project's recent commit-message style.
- Adapt to minor spec/code divergences; log every adaptation under `Deviations`.
- Run validation after each phase, including the contract's Quality Gates; differentiate hard-fail (retry ≤ limit) from soft-fail (skip + log) from pre-existing failure (log, don't retry).
- Before claiming a phase is "done": confirm every file listed for that phase exists with the described content AND validation has passed. Writing code without running it is never "done".
- For phases that produce runtime surfaces, actually exercise them against a local environment (per the contract's Environment Contract) before claiming done, or soft-fail the runtime check.
- Execute Step 6 (Final Verification) in full, including all contract Quality Gates, before reporting.
- Write `progress.json` (Step 7) on completion; set `PENDING_EVALUATION` on success.
- Derive the final status exclusively from Step 6.5.

**Never:**
- Claim the run is `success` when Step 6 found regressions (including failing contract gates), missing-from-spec items, or unresolved failures.
- Skip the AC report or its traceability (immutable core).
- Skip Step 6 (Final Verification) or the contract Quality Gates wholesale.
- Write CLEAN / FAIL / PENDING / ABORTED into `progress.json` — those states belong to the `evaluator`. This skill only writes `PENDING_EVALUATION`.
- Create or switch branches.
- Abort on name/path/type cosmetic divergences.
- Abort on external dependency missing for a test — soft-fail the test, keep implementing.
- Use `git add -A` or `git add .`.
- Skip git hooks.
- Count pre-existing test failures against the retry budget.
- Re-run phases already committed on the branch (detected by commit-message match).
- Insert service stubs in production modules — stubs are allowed only in test files.
- Explore the codebase upfront with a broad sweep — read files lazily as phases require.
- Modify gate infrastructure to make a gate pass — that is built by `gate-builder`, not here.

---

## Overrides

Free-form instructions at the end of the invocation override defaults. Examples:

- **Retry limit**: `no retry limit`, `max 5 tries`.
- **Autonomy**: `pause between phases` — waits for user reply (`ok`, `continue`, `segue`, `yes`, etc.) after each phase.
- **Commit strategy**: `no commits, just implement`; `single commit at the end`.
- **Validation**: `skip tests`, `skip lint`, `skip typecheck` — individual gate skips are logged as soft-fails.
- **Phase selection**: `only phases 1 and 2`, `skip phase 3` — phase positions are ordinal; labels `A/B/C` map to `1/2/3`.
- **External services**: `stub OpenAI`, `assume empty response for missing APIs` — stubs apply ONLY in test code; production modules keep the real call.

Unrecognized or contradictory overrides: default wins; logged under `Overrides ignored`.

**Immutable core**: the AC checklist, its traceability to the PRD, and writing `progress.json` on success cannot be overridden. Skipping ALL contract gates is ignored; skipping an individual gate is allowed and soft-failed.

---

## Edge Cases

**No PRD found**: abort before starting.

**No spec.md or plan.md**: abort before starting.

**No contract.md**: abort and direct the user to `spec-writer` to generate the contract.

**Dependency feature not implemented**: abort at Step 4 with a clear message.

**Ambiguous feature reference**: list candidates, abort asking which.

**Working tree has unrelated changes at start**: proceed anyway — commits stage only the specific files each phase touched.

**Phase name contains special characters**: fall back to `feat(F<ID>): implement phase <N>`.

**Re-invocation after a partial run**: Step 5.1 detects already-committed phases by commit-message match and skips them. Uncommitted working-tree changes from a prior interrupted run stay as-is.

**Contract gate command not discoverable / not runnable in this environment**: soft-fail that gate, log it, and proceed — but note in the report that the `evaluator` will still enforce it.

**Hard fail past the retry limit on a step/gate that isn't part of any AC**: abort anyway — the skill cannot judge which failures are "acceptable". User can override with `skip tests` or similar.

**External tool emits warnings, not errors**: warnings are not failures. Only non-zero exit codes count.

**Override contradicts the core contract** (e.g., `drop the contract gates`): ignore it, log under `Overrides ignored`, proceed enforcing the gates.

**progress.json already exists**: merge the target feature's entry; never overwrite other features or `config`.

**PRD has no AC content for this feature**: proceed with empty AC checklist and note under soft-fails. The contract's Observable Criteria still apply.

**PRD has no dependency content**: skip Step 4 and proceed.

**Commit-message style is inconsistent in recent history**: fall back to `feat(F<ID>): <phase name>`.
