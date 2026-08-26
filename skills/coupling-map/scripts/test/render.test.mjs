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
// script touches, so draw(), the table and the sort are exercised for real.
function element() {
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    onchange: null,
    dataset: {},
    querySelectorAll() {
      if (this.cachedFor !== this.innerHTML) {
        this.cachedFor = this.innerHTML
        this.cached = [...String(this.innerHTML).matchAll(/data-key="([^"]*)"/g)].map(match => ({
          dataset: { key: match[1] },
          onclick: null,
        }))
      }
      return this.cached
    },
  }
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
  // Mirrors the markup defaults: the unit select opens on its first option and
  // the top-N select on the one marked selected.
  lookup('unit').value = options.unit ?? 'domain'
  lookup('topn').value = options.topn ?? '20'

  const document = {
    getElementById: id => lookup(id),
    querySelector: selector => lookup(selector),
  }
  const api = new Function(
    'document',
    body + '\nreturn { draw, table, refresh, rows, sorted, visible };'
  )(document)
  return { api, document, chart: () => lookup('chart').innerHTML, head: () => lookup('#table thead'), body: () => lookup('#table tbody').innerHTML }
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

test('the table opens on the refactoring queue: caStar down, ceStar up', () => {
  const html = renderHtml(REPORT)
  assert.match(html, /caStar/)
  assert.match(html, /ceStar/)
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
