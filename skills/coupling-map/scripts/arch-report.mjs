import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { collect } from './coupling-map/collect.mjs'
import { computeMetrics } from './coupling-map/metrics.mjs'
import { detect } from './coupling-map/detect.mjs'
import { renderHtml } from './coupling-map/render.mjs'

const SCRIPT_VERSION = '1.0.0'
const NO_DOMAIN = '(sem domínio)'

function arg(name, fallback) {
  const index = process.argv.indexOf('--' + name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error('Missing value for --' + name)
    process.exit(2)
  }
  return value
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
const below = [
  { name: 'total', edges: stats.edges, declared: stats.declared, coveragePct: stats.coveragePct },
  ...stats.apps,
].filter(scope => scope.coveragePct < floor)

if (below.length > 0) {
  for (const scope of below) {
    console.error(
      'Coverage ' +
        scope.name +
        ': ' +
        scope.edges +
        ' resolved edges against ' +
        scope.declared +
        ' declared imports (' +
        scope.coveragePct.toFixed(1) +
        '%), below the ' +
        floor +
        '% floor.'
    )
  }
  console.error('Every metric below this line would be understated. Check tsConfig and extensions.')
  process.exit(1)
}

const { files, domains } = computeMetrics({ adj, loc, taxonomy })
const detectors = detect({ files, adj, config })

const noDomain = files.filter(f => f.domain === NO_DOMAIN)

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
    unreadable: stats.unreadable,
    coverageByApp: stats.apps.map(app => ({
      name: app.name,
      files: app.files,
      edges: app.edges,
      declared: app.declared,
      unreadable: app.unreadable,
      coveragePct: Number(app.coveragePct.toFixed(1)),
    })),
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
for (const app of stats.apps) {
  console.log(
    '  ' +
      app.name.padEnd(13) +
      app.edges +
      ' (coverage ' +
      app.coveragePct.toFixed(1) +
      '%)'
  )
}
const sum = key => files.reduce((total, file) => total + file[key], 0)
const caStarSum = sum('caStar')
const ceStarSum = sum('ceStar')

console.log('domains        ' + domains.length)
console.log(
  'invariant      Ca* ' +
    caStarSum +
    ' / Ce* ' +
    ceStarSum +
    ' ' +
    (caStarSum === ceStarSum ? 'OK' : 'BROKEN')
)
console.log('unclassified   ' + noDomain.length)
if (stats.unreadable > 0) {
  console.error(
    'Warning: ' + stats.unreadable + ' files could not be read and were counted as 0 lines.'
  )
}
console.log('pain zone      ' + detectors.pain.length)
console.log('amplifiers     ' + detectors.amplifier.length)
console.log('controllers    ' + detectors.leafAsDependency.length)
console.log('cycles         ' + detectors.cycles.length)
console.log('orphans        ' + detectors.orphans.length)
console.log('direction      ' + detectors.directionViolations.length)
console.log('written to     ' + outDir + '/index.html')
