---
name: gate-builder
description: Builds the deterministic quality-gate infrastructure for a project (typecheck, lint with zero-warnings, dependency/architecture checks, tests, dead-code, and a single runGate entry point) from the Deep Analysis Report (+ Architecture Analysis Report). Auto-detects greenfield vs. brownfield, proposes a gate plan for confirmation, then writes the configs/scripts and verifies each gate runs. The gates it builds are later declared in each feature's contract.md by spec-writer.
---

# Gate Builder

Construct the **deterministic quality gates** of a project — the automated, pass/fail checks that guard structural and behavioral integrity (see `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Como_criar_gates.md`). The skill reads the analysis reports, decides which gates the project needs, **proposes a plan**, and — after confirmation — **writes the gate configs/scripts** and a single orchestration entry point (`runGate`), verifying each gate actually runs.

> Where this fits the SDD flow: `gate-builder` builds the gate **infrastructure** that must exist
> **before** features are spec'd. Later, `spec-writer` **declares** these gates (by `id`) in each
> feature's `contract.md`, and `implement-feature` / `evaluator` **execute** them. See
> `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Fluxo_SDD_e_Implementacao_das_Skills.md`
> and `https://github.com/dayvisonassis/sdd-skills/blob/main/docs/Como_criar_gates.md`.

## INPUT

Free-form. The skill needs:

- **Deep Analysis Report** (primary source) — produced by the `deep-analyzer` agent. Provides cross-cutting patterns, anti-patterns, test gaps, config-access patterns (e.g. scattered `process.env`), and complexity.
- **Architecture Analysis Report** (secondary source) — produced by the `architecture-analyzer` agent. Provides the stack/runtime/framework, dependency inventory, and the test infrastructure/tooling.
- Auto-discovery: if paths are not passed, look in `docs/architecture/` for the most recent `deep-analysis-*.md` (primary) and `architecture-analysis-*.md` (secondary).
- Optional free-form overrides — e.g. "lint only", "no dead-code gate", "strict zero-warnings now", "don't touch package.json".

If neither report is found, the skill can still operate in a reduced mode by reading the codebase directly (see Edge Cases), but the reports are strongly preferred — request them if the codebase is large/ambiguous.

## OUTPUT

- **Phase 1 — a Gate Plan** (chat + saved doc): which gates, which commands/configs, greenfield vs. brownfield strategy, and the `runGate` order. Each gate gets a stable `id` (`typecheck`, `lint`, `build`, `tests`, `arch`, `deadcode`, ...) — the same `id` spec-writer will use in `contract.md`.
- **Phase 2 — after confirmation — the gate infrastructure**: config files, scripts, `package.json` (or equivalent) entries, and the `runGate` orchestrator, plus a short `GATES.md` documenting how to run them.
- A **verification report**: each gate executed once, with pass/fail and notes (especially the brownfield baseline of pre-existing warnings/failures).

No application/business code is modified — only gate configuration, scripts, and docs.

---

## EXECUTION STEPS

### Step 1: Resolve Input & Load Reports

- Locate the Deep Analysis Report and the Architecture Analysis Report (passed paths, or newest in `docs/architecture/`).
- From the **Architecture Report**, extract: runtime/language, framework, package manager, dependency inventory, and the **test infrastructure** (test runner, config files) — Section 2 and Section 11.
- From the **Deep Analysis Report**, extract: cross-cutting patterns (error handling, validation, **configuration access pattern** — §2.5), anti-patterns (circular deps, God objects, N+1, hardcoded config), test gaps, and complexity hot-spots.
- Parse overrides (gate inclusions/exclusions, strictness, "don't touch X").

### Step 2: Detect Project State (greenfield vs. brownfield)

Decide the build strategy:

- **Greenfield** = no real gate tooling exists yet (no lint/typecheck/test config beyond scaffolding defaults; reports show minimal/zero tests). → Build the full gate stack from the stack's conventions.
- **Brownfield** = the project already has some tooling and a body of code. → **Adapt** to the existing commands and configs; integrate gates **without breaking the build**; introduce zero-warnings **incrementally** (see Step 4).

Detection signals: presence of lint/typecheck/test config files and scripts (Architecture §2/§11), amount of existing code, and the test-coverage estimate. State which mode was detected and why.

### Step 3: Select the Gate Set

From `Como_criar_gates.md`, choose the gates the project needs, mapped to the detected stack. Each gate gets a stable `id`:

