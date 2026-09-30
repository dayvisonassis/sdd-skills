# PABX Rules — Integration Tests (backend API)

> **Project-specific appendix.** Hard rules for **PABX** backend integration tests. The
> generic principles live in the `SKILL.md`; this file is the ground truth for the PABX
> stack. The `integration-test-validator` audits against these same rules.
>
> **Scope:** `apps/backend/__tests__/integration/` — Jest + supertest against a **real test
> database**, exercising the full request→response lifecycle (middleware, controller, model, DB).

---

## File structure pattern

```javascript
const request = require('supertest')
const app = require('../../src/app')
const { generateToken } = require('../utils/auth')
const { setupTestDatabase, cleanupTestDatabase } = require('../utils/test-setup')

describe('EntityName API', () => {
  let db, user, domain, authToken
  const dbWrite = () => db.getDb({ operation: 'write' })

  beforeAll(async () => {
    ;({ db, user, domain } = await setupTestDatabase())
    authToken = generateToken({ user: { id: user.id, dr_domain_id: domain.domain_id } })
  })
  afterAll(async () => { await cleanupTestDatabase() })

  describe('POST /v2/entity', () => {
    it('should create entity with valid data and return id and success message', async () => {
      const payload = { /* valid data */ }
      const response = await request(app)
        .post('/v2/entity')
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload)
      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('id')
    })
  })
})
```

- **E1 — `setupTestDatabase()` in `beforeAll`.** It returns `{ db, user, domain }`; the token is
  `generateToken(...)` from `../utils/auth`, for the returned user and domain.
- **E2 — `cleanupTestDatabase()` in `afterAll`.**
- **E3 — Imports:** `setupTestDatabase`/`cleanupTestDatabase` from `../utils/test-setup`,
  `generateToken` from `../utils/auth`, `supertest`, and `../../src/app`. Queries go through
  `db.getDb({ operation: 'write' | 'read' })`, never a bare `db(...)`.

---

## Data cleanup — CRITICAL (DB must be identical before/after)

- **C1 — `try-finally` for every `it()` that creates data** — cleanup runs even on failure.
- **C2 — `try-catch` inside each `finally`** delete, so one cleanup failure doesn't block others.
- **C3 — Foreign-key order (children before parents):**
  `audit_logs` → `users_permissions` / `user_permissions_group` → `group_permissions` →
  `permissions` → `users` → `dr_agent` (and related) → `dr_domain`.
- **C4 — Only delete test-created data** (by stored IDs). Never broad `WHERE`/`truncate`.
- **C5 — Every insert has a matching delete.** No data left behind.
- **C6 — At least two cleanup levels:** `try-finally` inside tests + `afterAll` suite cleanup.
- **Never remove pre-existing data** (users/domains only *used*, system config).

```javascript
it('should test with created data', async () => {
  let userId = null, permissionId = null
  try {
    const user = await createTestUser(); userId = user.id
    const permission = await createTestPermission(); permissionId = permission.id
    expect(user).toBeDefined()
  } finally {
    try { if (permissionId) await dbWrite()('permissions').where('id', permissionId).delete() } catch (e) {}
    try { if (userId) await dbWrite()('users').where('id', userId).delete() } catch (e) {}
  }
})
```

---

## Coverage minimums

CRUD (POST / GET single / GET list / PUT / DELETE) · auth & authorization (missing/expired
token, insufficient permissions) · validation errors (missing fields, invalid types,
out-of-range) · not-found (non-existent IDs) · edge cases (empty/null/undefined/wrong type) ·
boundary conditions · relationships (FK) · security (SQL injection, XSS) · data integrity ·
**query growth** (N+1), for the endpoints its scope defines (below).

API assertions: every request asserts the **status code**; success asserts **body structure**
(`toHaveProperty`); authenticated requests set `Authorization: Bearer <token>`.

---

## Query growth — the runtime check for N+1

N+1 is the number of queries **growing with the number of records**, so it is measured, not
estimated. Call the same endpoint over two data sizes and require the same count. Use
`countQueries` from `__tests__/utils/query-counter.js`. It listens to every knex instance of the
backend and returns `{ count, queries, result }`: `queries` holds the SQL text of each statement
(`count` is its length), and `result` is the supertest response.

### Scope and outcomes

This is the one definition. The writer, the validator, the spec-writer and the evaluator refer to
it and do not restate it.

