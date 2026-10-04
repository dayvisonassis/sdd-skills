# E2E Rules — End-to-End Tests (browser flows)

> **Generic rules.** They bind every project; the project's own facts (profile names, folders,
> language, fixtures, data policy) come from its `GATES.md`, never from this file. The
> `e2e-test-validator` audits against these same rules.
>
> **Scope:** the project's e2e suite — `@playwright/test` driving the real app, headless, one
> user flow at a time: **an action and its observable result**.
>
> **"The project has an e2e suite"** means exactly one thing everywhere in the SDD skills:
> **`GATES.md` lists an e2e gate proven green.**

---

## Project profile — read it from `GATES.md` first

The e2e section of `GATES.md` is authoritative. Before writing or validating anything, build this
profile from it. When `GATES.md` is silent on an item, take it from the harness files as the
fallback column says; never from memory of another project.

| Item | What it is | Fallback when `GATES.md` does not state it |
|---|---|---|
| Runner config | the e2e runner config file (`<config>` below) | the file the e2e gate command runs |
| Test directory | root of the suite (`<testDir>`) | `testDir` of `<config>` |
| Profiles | each session: profile name, product role, folder, API fixture, tenant | the projects of `<config>` (name → folder) and the API fixtures the fixtures module exports; a profile declared but absent from `<config>` is not built yet (H1) |
| Test language | language, extension and import form of a spec file | the language of the harness seed tests |
| Fixtures module | path and exports (`test`, `expect`, one API fixture per profile) | the module the seed tests import |
| API origin | env var and default of the backend base URL, and the API path prefix | the base URL the fixtures module uses |
| Build log | where to read the dev server's last build | — |
| Gate | the e2e gate command (`<gate>`) | — |
| Data policy | protected records, configuration, create and remove routes per entity and which profile may use them, parent → child order, hard or soft delete | the defaults of D1–D7 — also when `GATES.md` hands the policy back to these skills |
| Login limit | the authentication rate limit | assume a tight one |
| Other suites | the gate ids of the visual suite (computed values) and of the integration suite (endpoints, permissions, isolation) | `runtime-only` when the project has no such suite |

Notation used below: `<profile>`, `<profileApi>` (its API fixture), `<config>`, `<testDir>`,
`<ext>`, `<gate>`.

A required item — runner config, profiles, fixtures module, gate — that neither `GATES.md` nor
the harness files reveal: the writer stops with *"not resolved — environment: e2e harness not
declared (<item>)"*; the validator reports it in its summary.

---

## Boundary — what is NOT an e2e test

| It asserts... | It belongs to | Not here because |
|---|---|---|
| A **computed value**: contrast, height, density, effective font size, a `getComputedStyle` or `getBoundingClientRect` reading | the visual suite (`out of e2e scope — <its gate id>`), or `runtime-only` without one | that suite measures rendering in every theme |
| An endpoint's status/body, permission, tenant isolation, SQL | the integration suite | it runs without a browser, in seconds |
| One component or service in isolation | the unit suite | it needs no running app |
| **A user acts on the screen and something observable follows** | **the e2e suite** | — |

A visual suite may hold flow cases written before the e2e suite existed, and older contracts may
map UI flows to it. Leave both as they are: follow this table, note the old hint in the
checklist, and never edit the visual suite from these skills. The theme is the visual suite's
concern: an e2e test runs in whatever theme its session carries and never loops over themes.

---

## Harness (built by `gate-builder`, never by these skills)

| Piece | Expected shape |
|---|---|
| Runner config | `<config>`, one project per profile, separate from any visual config |
| Session | stored once by the harness global setup and **reused across runs while still valid** |
| Seed tests | one per profile (`<testDir>/<profile>/harness-seed.<ext>`) — the harness's proof that it runs |
| Fixtures module | exports `test` (extended with the API fixtures) and `expect` |
| API fixtures | one per profile: a request context on the API origin carrying that session's token |
| Log | where to read the dev server's last build |
| Gate | `<gate>` |

- **H1 — The harness must exist:** `<config>` declares a project for the profile the flow needs,
  and the global setup, that profile's seed and the fixtures module exist. Anything missing →
  *"not resolved — environment: e2e harness not built (<piece>)"*. Never create or edit the
  harness from these skills.
