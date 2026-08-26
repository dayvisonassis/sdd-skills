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

test('a file that depends on nothing but is depended on scores zero, not null', () => {
  // Zero and null are different positions on the scale and the guard has to be
  // ca + ce, never ce alone: with ce alone this file would read null and land
  // among the orphans instead of at the stable end. The other tests pin 0.5 and
  // null, so nothing else here would notice.
  const r = computeMetrics(INPUT)
  const stable = rowFor(r, 'c.ts')
  assert.equal(stable.ce, 0)
  assert.equal(stable.ca, 1)
  assert.equal(stable.i, 0)
  assert.equal(Object.is(stable.i, null), false)
})

test('inside a cycle, Ce* of 0 alongside Ce of 1 is the correct answer', () => {
  // a and b import each other, so a's only dependency is its own component and
  // its Ce* is genuinely 0 while its Ce is 1. That pair looks arithmetically
  // impossible from the outside and is not, so it is pinned here: a fallback
  // like (ceStar || ce) would read as a fix and would silently inflate it.
  const cyclic = {
    adj: { 'a.ts': ['b.ts'], 'b.ts': ['a.ts'], 'c.ts': ['a.ts'], 'd.ts': [] },
    loc: { 'a.ts': 10, 'b.ts': 10, 'c.ts': 10, 'd.ts': 10 },
    taxonomy: {
      'a.ts': { app: 'backend', domain: 'ring', layer: null },
      'b.ts': { app: 'backend', domain: 'ring', layer: null },
      'c.ts': { app: 'backend', domain: 'caller', layer: null },
      'd.ts': { app: 'backend', domain: 'caller', layer: null },
    },
  }
  const r = computeMetrics(cyclic)
  assert.deepEqual(r.files.map(f => f.path), ['a.ts', 'b.ts', 'c.ts', 'd.ts'])

  const a = rowFor(r, 'a.ts')
  assert.equal(a.ce, 1)
  assert.equal(a.ceStar, 0)
  assert.equal(a.ca, 2)
  assert.equal(a.caStar, 1)
  assert.equal(rowFor(r, 'c.ts').ceStar, 2)

  // Acceptance criterion 2, checked here rather than only against real output:
  // both sums count the same reachable pairs from opposite ends.
  const sum = key => r.files.reduce((total, f) => total + f[key], 0)
  assert.equal(sum('caStar'), sum('ceStar'))
})

test('a node that is only ever a target still gets a row', () => {
  // Rows used to come from Object.keys(adj), so a file that something imports
  // but which imports nothing itself had no row at all - and then sum(caStar)
  // no longer equalled sum(ceStar), breaking acceptance criterion 2 on any
  // graph the collector had not already closed.
  const r = computeMetrics({
    adj: { 'a.ts': ['b.ts'] },
    loc: { 'a.ts': 10 },
    taxonomy: { 'a.ts': { app: 'x', domain: 'alpha', layer: 'service' } },
  })
  const b = r.files.find(f => f.path === 'b.ts')
  assert.notEqual(b, undefined)
  assert.equal(b.ca, 1)
  assert.equal(b.ce, 0)
  assert.equal(b.loc, 0)
  assert.equal(b.domain, '(sem domínio)')

  const sum = k => r.files.reduce((acc, f) => acc + f[k], 0)
  assert.equal(sum('caStar'), sum('ceStar'))
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

test('domains sort by code unit, the same order the file list uses', () => {
  // localeCompare reads the machine's default collator, which puts 'alpha'
  // before 'Alpha' here and would order these two rows differently on a
  // differently-localised machine. Comparing two reports is the whole point of
  // the tool, so the ordering cannot depend on where the report was generated.
  const mixed = {
    adj: { 'x.ts': [], 'y.ts': [] },
    loc: { 'x.ts': 1, 'y.ts': 1 },
    taxonomy: {
      'x.ts': { app: 'f', domain: 'alpha', layer: null },
      'y.ts': { app: 'f', domain: 'Alpha', layer: null },
    },
  }
  const r = computeMetrics(mixed)
  assert.deepEqual(r.domains.map(d => d.domain), ['Alpha', 'alpha'])
})