| Gate `id` | Purpose | Typical command (stack-adapted) | Derived from |
|---|---|---|---|
| `typecheck` | Type contract | `tsc --noEmit` (or stack equivalent) | Architecture stack |
| `lint` | Consistency, zero warnings | `eslint . --max-warnings=0` (or equivalent) | Architecture tooling |
| `build` | Compiles/builds | project build command | Architecture stack |
| `tests` | Behavior | unit/integration test command | Architecture §11 |
| `arch` | Boundaries | dependency-cruiser rules + custom `check-architecture` script | Deep §2/§9 anti-patterns |
| `deadcode` | Hygiene | knip (or equivalent) | Deep test gaps / unused code |

Tailor `arch` to the **anti-patterns and rules surfaced in the reports**: e.g. forbid `domain → infrastructure` imports (circular deps in Deep §9), restrict `process.env` to a single `env` module (Deep §2.5 scattered config), forbid `try-catch` in handlers, flag God objects. Only include gates that make sense for the stack — do not invent a `build` gate for a pure library with no build, etc.

### Step 4: Produce the Gate Plan (Phase 1 output)

Present a plan and **await explicit confirmation** before writing anything. Template:

```
Gate Plan for <project> — mode: greenfield | brownfield

Gates to build:
- [typecheck] tsc --noEmit                         (new config: tsconfig strict)
- [lint]      eslint . --max-warnings=0            (brownfield: warnings baselined, see below)
- [build]     npm run build
- [tests]     vitest run
- [arch]      dependency-cruiser + scripts/check-architecture.ts
              rules: domain↛infrastructure; process.env only in src/env.ts
- [deadcode]  knip

Orchestration: scripts/runGate.mjs runs them in order (cheap→expensive):
  typecheck → lint → build → arch → tests → deadcode  (stops at first failure, exit 1)

Files to create/modify:
- create: .dependency-cruiser.cjs, scripts/runGate.mjs, scripts/check-architecture.ts, GATES.md
- modify: package.json (scripts: "gate", "gate:lint", ...), eslintrc (max-warnings)

Brownfield strategy (if applicable):
- Establish a baseline: record current warnings/failures so the gate fails only on NEW issues
- Enable --max-warnings=0 only after the baseline is clean, OR scope strictness to changed files first

OK to build? (yes/no)
```

For **brownfield**, the plan MUST state how zero-warnings is introduced incrementally (baseline file, or per-directory ratchet, or changed-files-only first) so the gate does not immediately fail on a sea of pre-existing warnings. For **greenfield**, strict gates apply from the start.

Proceed only on explicit "yes". On "no"/ambiguous, save the plan doc and stop without writing gate files. Honor "don't touch X" overrides by excluding those files from the plan.

### Step 5: Build the Gates (Phase 2 — after confirmation)

For each selected gate, in `runGate` order:

**5.1 — Write the config/tooling**
- Create or extend the gate's config (e.g. `tsconfig` strictness, eslint config with `--max-warnings=0`, `.dependency-cruiser.cjs` with the rules from Step 3, a `check-architecture` script encoding project-specific rules, knip config).
- Add/declare any required dev dependencies (respecting the package manager from the Architecture Report). If installation is out of scope or disallowed by an override, declare them in the manifest and note "needs install" in the verification report.

**5.2 — Wire the script**
- Add a per-gate script entry to the manifest (`package.json` scripts or equivalent), each runnable standalone (`gate:lint`, `gate:arch`, ...).

**5.3 — Brownfield baseline (when applicable)**
- For gates that would fail on pre-existing issues (lint zero-warnings, deadcode, arch), capture a baseline and configure the gate to fail only on **new** violations, per the strategy confirmed in Step 4. Document the baseline so it can be tightened later.

**Never modify application/business code to "make a gate pass"** — that is the job of feature work / fix-runner, not gate-builder. Gate-builder only writes gate configs, scripts, and docs.

### Step 6: Build the Orchestrator (`runGate`)

