const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g')
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g')

function embed(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029')
}

function escapeText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function countOf(value) {
  return Array.isArray(value) ? value.length : 0
}

function statsMarkup(report) {
  const totals = report.totals || {}
  const detectors = report.detectors || {}
  const entries = [
    ['arquivos', totals.files],
    ['arestas', totals.edges],
    ['cobertura', totals.coveragePct === undefined ? undefined : totals.coveragePct + '%'],
    ['sem dominio', totals.unclassified],
    ['ilegiveis', totals.unreadable],
    ['fila de refatoracao', countOf(detectors.pain)],
    ['amplificadores', countOf(detectors.amplifier)],
    ['folha como dependencia', countOf(detectors.leafAsDependency)],
    ['violacoes de direcao', countOf(detectors.directionViolations)],
    ['ciclos', countOf(detectors.cycles)],
    ['orfaos', countOf(detectors.orphans)],
  ]
  for (const app of totals.coverageByApp || []) {
    entries.push(['cobertura ' + app.name, app.coveragePct + '%'])
  }
  return entries
    .filter(entry => entry[1] !== undefined && entry[1] !== null)
    .map(
      entry =>
        '<li><span>' + escapeText(entry[0]) + '</span><b>' + escapeText(entry[1]) + '</b></li>'
    )
    .join('')
}

function provenance(report) {
  const meta = report.meta || {}
  const commit = meta.generatedFrom
    ? String(meta.generatedFrom).slice(0, 10)
    : 'fora de um repositorio git'
  return escapeText('arch-report ' + (meta.scriptVersion || '?') + ' - commit ' + commit)
}

const STYLE = `
:root {
  --bg: #14161a; --panel: #1c1f25; --ink: #e6e8ec; --muted: #9aa1ac;
  --line: #2c313a; --accent: #7aa2f7; --pain: #e06c75; --warn: #e5c07b; --ok: #98c379;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #fbfaf7; --panel: #ffffff; --ink: #1c1f25; --muted: #5c6370;
    --line: #e3e0d8; --accent: #3b62b0; --pain: #b8433c; --warn: #a5761b; --ok: #4a7c3f;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 14px/1.5 ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif; }
.wrap { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 16px; padding: 16px; }
@media (max-width: 900px) { .wrap { grid-template-columns: minmax(0,1fr); } }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
.controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
select, button { background: var(--panel); color: var(--ink);
  border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; font: inherit; }
#summary { color: var(--muted); }
#chart { display: block; width: 100%; height: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th { text-align: right; cursor: pointer; color: var(--muted); font-weight: 600;
  border-bottom: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { padding: 4px 8px; border-bottom: 1px solid var(--line); }
td:first-child { font-size: 12px; max-width: 360px; word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
td:not(:first-child) { white-space: nowrap; }
tr.pain td:first-child { color: var(--pain); }
tr.flagged td:first-child { color: var(--warn); }
.tablewrap { overflow-x: auto; }
circle { cursor: pointer; }
#overlay { pointer-events: none; }
.axis { stroke: var(--line); }
.grid { stroke: var(--line); stroke-opacity: 0.55; stroke-dasharray: 2 4; }
.tick { fill: var(--muted); font-size: 10px; }
.axis-label { fill: var(--muted); font-size: 11px; }
h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); margin: 16px 0 6px; }
h3:first-child { margin-top: 0; }
#card:empty + h3 { margin-top: 0; }
#card:not(:empty) { border-bottom: 1px solid var(--line);
  padding-bottom: 10px; margin-bottom: 4px; }
.sidebar p { margin: 0 0 8px; }
.legend { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; margin-right: 6px; background: var(--accent); }
.legend .is-pain::before { background: var(--pain); }
.legend .is-flagged::before { background: var(--warn); }
#card .picked { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px; word-break: break-all; }
#card .links { color: var(--muted); font-size: 12px; word-break: break-all; }
#card button { margin-right: 4px; cursor: pointer; }
#card button.on { border-color: var(--accent); color: var(--accent); }
.stats { list-style: none; margin: 0; padding: 0; }
.stats li { display: flex; justify-content: space-between; gap: 8px;
  border-bottom: 1px solid var(--line); padding: 3px 0; }
.stats b { font-variant-numeric: tabular-nums; }
.note { color: var(--muted); border-left: 2px solid var(--line); padding-left: 8px; }
.provenance { color: var(--muted); font-size: 11px; margin-top: 12px; }
`

