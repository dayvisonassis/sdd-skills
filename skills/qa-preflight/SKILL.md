---
name: qa-preflight
description: The gate between a finished feature and the human QA. Investigates the delivered feature against its spec and the running screen, executes what is automatable, dispatches the existing correctors for defects that are objectively wrong, leaves a permanent guard so each defect cannot return unnoticed, and writes a QA plan (md + csv) plus a findings report carrying only what needs human judgement. Invoked by a HUMAN when the feature is done — never by spec-writer, implement-feature or evaluator.
---

# QA Preflight

A gate, not a plan generator. A plan generator moves work onto the human; this **removes**
work from the human and uses what remains as the definition of what actually needs a person.

> Base doc: `../../docs/Skill_QA_Preflight.md` (rationale and the decisions behind each rule).
> References, loaded on demand: `references/qa-practices.md` (how cases are derived),
> `references/report-template.md` (the exact output skeletons).

**Standalone by decision.** No other skill invokes this one. It runs when the feature is
**done**, on explicit human request. Running it mid-implementation produces noise about code
that is still moving.

**It owns no correction logic.** Defects are fixed by dispatching the correctors that already
exist, with the discipline they already have.

**One carve-out, and only one: the permanent guard.** No test-writer covers a browser-level
assertion suite, so when the visual gate is enabled the skill writes that assertion itself.
This is guard code, not product behaviour — it changes what is *checked*, never what the
application *does*. Production code stays off-limits under every circumstance, and the guard
still goes through the checkpoint like any other change.

## INPUT

- **Target feature** (ID, e.g. `F08`).
- Auto-discovers: the feature's `spec.md` / `plan.md` / `contract.md`, its PRD section,
  `progress.json`, the routes and permission blocks it added, and its diff against the
  integration branch.
- Reads the project's design-system skill when one exists (for the numeric values the
  accessibility axis asserts). Without it, the accessibility axis falls back to the generic
  WCAG floors in `references/qa-practices.md`.

## OUTPUT

- `docs/qa/QA-<FEATURE>.md` — the plan the human QA executes.
- `docs/qa/QA-<FEATURE>.csv` — the same matrix, importable as a database.
- `docs/qa/ACHADOS-<FEATURE>.md` — what was found, what was fixed, what was escalated, and
  the permanent guard proposed for each finding.
- Zero or more correction commits, **made by the dispatched skills**, never by this one.

---

## PHASE 1 — Investigation

### 1.1 Environment preflight

Run these **before anything else** and stop at the first failure, naming it. A session that
dies in timeouts teaches nothing about the product.

| Check | On failure, say |
|---|---|
| Frontend answers on the base URL | "the app is not answering at `<url>` — bring the stack up" |
| **The served bundle is current** | "the dev server is serving a stale bundle — its last build failed: `<error>`" |
| Backend answers | "the API is not answering at `<url>` — the screen will render empty" |
| Browser runner installed | "`@playwright/test` is declared but not installed — run the install at the repo root" |
| Automated login works | see below |
| The account's tenant has data for this feature | "the account `<login>` sees no data for this feature — seed it, or nothing can be measured" |

**`HTTP 200` does not mean the code under test is the code on disk.** A dev server whose
last build failed keeps serving the previous bundle, happily and indefinitely. Read the dev
server's log for a build error before trusting anything measured afterwards — in a real run,
`ng serve` had been stuck on leftover merge-conflict markers for hours, the preflight passed
it, and a CSS fix appeared not to work because the browser was three hours behind the tree.

**On login, and this is not negotiable:**

> **Never seed a session, forge a token, or bypass an anti-bot protection.** Check whether
> the development environment offers a documented non-production escape hatch (a flag that
> disables verification outside production). If it does, use it and say so in the plan's
> prerequisites. If it does not, **stop and report** — an environment that cannot be driven
> is a finding for the team, not an obstacle to work around.

**Log in once and reuse the session.** Save the authenticated storage state after the first
login and reuse it for every case. Logging in per case throws dozens of attempts at the auth
endpoint and trips the rate limiter: a real run produced **HTTP 429** midway, and three cases
failed in a way that looked exactly like a product defect. When a 429 appears, say so — it is
an artefact of how the run was driven, not a finding about the feature.

> Reusing a session you obtained legitimately is **not** forging one. The rule above forbids
> manufacturing access the application did not grant; it does not require throwing away access
> it did.

### 1.2 Read

Spec, plan, contract and the PRD section. The routes the feature added and the permission
required by each. The templates it changed. The tests and gates that already cover it — that
is where the `Verificado por` column comes from.

### 1.3 Execute

Drive the real screen with the `playwright-cli` skill:

- **every control**, one at a time — a screen that loads is not a screen that works;
- **every filter with a value that returns results** — an empty result validates nothing;
- **the empty state, and the failure state**, which must not look alike;
- **both themes, dark first**;
- **each profile** that sees the feature, when more than one does.

Record for each case whether it was executed and what was observed. **Anything not
exercised is inconclusive** — never recorded as working.

**Measure only after the value settles.** An element that is still animating reports a
smaller box: poll the measurement until it repeats, then assert. Waiting on the element's own
animations is not enough — a dialog's scale usually lives on an overlay above it, so its
subtree reports nothing to wait for. Polling the value is animation-agnostic and measures the
thing you care about rather than a proxy for it.

**A value that changes with something it cannot depend on is a measurement bug, not a
defect.** A height that differs between colour themes is the clearest example. Re-measure
before classifying: a real run reported a 33px field that did not exist, and the settled
value was exactly the 38px the design system specifies.

### 1.4 Classify

Every divergence goes through the fix × escalate rule below. The output of phase 1 is a
short inventory — surfaces, actors, non-obvious rules, risks in order — plus the classified
findings. No file is written yet.

