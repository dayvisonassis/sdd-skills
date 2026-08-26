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

// The emitted page is a browser program. Regexes over its source can only show
// that a string is present, never that the program behaves. These tests run the
// embedded script against a shim that implements exactly the DOM surface the
// script touches, so draw(), the table, the sort and the overlay are exercised
// for real.
const ENTITIES = [
  [/&quot;/g, '"'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&amp;/g, '&'],
]

// A browser hands the DECODED value back through dataset, never the escaped one
// that appears in the markup. Reproducing that is what makes the round trip from
// an escaped data-path back to the lookup key the script uses testable at all.
function decode(value) {
  let out = String(value)
  for (const [pattern, replacement] of ENTITIES) out = out.replace(pattern, replacement)
  return out
}

function parseTags(markup, tag) {
  const pattern = new RegExp('<' + tag + '\\b[^>]*>', 'g')
  return [...String(markup).matchAll(pattern)].map(match => {
    const dataset = {}
    for (const attr of match[0].matchAll(/data-([a-z]+)="([^"]*)"/g)) {
      dataset[attr[1]] = decode(attr[2])
    }
    return { tag: match[0], dataset, onclick: null, onmouseenter: null, onmouseleave: null }
  })
}

function element() {
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    hidden: false,
    onchange: null,
    dataset: {},
    // Cached against the markup it was parsed from, so a second query over
    // unchanged markup returns the SAME objects: the script binds handlers on
    // the first call and the test reads them back on the second.
    querySelectorAll(selector) {
      const key = selector + ' ' + this.innerHTML
      if (this.cachedFor !== key) {
        this.cachedFor = key
        this.cached = parseTags(this.innerHTML, selector)
      }
      return this.cached
    },
  }
}

// Reads what the rendered page itself opens on: the option marked selected, or
// the first one when none is.
function markupDefault(html, selectId) {
  const select = html.match(new RegExp('<select id="' + selectId + '">[^]*?</select>'))
  if (select === null) return undefined
  const marked = select[0].match(/<option value="([^"]*)"[^>]*selected/)
  if (marked !== null) return marked[1]
  const first = select[0].match(/<option value="([^"]*)"/)
  return first === null ? undefined : first[1]
}

function evaluate(html, options = {}) {
  const open = html.indexOf('<script>')
  const close = html.lastIndexOf('</script>')
  assert.notEqual(open, -1)
  assert.notEqual(close, -1)
  const body = html.slice(open + '<script>'.length, close)

  const nodes = new Map()
  const lookup = key => {
    if (!nodes.has(key)) nodes.set(key, element())
    return nodes.get(key)
  }
  // The defaults are READ OUT OF the markup rather than repeated here. Every
  // call below passes unit explicitly, so a hardcoded default would never be
  // exercised and could drift away from the page without a test noticing -
  // which is exactly what happened when the opening unit changed.
  lookup('unit').value = options.unit ?? markupDefault(html, 'unit')
  lookup('topn').value = options.topn ?? markupDefault(html, 'topn')

  // Writing the chart replaces its children, the overlay group among them.
  // Modelling that is the only way a test can tell a repainted overlay apart
  // from a stale one that merely survived the redraw.
  const chart = lookup('chart')
  const overlay = lookup('overlay')
  let chartMarkup = ''
  Object.defineProperty(chart, 'innerHTML', {
    get: () => chartMarkup,
    set(value) {
      chartMarkup = value
      overlay.innerHTML = ''
    },
  })

  const document = {
    getElementById: id => lookup(id),
    querySelector: selector => lookup(selector),
    querySelectorAll(selector) {
      const parts = selector.split(' ')
      const host = parts.length === 1 ? parts[0] : parts[0].replace('#', '')
      return lookup(host).querySelectorAll(parts[parts.length - 1])
    },
  }
  // typeof guards rather than a plain identifier list: before Task 8 exists,
  // naming neighbourhood directly would throw a ReferenceError inside every
  // test that uses the harness, hiding which tests the new behaviour drives.
  const api = new Function(
    'document',
    body +
      '\nreturn {\n' +
      '  draw, table, refresh, rows, sorted, visible,\n' +
      '  neighbourhood: typeof neighbourhood === "function" ? neighbourhood : undefined,\n' +
      '  card: typeof card === "function" ? card : undefined,\n' +
      '  state: () => ({\n' +
      '    focus: typeof focus === "undefined" ? undefined : focus,\n' +
      '    depth: typeof depth === "undefined" ? undefined : depth,\n' +
      '  }),\n' +
      '};'
  )(document)
  return {
    api,
    document,
    chart: () => lookup('chart').innerHTML,
    overlay: () => lookup('overlay').innerHTML,
    card: () => lookup('card').innerHTML,
    head: () => lookup('#table thead'),
    body: () => lookup('#table tbody').innerHTML,
    point: path =>
      lookup('chart')
        .querySelectorAll('circle')
        .find(node => node.dataset.path === path),
    depthButton: value =>
      lookup('card')
        .querySelectorAll('button')
        .find(node => node.dataset.depth === value),
    select: id => lookup(id),
  }
}

