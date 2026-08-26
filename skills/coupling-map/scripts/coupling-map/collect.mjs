import { readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import madge from 'madge'
import { classify } from './taxonomy.mjs'
import { countDeclared } from './declared.mjs'

const BACKSLASH = String.fromCharCode(92)
const NO_DOMAIN = '(sem domínio)'

function readSource(absolute) {
  try {
    return readFileSync(absolute, 'utf8')
  } catch {
    return null
  }
}

function coverageOf(edges, declared) {
  return declared === 0 ? 100 : (100 * edges) / declared
}

export async function collect(config, repoRoot) {
  const adj = {}
  const loc = {}
  const taxonomy = {}
  const apps = []
  let edges = 0
  let declared = 0
  let unreadable = 0

  for (const app of config.apps) {
    const options = {
      fileExtensions: app.extensions,
      excludeRegExp: app.exclude,
    }
    if (app.tsConfig) options.tsConfig = join(repoRoot, app.tsConfig)

    const obj = (await madge(join(repoRoot, app.root), options)).obj()
    const key = rel => normalize(app.root + '/' + rel).split(BACKSLASH).join('/')

    let appEdges = 0
    let appDeclared = 0
    let appUnreadable = 0

    for (const relPath of Object.keys(obj)) {
      const path = key(relPath)
      adj[path] = obj[relPath].map(key)
      appEdges += obj[relPath].length
      taxonomy[path] = classify(relPath, app)

      const text = readSource(join(repoRoot, path))
      if (text === null) {
        loc[path] = 0
        appUnreadable += 1
      } else {
        loc[path] = text.split('\n').length
        appDeclared += countDeclared(text, app.importPrefixes)
      }
    }

    edges += appEdges
    declared += appDeclared
    unreadable += appUnreadable
    apps.push({
      name: app.name,
      files: Object.keys(obj).length,
      edges: appEdges,
      declared: appDeclared,
      unreadable: appUnreadable,
      coveragePct: coverageOf(appEdges, appDeclared),
    })
  }

  for (const target of Object.values(adj).flat()) {
    if (target in adj) continue
    adj[target] = []
    loc[target] = 0
    taxonomy[target] = { app: null, domain: NO_DOMAIN, layer: null }
  }

  return {
    adj,
    loc,
    taxonomy,
    stats: {
      files: Object.keys(adj).length,
      edges,
      declared,
      unreadable,
      coveragePct: coverageOf(edges, declared),
      apps,
    },
  }
}