---

## PHASE 2 — Checkpoint (mandatory)

Present the inventory and the findings **split in two lists**: what will be fixed, and what
goes to the QA. Then stop.

> **No correction happens before human approval — including the mechanical ones.**

If this skill is ever dispatched non-interactively, it **does not skip the checkpoint**: it
stops and reports that it needs one. Editing already-validated code with nobody looking is
the failure mode this phase exists to prevent.

---

## PHASE 3 — Correction (by dispatch)

For each approved finding, emit an entry in the report schema
(`../evaluator/references/evaluation-report-schema.md`) and dispatch by `kind`:

| `kind` | Meaning | Dispatch to |
|---|---|---|
| `gate` | a declared gate is violated | `fix-runner` |
| `observable-criterion` | a contract criterion is not met | `fix-runner` |
| `qa-finding` | a real defect **no contract criterion covered** — `ref` is the QA case ID | `fix-runner` |
| `test` | coverage missing for a rule already in the code | the matching test-writer (`unit` / `integration` / `monorepo`) |

**Re-execute what was corrected** before moving on. The plan must describe the fixed
product; writing it first would document the defect as if it were the behaviour.

One finding per dispatch. If a correction comes back "not resolved", the finding moves to the
escalated list with that reason — it is never silently dropped.

---

## PHASE 4 — Delivery

Write the three artifacts using `references/report-template.md` verbatim for structure, and
derive the cases with `references/qa-practices.md`.

**The matrix carries one block per area.** Functional blocks use the feature's own area names
(`CT-AGENTES`, `CT-DATAS`…). The four cross-cutting axes are always present, with reserved
names and a fixed derivation technique:

| Block | Derived by |
|---|---|
| Functional blocks | state transition + decision table for interacting controls |
| `CT-FRONTEIRA` | equivalence partitioning + boundary values on every input |
| `CT-PERMISSOES` | profile × action matrix, including the disabled state **and the reason in its tooltip** |
| `CT-FALHA` | per load: success, legitimate empty, error, and the business 409/422 |
| `CT-ACESSIBILIDADE` | the WCAG 2.2 AA checklist, dark theme first, contrast composed over the real background |

### Self-audit — refuse your own output

Do **not** write the files if any of these holds; fix first:

- an acceptance criterion of the feature has **no case**;
- a case has **more than one** expected result;
- a case **depends** on a previous one;
- an expected result requires **judgement** instead of observation;
- any case was left with an **empty `Verificado por`**;
- a case the skill did not execute carries a filled `Resultado Obtido`.

---

## The fix × escalate rule

**When in doubt, escalate.** The cost of escalating something fixable is a few minutes of a
human's time. The cost of "fixing" something ambiguous is a silent behaviour change in code
that was already validated.

| Fix (mechanical, verifiable, no judgement) | Escalate (always) |
|---|---|
| A deterministic rule a gate already encodes | **Spec and behaviour disagree** — which one is wrong is a product decision |
| Contrast below the floor **when a correct token exists**, measured before and after | A business rule that is ambiguous or written nowhere |
| UI copy factually wrong against the implemented behaviour | Any change to an API contract, schema or migration |
| A message key that does not exist falling back to the wrong label | Any file outside the feature — third-party legacy, another line of work |
| Missing coverage for a rule **already in the code** → dispatch the test-writer | Aesthetics, density, hierarchy — visual judgement |
| | Anything the skill could not execute (hardware, telephony, credentials, a second tenant) |

### The golden rule

> **"Nothing to measure" is inconclusive, never passed.** A case the skill could not
> exercise goes to the QA marked as such — screen without data, element that never appeared,
> assertion that never ran.

This rule exists because a real visual suite reported green while three of its assertions
skipped themselves for lack of data, and the contrast assertion — the reason the suite
existed — had never executed once. When it finally ran, it found a badge at 4.15:1 against a
4.5 floor.

---

## RULES

**Always:**
- Run the environment preflight first, and name the failing check.
- Stop at the checkpoint and wait for approval before any correction.
- Dispatch the existing correctors; re-execute what they corrected.
- Log in once and reuse the session across every case.
- Confirm the dev server's last build succeeded before trusting a measurement.
- Let a measured value settle before asserting on it.
- Leave `Status` empty — the verdict is the QA's.
- Record provenance in `Verificado por` for **every** case.
- Write the blocking reason whenever a case cannot be executed.

**Never:**
- Edit production code directly — the only code this skill writes is the permanent guard.
- Skip the checkpoint, even when dispatched non-interactively.
- Seed a session, forge a token, or bypass an anti-bot protection.
- Mark an unexecuted case as verified, or fill `Resultado Obtido` for one.
- Report a rate-limit or stale-bundle artefact as a product defect.
- Write an assertion into a visual suite that is **not enabled** — deliver it ready in the
  findings report instead.
- Touch files outside the feature under validation.
- Validate a filter with a value that returns an empty result.

---

## Edge cases

**The feature has no `contract.md`** — derive from `spec.md` and the PRD section, and record
in the plan's non-scope that traceability is partial. Do not invent criteria retroactively.

**The screen cannot be reached at all** (route missing, permission denied for every test
account) — stop after the preflight. A plan derived from code alone would describe intent,
not the product.

**A finding is fixable but the fix would touch a file outside the feature** — escalate. The
boundary is the file, not the difficulty.

**The correction breaks something else** — the dispatched corrector revalidates locally and
returns "not resolved"; move the finding to escalated with that reason and continue.

**Two profiles disagree about what should be visible** and the spec is silent — that is a
`CT-PERMISSOES` case escalated with both observations, not a defect to fix.

**The visual gate is enabled in this project** — then, and only then, the proposed assertions
are written into the suite and proven to fail before the fix and pass after it.
