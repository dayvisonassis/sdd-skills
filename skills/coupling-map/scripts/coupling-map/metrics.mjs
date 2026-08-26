import { reverse, transitiveCounts } from './graph.mjs'

export function computeMetrics({ adj, loc, taxonomy }) {
  const rev = reverse(adj)
  const ceStar = transitiveCounts(adj)
  const caStar = transitiveCounts(rev)
  const paths = Object.keys(rev).sort()

  const files = paths.map(path => {
    const dependsOn = (adj[path] || []).slice().sort()
    const dependedOnBy = (rev[path] || []).slice().sort()
    const ce = dependsOn.length
    const ca = dependedOnBy.length
    const tax = taxonomy[path] || { app: null, domain: '(sem domínio)', layer: null }
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
    .sort((a, b) => (a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0))

  return { files, domains }
}
