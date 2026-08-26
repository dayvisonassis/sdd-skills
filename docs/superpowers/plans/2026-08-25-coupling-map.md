# Coupling Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `coupling-map` skill — a versioned Node script plus its operating
instructions — that produces a standalone HTML report ranking which files to refactor first,
by crossing blast radius (`Ca*`) with size (`LOC`).

**Architecture:** The script is split so that only one module ever touches `madge`; everything
else is pure functions over a plain `{file: [deps]}` object. That split is what makes the logic
testable with Node's built-in runner and zero dependencies, and it is why the repository needs
no `package.json`. The skill ships the script as a real file and copies it into the target
project; the only thing generated per project is a small declarative `arch.config.json`.

**Tech Stack:** Node 22 (verified v22.15.0), `madge` 8.0.0 (`engines: node >=18`), `node:test`
+ `node:assert/strict` for tests, hand-written SVG for the chart. No runtime dependency other
than `madge`, and no dependency at all for the tested logic.

**Spec:** `docs/Skill_Coupling_Map.md` (in this repository, on this branch)

**Working repository:** `C:\angular\prompts\ia-prompts\sdd-skills`, branch
`feat/coupling-map-skill` (already created from `main`).

**Target repository for the probe and integration runs:** `C:\angular\drcall\pabx`, branch
`Acoplamento-skill`. That branch is disposable — **nothing is ever committed there.**

---

## Global Constraints

- **Test command is `node --test "skills/**/test/*.test.mjs"` run from the repository root,
  with the pattern QUOTED.** Verified on this machine: `node --test <directory>` FAILS
  ("Could not find '.'"); the quoted glob makes Node do the expansion, which also keeps the
  command working in PowerShell, where the shell would not expand it.
- **Zero dependencies in this repository.** No `package.json`, no `node_modules`. Tests use
  only `node:test` and `node:assert/strict`.
- **`madge` is installed only in the target project, and only with `--no-save`** during
  development, so the disposable branch never gains a tracked change:
  `npm install --no-save madge` from `C:\angular\drcall\pabx`.
- **`madge` is used for exactly one call: `.obj()`.** Cycles come from our own SCC pass and
  orphans from `ca === 0 && ce === 0`. Never call `.circular()` or `.orphans()` — deriving them
  ourselves removes two API surfaces and keeps a single source of truth for the graph.
- **No Graphviz.** It is only needed for `madge --image`, which we never use.
- **Commit convention of this repository:** English, `Feat:` / `Fix:` / `Docs:` prefix, subject
  as a full descriptive sentence, body explaining the WHY, and the trailer
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **No comments in the code.** Project rule. Comments are allowed only in test files, and there
  they must be in English.
- **The HTML must contain no external request.** Enforced by an automated assertion, not by
  inspection.
- **Dark theme is the default** in the report. Accessibility rule, not taste.
- Every file written under `skills/coupling-map/scripts/` is authored as ESM with the `.mjs`
  extension, so no `"type": "module"` declaration is needed anywhere.

---

## File Structure

```
skills/coupling-map/
  SKILL.md                          # operating instructions (English)
  references/
    config-schema.md                # arch.config.json field by field
    report-contract.md              # architecture.json contract
  scripts/
    arch-report.mjs                 # CLI entry point; orchestrates, writes output
    coupling-map/
      collect.mjs                   # THE ONLY module that imports madge
      declared.mjs                  # countDeclared(text): the coverage denominator
      taxonomy.mjs                  # path -> { app, domain, layer }
      graph.mjs                     # Tarjan SCC + transitive counts, both directions
      metrics.mjs                   # Ce, Ca, Ce*, Ca*, I, LOC; per-file and per-domain
      detect.mjs                    # the six detectors
      render.mjs                    # standalone HTML
    test/
      declared.test.mjs
      taxonomy.test.mjs
      graph.test.mjs
      metrics.test.mjs
      detect.test.mjs
      render.test.mjs
docs/
  Skill_Coupling_Map.md             # design doc (already written, uncommitted)
  superpowers/plans/2026-08-25-coupling-map.md   # this plan
```

**What gets copied into a target project** (by the skill, at first run):
`scripts/arch-report.mjs` and the whole `scripts/coupling-map/` folder. The `test/` folder and
the `.md` files stay in the skill. Config lands at the project root as `arch.config.json`.

---

### Task 1: The Madge probe — DONE (2026-08-25)

A spike, not TDD. Its output is an answer that can change the design, so it runs before any
code is written. It also produces the real distribution that calibrates the cuts frozen in
section 7.1 of the spec.

> **Completed. Findings in `docs/superpowers/plans/2026-08-25-probe-findings.md`.** Read that
> document before starting Task 2 — it changed five things, and Tasks 5 and 6 below were
> rewritten because of it:
>
> - the unresolved-edge guard **cannot work** (madge discards, it does not dangle); replaced by
>   a coverage floor of 85%
> - the real scope is **959 nodes**, not ~1834 — the backend's 1156 files are mostly migrations
>   and tests
> - madge reaches **outside** the configured root and pulled in a 55,580-line `swagger.json`;
>   the backend config gains `/docs/` and `\.json$` exclusions, and paths need normalising
> - the **hostage detector is removed** — it fired on 37 files, all `.module.ts`, and on zero
>   after excluding those
> - **`component` leaves `leafLayers`** — it was flagging correctly-reused shared components

**Files:**
- Create: `docs/superpowers/plans/2026-08-25-probe-findings.md`

**Interfaces:**
- Consumes: nothing.
- Produces: calibrated numbers for `painCaStar` (15), `painLoc` (400), `ampLoc` (150), `ampCe`
  (15), `ampCa` (30), `leafCa` (10) and `minCoveragePct` (85), consumed by Task 5 and Task 6.

- [ ] **Step 1: Install madge in the target project without touching its manifest**

```bash
cd /c/angular/drcall/pabx
npm install --no-save madge
node -e "console.log(require('madge/package.json').version)"
```

Expected: `8.0.0`. Confirm `git status --short` in that repository stays empty.

- [ ] **Step 2: Probe the frontend, counting unresolved edges**

```bash
cd /c/angular/drcall/pabx
node --input-type=module -e "
import madge from 'madge'
const r = await madge('apps/frontend/src', {
  fileExtensions: ['ts'],
  excludeRegExp: [/\.spec\.ts$/, /node_modules/, /\/dist\//],
  tsConfig: 'apps/frontend/tsconfig.json',
  detectiveOptions: { ts: { skipTypeImports: false } }
})
const obj = r.obj()
const files = Object.keys(obj)
const edges = Object.values(obj).flat()
const known = new Set(files)
const unresolved = edges.filter(e => !known.has(e))
console.log('files', files.length)
console.log('edges', edges.length)
console.log('unresolved', unresolved.length, (100*unresolved.length/edges.length).toFixed(1) + '%')
console.log('sample unresolved', unresolved.slice(0, 15))
"
```

Record: file count, edge count, unresolved percentage.

- [ ] **Step 3: Answer probe question 3 — do the 1282 non-relative imports resolve?**

Run Step 2 again with `tsConfig` removed. If the unresolved count jumps by roughly 1282, the
`tsConfig` option is doing its job and must never be dropped. If it does not change, the
resolution is happening some other way and the spec's warning needs rewording.

```bash
cd /c/angular/drcall/pabx
node --input-type=module -e "
import madge from 'madge'
const withCfg = (await madge('apps/frontend/src', { fileExtensions:['ts'], excludeRegExp:[/\.spec\.ts$/], tsConfig:'apps/frontend/tsconfig.json' })).obj()
const without = (await madge('apps/frontend/src', { fileExtensions:['ts'], excludeRegExp:[/\.spec\.ts$/] })).obj()
const count = o => Object.values(o).flat().length
console.log('edges with tsConfig   ', count(withCfg))
console.log('edges without tsConfig', count(without))
console.log('difference            ', count(withCfg) - count(without))
"
```

- [ ] **Step 4: Answer probe question 2 — are dynamic `import()` edges present?**

`apps/frontend/src/app/app.routes.ts` uses `loadChildren` with dynamic imports. Check whether
its entry in the graph lists the lazily loaded modules.

```bash
cd /c/angular/drcall/pabx
node --input-type=module -e "
import madge from 'madge'
const o = (await madge('apps/frontend/src', { fileExtensions:['ts'], excludeRegExp:[/\.spec\.ts$/], tsConfig:'apps/frontend/tsconfig.json' })).obj()
const routing = Object.keys(o).filter(k => k.includes('routes') || k.includes('routing'))
for (const k of routing.slice(0, 5)) console.log(k, '->', o[k].length, 'edges')
"
```

Expected if dynamic imports are followed: the routing files show many edges. If they show
zero, record it — the spec's coverage claim changes and the report must say so.

- [ ] **Step 5: Probe the backend**

```bash
cd /c/angular/drcall/pabx
node --input-type=module -e "
import madge from 'madge'
const t0 = Date.now()
const r = await madge('apps/backend/src', {
  fileExtensions: ['js'],
  excludeRegExp: [/node_modules/, /__tests__/]
})
const obj = r.obj()
const files = Object.keys(obj)
const edges = Object.values(obj).flat()
const known = new Set(files)
console.log('files', files.length)
console.log('edges', edges.length)
console.log('unresolved', edges.filter(e => !known.has(e)).length)
console.log('ms', Date.now() - t0)
console.log('fan-in authorization.middleware:',
  files.filter(f => obj[f].some(d => d.includes('authorization.middleware'))).length)
"
```

Expected: `authorization.middleware` fan-in near 93, which is the number the design was built
on. A large divergence means the basename approximation was wrong and Task 5's known findings
need revisiting.

- [ ] **Step 6: Record the distribution that calibrates the cuts**

```bash
cd /c/angular/drcall/pabx
node --input-type=module -e "
import madge from 'madge'
import { readFileSync } from 'node:fs'
const o = (await madge('apps/backend/src', { fileExtensions:['js'], excludeRegExp:[/node_modules/,/__tests__/] })).obj()
const ca = {}
for (const f of Object.keys(o)) ca[f] = 0
for (const deps of Object.values(o)) for (const d of deps) if (d in ca) ca[d]++
const rows = Object.keys(o).map(f => ({
  f, ca: ca[f], ce: o[f].length,
  loc: readFileSync('apps/backend/src/' + f, 'utf8').split('\n').length
}))
const pct = (arr, p) => arr.slice().sort((a,b)=>a-b)[Math.floor(arr.length*p)]
console.log('Ca  p50/p90/p99', pct(rows.map(r=>r.ca),.5), pct(rows.map(r=>r.ca),.9), pct(rows.map(r=>r.ca),.99))
console.log('LOC p50/p90/p99', pct(rows.map(r=>r.loc),.5), pct(rows.map(r=>r.loc),.9), pct(rows.map(r=>r.loc),.99))
console.log('Ce  p50/p90/p99', pct(rows.map(r=>r.ce),.5), pct(rows.map(r=>r.ce),.9), pct(rows.map(r=>r.ce),.99))
"
```

- [ ] **Step 7: Write the findings**

Create `docs/superpowers/plans/2026-08-25-probe-findings.md` with, for each of the four probe
questions, the measured answer and whether it confirms or contradicts the spec. End with a
table of the eight calibrated cut values and the percentile each came from.

Decision table — what each outcome forces:

| Outcome | Consequence |
|---|---|
| unresolved above 5% | Task 6 aborts by design; investigate the resolution options before continuing |
| `tsConfig` makes no difference | spec section 9 overstates the risk; correct it before Task 6 |
| dynamic imports produce no edges | routing layer is invisible; the report must state the coverage gap in the sidebar |
| backend run over 60s | Task 6 must cache the graph between runs; note it and revisit |

