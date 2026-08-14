# QA practice base

Loaded on demand by `qa-preflight`. Portable on purpose: nothing here names a project, a
screen or an account. Project-specific values live in the calling `SKILL.md` or in the
project's design-system skill.

---

## Black-box derivation techniques

Cases are **derived**, never brainstormed. Each technique answers a different question, and
naming the technique in the plan is what lets a reviewer judge whether coverage is real.

### Equivalence partitioning

Split each input into classes the system should treat identically, then take **one** value
per class. Two values from the same class add execution time and no information.

*Generates:* for a status filter with five statuses and an "all" option, six cases — not
one per combination.

### Boundary value analysis

At every boundary, take the value below, the value at, and the value above. Defects cluster
at edges because that is where the comparison operator is written.

*Generates:* for a range with a documented maximum, the maximum, maximum−1, maximum+1, the
empty value and the inverted range (start after end). An inverted range that silently
returns an empty result instead of refusing is a defect, not an empty result.

### Decision table

When the outcome depends on a **combination** of conditions, enumerate the combinations and
mark the expected outcome of each. Collapse rows only when a condition is provably
irrelevant to that outcome.

*Generates:* filters that interact (a text search plus a status plus a date range) — the
case that matters is usually the combination nobody tried, not each filter alone.

### State transition

Model the states and the allowed moves. Test the allowed ones, and **explicitly test that
the forbidden ones are refused** — a state machine that only ever gets exercised on happy
paths is a state machine nobody has verified.

*Generates:* for an entity with a lifecycle, one case per allowed transition plus one per
sink state proving it cannot be left, and one proving a skipped step is refused.

---

## What makes a case usable

Five attributes, and a case missing any of them wastes the tester's time:

| Attribute | Means |
|---|---|
| **Clear** | Unambiguous action and unambiguous expected result |
| **Complete** | Preconditions and test data are stated, not assumed |
| **Traceable** | Points back to the requirement or acceptance criterion it covers |
| **Reusable** | Can be run again next release without rewriting |
| **Independent** | Does not depend on a previous case having run |

Two rules are hard, not stylistic:

1. **One verifiable expected result per case.** If the expected result contains "and", it is
   two cases. A result that needs judgement ("should look right", "should be fast") is not
   an expected result — replace it with the observable value, or move it to a charter.
2. **No case may depend on the previous one.** The tester must be able to run case 47 alone,
   on a Monday, after a database reset. Ordering dependencies turn one failure into a
   cascade of false failures.

---

## Status vs. severity

These are two different questions and a single column cannot answer both.

| Axis | Question | Owned by | Values |
|---|---|---|---|
| **Status** | What happened when the case ran? | QA, at execution | Passou · Falhou · Bloqueado · Não executado |
| **Severity** | How badly does the defect hurt? | QA, technical judgement | Crítica · Alta · Média · Baixa · Cosmética |

**Priority — how urgently it gets fixed — is a product decision and does not belong in the
test matrix.** Severity and priority diverge constantly: a crash in a feature nobody uses is
high severity and low priority; a typo on the login screen is cosmetic severity and urgent
priority. Recording them in the same column destroys both.

A common legacy vocabulary maps like this:

| Legacy value | Becomes |
|---|---|
| Aprovado | Status = Passou |
| Reprovado | Status = Falhou, plus a severity |
| Invalidável | Status = **Bloqueado**, with the blocking reason recorded — it is not a verdict, it is an execution that never happened |
| Pode melhorar | Status = Passou, Severity = Baixa or Cosmética — it is a finding, not a failed test |

---

## Exploratory charters

Some risk does not fit a scripted case: "does anything break when a slow network makes two
requests land out of order?" is a question, not a step list. Those become **charters**, in
one line:

> Explore **&lt;target area&gt;** using **&lt;approach&gt;** to find **&lt;risk or failure class&gt;**

Rules that keep charters honest:

- **Time-boxed.** A charter is a session with an end, not an open invitation.
- **One risk per charter.** Two risks in one charter means neither gets covered.
- **The output is notes plus new cases.** Anything a charter finds that reproduces
  deterministically must be written back as a numbered case, or it will be forgotten.

Charters live in their own section of the plan, never as rows in the matrix — a row with no
deterministic expected result cannot carry a Passou/Falhou.

---

## Manual accessibility checklist (WCAG 2.2 AA)

The subset a human can verify on a screen, without tooling beyond the browser:

| Check | Floor |
|---|---|
| Every interactive element reachable and operable by keyboard | Tab, Shift+Tab, Enter, Space, arrows, Esc |
| No keyboard trap | Esc closes overlays; focus returns to the trigger on close |
| Focus indicator visible | Contrast of at least **3:1** between focused and unfocused states |
| Text contrast | **4.5:1** for normal text; 3:1 for large text |
| Non-text contrast | **3:1** for icons, controls and meaningful graphics |
| Target size | Pointer targets large enough not to require precision |
| Order | Focus order follows the visual/reading order |

Two rules that are easy to get wrong and expensive to miss:

**Compose the background before computing contrast.** An element with a translucent
background is not painted on the colour its CSS declares — it is painted on that colour
composited over whatever is behind it. Measuring against the declared surface produces a
ratio that does not exist on screen. A token created specifically to fix a contrast problem
measured 4.53:1 against a solid surface and rendered **4.15:1** in place, because the real
element carried a translucent tint over the row.

**Validate the dark theme first, then the light one.** Where a person with photosensitivity
follows the validation session, this is an accessibility requirement of the session itself,
not a preference — and the screen should not be left on the light theme at the end.

---

## Two traps that invalidate a whole pass

**An empty result never validates a filter.** Filtering by a value that matches nothing
returns zero rows whether the filter works or is ignored entirely. Every filter case must
use a value that is present in the data.

**"Nothing to measure" is inconclusive, never passed.** A case that could not be exercised —
no data on screen, element never rendered, assertion that never ran — is reported as such.
Recording it as passed is worse than not testing it, because it removes the case from
everyone's attention.
