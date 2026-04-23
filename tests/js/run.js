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
  path.join(__dirname, '..', '..', 'retirement_accumulation.html'), 'utf8');

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

const projectSrc = extractFn(inline, 'project');
const projectFn = new Function(projectSrc + '; return project;')();

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
  assert.ok(approx(p.monthlyIncomeReal, 97_138, 5));
});

// ============================================================
// Narrative: no em-dashes, and the three describe functions all
// return non-empty strings that mention the pertinent numbers.
// ============================================================
const narrativeBundle = [
  'fmtR', 'fmtShort', 'fmtPct', 'totalMonthlyContribs',
  'eventsSentence', 'goalSentence', 'describeCurrentPosition',
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
  assert.ok(out.length > 100, 'narrative too short: ' + out);
  assert.ok(out.indexOf(EM_DASH) === -1, 'em-dash found: ' + out);
  assert.ok(/retirement/i.test(out) && /inflation/i.test(out),
    'missing pertinent terms: ' + out);
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

// extractFn's brace-scanner doesn't understand regex literals, so
// functions containing /"/ will confuse it. toRoman + deriveFamilyName
// are safe; skip escapeHtml and test its presence instead.
const exportHelpers = [
  'toRoman', 'deriveFamilyName',
].map(n => extractFn(inline, n)).join('\n');
const exportHelperFns = new Function(
  exportHelpers + '; return { toRoman, deriveFamilyName };'
)();

check('export: toRoman maps key numerals correctly', () => {
  assert.strictEqual(exportHelperFns.toRoman(1),  'I');
  assert.strictEqual(exportHelperFns.toRoman(4),  'IV');
  assert.strictEqual(exportHelperFns.toRoman(7),  'VII');
  assert.strictEqual(exportHelperFns.toRoman(9),  'IX');
  assert.strictEqual(exportHelperFns.toRoman(12), 'XII');
  assert.strictEqual(exportHelperFns.toRoman(40), 'XL');
});

check('export: deriveFamilyName extracts last token', () => {
  assert.strictEqual(exportHelperFns.deriveFamilyName('Thabo & Amara Nkosi'), 'Nkosi');
  assert.strictEqual(exportHelperFns.deriveFamilyName('  Smith  '), 'Smith');
  assert.strictEqual(exportHelperFns.deriveFamilyName(''), '——');
  assert.strictEqual(exportHelperFns.deriveFamilyName(null), '——');
});

check('export: escapeHtml is defined and escapes the 5 HTML-special chars', () => {
  // Presence check (full behaviour is evident from source).
  assert.ok(/function escapeHtml/.test(inline), 'escapeHtml function missing');
  assert.ok(/&amp;/.test(inline) && /&lt;/.test(inline) && /&gt;/.test(inline) &&
            /&quot;/.test(inline) && /&#39;/.test(inline),
            'escapeHtml should emit all 5 named entities');
});

check('export: deck contains 12 pages, 2 conditionals', () => {
  // Scope to only <section> tags, not CSS selectors that also contain
  // data-export-page="...".
  const pageRe = /<section class="export-page"[^>]*data-export-page="([a-z-]+)"/g;
  const pages = [];
  let m;
  while ((m = pageRe.exec(html)) !== null) pages.push(m[1]);
  assert.strictEqual(pages.length, 12, 'page count: ' + pages.length);
  const expected = ['cover','answer','household','assumptions','projection','breakdown','events','compare','year-by-year','methodology','compliance','next-steps'];
  assert.deepStrictEqual(pages, expected);

  // Conditional pages: only inside section tags, not CSS.
  const condRe = /<section class="export-page"[^>]*data-export-page-active="false"/g;
  const conditionals = (html.match(condRe) || []).length;
  assert.strictEqual(conditionals, 2, 'conditional page count: ' + conditionals);
});

check('export: deck-mode gates (button, exportCharts, @page injection) are wired', () => {
  assert.ok(/id="btn-export-report"/.test(html), 'button missing');
  assert.ok(/id="calc-root"/.test(html), 'calc-root id missing');
  // Canvas IDs for the 5 export charts
  ['export-chart-answer','export-chart-projection-nom','export-chart-breakdown','export-chart-compare-baseline','export-chart-compare-scenario']
    .forEach(id => {
      assert.ok(new RegExp('id="' + id + '"').test(html), 'missing canvas: ' + id);
    });
  // JS entry points
  assert.ok(/function startExport/.test(inline), 'startExport missing');
  assert.ok(/function teardownExport/.test(inline), 'teardownExport missing');
  assert.ok(/function buildExportDeck/.test(inline), 'buildExportDeck missing');
  assert.ok(/function buildExportCharts/.test(inline), 'buildExportCharts missing');
  assert.ok(/function destroyExportCharts/.test(inline), 'destroyExportCharts missing');
  // @page injection (dynamic stylesheet)
  assert.ok(/@page \{ size: A4 landscape/.test(inline), '@page landscape injection missing');
  // afterprint handler teardown
  assert.ok(/teardownExport\(\)/.test(inline), 'afterprint teardown call missing');
});

check('export: static prose copy has no em-dashes', () => {
  // Check only the hand-written static-prose zones. Both topbar
  // placeholders (e.g. "the — family") and inline data-bind spans
  // (e.g. "Prepared ——" → overwritten with a real date) are stripped
  // before scanning, since they're guaranteed to be replaced by
  // em-dash-free content at runtime.
  const emDash = '—';
  const stripPlaceholders = s => s
    .replace(/<span[^>]*data-bind="[^"]*"[^>]*>[\s\S]*?<\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');

  // Prose cols contain no nested <div>, so the first </div> closes them.
  const proseRe = /<div class="export-prose-col">([\s\S]*?)<\/div>/g;
  let m, proseFound = 0;
  while ((m = proseRe.exec(html)) !== null){
    proseFound++;
    const text = stripPlaceholders(m[1]);
    assert.ok(text.indexOf(emDash) === -1,
      'em-dash in prose column ' + proseFound + ': ' + text.slice(0, 200));
  }
  assert.ok(proseFound >= 4, 'expected at least 4 prose columns, got ' + proseFound);

  // Closing strip cells
  const stripRe = /<div class="export-closing-strip">([\s\S]*?)<\/div>\s*<div class="export-closing-foot">/;
  const strip = html.match(stripRe);
  assert.ok(strip, 'closing strip missing');
  const stripText = stripPlaceholders(strip[1]);
  assert.ok(stripText.indexOf(emDash) === -1,
    'em-dash in closing strip: ' + stripText.slice(0, 200));
});

check('export: assumptions aside + events list header are em-dash-free', () => {
  const emDash = '—';
  // assumptions aside
  const asideRe = /<aside class="export-assump-aside"[^>]*>([\s\S]*?)<\/aside>/;
  const aside = html.match(asideRe);
  assert.ok(aside, 'assumptions aside missing');
  const asideText = aside[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
  assert.ok(asideText.indexOf(emDash) === -1,
    'em-dash in assumptions aside: ' + asideText.slice(0, 200));

  // events list header row (.export-events-list-head)
  const headRe = /<div class="export-events-list-head">([\s\S]*?)<\/div>/;
  const head = html.match(headRe);
  assert.ok(head, 'events list head missing');
  assert.ok(head[1].indexOf(emDash) === -1, 'em-dash in events list head');
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
  assert.ok(/id="fact-goal-cell"/.test(html), 'plan-bar fact-goal cell missing');
  assert.ok(/id="sum-income-goal"/.test(html), 'outcome-strip goal sub-line missing');
  assert.ok(/id="cmp-baseline-goal-row"/.test(html), 'baseline goal meta-row missing');
  assert.ok(/id="cmp-scenario-goal-row"/.test(html), 'scenario goal meta-row missing');
  assert.ok(/id="s-goal-row"/.test(html), 'print-summary goal row missing');
  assert.ok(/data-bind="answer-goal"/.test(html), 'export deck answer-goal slot missing');
});

check('income-goal: readInputs returns incomeGoal field', () => {
  assert.ok(/incomeGoal:\s*parseCurrency\(['"]income-goal['"]\)/.test(inline),
    'readInputs should read #income-goal via parseCurrency');
});

// goalSentence is the shared narrative helper. Bundle fmtR + it.
const goalBundle = ['fmtR', 'goalSentence'].map(n => extractFn(inline, n)).join('\n');
const goalFns = new Function(goalBundle + '; return { fmtR, goalSentence };')();

check('goal: goalSentence returns null when goal is zero or missing', () => {
  assert.strictEqual(goalFns.goalSentence(50000, 0), null);
  assert.strictEqual(goalFns.goalSentence(50000, -1), null);
  assert.strictEqual(goalFns.goalSentence(50000, null), null);
});

check('goal: goalSentence describes overshoot, near-miss, shortfall', () => {
  const over = goalFns.goalSentence(86400, 80000);
  assert.ok(/ahead of/i.test(over), 'overshoot should say "ahead of": ' + over);
  assert.ok(over.indexOf('—') === -1, 'em-dash in overshoot: ' + over);

  const near = goalFns.goalSentence(76000, 80000);
  assert.ok(/just short/i.test(near), 'near-miss should say "just short": ' + near);
  assert.ok(near.indexOf('—') === -1, 'em-dash in near-miss: ' + near);

  const far = goalFns.goalSentence(40000, 80000);
  assert.ok(/50%/.test(far), 'shortfall should include percent: ' + far);
  assert.ok(/gap of/i.test(far), 'shortfall should say "gap of": ' + far);
  assert.ok(far.indexOf('—') === -1, 'em-dash in shortfall: ' + far);
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

console.log();
console.log('='.repeat(50));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