- [ ] **Step 8: Commit the findings**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add docs/Skill_Coupling_Map.md docs/superpowers/plans/2026-08-25-coupling-map.md docs/superpowers/plans/2026-08-25-probe-findings.md
git commit -m "Docs: the coupling-map design, its plan, and what the Madge probe actually measured

The design doc argues from numbers taken off the PABX monorepo, and half of it
exists to record which metrics were tried and rejected there - abstractness,
distance from the main sequence, LCOM - so that a later session does not
reintroduce them. The probe findings are committed alongside because the cut
values in section 7.1 are only defensible with the distribution they came from.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Taxonomy — path to domain and layer — DONE, with one correction

> **A review during implementation found a real defect in the code below: `layerFrom` was
> declared, documented and shipped, but never read.** `classify` branched only on `domainFrom`
> and the layer strategy rode along with it — `firstFolderUnder` implied suffix, `basename`
> implied folder. This repository uses exactly those two canonical pairings, so neither the
> implementation nor the tests exposed it. Since the skill generates config for arbitrary
> projects, a common layout like `src/<domain>/services/x.js` would have produced `layer: null`
> for every file, silently disabling the direction-violation detector.
>
> The interface below is the corrected one. Three independent decisions, all read:
> `domainFrom`, `layerFrom`, and a new `requireLayerForDomain` that turns the backend's
> domain-follows-layer behaviour from an accident of branch order into a declared option.
> Ten tests, not seven — the three added are the ones whose absence let it through.

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/taxonomy.mjs`
- Test: `skills/coupling-map/scripts/test/taxonomy.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `classify(relPath, appConfig) -> { app: string, domain: string, layer: string|null }`.
  `domain` is `'(sem dominio)'` when nothing matches; `layer` is `null` when no known suffix or
  folder matches. Consumed by Task 4 and Task 5.
- `appConfig` is one entry of `config.apps`, shaped:
  `{ name, root, domainFrom: 'firstFolderUnder'|'basename', domainBase?, layerFrom: 'suffix'|'folder', requireLayerForDomain?: boolean, layers: string[], layerOrder: string[], extensions: string[], exclude: string[], tsConfig?: string }`
- Resolution order inside `classify`:
  1. layer — `layerFrom === 'suffix'` uses the suffix, `'folder'` scans the folder chain
  2. domain — `requireLayerForDomain` with a null layer gives the bucket; otherwise
     `firstFolderUnder` takes the folder after `domainBase` (or the basename when the file sits
     directly under it), and `basename` takes the basename
- `requireLayerForDomain` is `true` for the backend and absent (false) for the frontend. See
  section 5 of the design doc for why the backend's 17 bucketed files are the right answer.

- [ ] **Step 1: Write the failing test**

```javascript
// skills/coupling-map/scripts/test/taxonomy.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify } from '../coupling-map/taxonomy.mjs'

const FRONTEND = {
  name: 'frontend',
  root: 'apps/frontend/src',
  domainFrom: 'firstFolderUnder',
  domainBase: 'app',
  layerFrom: 'suffix',
  layers: ['component', 'service', 'model', 'module', 'guard', 'interceptor', 'directive', 'pipe', 'resolver', 'helpers'],
}

const BACKEND = {
  name: 'backend',
  root: 'apps/backend/src',
  domainFrom: 'basename',
  layerFrom: 'folder',
  layers: ['routes', 'controllers', 'models', 'services', 'middleware', 'functions', 'utils', 'config', 'jobs', 'socket'],
}

test('frontend: domain is the first folder under app/, layer is the suffix', () => {
  assert.deepEqual(
    classify('app/dialer/campaigns/form-campaigns/form-campaigns.component.ts', FRONTEND),
    { app: 'frontend', domain: 'dialer', layer: 'component' }
  )
})

test('frontend: a file sitting directly under app/ takes its basename as domain', () => {
  assert.deepEqual(
    classify('app/event-emitter.service.ts', FRONTEND),
    { app: 'frontend', domain: 'event-emitter', layer: 'service' }
  )
})

test('frontend: an unknown suffix yields a null layer, never a guess', () => {
  assert.deepEqual(
    classify('app/reports/reports.routes.ts', FRONTEND),
    { app: 'frontend', domain: 'reports', layer: null }
  )
})

test('backend: domain is the basename without suffix, layer is the folder', () => {
  assert.deepEqual(
    classify('api/v2/models/dialer.model.js', BACKEND),
    { app: 'backend', domain: 'dialer', layer: 'models' }
  )
})

test('backend: a controller and its model share one domain', () => {
  const a = classify('api/v2/models/dialer.model.js', BACKEND)
  const b = classify('api/v2/controllers/dialer.controller.js', BACKEND)
  assert.equal(a.domain, b.domain)
  assert.notEqual(a.layer, b.layer)
})

test('backend: middleware keeps its own domain', () => {
  assert.deepEqual(
    classify('middleware/authorization.middleware.js', BACKEND),
    { app: 'backend', domain: 'authorization', layer: 'middleware' }
  )
})

test('anything unclassifiable lands in the visible bucket, never dropped', () => {
  assert.deepEqual(
    classify('something/else/weird.js', BACKEND),
    { app: 'backend', domain: '(sem dominio)', layer: null }
  )
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/taxonomy.test.mjs"
```

Expected: FAIL — cannot resolve `../coupling-map/taxonomy.mjs`.

- [ ] **Step 3: Write the implementation**

```javascript
// skills/coupling-map/scripts/coupling-map/taxonomy.mjs
const NO_DOMAIN = '(sem dominio)'

function suffixLayer(fileName, layers) {
  const parts = fileName.split('.')
  if (parts.length < 3) return null
  const candidate = parts[parts.length - 2]
  return layers.includes(candidate) ? candidate : null
}

function folderLayer(segments, layers) {
  for (const segment of segments) {
    if (layers.includes(segment)) return segment
  }
  return null
}

function stripSuffix(fileName) {
  const parts = fileName.split('.')
  return parts.length > 2 ? parts.slice(0, -2).join('.') : parts[0]
}

export function classify(relPath, appConfig) {
  const segments = relPath.split('/')
  const fileName = segments[segments.length - 1]
  const folders = segments.slice(0, -1)

  if (appConfig.domainFrom === 'firstFolderUnder') {
    const baseIndex = folders.indexOf(appConfig.domainBase)
    if (baseIndex === -1) {
      return { app: appConfig.name, domain: NO_DOMAIN, layer: null }
    }
    const after = folders[baseIndex + 1]
    const domain = after === undefined ? stripSuffix(fileName) : after
    return { app: appConfig.name, domain, layer: suffixLayer(fileName, appConfig.layers) }
  }

  const layer = folderLayer(folders, appConfig.layers)
  if (layer === null) {
    return { app: appConfig.name, domain: NO_DOMAIN, layer: null }
  }
  return { app: appConfig.name, domain: stripSuffix(fileName), layer }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/taxonomy.test.mjs"
```

Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/taxonomy.mjs skills/coupling-map/scripts/test/taxonomy.test.mjs
git commit -m "Feat: classify every source file into a domain and a layer, or into a visible bucket

The two halves of the monorepo name things differently - the frontend puts the
domain in the folder under app/ and the layer in the file suffix, the backend
does the exact opposite - so one function reads both from config rather than
two functions drifting apart.

Nothing is ever silently dropped. A path that matches no rule returns the
'(sem dominio)' bucket with a null layer, because a file quietly excluded from
the taxonomy is a file quietly excluded from every metric computed on top of
it, and the report would still look complete.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Graph — strongly connected components and transitive counts — DONE, with one correction

This is the task that carries the invariant test, and it is the one most likely to hide a bug:
a naive transitive closure over a cyclic graph either double-counts or never terminates.

> **Differential testing over 2257 random graphs confirmed the Tarjan is correct** — zero
> disagreements against brute-force BFS, and the reverse-topological-order property that the
> closure silently depends on was measured rather than assumed.
>
> **It also found that the invariant below was conditional, not universal.** `sum(caStar) ===
> sum(ceStar)` broke on 181 of 181 *open* graphs — those where a node appears only as a target
> and never as a key. `reverse` invented a key for such a target while `stronglyConnected`
> skipped it, so the two disagreed about the node set. The test comment claimed it held "for any
> graph", which was false.
>
> Fixed by making `stronglyConnected` treat an unknown target as its own singleton component, so
> all three functions agree on the node set and the invariant is **unconditional**. This matters
> beyond tidiness: the invariant is acceptance criterion 2 and is meant to run as a live check
> against real output, which it cannot do if it depends on a precondition enforced two modules
> away. Without the fix an unclosed graph yields `ce=2, ceStar=0` — arithmetically impossible,
> and silent.
>
> The fix took two lines, not one: assigning the component id is not enough, because the counts
> map was still keyed off `Object.keys(adj)` and the unknown target came back `undefined`. All
> three functions have to span the same node set.
>
> **Mutation testing showed the two tests are not redundant.** Reverting only the counts loop
> leaves the invariant test **green** — both sums still come to 3 on `{a:['b'],b:['c']}` while
> `ceStar.get('b')` is `undefined`. Only the dedicated node-set test catches it. An invariant
> over aggregates cannot see a hole that is symmetric in both directions; keep both tests.
>
> Final differential run: 2562 graphs, 486 of them open, zero failures.

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/graph.mjs`
- Test: `skills/coupling-map/scripts/test/graph.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces, all operating on `adj` of shape `{ [node: string]: string[] }` where `adj[X]`
  lists what X imports:
  - `reverse(adj) -> adj`
  - `stronglyConnected(adj) -> { componentOf: Map<string, number>, members: Map<number, string[]> }`
  - `transitiveCounts(adj) -> Map<string, number>` — for each node, how many distinct nodes are
    reachable, excluding itself and excluding the other members of its own component.
  Consumed by Task 4 (`Ca* = transitiveCounts(reverse(adj))`, `Ce* = transitiveCounts(adj)`)
  and Task 5 (cycles come from `members` entries of length > 1).

- [ ] **Step 1: Write the failing test**

