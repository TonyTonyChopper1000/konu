import * as d3 from 'd3';
import './style.css';
import { fmt, short, COLORS, simpleBars, hbar, lines } from './charts.js';

// Summary CSVs from dashboard/data, bundled at build time.
const raw = import.meta.glob('../../dashboard/data/*.csv', { query: '?raw', import: 'default', eager: true });
const data = {};
for (const [path, text] of Object.entries(raw)) {
  data[path.split('/').pop().replace('.csv', '')] = d3.csvParse(text);
}
const num = (v) => (v === '' || v == null ? 0 : +v);

const SOURCES = ['Bhubharati', 'HMDA', 'TGRAC GIS', 'Govt websites'];
const SOURCE_TAB = { Bhubharati: 'bhubharati', HMDA: 'hmda', 'TGRAC GIS': 'tgrac', 'Govt websites': 'sites' };
const SOURCE_NOTE = {
  Bhubharati: 'Land-record master lists: districts, mandals, villages, survey numbers and Sub-Registrar offices.',
  HMDA: "Approval registers (building, layout, NOC, land-use change) plus the HMDA website's pages, documents and tables.",
  'TGRAC GIS': "A catalogue of the state ArcGIS server's layers, and attribute tables for 7 of its folders.",
  'Govt websites': 'Page text, document links and tables from RERA, GHMC, CGWB, TGRAC, TG-bPASS and MeeSeva.',
};

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach((k) => e.append(k instanceof Node ? k : String(k ?? '')));
  return e;
}
function table(target, cols, rows) {
  const head = el('thead', {}, el('tr', {}, ...cols.map((c) => el('th', { className: c.num ? 'num' : '' }, c.h))));
  const body = el('tbody', {}, ...rows.map((r) => el('tr', {}, ...cols.map((c) => {
    const v = c.get ? c.get(r) : r[c.f];
    return el('td', { className: c.num ? 'num' : c.wrap ? 'wrap' : '' }, v);
  }))));
  target.replaceChildren(head, body);
}
function kpis(target, items) {
  target.replaceChildren(...items.map(([v, l]) => el('div', { className: 'kpi' }, el('span', { className: 'v' }, v), el('span', { className: 'l' }, l))));
}
function pill(text, cls) { return el('span', { className: `pill ${cls}` }, text); }
function bold(t) { return el('b', {}, t); }

// ---------- tabs ----------
const tabs = [...document.querySelectorAll('.tab')];
const secs = [...document.querySelectorAll('.sec')];
const drawn = new Set();
const drawers = {};
function show(id) {
  if (!secs.some((s) => s.id === id)) id = 'overview';
  secs.forEach((s) => { s.hidden = s.id !== id; });
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
  if (!drawn.has(id) && drawers[id]) { drawn.add(id); drawers[id](); }
  if (location.hash.slice(1) !== id) history.replaceState(null, '', id === 'overview' ? location.pathname : `#${id}`);
}
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-tab],[data-goto]');
  if (t) show(t.dataset.tab || t.dataset.goto);
});
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

// ---------- overview ----------
const inv = data.inventory;
const bySource = SOURCES.map((source) => {
  const f = inv.filter((r) => r.source === source);
  return { source, files: f.length, records: d3.sum(f, (r) => num(r.records)) };
});
const top = d3.greatest(bySource, (r) => r.records);
$('lede').replaceChildren('Four crawler exports hold ', bold(fmt(inv.length)), ' CSV files and ',
  bold(fmt(d3.sum(bySource, (r) => r.records))), ' rows. The largest is ', bold(top.source), ', with ', bold(fmt(top.records)), ' rows.');

drawers.overview = () => {
  $('src-cards').replaceChildren(...bySource.map((s) => el('div', { className: 'card' },
    el('h3', {}, s.source),
    el('div', { className: 'n' }, `${fmt(s.records)} rows`),
    el('p', { className: 'muted' }, SOURCE_NOTE[s.source]),
    (() => { const b = el('button', { type: 'button' }, `Open ${s.source}`); b.dataset.goto = SOURCE_TAB[s.source]; return b; })(),
  )));
  simpleBars($('ov-rows'), bySource, { label: (r) => r.source, value: (r) => r.records, unit: 'rows', aria: 'Bar chart of rows in each export' });
  simpleBars($('ov-files'), bySource, { label: (r) => r.source, value: (r) => r.files, fmtv: fmt, unit: 'files', aria: 'Bar chart of CSV files in each export', color: COLORS[1] });
  const largest = [...inv].sort((a, b) => num(b.records) - num(a.records)).slice(0, 10);
  table($('ov-largest'), [
    { h: 'Export', f: 'source' }, { h: 'File', f: 'file' }, { h: 'Section', f: 'section' },
    { h: 'Rows', get: (r) => fmt(num(r.records)), num: 1 }, { h: 'Columns', f: 'columns', num: 1 },
  ], largest);
};

