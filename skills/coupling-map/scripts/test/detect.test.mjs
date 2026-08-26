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

// The real arch.config.json declares both apps. Cross-app edges only become
// testable with more than one app in the config, so this mirrors it exactly.
const BOTH_APPS = {
  ...CONFIG,
  apps: [
    { name: 'frontend', layerOrder: ['component', 'service', 'model'] },
    { name: 'backend', layerOrder: ['routes', 'controllers', 'models'] },
  ],
}

// ce and ca are given explicitly on every row that has edges in its adj. The
// orphan detector reads the row, not the graph, so a row left at ce 0 / ca 0
// while adj says it has neighbours is a fixture that contradicts itself and
// makes every file in it an orphan.
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
    row({ path: 'm.js', layer: 'models', ce: 1, ca: 1, dependsOn: ['c.js'] }),
    row({ path: 'c.js', layer: 'controllers', ce: 1, ca: 1, dependsOn: ['m.js'] }),
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
  const files = [row({ path: 'self.js', ce: 1, ca: 1 })]
  const r = detect({ files, adj: { 'self.js': ['self.js'] }, config: CONFIG })
  assert.equal(r.cycles.length, 1)
  assert.deepEqual(r.cycles[0], ['self.js'])
})

test('cycles come from the components, orphans from having no edges at all', () => {
  const files = [
    row({ path: 'a.js', ce: 1, ca: 1 }),
    row({ path: 'b.js', ce: 1, ca: 1 }),
    row({ path: 'z.js' }),
  ]
  const r = detect({ files, adj: { 'a.js': ['b.js'], 'b.js': ['a.js'], 'z.js': [] }, config: CONFIG })
  assert.equal(r.cycles.length, 1)
  assert.deepEqual(r.cycles[0].slice().sort(), ['a.js', 'b.js'])
  assert.deepEqual(r.orphans, ['z.js'])
})

test('each file carries the list of detectors it tripped', () => {
  // Ca 96 is the measured fan-in of the real authorization.middleware.js. A file
  // with a blast radius of 93 that no one imports cannot exist, and leaving ca
  // at zero would make this row an orphan as well as a pain-zone file.
  const files = [row({ path: 'p.js', layer: 'middleware', loc: 1415, caStar: 93, ca: 96 })]
  detect({ files, adj: {}, config: CONFIG })
  assert.deepEqual(files[0].detectors, ['pain'])
})

// --- the rows belong to the caller, so mutating them has to be idempotent ---

test('detecting twice over the same rows does not duplicate what it recorded', () => {
  // detect writes into rows the caller owns. The CLI calls it once today, but
  // that is a precondition living outside this module, so the second call has
  // to produce the same row as the first rather than appending to it.
  const files = [
    row({ path: 'p.js', layer: 'middleware', loc: 1415, caStar: 93, ca: 96 }),
    row({ path: 'm.js', layer: 'models', ce: 1, dependsOn: ['c.js'] }),
    row({ path: 'c.js', layer: 'controllers', ca: 33 }),
  ]
  const adj = { 'm.js': ['c.js'], 'c.js': [] }
  const first = detect({ files, adj, config: CONFIG })
  const snapshot = files.map(f => f.detectors.slice())
  const second = detect({ files, adj, config: CONFIG })
  assert.deepEqual(files.map(f => f.detectors), snapshot)
  assert.deepEqual(second, first)
})

test('a file with two upward edges names the detector once, not once per edge', () => {
  // Two violations, one file. Measured on the real monorepo: four backend models
  // import more than one controller, and realtime-agent.model.js imports five,
  // which listed 'directionViolation' five times on a single row.
  const files = [
    row({ path: 'm.js', layer: 'models', ce: 2, dependsOn: ['c1.js', 'c2.js'] }),
    row({ path: 'c1.js', layer: 'controllers', ca: 1 }),
    row({ path: 'c2.js', layer: 'controllers', ca: 1 }),
  ]
  const r = detect({ files, adj: { 'm.js': ['c1.js', 'c2.js'], 'c1.js': [], 'c2.js': [] }, config: CONFIG })
  assert.equal(r.directionViolations.length, 2)
  assert.deepEqual(files[0].detectors, ['directionViolation'])
})

