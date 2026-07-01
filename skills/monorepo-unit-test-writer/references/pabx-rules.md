# PABX Rules — Monorepo Unit Tests (node-express / node-worker / python-fastapi)

> **Project-specific appendix.** Hard rules for **PABX monorepo** unit tests of apps other
> than `apps/backend` and `apps/frontend`. The generic principles live in the `SKILL.md`;
> this file is the ground truth. The `monorepo-unit-test-validator` audits against these rules.
>
> **Scope:** any app under `apps/` **except** `apps/backend` and `apps/frontend` (those use
> `unit-test-*`). Auto-detect the stack first.

---

## Stack detection

| Indicator | Stack | Framework | Test file pattern |
|---|---|---|---|
| `package.json` + Express + `*.controller.ts`/`*.route.ts` | `node-express` | Jest + ts-jest | `__tests__/unit/**/*.test.ts` |
| `package.json` without HTTP server in entrypoint | `node-worker` | Jest + ts-jest | `__tests__/unit/**/*.test.ts` |
| `requirements.txt`/`pyproject.toml` with `fastapi` | `python-fastapi` | pytest | `tests/test_*.py` |

**File location:** Node mirrors `src/` under `__tests__/unit/`
(`apps/cloud/src/controllers/cloud.controller.ts` → `apps/cloud/__tests__/unit/controllers/cloud.controller.test.ts`);
Python tests in `apps/{app}/tests/test_*.py`.

---

## Node.js common rules [node-express + node-worker]

- **NC1 — Use `import`, never `require()`** in TS test files.
- **NC2 — `jest.mock('module')` BEFORE the `import`** of the mocked module. Use `jest.mocked()`.
- **NC3 — `jest.clearAllMocks()` in `beforeEach`.**
- **NC4 — `.test.ts` extension.** **NC5 — file location mirrors `src/`.**

### node-express
- **NE1 — Controllers:** mock `req`/`res`/`next`; `res.status: jest.fn().mockReturnThis()`, `res.json: jest.fn()`.
- **NE2 — Services:** mock all external HTTP (axios), DB, Redis.
- **NE3/NE4/NE5 — Models with `Promise.all()`:** each `dbRead()`/`dbWrite()` returns a NEW mock builder; `.then` uses `Promise.resolve(val).then.bind(promise)` (never `jest.fn().mockResolvedValue`); `.clone()` returns a NEW object. Same `createMockQueryBuilder` pattern as `apps/backend`.
- **NE6 — Route files are integration-only** — no unit tests.
- **NE7 — Middleware:** verify the `next()` flow (called/not called per condition).

### node-worker
- **NW1 — Mock all connections:** DB, Redis, BullMQ, Qdrant, Neo4j.
- **NW2 — AGI apps:** fully mock the `ding-dong` session (`answer`, `getData`, `streamFile`, `hangup`, `exec`, `setVariable`, `variables`).
- **NW3 — dbevents:** mock `@rodrigogs/mysql-events`; test trigger registration via mock.
- **NW4 — BullMQ workers:** test valid AND invalid job payloads.
- **NW5 — Graceful shutdown** (SIGTERM/SIGINT) tested when the entrypoint has handlers.
- **NW6 — Pipeline stages/agents isolated** with mocked upstream/downstream.

---

## Python FastAPI rules [python-fastapi]

- **PF1 — Mock GPU/ML BEFORE any app import.** `torch`, `whisperx`, `TTS`, CUDA modules must be patched via `sys.modules` **before** importing the module under test. Flag any app `import` before the mock.
- **PF2 — Use `TestClient`** (`fastapi.testclient`) for routes, or `httpx.AsyncClient` for async.
- **PF3 — No real model loading** (`torch.load()`, `whisperx.load_model()`, real ML instances).
- **PF4 — Async tests decorated** with `@pytest.mark.asyncio`.
- **PF5 — `conftest.py`** in `tests/` with shared fixtures (GPU mock, TestClient).
- **PF6 — `@patch` targets the path where the name is USED**, not where it's defined.
- **PF7 — No hardcoded absolute paths** to model/audio/GPU files.

```python
import sys
from unittest.mock import MagicMock
mock_torch = MagicMock(); mock_torch.cuda.is_available.return_value = False
sys.modules['torch'] = mock_torch
sys.modules['torch.cuda'] = mock_torch.cuda
# NOW import the module under test
from app import app
```

---

## Test infrastructure (create if missing)

- **Node:** `jest.config.ts` with `preset: 'ts-jest'`, `testEnvironment: 'node'`, `roots: ['<rootDir>/__tests__']`, `forceExit`, `detectOpenHandles`; devDeps `jest`/`ts-jest`/`@types/jest`/`typescript`; `"test"` script.
- **Python:** `tests/conftest.py` with GPU mock + `client` fixture; test deps `pytest`, `pytest-asyncio`, `pytest-cov`, `httpx`.

---

## Common rules & performance

- **English only.** **AAA**, independence, deterministic. **Never modify production code.**
- **All external deps mocked** (DB/HTTP/queue/filesystem/GPU). **Coverage ≥ 80%.**
- **Performance:** Node tests in milliseconds; Python under 1s each. Slow test = broken mocks.

---

## Execution

```bash
# Node apps:
cd apps/{app}; nvm use
npx jest __tests__/unit/ --no-coverage
# Python apps:
cd apps/{app}
python -m pytest tests/ -v
python -m pytest tests/ --cov=. --cov-report=term
```
