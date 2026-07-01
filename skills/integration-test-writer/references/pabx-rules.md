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
const { setupTestDatabase, cleanupTestDatabase } = require('../helpers/testSetup')
const request = require('supertest')
const app = require('../../src/app')

describe('EntityName API', () => {
  let authToken
  beforeAll(async () => { const { token } = await setupTestDatabase(); authToken = token })
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

- **E1 — `setupTestDatabase()` in `beforeAll`**, destructuring at least `token`.
- **E2 — `cleanupTestDatabase()` in `afterAll`.**
- **E3 — Imports:** `setupTestDatabase`/`cleanupTestDatabase` from `../helpers/testSetup`, `supertest`, and `../../src/app`.

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
    try { if (permissionId) await db('permissions').where('id', permissionId).delete() } catch (e) {}
    try { if (userId) await db('users').where('id', userId).delete() } catch (e) {}
  }
})
```

---

## Coverage minimums

CRUD (POST / GET single / GET list / PUT / DELETE) · auth & authorization (missing/expired
token, insufficient permissions) · validation errors (missing fields, invalid types,
out-of-range) · not-found (non-existent IDs) · edge cases (empty/null/undefined/wrong type) ·
boundary conditions · relationships (FK) · security (SQL injection, XSS) · data integrity.

API assertions: every request asserts the **status code**; success asserts **body structure**
(`toHaveProperty`); authenticated requests set `Authorization: Bearer <token>`.

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