// ---------- bhubharati ----------
drawers.bhubharati = () => {
  const d = [...data.bhu_districts].sort((a, b) => num(b.survey_numbers) - num(a.survey_numbers));
  const sum = (k) => fmt(d3.sum(d, (r) => num(r[k])));
  kpis($('bhu-kpis'), [[fmt(d.length), 'Districts'], [sum('mandals'), 'Mandals'], [sum('villages'), 'Villages'],
    [sum('survey_numbers'), 'Survey numbers'], [sum('sro_offices'), 'Sub-Registrar offices']]);
  simpleBars($('bhu-chart'), d, { label: (r) => r.district, value: (r) => num(r.survey_numbers), unit: 'survey numbers', barH: 14, aria: 'Bar chart of survey numbers in each district' });
  table($('bhu-table'), [
    { h: 'District', f: 'district' }, { h: 'Telugu name', f: 'district_te' },
    { h: 'Mandals', get: (r) => fmt(num(r.mandals)), num: 1 }, { h: 'Villages', get: (r) => fmt(num(r.villages)), num: 1 },
    { h: 'Survey numbers', get: (r) => fmt(num(r.survey_numbers)), num: 1 }, { h: 'SRO offices', get: (r) => fmt(num(r.sro_offices)), num: 1 },
  ], d);
};

// ---------- hmda ----------
drawers.hmda = () => {
  const regs = data.hmda_registers;
  const site = (file) => num(inv.find((r) => r.source === 'HMDA' && r.path === `site/${file}`)?.records);
  kpis($('hmda-kpis'), [[fmt(d3.sum(regs, (r) => num(r.records))), `Approval records, ${regs.length} registers`],
    [fmt(site('pages.csv')), 'Website pages'], [fmt(site('documents.csv')), 'Linked documents'], [fmt(site('tables.csv')), 'Tables scraped from pages']]);
  const series = ['Building permissions', 'Layout permissions', 'Single-window industrial permissions'];
  $('hmda-legend').replaceChildren(...series.map((s, i) => el('span', {}, Object.assign(el('i', { className: 'sw' }), { style: `background:${COLORS[i]}` }), s)));
  const years = data.hmda_by_year.map((r) => ({ year: +r.year, ...Object.fromEntries(series.map((k) => [k, num(r[k])])) }));
  lines($('hmda-chart'), years, series, 'Line chart of HMDA approvals released per year, by register');
  table($('hmda-table'), [
    { h: 'Register', f: 'register' }, { h: 'File', f: 'file' }, { h: 'Records', get: (r) => fmt(num(r.records)), num: 1 },
    { h: 'With a date', get: (r) => fmt(num(r.with_date)), num: 1 }, { h: 'First year', f: 'first_year', num: 1 }, { h: 'Last year', f: 'last_year', num: 1 },
  ], regs);
};

// ---------- tgrac ----------
drawers.tgrac = () => {
  const f = data.tgrac_folders;
  const sum = (k) => d3.sum(f, (r) => num(r[k]));
  kpis($('tg-kpis'), [[fmt(f.length), 'Folders'], [fmt(sum('layers')), 'Layers in catalogue'], [short(sum('records')), 'Features on the server'],
    [fmt(sum('downloaded_layers')), 'Layers downloaded'], [short(sum('downloaded_records')), 'Feature rows downloaded']]);
  const topF = [...f].sort((a, b) => num(b.records) - num(a.records)).slice(0, 15);
  simpleBars($('tg-chart'), topF, { label: (r) => r.folder, value: (r) => num(r.records), unit: 'features', barH: 16, aria: 'Bar chart of the 15 TGRAC folders with the most features' });
  simpleBars($('tg-geom'), data.tgrac_geometry, { label: (r) => r.geometry, value: (r) => num(r.layers), fmtv: fmt, unit: 'layers', aria: 'Bar chart of TGRAC layers by geometry type', color: COLORS[1] });
  const status = (r) => {
    const d = num(r.downloaded_layers), fl = num(r.feature_layers);
    return d === 0 ? pill('Catalogue only', '') : d >= fl ? pill('Downloaded', 'ok') : pill('Partly downloaded', 'part');
  };
  const rows = [...f].sort((a, b) => num(b.downloaded_layers) - num(a.downloaded_layers) || num(b.records) - num(a.records));
  table($('tg-table'), [
    { h: 'Folder', f: 'folder' }, { h: 'Services', f: 'services', num: 1 }, { h: 'Layers', f: 'layers', num: 1 },
    { h: 'Feature layers', f: 'feature_layers', num: 1 }, { h: 'Features', get: (r) => fmt(num(r.records)), num: 1 },
    { h: 'Downloaded layers', f: 'downloaded_layers', num: 1 }, { h: 'Downloaded rows', get: (r) => fmt(num(r.downloaded_records)), num: 1 },
    { h: 'Status', get: status },
  ], rows);
};

