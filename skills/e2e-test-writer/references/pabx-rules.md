# PABX Rules — End-to-End Tests (browser flows)

> **Project-specific appendix.** Hard rules for **PABX** end-to-end tests. The generic
> principles live in the `SKILL.md`; this file is the ground truth for the PABX stack. The
> `e2e-test-validator` audits against these same rules.
>
> **Scope:** `tests/e2e/` at the repository root — `@playwright/test` driving the real app
> (Angular frontend + Node backend + the shared dev database), headless, one user flow at a
> time: **an action and its observable result**.
>
> **"The project has an e2e suite"** means exactly one thing everywhere in the SDD skills:
> **`GATES.md` lists an e2e gate proven green.**

---

## Boundary — what is NOT an e2e test here

| It asserts... | It belongs to | Not here because |
|---|---|---|
| A **computed value**: contrast, height, density, effective font size, a `getComputedStyle` or `getBoundingClientRect` reading | `tests/visual/` → gate `visual-frontend` | That suite measures rendering in both themes; no test-writer owns it |
| An endpoint's status/body, permission, tenant isolation, SQL | `apps/backend/__tests__/integration/` → `integration-test-writer` | It runs against its own tenant, without a browser, in seconds |
| One component or service in isolation | `*.spec.ts` → `unit-test-writer` | jsdom, milliseconds |
| **A user acts on the screen and something observable follows** | **`tests/e2e/`** | — |

`tests/visual/**` already contains a few flow cases written before this suite existed, and
contracts written before it map UI flows to the visual suite in their `Test-suite hint`. Both
stay as they are: follow this table, note the old hint in the checklist, and never edit
`tests/visual/**` from this skill. The theme is the visual suite's concern too: an e2e test runs
in whatever theme its session carries and never loops over themes, even when a surface's initial
state names one.

---

## Harness (built by `gate-builder`, never by this skill)

The harness is the gate's infrastructure. **`GATES.md` is authoritative for its paths, commands,
fixtures and environment variables** — if it disagrees with this table, follow `GATES.md` and
report the divergence.

| Piece | Expected shape |
|---|---|
| Runner config | `playwright.e2e.config.js` (root), `testDir: './tests/e2e'` — separate from the visual config |
| Profiles | one config project per session: `tests/e2e/admin/**` → administrative, `tests/e2e/agent/**` → agent |
| Session | stored once by the harness global setup and **reused across runs while still valid** |
| Seed tests | one per profile (`tests/e2e/<profile>/harness-seed.spec.js`) — the harness's proof that it runs |
| Fixtures module | `tests/e2e/fixtures.js`, exporting `test` (extended with the API fixtures) and `expect` |
| API fixtures | one per session (e.g. `adminApi`, `agentApi`): a request context on the backend base URL carrying that session's token. Both accounts belong to **one tenant** |
| Log | where to read the dev server's last build (with `./dev.sh`, the frontend container's `docker logs`) |
| Gate | `npm run gate:e2e-frontend` |

- **H1 — The harness must exist:** the config exists and declares a project for the profile the
  flow needs. Missing → stop and report *"not resolved — environment: e2e harness not built"*.
  Never create or edit the harness from this skill.
- **H2 — Never create or edit the seed tests, the config, the global setup or the shared
  fixtures** to make a test pass. A helper, or a local `test.extend(...)`, inside the spec file
  is test code and is fine; a support module shared between spec files is a shared fixture —
  the harness's.

---

## File structure pattern

`tests/e2e/agent/f14-ui-01-agent-surface.spec.js`:

```javascript
const { test, expect } = require('@playwright/test')

const SURFACE = '/agent-dashboard/tickets'
const TERM = 'Acme'

test.describe('F14 UI-01 — agent ticket surface', () => {
  test(
    'the manual search narrows to the customer it was given',
    { tag: ['@F14', '@UI-01'] },
    async ({ page }) => {
      await page.goto(SURFACE)

      const isSearch = req =>
        req.method() === 'GET' &&
        req.url().includes('/tickets/customers/search')
      const searches = []
      page.on('request', req => isSearch(req) && searches.push(req))
      const search = page.waitForResponse(
        res =>
          isSearch(res.request()) &&
          new URL(res.url()).searchParams.get('q') === TERM
      )
      await page.getByLabel('Nome, documento ou telefone').fill(TERM)
      expect((await search).ok()).toBe(true)

      const rows = page.locator('.search-result')
      await expect(rows.first()).toBeVisible()
      for (const row of await rows.allTextContents()) {
        expect(row.toLowerCase()).toContain(TERM.toLowerCase())
      }
      expect(searches).toHaveLength(1)
    }
  )
})
```

