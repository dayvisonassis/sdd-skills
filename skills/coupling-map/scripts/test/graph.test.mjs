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

test('a target that is never a key still counts as a node', () => {
  // reverse() invents a key for an unseen target while stronglyConnected() used
  // to skip it, so the two disagreed about the node set and the sums diverged.
  // Every open graph hit this, not just unusual ones.
  const adj = { a: ['b'] }
  const ceStar = transitiveCounts(adj)
  const caStar = transitiveCounts(reverse(adj))
  assert.equal(ceStar.get('a'), 1)
  assert.equal(caStar.get('b'), 1)
  assert.equal(ceStar.get('b'), 0)

  const { componentOf } = stronglyConnected(adj)
  assert.notEqual(componentOf.get('b'), undefined)
})

test('the invariant: summing Ca* equals summing Ce*', () => {
  // Both sums count the same set of ordered reachable pairs, once from each
  // end. Any divergence is a bug in the traversal, so this holds for any graph.
  const graphs = [
    { a: ['b'], b: ['c'], c: [] },
    { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] },
    { a: ['b'], b: ['a'], c: ['a'], d: ['c'], e: [] },
    { a: [], b: [], c: [] },
    { a: ['b'], b: ['c'] }, // open: 'c' appears only as a target, never as a key
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