const circles = markup => [...markup.matchAll(/<circle\b[^>]*>/g)].map(match => match[0])

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(name + '="([^"]*)"'))
  return match === null ? null : match[1]
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

test('the queue opens on what to refactor, not on the foundation under it', () => {
  // The real pair off this monorepo. Ordering by blast radius alone puts
  // toast.service.ts first - 44 lines, depended on by everything, the file the
  // sidebar labels "fundacao saudavel: nao tocar" - and buries the 1416-line
  // middleware that is actually in the pain zone. This test failing is the
  // report telling someone to go and refactor toast.service.ts.
  const report = structuredClone(REPORT)
  report.files = [
    {
      path: 'apps/frontend/src/app/toast/toast.service.ts',
      app: 'frontend', domain: 'toast', layer: 'service',
      loc: 44, ce: 2, ca: 65, ceStar: 2, caStar: 409, i: 0.03,
      dependsOn: [], dependedOnBy: [], detectors: [],
    },
    {
      path: 'apps/backend/src/middleware/authorization.middleware.js',
      app: 'backend', domain: 'authorization', layer: 'middleware',
      loc: 1416, ce: 9, ca: 93, ceStar: 40, caStar: 100, i: 0.09,
      dependsOn: [], dependedOnBy: [], detectors: ['pain'],
    },
  ]
  const harness = evaluate(renderHtml(report), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.deepEqual(harness.api.sorted().map(row => row.path), [
    'apps/backend/src/middleware/authorization.middleware.js',
    'apps/frontend/src/app/toast/toast.service.ts',
  ])
})

test('the opening order is detected first, then caStar down and ceStar up', () => {
  const report = structuredClone(REPORT)
  const row = (path, over) => ({
    path, app: 'a', domain: 'd', layer: null, loc: 10, ce: 0, ca: 0,
    ceStar: 0, caStar: 0, i: null, dependsOn: [], dependedOnBy: [],
    detectors: [], ...over,
  })
  report.files = [
    row('healthy-huge-radius.ts', { caStar: 400 }),
    row('leaf.ts', { caStar: 5, detectors: ['leafAsDependency'] }),
    row('amp.ts', { caStar: 5, detectors: ['amplifier'] }),
    row('pain-small.ts', { caStar: 16, detectors: ['pain'] }),
    row('pain-hard.ts', { caStar: 90, ceStar: 7, detectors: ['pain'] }),
    row('pain-easy.ts', { caStar: 90, ceStar: 1, detectors: ['pain'] }),
  ]
  const harness = evaluate(renderHtml(report), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.deepEqual(harness.api.sorted().map(r => r.path), [
    'pain-easy.ts',
    'pain-hard.ts',
    'pain-small.ts',
    'amp.ts',
    'leaf.ts',
    'healthy-huge-radius.ts',
  ])
})

test('clicking a header abandons the tier and sorts on that one key', () => {
  const report = structuredClone(REPORT)
  report.files = [
    { ...REPORT.files[0], path: 'plain.ts', caStar: 400, detectors: [] },
    { ...REPORT.files[1], path: 'painful.ts', caStar: 10, detectors: ['pain'] },
  ]
  const harness = evaluate(renderHtml(report), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.deepEqual(harness.api.sorted().map(r => r.path), ['painful.ts', 'plain.ts'])
  harness.head().querySelectorAll('th').find(th => th.dataset.key === 'caStar').onclick()
  assert.deepEqual(harness.api.sorted().map(r => r.path), ['plain.ts', 'painful.ts'])
})

test('embedded JSON survives a path containing a closing script tag', () => {
  const hostile = structuredClone(REPORT)
  hostile.files[0].path = 'a</script><script>alert(1)</script>.ts'
  const html = renderHtml(hostile)
  assert.equal(html.includes('</script><script>alert(1)'), false)
})

test('a lone </script and a comment opener cannot reopen the parser', () => {
  // </script with no closing bracket still ends the script data state, and an
  // unmatched <!-- switches the tokenizer into script-data-escaped, where a
  // later </script> stops closing the element. Neither may reach the output.
  const hostile = structuredClone(REPORT)
  hostile.files[0].path = 'a</script b.ts'
  hostile.files[1].path = 'c<!--d.ts'
  const html = renderHtml(hostile)
  const open = html.indexOf('<script>')
  const scriptBody = html.slice(open, html.lastIndexOf('</script>'))
  assert.equal(/<\/script/i.test(scriptBody), false)
  assert.equal(scriptBody.includes('<!--'), false)
})

test('U+2028 and U+2029 in a path are escaped, not emitted raw', () => {
  // Both are legal inside a JSON string and JSON.stringify leaves them alone,
  // but they are line terminators to a JavaScript parser. Built from char
  // codes so that nothing on the way into this file can normalise them away.
  const LS = String.fromCharCode(0x2028)
  const PS = String.fromCharCode(0x2029)
  const hostile = structuredClone(REPORT)
  hostile.files[0].path = 'a' + LS + 'b.ts'
  hostile.files[1].path = 'c' + PS + 'd.ts'
  const html = renderHtml(hostile)
  assert.equal(html.includes(LS), false)
  assert.equal(html.includes(PS), false)
  const { api } = evaluate(html, { unit: 'file', topn: '0' })
  assert.deepEqual(
    api.rows().map(row => row.path),
    ['a' + LS + 'b.ts', 'c' + PS + 'd.ts']
  )
})

test('the embedded report parses back to exactly what was passed in', () => {
  const html = renderHtml(REPORT)
  const { api } = evaluate(html, { unit: 'file', topn: '0' })
  assert.deepEqual(api.rows(), REPORT.files)
})

test('a domain carries the detectors of the files inside it', () => {
  // The page opens on the domain unit, and a domain row has no detectors of
  // its own. Left empty, the opening view of the report is the one view in
  // which the refactoring queue it exists to show is invisible.
  const html = renderHtml(REPORT)
  const { api } = evaluate(html, { unit: 'domain', topn: '0' })
  const byName = Object.fromEntries(api.rows().map(row => [row.domain, row]))
  assert.deepEqual(byName.beta.detectors, ['pain'])
  assert.deepEqual(byName.alpha.detectors, [])
})

test('draw renders one circle per node handed to it, and no others', () => {
  const html = renderHtml(REPORT)
  const harness = evaluate(html, { unit: 'file', topn: '0' })
  harness.api.draw([REPORT.files[0]])
  assert.equal(circles(harness.chart()).length, 1)
  harness.api.draw(REPORT.files)
  assert.equal(circles(harness.chart()).length, 2)
  harness.api.draw([])
  assert.equal(circles(harness.chart()).length, 0)
})

test('every plotted point is finite and inside the viewBox', () => {
  const zeros = structuredClone(REPORT)
  // caStar 0 happens on all 24 real orphans; loc 0 on any file that could not
  // be read. log10(0) is -Infinity, so both have to be handled before scaling.
  zeros.files[0] = { ...zeros.files[0], caStar: 0, loc: 0, ce: 0 }
  zeros.files[1] = { ...zeros.files[1], caStar: 425, loc: 4403, ce: 40 }
  const harness = evaluate(renderHtml(zeros), { unit: 'file', topn: '0' })
  harness.api.draw(zeros.files)
  for (const circle of circles(harness.chart())) {
    const cx = Number(attribute(circle, 'cx'))
    const cy = Number(attribute(circle, 'cy'))
    const r = Number(attribute(circle, 'r'))
    assert.equal(Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r), true)
    assert.equal(cx - r >= 0 && cx + r <= 720, true)
    assert.equal(cy - r >= 0 && cy + r <= 460, true)
  }
})

test('a report with no files at all renders and draws without throwing', () => {
  const empty = {
    meta: { scriptVersion: '1.0.0', generatedFrom: null, cuts: {} },
    totals: { files: 0, edges: 0, declared: 0, coveragePct: 100, unclassified: 0 },
    files: [],
    domains: [],
    detectors: { pain: [], amplifier: [], leafAsDependency: [], directionViolations: [], cycles: [], orphans: [] },
  }
  // Math.max() of nothing is -Infinity, which would put every later division
  // beyond rescue; the empty case has to survive the whole refresh path. Drawing
  // no circles is not enough to prove that - the axes are drawn regardless, and
  // a poisoned maximum shows up there first.
  const harness = evaluate(renderHtml(empty), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.equal(circles(harness.chart()).length, 0)
  assert.equal(/NaN|Infinity/.test(harness.chart()), false)
})

test('no two axis labels are printed on top of each other', () => {
  // A log axis is unreadable without ticks, and the tick nearest the maximum
  // is the one that collides with it: the real report has a domain of 10732
  // lines, which put "10000" and "10732" in the same few pixels.
  const crowded = structuredClone(REPORT)
  crowded.files = [
    { ...REPORT.files[0], caStar: 425, loc: 10732 },
    { ...REPORT.files[1], caStar: 1, loc: 1 },
  ]
  const harness = evaluate(renderHtml(crowded), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const labels = [...harness.chart().matchAll(/<text class="tick" x="([\d.]+)" y="([\d.]+)"/g)]
  const horizontal = labels.filter(label => label[2] === '425').map(label => Number(label[1]))
  const vertical = labels.filter(label => label[2] !== '425').map(label => Number(label[2]))
  assert.equal(horizontal.length > 2, true)
  assert.equal(vertical.length > 2, true)
  const closest = values => {
    const sortedValues = values.slice().sort((a, b) => a - b)
    let gap = Infinity
    for (let index = 1; index < sortedValues.length; index++) {
      gap = Math.min(gap, sortedValues[index] - sortedValues[index - 1])
    }
    return gap
  }
  assert.equal(closest(horizontal) >= 22, true)
  assert.equal(closest(vertical) >= 12, true)
})

test('a report where every value is zero still yields a usable axis', () => {
  // A tree of nothing but orphans has caStar 0 everywhere, and an unreadable
  // file has loc 0. A maximum taken straight off the data is then 0, and
  // log10(max + 1) is 0 - the divisor of every coordinate on the chart.
  const zeroed = structuredClone(REPORT)
  zeroed.files = zeroed.files.map(file => ({ ...file, caStar: 0, loc: 0, ce: 0, ca: 0, i: null }))
  const harness = evaluate(renderHtml(zeroed), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.equal(/NaN|Infinity/.test(harness.chart()), false)
  for (const circle of circles(harness.chart())) {
    assert.equal(Number.isFinite(Number(attribute(circle, 'cx'))), true)
    assert.equal(Number.isFinite(Number(attribute(circle, 'cy'))), true)
  }
})

test('a single-file report puts its one point on the canvas', () => {
  const single = structuredClone(REPORT)
  single.files = [single.files[1]]
  single.domains = [single.domains[1]]
  const harness = evaluate(renderHtml(single), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const drawn = circles(harness.chart())
  assert.equal(drawn.length, 1)
  assert.equal(Number.isFinite(Number(attribute(drawn[0], 'cx'))), true)
  assert.equal(Number.isFinite(Number(attribute(drawn[0], 'cy'))), true)
})

test('sorting by instability forces nulls last, never tied with zero', () => {
  // i is null for an orphan and 0 for a genuinely stable file, and both are
  // falsy. b[key] - a[key] makes null - 0 come to 0, which ties the two.
  const report = structuredClone(REPORT)
  report.files = [
    { path: 'orphan.ts', app: 'a', domain: 'd', layer: null, loc: 10, ce: 0, ca: 0, ceStar: 0, caStar: 0, i: null, dependsOn: [], dependedOnBy: [], detectors: ['orphan'] },
    { path: 'stable.ts', app: 'a', domain: 'd', layer: null, loc: 10, ce: 0, ca: 9, ceStar: 5, caStar: 9, i: 0, dependsOn: [], dependedOnBy: [], detectors: [] },
    { path: 'mixed.ts', app: 'a', domain: 'd', layer: null, loc: 10, ce: 1, ca: 1, ceStar: 1, caStar: 1, i: 0.5, dependsOn: [], dependedOnBy: [], detectors: [] },
    { path: 'volatile.ts', app: 'a', domain: 'd', layer: null, loc: 10, ce: 1, ca: 0, ceStar: 1, caStar: 0, i: 1, dependsOn: [], dependedOnBy: [], detectors: [] },
  ]
  const harness = evaluate(renderHtml(report), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const header = harness.head().querySelectorAll('th').find(th => th.dataset.key === 'i')
  header.onclick()
  assert.deepEqual(
    harness.api.sorted().map(row => row.path),
    ['volatile.ts', 'mixed.ts', 'stable.ts', 'orphan.ts']
  )
  harness.head().querySelectorAll('th').find(th => th.dataset.key === 'i').onclick()
  assert.deepEqual(
    harness.api.sorted().map(row => row.path),
    ['stable.ts', 'mixed.ts', 'volatile.ts', 'orphan.ts']
  )
})

test('sorting by a text column orders it, rather than comparing NaN', () => {
  const report = structuredClone(REPORT)
  report.files = ['m.ts', 'a.ts', 'z.ts'].map(path => ({
    path, app: 'a', domain: 'd', layer: null, loc: 10, ce: 0, ca: 0,
    ceStar: 0, caStar: 0, i: null, dependsOn: [], dependedOnBy: [], detectors: [],
  }))
  const harness = evaluate(renderHtml(report), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.head().querySelectorAll('th').find(th => th.dataset.key === 'path').onclick()
  assert.deepEqual(harness.api.sorted().map(row => row.path), ['z.ts', 'm.ts', 'a.ts'])
})

test('markup inside a path cannot escape into the chart or the table', () => {
  const hostile = structuredClone(REPORT)
  hostile.files[0].path = 'a"><circle r="99"/><b>.ts'
  hostile.files[1].path = 'plain & simple.ts'
  const harness = evaluate(renderHtml(hostile), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const drawn = circles(harness.chart())
  assert.equal(drawn.length, 2)
  assert.equal(drawn.some(circle => attribute(circle, 'r') === '99'), false)
  const paths = drawn.map(circle => attribute(circle, 'data-path'))
  assert.equal(new Set(paths).size, 2)
  assert.equal(/<b>/.test(harness.body()), false)
  assert.equal(harness.body().includes('&amp;'), true)
})

// The bucket is not a module: it aggregates unrelated infrastructure files, so
// its LOC is their sum and its caStar the maximum of them. On the real report
// that put it rightmost, highest and largest in the opening view - the top of
// the refactoring-queue quadrant - for something nobody can refactor.
const WITH_BUCKET = {
  ...REPORT,
  files: [
    ...REPORT.files,
    { path: 'environments/environment.ts', app: 'frontend', domain: '(sem dominio)', layer: null, loc: 11, ce: 0, ca: 5, ceStar: 0, caStar: 425, i: 0, dependsOn: [], dependedOnBy: ['a.ts'], detectors: [] },
  ],
  domains: [
    ...REPORT.domains,
    { domain: '(sem dominio)', apps: ['frontend'], files: 1, loc: 2501, ce: 0, ca: 5, caStar: 425, ceStar: 0 },
  ],
}

test('the report opens on files, not on the domain overview', () => {
  // Top N already made 959 points readable, so the domain default was left over
  // from a problem that no longer existed - and it opened the report on an
  // overview instead of on the view that answers the question.
  assert.equal(markupDefault(renderHtml(REPORT), 'unit'), 'file')
})

test('the unclassified bucket is never drawn or listed as a domain', () => {
  const harness = evaluate(renderHtml(WITH_BUCKET), { unit: 'domain', topn: '0' })
  harness.api.refresh()
  assert.equal(harness.chart().includes('(sem dominio)'), false)
  assert.equal(harness.body().includes('(sem dominio)'), false)
  assert.equal(circles(harness.chart()).length, REPORT.domains.length)
})

test('the files inside the bucket are still listed one by one', () => {
  // Excluding the aggregate must not hide its members: the design rule is that
  // a file is never silently dropped, and the file view is where it is kept.
  const harness = evaluate(renderHtml(WITH_BUCKET), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.equal(harness.body().includes('environments/environment.ts'), true)
  assert.equal(circles(harness.chart()).length, WITH_BUCKET.files.length)
})

test('the aggregation caveat is shown for domains and hidden for files', () => {
  const asFiles = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  asFiles.api.refresh()
  assert.equal(asFiles.document.getElementById('domain-note').hidden, true)

  const asDomains = evaluate(renderHtml(REPORT), { unit: 'domain', topn: '0' })
  asDomains.api.refresh()
  assert.equal(asDomains.document.getElementById('domain-note').hidden, false)
})

// ---------------------------------------------------------------------------
// Task 8 - hover, the detail card and the focus depth control.
// ---------------------------------------------------------------------------

const lines = markup => [...markup.matchAll(/<line\b[^>]*>/g)].map(match => match[0])

const file = (path, over) => ({
  path,
  app: 'a',
  domain: 'd',
  layer: null,
  loc: 100,
  ce: 0,
  ca: 0,
  ceStar: 0,
  caStar: 1,
  i: null,
  dependsOn: [],
  dependedOnBy: [],
  detectors: [],
  ...over,
})

const asReport = (files, domains) => ({
  ...structuredClone(REPORT),
  files,
  domains: domains ?? [
    { domain: 'd', apps: ['a'], files: files.length, loc: 100, ce: 0, ca: 0, caStar: 1, ceStar: 0 },
  ],
})

function lcg(seed) {
  let state = seed % 2147483647
  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

// Random graphs with self-edges, cycles and unreachable pockets, built from a
// fixed seed so a failure is reproducible.
function randomFiles(seed, size) {
  const next = lcg(seed)
  const paths = Array.from({ length: size }, (unused, index) => 'f' + index + '.ts')
  const out = paths.map(() => new Set())
  for (let from = 0; from < size; from++) {
    const count = Math.floor(next() * 4)
    for (let edge = 0; edge < count; edge++) {
      out[from].add(paths[Math.floor(next() * size)])
    }
  }
  return paths.map((path, index) =>
    file(path, {
      domain: 'd' + (index % 3),
      loc: 10 + index,
      ce: out[index].size,
      caStar: index % 7,
      dependsOn: [...out[index]].sort(),
      dependedOnBy: paths.filter((other, otherIndex) => out[otherIndex].has(path)).sort(),
    })
  )
}

// The reference is deliberately a DIFFERENT formulation from the page's
// frontier walk: it grows one closure set by whole rounds. Two implementations
// of the same algorithm would agree on the same mistake.
function reachable(files, path, depth, forward) {
  const edges = new Map(files.map(entry => [entry.path, []]))
  for (const entry of files) {
    for (const target of entry.dependsOn) {
      if (!edges.has(target) || target === entry.path) continue
      if (forward) edges.get(entry.path).push(target)
      else edges.get(target).push(entry.path)
    }
  }
  let collected = new Set([path])
  const rounds = Number.isFinite(depth) ? depth : files.length
  for (let round = 0; round < rounds; round++) {
    const grown = new Set(collected)
    for (const node of collected) {
      for (const other of edges.get(node) || []) grown.add(other)
    }
    collected = grown
  }
  collected.delete(path)
  return [...collected].sort()
}

test('neighbourhood agrees with a brute-force closure over random graphs', () => {
  for (const seed of [1, 7, 23, 101, 999]) {
    const files = randomFiles(seed, 12)
    const domains = ['d0', 'd1', 'd2'].map(name => ({
      domain: name, apps: ['a'], files: 4, loc: 40, ce: 0, ca: 0, caStar: 1, ceStar: 0,
    }))
    const { api } = evaluate(renderHtml(asReport(files, domains)), { unit: 'file', topn: '0' })
    for (const origin of files) {
      for (const depth of [1, 2, 3, Infinity]) {
        const near = api.neighbourhood(origin.path, depth)
        assert.deepEqual([...near.out].sort(), reachable(files, origin.path, depth, true))
        assert.deepEqual([...near.inbound].sort(), reachable(files, origin.path, depth, false))
      }
    }
  }
})

test('neighbourhood never returns the node it started from, cycle or not', () => {
  // The report carries two real cycles, and a file that imports itself is a
  // legal self-loop. Both walk back onto the origin, which would then be drawn
  // as a zero-length edge from a point to itself and counted in its own radius.
  const files = [
    file('a.ts', { dependsOn: ['b.ts', 'a.ts'], dependedOnBy: ['b.ts', 'a.ts'] }),
    file('b.ts', { dependsOn: ['a.ts'], dependedOnBy: ['a.ts'] }),
  ]
  const { api } = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '0' })
  for (const depth of [1, 2, 5, Infinity]) {
    assert.deepEqual([...api.neighbourhood('a.ts', depth).out], ['b.ts'])
    assert.deepEqual([...api.neighbourhood('a.ts', depth).inbound], ['b.ts'])
  }
})

test('depth Infinity terminates on a cycle and returns the whole radius', () => {
  const files = [
    file('a.ts', { dependsOn: ['b.ts'], dependedOnBy: ['c.ts'] }),
    file('b.ts', { dependsOn: ['c.ts'], dependedOnBy: ['a.ts'] }),
    file('c.ts', { dependsOn: ['a.ts'], dependedOnBy: ['b.ts'] }),
  ]
  const { api } = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '0' })
  assert.deepEqual([...api.neighbourhood('a.ts', 1).out], ['b.ts'])
  assert.deepEqual([...api.neighbourhood('a.ts', Infinity).out].sort(), ['b.ts', 'c.ts'])
  assert.deepEqual([...api.neighbourhood('a.ts', Infinity).inbound].sort(), ['b.ts', 'c.ts'])
})

test('hovering a domain draws the domain graph rather than nothing', () => {
  // The chart has two units. Reading edges out of REPORT.files while the chart
  // is showing domains finds no row for "alpha" at all: the feature silently
  // does nothing in one of the two views the report ships with.
  const harness = evaluate(renderHtml(REPORT), { unit: 'domain', topn: '0' })
  harness.api.refresh()
  assert.deepEqual([...harness.api.neighbourhood('alpha', 1).out], ['beta'])
  assert.deepEqual([...harness.api.neighbourhood('beta', 1).inbound], ['alpha'])
  harness.point('alpha').onmouseenter()
  assert.equal(lines(harness.overlay()).length, 1)
})

test('the excluded bucket is not resurrected as a domain neighbour', () => {
  const harness = evaluate(renderHtml(WITH_BUCKET), { unit: 'domain', topn: '0' })
  harness.api.refresh()
  assert.deepEqual([...harness.api.neighbourhood('alpha', Infinity).out], ['beta'])
  harness.point('alpha').onmouseenter()
  assert.equal(harness.overlay().includes('(sem dominio)'), false)
})

test('a file inside the bucket is still reachable in the file view', () => {
  // Excluding the aggregate must not lose the file. The edge only exists in
  // environment.ts's dependedOnBy, so this also pins that both directions of
  // the contract are read, not just dependsOn.
  const harness = evaluate(renderHtml(WITH_BUCKET), { unit: 'file', topn: '0' })
  harness.api.refresh()
  assert.deepEqual(
    [...harness.api.neighbourhood('a.ts', 1).out].sort(),
    ['b.ts', 'environments/environment.ts']
  )
})

test('overlay edges land exactly on the plotted centres, on the same axes as draw', () => {
  // draw() and the overlay are two renderers of one coordinate system. Any
  // second copy of the plot box or of the axis maxima drifts, and an edge then
  // points at empty space next to the circle it is supposed to touch.
  const harness = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const origin = harness.point('a.ts').tag
  const target = harness.point('b.ts').tag
  harness.point('a.ts').onmouseenter()
  const drawn = lines(harness.overlay())
  assert.equal(drawn.length, 1)
  assert.equal(attribute(drawn[0], 'x1'), attribute(origin, 'cx'))
  assert.equal(attribute(drawn[0], 'y1'), attribute(origin, 'cy'))
  assert.equal(attribute(drawn[0], 'x2'), attribute(target, 'cx'))
  assert.equal(attribute(drawn[0], 'y2'), attribute(target, 'cy'))
})

test('a neighbour hidden by the Top N filter is drawn faded, never dropped', () => {
  // hidden.ts holds the maximum on both axes and is filtered out of the view,
  // so an overlay that scaled itself over the VISIBLE nodes would place every
  // endpoint somewhere else than draw() did.
  const files = [
    file('hub.ts', { loc: 900, ce: 1, caStar: 90, ceStar: 1, dependsOn: ['hidden.ts'], detectors: ['pain'] }),
    file('hidden.ts', { loc: 5000, ca: 1, caStar: 200, dependedOnBy: ['hub.ts'] }),
  ]
  const harness = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '1' })
  harness.api.refresh()
  assert.equal(circles(harness.chart()).length, 1)
  const hub = harness.point('hub.ts').tag
  harness.point('hub.ts').onmouseenter()
  const drawn = lines(harness.overlay())
  assert.equal(drawn.length, 1)
  assert.equal(Number(attribute(drawn[0], 'stroke-opacity')) < 0.5, true)
  assert.equal(attribute(drawn[0], 'x1'), attribute(hub, 'cx'))
  assert.equal(attribute(drawn[0], 'y1'), attribute(hub, 'cy'))
  // The point itself comes back too, faded: an edge ending in blank canvas
  // does not say which node is on the other end of it.
  assert.equal(harness.overlay().includes('hidden.ts'), true)
  assert.equal(circles(harness.overlay()).length > 1, true)
})

test('outbound edges are solid and inbound edges dashed', () => {
  const harness = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.point('a.ts').onmouseenter()
  const outbound = lines(harness.overlay())
  assert.equal(outbound.length, 1)
  assert.equal(outbound[0].includes('stroke-dasharray'), false)
  harness.point('a.ts').onmouseleave()
  harness.point('b.ts').onmouseenter()
  const inbound = lines(harness.overlay())
  assert.equal(inbound.length, 1)
  assert.equal(inbound[0].includes('stroke-dasharray'), true)
})

test('markup in a path cannot escape into the detail card', () => {
  // Task 7 escaped the JSON and stopped there. The card builds innerHTML out of
  // path, dependsOn and dependedOnBy, which is the same disk-sourced text.
  const files = [
    file('x<marquee>y.ts', { dependsOn: ['q<marquee>r.ts'] }),
    file('q<marquee>r.ts', { dependedOnBy: ['x<marquee>y.ts'] }),
  ]
  const harness = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.point('x<marquee>y.ts').onclick()
  assert.equal(harness.card().includes('<marquee>'), false)
  assert.equal(harness.card().includes('&lt;marquee&gt;'), true)
  assert.equal(harness.card().includes('q&lt;marquee&gt;r.ts'), true)
})

test('markup in a path cannot escape into the overlay', () => {
  const files = [
    file('x<marquee>y.ts', { dependsOn: ['q<marquee>r.ts'] }),
    file('q<marquee>r.ts', { dependedOnBy: ['x<marquee>y.ts'] }),
  ]
  const harness = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '1' })
  harness.api.refresh()
  harness.point(harness.api.visible()[0].path).onmouseenter()
  assert.equal(harness.overlay().includes('<marquee>'), false)
  assert.equal(harness.overlay().includes('&lt;marquee&gt;'), true)
})

test('switching the unit drops a focus that no longer exists', () => {
  // refresh() rebuilds the markup but not the state behind it. A file path left
  // in focus while the chart shows domains addresses a node that is not there.
  const harness = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.point('b.ts').onclick()
  assert.equal(harness.api.state().focus, 'b.ts')
  assert.equal(harness.card().length > 0, true)

  harness.select('unit').value = 'domain'
  harness.select('unit').onchange()
  assert.equal(harness.api.state().focus, null)
  assert.equal(harness.card(), '')
  assert.equal(harness.overlay(), '')
})

test('focus and its overlay survive a Top N change without duplicating', () => {
  const harness = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.point('b.ts').onclick()
  harness.point('b.ts').onmouseleave()
  assert.equal(lines(harness.overlay()).length, 1)

  harness.select('topn').value = '1'
  harness.select('topn').onchange()
  assert.equal(harness.api.state().focus, 'b.ts')
  assert.equal(harness.card().length > 0, true)
  assert.equal(lines(harness.overlay()).length, 1)
})

test('the depth control widens the radius from the card', () => {
  const files = [
    file('a.ts', { dependsOn: ['b.ts'] }),
    file('b.ts', { dependsOn: ['c.ts'], dependedOnBy: ['a.ts'] }),
    file('c.ts', { dependedOnBy: ['b.ts'] }),
  ]
  const harness = evaluate(renderHtml(asReport(files)), { unit: 'file', topn: '0' })
  harness.api.refresh()
  harness.point('a.ts').onclick()
  assert.equal(lines(harness.overlay()).length, 1)
  harness.depthButton('2').onclick()
  assert.equal(harness.api.state().depth, 2)
  assert.equal(lines(harness.overlay()).length, 2)
  harness.depthButton('Infinity').onclick()
  assert.equal(harness.api.state().depth, Infinity)
  assert.equal(lines(harness.overlay()).length, 2)
  harness.depthButton('1').onclick()
  assert.equal(lines(harness.overlay()).length, 1)
})

test('the overlay group is emitted inside the chart, under the points', () => {
  // SVG paints in document order, so an overlay appended last would cover the
  // points it is annotating. It is also the reason the page can write the
  // overlay with the same innerHTML call draw() already relies on.
  const harness = evaluate(renderHtml(REPORT), { unit: 'file', topn: '0' })
  harness.api.refresh()
  const group = harness.chart().indexOf('<g id="overlay">')
  assert.notEqual(group, -1)
  assert.equal(group < harness.chart().indexOf('<circle'), true)
})
