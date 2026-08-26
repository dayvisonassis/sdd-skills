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
  for (const node of componentOf.keys()) {
    const id = componentOf.get(node)
    let total = 0
    for (const other of reach.get(id)) total += members.get(other).length
    counts.set(node, total)
  }
  return counts
}
