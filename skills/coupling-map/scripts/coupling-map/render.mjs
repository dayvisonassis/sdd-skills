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
.axis { stroke: var(--line); }
.grid { stroke: var(--line); stroke-opacity: 0.55; stroke-dasharray: 2 4; }
.tick { fill: var(--muted); font-size: 10px; }
.axis-label { fill: var(--muted); font-size: 11px; }
h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--muted); margin: 16px 0 6px; }
h3:first-child { margin-top: 0; }
.sidebar p { margin: 0 0 8px; }
.legend { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; margin-right: 6px; background: var(--accent); }
.legend .is-pain::before { background: var(--pain); }
.legend .is-flagged::before { background: var(--warn); }
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
    <h3>Como ler</h3>
    <p>Eixo X: <b>Ca*</b>, quantos modulos quebram se este quebrar. Eixo Y: <b>LOC</b>.
    Tamanho do ponto: <b>Ce</b>. Os dois eixos sao logaritmicos.</p>
    <p>Canto superior direito e a fila de refatoracao. Canto inferior direito e fundacao
    saudavel: muito dependida e pequena. Nao tocar.</p>
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
    <div id="card"></div>
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

let sortKey = 'caStar';
let sortDir = -1;
let tiered = true;
let domainRows = null;

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

function draw(nodes) {
  const svg = document.getElementById('chart');
  const all = rows();
  const maxX = maxOf(all, 'caStar');
  const maxY = maxOf(all, 'loc');
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

  for (const node of nodes) {
    const cx = PLOT.left + scale(node.caStar, maxX, PLOT.width);
    const cy = PLOT.bottom - scale(node.loc, maxY, PLOT.height);
    const radius = 3 + Math.min(9, Math.log2(num(node.ce) + 1) * 2);
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

function refresh() {
  const nodes = visible();
  document.getElementById('domain-note').hidden = unit() !== 'domain';
  draw(nodes);
  table(nodes);
}

document.getElementById('unit').onchange = function () {
  if (columns().indexOf(sortKey) === -1) sortKey = 'caStar';
  refresh();
};
document.getElementById('topn').onchange = refresh;
refresh();
</script>`
}