- **H2 — Harness files are never created or edited to make a test pass:** the runner config, the
  global setup, the seed tests, the fixtures module, and any module imported only by them (a
  sessions helper, say). A helper or a local `test.extend(...)` inside a spec file is test code
  and is fine; a support module shared between spec files is a shared fixture — the harness's.

---

## File structure pattern

Written in the project's test language (S2). This example is TypeScript ESM, for a project whose
profiles are `manager` and `buyer` (`<testDir>/buyer/f07-ui-01-order-history.spec.ts`):

```typescript
import { test as base, expect } from '../fixtures'

const RUN = `E2E ${Date.now()}`

// One test-scoped fixture per created record (D3): each teardown runs whenever its own setup
// completed, and Playwright tears the order down before the product it depends on.
const test = base.extend<{ product: { id: number }; order: { id: number; number: string } }>({
  product: async ({ managerApi }, use) => {
    const res = await managerApi.post('/api/admin/products', { data: { name: `${RUN} product` } })
    expect(res.ok()).toBe(true)
    const product = await res.json()
    await use(product)
    const removed = await managerApi.delete(`/api/admin/products/${product.id}`)
    if (!removed.ok()) throw new Error(`product ${product.id} left behind: ${removed.status()}`)
  },
  order: async ({ buyerApi, managerApi, product }, use) => {
    const res = await buyerApi.post('/api/orders', { data: { productId: product.id } })
    expect(res.ok()).toBe(true)
    const order = await res.json()
    await use(order)
    const removed = await managerApi.delete(`/api/admin/orders/${order.id}`)
    if (!removed.ok()) throw new Error(`order ${order.id} left behind: ${removed.status()}`)
  }
})

test.describe('F07 UI-01 — order history', () => {
  test(
    'cancelling a pending order asks for confirmation and marks it cancelled',
    { tag: ['@F07', '@UI-01', '@OC-02'] },
    async ({ page, order }) => {
      await page.goto('/orders')
      const row = page
        .getByRole('table', { name: 'Your orders' })
        .getByRole('row')
        .filter({ hasText: new RegExp(`#${order.number}(?!\\d)`) })
      await expect(row).toBeVisible()

      const isCancel = (url: string, method: string) =>
        method === 'POST' && url.endsWith(`/api/orders/${order.id}/cancel`)
      const cancels: string[] = []
      page.on('request', req => isCancel(req.url(), req.method()) && cancels.push(req.url()))

      await row.getByRole('button', { name: 'Cancel order' }).click()
      await expect(page.getByRole('dialog', { name: 'Cancel this order?' })).toBeVisible()
      const cancelled = page.waitForResponse(res => isCancel(res.url(), res.request().method()))
      await page.getByRole('button', { name: 'Yes, cancel' }).click()
      expect((await cancelled).ok()).toBe(true)

      await expect(row).toContainText('Cancelled')
      expect(cancels).toHaveLength(1)
    }
  )
})
```

The session comes from the `buyer/` folder; the manager session is reached only through its API
fixture, for setup and cleanup. The test acts on the order it created, found by its number, and
asserts the request fired exactly once.

- **S1 — Location and name:** `<testDir>/<profile>/<feature-id>-<surface-id>-<kebab>.<ext>`,
  lowercase. A flow that starts on one surface and ends on another lives in the file of the
  surface where it starts and is tagged with both; a surface with no route of its own (a dialog)
  is reached from another surface, so its flows live in that surface's file. Work outside a
  contract uses the route's slug in place of the surface id, in the name and in the tag. When
  that name belongs to an existing file you may not edit (outside correction mode), write a
  sibling file with another kebab.
  **The profile folder decides the session the flow runs in.** Setup and cleanup may use another
  profile only through its API fixture (A3); the flow under test never does.
- **S2 — The project's test language:** the language, extension and import form of the project
  profile — `require('../fixtures')` in a CommonJS suite, `import ... from '../fixtures'` in an ESM
  or TypeScript one. Import `test` and `expect` from the fixtures module when it exists. Never mix
  module systems with the harness.
- **S3 — Traceability tags:** every test carries the feature tag — the feature folder's id,
  `@F14`, `@F08-v2` — and the id of every contract surface it touches (work without a feature
  carries the route's slug tag alone). It carries a criterion's id (`@OC-08`) only when it proves
  that criterion **completely** — every clause of it; a partial proof gets the surface tag alone. Ids repeat across
  features and `@F08` is a prefix of `@F08-v2`, so a query anchors and pairs them:
  `npx playwright test --config <config> --grep "(?=.*@F14(?![\w-]))(?=.*@OC-08(?![\w-]))"`.
- **S4 — English for everything the test authors:** test and describe names, comments,
  variables, helper names; names state the behavior they check. **Product copy is exempt**:
  labels, button names and messages in locators and assertions match the screen verbatim, in the
  product's language, with its accents.
- **S5 — Independence:** each test navigates to its own starting point and depends on no other
  test. No `test.describe.serial`, no state carried between tests, no reliance on file order. A
  fixture that creates data is **test-scoped** — a worker-scoped one shares its records with every
  test after it.

---

## Session

- **A1 — Never log in inside a test, a hook or a fixture.** Authentication is rate limited (the
  project profile gives the limit). A suite that logs in per test spends the budget in one run,
  and the next run fails every case on the sign-in screen — a harness failure that reads exactly
  like product defects. A flow that *is* the sign-in (the login form itself) is not covered by a
  stored session: it belongs to the integration suite, or to `not e2e-testable` reasoning the
  contract accepts.
- **A2 — Never forge a token, seed a session or bypass an anti-bot check.** The only escape hatch
  is a documented non-production setting, which is the harness's concern.
- **A3 — API calls go through the harness API fixtures, to the API origin.** Another profile's
  session is reachable **only** through its fixture; never read a storage-state file yourself. A
  path relative to the page lands on the dev server, not the API. **Every setup call asserts its
  status** (`expect(res.ok()).toBe(true)` or `failOnStatusCode: true`): Playwright's request
  context does not throw on 4xx/5xx by itself. If no fixture serves the session a flow's setup
  needs, that flow falls under D5 — and report the gap.

---

## Assertions

- **V1 — Exercise, don't load.** Every test performs an action and asserts what followed. "The
  page opened and the element is visible" is a smoke check, not an e2e test.
- **V2 — Web-first waits only:** `await expect(locator).toHaveText(...)`,
  `page.waitForResponse(...)` or `page.waitForEvent('download')` registered before the action.
  Never `page.waitForTimeout`, fixed sleeps, or `networkidle`. A snapshot read (`count()`,
  `allTextContents()`) comes only after a web-first assertion proved the state it reads.
- **V3 — Locators by role, label or visible text first**; `data-testid` when the template has
  one. Structural markers are allowed when the accessible name is unstable or absent: a component
  selector, a form control's `name` attribute, a component-scoped class, a table row filtered by
  its visible text. **The test must know the identity of every item it acts on.** Pick it from
  data — a record it created, or an entry of a captured response — and act on it by name or id,
  matched exactly (an anchored pattern, so `#12` does not match `#123`); never act on whatever
  renders first (`nth-child`, `.nth(3)`, `getByRole('option').first()`), and never XPath.
  `.first()` to assert that at least one exists is fine.