A growth test is **required** for an endpoint when all of these hold:
1. it is a **read** endpoint (`GET`);
2. the feature creates it or changes its data access (its controller, model or query code is in
   the feature's diff). When no feature dispatched the writer, the endpoint is the one the writer
   was asked to test;
3. its response lists records, or reads related records per listed record, loaded through the
   backend's knex instances, in a number that follows data the test can seed and remove.

For every endpoint that the feature creates or whose data access it changes, the `.test.md`
checklist records **exactly one** outcome:

| Outcome | When |
|---|---|
| the title of its growth test | the three conditions hold |
| `not measurable — write endpoint` | `POST`/`PUT`/`PATCH`/`DELETE`, previews and imports included (Q3) |
| `not measurable — source not counted` | the records do not come from the counted knex instances (the AMI realtime, an external API, the filesystem) |
| `not measurable — fixed-size result` | an aggregate, time buckets, a top-N: the size does not follow the seeded records |
| `not measurable — not seedable` | the records cannot be inserted directly (Q8) and removed under the cleanup rules above |
| `not measurable — per-item query allowlisted: <entry>` | the growth is an approved gate exception. The growth test is removed, never relaxed (Q1) |
| `pre-existing N+1 — <the repeated SQL> — loop <file:line>, call <file:line>` | the test is red, and **neither** the loop **nor** the call that repeats is in the branch's diff against the base |

No other reason is accepted. A loop the feature wrote around a legacy helper that queries is the
feature's N+1, even when the repeated SQL text is legacy. For a `pre-existing N+1`, the red test
is **not committed**: the outcome names the statement and both locations, the evaluator checks
them against the diff, and it reports the outcome as a Finding for the legacy migration.

### The test

In the example, `insertCustomer`/`deleteCustomer` and `insertTicket`/`deleteTicket` stand for the
suite's own seed and cleanup helpers:
- the seed helpers **insert with `dbWrite()` and return the id**. They never call a write
  endpoint, because the audit middleware finishes its work after the response, and that work
  would land in the next measurement (Q8);
- the cleanup helpers remove child rows first (C3) and catch their own errors (C2), like
  `deleteTicket` in `tickets.test.js`.

```javascript
const { countQueries } = require('../utils/query-counter')

it('should not grow the number of queries with the number of tickets', async () => {
  const customerIds = []
  const ticketIds = []
  const list = () =>
    request(app).get('/v2/tickets').set('Authorization', `Bearer ${authToken}`)
  try {
    customerIds.push(await insertCustomer())
    ticketIds.push(await insertTicket({ customer_id: customerIds[0] }))
    // Unmeasured call with one record in place: caches that load per record fill here (Q6)
    await list()
    const one = await countQueries(list)

    // A distinct customer per ticket: a per-customer N+1 hides behind a shared one (Q7)
    for (let i = 0; i < 4; i++) {
      const customerId = await insertCustomer()
      customerIds.push(customerId)
      ticketIds.push(await insertTicket({ customer_id: customerId }))
    }
    await list()
    const five = await countQueries(list)

    expect(one.result.status).toBe(200)
    expect(five.result.status).toBe(200)
    expect(five.result.body.items).toHaveLength(one.result.body.items.length + 4)
    expect(five.queries).toHaveLength(one.count)
  } finally {
    for (const id of ticketIds) await deleteTicket(id)
    for (const id of customerIds) await deleteCustomer(id)
  }
})
```

- **Q1 — Two sizes, the same count, no tolerance.** The larger call runs exactly as many
  queries as the smaller one (`expect(five.queries).toHaveLength(one.count)`). Never an absolute
  budget, `toBeLessThanOrEqual`, or a margin. The middleware cost of a request (session,
  permissions, domain lookup) is the same in both calls and cancels out; a margin is exactly the
  room an N+1 needs.
- **Q2 — The larger call reflects the added records.** Assert both statuses, and that the larger
  result has the smaller one's size plus the records added. Compare against the smaller call,
  never a literal: shared fixtures may put other rows in the tenant. When the endpoint paginates,
  filter the request to the test's own records (a customer, a search term), or the page size can
  hide the growth.
- **Q3 — Read endpoints only.** A write may leave audit work running after the response, which
  lands in the next measurement.
- **Q4 — The data follows the cleanup rules above**: try/finally, foreign-key order, only what the
  test created. Seeding the extra records in a loop is test code, not the N+1 under test.
- **Q5 — A red run shows the SQL.** Assert on the `queries` array with `toHaveLength`: on
  failure Jest prints the whole array, so the repeated statement is visible. Do not compare the
  two arrays with `toEqual`: a `whereIn` changes its SQL text with the number of ids.
- **Q6 — Seed, then make one unmeasured call, then measure, before each measurement.** The
  first request of a process fills caches (the platform role cache, lazy connections), a cache
  that loads per record fills on the first call that sees one, and a cache can expire between the
  two measurements. Without those calls, one measurement counts the cache fill, and a real N+1 can
  hide in exactly that difference.
- **Q7 — Give each extra record its own related record.** An N+1 that loads one relation per item
  (the customer of each ticket) repeats the same statement when all items share one relation, and
  code that deduplicates those statements hides it. Seed distinct relations (customers B to E for
  tickets 2 to 5), or the test measures nothing.
- **Q8 — Seed with direct inserts, never through a write endpoint.** A write endpoint's audit work
  runs after its response, and those queries land in the next measurement. This is Q3's reason,
  applied to the seed.

---

## Common rules

- **English only** everywhere. **AAA pattern**, independence, deterministic.
- **Never modify production code** (`*.model.js`, `*.controller.js`, routes). Fix only tests.
- No external data-population scripts. No unnecessary blank lines.

---

## Execution

```powershell
cd apps/backend
nvm use
$env:NODE_ENV="testing"   # MANDATORY for integration tests

npx jest __tests__/integration/entity.test.js --forceExit --detectOpenHandles --no-coverage
npx jest __tests__/integration --forceExit --detectOpenHandles --no-coverage
```

- `--forceExit` + `--detectOpenHandles` **always**. `--no-coverage` during development.
- Avoid `--verbose` without redirecting output for > ~20 tests (prevents AI disconnections).
- `NODE_ENV=testing` silences middleware logs; ensure `__tests__/setupTests.js` is loaded in `jest.config.js`.
