/**
 * JS audit v2 for the accumulation calculator.
 *
 * Extracts project() from retirement_accumulation.html and runs the same
 * inputs as audit_accumulation_v2.py. Expects identical outputs to within R1.
 *
 * Run: node audit_js_v2.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(
  path.join(__dirname, '..', '..', 'retirement_accumulation_v2.html'), 'utf8');

// Grab the inline <script>...</script> (skip the Chart.js src tag)
const scripts = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g) || [];
const inline = scripts
  .filter(s => !/<script[^>]*\ssrc=/.test(s))
  .map(s => s.replace(/<\/?script[^>]*>/g, ''))
  .join('\n');

function extractFn(src, name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{', 'g');
  const m = re.exec(src);
  if (!m) throw new Error('no function: ' + name);
  let depth = 1, i = re.lastIndex;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) break;
        i++;
      }
    } else if (c === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i+1] === '/')) i++;
      i++;
    }
    i++;
  }
  return src.substring(m.index, i);
}

const swrSrc = extractFn(inline, 'swrForAge');
const projectSrc = extractFn(inline, 'project');
const projectFn = new Function(swrSrc + projectSrc + '; return project;')();
const swrForAge = new Function(swrSrc + '; return swrForAge;')();

let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function approx(a, b, tol = 1.0) { return Math.abs(a - b) <= tol; }


// ============================================================
// Starting balance compounds
// ============================================================
check('starting balance compounds at nominal rate', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 2_000_000, retB: 0, discA: 1_500_000, discB: 0,
    contribRetA: 10_000, contribRetB: 0, contribDiscA: 5_000, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65, events: [],
  });
  const expected = 3_500_000 * Math.pow(1.10, 25);
  assert.ok(approx(p.nominal.startBalance[25], expected, 1),
    `JS=${p.nominal.startBalance[25]} expected=${expected}`);
});

check('starting balance (real) compounds at real rate', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_000_000, retB: 0, discA: 0, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0,
    anchor: 'youngest', retirementAge: 65, events: [],
  });
  const expected = 1_000_000 * Math.pow(1.10, 25) / Math.pow(1.05, 25);
  assert.ok(approx(p.real.startBalance[25], expected, 1),
    `JS=${p.real.startBalance[25]} expected=${expected}`);
});

check('breakdown sums to total every year (no events)', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65, events: [],
  });
  for (let i = 0; i < p.real.total.length; i++) {
    const s = p.real.breakdown.initial[i] +
              p.real.breakdown.contribs[i] +
              p.real.breakdown.growth[i];
    assert.ok(approx(s, p.real.total[i], 1.0),
      `year ${i}: ${s} vs ${p.real.total[i]}`);
  }
});

// ============================================================
// Retirement age flexibility
// ============================================================
check('retirement age 60: horizon 20 years for age 40', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_000_000, retB: 0, discA: 0, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 60, events: [],
  });
  assert.strictEqual(p.years, 20);
});

check('retirement age 70, oldest anchor: 28-year horizon', () => {
  const p = projectFn({
    ageA: 42, ageB: 38,
    retA: 1_000_000, retB: 0, discA: 0, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'oldest', retirementAge: 70, events: [],
  });
  assert.strictEqual(p.years, 28);
});

// ============================================================
// Events
// ============================================================
check('inflow event: nominal diff = PV-inflated amount grown to horizon', () => {
  const base = {
    ageA: 40, ageB: 40,
    retA: 1_000_000, retB: 0, discA: 500_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
  };
  const p_no = projectFn(Object.assign({}, base, { events: [] }));
  const p_ev = projectFn(Object.assign({}, base, { events: [
    { age: 50, amount: 1_000_000, todaysMoney: true, kind: 'inflow' }
  ]}));
  const nominalAtArrival = 1_000_000 * Math.pow(1.05, 9);
  const grown15y = nominalAtArrival * Math.pow(1.10, 15);
  const diff = p_ev.finalTotalNom - p_no.finalTotalNom;
  assert.ok(approx(diff, grown15y, 1),
    `diff=${diff} expected=${grown15y}`);
});

check('outflow event: reduces final by event amount plus lost growth', () => {
  const base = {
    ageA: 40, ageB: 40,
    retA: 0, retB: 0, discA: 5_000_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
  };
  const p_no = projectFn(Object.assign({}, base, { events: [] }));
  const p_ev = projectFn(Object.assign({}, base, { events: [
    { age: 50, amount: 1_000_000, todaysMoney: true, kind: 'outflow' }
  ]}));
  const nominalAtEvent = 1_000_000 * Math.pow(1.05, 9);
  const lostGrowth = nominalAtEvent * Math.pow(1.10, 15);
  const diff = p_no.finalTotalNom - p_ev.finalTotalNom;
  assert.ok(approx(diff, lostGrowth, 1),
    `diff=${diff} expected=${lostGrowth}`);
});

check('outflow capped at discretionary; retirement untouched', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 5_000_000, retB: 0, discA: 100_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
    events: [{ age: 45, amount: 10_000_000, todaysMoney: true, kind: 'outflow' }],
  });
  // Retirement alone grows to 5m × 1.10^25
  const expected = 5_000_000 * Math.pow(1.10, 25);
  assert.ok(approx(p.finalTotalNom, expected, 50),
    `final=${p.finalTotalNom} expected=${expected}`);
});

check('nominal-flagged event: not inflated by CPI', () => {
  const base = {
    ageA: 40, ageB: 40,
    retA: 0, retB: 0, discA: 1_000_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.0,
    anchor: 'youngest', retirementAge: 65,
  };
  const baseline = 1_000_000 * Math.pow(1.10, 25);
  const p_pv = projectFn(Object.assign({}, base, { events: [
    { age: 50, amount: 1_000_000, todaysMoney: true, kind: 'inflow' }
  ]}));
  const p_fv = projectFn(Object.assign({}, base, { events: [
    { age: 50, amount: 1_000_000, todaysMoney: false, kind: 'inflow' }
  ]}));
  const added_pv = p_pv.finalTotalNom - baseline;
  const added_fv = p_fv.finalTotalNom - baseline;
  const ratio = added_pv / added_fv;
  assert.ok(approx(ratio, Math.pow(1.05, 9), 0.001),
    `ratio=${ratio} expected=${Math.pow(1.05, 9)}`);
});

check('event past horizon: ignored', () => {
  const base = {
    ageA: 40, ageB: 40,
    retA: 1_000_000, retB: 0, discA: 500_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
  };
  const p_no = projectFn(Object.assign({}, base, { events: [] }));
  const p_ev = projectFn(Object.assign({}, base, { events: [
    { age: 80, amount: 10_000_000, todaysMoney: true, kind: 'inflow' }
  ]}));
  assert.ok(approx(p_no.finalTotalNom, p_ev.finalTotalNom, 0.5));
});

check('inflow + outflow at same age cancel', () => {
  const base = {
    ageA: 40, ageB: 40,
    retA: 0, retB: 0, discA: 5_000_000, discB: 0,
    contribRetA: 0, contribRetB: 0, contribDiscA: 0, contribDiscB: 0,
    rNom: 0.10, cpi: 0.05, esc: 0,
    anchor: 'youngest', retirementAge: 65,
  };
  const p_none = projectFn(Object.assign({}, base, { events: [] }));
  const p_both = projectFn(Object.assign({}, base, { events: [
    { age: 50, amount: 1_000_000, todaysMoney: false, kind: 'inflow' },
    { age: 50, amount: 1_000_000, todaysMoney: false, kind: 'outflow' },
  ]}));
  assert.ok(approx(p_none.finalTotalNom, p_both.finalTotalNom, 2),
    `none=${p_none.finalTotalNom} both=${p_both.finalTotalNom}`);
});

// ============================================================
// Regression: default scenario unchanged
// ============================================================
check('default scenario matches v1 baseline', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65, events: [],
  });
  assert.ok(approx(p.finalTotalReal, 23_313_210, 200));
  // Income now uses the age-65 SWR (4.8%), not the old flat 5% (was 97_138).
  assert.ok(approx(p.monthlyIncomeReal, 93_252, 10));
});

// ============================================================
// Narrative: no em-dashes, and the three describe functions all
// return non-empty strings that mention the pertinent numbers.
// ============================================================
const narrativeBundle = [
  'fmtR', 'fmtShort', 'fmtPct', 'swrForAge', 'fmtSwr', 'totalMonthlyContribs',
  'eventsSentence', 'describeCurrentPosition',
  'describeBaselinePosition', 'describePlannedScenario',
].map(n => extractFn(inline, n)).join('\n');
const narrative = new Function(
  narrativeBundle +
  '; return { describeCurrentPosition, describeBaselinePosition, describePlannedScenario };'
)();

const EM_DASH = '—';

check('narrative: no em-dashes in current-position output', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
    events: [{ age: 50, amount: 500_000, todaysMoney: true, kind: 'inflow' }],
  });
  const out = narrative.describeCurrentPosition(p);
  // Now a single plain-English sentence, not the old multi-sentence prose.
  assert.ok(/^Projected/.test(out.replace(/<[^>]+>/g, '')),
    'should open with "Projected": ' + out);
  assert.ok(/R\s?\d/.test(out), 'should state the monthly income figure: ' + out);
  assert.ok(out.indexOf(EM_DASH) === -1, 'em-dash found: ' + out);
});

check('narrative: no em-dashes in baseline + planned-scenario output', () => {
  const baseInputs = {
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.08, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65, events: [],
  };
  const planInputs = Object.assign({}, baseInputs, {
    rNom: 0.10,
    contribRetA: 12_000, contribRetB: 10_000,
  });
  const bp = projectFn(baseInputs);
  const pp = projectFn(planInputs);
  const bline = { p: bp, inputs: baseInputs };

  const baselineOut = narrative.describeBaselinePosition(bline);
  const scenarioOut = narrative.describePlannedScenario(pp, bline);

  assert.ok(baselineOut.length > 100, 'baseline too short: ' + baselineOut);
  assert.ok(scenarioOut.length > 150, 'scenario too short: ' + scenarioOut);
  assert.ok(baselineOut.indexOf(EM_DASH) === -1,
    'em-dash in baseline: ' + baselineOut);
  assert.ok(scenarioOut.indexOf(EM_DASH) === -1,
    'em-dash in scenario: ' + scenarioOut);
  assert.ok(/baseline/i.test(scenarioOut),
    'scenario should reference the baseline: ' + scenarioOut);
  assert.ok(/(more|less)/i.test(scenarioOut),
    'scenario should describe delta direction: ' + scenarioOut);
});


// ============================================================
// Export deck — helper + structural tests
// ============================================================

check('report: deriveFamilyName extracts last token', () => {
  const deriveFamilyName = new Function(
    extractFn(inline, 'deriveFamilyName') + '; return deriveFamilyName;')();
  assert.strictEqual(deriveFamilyName('Thabo & Amara Nkosi'), 'Nkosi');
  assert.strictEqual(deriveFamilyName('  Smith  '), 'Smith');
  assert.strictEqual(deriveFamilyName(''), '——');
  assert.strictEqual(deriveFamilyName(null), '——');
});

check('report: escapeHtml is defined and escapes the 5 HTML-special chars', () => {
  assert.ok(/function escapeHtml/.test(inline), 'escapeHtml function missing');
  assert.ok(/&amp;/.test(inline) && /&lt;/.test(inline) && /&gt;/.test(inline) &&
            /&quot;/.test(inline) && /&#39;/.test(inline),
            'escapeHtml should emit all 5 named entities');
});

check('report: deck contains the 4 pages, scenario conditional', () => {
  const pageRe = /<section class="report-page[^"]*"[^>]*data-page="([a-z-]+)"/g;
  const pages = [];
  let m;
  while ((m = pageRe.exec(html)) !== null) pages.push(m[1]);
  assert.deepStrictEqual(pages, ['cover','projection','scenario','methodology'],
    'report page sequence: ' + pages.join(','));

  // Scenario page is the only conditional one: starts disabled.
  const scenRe = /<section class="report-page scenario-page"[^>]*data-enabled="false"/;
  assert.ok(scenRe.test(html), 'scenario page should start data-enabled="false"');
});

check('report: income chart is an inline SVG (sharp in PDF)', () => {
  const svgRe = /<svg id="report-income-chart"[^>]*viewBox="0 0 940 350"/;
  assert.ok(svgRe.test(html), '#report-income-chart should be an <svg> with the 940x350 viewBox');
  // No Chart.js canvas for the report (SVG only).
  assert.ok(!/id="report-chart-[a-z]+"\s*[^>]*canvas/i.test(html), 'report should not use a chart canvas');
});

check('report: deck-mode gates (button, modal, @page injection) are wired', () => {
  assert.ok(/id="btn-export-report"/.test(html), 'Report button missing');
  assert.ok(/id="calc-root"/.test(html), 'calc-root id missing');
  assert.ok(/id="report-scenario-modal"/.test(html), 'include-scenario modal missing');
  ['report-modal-cancel','report-export-without','report-export-with'].forEach(id => {
    assert.ok(new RegExp('id="' + id + '"').test(html), 'modal button missing: ' + id);
  });
  // JS entry points
  assert.ok(/function startExport/.test(inline), 'startExport missing');
  assert.ok(/function runReportExport/.test(inline), 'runReportExport missing');
  assert.ok(/function teardownExport/.test(inline), 'teardownExport missing');
  assert.ok(/function renderReportIncomeChart/.test(inline), 'renderReportIncomeChart missing');
  // @page injection (dynamic stylesheet)
  assert.ok(/@page \{ size: A4 landscape/.test(inline), '@page landscape injection missing');
  // afterprint handler teardown
  assert.ok(/teardownExport\(\)/.test(inline), 'afterprint teardown call missing');
});

check('report: buildReportData is a formatting adapter, not an engine', () => {
  const src = extractFn(inline, 'buildReportData');
  // It must source the chart from the existing curve helper, not recompute.
  assert.ok(/incomeCurveData\(/.test(src), 'buildReportData should call incomeCurveData');
  // It must not re-implement compounding (no monthly-rate maths inline).
  assert.ok(!/Math\.pow\(1 \+/.test(src) && !/\/ 12\b[\s\S]*\*[\s\S]*1 \+/.test(src),
    'buildReportData should not re-implement the projection maths');
});

check('report: locked baseline always drives the main pages', () => {
  // Bug fix: whenever a baseline is locked, the cover + Page 2 use baseline.p
  // (not the live lastProjection) — including "Export without scenario". The
  // live lastProjection only appears as the plan column on Page 3.
  const src = extractFn(inline, 'runReportExport');
  assert.ok(/includeScenarioPage\s*=\s*includeScenario\s*&&\s*hasBaseline/.test(src),
    'scenario page should be gated on includeScenario && hasBaseline');
  assert.ok(/mainProjection\s*=\s*hasBaseline\s*\?\s*baseline\.p\s*:\s*lastProjection/.test(src),
    'main projection should be baseline.p whenever a baseline is locked');
  assert.ok(/comparisonBaseline\s*=\s*includeScenarioPage\s*\?\s*baseline\s*:\s*null/.test(src),
    'comparisonBaseline should only be set when the scenario page is included');
  assert.ok(/buildReportData\(\s*mainProjection\s*,\s*comparisonBaseline/.test(src),
    'runReportExport should pass mainProjection + comparisonBaseline to buildReportData');
  // The scenario comparison always plots the live plan as the "planned" side.
  const bd = extractFn(inline, 'buildReportData');
  assert.ok(/buildScenarioComparison\(\s*lastProjection\s*,/.test(bd),
    'scenario comparison should use lastProjection as the plan side');
});

check('report: print CSS collapses export wrappers to avoid blank/footer pages', () => {
  // Bug fix: the screen-print wrapper padding (.calc/.page/.workspace) pushed
  // each 210mm page past the sheet boundary, spilling the cover footer and
  // adding trailing blanks. The export-scoped reset zeroes them.
  assert.ok(/html\.export-printing \.workspace/.test(html),
    'export print reset should target .workspace');
  assert.ok(/html\.export-printing #calc-root\[data-export-mode="true"\][\s\S]{0,400}padding: 0 !important/.test(html),
    'export print reset should zero calc-root padding');
  assert.ok(/html\.export-printing \.report-deck \.report-page\[data-enabled="false"\][\s\S]{0,60}display: none !important/.test(html),
    'disabled scenario page must be hidden in the export print scope');
  assert.ok(/html\.export-printing \.report-deck \.report-page:last-of-type[\s\S]{0,80}page-break-after: auto/.test(html),
    'last report page must not force a trailing page break');
});

check('report: Page 2 layout resets + reserved footer band', () => {
  // The global ".spouse-mini + .spouse-mini" dashed divider must be reset so
  // the two household columns align at the top.
  assert.ok(/\.report-deck \.household-grid \.spouse-mini \+ \.spouse-mini\s*\{[^}]*border-top:\s*0/.test(html),
    'second spouse column should reset the global dashed top border');
  assert.ok(/\.report-deck \.summary-table td:first-child\s*\{[^}]*width:\s*auto/.test(html),
    'report summary-table first column should reset the global 60% width');
  // Footer band: report-page reserves a fixed footer row, .page-foot has a
  // top-border divider, and the absolute .foot-line is hidden.
  assert.ok(/\.report-deck \.report-page\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) 12mm/.test(html),
    'report-page should reserve a fixed footer band via grid-template-rows');
  assert.ok(/\.report-deck \.page-foot\s*\{[^}]*border-top:\s*1px solid var\(--r-line\)/.test(html),
    '.page-foot should carry a top-border divider');
  assert.ok(/\.report-deck \.foot-line\s*\{\s*display:\s*none/.test(html),
    'the absolute .foot-line should be hidden in the report deck');
});

check('report: every footer + compliance line uses the exact FSP wording', () => {
  const phrase = 'Simple Wealth Pty Ltd is an authorized financial service provider, FSP number 50637.';
  // Scope to the report deck only (the screen appendix keeps its own wording).
  const deck = html.match(/<section class="report-deck"[\s\S]*?<!-- \/\.report-deck -->/);
  assert.ok(deck, 'report-deck markup not found');
  const count = deck[0].split(phrase).length - 1;
  assert.ok(count >= 5,
    'expected the exact FSP phrase on 4 footers + the compliance line, got ' + count);
  assert.ok(!/financial services provider\. FSP number 50637/.test(deck[0]),
    'old footer wording should be gone from the report deck');
});

check('report: static prose copy has no em-dashes', () => {
  // Hand-written static prose: methodology/compliance <p> blocks and the
  // chart-panel intro. data-bind spans/cells are overwritten at runtime, so
  // strip them (and the "—" placeholders inside them) before scanning.
  const emDash = '—';
  const strip = s => s
    .replace(/<[^>]*data-bind="[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/g, ' ')
    .replace(/<[^>]*data-bind="[^"]*"[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');

  const deckRe = /<section class="report-deck"[\s\S]*?<\/section>\s*<!-- \/\.report-deck -->/;
  const deck = html.match(deckRe);
  assert.ok(deck, 'report-deck markup not found');
  const text = strip(deck[0]);
  assert.ok(text.indexOf(emDash) === -1,
    'em-dash in report static prose: ' + text.slice(0, 200));
});

// ============================================================
// Family-name title plate: static suffix lives outside the editable span
// ============================================================
check('family-name: static suffix lives outside editable span', () => {
  // The span must no longer contain the word "family" (Session 9 bug fix).
  // Match the #family-name span and check its inner text.
  const spanRe = /<span[^>]*id="family-name"[^>]*>([\s\S]*?)<\/span>/;
  const m = html.match(spanRe);
  assert.ok(m, '#family-name span missing');
  const inner = m[1];
  assert.ok(!/family/i.test(inner),
    'span still contains the word "family": ' + inner);
  // The word "family." should appear AFTER the span in the same h1.
  const h1Re = /<h1 class="empty-title">([\s\S]*?)<\/h1>/;
  const h1 = html.match(h1Re);
  assert.ok(h1, 'empty-title h1 missing');
  const afterSpan = h1[1].split(/<\/span>/)[1] || '';
  assert.ok(/family\./i.test(afterSpan),
    'static "family." suffix missing after span: ' + afterSpan);
  // And "for the" should appear BEFORE the span.
  const beforeSpan = h1[1].split(/<span/)[0] || '';
  assert.ok(/for the/i.test(beforeSpan),
    'static "for the" prefix missing before span: ' + beforeSpan);
});

// ============================================================
// Income-goal progress: data model + narrative sentence
// ============================================================
check('income-goal: canonical drawer input + State 1 sync wired', () => {
  assert.ok(/id="income-goal"/.test(html), '#income-goal canonical input missing');
  assert.ok(/data-sync-to="income-goal"/.test(html),
    'State 1 shadow input with data-sync-to="income-goal" missing');
  assert.ok(/id="sum-income-goal"/.test(html), 'outcome-strip goal sub-line missing');
  assert.ok(/id="cmp-baseline-goal-row"/.test(html), 'baseline goal meta-row missing');
  assert.ok(/id="cmp-scenario-goal-row"/.test(html), 'scenario goal meta-row missing');
  assert.ok(/data-bind="assum-goal"/.test(html), 'report income-goal assumption slot missing');
});

check('income-goal: readInputs returns incomeGoal field', () => {
  assert.ok(/incomeGoal:\s*parseCurrency\(['"]income-goal['"]\)/.test(inline),
    'readInputs should read #income-goal via parseCurrency');
});

check('narrative: describeCurrentPosition includes goal sentence when set', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
    incomeGoal: 80000,
    events: [],
  });
  const out = narrative.describeCurrentPosition(p);
  assert.ok(/goal/i.test(out), 'goal mentioned when set: ' + out);
  assert.ok(out.indexOf(EM_DASH) === -1, 'em-dash in goal narrative: ' + out);
});

check('narrative: describeCurrentPosition omits goal sentence when blank', () => {
  const p = projectFn({
    ageA: 40, ageB: 40,
    retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
    contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
    rNom: 0.10, cpi: 0.05, esc: 0.06,
    anchor: 'youngest', retirementAge: 65,
    incomeGoal: 0,
    events: [],
  });
  const out = narrative.describeCurrentPosition(p);
  assert.ok(!/goal/i.test(out),
    'no goal sentence when blank: ' + out);
});

// ============================================================
// Session 10 · State 1 capital events panel + goal colors
// ============================================================
check('state-1 events: empty-events-list container + add-event button exist', () => {
  assert.ok(/id="empty-events-list"/.test(html),
    '#empty-events-list container missing from State 1');
  assert.ok(/id="empty-add-event-btn"/.test(html),
    '#empty-add-event-btn button missing from State 1');
  assert.ok(/class="empty-events-panel"/.test(html),
    '.empty-events-panel wrapper missing');
});

check('state-1 events: renderEvents paints both #events-list and #empty-events-list', () => {
  // The refactored renderEvents iterates an array of container IDs.
  assert.ok(/\[['"]events-list['"]\s*,\s*['"]empty-events-list['"]\]/.test(inline),
    'renderEvents should iterate [events-list, empty-events-list]');
});

check('state-1 events: events-ref-spouse is a class shared by drawer + State 1', () => {
  const matches = html.match(/class="events-ref-spouse"/g) || [];
  assert.ok(matches.length >= 2,
    'expected at least 2 .events-ref-spouse spans (drawer + State 1), got ' + matches.length);
  assert.ok(!/id="events-ref-spouse"/.test(html),
    'events-ref-spouse should no longer be an id (migrated to class)');
  assert.ok(/querySelectorAll\(['"]\.events-ref-spouse['"]\)/.test(inline),
    'lookup should be querySelectorAll on the class, not getElementById');
});

check('state-1 events: #empty-add-event-btn click pushes onto eventsStore', () => {
  // Look for the handler — should push newEvent(), call renderEvents(), then refresh().
  const re = /getElementById\(['"]empty-add-event-btn['"]\)\.addEventListener\(['"]click['"],\s*function\s*\(\)\s*\{([\s\S]*?)\}\)/;
  const m = inline.match(re);
  assert.ok(m, '#empty-add-event-btn click handler missing');
  assert.ok(/eventsStore\.push\(newEvent\(\)\)/.test(m[1]),
    'handler should push newEvent() onto eventsStore');
  assert.ok(/renderEvents\(\)/.test(m[1]),
    'handler should call renderEvents()');
  assert.ok(/refresh\(\)/.test(m[1]),
    'handler should call refresh()');
});

check('goal colors: on-track uses --pos, behind uses --neg', () => {
  const onTrackRe = /\.goal-progress-on-track\s*\{[^}]*color:\s*var\(--pos\)/;
  const behindRe  = /\.goal-progress-behind\s*\{[^}]*color:\s*var\(--neg\)/;
  assert.ok(onTrackRe.test(html),
    '.goal-progress-on-track should use var(--pos) (green)');
  assert.ok(behindRe.test(html),
    '.goal-progress-behind should use var(--neg) (red)');
});

check('goal colors: compare card wraps the % in a progress span', () => {
  // Compare-card scenario + baseline
  assert.ok(/cmp-scenario-goal[\s\S]{0,200}goal-progress-on-track/.test(inline) ||
            /goal-progress-on-track[\s\S]{0,200}cmp-scenario-goal/.test(inline),
    'cmp-scenario-goal should wrap % in a goal-progress span');
});

// ============================================================
// Income-by-retirement-age curve (State 2 "Income" chart)
// ============================================================
const incomeCurveFn = new Function(
  swrSrc + '\n' +
  extractFn(inline, 'project') + '\n' +
  extractFn(inline, 'incomeCurveData') +
  '; return incomeCurveData;')();

const incomeBaseInputs = {
  ageA: 40, ageB: 40,
  retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
  contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
  rNom: 0.10, cpi: 0.05, esc: 0.06,
  anchor: 'youngest', retirementAge: 65, events: [],
};

check('incomeCurveData: marker income equals headline monthlyIncomeReal', () => {
  const d = incomeCurveFn(incomeBaseInputs);
  const base = projectFn(incomeBaseInputs);
  assert.ok(approx(d.incomeReal[d.markerIndex], base.monthlyIncomeReal, 1),
    `marker=${d.incomeReal[d.markerIndex]} headline=${base.monthlyIncomeReal}`);
});

check('incomeCurveData: ages span refAge .. retirementAge+10', () => {
  const d = incomeCurveFn(incomeBaseInputs);
  const refAge = Math.min(incomeBaseInputs.ageA, incomeBaseInputs.ageB);
  assert.strictEqual(d.ages[0], refAge);
  assert.strictEqual(d.ages[d.ages.length - 1], incomeBaseInputs.retirementAge + 10);
  assert.strictEqual(d.ages.length,
    incomeBaseInputs.retirementAge + 10 - refAge + 1);
  assert.strictEqual(d.incomeReal.length, d.ages.length);
  assert.strictEqual(d.markerAge, incomeBaseInputs.retirementAge);
});

check('incomeCurveData: per-age income matches a dedicated projection', () => {
  const d = incomeCurveFn(incomeBaseInputs);
  const refAge = Math.min(incomeBaseInputs.ageA, incomeBaseInputs.ageB);
  [50, 60, 65, 72].forEach(age => {
    // A dedicated run retiring at `age` applies that age's SWR internally, so
    // its monthlyIncomeReal is the per-age income the extended run should read.
    const dedicated = projectFn(Object.assign({}, incomeBaseInputs, { retirementAge: age }));
    assert.ok(approx(d.incomeReal[age - refAge], dedicated.monthlyIncomeReal, 1),
      `age ${age}: curve=${d.incomeReal[age - refAge]} dedicated=${dedicated.monthlyIncomeReal}`);
  });
});

check('swrForAge: table values, below-55 floor, above-100 clamp', () => {
  assert.strictEqual(swrForAge(55), 0.042);
  assert.strictEqual(swrForAge(65), 0.048);
  assert.strictEqual(swrForAge(100), 0.25);
  assert.ok(approx(swrForAge(54) * 100, 4.1, 1e-9));
  assert.strictEqual(swrForAge(48), 0.035);   // floor reached
  assert.strictEqual(swrForAge(40), 0.035);   // held at floor
  assert.strictEqual(swrForAge(110), 0.25);   // held at age-100 rate
});

check('income: project applies the age-based SWR (4.8% at age 65)', () => {
  const p = projectFn(incomeBaseInputs);  // retires at 65
  assert.ok(approx(p.monthlyIncomeReal, p.finalTotalReal * 0.048 / 12, 1),
    `income=${p.monthlyIncomeReal} expected=${p.finalTotalReal * 0.048 / 12}`);
});

check('income view: markup + wiring present', () => {
  assert.ok(/id="chart-income"/.test(html), '#chart-income canvas missing');
  assert.ok(/id="btn-view-income"/.test(html), '#btn-view-income button missing');
  assert.ok(/chart-legend-income/.test(html), 'income legend key missing');
  // chartIncome is registered for print/resize.
  assert.ok(/charts:\s*\[\s*chartIncome\b/.test(inline),
    'chartIncome not registered in resizeChartsToWrap');
  // refresh() builds the income view first.
  assert.ok(/chartView === 'income'\)\s*buildIncomeCurveChart/.test(inline),
    "refresh() should branch on chartView === 'income'");
});

// ============================================================
// Save / Open plan — file-based persistence
// ============================================================
const slugifyName = new Function(
  extractFn(inline, 'slugifyName') + '; return slugifyName;')();

const planIdsMatch = inline.match(/var PLAN_INPUT_IDS = (\[[\s\S]*?\]);/);
const PLAN_INPUT_IDS = planIdsMatch ? new Function('return ' + planIdsMatch[1])() : null;

check('plan: slugifyName cleans family names for filenames', () => {
  assert.strictEqual(slugifyName('Nkosi'), 'nkosi');
  assert.strictEqual(slugifyName('van der Merwe'), 'van-der-merwe');
  assert.strictEqual(slugifyName("O'Brien & Sons!"), 'o-brien-sons');
  assert.strictEqual(slugifyName(''), 'plan');       // empty -> fallback
  assert.strictEqual(slugifyName('——'), 'plan');     // unsluggable -> fallback
});

check('plan: PLAN_INPUT_IDS covers every id readInputs() reads', () => {
  assert.ok(Array.isArray(PLAN_INPUT_IDS), 'PLAN_INPUT_IDS not found');
  const readInputsSrc = extractFn(inline, 'readInputs');
  const tokens = (readInputsSrc.match(/'[a-z][a-z0-9-]+'/g) || [])
    .map(t => t.slice(1, -1));
  tokens.forEach(id => {
    assert.ok(PLAN_INPUT_IDS.includes(id),
      `readInputs reads '${id}' but it is not in PLAN_INPUT_IDS`);
  });
  // The three meeting meta ids are persisted too (not read by readInputs).
  ['client-name', 'client-date', 'adviser-name'].forEach(id => {
    assert.ok(PLAN_INPUT_IDS.includes(id), `${id} missing from PLAN_INPUT_IDS`);
  });
});

check('plan: kind guard + schema constants present', () => {
  assert.ok(/var PLAN_KIND = 'sw-accumulation-plan'/.test(inline), 'PLAN_KIND missing');
  assert.ok(/var PLAN_SCHEMA_VERSION = 1\b/.test(inline), 'PLAN_SCHEMA_VERSION missing');
  // applyPlanFile rejects a wrong/absent kind.
  const applySrc = extractFn(inline, 'applyPlanFile');
  assert.ok(/obj\.kind !== PLAN_KIND/.test(applySrc),
    'applyPlanFile should reject files whose kind !== PLAN_KIND');
  // Stores always-assign with an empty default (no stale-state inheritance).
  assert.ok(/Array\.isArray\(s\.events\) \? deepClone\(s\.events\) : \[\]/.test(applySrc),
    'events store should restore as [] when the key is absent');
  // refresh() is the last engine call.
  assert.ok(/refresh\(\);\s*return true;/.test(applySrc),
    'applyPlanFile should call refresh() last');
});

check('plan: no localStorage/sessionStorage (opt-in restore only)', () => {
  // Design principle #1: never auto-rehydrate. A plain refresh must land on the
  // blank/default tool, so the persistence layer must not touch web storage.
  // Match actual usage (property access / indexing), not the word in a comment.
  assert.ok(!/(local|session)Storage\s*[.\[]/.test(inline),
    'plan persistence must not use localStorage/sessionStorage');
});

check('plan: Save/Open buttons wired in nav + State 1', () => {
  assert.ok(/id="btn-save-plan"/.test(html), 'Save plan button missing');
  assert.ok(/id="btn-open-plan"/.test(html), 'Open plan button missing');
  assert.ok(/id="btn-open-plan-empty"/.test(html), 'State 1 Open button missing');
  assert.ok(/showSaveFilePicker' in window/.test(inline), 'no FS Access feature-detect');
  assert.ok(/AbortError/.test(inline), 'cancel (AbortError) should be swallowed');
});

// ============================================================
// Closing-the-gap solver + contribution leverage (Features 1 & 2)
// ============================================================
const gapBundle = [
  'totalMonthlyContribs', 'swrForAge', 'project', 'incomeCurveData',
  'bumpContribs', 'marginalIncomePer1000', 'solveGapRoutes',
].map(n => extractFn(inline, n)).join('\n');
const gap = new Function(gapBundle +
  '; return { marginalIncomePer1000, solveGapRoutes };')();

const gapBase = {
  ageA: 48, ageB: 46,
  retA: 1_500_000, retB: 1_200_000, discA: 500_000, discB: 300_000,
  contribRetA: 8_000, contribRetB: 7_000, contribDiscA: 3_000, contribDiscB: 2_000,
  rNom: 0.09, cpi: 0.05, esc: 0.05,
  anchor: 'youngest', retirementAge: 65, incomeGoal: 0, events: [],
};
const gapT = 8_000 + 7_000 + 3_000 + 2_000;  // base total monthly contribution
const bump = (inp, delta) => {
  const f = (gapT + delta) / gapT;
  return Object.assign({}, inp, {
    contribRetA: 8_000 * f, contribRetB: 7_000 * f,
    contribDiscA: 3_000 * f, contribDiscB: 2_000 * f,
  });
};

check('gap: marginalIncomePer1000 equals the income delta for +R1000/mo total', () => {
  const k = gap.marginalIncomePer1000(gapBase);
  const i0 = projectFn(gapBase).monthlyIncomeReal;
  const i1 = projectFn(bump(gapBase, 1000)).monthlyIncomeReal;
  assert.ok(approx(k, i1 - i0, 0.5), `k=${k} expected=${i1 - i0}`);
  assert.ok(k > 0, 'marginal income should be positive');
});

check('gap: income is affine in total contribution (constant slope)', () => {
  const i0 = projectFn(gapBase).monthlyIncomeReal;
  const slope = d => (projectFn(bump(gapBase, d)).monthlyIncomeReal - i0) / d;
  assert.ok(approx(slope(1000), slope(50000), 1e-3),
    `slope1000=${slope(1000)} slope50000=${slope(50000)}`);
});

check('gap: solved contribution closes the goal; one R100 less misses', () => {
  const i0 = projectFn(gapBase).monthlyIncomeReal;
  const goal = i0 + 15000;
  const inp = Object.assign({}, gapBase, { incomeGoal: goal });
  const r = gap.solveGapRoutes(inp);
  assert.ok(r && r.contribReachable, 'should find a contribution route');
  assert.ok(projectFn(bump(inp, r.contribPerMonth)).monthlyIncomeReal >= goal - 0.5,
    'solved contribution should reach the goal');
  assert.ok(projectFn(bump(inp, r.contribPerMonth - 100)).monthlyIncomeReal < goal,
    'R100 less should miss the goal');
});

check('gap: retire-later route is the first later age that clears the goal', () => {
  const i0 = projectFn(gapBase).monthlyIncomeReal;
  const goal = i0 + 8000;
  const inp = Object.assign({}, gapBase, { incomeGoal: goal });
  const r = gap.solveGapRoutes(inp);
  assert.ok(r && r.retReachable, 'should find a retire-later age');
  let first = null;
  for (let age = inp.retirementAge + 1; age <= inp.retirementAge + 20; age++){
    if (projectFn(Object.assign({}, inp, { retirementAge: age })).monthlyIncomeReal >= goal){
      first = age; break;
    }
  }
  assert.strictEqual(r.retAge, first, `route=${r.retAge} scan=${first}`);
  assert.strictEqual(r.retYears, first - inp.retirementAge);
});

check('gap: solveGapRoutes returns null with no goal or a goal already met', () => {
  assert.strictEqual(gap.solveGapRoutes(gapBase), null);  // incomeGoal 0
  const i0 = projectFn(gapBase).monthlyIncomeReal;
  const met = Object.assign({}, gapBase, { incomeGoal: i0 - 5000 });
  assert.strictEqual(gap.solveGapRoutes(met), null);
});

check('gap: card markup + refresh wiring present', () => {
  assert.ok(/id="gap-solver"/.test(html), '#gap-solver card missing');
  assert.ok(/id="gap-routes"/.test(html), '#gap-routes block missing');
  assert.ok(/id="gap-leverage"/.test(html), '#gap-leverage line missing');
  assert.ok(/id="gap-route-contrib"/.test(html) && /id="gap-route-retage"/.test(html),
    'route list items missing');
  assert.ok(/function updateGapSolver/.test(inline), 'updateGapSolver missing');
  assert.ok(/updateGapSolver\(p\)/.test(inline), 'updateGapSolver not called in refresh()');
});

check('gap: updateGapSolver copy has no em-dashes', () => {
  const src = extractFn(inline, 'updateGapSolver');
  assert.ok(src.indexOf('—') === -1, 'em-dash found in updateGapSolver copy');
});

// ============================================================
// Clear baseline reverts the scenario-lever writebacks
// ============================================================
check('clearBaseline: restore map covers every field the levers/drawer can change', () => {
  const restore = new Function(
    extractFn(inline, 'baselineRestoreFields') + '; return baselineRestoreFields;')();
  const bi = {
    ageA: 48, ageB: 46,
    retA: 2_000_000, retB: 1_000_000, discA: 500_000, discB: 250_000,
    contribRetA: 15_000, contribRetB: 9_000, contribDiscA: 3_000, contribDiscB: 1_000,
    rNom: 0.09, cpi: 0.05, esc: 0.05,
    anchor: 'oldest', retirementAge: 65, incomeGoal: 100_000,
  };
  const f = restore(bi);
  // money fields carry the raw numbers; setHpFormatted does the formatting.
  assert.strictEqual(f.money['hp-ret-A'], 2_000_000);
  assert.strictEqual(f.money['hp-disc-contrib-B'], 1_000);
  assert.strictEqual(f.money['income-goal'], 100_000);
  // plain fields convert market decimals back to percent + carry the ages.
  assert.strictEqual(f.plain['return'], 9);
  assert.strictEqual(f.plain['cpi'], 5);
  assert.strictEqual(f.plain['esc'], 5);
  assert.strictEqual(f.plain['hp-age-A'], 48);
  assert.strictEqual(f.plain['retirement-age'], 65);
  // Completeness: every input the levers (contrib/return/age) or the drawer
  // (balances/goal/cpi/esc/ages) can change must be in the restore map, or
  // Clear baseline would leave a stale scenario value behind.
  const ids = Object.keys(f.money).concat(Object.keys(f.plain));
  ['hp-ret-A','hp-ret-B','hp-disc-A','hp-disc-B',
   'hp-ret-contrib-A','hp-ret-contrib-B','hp-disc-contrib-A','hp-disc-contrib-B',
   'income-goal','hp-age-A','hp-age-B','return','cpi','esc','retirement-age']
    .forEach(id => assert.ok(ids.includes(id), `restore map missing ${id}`));
});

check('clearBaseline: restores inputs + anchor BEFORE nulling the baseline', () => {
  const src = extractFn(inline, 'clearBaseline');
  assert.ok(/baselineRestoreFields/.test(src),
    'clearBaseline does not apply baselineRestoreFields');
  assert.ok(/setAnchor\(bi\.anchor\)/.test(src),
    'clearBaseline does not restore the locked anchor');
  // The restore must run before `baseline = null`, else refresh() -> readInputs()
  // reads the adjusted DOM and State 2 shows the scenario, not the locked plan.
  const restoreAt = src.indexOf('baselineRestoreFields');
  const nullAt = src.indexOf('baseline = null');
  assert.ok(restoreAt !== -1 && nullAt !== -1 && restoreAt < nullAt,
    'baseline nulled before the locked inputs were restored');
});

// ============================================================
// Current-plan recap card (State 2)
// ============================================================
check('recap card: markup + render wiring present', () => {
  ['recap-ret-A','recap-ret-B','recap-disc-A','recap-disc-B',
   'recap-contrib-ret-A','recap-contrib-ret-B','recap-contrib-disc-A','recap-contrib-disc-B',
   'recap-return','recap-cpi','recap-esc'].forEach(id =>
    assert.ok(new RegExp('id="' + id + '"').test(html), `recap markup missing #${id}`));
  assert.ok(/class="plan-recap"/.test(html), '.plan-recap card missing');
  // spouse-name headers must carry data-spouse so renderSpouseLabels() syncs them
  assert.ok(/recap-spouse-name[^>]*data-spouse="A"/.test(html) &&
            /recap-spouse-name[^>]*data-spouse="B"/.test(html),
    'recap spouse-name headers must use data-spouse for label sync');
  assert.ok(/function updateRecapCard/.test(inline), 'updateRecapCard missing');
  assert.ok(/updateRecapCard\(p\)/.test(inline), 'updateRecapCard not called in refresh()');
});

// ============================================================
// Year-by-year table — reconciliation flow columns
// ============================================================
check('year table: reconciliation-flow columns present', () => {
  const src = extractFn(inline, 'buildYearTable');
  ['Opening', 'Contributions', 'Growth', 'Closing'].forEach(h =>
    assert.ok(src.indexOf("'" + h + "'") !== -1 || src.indexOf('>' + h + '<') !== -1,
      `year-table header "${h}" missing`));
  // growth is the residual that makes each row reconcile
  assert.ok(/closing\s*-\s*series\.total\[i-1\]\s*-\s*contrib\s*-\s*event/.test(src),
    'growth should be the opening+contrib+event residual');
});

// ============================================================
// Capital events — shared display helpers (screen + report)
// ============================================================
const capitalRowsFn = new Function(
  extractFn(inline, 'fmtR') + extractFn(inline, 'capitalEventDisplayRows')
  + '; return capitalEventDisplayRows;')();
const capitalHtmlFn = new Function(
  extractFn(inline, 'escapeHtml') + extractFn(inline, 'capitalEventsHtml')
  + '; return capitalEventsHtml;')();

check('capitalEventDisplayRows: empty / null input', () => {
  const a = capitalRowsFn([]);
  assert.ok(a.hasEvents === false && a.rows.length === 0 && a.extraCount === 0,
    'empty array should produce no rows');
  const b = capitalRowsFn(null);
  assert.ok(b.hasEvents === false && b.rows.length === 0, 'null should be tolerated');
});

check('capitalEventDisplayRows: maps fields and caps at 3 rows', () => {
  const d = capitalRowsFn([
    { age: 55, amount: 500000, todaysMoney: true, kind: 'inflow' },
    { age: 60, amount: 250000, todaysMoney: false, kind: 'outflow' },
    { age: 62, amount: 100000, todaysMoney: true, kind: 'inflow' },
    { age: 64, amount: 100000, todaysMoney: true, kind: 'inflow' },
    { age: 66, amount: 100000, todaysMoney: true, kind: 'inflow' }
  ]);
  assert.ok(d.hasEvents === true, 'hasEvents should be true');
  assert.strictEqual(d.rows.length, 3, 'should cap at 3 rows');
  assert.strictEqual(d.extraCount, 2, 'should count the 2 extra events');
  assert.strictEqual(d.rows[0].age, 'Age 55');
  assert.strictEqual(d.rows[0].kind, 'Inflow');
  assert.strictEqual(d.rows[0].basis, "Today's money");
  assert.strictEqual(d.rows[1].kind, 'Outflow');
  assert.strictEqual(d.rows[1].basis, 'Future rands');
  assert.ok(/R\s?500\s?000/.test(d.rows[0].amount), 'amount should be formatted rands: ' + d.rows[0].amount);
});

check('capitalEventsHtml: empty case emits the empty class', () => {
  const html = capitalHtmlFn(capitalRowsFn([]), 'row-x', 'empty-x', 'more-x');
  assert.ok(/class="empty-x"/.test(html), 'empty class missing: ' + html);
  assert.ok(/No capital events modelled\./.test(html), 'empty copy missing');
});

check('capitalEventsHtml: rows + additional-events line, em-dash free', () => {
  const d = capitalRowsFn([
    { age: 55, amount: 500000, todaysMoney: true, kind: 'inflow' },
    { age: 60, amount: 250000, todaysMoney: false, kind: 'outflow' },
    { age: 62, amount: 100000, todaysMoney: true, kind: 'inflow' },
    { age: 64, amount: 100000, todaysMoney: true, kind: 'inflow' }
  ]);
  const html = capitalHtmlFn(d, 'row-x', 'empty-x', 'more-x');
  assert.ok((html.match(/class="row-x"/g) || []).length === 3, 'should render 3 rows');
  assert.ok(/event-kind-inflow/.test(html) && /event-kind-outflow/.test(html),
    'kind classes missing');
  assert.ok(/class="more-x">1 additional event modelled\./.test(html),
    'additional-events line missing/wrong plural: ' + html);
  assert.ok(html.indexOf(EM_DASH) === -1, 'em-dash found in events html: ' + html);
});

check('capitalEventsHtml: singular vs plural in extra-count line', () => {
  const five = capitalRowsFn([1,2,3,4,5].map(a => (
    { age: 50 + a, amount: 100000, todaysMoney: true, kind: 'inflow' })));
  const html = capitalHtmlFn(five, 'row-x', 'empty-x', 'more-x');
  assert.ok(/2 additional events modelled\./.test(html), 'plural extra-count missing: ' + html);
});

// ============================================================
// Capital events — wiring into screen recap + report deck
// ============================================================
check('capital events: screen recap markup + binding present', () => {
  assert.ok(/id="recap-events-list"/.test(html), '#recap-events-list missing');
  assert.ok(/id="report-capital-events"/.test(html), '#report-capital-events missing');
  assert.ok(/data-bind="report-events-list"/.test(html), 'report-events-list bind missing');
  const recap = extractFn(inline, 'updateRecapCard');
  assert.ok(/capitalEventsHtml\(/.test(recap) && /recap-events-list/.test(recap),
    'updateRecapCard should populate the recap events list');
});

check('capital events: buildReportData returns a capitalEvents object', () => {
  const src = extractFn(inline, 'buildReportData');
  assert.ok(/capitalEvents:\s*capitalEvents/.test(src),
    'buildReportData should return capitalEvents');
  assert.ok(/capitalEventDisplayRows\(inputs\.events/.test(src),
    'capitalEvents should be derived from the projection inputs (baseline-aware)');
  // methodology note is conditional on whether events exist
  assert.ok(/No capital events are modelled/.test(src)
    && /applied at year-end to the discretionary portfolio/.test(src),
    'conditional methodology events note missing');
});

check('capital events: populateReportDeck toggles strip + has-events class', () => {
  const src = extractFn(inline, 'populateReportDeck');
  assert.ok(/report-capital-events/.test(src), 'strip toggle missing');
  assert.ok(/classList\.toggle\('has-events'/.test(src), 'has-events class toggle missing');
  assert.ok(/setBind\('report-events-list'/.test(src), 'report events list not bound');
});

console.log();
console.log('='.repeat(50));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