- **V4 — Missing data fails, it never skips.** No `test.skip`, no early `return`, no
  `if (count === 0)` branch when the precondition is absent. Assert the precondition
  (`await expect(rows.first()).toBeVisible()`) so an empty screen turns red.
- **V5 — A filter or a scoped list is validated with data in which it can fail.** Use a value
  present in the data and assert the set narrows to exactly it; when the data allows, also show a
  record that must disappear. An empty result validates nothing, and neither does a list that
  would look the same unfiltered (a user who may see everything).
- **V6 — No duplicate requests.** When the action fetches, capture the requests it should fire
  (opening a form may legitimately fire several) and assert their parameters; for every request
  whose duplicate would be a defect — a submit that creates, a search — assert it fired exactly
  once. When the contract names no request for an action, assert none of the known writes fired.
- **V7 — Empty and failure must not look alike.** To test a failure state, force only the
  failing call with `page.route(...)` and assert the error message differs from the empty state.
  Never mock the happy path — a mocked flow is not end-to-end.
- **V8 — Never weaken an assertion to match the screen** — an existing one or one you are
  writing. If the app shows something other than the contract says, the test is right until
  proven otherwise.

---

## Data — the dev database is shared

The app under test writes to the same database other suites and screens read. **These rules bind
every write the skill causes — the tests and the exploration that precedes them.** The project's
data policy (`GATES.md`) names the specifics; without one, the defaults below apply.