The session comes from the `agent/` folder. The request is captured before the action that
fires it, and the search is asserted to fire exactly once (V6). The precondition is asserted
before the loop, so an empty result fails instead of passing vacuously. The filter is validated
with a value that exists in the dev tenant — and **only reads**: `Acme` is customer 79 (see
D1). For a term without digits the backend matches name **or** code, both shown in the row, so
the assertion reads the whole row, case-insensitively. A term with digits breaks that pattern:
the backend strips punctuation and compares the digits against documents (shown as stored,
punctuation included) and against identity phones (not shown at all), so a correct result may
not contain the typed term. Use letters-only terms and run tokens.

- **S1 — Location and name:** `tests/e2e/<profile>/<feature-id>-<surface-id>-<kebab>.spec.js`,
  lowercase (`tests/e2e/agent/f14-ui-01-agent-surface.spec.js`). A flow that starts on one
  surface and ends on another lives in the file of the surface where it starts and is tagged
  with both; a surface with no route of its own (a dialog, such as F14's `UI-02` ticket form) is
  reached from another surface, so its flows live in that surface's file. Work outside a
  contract uses the route's slug in place of the surface id, in the name and in the tag
  (`agent-dashboard-tickets`). **The profile folder decides the session the flow runs in.**
  Setup and cleanup may use another session only through its harness API fixture (A3); the flow
  under test never does.
- **S2 — CommonJS JavaScript:** `require('@playwright/test')`, or the harness `fixtures` module
  when one exists. No TypeScript — the repository's Playwright suites are CommonJS.
- **S3 — Traceability tags:** every test carries the feature tag — the feature folder's id,
  `@F14`, `@F08-v2` — and the id of every contract surface it touches (work without a feature
  carries the route's slug tag alone). It carries a
  criterion's id (`@OC-08`) only when it proves that criterion **completely**; a partial proof
  gets the surface tag alone. Ids repeat across features and `@F08` is a prefix of `@F08-v2`,
  so a query anchors and pairs them:
  `npx playwright test --config playwright.e2e.config.js --grep "(?=.*@F14(?![\w-]))(?=.*@OC-08(?![\w-]))"`.
- **S4 — English for everything the test authors:** test and describe names, comments,
  variables, helper names. **Product copy is exempt**: labels, button names and messages used in
  locators and assertions must match the screen verbatim, in Portuguese, with accents
  (`getByRole('button', { name: 'Abrir ticket' })`).
- **S5 — Independence:** each test navigates to its own starting point and depends on no other
  test. No `test.describe.serial`, no state carried between tests, no reliance on file order. A
  fixture that creates data is **test-scoped** — a worker-scoped one shares its records, and
  whatever one test hangs off them, with every test after it.

---

## Session

- **A1 — Never log in inside a test, a hook or a fixture.** The backend allows ~20
  authentication attempts per 15 minutes. A suite that logs in per test spends the budget in one
  run, and the next run fails every case on the sign-in screen — a harness failure that reads
  exactly like product defects.
- **A2 — Never forge a token, seed a session or bypass reCAPTCHA.** The only escape hatch is
  the documented non-production flag in the backend environment, which is the harness's concern.
- **A3 — API calls go through the harness API fixtures, to the backend origin.** Another
  profile's session is reachable **only** through its fixture (`adminApi` in an agent test);
  never read a storage-state file yourself. The backend base URL comes from `GATES.md` — a path
  relative to the page (`/v2/...` on `:4200`) lands on the dev server, not the API. **Every
  setup call asserts its status** (`expect(res.ok()).toBe(true)` or `failOnStatusCode: true`):
  Playwright's request context does not throw on 4xx/5xx by itself. If the harness offers no
  fixture for the session a flow's setup needs, that flow falls under D5 — and report the gap.

---

## Assertions

- **V1 — Exercise, don't load.** Every test performs an action and asserts what followed.
  "The page opened and the element is visible" is a smoke check, not an e2e test.
- **V2 — Web-first waits only:** `await expect(locator).toHaveText(...)`,
  `page.waitForResponse(...)` registered before the action. Never `page.waitForTimeout`, fixed
  sleeps, or `networkidle`.
- **V3 — Locators by role, label or visible text first**; `data-testid` when the template has
  one. Structural markers are allowed when the accessible name is unstable or absent: a
  component selector (`tails-customer-360`), a form control's `name` attribute
  (`mat-select[name="queue"]`), a component-scoped class (`.search-result`), a table row filtered
  by its visible text (`page.locator('tails-customer-360 tbody tr').filter({ hasText: protocol })`).
  **The test must know the identity of every item it acts on.** Pick it from data — a record it
  created, or an entry of a captured response — and act on it by name or id; never act on
  whatever renders first (`nth-child`, `.nth(3)`, `getByRole('option').first()`), and never
  XPath. `.first()` to assert that at least one exists is fine.
- **V4 — Missing data fails, it never skips.** No `test.skip`, no early `return`, no
  `if (count === 0)` branch when the precondition is absent. Assert the precondition
  (`await expect(rows.first()).toBeVisible()`) so an empty screen turns red. A skipped
  assertion reads as green while proving nothing.
- **V5 — A filter is validated with a value present in the data.** Assert the set narrows to
  exactly that value. An empty result validates nothing: it happens whether the filter works or
  is ignored.
- **V6 — No duplicate requests.** When the action fetches, capture the requests it should fire
  (opening a form may legitimately fire several) and assert their parameters; for every request
  whose duplicate would be a defect — a submit that creates, a search — assert it fired exactly
  once.
- **V7 — Empty and failure must not look alike.** To test a failure state, force only the
  failing call with `page.route(...)` and assert the error message differs from the empty
  state. Never mock the happy path — a mocked flow is not end-to-end.
- **V8 — Never weaken an assertion to match the screen** — an existing one or one you are
  writing. If the app shows something other than the contract says, the test is right until
  proven otherwise (see correction and guard mode).

---

## Data — the dev database is shared

`.env.development` and `.env.testing` point to the **same** MySQL. The app under test writes
to it, the smoke fixtures other features reuse live in it, and other suites read it. **These
rules bind every write the skill causes — the tests and the exploration that precedes them.**

- **D1 — Never mutate or hang anything off pre-existing records that screens or other suites
  read by id** — customers, tickets, incidents and their relations. Read them freely; never
  edit, close or delete one the test did not create, and never create a child of one: a new
  ticket for an existing customer changes what that customer's screens and other suites see.
  Known traps: tickets for customers **77/79** are adopted by open incident **231** and break
  the visual gate; tickets **115, 330–332** are smoke fixtures. **Never press a submit on a form
  bound to a pre-existing record** — not even to prove it is refused: if the refusal is broken,
  the test writes. Open that form on a record the test owns. **Configuration a record only
  references** — the tenant, queues, categories, tags, custom fields and other lookups — may be
  referenced by what the test creates, but is never edited or deleted by it. When configuration
  is itself the record under test (the screen that manages categories or tags), it follows D2:
  the test creates its own and removes it.
- **D2 — A test that writes creates its own records, its own customer before its own ticket**,
  marked with a unique run token in a visible field (`E2E ${Date.now()}`), through the product
  — the UI or its HTTP API. **Never SQL**, never `knex`/`mysql2`, never the MySQL MCP.
- **D3 — Cleanup always runs and never fails silently.** Prefer the teardown of the Playwright
  fixture that created the data: it runs even when the test fails, and its error is reported
  next to the test's instead of replacing it (a `throw` from `finally` hides the test's own
  failure). Children before parents. Records the flow itself creates through the UI (the ticket a
  submit opens) are found through a parent the test owns — list its tickets — and removed in that
  parent's teardown. Attempt every removal even if one fails, **check each response status**
  (collecting the failures), and throw after the last attempt if any failed, naming what was left
  behind.
- **D4 — Removal goes through the product's delete route**, through the API fixture of a session
  allowed to use it — the flow may run as the agent while setup and cleanup run through
  `adminApi` (A3). Deletes are scoped by the token's tenant, which is why both harness accounts
  share one. Tickets and ticket customers are **soft-deleted** (`deleted = 1`): the row stays in
  the table and leaves every listing, and the audit trail keeps the create and delete entries.
  That residue is the accepted end state — record it in the checklist so nobody reads it as a
  leak.
- **D5 — No removal path, no creation.** If no harness session can remove what the flow
  creates, the test does not create it: cover the flow on existing data read-only, or mark the
  behaviour `not e2e-testable — no removal path` in the checklist (`no removal path — harness
  lacks <fixture>` when the cause is a missing API fixture).
- **D6 — Exploring a write flow obeys D1–D5 too.** An exploration session has no test fixtures:
  create the records it needs through the backend API with the attached page's own token
  (`localStorage.currentUser.token`, read from the live page — never from a storage-state file),
  checking each status, and remove them the same way afterwards. **A submit that creates is
  either captured and aborted with `page.route(...)` before it reaches the backend, or its
  captured response id is removed afterwards** — otherwise the record it creates is one no
  teardown knows about (and a customer with a live ticket refuses its own delete). Never submit
  against pre-existing data to "see what it sends".

---

## Coverage outcomes — the closed list

The writer's coverage table (`docs/<feature-id>-<kebab>/e2e-test.md`) gives every row of the
contract's `Test-suite hint` it covers **one** of these outcomes. The single combination allowed
is a row's test titles next to `disputed` entries for some of its tests — and a row may hold
`disputed` entries alone. The `evaluator`, `implement-feature` and `e2e-test-validator` accept
nothing else.

| Outcome | Meaning |
|---|---|
| test titles | existing tests tagged per S3; marked `unproven` until both proving runs of the writer's Phase 3 happened |
| `disputed — <test title> (<path>) — <contract line>` | one test someone believes misreads the contract — see **Disputes** below |
| `not e2e-testable — telephony/hardware` | needs a real call, a device, a physical line |
| `not e2e-testable — second tenant` | needs a tenant the harness accounts do not belong to |
| `not e2e-testable — external credential` | needs a third-party credential the dev stack does not have |
| `not e2e-testable — shared configuration` | would have to change pre-existing configuration other screens read (D1) — not configuration that is itself the record under test |
| `not e2e-testable — no removal path` | D5; `no removal path — harness lacks <fixture>` when an API fixture is missing |
| `out of e2e scope — <suite>` | the behavior is not a flow (a computed value, a theme) — the contract mapped it to e2e by mistake |
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
   - absent — no test with that title at that path (`npx playwright test --config <e2e config>
     --list`) → the entry is stale.
4. **Closed only by the `evaluator`**: a closed entry — moot, or settled by a contract change —
   goes back to the test's title marked `unproven`, whoever touched the test in between, so the
   writer proves it and the validator audits it before it counts again; a stale entry is removed, and the row is judged on what remains — a row left empty is missing coverage. A
   test named in a `disputed` entry is never also listed by its plain title.
   A human settles a PENDING dispute by changing the contract line, the test or the product; the
   entry closes when that change shows in a later run, never by editing the entry alone. No
   writer ever removes a `disputed` entry. A test file a skill leaves uncommitted is named in that
   skill's own report for the human to commit.

---

## Execution

```bash
PLAYWRIGHT_HTML_OPEN=never npx playwright test --config playwright.e2e.config.js tests/e2e/agent/f14-ui-01-agent-surface.spec.js
npm run gate:e2e-frontend
```

- **E1 — Headless.** Headed runs are for the human smoke test, not for this suite.
- **E2 — Check the environment before trusting a result:** the frontend answers, the backend
  answers, and **the dev server's last build succeeded** — read its log where `GATES.md` says
  (with `./dev.sh`, the frontend container's `docker logs`) for a compile error after the last
  edit. `ng serve` keeps serving the previous bundle after a failed build, with HTTP 200. A red
  run against a stale bundle is an environment problem, not a test failure.
- **E3 — Spend runs, not logins, and spend few of either.** Never one run per test of a
  batch: **proving** a new batch takes two runs (inverted, then restored); **verifying** a
  feature takes one (`--grep "@F14(?![\w-])"`), never one per criterion; a **correction**
  re-runs just the failing test.
  A `429`, or every case failing on the sign-in screen, is the rate limiter — stop, say so, and
  never classify it as a product defect or re-run to "see if it passes".
- **E4 — `retries: 0`.** A test that passes on the second try is a flaky test, and a flaky test
  is a defect of the test. Never add retries to hide one.