export function renderHtml(report) {
  return `<!doctype html>
<meta charset="utf-8">
<title>Coupling Map</title>
<style>${STYLE}</style>
<div class="wrap">
  <div>
    <div class="panel">
      <div class="controls">
        <select id="unit"><option value="file">Por arquivo</option><option value="domain">Por dominio</option></select>
        <select id="topn">
          <option value="10">Top 10</option>
          <option value="20" selected>Top 20</option>
          <option value="30">Top 30</option>
          <option value="50">Top 50</option>
          <option value="0">Todos</option>
        </select>
        <span id="summary"></span>
      </div>
      <svg id="chart" viewBox="0 0 720 460" width="100%"></svg>
    </div>
    <div class="panel tablewrap" style="margin-top:16px">
      <table id="table"><thead></thead><tbody></tbody></table>
    </div>
  </div>
  <div class="panel sidebar">
    <div id="card"></div>
    <h3>Como ler</h3>
    <p>Eixo X: <b>Ca*</b>, quantos modulos quebram se este quebrar. Eixo Y: <b>LOC</b>.
    Tamanho do ponto: <b>Ce</b>. Os dois eixos sao logaritmicos.</p>
    <p>Canto superior direito e a fila de refatoracao. Canto inferior direito e fundacao
    saudavel: muito dependida e pequena. Nao tocar.</p>
    <p>Passe o mouse sobre um ponto para ver as ligacoes dele: linha cheia e o que ele
    <b>usa</b>, linha tracejada e <b>quem depende dele</b>. Clique para fixar e escolher a
    profundidade. Vizinho que o Top N escondeu volta esmaecido - o filtro nunca esconde uma
    ligacao.</p>
    <p class="note" id="domain-note" hidden>Um dominio toma o <b>maior Ca*</b> entre os seus
    arquivos e a <b>soma</b> das linhas deles, entao a posicao dele no grafico pode vir de dois
    arquivos diferentes. As coordenadas reais de um arquivo estao em <b>Por arquivo</b>.</p>
    <div class="legend">
      <span class="is-pain">na fila de refatoracao</span>
      <span class="is-flagged">outro detector disparou</span>
      <span>nenhum detector</span>
    </div>
    <h3>As metricas</h3>
    <p><b>Ca*</b> beneficio de refatorar. <b>Ce*</b> dificuldade: quantos modulos podem
    quebrar este enquanto se mexe nele.</p>
    <h3>Este relatorio</h3>
    <ul class="stats">${statsMarkup(report)}</ul>
    <p class="provenance">${provenance(report)}</p>
  </div>
</div>
<script>
const REPORT = ${embed(report)};
const FILE_COLUMNS = ['path', 'domain', 'layer', 'loc', 'ce', 'ca', 'caStar', 'ceStar', 'i'];
const DOMAIN_COLUMNS = ['domain', 'apps', 'files', 'loc', 'ce', 'ca', 'caStar', 'ceStar'];
const NICE = [0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
const PLOT = { left: 60, right: 690, top: 30, bottom: 410, width: 630, height: 380 };
const TICK_GAP = 26;
const TIERS = ['pain', 'amplifier', 'leafAsDependency'];
const NO_DOMAIN = '(sem dominio)';
const DEPTHS = [['1', '1'], ['2', '2'], ['Infinity', 'tudo']];
const MAX_LINKS = 25;

let sortKey = 'caStar';
let sortDir = -1;
let tiered = true;
let domainRows = null;
let graphs = null;
let focus = null;
let hover = null;
let depth = 1;

function unit() {
  return document.getElementById('unit').value;
}

function columns() {
  return unit() === 'domain' ? DOMAIN_COLUMNS : FILE_COLUMNS;
}

function withDetectors() {
  if (domainRows === null) {
    const flags = {};
    for (const file of REPORT.files) {
      const list = flags[file.domain] || (flags[file.domain] = []);
      for (const name of file.detectors || []) {
        if (list.indexOf(name) === -1) list.push(name);
      }
    }
    domainRows = REPORT.domains
      .filter(d => d.domain !== NO_DOMAIN)
      .map(d => Object.assign({}, d, { path: d.domain, detectors: flags[d.domain] || [] }));
  }
  return domainRows;
}

function rows() {
  return unit() === 'domain' ? withDetectors() : REPORT.files;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function absent(value) {
  return value === null || value === undefined;
}

function tiebreak(a, b) {
  const byCeStar = num(a.ceStar) - num(b.ceStar);
  if (byCeStar !== 0) return byCeStar;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

function compare(a, b) {
  const left = a[sortKey];
  const right = b[sortKey];
  if (absent(left) && absent(right)) return tiebreak(a, b);
  if (absent(left)) return 1;
  if (absent(right)) return -1;
  const primary =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left) < String(right) ? -1 : String(left) > String(right) ? 1 : 0;
  if (primary === 0) return tiebreak(a, b);
  return sortDir === -1 ? -primary : primary;
}

function tier(node) {
  const flags = node.detectors || [];
  for (let index = 0; index < TIERS.length; index++) {
    if (flags.indexOf(TIERS[index]) !== -1) return index;
  }
  return TIERS.length;
}

function queueCompare(a, b) {
  const byTier = tier(a) - tier(b);
  if (byTier !== 0) return byTier;
  const byCaStar = num(b.caStar) - num(a.caStar);
  return byCaStar !== 0 ? byCaStar : tiebreak(a, b);
}

function sorted() {
  return rows().slice().sort(tiered ? queueCompare : compare);
}

function visible() {
  const limit = Number(document.getElementById('topn').value);
  const all = sorted();
  return limit > 0 ? all.slice(0, limit) : all;
}

function maxOf(list, key) {
  let max = 1;
  for (const item of list) {
    const value = num(item[key]);
    if (value > max) max = value;
  }
  return max;
}

function scale(value, max, size) {
  const bounded = Math.max(0, num(value));
  return (Math.log10(bounded + 1) / Math.log10(max + 1)) * size;
}

function ticks(max, size) {
  const span = Math.log10(max + 1);
  const out = [];
  for (const value of NICE) {
    if (value >= max) break;
    if (((span - Math.log10(value + 1)) / span) * size < TICK_GAP) break;
    out.push(value);
  }
  out.push(max);
  return out;
}

function byPath() {
  const index = new Map();
  for (const row of rows()) index.set(row.path, row);
  return index;
}

function axes() {
  const all = rows();
  return { maxX: maxOf(all, 'caStar'), maxY: maxOf(all, 'loc') };
}

function pointOf(node, limits) {
  return {
    x: PLOT.left + scale(node.caStar, limits.maxX, PLOT.width),
    y: PLOT.bottom - scale(node.loc, limits.maxY, PLOT.height),
  };
}

function radiusOf(node) {
  return 3 + Math.min(9, Math.log2(num(node.ce) + 1) * 2);
}

function draw(nodes) {
  const svg = document.getElementById('chart');
  const all = rows();
  const limits = axes();
  const maxX = limits.maxX;
  const maxY = limits.maxY;
  const parts = [];

  for (const value of ticks(maxX, PLOT.width)) {
    const x = (PLOT.left + scale(value, maxX, PLOT.width)).toFixed(1);
    if (value > 0) {
      parts.push('<line class="grid" x1="' + x + '" y1="' + PLOT.top + '" x2="' + x + '" y2="' + PLOT.bottom + '"/>');
    }
    parts.push('<text class="tick" x="' + x + '" y="425" text-anchor="middle">' + value + '</text>');
  }
  for (const value of ticks(maxY, PLOT.height)) {
    const y = PLOT.bottom - scale(value, maxY, PLOT.height);
    if (value > 0) {
      parts.push('<line class="grid" x1="' + PLOT.left + '" y1="' + y.toFixed(1) + '" x2="' + PLOT.right + '" y2="' + y.toFixed(1) + '"/>');
    }
    parts.push('<text class="tick" x="52" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + value + '</text>');
  }

  parts.push('<line class="axis" x1="60" y1="410" x2="700" y2="410"/>');
  parts.push('<line class="axis" x1="60" y1="20" x2="60" y2="410"/>');
  parts.push('<text class="axis-label" x="375" y="448" text-anchor="middle">Ca* - raio de explosao (log)</text>');
  parts.push('<text class="axis-label" x="14" y="215" text-anchor="middle" transform="rotate(-90 14 215)">LOC (log)</text>');
  parts.push('<g id="overlay"></g>');

  for (const node of nodes) {
    const point = pointOf(node, limits);
    const cx = point.x;
    const cy = point.y;
    const radius = radiusOf(node);
    const flags = node.detectors || [];
    const fill = flags.indexOf('pain') !== -1
      ? 'var(--pain)'
      : flags.length > 0 ? 'var(--warn)' : 'var(--accent)';
    const label = esc(node.path) + ' - Ca* ' + num(node.caStar) +
      ', LOC ' + num(node.loc) + ', Ce ' + num(node.ce);
    parts.push(
      '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + radius.toFixed(1) +
      '" fill="' + fill + '" fill-opacity="0.7" stroke="var(--bg)" stroke-width="0.5" data-path="' +
      esc(node.path) + '"><title>' + label + '</title></circle>'
    );
  }

  svg.innerHTML = parts.join('');
  document.getElementById('summary').textContent =
    nodes.length + ' de ' + all.length + ' - ' +
    (tiered ? 'fila: detectados primeiro, depois caStar' : 'ordenado por ' + sortKey);
}

function cell(node, key) {
  const value = node[key];
  if (absent(value)) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (key === 'i') return num(value).toFixed(2);
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2);
  return value;
}

function table(nodes) {
  const keys = columns();
  const head = document.querySelector('#table thead');
  head.innerHTML = '<tr>' + keys.map(function (key) {
    const marker = key === sortKey ? (sortDir === -1 ? ' ▾' : ' ▴') : '';
    return '<th data-key="' + key + '">' + key + marker + '</th>';
  }).join('') + '</tr>';

  const body = document.querySelector('#table tbody');
  body.innerHTML = nodes.map(function (node) {
    const flags = node.detectors || [];
    const rowClass = flags.indexOf('pain') !== -1 ? 'pain' : flags.length > 0 ? 'flagged' : '';
    return '<tr class="' + rowClass + '">' +
      keys.map(function (key) { return '<td>' + esc(cell(node, key)) + '</td>'; }).join('') +
      '</tr>';
  }).join('');

  for (const th of head.querySelectorAll('th')) {
    th.onclick = function () {
      const key = th.dataset.key;
      sortDir = key === sortKey && !tiered ? -sortDir : -1;
      sortKey = key;
      tiered = false;
      refresh();
    };
  }
}

function linksFrom(pairs) {
  const out = new Map();
  const inbound = new Map();
  for (const pair of pairs) {
    if (!out.has(pair[0])) out.set(pair[0], []);
    if (!inbound.has(pair[1])) inbound.set(pair[1], []);
    if (out.get(pair[0]).indexOf(pair[1]) === -1) out.get(pair[0]).push(pair[1]);
    if (inbound.get(pair[1]).indexOf(pair[0]) === -1) inbound.get(pair[1]).push(pair[0]);
  }
  return { out, inbound };
}

function filePairs() {
  const known = new Set(REPORT.files.map(file => file.path));
  const pairs = [];
  for (const file of REPORT.files) {
    for (const target of file.dependsOn || []) {
      if (target !== file.path && known.has(target)) pairs.push([file.path, target]);
    }
    for (const source of file.dependedOnBy || []) {
      if (source !== file.path && known.has(source)) pairs.push([source, file.path]);
    }
  }
  return pairs;
}

function domainPairs() {
  const home = new Map();
  for (const file of REPORT.files) home.set(file.path, file.domain);
  const named = new Set(withDetectors().map(row => row.domain));
  const pairs = [];
  for (const pair of filePairs()) {
    const from = home.get(pair[0]);
    const to = home.get(pair[1]);
    if (from === to || !named.has(from) || !named.has(to)) continue;
    pairs.push([from, to]);
  }
  return pairs;
}

function graph() {
  if (graphs === null) {
    graphs = { file: linksFrom(filePairs()), domain: linksFrom(domainPairs()) };
  }
  return graphs[unit()];
}

function reach(links, path, limit) {
  const seen = new Set([path]);
  const found = new Set();
  let frontier = [path];
  let level = 0;
  while (frontier.length > 0 && level < limit) {
    const next = [];
    for (const node of frontier) {
      for (const other of links.get(node) || []) {
        if (seen.has(other)) continue;
        seen.add(other);
        found.add(other);
        next.push(other);
      }
    }
    frontier = next;
    level += 1;
  }
  return found;
}

function neighbourhood(path, depth) {
  const links = graph();
  return { out: reach(links.out, path, depth), inbound: reach(links.inbound, path, depth) };
}

function edgeMarkup(from, to, outbound, solid) {
  return '<line class="edge" x1="' + from.x.toFixed(1) + '" y1="' + from.y.toFixed(1) +
    '" x2="' + to.x.toFixed(1) + '" y2="' + to.y.toFixed(1) +
    '" stroke="' + (outbound ? 'var(--pain)' : 'var(--accent)') + '" stroke-width="1"' +
    (outbound ? '' : ' stroke-dasharray="3 3"') +
    ' stroke-opacity="' + (solid ? '0.9' : '0.3') + '"/>';
}

function overlayMarkup(path, depth) {
  const index = byPath();
  const origin = index.get(path);
  if (origin === undefined) return '';
  const limits = axes();
  const start = pointOf(origin, limits);
  const shown = new Set(visible().map(node => node.path));
  const near = neighbourhood(path, depth);
  const faded = new Set();
  const parts = [];
  for (const target of near.out) {
    const row = index.get(target);
    if (row === undefined) continue;
    parts.push(edgeMarkup(start, pointOf(row, limits), true, shown.has(target)));
    if (!shown.has(target)) faded.add(target);
  }
  for (const source of near.inbound) {
    const row = index.get(source);
    if (row === undefined) continue;
    parts.push(edgeMarkup(pointOf(row, limits), start, false, shown.has(source)));
    if (!shown.has(source)) faded.add(source);
  }
  for (const hidden of faded) {
    const row = index.get(hidden);
    const point = pointOf(row, limits);
    parts.push('<circle class="ghost" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) +
      '" r="' + radiusOf(row).toFixed(1) + '" fill="var(--muted)" fill-opacity="0.35">' +
      '<title>' + esc(row.path) + '</title></circle>');
  }
  parts.push('<circle class="ring" cx="' + start.x.toFixed(1) + '" cy="' + start.y.toFixed(1) +
    '" r="' + (radiusOf(origin) + 4).toFixed(1) +
    '" fill="none" stroke="var(--ink)" stroke-width="1.5" stroke-opacity="0.8"/>');
  return parts.join('');
}

function linkList(paths) {
  if (paths.length === 0) return '-';
  const head = paths.slice(0, MAX_LINKS).map(esc).join(', ');
  return paths.length > MAX_LINKS ? head + ' +' + (paths.length - MAX_LINKS) : head;
}

function card(path) {
  const row = byPath().get(path);
  if (row === undefined) return '';
  const links = graph();
  const facts = unit() === 'domain'
    ? [['arquivos', row.files], ['Ca*', row.caStar], ['Ce*', row.ceStar], ['LOC', row.loc]]
    : [['Ca*', row.caStar], ['Ce*', row.ceStar], ['LOC', row.loc], ['Ce', row.ce], ['Ca', row.ca]];
  const flags = row.detectors || [];
  return '<h3>Selecionado</h3>' +
    '<p class="picked">' + esc(row.path) + '</p>' +
    '<ul class="stats">' + facts.map(function (entry) {
      return '<li><span>' + esc(entry[0]) + '</span><b>' +
        (absent(entry[1]) ? '-' : esc(entry[1])) + '</b></li>';
    }).join('') + '</ul>' +
    '<p>' + (flags.length > 0 ? esc(flags.join(', ')) : 'nenhum detector') + '</p>' +
    '<p>Profundidade: ' + DEPTHS.map(function (entry) {
      return '<button data-depth="' + entry[0] + '"' +
        (String(depth) === entry[0] ? ' class="on"' : '') + '>' + entry[1] + '</button>';
    }).join('') + '</p>' +
    '<p class="links"><b>depende de:</b> ' + linkList(links.out.get(path) || []) + '</p>' +
    '<p class="links"><b>dependem dele:</b> ' + linkList(links.inbound.get(path) || []) + '</p>';
}

function paint() {
  const path = hover === null ? focus : hover;
  document.getElementById('overlay').innerHTML =
    path === null ? '' : overlayMarkup(path, depth);
}

function bindDepth() {
  for (const button of document.querySelectorAll('#card button')) {
    button.onclick = function () {
      depth = button.dataset.depth === 'Infinity' ? Infinity : Number(button.dataset.depth);
      syncCard();
      paint();
    };
  }
}

function syncCard() {
  if (focus !== null && !byPath().has(focus)) focus = null;
  document.getElementById('card').innerHTML = focus === null ? '' : card(focus);
  bindDepth();
}

function bindChart() {
  for (const circle of document.querySelectorAll('#chart circle')) {
    const path = circle.dataset.path;
    if (path === undefined) continue;
    circle.onmouseenter = function () {
      hover = path;
      paint();
    };
    circle.onmouseleave = function () {
      hover = null;
      paint();
    };
    circle.onclick = function () {
      focus = focus === path ? null : path;
      hover = path;
      syncCard();
      paint();
    };
  }
}

function refresh() {
  const nodes = visible();
  hover = null;
  document.getElementById('domain-note').hidden = unit() !== 'domain';
  draw(nodes);
  table(nodes);
  bindChart();
  syncCard();
  paint();
}

document.getElementById('unit').onchange = function () {
  if (columns().indexOf(sortKey) === -1) sortKey = 'caStar';
  refresh();
};
document.getElementById('topn').onchange = refresh;
refresh();
</script>`
}