```javascript
// skills/coupling-map/scripts/test/graph.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reverse, stronglyConnected, transitiveCounts } from '../coupling-map/graph.mjs'

// adj[X] = [Y] means "X imports Y". Damage flows against the arrow:
// if Y breaks, X breaks.

test('reverse flips every edge and keeps every node', () => {
  const adj = { a: ['b'], b: ['c'], c: [] }
  assert.deepEqual(reverse(adj), { a: [], b: ['a'], c: ['b'] })
})

test('a chain: everything upstream is counted', () => {
  const adj = { a: ['b'], b: ['c'], c: [] }
  const ceStar = transitiveCounts(adj)
  assert.equal(ceStar.get('a'), 2)
  assert.equal(ceStar.get('c'), 0)

  const caStar = transitiveCounts(reverse(adj))
  assert.equal(caStar.get('c'), 2)
  assert.equal(caStar.get('a'), 0)
})

test('a diamond counts each node once, not once per path', () => {
  const adj = { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }
  assert.equal(transitiveCounts(adj).get('a'), 3)
  assert.equal(transitiveCounts(reverse(adj)).get('d'), 3)
})

test('members of one cycle are excluded from each other count', () => {
  const adj = { a: ['b'], b: ['a'], c: ['a'], d: [] }
  const caStar = transitiveCounts(reverse(adj))
  assert.equal(caStar.get('a'), 1)
  assert.equal(caStar.get('b'), 1)
})

test('a cycle is one component; isolated nodes are their own', () => {
  const adj = { a: ['b'], b: ['a'], c: [] }
  const { componentOf, members } = stronglyConnected(adj)
  assert.equal(componentOf.get('a'), componentOf.get('b'))
  assert.notEqual(componentOf.get('a'), componentOf.get('c'))
  const cycles = [...members.values()].filter(m => m.length > 1)
  assert.equal(cycles.length, 1)
  assert.deepEqual(cycles[0].slice().sort(), ['a', 'b'])
})

test('the invariant: summing Ca* equals summing Ce*', () => {
  // Both sums count the same set of ordered reachable pairs, once from each
  // end. Any divergence is a bug in the traversal, so this holds for any graph.
  const graphs = [
    { a: ['b'], b: ['c'], c: [] },
    { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] },
    { a: ['b'], b: ['a'], c: ['a'], d: ['c'], e: [] },
    { a: [], b: [], c: [] },
  ]
  for (const adj of graphs) {
    const sum = m => [...m.values()].reduce((x, y) => x + y, 0)
    assert.equal(sum(transitiveCounts(adj)), sum(transitiveCounts(reverse(adj))))
  }
})

test('a graph with no edges yields zero everywhere and never hangs', () => {
  const counts = transitiveCounts({ a: [], b: [] })
  assert.equal(counts.get('a'), 0)
  assert.equal(counts.get('b'), 0)
})

test('a large cycle does not blow the stack', () => {
  const adj = {}
  const n = 5000
  for (let i = 0; i < n; i++) adj['n' + i] = ['n' + ((i + 1) % n)]
  const counts = transitiveCounts(adj)
  assert.equal(counts.get('n0'), 0)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/graph.test.mjs"
```

Expected: FAIL — cannot resolve `../coupling-map/graph.mjs`.

- [ ] **Step 3: Write the implementation**

Tarjan is written iteratively on purpose: the last test drives a 5000-node cycle through it,
and a recursive version overflows the stack well before that.

```javascript
// skills/coupling-map/scripts/coupling-map/graph.mjs
export function reverse(adj) {
  const out = {}
  for (const node of Object.keys(adj)) out[node] = []
  for (const [from, targets] of Object.entries(adj)) {
    for (const to of targets) {
      if (!(to in out)) out[to] = []
      out[to].push(from)
    }
  }
  return out
}

export function stronglyConnected(adj) {
  const nodes = Object.keys(adj)
  const index = new Map()
  const low = new Map()
  const onStack = new Set()
  const stack = []
  const componentOf = new Map()
  const members = new Map()
  let counter = 0
  let componentId = 0

  for (const root of nodes) {
    if (index.has(root)) continue
    const work = [[root, 0]]
    while (work.length > 0) {
      const frame = work[work.length - 1]
      const [node, childIndex] = frame
      if (childIndex === 0) {
        index.set(node, counter)
        low.set(node, counter)
        counter += 1
        stack.push(node)
        onStack.add(node)
      }
      const targets = adj[node] || []
      if (childIndex < targets.length) {
        frame[1] += 1
        const next = targets[childIndex]
        if (!(next in adj)) continue
        if (!index.has(next)) {
          work.push([next, 0])
        } else if (onStack.has(next)) {
          low.set(node, Math.min(low.get(node), index.get(next)))
        }
        continue
      }
      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1][0]
        low.set(parent, Math.min(low.get(parent), low.get(node)))
      }
      if (low.get(node) === index.get(node)) {
        const group = []
        let popped
        do {
          popped = stack.pop()
          onStack.delete(popped)
          componentOf.set(popped, componentId)
          group.push(popped)
        } while (popped !== node)
        members.set(componentId, group)
        componentId += 1
      }
    }
  }

  return { componentOf, members }
}

export function transitiveCounts(adj) {
  const { componentOf, members } = stronglyConnected(adj)

  const componentEdges = new Map()
  for (const id of members.keys()) componentEdges.set(id, new Set())
  for (const [from, targets] of Object.entries(adj)) {
    const fromId = componentOf.get(from)
    for (const to of targets) {
      if (!componentOf.has(to)) continue
      const toId = componentOf.get(to)
      if (toId !== fromId) componentEdges.get(fromId).add(toId)
    }
  }

  const order = [...members.keys()].sort((a, b) => a - b)
  const reach = new Map()
  for (const id of order) {
    const set = new Set()
    for (const next of componentEdges.get(id)) {
      set.add(next)
      for (const deep of reach.get(next) || []) set.add(deep)
    }
    reach.set(id, set)
  }

  const counts = new Map()
  for (const node of Object.keys(adj)) {
    const id = componentOf.get(node)
    let total = 0
    for (const other of reach.get(id)) total += members.get(other).length
    counts.set(node, total)
  }
  return counts
}
```

Tarjan emits components in reverse topological order, so ascending `componentId` is already a
valid processing order for the closure — no separate topological sort is needed.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/graph.test.mjs"
```

Expected: `# pass 9`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/graph.mjs skills/coupling-map/scripts/test/graph.test.mjs
git commit -m "Feat: transitive blast radius over a graph that has cycles in it

Ca* answers 'how many modules break if this one breaks', which is the number
the whole report is ordered by, and computing it naively on a cyclic import
graph either double-counts through diamonds or never terminates. Components are
collapsed with Tarjan first, and members of one cycle are excluded from each
other's count - they are already mutually coupled and the cycle detector is
where that gets reported.

Tarjan is iterative rather than recursive because a real import graph can hold
a cycle long enough to overflow the stack; a 5000-node ring is in the tests for
exactly that reason.

The suite carries one invariant that holds for any graph: summing Ca* over
every node equals summing Ce*, since both count the same ordered reachable
pairs from opposite ends. It catches traversal bugs no hand-written case would.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Metrics — per file and per domain — DONE, with two corrections

> Review during implementation found two places where an acceptance criterion depended on
> something a caller elsewhere had to remember — the same shape Task 3 had just removed.
>
> **Rows came from `Object.keys(adj)`**, so a node that is only ever a target got no row at all.
> Measured: in 446 of 750 random open graphs, `sum(caStar) !== sum(ceStar)` — acceptance
> criterion 2 would read BROKEN. `Object.keys(rev)` fixes it for free, since `reverse()` already
> closes the node set, and such rows degrade into the visible `(sem dominio)` bucket.
>
> **`domains` sorted with `localeCompare`**, which takes the runtime default collator — pt-BR on
> this machine, unaffected by `LANG`. It disagrees with the code-unit sort used everywhere else
> in the same module, and a Swedish-locale machine orders `å/ä/ö` after `z`. Since the tool
> exists to compare two runs, a report generated on another machine would diff like an
> architectural change. Replaced by the plain sort.
>
> Two behaviours the plan's seven tests never pinned, both now covered: `i === 0` is a real and
> different position from `i === null` (27 real backend files sit at exactly 0, 8 at null — a
> guard written as `ce === 0` passes all seven tests and turns those 27 into orphans); and
> `ce > 0` with `ceStar === 0` is **correct**, not impossible, when every direct target sits in
> the node's own component. Eleven tests, not seven.

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/metrics.mjs`
- Test: `skills/coupling-map/scripts/test/metrics.test.mjs`

**Interfaces:**
- Consumes: `transitiveCounts` and `reverse` from `graph.mjs` (Task 3); `classify` from
  `taxonomy.mjs` (Task 2).
- Produces:
  `computeMetrics({ adj, loc, taxonomy }) -> { files: FileRow[], domains: DomainRow[] }`
  where `loc` is `{ [path]: number }` and `taxonomy` is `{ [path]: { app, domain, layer } }`.
  - `FileRow = { path, app, domain, layer, loc, ce, ca, ceStar, caStar, i, dependsOn: string[], dependedOnBy: string[] }`
  - `i` is `null` when `ca + ce === 0`.
  - `DomainRow = { domain, apps: string[], files: number, loc, ce, ca, caStar, ceStar }` where
    `caStar` and `ceStar` are the maximum over the domain's files, not the sum — a domain is as
    exposed as its most exposed file, and summing would make large domains look dangerous purely
    for being large.
  Consumed by Task 5, Task 6 and Task 7.

- [ ] **Step 1: Write the failing test**

```javascript
// skills/coupling-map/scripts/test/metrics.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from '../coupling-map/metrics.mjs'

const INPUT = {
  adj: { 'a.ts': ['b.ts'], 'b.ts': ['c.ts'], 'c.ts': [], 'lonely.ts': [] },
  loc: { 'a.ts': 100, 'b.ts': 50, 'c.ts': 40, 'lonely.ts': 10 },
  taxonomy: {
    'a.ts': { app: 'frontend', domain: 'alpha', layer: 'component' },
    'b.ts': { app: 'frontend', domain: 'alpha', layer: 'service' },
    'c.ts': { app: 'backend', domain: 'alpha', layer: 'models' },
    'lonely.ts': { app: 'frontend', domain: 'beta', layer: null },
  },
}

const rowFor = (result, path) => result.files.find(f => f.path === path)

test('Ce and Ca count direct edges in each direction', () => {
  const r = computeMetrics(INPUT)
  assert.equal(rowFor(r, 'b.ts').ce, 1)
  assert.equal(rowFor(r, 'b.ts').ca, 1)
  assert.equal(rowFor(r, 'c.ts').ce, 0)
  assert.equal(rowFor(r, 'c.ts').ca, 1)
})

test('Ca* is the blast radius, Ce* the fragility', () => {
  const r = computeMetrics(INPUT)
  assert.equal(rowFor(r, 'c.ts').caStar, 2)
  assert.equal(rowFor(r, 'a.ts').ceStar, 2)
})

test('instability is Ce over Ca plus Ce, and null when both are zero', () => {
  const r = computeMetrics(INPUT)
  assert.equal(rowFor(r, 'b.ts').i, 0.5)
  assert.equal(rowFor(r, 'lonely.ts').i, null)
})

test('the neighbour lists are carried through for the report card', () => {
  const r = computeMetrics(INPUT)
  assert.deepEqual(rowFor(r, 'b.ts').dependsOn, ['c.ts'])
  assert.deepEqual(rowFor(r, 'b.ts').dependedOnBy, ['a.ts'])
})

test('a domain spanning both apps is one row that names both', () => {
  const r = computeMetrics(INPUT)
  const alpha = r.domains.find(d => d.domain === 'alpha')
  assert.equal(alpha.files, 3)
  assert.equal(alpha.loc, 190)
  assert.deepEqual(alpha.apps.slice().sort(), ['backend', 'frontend'])
})

test('a domain takes the maximum Ca* of its files, never the sum', () => {
  const r = computeMetrics(INPUT)
  const alpha = r.domains.find(d => d.domain === 'alpha')
  assert.equal(alpha.caStar, 2)
})