- **D1 — Never mutate or hang anything off pre-existing records.** The data policy names the
  records other suites read by id; without a policy, every record the test did not create counts.
  Read them freely; never edit, close or delete one, and never create a child under one. **Never
  press a submit on a form bound to a pre-existing record** — not even to prove it is refused: if
  the refusal is broken, the test writes. Open that form on a record the test owns.
  **Configuration** a record only references (the tenant, lookups, categories) may be referenced
  by what the test creates, but is never edited or deleted. When configuration is itself the
  record under test, it follows D2. Records under a harness account's own session (the orders of
  the buyer the session belongs to) are the test's to create when the data policy says so.
- **D2 — A test that writes creates its own records, parents before children**, marked with a
  unique run token in a visible field (`E2E ${Date.now()}`), through the product — the UI or its
  HTTP API, with the create routes of the data policy. Changing the state of its own records
  through a product route (cancelling its own order) is part of its setup. **Never touch the database directly**: no
  SQL, ORM, database client or database MCP.
- **D3 — Cleanup always runs and never fails silently.** **One test-scoped fixture per created
  record**, each depending on its parent's fixture: each teardown runs whenever its own setup
  completed, so a parent survives no failure of its child's setup, and children are torn down
  before parents. A single record created inside the test body may use `try/finally` instead.
  Records the flow itself creates through the UI (the record a submit opens) are found through a
  parent the test owns and removed in that parent's teardown. Check each removal's status; a
  teardown throws naming what was left behind. A `catch` that swallows a failed removal is never
  acceptable.
- **D4 — Removal goes through the product's delete route**, through the API fixture of a profile
  the data policy allows to use it — the flow may run as one profile while setup and cleanup run
  through another (A3). A soft delete leaves a residue (the row stays, out of every listing): that
  is the accepted end state — record it in the checklist so nobody reads it as a leak.
- **D5 — No removal path, no creation.** If no harness profile can remove what the flow creates,
  the test does not create it: cover the flow on existing data read-only, or mark the behavior
  `not e2e-testable — no removal path` (`no removal path — harness lacks <fixture>` when the cause
  is a missing API fixture).
- **D6 — Exploring a write flow obeys D1–D5 too.** An exploration session has no test fixtures:
  create the records it needs through the API with the attached page's own token (read from the
  live page — never from a storage-state file), checking each status, and remove them the same
  way afterwards. **A submit that creates is either captured and aborted with `page.route(...)`
  before it reaches the backend, or its captured response id is removed afterwards.**
- **D7 — A precondition the test cannot create** (no create route) is read, read-only, from data
  the contract's Environment Contract or the data policy declares — asserted per V4. When nothing
  declares it, the behavior is `not e2e-testable — no creation path`.

---

## Coverage outcomes — the closed list

The writer's coverage table (`docs/<feature-id>-<kebab>/e2e-test.md`) has **one row per row of
the contract's `Test-suite hint` mapped to `e2e`**; rows mapped to other suites are not in it.
Each row gets **one** of these outcomes. The single combination allowed is a row's test titles
next to `disputed` entries for some of its tests — and a row may hold `disputed` entries alone.
The `evaluator`, `implement-feature` and `e2e-test-validator` accept nothing else.

- **Format:** a row's tests as `<title> (<path>)`, separated by `;`, each followed by `— unproven`
  until proven. The outcome strings are written verbatim, in English, whatever the checklist's
  language.
- **An existing test counts for its row only if it conforms to these rules.** One that does not is
  named in the checklist with the rules it breaks, and the row needs a conforming test.

