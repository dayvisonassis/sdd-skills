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