- Create a single entry point (`scripts/runGate.mjs` or the stack's idiom) that runs the gates **in order, cheapest first** (`typecheck → lint → build → arch → tests → deadcode`), **stops at the first failure**, and exits non-zero on any failure.
- Add a top-level `gate` script that invokes it. The orchestrator is what local dev, CI, and the SDD agents (`implement-feature`, `evaluator`) will call.

### Step 7: Verify Each Gate Runs

- Run `runGate` (and each gate individually if the orchestrator stops early). Capture pass/fail per gate.
- **Greenfield:** every gate should pass on the skeleton (or honestly report what's missing — e.g. no tests yet).
- **Brownfield:** confirm gates pass against the baseline (i.e. they don't fail on pre-existing issues) and DO fail on a deliberately introduced violation (a quick sanity check), then revert that probe.
- Record results; do not claim success for a gate that did not actually execute.

### Step 8: Document & Report

- Write `GATES.md`: the gate list with `id`s, the command for each, the `runGate` order, and the brownfield baseline note (if any). This is the human- and agent-readable contract of what gates exist — `spec-writer` reads the same tooling when it declares gates in `contract.md`.
- Output a final report:

```
Gate infrastructure built — mode: greenfield | brownfield

Gates:
✓ [typecheck] runs · passing
✓ [lint] runs · passing (baseline: N pre-existing warnings recorded)
✓ [build] runs · passing
✗ [tests] runs · 0 tests yet (greenfield) — gate present, will enforce once tests exist
✓ [arch] runs · passing (rules: domain↛infra, env-only process.env)
✓ [deadcode] runs · passing

Entry point: `npm run gate` → scripts/runGate.mjs (stops at first failure)
Docs: GATES.md
Next: spec-writer will declare these gate ids in each feature's contract.md
```

---

## RULES

**Always:**
- Prefer the Deep Analysis Report as the primary source and the Architecture Report for stack/tooling; auto-discover the newest in `docs/architecture/` if not passed.
- Auto-detect greenfield vs. brownfield and state the detection and strategy.
- Give every gate a stable `id` (the same id spec-writer cites in contract.md).
- Tailor the `arch` gate to the anti-patterns/rules actually surfaced in the reports.
- Present a Gate Plan and await explicit confirmation before writing gate files.
- In brownfield, introduce zero-warnings incrementally with a recorded baseline — never break the existing build.
- Build a single `runGate` orchestrator (cheap→expensive, stop at first failure, non-zero exit).
- Verify each gate actually runs before claiming success; record the brownfield baseline.
- Only write gate configs/scripts/docs — never modify application/business code.

**Never:**
- Modify application/business code to make a gate pass (that's feature work / fix-runner).
- Invent gates the stack cannot run, or a `build` gate where there is nothing to build.
- Enable `--max-warnings=0` on a brownfield repo with pre-existing warnings without a baseline/ratchet.
- Skip the confirmation gate (Phase 1 → Phase 2) unless an override explicitly authorizes auto-build.
- Claim a gate "passes" without executing it.
- Overwrite an existing gate config wholesale — extend/merge and preserve project intent.
- Touch files excluded by a "don't touch X" override.

---

## Edge Cases

**No reports found:** prefer to request the Deep/Architecture reports. If the user insists, operate in reduced mode by reading manifests + config directly to detect stack and tooling, and clearly flag that the gate selection is inferred without the analysis depth.

**Reports reference a stack with no native typecheck (e.g. plain JS):** skip `typecheck` or substitute a `// @ts-check` + jsconfig approach if the project wants it; document the choice. Do not force TypeScript on a non-TS project.

**Brownfield with many pre-existing lint warnings:** baseline them (record count/list) and configure the gate to fail only on new warnings, or apply zero-warnings to changed files first; tighten over time. State this in the plan and GATES.md.

**Existing `runGate`/gate scripts already present:** treat as brownfield; extend the existing orchestrator and scripts rather than replacing them. Reconcile gate `id`s with what already exists.

**Monorepo / multiple packages:** detect per-package tooling from the reports; either build per-package gates with a root orchestrator that fans out, or scope to the package the user named. State the structure in the plan.

**Dev dependencies cannot be installed in this environment:** declare them in the manifest, wire the scripts, and mark each affected gate "needs install" in the verification report instead of falsely reporting it passing.

**Pure library (no build/runtime surface):** include `typecheck`, `lint`, `tests`, `arch`, `deadcode`; omit `build` if there is genuinely nothing to build. Do not fabricate runtime gates.

**User override "lint only" / excludes a gate:** build only the requested gates; the `runGate` order adapts. Note the omitted gates so they can be added later.

**Gate plan declined (Phase 1 "no"):** save the plan doc to `docs/architecture/` (or alongside the reports) and stop — no gate files written.

**Project-specific rule from the report can't be expressed in a generic tool:** encode it in the custom `check-architecture` script (e.g. "process.env only in env module", "no try-catch in handlers", "composition root only in main") rather than forcing it into dependency-cruiser.