// --- ordering has to be code-unit everywhere, as Task 4 already established ---

test('cycles are ordered by code unit, so another machine produces the same bytes', () => {
  // localeCompare takes the runtime default collator - pt-BR on this machine -
  // and orders 'a' before 'B', where every other sort in this codebase orders
  // 'B' before 'a'. Two runs of the same tree must not diff on locale.
  const adj = {
    'a.js': ['a2.js'], 'a2.js': ['a.js'],
    'B.js': ['B2.js'], 'B2.js': ['B.js'],
  }
  const files = Object.keys(adj).map(path => row({ path, ce: 1, ca: 1 }))
  const r = detect({ files, adj, config: CONFIG })
  assert.deepEqual(r.cycles, [['B.js', 'B2.js'], ['a.js', 'a2.js']])
})

test('direction violations come out sorted, not in graph insertion order', () => {
  const files = [
    row({ path: 'z.js', layer: 'models', ce: 1, dependsOn: ['c.js'] }),
    row({ path: 'm.js', layer: 'models', ce: 1, dependsOn: ['c.js'] }),
    row({ path: 'c.js', layer: 'controllers', ca: 2 }),
  ]
  const r = detect({ files, adj: { 'z.js': ['c.js'], 'm.js': ['c.js'], 'c.js': [] }, config: CONFIG })
  assert.deepEqual(r.directionViolations.map(v => v.from), ['m.js', 'z.js'])
})

// --- everything the layer order cannot judge is left alone, never guessed ---

test('a layer outside layerOrder and a null layer are never violations', () => {
  // middleware, services and utils are declared layers that layerOrder does not
  // rank, and 24 real frontend files carry a null layer. Neither is a direction
  // the config has an opinion about.
  const files = [
    row({ path: 'u.js', layer: 'utils', ce: 1, ca: 1, dependsOn: ['c.js'] }),
    row({ path: 'n.js', layer: null, ce: 1, ca: 1, dependsOn: ['c.js'] }),
    row({ path: 'c.js', layer: 'controllers', ce: 2, ca: 2, dependsOn: ['u.js', 'n.js'] }),
  ]
  const adj = { 'u.js': ['c.js'], 'n.js': ['c.js'], 'c.js': ['u.js', 'n.js'] }
  const r = detect({ files, adj, config: CONFIG })
  assert.deepEqual(r.directionViolations, [])
})

test('an edge that crosses between apps is never a direction violation', () => {
  // The two apps rank different layer names, so comparing across them would be
  // comparing two different scales by their index.
  const files = [
    row({ path: 'front.model.ts', app: 'frontend', layer: 'model', ce: 1, dependsOn: ['back.controller.js'] }),
    row({ path: 'back.controller.js', app: 'backend', layer: 'controllers', ca: 1 }),
  ]
  const adj = { 'front.model.ts': ['back.controller.js'], 'back.controller.js': [] }
  const r = detect({ files, adj, config: BOTH_APPS })
  assert.deepEqual(r.directionViolations, [])
})

test('an edge inside one layer is not a violation', () => {
  const files = [
    row({ path: 'one.model.js', layer: 'models', ce: 1, dependsOn: ['two.model.js'] }),
    row({ path: 'two.model.js', layer: 'models', ca: 1 }),
  ]
  const adj = { 'one.model.js': ['two.model.js'], 'two.model.js': [] }
  const r = detect({ files, adj, config: CONFIG })
  assert.deepEqual(r.directionViolations, [])
})

test('a node that exists only as an edge target does not break anything', () => {
  // stronglyConnected gives an unknown target its own singleton component, so
  // the cycle filter reads adj[group[0]] for a key that is not in adj at all.
  const files = [row({ path: 'a.js', ce: 1, dependsOn: ['ghost.js'] })]
  const r = detect({ files, adj: { 'a.js': ['ghost.js'] }, config: CONFIG })
  assert.deepEqual(r.cycles, [])
  assert.deepEqual(r.orphans, [])
  assert.deepEqual(files[0].detectors, [])
})