// ---------- sites ----------
drawers.sites = () => {
  const s = [...data.sites].sort((a, b) => num(b.documents) - num(a.documents));
  simpleBars($('sites-chart'), s, { label: (r) => r.site, value: (r) => num(r.documents), fmtv: fmt, unit: 'documents', aria: 'Bar chart of documents linked from each website' });
  table($('sites-table'), [
    { h: 'Site', f: 'site' }, { h: 'Pages', f: 'pages', num: 1 }, { h: 'Documents', get: (r) => fmt(num(r.documents)), num: 1 },
    { h: 'Tables', f: 'tables', num: 1 }, { h: 'Skipped pages', f: 'skipped_pages', num: 1 },
    { h: 'Failed downloads', f: 'download_failures', num: 1 }, { h: 'Document types', f: 'top_doc_types' },
  ], s);
};

// ---------- all files ----------
drawers.files = () => {
  const draw = () => {
    const src = $('inv-src').value, kind = $('inv-kind').value, q = $('inv-q').value.trim().toLowerCase();
    const rows = inv.filter((r) => (!src || r.source === src) && (!kind || r.kind === kind) &&
      (!q || `${r.file} ${r.column_names} ${r.section}`.toLowerCase().includes(q)))
      .sort((a, b) => a.source.localeCompare(b.source) || a.section.localeCompare(b.section) || num(b.records) - num(a.records));
    $('inv-count').textContent = `${fmt(rows.length)} files · ${fmt(d3.sum(rows, (r) => num(r.records)))} rows`;
    table($('inv-table'), [
      { h: 'Export', f: 'source' }, { h: 'Section', f: 'section' }, { h: 'File', f: 'file' },
      { h: 'Rows', get: (r) => fmt(num(r.records)), num: 1 }, { h: 'Cols', f: 'columns', num: 1 },
      { h: 'KB', f: 'size_kb', num: 1 }, { h: 'Columns', f: 'column_names', wrap: 1 },
    ], rows);
  };
  ['inv-src', 'inv-kind'].forEach((id) => $(id).addEventListener('change', draw));
  $('inv-q').addEventListener('input', draw);
  draw();
};

// ---------- checklist ----------
drawers.checklist = () => {
  const ck = data.checklist;
  const yes = ck.filter((r) => r.status === 'Yes').length;
  $('ck-lede').replaceChildren('We have ', bold(fmt(yes)), ' of ', bold(fmt(ck.length)), ' expected items.');
  const order = [...new Set(ck.map((r) => r.source))];
  const per = order.map((source) => {
    const f = ck.filter((r) => r.source === source);
    const y = f.filter((r) => r.status === 'Yes').length;
    return { source, yes: y, no: f.length - y };
  });
  hbar($('ck-chart'), per, {
    label: (r) => r.source, barH: 18,
    aria: 'Stacked bar chart of checklist items covered and missing for each source',
    segments: (r) => [{ value: r.yes, color: 'var(--ok)' }, { value: r.no, color: 'var(--bad)' }],
    fmt: (r) => `${r.yes} / ${r.yes + r.no}`,
    tip: (r) => `${r.source}: ${r.yes} yes, ${r.no} no`,
  });
  const draw = () => {
    const f = $('ck-status').value;
    table($('ck-table'), [
      { h: 'Source', f: 'source' }, { h: 'What the directory expects', f: 'item' },
      { h: 'Got it?', get: (r) => pill(r.status, r.status === 'Yes' ? 'ok' : 'no') }, { h: 'What we have', f: 'evidence', wrap: 1 },
    ], ck.filter((r) => !f || r.status === f));
  };
  $('ck-status').addEventListener('change', draw);
  draw();
};

show(location.hash.slice(1));