| Outcome | Meaning |
|---|---|
| test titles | existing tests tagged per S3; marked `unproven` until both proving runs of the writer's Phase 3 happened |
| `disputed — <test title> (<path>) — <contract line>` | one test someone believes misreads the contract — see **Disputes** below |
| `not e2e-testable — telephony/hardware` | needs a real call, a device, a physical line |
| `not e2e-testable — second tenant` | needs a tenant the harness accounts do not belong to |
| `not e2e-testable — external credential` | needs a third-party credential the dev stack does not have |
| `not e2e-testable — shared configuration` | would have to change pre-existing configuration other screens read (D1) — not configuration that is itself the record under test |
| `not e2e-testable — no removal path` | D5; `no removal path — harness lacks <fixture>` when an API fixture is missing |
| `not e2e-testable — no creation path` | D7: a precondition nothing can create and nothing declares |
| `out of e2e scope — <suite>` | the behavior is not a flow (a computed value, a theme) — the contract mapped it to e2e by mistake; `<suite>` is the gate id of the suite it belongs to in `GATES.md`, or `runtime-only` |
| `not in this request` | outside what this dispatch was asked to cover; a later dispatch keeps the rows it did not touch as they were |

### Disputes

A dispute is one test, named by its title **and** path, whose expectation someone believes the
contract line does not support. Its lifecycle is the same wherever it starts:

1. **Opened** by `implement-feature` (the writer said "product diverges", the code matches the
   line) or by the `evaluator` (it disagreed with the writer's "product diverges"). The opener
   writes the `disputed` entry **in place of** the test's plain title in its row; the test itself
   is committed or left as it is — the entry, not the commit state, is what stops it being routed.
2. **Counted** as a row outcome: a row whose only content is `disputed` entries awaits
   arbitration and is **not** missing coverage — never dispatched to guard mode.
3. **Arbitrated by the `evaluator` on every evaluation**, in Step 4. It needs a run that included
   that test: when the e2e gate's run did not (a changed-files no-op, a skip flag), the evaluator
   makes the single feature run (`--grep "@<feature-id>(?![\w-])"`) there, and Step 5 reuses it.
   It compares against the contract's **current** line:
   - the current line differs from the one the entry recorded → the contract was changed to
     settle it: close the entry (4) and classify the test like any other e2e test;
   - red, and the product diverges from the line → the test was right: code failure → `fix-runner`;
   - red, and the product matches the line → PENDING for a human with both readings, never routed
     (under `gates only`, which forbids re-observing, a red disputed test is simply PENDING);
   - green → the product and the test agree now: the dispute is moot;
   - the test exists but did not run (skipped) → PENDING for a human: a skip breaks V4, and
     nothing proves the row;
   - absent — no test with that title at that path (`npx playwright test --config <config>
     --list`) → the entry is stale.
4. **Closed only by the `evaluator`**: a closed entry — moot, or settled by a contract change —
   goes back to the test's title marked `unproven`, whoever touched the test in between, so the
   writer proves it and the validator audits it before it counts again; a stale entry is removed,
   and the row is judged on what remains — a row left empty is missing coverage. A test named in a
   `disputed` entry is never also listed by its plain title.
   A human settles a PENDING dispute by changing the contract line, the test or the product; the
   entry closes when that change shows in a later run, never by editing the entry alone. No
   writer ever removes a `disputed` entry. A test file a skill leaves uncommitted is named in that
   skill's own report for the human to commit.

---

## Execution

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test --config <config> <testDir>/<profile>/<file>
<gate>
```

- **E1 — Headless.** Headed runs are for the human smoke test, not for this suite.
- **E2 — Check the environment before trusting a result:** the frontend answers, the backend
  answers, and **the dev server's last build succeeded** — read the build log the project profile
  names for a compile error after the last edit. A dev server often keeps serving the previous
  bundle after a failed build, with HTTP 200: a red run against a stale bundle is an environment
  problem, not a test failure.
- **E3 — Spend runs, not logins, and spend few of either.** Never one run per test of a batch:
  **proving** a new batch takes two runs (inverted, then restored); **verifying** a feature takes
  one (`--grep "@<feature-id>(?![\w-])"`), never one per criterion; a **correction** re-runs just
  the failing test. A `429`, or every case failing on the sign-in screen, is the rate limiter —
  stop, say so, and never classify it as a product defect or re-run to "see if it passes".
- **E4 — `retries: 0`.** A test that passes on the second try is a flaky test, and a flaky test is
  a defect of the test. Never add retries to hide one.
