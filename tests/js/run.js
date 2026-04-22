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


console.log();
console.log('='.repeat(50));
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
