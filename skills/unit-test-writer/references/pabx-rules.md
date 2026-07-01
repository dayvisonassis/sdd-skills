# PABX Rules — Unit Tests (Angular frontend + Node.js backend)

> **Project-specific appendix.** These are the hard rules for the **PABX monorepo** unit
> tests. The generic principles live in the `SKILL.md`; this file is the ground truth for
> the PABX stack. The `unit-test-validator` audits against these same rules.
>
> **Scope:**
> - **Frontend:** `apps/frontend/` — Jest + jest-preset-angular, `*.spec.ts` co-located with the source.
> - **Backend:** `apps/backend/__tests__/unit/` — Jest, `*.test.js` mirroring `src/` (1:1).

---

## File location standards

- **Frontend:** the `.spec.ts` sits in the same directory as the file under test.
  `apps/frontend/src/app/components/users/users.component.ts` → `.../users.component.spec.ts`
- **Backend:** mirror `src/` inside `__tests__/unit/`, one test file per source file (1:1).
  `apps/backend/src/utils/audit.utils.js` → `apps/backend/__tests__/unit/utils/audit.utils.test.js`

---

## Frontend Components — critical rules

**Mock jQuery globally BEFORE any imports** (if the component uses `$`):

```typescript
const mockJQueryModal = jest.fn()
const mockJQuery = jest.fn(() => ({ modal: mockJQueryModal, on: jest.fn() }))
if (typeof global !== 'undefined') { (global as any).$ = mockJQuery }
if (typeof window !== 'undefined') { (window as any).$ = mockJQuery }

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing'
import { NO_ERRORS_SCHEMA } from '@angular/core'
import { MyRealComponent } from './my-real.component'  // ALWAYS the REAL component
jest.setTimeout(10000)
```

- **FC1 — Always import the REAL component.** NEVER create an inline `@Component({...}) class TestXyz` that copies the logic — it passes even when the real code is broken.
- **FC2 — `TestBed.resetTestingModule()` in `beforeEach`** before configuring.
- **FC3 — `fixture.destroy()` in `afterEach`** (try-catch wrapped).
- **FC4 — Unsubscribe all subscriptions in `afterEach`.**
- **FC5 — `schemas: [NO_ERRORS_SCHEMA]`** to ignore irrelevant child components.
- **FC7 — `jest.setTimeout(10000)`** at top level for async suites.
- **FC8 — Destroy the previous fixture in `beforeEach`** before resetting TestBed.
- Use **specific DOM selectors** (`header button.btn-success`, not just `button.btn-success`).
- Async: `fakeAsync(() => { ...; tick() })`; multiple `tick()` for chained async ops.

`beforeEach` / `afterEach` canonical shape: destroy previous fixture + unsubscribe →
`TestBed.resetTestingModule()` + `jest.clearAllMocks()` → build with real component + mocks →
create fixture + `detectChanges()`.

---

## Frontend Services — critical rules

- **FS1 — Manual instantiation:** `service = new MyService(httpClientMock, errorHandleMock)`.
- **FS2 — NEVER `TestBed.inject()`** for services (causes DI errors in Jest).
- **FS3 — NEVER `HttpClientTestingModule`.** Use a manual `httpClientMock`.
- **FS4 — Mock `localStorage` BEFORE all imports** (order matters) via `Object.defineProperty(window, 'localStorage', ...)`.
- **FS5 — `httpClientMock` has individual `jest.fn()` per method** (`get`, `post`, `put`, `delete`), not one generic mock.
- Service Observable tests use the `done` callback pattern.

```typescript
// localStorage mock BEFORE imports, then:
service = new MyService(httpClientMock, errorHandleMock)   // manual, no TestBed
httpClientMock.get.mockReturnValue(of(mockData))
```

---

## Backend Models — Promise.all() mock pattern (CRITICAL PERFORMANCE)

Methods using `Promise.all([q1, q2, ...])` where all queries share one mock cause promises
that never resolve → tests run for minutes. Every unit test must run in **< 100ms** (7–50ms
typical). A test > 1s signals a broken mock.

- **PA1 — Each `dbRead()`/`dbWrite()` call returns a NEW independent mock builder** (`mockImplementation(() => createMockQueryBuilder([]))`), never a shared object.
- **PA2 — `clone()` returns a NEW object** (`jest.fn(() => createMockQueryBuilder([]))`), not `mockReturnThis()`.
- **PA3 — `.then` uses `Promise.resolve(val).then.bind(promise)`**, NEVER `jest.fn().mockResolvedValue()`.

```javascript
const createMockQueryBuilder = (resolveValue = undefined) => {
  const qb = {
    where: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(), offset: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(resolveValue)
  }
  const p = Promise.resolve(resolveValue !== undefined ? resolveValue : [])
  qb.then = p.then.bind(p)
  qb.catch = p.catch.bind(p)
  return qb
}
mockDbRead.mockImplementation(() => {
  const qb = createMockQueryBuilder([])
  qb.clone = jest.fn(() => { const c = createMockQueryBuilder([]); c.first = jest.fn().mockResolvedValue({ total: 0 }); return c })
  return qb
})
```

| Mistake | Wrong | Correct |
|---|---|---|
| Reuse builder | `() => mockQuery` | `() => createMockQueryBuilder([])` |
| clone() same obj | `.clone = jest.fn().mockReturnThis()` | `.clone = jest.fn(() => createMockQueryBuilder([]))` |
| .then w/ jest.fn | `.then = jest.fn().mockResolvedValue([])` | `const p = Promise.resolve([]); .then = p.then.bind(p)` |

---

## Backend Controllers — pattern

Mock `req`, `res`, `next` in `beforeEach`; `res.status: jest.fn().mockReturnThis()`,
`res.json: jest.fn()`, `res.send: jest.fn()`. Cover 200 success + 400 validation + error paths.

---

## Common rules (all unit tests)

- **English only** — `describe`/`it` names, comments, variables, mocked strings. Zero Portuguese.
- **`jest.clearAllMocks()` in `beforeEach`** (mock isolation between tests).
- **All external deps mocked** — no real DB/HTTP/filesystem.
- **AAA pattern**, test independence, deterministic (no unmocked `Date.now()`/`Math.random()`).
- **Never modify production code.** If a test fails, adjust only the test.
- **Coverage ≥ 80%**, critical paths 100%. Don't test trivial getters/setters or third-party libs.
- No legacy Karma/Jasmine (`fdescribe`/`xit`/etc.).

---

## Execution

```powershell
cd apps/backend   # or apps/frontend
nvm use
# Frontend:
npx jest src/app/components/my/my.component.spec.ts
# Backend:
npx jest __tests__/unit/utils/my.utils.test.js --no-coverage
npx jest __tests__/unit --no-coverage
```

Unit tests use mocks only (no `NODE_ENV=testing` needed). `--forceExit`/`--detectOpenHandles`
still useful for backend.