test('output ordering is deterministic', () => {
  const a = computeMetrics(INPUT)
  const b = computeMetrics(INPUT)
  assert.deepEqual(a.files.map(f => f.path), b.files.map(f => f.path))
  assert.deepEqual(a.files.map(f => f.path), ['a.ts', 'b.ts', 'c.ts', 'lonely.ts'])
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/metrics.test.mjs"
```

Expected: FAIL — cannot resolve `../coupling-map/metrics.mjs`.

- [ ] **Step 3: Write the implementation**

```javascript
// skills/coupling-map/scripts/coupling-map/metrics.mjs
import { reverse, transitiveCounts } from './graph.mjs'

export function computeMetrics({ adj, loc, taxonomy }) {
  const rev = reverse(adj)
  const ceStar = transitiveCounts(adj)
  const caStar = transitiveCounts(rev)
  const paths = Object.keys(adj).sort()

  const files = paths.map(path => {
    const dependsOn = (adj[path] || []).slice().sort()
    const dependedOnBy = (rev[path] || []).slice().sort()
    const ce = dependsOn.length
    const ca = dependedOnBy.length
    const tax = taxonomy[path] || { app: null, domain: '(sem dominio)', layer: null }
    return {
      path,
      app: tax.app,
      domain: tax.domain,
      layer: tax.layer,
      loc: loc[path] ?? 0,
      ce,
      ca,
      ceStar: ceStar.get(path) ?? 0,
      caStar: caStar.get(path) ?? 0,
      i: ca + ce === 0 ? null : ce / (ca + ce),
      dependsOn,
      dependedOnBy,
    }
  })

  const grouped = new Map()
  for (const file of files) {
    if (!grouped.has(file.domain)) grouped.set(file.domain, [])
    grouped.get(file.domain).push(file)
  }

  const domains = [...grouped.entries()]
    .map(([domain, rows]) => ({
      domain,
      apps: [...new Set(rows.map(r => r.app).filter(Boolean))].sort(),
      files: rows.length,
      loc: rows.reduce((sum, r) => sum + r.loc, 0),
      ce: rows.reduce((sum, r) => sum + r.ce, 0),
      ca: rows.reduce((sum, r) => sum + r.ca, 0),
      caStar: Math.max(...rows.map(r => r.caStar)),
      ceStar: Math.max(...rows.map(r => r.ceStar)),
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain))

  return { files, domains }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/metrics.test.mjs"
```

Expected: `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/metrics.mjs skills/coupling-map/scripts/test/metrics.test.mjs
git commit -m "Feat: per-file and per-domain metrics, with domains taking a maximum not a sum

A domain is as exposed as its most exposed file. Summing Ca* across a domain
would rank domains by how many files they contain, which is a size ranking
wearing a risk label, so the aggregate takes the maximum instead.

Instability is null rather than zero when a file has no edges at all. Zero is a
real position on that scale and means 'many depend on it, it depends on
nothing' - the opposite of an isolated file - so collapsing the two would put
orphans in the most-stable corner of every chart.

Every array is sorted on the way out. Two runs over the same tree must produce
byte-identical output, otherwise comparing a report before and after a
refactoring shows diff noise instead of change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Detectors — DONE, with five corrections

> The code block below is the version that was written first, deliberately, so the independent
> checks would produce evidence instead of opinion. Against it, five things were wrong:
>
> 1. **`directionViolation` was pushed once per violating edge**, not once per file.
>    `realtime-agent.model.js` carried the same detector five times; four backend models had
>    duplicates.
> 2. **The cycle sort used `localeCompare`** — the exact defect Task 4 had just removed from
>    `metrics.mjs`, rewritten into this file. Same fix: the plain comparator.
> 3. **`directionViolations` was the only array not sorted on the way out**, so its order was
>    madge's filesystem traversal order. Acceptance criterion 8 wants byte-identical runs.
> 4. **The plan's own tests 8 and 9 failed against the plan's own implementation.** Their
>    fixtures left `ce`/`ca` at zero on rows whose `adj` gave them neighbours, so the orphan
>    detector correctly fired and the assertion compared against the wrong list. The fixture
>    contradicted itself.
> 5. Seventeen tests, not nine.
>
> **Verified end to end against the real repository**, independently of the agent that wrote it:
> 959 nodes, pain 12, amplifier 1, controller-as-dependency 3, 2 cycles, 14 direction violations
> (13 of them `models -> controllers`), invariant `Σ Ca* = Σ Ce* = 15987`, two runs identical,
> and acceptance criterion 5 passing in both directions. Orphans came out 24 against the probe's
> 23, and the probe was the one that was stale — see the correction appended to
> `2026-08-25-probe-findings.md`.

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/detect.mjs`
- Test: `skills/coupling-map/scripts/test/detect.test.mjs`

**Interfaces:**
- Consumes: `FileRow[]` from Task 4; `stronglyConnected` from Task 3.
- Produces: `detect({ files, adj, config }) -> { pain, amplifier, leafAsDependency, directionViolations, cycles, orphans }`
  where the first four are `string[]` of paths, `directionViolations` is
  `{ from, to, fromLayer, toLayer }[]`, `cycles` is `string[][]`, `orphans` is `string[]`.
  Each `FileRow` also gains a `detectors: string[]` field, set by this function.
- `config.cuts` carries the eight numbers calibrated in Task 1;
  `config.leafLayers` lists layers that must not be depended upon;
  `config.apps[].layerOrder` gives the allowed direction, first element being the top.

- [ ] **Step 1: Write the failing test**

```javascript
// skills/coupling-map/scripts/test/detect.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detect } from '../coupling-map/detect.mjs'

const CONFIG = {
  cuts: {
    painCaStar: 15, painLoc: 400,
    ampLoc: 150, ampCe: 15, ampCa: 30,
    leafCa: 10,
  },
  // Backend controllers only. The probe showed that including 'component' flags
  // correctly-reused shared components: breadcrumbs (Ca 69), loading (42),
  // pagination (41). Reuse is the point of a shared component.
  leafLayers: ['controllers'],
  apps: [{ name: 'backend', layerOrder: ['routes', 'controllers', 'models'] }],
}

const row = over => ({
  path: 'x.js', app: 'backend', domain: 'x', layer: 'models',
  loc: 10, ce: 0, ca: 0, ceStar: 0, caStar: 0, i: null,
  dependsOn: [], dependedOnBy: [], ...over,
})

test('pain zone needs both a big blast radius and a big file', () => {
  const files = [
    row({ path: 'middleware/authorization.middleware.js', layer: 'middleware', loc: 1415, caStar: 93 }),
    row({ path: 'small-but-central.js', loc: 43, caStar: 131 }),
    row({ path: 'big-but-isolated.js', loc: 4402, caStar: 2 }),
  ]
  const r = detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(r.pain, ['middleware/authorization.middleware.js'])
})

test('a healthy foundation is never reported as pain', () => {
  const files = [row({ path: 'toast.service.ts', loc: 43, ca: 131, caStar: 131, ce: 4 })]
  const r = detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(r.pain, [])
  assert.deepEqual(r.amplifier, [])
})

test('an amplifier is small yet passes risk through in both directions', () => {
  const files = [row({ path: 'shared.module.ts', loc: 89, ce: 28, ca: 59 })]
  const r = detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(r.amplifier, ['shared.module.ts'])
})

test('a controller used as a dependency is flagged, a busy model is not', () => {
  const files = [
    row({ path: 'permission.controller.js', layer: 'controllers', ca: 33 }),
    row({ path: 'quiet.controller.js', layer: 'controllers', ca: 1 }),
    row({ path: 'busy.model.js', layer: 'models', ca: 33 }),
  ]
  const r = detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(r.leafAsDependency, ['permission.controller.js'])
})

test('a heavily reused shared component is never flagged as a defect', () => {
  // The probe caught this: breadcrumbs.component.ts has Ca 69 and 72 lines, and
  // flagging it would send someone to refactor the foundation of the UI.
  const files = [
    row({ path: 'breadcrumbs.component.ts', app: 'frontend', layer: 'component', ca: 69, loc: 72 }),
  ]
  const r = detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(r.leafAsDependency, [])
  assert.deepEqual(r.pain, [])
  assert.deepEqual(files[0].detectors, [])
})

test('an edge climbing the layer order is a violation, descending is not', () => {
  const files = [
    row({ path: 'm.js', layer: 'models', dependsOn: ['c.js'] }),
    row({ path: 'c.js', layer: 'controllers', dependsOn: ['m.js'] }),
  ]
  const r = detect({ files, adj: { 'm.js': ['c.js'], 'c.js': ['m.js'] }, config: CONFIG })
  assert.equal(r.directionViolations.length, 1)
  assert.deepEqual(r.directionViolations[0], {
    from: 'm.js', to: 'c.js', fromLayer: 'models', toLayer: 'controllers',
  })
})

test('a file importing itself is a cycle even though its component is a singleton', () => {
  // Tarjan puts a self-looping node in a component of one, so filtering on
  // members.length > 1 alone would skip it. Task 3's differential run surfaced
  // this; whether it counts as a cycle is this filter's decision, not Tarjan's.
  const files = [row({ path: 'self.js' })]
  const r = detect({ files, adj: { 'self.js': ['self.js'] }, config: CONFIG })
  assert.equal(r.cycles.length, 1)
  assert.deepEqual(r.cycles[0], ['self.js'])
})

test('cycles come from the components, orphans from having no edges at all', () => {
  const files = [row({ path: 'a.js' }), row({ path: 'b.js' }), row({ path: 'z.js' })]
  const r = detect({ files, adj: { 'a.js': ['b.js'], 'b.js': ['a.js'], 'z.js': [] }, config: CONFIG })
  assert.equal(r.cycles.length, 1)
  assert.deepEqual(r.cycles[0].slice().sort(), ['a.js', 'b.js'])
  assert.deepEqual(r.orphans, ['z.js'])
})

test('each file carries the list of detectors it tripped', () => {
  const files = [row({ path: 'p.js', layer: 'middleware', loc: 1415, caStar: 93 })]
  detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(files[0].detectors, ['pain'])
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/detect.test.mjs"
```

Expected: FAIL — cannot resolve `../coupling-map/detect.mjs`.

- [ ] **Step 3: Write the implementation**

```javascript
// skills/coupling-map/scripts/coupling-map/detect.mjs
import { stronglyConnected } from './graph.mjs'

function layerRank(app, layer, config) {
  const appConfig = config.apps.find(a => a.name === app)
  if (!appConfig) return -1
  return appConfig.layerOrder.indexOf(layer)
}

export function detect({ files, adj, config }) {
  const cuts = config.cuts
  const byPath = new Map(files.map(f => [f.path, f]))
  for (const file of files) file.detectors = []

  const pain = []
  const amplifier = []
  const leafAsDependency = []

  for (const f of files) {
    if (f.caStar >= cuts.painCaStar && f.loc >= cuts.painLoc) {
      pain.push(f.path)
      f.detectors.push('pain')
    }
    if (f.loc <= cuts.ampLoc && f.ce >= cuts.ampCe && f.ca >= cuts.ampCa) {
      amplifier.push(f.path)
      f.detectors.push('amplifier')
    }
    if (config.leafLayers.includes(f.layer) && f.ca >= cuts.leafCa) {
      leafAsDependency.push(f.path)
      f.detectors.push('leafAsDependency')
    }
  }

  const directionViolations = []
  for (const [from, targets] of Object.entries(adj)) {
    const fromRow = byPath.get(from)
    if (!fromRow) continue
    const fromRank = layerRank(fromRow.app, fromRow.layer, config)
    if (fromRank === -1) continue
    for (const to of targets) {
      const toRow = byPath.get(to)
      if (!toRow || toRow.app !== fromRow.app) continue
      const toRank = layerRank(toRow.app, toRow.layer, config)
      if (toRank === -1) continue
      if (toRank < fromRank) {
        directionViolations.push({
          from, to, fromLayer: fromRow.layer, toLayer: toRow.layer,
        })
        fromRow.detectors.push('directionViolation')
      }
    }
  }

  const { members } = stronglyConnected(adj)
  const cycles = [...members.values()]
    .filter(group => group.length > 1 || (adj[group[0]] || []).includes(group[0]))
    .map(group => group.slice().sort())
    .sort((a, b) => a[0].localeCompare(b[0]))

  for (const group of cycles) {
    for (const path of group) {
      const row = byPath.get(path)
      if (row) row.detectors.push('cycle')
    }
  }

  const orphans = files
    .filter(f => f.ca === 0 && f.ce === 0)
    .map(f => f.path)
    .sort()

  for (const path of orphans) byPath.get(path).detectors.push('orphan')

  return {
    pain: pain.sort(),
    amplifier: amplifier.sort(),
    leafAsDependency: leafAsDependency.sort(),
    directionViolations,
    cycles,
    orphans,
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/detect.test.mjs"
```

Expected: `# pass 17`, `# fail 0`. If the pain-zone test fails because the calibrated cuts from
Task 1 moved, update `CONFIG` in the test to the calibrated values and re-run — the assertions
about which file trips which detector must still hold.

- [ ] **Step 5: Run the whole suite**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/*.test.mjs"
```

Expected: 48 passing, 0 failing.

- [ ] **Step 6: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/detect.mjs skills/coupling-map/scripts/test/detect.test.mjs
git commit -m "Feat: six detectors, and the one test that keeps the report honest

The detectors exist because a scatter plot cannot show them. An amplifier is a
small file that passes risk through - 89 lines, 28 out, 59 in - and it plots
near the floor looking harmless.

The test that matters most is the one asserting a healthy foundation is NOT
reported. A 43-line utility that 131 files import is correct, and a tool that
ranks by fan-in alone would put it first and send someone to refactor the
foundation of the system. Pain requires a large blast radius AND a large file;
either one alone is not a finding.

Cycles are read off the strongly connected components and orphans off having no
edges, rather than calling madge for either. One graph, one source of truth.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Collector, CLI, and the `architecture.json` contract — DONE, with four corrections

> The code blocks below are what was written first. Against them, four things changed, and one
> line of the plan turned out to be wrong about its own behaviour:
>
> 1. **`existsSync` guards the wrong failure.** It answers "is the path there", and the read that
>    follows can still throw. Reproduced deliberately: a file `madge` lists but node cannot open
>    (`icacls /deny` on Windows; a locked file does the same) escapes `readFileSync` as an
>    unhandled `EPERM` and takes the whole run down with a stack trace. The plan's Step 1 promised
>    a fallback and did not have one. Replaced by a `readSource` that returns `null` on any read
>    failure — which also covers the non-existent case, so `existsSync` is gone — with the count
>    surfaced as `totals.unreadable` so a degraded number is visible rather than silent.
> 2. **The coverage floor is now checked per app as well as on the total.** One misconfigured
>    small app is diluted inside a large healthy one — on this monorepo the backend is 20% of the
>    declared imports, so it could lose most of its graph and still leave the aggregate near the
>    floor. The aggregate also cannot say *which* app to fix. `totals.coverageByApp` carries the
>    breakdown and the abort message names each failing scope. Verified: dropping `tsConfig` prints
>    `total 68.2%` **and** `frontend 57.8%`, exits 1, and writes nothing.
> 3. **The CLI states the invariant.** `Σ Ca*` and `Σ Ce*` are printed on every run with `OK` or
>    `BROKEN`, so acceptance criterion 2 is a line of normal output instead of a separate script
>    somebody has to remember to run. Domain and direction-violation counts were added to the
>    printout for the same reason.
>
> 4. **`declared` did not count `require()`, and the reasoning that left it alone was inverted.**
>    Coverage is `edges / declared`, so undercounting the denominator reads as *higher* coverage
>    and a *quieter* guard — a false negative, which is the failure the floor exists to prevent,
>    not the safe direction. It changes almost nothing here (backend 109.5% to 101.8%, total
>    103.7% to 102.2%, both far above the floor) and that is exactly why it was easy to miss: the
>    hole opens on some other project, a CommonJS one, where `declared` would count almost
>    nothing and the guard would report healthy over a collapsed graph. The counting moved into
>    its own module, `coupling-map/declared.mjs`, for one reason: `collect.mjs` imports `madge`
>    and cannot be tested in a repository with no `node_modules`, which left the single most
>    important number in this task covered by nothing but one manual run. `declared.mjs` has no
>    dependency and `test/declared.test.mjs` pins thirteen cases, including two **known
>    undercounts left deliberately in place** — a multi-line import and a bare `import './x'`,
>    87 and 1 occurrence respectively in this monorepo — so that widening the patterns later
>    shows up as a flipped assertion instead of a number that moved on its own.
>
> `render.mjs` is a **throwaway stub** committed in `064b68c` purely so the CLI can be imported
> before Task 7 exists. Task 7 replaces the whole file.
>
> **Verified end to end against the real repository:** 959 nodes, 196 domains, 3139 edges,
> coverage 102.2% total / 102.3% frontend / 101.8% backend, pain 12, amplifier 1,
> controller-as-dependency 3, orphans 24, cycles 2, direction violations 14, invariant
> `Σ Ca* = Σ Ce* = 15987`, two runs byte-identical (same sha256, no date-like token anywhere in
> the JSON), and acceptance criterion 5 passing in both directions. Path normalisation confirmed
> on real data: no node path contains `..` or a backslash, and `apps/backend/database.js` is a
> single node with `Ca` 85. Backend edges are 671, not the probe's 674: that table predates the
> `\.json$` exclusion this same probe introduced, which is also why orphans are 24.
>
> Two observations that are not defects. The fill loop for targets missing from `adj` never fires
> here — `madge` returned no edge target that was not also a key, in either app — so it is a guard,
> not a code path this repository exercises. And `loc` counts `split('\n').length`, one more than
> `wc -l` for a newline-terminated file (`authorization.middleware.js`: 1416 against 1415); the
> probe used the same convention, the numbers match it, and the measure is comparative.

The first task that touches `madge`, and the first that runs end to end against a real tree.

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/collect.mjs`
- Create: `skills/coupling-map/scripts/arch-report.mjs`
- Create: `skills/coupling-map/references/config-schema.md`
- Create: `skills/coupling-map/references/report-contract.md`

**Interfaces:**
- Consumes: everything from Tasks 2 through 5.
- Produces:
  - `collect(config, repoRoot) -> Promise<{ adj, loc, taxonomy, stats: { files, edges, declared, coveragePct } }>`
  - CLI: `node scripts/arch-report.mjs [--config arch.config.json] [--out architecture-report]`
  - `architecture-report/architecture.json`, whose shape Task 7 reads.

- [ ] **Step 1: Write the collector**

Three things the probe forced, none of them obvious from the outside:

1. **Paths are normalised, not just prefixed.** madge follows imports *out of* the configured
   root and returns them with `../`, so `apps/backend/src/../database.js` and
   `apps/backend/database.js` would otherwise become two nodes for one file.
2. **Coverage, not unresolved edges.** madge *discards* what it cannot resolve rather than
   leaving the edge dangling, so counting "targets not in the file set" returns zero even when
   half the graph is missing. Coverage is measured against imports declared in the source.
3. **`String.fromCharCode(92)`** is used for the backslash rather than a literal, so the
   pattern survives being copied through shells and heredocs.

```javascript
// skills/coupling-map/scripts/coupling-map/collect.mjs
import { readFileSync, existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import madge from 'madge'
import { classify } from './taxonomy.mjs'

const BACKSLASH = String.fromCharCode(92)

const DECLARED = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?from\s+['"](\.{1,2}\/|app\/|src\/|environments\/|shared\/|core\/)[^'"]*['"]/g
const DYNAMIC = /import\(\s*['"](\.{1,2}\/|app\/|src\/)[^'"]*['"]\s*\)/g

function countDeclared(text) {
  return (text.match(DECLARED) || []).length + (text.match(DYNAMIC) || []).length
}

export async function collect(config, repoRoot) {
  const adj = {}
  const loc = {}
  const taxonomy = {}
  let edges = 0
  let declared = 0

  for (const app of config.apps) {
    const options = {
      fileExtensions: app.extensions,
      excludeRegExp: app.exclude,
    }
    if (app.tsConfig) options.tsConfig = join(repoRoot, app.tsConfig)

    const obj = (await madge(join(repoRoot, app.root), options)).obj()
    const key = rel => normalize(app.root + '/' + rel).split(BACKSLASH).join('/')

    for (const relPath of Object.keys(obj)) {
      const path = key(relPath)
      adj[path] = obj[relPath].map(key)
      edges += obj[relPath].length
      taxonomy[path] = classify(relPath, app)

      const absolute = join(repoRoot, path)
      if (existsSync(absolute)) {
        const text = readFileSync(absolute, 'utf8')
        loc[path] = text.split('\n').length
        declared += countDeclared(text)
      } else {
        loc[path] = 0
      }
    }
  }

  for (const target of Object.values(adj).flat()) {
    if (target in adj) continue
    adj[target] = []
    loc[target] = 0
    taxonomy[target] = { app: null, domain: '(sem dominio)', layer: null }
  }

  return {
    adj,
    loc,
    taxonomy,
    stats: {
      files: Object.keys(adj).length,
      edges,
      declared,
      coveragePct: declared === 0 ? 100 : (100 * edges) / declared,
    },
  }
}
```

`excludeRegExp` is passed as an array of **strings**: madge does `excludeRegExp.map(re => new
RegExp(re))` internally, so strings keep the config JSON-serialisable.

- [ ] **Step 2: Write the CLI**

The coverage abort is the single most important line in this file. Measured on this monorepo: a
mis-passed `tsConfig` drops the frontend from 2468 edges to 1394 — **43.5% of the graph** — and
the report still renders and still looks plausible, which is the worst failure mode this tool
has. Coverage falls from 102.3% to 57.8%, which is a signal wide enough to act on.

```javascript
// skills/coupling-map/scripts/arch-report.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { collect } from './coupling-map/collect.mjs'
import { computeMetrics } from './coupling-map/metrics.mjs'
import { detect } from './coupling-map/detect.mjs'
import { renderHtml } from './coupling-map/render.mjs'

const SCRIPT_VERSION = '1.0.0'

function arg(name, fallback) {
  const index = process.argv.indexOf('--' + name)
  return index === -1 ? fallback : process.argv[index + 1]
}

function head() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const repoRoot = process.cwd()
const configPath = arg('config', 'arch.config.json')
const outDir = arg('out', 'architecture-report')
const config = JSON.parse(readFileSync(configPath, 'utf8'))

const { adj, loc, taxonomy, stats } = await collect(config, repoRoot)

const floor = config.minCoveragePct ?? 85
if (stats.coveragePct < floor) {
  console.error(
    'Coverage: ' +
      stats.edges +
      ' resolved edges against ' +
      stats.declared +
      ' declared imports (' +
      stats.coveragePct.toFixed(1) +
      '%), below the ' +
      floor +
      '% floor.'
  )
  console.error('Every metric below this line would be understated. Check tsConfig and extensions.')
  process.exit(1)
}

const { files, domains } = computeMetrics({ adj, loc, taxonomy })
const detectors = detect({ files, adj, config })

const noDomain = files.filter(f => f.domain === '(sem dominio)')

const report = {
  meta: {
    scriptVersion: SCRIPT_VERSION,
    generatedFrom: head(),
    cuts: config.cuts,
  },
  totals: {
    files: stats.files,
    edges: stats.edges,
    declared: stats.declared,
    coveragePct: Number(stats.coveragePct.toFixed(1)),
    unclassified: noDomain.length,
  },
  files,
  domains,
  detectors,
}

mkdirSync(outDir, { recursive: true })
writeFileSync(outDir + '/architecture.json', JSON.stringify(report, null, 2) + '\n')
writeFileSync(outDir + '/index.html', renderHtml(report))

console.log('files          ' + stats.files)
console.log('edges          ' + stats.edges + ' (coverage ' + stats.coveragePct.toFixed(1) + '%)')
console.log('unclassified   ' + noDomain.length)
console.log('pain zone      ' + detectors.pain.length)
console.log('amplifiers     ' + detectors.amplifier.length)
console.log('controllers    ' + detectors.leafAsDependency.length)
console.log('cycles         ' + detectors.cycles.length)
console.log('orphans        ' + detectors.orphans.length)
console.log('written to     ' + outDir + '/index.html')
```

Note the deliberate ordering: `meta.generatedFrom` records the commit so two reports can be
told apart, but no timestamp is written anywhere — a timestamp would make every run differ and
break the byte-identical comparison the acceptance criteria depend on.

- [ ] **Step 3: Write the config for the PABX monorepo**

Write this with the Write tool rather than a heredoc — a shell heredoc mangles the backslashes
in the exclude patterns, which was hit during the probe.

```json
{
  "minCoveragePct": 85,
  "apps": [
    {
      "name": "frontend",
      "root": "apps/frontend/src",
      "extensions": ["ts"],
      "exclude": ["\\.spec\\.ts$", "node_modules", "/dist/"],
      "tsConfig": "apps/frontend/tsconfig.json",
      "domainFrom": "firstFolderUnder",
      "domainBase": "app",
      "layerFrom": "suffix",
      "layers": ["component", "service", "model", "module", "guard", "interceptor", "directive", "pipe", "resolver", "helpers"],
      "layerOrder": ["component", "service", "model"]
    },
    {
      "name": "backend",
      "root": "apps/backend/src",
      "extensions": ["js"],
      "exclude": ["node_modules", "__tests__", "/docs/", "\\.json$"],
      "domainFrom": "basename",
      "layerFrom": "folder",
      "requireLayerForDomain": true,
      "layers": ["routes", "controllers", "models", "services", "middleware", "functions", "utils", "config", "jobs", "socket"],
      "layerOrder": ["routes", "controllers", "models"]
    }
  ],
  "leafLayers": ["controllers"],
  "cuts": {
    "painCaStar": 15,
    "painLoc": 400,
    "ampLoc": 150,
    "ampCe": 15,
    "ampCa": 30,
    "leafCa": 10
  }
}
```

Every value here was calibrated in Task 1 and is frozen. Three of them are not guesses and must
not be "tidied":

- **`/docs/` and `\.json$` in the backend** keep `swagger.json` (55,580 lines) out of the LOC
  axis. madge reaches outside `apps/backend/src` and finds it.
- **`leafLayers` holds `controllers` only.** Adding `component` back flags
  `breadcrumbs.component.ts` (Ca 69) and three other correctly-reused shared components.
- **`painCaStar` is 15, not 20.** At 20 the queue drops `reports.controller.js` (2027 lines),
  `reports-agent.model.js` (2254) and `agents.model.js` (1794).
- **`requireLayerForDomain` is true on the backend and absent on the frontend.** It sends the 17
  backend files outside any layer folder — `ami.js`, `database.js`, `knexfile.js`,
  `api/v2/index.js` — to the visible bucket. They are infrastructure, not domains; promoting
  them by basename would manufacture 17 single-file domains and put `index` on the chart as if
  it were a feature.

- [ ] **Step 4: Run it end to end**

Task 7 has not been written yet, so stub the renderer just enough to run:

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
cat > skills/coupling-map/scripts/coupling-map/render.mjs <<'EOF'
export function renderHtml(report) {
  return '<title>stub</title><pre>' + report.totals.files + ' files</pre>'
}
EOF
cp -r skills/coupling-map/scripts/arch-report.mjs skills/coupling-map/scripts/coupling-map /c/angular/drcall/pabx/scripts/
cd /c/angular/drcall/pabx
node scripts/arch-report.mjs
```

Expected: file and edge counts printed, coverage above 85%, and
`architecture-report/architecture.json` written.

- [ ] **Step 5: Verify the acceptance criteria that this task owns**

```bash
cd /c/angular/drcall/pabx
node scripts/arch-report.mjs && cp architecture-report/architecture.json /tmp/run1.json
node scripts/arch-report.mjs && cp architecture-report/architecture.json /tmp/run2.json
diff -q /tmp/run1.json /tmp/run2.json && echo "IDEMPOTENT"

node -e "
const r = require('./architecture-report/architecture.json')
const sum = k => r.files.reduce((a, f) => a + f[k], 0)
console.log('sum caStar', sum('caStar'), 'sum ceStar', sum('ceStar'))
console.log('INVARIANT', sum('caStar') === sum('ceStar') ? 'OK' : 'BROKEN')
const pain = r.detectors.pain
console.log('authorization in pain:', pain.some(p => p.includes('authorization.middleware')))
console.log('toast in pain:', pain.some(p => p.includes('toast.service')))
"
```

Expected: `IDEMPOTENT`, `INVARIANT OK`, `authorization in pain: true`, `toast in pain: false`.
Those three lines are acceptance criteria 8, 2 and 5 from the design doc.

- [ ] **Step 6: Write the two reference documents**

`references/config-schema.md` documents every field of `arch.config.json`, field by field, with
the PABX file as a worked example and a paragraph on how to derive `domainFrom`/`layerFrom` for
a project that names things differently.

`references/report-contract.md` documents `architecture.json` exactly as consumed by the HTML
and by the skill on later runs, including the rule that no timestamp is ever written and why.

- [ ] **Step 7: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/arch-report.mjs skills/coupling-map/scripts/coupling-map/collect.mjs skills/coupling-map/references/
git commit -m "Feat: collect the graph from madge and refuse to report on a broken one

The collector aborts when coverage falls below its floor, and that check is
the most important line in the file. The frontend mixes 2103 relative imports
with 1282 that resolve through baseUrl, so a mis-passed tsConfig silently drops
around 38% of its edges - and the report still renders, still looks plausible,
and understates exactly the numbers it exists to surface. Failing loudly beats
being quietly wrong.

madge is called once, for obj(). Cycles and orphans are derived from our own
components pass rather than from circular() and orphans(), so the graph has a
single source of truth and two API surfaces disappear.

Nothing timestamped is written. meta records the commit instead, because two
runs over an unchanged tree have to be byte-identical or comparing a report
before and after a refactoring shows diff noise where the change should be.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The report — static rendering

**Files:**
- Create: `skills/coupling-map/scripts/coupling-map/render.mjs` (replacing the Task 6 stub)
- Test: `skills/coupling-map/scripts/test/render.test.mjs`

**Interfaces:**
- Consumes: the `report` object from Task 6.
- Produces: `renderHtml(report) -> string`. The emitted page defines a client-side
  `draw(nodes)` taking the node set to render, which Task 8 drives. Node-side, this function
  only serialises data and emits markup.

- [ ] **Step 1: Write the failing test**

```javascript
// skills/coupling-map/scripts/test/render.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderHtml } from '../coupling-map/render.mjs'

const REPORT = {
  meta: { scriptVersion: '1.0.0', generatedFrom: 'abc123', cuts: { painCaStar: 20, painLoc: 400 } },
  totals: { files: 2, edges: 1, declared: 1, coveragePct: 100, unclassified: 0 },
  files: [
    { path: 'a.ts', app: 'frontend', domain: 'alpha', layer: 'component', loc: 100, ce: 1, ca: 0, ceStar: 1, caStar: 0, i: 1, dependsOn: ['b.ts'], dependedOnBy: [], detectors: [] },
    { path: 'b.ts', app: 'frontend', domain: 'beta', layer: 'service', loc: 500, ce: 0, ca: 1, ceStar: 0, caStar: 1, i: 0, dependsOn: [], dependedOnBy: ['a.ts'], detectors: ['pain'] },
  ],
  domains: [
    { domain: 'alpha', apps: ['frontend'], files: 1, loc: 100, ce: 1, ca: 0, caStar: 0, ceStar: 1 },
    { domain: 'beta', apps: ['frontend'], files: 1, loc: 500, ce: 0, ca: 1, caStar: 1, ceStar: 0 },
  ],
  detectors: { pain: ['b.ts'], amplifier: [], leafAsDependency: [], directionViolations: [], cycles: [], orphans: [] },
}

test('the page makes no external request whatsoever', () => {
  const html = renderHtml(REPORT)
  // A CSP-safe standalone file: nothing may be fetched from anywhere.
  assert.equal(/(src|href)\s*=\s*["']https?:/i.test(html), false)
  assert.equal(/url\(\s*["']?https?:/i.test(html), false)
  assert.equal(/@import\s+url\(/i.test(html), false)
  assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket/.test(html), false)
})

test('the data is embedded, not linked', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /a\.ts/)
  assert.match(html, /b\.ts/)
  assert.equal(html.includes('architecture.json"'), false)
})

test('dark is the default theme, light is the alternative', () => {
  const html = renderHtml(REPORT)
  const darkAt = html.indexOf('prefers-color-scheme: light')
  assert.notEqual(darkAt, -1)
  assert.match(html, /:root\s*\{[^}]*--bg/)
})

test('the page exposes draw(nodes), never a draw-everything entry point', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /function draw\s*\(\s*nodes\s*\)/)
})

test('the table opens on the refactoring queue: caStar down, ceStar up', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /caStar/)
  assert.match(html, /ceStar/)
})

test('embedded JSON survives a path containing a closing script tag', () => {
  const hostile = structuredClone(REPORT)
  hostile.files[0].path = 'a</script><script>alert(1)</script>.ts'
  const html = renderHtml(hostile)
  assert.equal(html.includes('</script><script>alert(1)'), false)
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/render.test.mjs"
```

Expected: FAIL — the stub returns `<title>stub</title>` and satisfies none of these.

- [ ] **Step 3: Write the renderer**

One thing Task 4 surfaced that lands here: `i` is `null` for orphans and `0` for genuinely
stable files, and both are falsy. `sorted()` compares with `b[key] - a[key]`, and `null - 0` is
`0`, so sorting the table by the `i` column ties orphans with the most stable files in the
repository. Sort `i` with nulls forced last rather than letting the subtraction decide, and
never write `if (!row.i)` anywhere in the emitted script.

The escaping in `embed` is what the last test drives: a file path is attacker-controlled only
in the sense that it comes from disk, but `</script>` inside a JSON blob ends the block and
turns the rest of the data into markup.

```javascript
// skills/coupling-map/scripts/coupling-map/render.mjs
function embed(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

const STYLE = `
:root {
  --bg: #14161a; --panel: #1c1f25; --ink: #e6e8ec; --muted: #9aa1ac;
  --line: #2c313a; --accent: #7aa2f7; --pain: #e06c75; --warn: #e5c07b; --ok: #98c379;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #fbfaf7; --panel: #ffffff; --ink: #1c1f25; --muted: #5c6370;
    --line: #e3e0d8; --accent: #3b62b0; --pain: #b8433c; --warn: #a5761b; --ok: #4a7c3f;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
.wrap { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 16px; padding: 16px; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
select, button { background: var(--panel); color: var(--ink);
  border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; font: inherit; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { text-align: right; cursor: pointer; color: var(--muted); font-weight: 600;
  border-bottom: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { padding: 4px 8px; border-bottom: 1px solid var(--line); }
tr.pain td:first-child { color: var(--pain); }
.tablewrap { overflow-x: auto; }
circle { cursor: pointer; }
.axis { stroke: var(--line); }
.axis-label { fill: var(--muted); font-size: 11px; }
`

export function renderHtml(report) {
  return `<title>Coupling Map</title>
<style>${STYLE}</style>
<div class="wrap">
  <div>
    <div class="panel">
      <div class="controls">
        <select id="unit"><option value="domain">Por dominio</option><option value="file">Por arquivo</option></select>
        <select id="topn">
          <option value="10">Top 10</option>
          <option value="20" selected>Top 20</option>
          <option value="30">Top 30</option>
          <option value="50">Top 50</option>
          <option value="0">Todos</option>
        </select>
        <span id="summary"></span>
      </div>
      <svg id="chart" viewBox="0 0 720 460" width="100%"></svg>
    </div>
    <div class="panel tablewrap" style="margin-top:16px">
      <table id="table"><thead></thead><tbody></tbody></table>
    </div>
  </div>
  <div class="panel">
    <h3>Como ler</h3>
    <p>Eixo X: <b>Ca*</b>, quantos modulos quebram se este quebrar. Eixo Y: <b>LOC</b>.
    Tamanho do ponto: <b>Ce</b>.</p>
    <p>Canto superior direito e a fila de refatoracao. Canto inferior direito e fundacao
    saudavel: muito dependida e pequena. Nao tocar.</p>
    <h3>As metricas</h3>
    <p><b>Ca*</b> beneficio de refatorar. <b>Ce*</b> dificuldade: quantos modulos podem
    quebrar este enquanto se mexe nele.</p>
    <div id="card"></div>
  </div>
</div>
<script>
const REPORT = ${embed(report)};
let sortKey = 'caStar';
let sortDir = -1;

function rows() {
  return document.getElementById('unit').value === 'domain'
    ? REPORT.domains.map(d => ({ ...d, path: d.domain, detectors: [] }))
    : REPORT.files;
}

function sorted() {
  const key = sortKey;
  const copy = rows().slice();
  copy.sort((a, b) => {
    const primary = (b[key] - a[key]) * (sortDir === -1 ? 1 : -1);
    if (primary !== 0) return primary;
    return (a.ceStar - b.ceStar) || a.path.localeCompare(b.path);
  });
  return copy;
}

function visible() {
  const n = Number(document.getElementById('topn').value);
  const all = sorted();
  return n === 0 ? all : all.slice(0, n);
}

function scale(value, max, size) {
  return (Math.log10(value + 1) / Math.log10(max + 1)) * size;
}

function draw(nodes) {
  const svg = document.getElementById('chart');
  const maxX = Math.max(1, ...rows().map(r => r.caStar));
  const maxY = Math.max(1, ...rows().map(r => r.loc));
  const parts = [
    '<line class="axis" x1="60" y1="410" x2="700" y2="410"/>',
    '<line class="axis" x1="60" y1="20" x2="60" y2="410"/>',
    '<text class="axis-label" x="380" y="440">Ca* - raio de explosao</text>',
    '<text class="axis-label" x="8" y="215">LOC</text>',
  ];
  for (const node of nodes) {
    const cx = 60 + scale(node.caStar, maxX, 630);
    const cy = 410 - scale(node.loc, maxY, 380);
    const r = 3 + Math.min(9, Math.log2(node.ce + 1) * 2);
    const fill = node.detectors.includes('pain') ? 'var(--pain)'
      : node.detectors.length > 0 ? 'var(--warn)' : 'var(--accent)';
    parts.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r +
      '" fill="' + fill + '" fill-opacity="0.75" data-path="' + node.path + '"><title>' +
      node.path + '</title></circle>');
  }
  svg.innerHTML = parts.join('');
  document.getElementById('summary').textContent =
    nodes.length + ' de ' + rows().length + ' - ordenado por ' + sortKey;
}

const COLUMNS = ['path', 'domain', 'layer', 'loc', 'ce', 'ca', 'caStar', 'ceStar', 'i'];

function table(nodes) {
  const head = document.querySelector('#table thead');
  head.innerHTML = '<tr>' + COLUMNS.map(c =>
    '<th data-key="' + c + '">' + c + (c === sortKey ? ' *' : '') + '</th>').join('') + '</tr>';
  const body = document.querySelector('#table tbody');
  body.innerHTML = nodes.map(n =>
    '<tr class="' + (n.detectors.includes('pain') ? 'pain' : '') + '">' +
    COLUMNS.map(c => {
      const v = n[c];
      return '<td>' + (v === null || v === undefined ? '' :
        typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v) + '</td>';
    }).join('') + '</tr>').join('');
  for (const th of head.querySelectorAll('th')) {
    th.onclick = () => {
      const key = th.dataset.key;
      sortDir = key === sortKey ? -sortDir : -1;
      sortKey = key;
      refresh();
    };
  }
}

function refresh() {
  const nodes = visible();
  draw(nodes);
  table(nodes);
}

document.getElementById('unit').onchange = refresh;
document.getElementById('topn').onchange = refresh;
refresh();
</script>`
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/render.test.mjs"
```

Expected: `# pass 6`, `# fail 0`.

- [ ] **Step 5: Look at it against real data**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
cp skills/coupling-map/scripts/coupling-map/render.mjs /c/angular/drcall/pabx/scripts/coupling-map/
cd /c/angular/drcall/pabx
node scripts/arch-report.mjs
start architecture-report/index.html
```

Check by eye, in the dark theme first: the axes are labelled, points are spread rather than
piled at one corner, the pain-zone points are visibly distinct, and the table opens sorted by
`caStar` descending. Then switch the OS theme to light and confirm the page is still legible.

- [ ] **Step 6: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/render.mjs skills/coupling-map/scripts/test/render.test.mjs
git commit -m "Feat: a standalone report that draws a node set, not everything

draw() takes the nodes it should render rather than reading the full dataset
itself. Every filter that follows - top N, unit toggle, focus mode - is then a
different call to one function instead of a special case bolted onto a
draw-everything path, and retrofitting that later would have been rework.

The suite asserts the page makes no external request: no remote src or href, no
@import, no fetch, no socket. That is a hard requirement, not a preference, and
an assertion catches a regression that eyeballing the file will not.

Dark is the base palette and light is the media-query override, which is the
project's accessibility rule rather than a matter of taste. The chart is
hand-written SVG because embedding a chart library in a file that must carry no
external request would inflate it for no gain at twenty points on screen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: The report — interaction

**Files:**
- Modify: `skills/coupling-map/scripts/coupling-map/render.mjs`
- Modify: `skills/coupling-map/scripts/test/render.test.mjs`

**Interfaces:**
- Consumes: `draw(nodes)` and `refresh()` from Task 7.
- Produces: client-side `neighbourhood(path, depth)` returning the set of paths within `depth`
  hops in either direction, with `depth === Infinity` meaning the full blast radius. Used by
  hover highlighting and by the card's focus control.

- [ ] **Step 1: Add the failing tests**

```javascript
// appended to skills/coupling-map/scripts/test/render.test.mjs
test('hover reveals neighbours even when the top-N filter hid them', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /function neighbourhood\s*\(\s*path\s*,\s*depth\s*\)/)
  assert.match(html, /ghost/)
})

test('the card offers depth 1, 2 and full', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /data-depth="1"/)
  assert.match(html, /data-depth="2"/)
  assert.match(html, /data-depth="Infinity"/)
})

test('edges are drawn solid outbound and dashed inbound', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /stroke-dasharray/)
})
```

- [ ] **Step 2: Run and confirm the three new tests fail**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/render.test.mjs"
```

Expected: `# pass 6`, `# fail 3`.

- [ ] **Step 3: Add the interaction to the emitted script**

Insert before `refresh()` in the emitted `<script>`, and extend `draw` to accept a highlight
set. The key rule: `neighbourhood` is computed over the full dataset, never over the visible
subset, so filtering never hides the truth on hover.

```javascript
const OUT = new Map(REPORT.files.map(f => [f.path, f.dependsOn]));
const IN = new Map(REPORT.files.map(f => [f.path, f.dependedOnBy]));

function neighbourhood(path, depth) {
  const out = new Set();
  const inn = new Set();
  let frontier = [path];
  let level = 0;
  while (frontier.length > 0 && level < depth) {
    const next = [];
    for (const node of frontier) {
      for (const target of OUT.get(node) || []) if (!out.has(target)) { out.add(target); next.push(target); }
    }
    frontier = next;
    level += 1;
  }
  frontier = [path];
  level = 0;
  while (frontier.length > 0 && level < depth) {
    const next = [];
    for (const node of frontier) {
      for (const source of IN.get(node) || []) if (!inn.has(source)) { inn.add(source); next.push(source); }
    }
    frontier = next;
    level += 1;
  }
  return { out, inn };
}

let focus = null;
let focusDepth = 1;

function card(path) {
  const row = REPORT.files.find(f => f.path === path);
  if (!row) return '';
  return '<h3>' + row.path + '</h3>' +
    '<p>Ca* ' + row.caStar + ' - Ce* ' + row.ceStar + ' - LOC ' + row.loc +
    ' - Ce ' + row.ce + ' - Ca ' + row.ca + '</p>' +
    '<p>' + (row.detectors.length ? row.detectors.join(', ') : 'nenhum detector') + '</p>' +
    '<p>Profundidade: ' +
    '<button data-depth="1">1</button> ' +
    '<button data-depth="2">2</button> ' +
    '<button data-depth="Infinity">tudo</button></p>' +
    '<p><b>depende de:</b> ' + (row.dependsOn.join(', ') || '-') + '</p>' +
    '<p><b>dependem dele:</b> ' + (row.dependedOnBy.join(', ') || '-') + '</p>';
}

function highlight(path, depth) {
  const { out, inn } = neighbourhood(path, depth);
  const shown = new Set(visible().map(n => n.path));
  const svg = document.getElementById('chart');
  const maxX = Math.max(1, ...rows().map(r => r.caStar));
  const maxY = Math.max(1, ...rows().map(r => r.loc));
  const at = p => {
    const row = REPORT.files.find(f => f.path === p);
    if (!row) return null;
    return [60 + scale(row.caStar, maxX, 630), 410 - scale(row.loc, maxY, 380)];
  };
  const origin = at(path);
  if (!origin) return;
  const parts = [];
  for (const target of out) {
    const point = at(target);
    if (!point) continue;
    parts.push('<line x1="' + origin[0] + '" y1="' + origin[1] + '" x2="' + point[0] +
      '" y2="' + point[1] + '" stroke="var(--pain)" stroke-width="1" stroke-opacity="' +
      (shown.has(target) ? '0.9' : '0.35') + '" class="ghost"/>');
  }
  for (const source of inn) {
    const point = at(source);
    if (!point) continue;
    parts.push('<line x1="' + point[0] + '" y1="' + point[1] + '" x2="' + origin[0] +
      '" y2="' + origin[1] + '" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="' +
      (shown.has(source) ? '0.9' : '0.35') + '" class="ghost"/>');
  }
  svg.insertAdjacentHTML('afterbegin', parts.join(''));
}

function bindChart() {
  for (const circle of document.querySelectorAll('#chart circle')) {
    circle.onmouseenter = () => highlight(circle.dataset.path, focus ? focusDepth : 1);
    circle.onmouseleave = () => { for (const g of document.querySelectorAll('.ghost')) g.remove(); };
    circle.onclick = () => {
      focus = circle.dataset.path;
      document.getElementById('card').innerHTML = card(focus);
      for (const b of document.querySelectorAll('#card button')) {
        b.onclick = () => {
          focusDepth = b.dataset.depth === 'Infinity' ? Infinity : Number(b.dataset.depth);
          for (const g of document.querySelectorAll('.ghost')) g.remove();
          highlight(focus, focusDepth);
        };
      }
      highlight(focus, focusDepth);
    };
  }
}
```

Call `bindChart()` at the end of `refresh()`, after `draw` and `table`.

- [ ] **Step 4: Run the tests**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/*.test.mjs"
```

Expected: 57 passing, 0 failing.

- [ ] **Step 5: Verify in the browser, dark theme first**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
cp skills/coupling-map/scripts/coupling-map/render.mjs /c/angular/drcall/pabx/scripts/coupling-map/
cd /c/angular/drcall/pabx
node scripts/arch-report.mjs
start architecture-report/index.html
```

Confirm, in order: switch to `Por arquivo` and `Top 20`; hover the leftmost pain-zone point and
see solid outbound and dashed inbound lines; click it and read the card; press `tudo` and watch
the full blast radius light up; set Top N to 10 and hover again, confirming that neighbours
outside the ten still appear, faded. Then check the light theme and leave the screen on dark.

- [ ] **Step 6: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/scripts/coupling-map/render.mjs skills/coupling-map/scripts/test/render.test.mjs
git commit -m "Feat: hover shows the truth even when the filter is hiding most of it

neighbourhood() is computed over the whole dataset and never over the visible
subset. Drawing only the edges between visible nodes would produce almost no
edges at all - the top twenty rarely depend on each other - so the filter would
silently kill the feature exactly when it is most needed. Neighbours outside
the filter are drawn faded instead.

Focus and blast radius turned out to be one feature with a depth parameter, not
two. Depth 1 is what breaks immediately, depth Infinity is the whole radius, and
the card exposes both plus depth 2 without any separate code path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: The skill itself

**Files:**
- Create: `skills/coupling-map/SKILL.md`

**Interfaces:**
- Consumes: everything built in Tasks 2 through 8.
- Produces: the operating instructions an agent follows. No code.

- [ ] **Step 1: Write `SKILL.md`**

Frontmatter `name: coupling-map` and a `description` that states plainly what it does and when
it applies, since that line is what an agent reads to decide whether the skill is relevant.

Body in English, matching the structure the other skills in this repository use, covering:

- **INPUT** — optional path scope; nothing else required.
- **OUTPUT** — `architecture-report/index.html` and `architecture-report/architecture.json`,
  plus a short prose reading of what changed since the previous run.
- **PHASE 1 — Preflight.** Three checks in order: is `madge` resolvable from the project root;
  does `scripts/arch-report.mjs` exist; does `arch.config.json` exist and parse. All three
  present means skip straight to Phase 3.
- **PHASE 2 — First run only.** Ask permission before installing anything. Then
  `npm install --save-dev madge` at the repository **root** (never inside `apps/frontend`,
  where a pre-existing jest30/build-angular conflict forces `--legacy-peer-deps`), copy
  `scripts/arch-report.mjs` and `scripts/coupling-map/` from this skill's folder into the
  project, and generate `arch.config.json` by inspecting the tree — which apps exist, where
  each `tsconfig.json` lives, whether the domain is the folder or the basename, which folder
  or suffix names the layer. Load `references/config-schema.md` for the field reference.
  State explicitly that Graphviz is not needed.
- **PHASE 3 — Every run.** Execute `node scripts/arch-report.mjs`. **Do not read the source
  tree.** Read only `architecture-report/architecture.json`, and report from it: the pain-zone
  list, what moved since the previous run if a previous file is present, and the counts.
- **RULES**, each with its reason:
  - Never regenerate the script. It is versioned in this skill; a per-project copy that drifts
    cannot be fixed centrally.
  - Never read the codebase in Phase 3. Reading 1834 files to produce numbers the script
    already computed is the cost this skill exists to avoid.
  - If the script aborts on coverage, do not lower the floor. Fix the resolution.
  - Cuts are absolute and frozen in `arch.config.json`. Never make them percentiles: a
    percentile cut cannot improve, so it would break the before-and-after comparison the tool
    exists for.
  - High `Ca` alone is not a defect. Say so when reporting, or someone will refactor the
    foundation.
- **Edge cases** — a project with one app; a project with no `tsconfig.json`; a monorepo where
  frontend and backend genuinely do import each other; a first run on a tree with zero cycles.

- [ ] **Step 2: Verify the skill loads and the frontmatter parses**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
head -5 skills/coupling-map/SKILL.md
node -e "
const t = require('fs').readFileSync('skills/coupling-map/SKILL.md','utf8')
const m = t.match(/^---\n([\s\S]*?)\n---/)
if (!m) { console.error('NO FRONTMATTER'); process.exit(1) }
console.log('name:', /name:\s*(.+)/.exec(m[1])[1])
console.log('description length:', /description:\s*(.+)/.exec(m[1])[1].length)
"
```

Expected: `name: coupling-map` and a description length comparable to the other skills — check
against `skills/qa-preflight/SKILL.md`, whose description runs a little over 400 characters.

- [ ] **Step 3: Dry-run the preflight logic by hand**

```bash
cd /c/angular/drcall/pabx
node -e "try { console.log('madge', require.resolve('madge') ? 'resolvable' : '') } catch { console.log('madge MISSING') }"
test -f scripts/arch-report.mjs && echo "script present" || echo "script MISSING"
test -f arch.config.json && node -e "JSON.parse(require('fs').readFileSync('arch.config.json','utf8')); console.log('config parses')" || echo "config MISSING"
```

All three present is the "skip to Phase 3" path described in the skill; confirm the commands in
`SKILL.md` match what actually works here.

- [ ] **Step 4: Commit**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add skills/coupling-map/SKILL.md
git commit -m "Feat: the coupling-map skill, which stops reading the codebase after the first run

The point of the split is cost. On the first run the model inspects the tree
once to write a thirty-line arch.config.json; on every run after that it reads
one file - architecture.json - and never touches the 1834 source files again,
because the script already computed everything the answer needs.

The script is copied, never generated. A script written fresh per project would
produce as many divergent variants as there are projects, none reviewed, none
fixable centrally, and it would sit outside the repository the team actually
receives skills from.

madge is installed at the repository root rather than in apps/frontend, where a
pre-existing jest30 and build-angular conflict makes any install demand
--legacy-peer-deps. Graphviz is called out as unnecessary because it is only
needed for madge --image, which this never uses, and it is the dependency most
likely to fail to install on Windows.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Wire it into the repository and open the PR

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished skill.
- Produces: a merged PR; nothing depends on this task.

- [ ] **Step 1: Add the skill to the README inventory**

Insert into the tree listing in `README.md`, keeping the existing alignment:

```
│   ├── coupling-map/            # which files to refactor first: blast radius x size
```

- [ ] **Step 2: Run the full suite one last time**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
node --test "skills/**/test/*.test.mjs"
```

Expected: 57 passing, 0 failing.

- [ ] **Step 3: Confirm the target project is left clean**

The PABX branch is disposable and must never carry a commit from this work.

```bash
cd /c/angular/drcall/pabx
rm -rf architecture-report scripts/arch-report.mjs scripts/coupling-map arch.config.json
git status --short
```

Expected: empty output. `madge` was installed with `--no-save`, so `package.json` is untouched;
leave `node_modules` alone.

- [ ] **Step 4: Commit and push**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
git add README.md
git commit -m "Docs: list coupling-map in the skill inventory

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin feat/coupling-map-skill
```

- [ ] **Step 5: Open the PR**

```bash
cd /c/angular/prompts/ia-prompts/sdd-skills
gh pr create --base main --title "Feat: coupling-map, a skill that ranks what to refactor first" --body "$(cat <<'BODY'
Adds `coupling-map`: a skill plus a versioned Node script that produces a standalone HTML
report ranking files by blast radius against size, so the refactoring queue is derived rather
than guessed.

## Where to look

`docs/Skill_Coupling_Map.md` is the argument. Section 2 lists what was tried against a real
codebase and rejected — abstractness, distance from the main sequence, LCOM, a weighted God
Class score — with the measurement behind each rejection. Section 9 holds those measurements.

`skills/coupling-map/scripts/coupling-map/graph.mjs` is the part most worth reviewing: the
transitive blast radius over a graph that has cycles in it.

## Where not to worry

**The first non-markdown files in this repository.** All 17 existing skills are markdown only.
The script ships as real files on purpose: the whole design turns on it being reviewed and
tested rather than regenerated per project, and a code block inside prose is neither.

**No `package.json`, and none needed.** The tested logic has zero dependencies — `node:test`
and `node:assert` only. `madge` is a dependency of the *target* project, installed there by the
skill, never here.

**Tests run with a quoted glob:** `node --test "skills/**/test/*.test.mjs"`. The directory form
`node --test <dir>` fails on Windows, and an unquoted glob would not expand in PowerShell.

## For the reviewer bot

- `render.mjs` builds HTML by string concatenation. That is deliberate: the output must be a
  single file making no external request, so there is no template engine to reach for. The
  embedded JSON is escaped against `</script>`, and a test drives that case.
- `detect.mjs` mutates the `detectors` array on each row it is given. The caller owns those
  rows and reads the field immediately after; the alternative was a parallel map keyed by path,
  which is the same coupling with an extra lookup.
- Tarjan is iterative rather than recursive on purpose — a 5000-node cycle is in the tests, and
  the recursive form overflows.
- The thresholds in `arch.config.json` are absolute rather than percentile. A percentile
  threshold cannot improve, which would defeat the before-and-after comparison.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-Review

**Spec coverage.** Section 1 objective → Task 6 CLI output and Task 7 chart. Section 3 scope →
Task 6 config. Section 4 metrics → Tasks 3 and 4. Section 4.1 `Ca*`/`Ce*` → Task 3. Section 4.2
queue ordering → Task 7 `sorted()`. Section 5 taxonomy → Task 2, including the `(sem dominio)`
bucket surfaced in Task 6's `totals.unclassified`. Section 6 layer order → Task 5
`directionViolations`. Section 7 detectors → Task 5, all six. Section 7.1 cuts → Task 1
calibration, frozen in Task 6's config. Section 8.1 JSON contract → Task 6 `report` object and
its reference doc. Section 8.2 chart → Task 7. Section 8.3 interaction → Tasks 7 and 8. Section
8.4 constraints → the `draw(nodes)` test in Task 7, the no-external-request test in Task 7, the
dark-default test in Task 7. Section 10 skill architecture → Task 9. Section 11 probe → Task 1.
Section 12 acceptance criteria: 1 → Task 6 Step 2 abort; 2 → Task 3 invariant test and Task 6
Step 5; 3 → Task 2 and Task 6 `unclassified`; 4 → Task 7 no-external-request test; 5 → Task 6
Step 5 and Task 5 tests; 6 → Task 8; 7 → Task 7 dark-default test; 8 → Task 6 Step 5 idempotence
check; 9 → Task 9 Phase 1.

**One deliberate gap.** The interactive behaviour of the HTML is asserted structurally from
Node, not driven in a browser. Tasks 7 and 8 each carry a manual verification step with an
explicit checklist instead. A Playwright pass would close it and is a reasonable follow-up, but
it would pull a dependency into a repository that otherwise has none.

**Type consistency.** `classify(relPath, appConfig)` returns `{ app, domain, layer }` in Task 2
and is consumed under those names in Tasks 4 and 6. `transitiveCounts` returns a `Map` in Task 3
and is read with `.get()` in Task 4. `FileRow` field names — `ce`, `ca`, `ceStar`, `caStar`,
`loc`, `i`, `dependsOn`, `dependedOnBy`, `detectors` — are identical across Tasks 4, 5, 7 and 8.
`detect` returns `leafAsDependency` in Task 5 and the PR body and SKILL.md use the same name.
`draw(nodes)` in Task 7 keeps its signature in Task 8.
