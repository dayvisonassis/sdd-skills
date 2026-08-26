import { stronglyConnected } from './graph.mjs'

function layerRank(app, layer, config) {
  const appConfig = config.apps.find(a => a.name === app)
  if (!appConfig) return -1
  return appConfig.layerOrder.indexOf(layer)
}

function byText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
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
        if (!fromRow.detectors.includes('directionViolation')) {
          fromRow.detectors.push('directionViolation')
        }
      }
    }
  }
  directionViolations.sort((a, b) => byText(a.from, b.from) || byText(a.to, b.to))

  const { members } = stronglyConnected(adj)
  const cycles = [...members.values()]
    .filter(group => group.length > 1 || (adj[group[0]] || []).includes(group[0]))
    .map(group => group.slice().sort())
    .sort((a, b) => byText(a[0], b[0]))

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
