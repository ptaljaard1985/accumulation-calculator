/* Retirement Report · data-binding + rendering
 *
 * Reads live calculator state from:
 *   1. localStorage key 'sw-calc-snapshot' (written by the calculator)
 *   2. ?data=<base64 JSON> URL param (if the user deep-links)
 *   3. Falls back to an embedded sample so the deck always renders.
 *
 * The snapshot is a plain JSON object with inputs, projection, baseline
 * (if locked), and meta (family name, client name, date). We compute what
 * the calculator computes, re-using the same projection math so the deck
 * matches the tool exactly.
 */
(function(){
  // ─── Utilities ──────────────────────────────────────────
  function fmtR(n){
    if (!isFinite(n)) return 'R —';
    var abs = Math.abs(n);
    var rounded = Math.round(abs);
    var s = rounded.toLocaleString('en-ZA').replace(/,/g, ' ');
    return (n < 0 ? '− R' : 'R ') + s;
  }
  function fmtRPlain(n){
    if (!isFinite(n)) return '—';
    return Math.round(Math.abs(n)).toLocaleString('en-ZA').replace(/,/g, ' ');
  }
  function fmtShort(n){
    if (!isFinite(n)) return 'R —';
    var abs = Math.abs(n);
    var sign = n < 0 ? '−' : '';
    if (abs >= 1e6) return sign + 'R ' + (abs / 1e6).toFixed(abs >= 10e6 ? 1 : 2) + 'M';
    if (abs >= 1e3) return sign + 'R ' + Math.round(abs / 1e3) + 'k';
    return sign + 'R ' + Math.round(abs);
  }
  function fmtPct(n){
    if (!isFinite(n)) return '—';
    return n.toFixed(2) + '%';
  }
  function set(field, html){
    document.querySelectorAll('[data-field="' + field + '"]').forEach(function(el){
      el.innerHTML = html;
    });
  }
  function setText(field, txt){
    document.querySelectorAll('[data-field="' + field + '"]').forEach(function(el){
      el.textContent = txt;
    });
  }

  // ─── Projection math (mirrors calculator) ───────────────
  function project(inputs){
    var ageA = inputs.ageA, ageB = inputs.ageB;
    var youngest = Math.min(ageA, ageB);
    var oldest = Math.max(ageA, ageB);
    var refAge = inputs.anchor === 'youngest' ? youngest : oldest;
    var years = Math.max(1, inputs.retirementAge - refAge);

    var rMonth = Math.pow(1 + inputs.rNom, 1/12) - 1;
    var retA = inputs.retA, retB = inputs.retB;
    var discA = inputs.discA, discB = inputs.discB;
    var cRetA = inputs.contribRetA, cRetB = inputs.contribRetB;
    var cDiscA = inputs.contribDiscA, cDiscB = inputs.contribDiscB;

    var startBalance = retA + retB + discA + discB;
    var sbRun = startBalance;

    var labels = ['Age ' + refAge];
    var ageAS = [ageA], ageBS = [ageB];
    var retS = [retA + retB], discS = [discA + discB];
    var totS = [retA + retB + discA + discB];
    var cumC = [0], sbS = [startBalance];
    var running = 0;

    for (var y = 1; y <= years; y++){
      for (var m = 0; m < 12; m++){
        retA = retA * (1 + rMonth) + cRetA;
        retB = retB * (1 + rMonth) + cRetB;
        discA = discA * (1 + rMonth) + cDiscA;
        discB = discB * (1 + rMonth) + cDiscB;
        sbRun *= (1 + rMonth);
        running += cRetA + cRetB + cDiscA + cDiscB;
      }
      cRetA *= (1 + inputs.esc); cRetB *= (1 + inputs.esc);
      cDiscA *= (1 + inputs.esc); cDiscB *= (1 + inputs.esc);
      labels.push('Age ' + (refAge + y));
      ageAS.push(ageA + y); ageBS.push(ageB + y);
      retS.push(retA + retB); discS.push(discA + discB);
      totS.push(retA + retB + discA + discB);
      cumC.push(running); sbS.push(sbRun);
    }

    function deflate(arr){
      return arr.map(function(v, i){ return v / Math.pow(1 + inputs.cpi, i); });
    }
    var retR = deflate(retS), discR = deflate(discS), totR = deflate(totS);
    var cumCR = deflate(cumC), sbR = deflate(sbS);

    var brR = { initial: [], contribs: [], growth: [] };
    var brN = { initial: [], contribs: [], growth: [] };
    for (var i = 0; i < totR.length; i++){
      brR.initial.push(sbR[i]);
      brR.contribs.push(cumCR[i]);
      brR.growth.push(Math.max(0, totR[i] - sbR[i] - cumCR[i]));
      brN.initial.push(sbS[i]);
      brN.contribs.push(cumC[i]);
      brN.growth.push(Math.max(0, totS[i] - sbS[i] - cumC[i]));
    }

    return {
      inputs: inputs, years: years, refAge: refAge,
      retirementAge: inputs.retirementAge,
      retirementYearCalendar: new Date().getFullYear() + years,
      labels: labels,
      ageA: ageAS, ageB: ageBS,
      nominal: { ret: retS, disc: discS, total: totS, cumulContribs: cumC, startBalance: sbS, breakdown: brN },
      real:    { ret: retR, disc: discR, total: totR, cumulContribs: cumCR, startBalance: sbR, breakdown: brR },
      finalTotalReal: totR[totR.length - 1],
      finalTotalNom:  totS[totS.length - 1],
      monthlyIncomeReal: totR[totR.length - 1] * 0.05 / 12,
      totalContribs: cumC[cumC.length - 1]
    };
  }

  // ─── Sample fallback ────────────────────────────────────
  var SAMPLE = {
    meta: {
      familyName: 'Nkosi',
      clientName: 'Thabo & Amara Nkosi',
      spouseNameA: 'Thabo',
      spouseNameB: 'Amara',
      preparedDate: '23 April 2026',
      adviser: 'Simple Wealth (Pty) Ltd'
    },
    inputs: {
      ageA: 40, ageB: 40,
      retA: 1500000, retB: 1200000,
      discA: 500000, discB: 300000,
      contribRetA: 8000, contribRetB: 7000,
      contribDiscA: 3000, contribDiscB: 2000,
      rNom: 0.09, cpi: 0.05, esc: 0.05,
      anchor: 'youngest', retirementAge: 65,
      events: [
        { age: 50, kind: 'inflow',  amount:  800000, description: 'Inheritance',        note: 'Added to the discretionary portfolio and left to compound to retirement.' },
        { age: 55, kind: 'outflow', amount:  450000, description: 'Children\u2019s tuition', note: 'Drawn once from the discretionary portfolio to fund education costs.' },
        { age: 62, kind: 'inflow',  amount: 1200000, description: 'Property downsize',  note: 'Net proceeds from moving to a smaller home, added to the discretionary pool.' }
      ]
    },
    baseline: null
  };

  function getSnapshot(){
    // URL ?data=base64
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('data')){
      try { return JSON.parse(atob(qs.get('data'))); } catch(e){}
    }
    // localStorage
    try {
      var raw = localStorage.getItem('sw-calc-snapshot');
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return SAMPLE;
  }

  var snap = getSnapshot();
  var meta = snap.meta || SAMPLE.meta;
  var inputs = snap.inputs || SAMPLE.inputs;
  var p = project(inputs);
  var baseline = null;
  if (snap.baseline && snap.baseline.inputs){
    baseline = { inputs: snap.baseline.inputs, p: project(snap.baseline.inputs) };
  }

  // Determine total slide count (compare + events slides conditional)
  var compareSlide = document.querySelector('[data-slide="compare"]');
  var eventsSlide  = document.querySelector('[data-slide="events"]');
  var hasEvents    = !!(inputs.events && inputs.events.length > 0);
  if (!baseline  && compareSlide){ compareSlide.remove(); }
  if (!hasEvents && eventsSlide ){ eventsSlide.remove();  }
  var totalSlides = document.querySelectorAll('deck-stage > section.slide').length;

  // Renumber pagination: for each remaining slide, rewrite the footer
  // "<rom>NN</rom> &nbsp; NN / TT" block so both the Roman numeral and
  // the page index reflect post-removal DOM position.
  (function renumberPages(){
    var roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII',
                 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
    var slides = document.querySelectorAll('deck-stage > section.slide');
    slides.forEach(function(sl, idx){
      if (idx === 0) return; // cover has no pagination
      var n = String(idx + 1).padStart(2, '0');
      var r = roman[idx + 1] || (idx + 1);

      // Rewrite the footer's right-hand span (pagination)
      var foot = sl.querySelector('.slide-foot span:last-child');
      if (foot){
        foot.innerHTML = '<span class="rom">' + r + '.</span> &nbsp; ' + n + ' / ' + totalSlides;
      }

      // Also update the eyebrow's leading Roman numeral (slide header)
      var eyebrowRom = sl.querySelector('.eyebrow .rom');
      if (eyebrowRom){
        eyebrowRom.textContent = r + '.';
      }
    });
  })();
  // Simpler: just set all total-slides-N fields
  for (var i = 2; i <= 11; i++){
    var f = 'total-slides' + (i === 2 ? '' : '-' + i);
    set(f, totalSlides);
  }

  // ─── Cover + topbars ────────────────────────────────────
  setText('family-name', meta.familyName || '——');
  setText('client-name', meta.clientName || '——');
  setText('prepared-date', meta.preparedDate || '——');
  setText('compliance-date', meta.preparedDate || '——');
  setText('closing-date', meta.preparedDate || '——');

  var familyLabel = meta.familyName ? 'the ' + meta.familyName + ' family' : 'the — family';
  for (var k = 0; k <= 11; k++){
    var suffix = k === 0 ? '' : '-' + k;
    setText('topbar-family' + suffix, familyLabel);
    setText('topbar-date' + suffix, meta.preparedDate || '——');
  }
  setText('topbar-family-ev', familyLabel);
  setText('topbar-date-ev', meta.preparedDate || '——');

  // ─── Slide 2 · Answer ───────────────────────────────────
  set('answer-age', p.retirementAge);
  set('answer-income', fmtR(p.monthlyIncomeReal));

  var hhMonthly = inputs.contribRetA + inputs.contribRetB + inputs.contribDiscA + inputs.contribDiscB;
  var narrative = [];
  narrative.push('<p>At a <strong>' + fmtPct(inputs.rNom * 100) + '</strong> nominal return and <strong>' +
    fmtPct(inputs.cpi * 100) + '</strong> inflation, with combined monthly contributions of <strong>' +
    fmtR(hhMonthly) + '</strong> escalating at ' + fmtPct(inputs.esc * 100) + ' per year, ' +
    'the household is projected to accumulate <strong>' + fmtR(p.finalTotalReal) + '</strong> in today\u2019s money by ' +
    p.retirementYearCalendar + '.</p>');
  narrative.push('<p>Drawn at 5% per year, that capital supports about <strong>' + fmtR(p.monthlyIncomeReal) +
    ' per month</strong>, in today\u2019s money and before tax.</p>');
  document.querySelector('[data-field="answer-narrative"]').innerHTML = narrative.join('');

  set('out-income', fmtR(p.monthlyIncomeReal));
  set('out-capital', fmtShort(p.finalTotalReal));
  set('out-capital-sub', 'today\u2019s money · ' + fmtShort(p.finalTotalNom) + ' nominal');
  set('out-years', p.years);
  set('out-years-sub', 'retiring in ' + p.retirementYearCalendar);

  // ─── Slide 3 · Household ────────────────────────────────
  set('spA-name', meta.spouseNameA || 'Spouse A');
  set('spB-name', meta.spouseNameB || 'Spouse B');
  set('spA-age', inputs.ageA);
  set('spB-age', inputs.ageB);
  set('spA-ret', fmtRPlain(inputs.retA));
  set('spA-disc', fmtRPlain(inputs.discA));
  set('spA-ret-c', fmtRPlain(inputs.contribRetA));
  set('spA-disc-c', fmtRPlain(inputs.contribDiscA));
  set('spA-total', fmtRPlain(inputs.retA + inputs.discA));
  set('spB-ret', fmtRPlain(inputs.retB));
  set('spB-disc', fmtRPlain(inputs.discB));
  set('spB-ret-c', fmtRPlain(inputs.contribRetB));
  set('spB-disc-c', fmtRPlain(inputs.contribDiscB));
  set('spB-total', fmtRPlain(inputs.retB + inputs.discB));

  // ─── Slide 4 · Assumptions ──────────────────────────────
  set('a-return', fmtPct(inputs.rNom * 100));
  set('a-cpi', fmtPct(inputs.cpi * 100));
  set('a-esc', fmtPct(inputs.esc * 100));
  set('a-retage', 'age ' + inputs.retirementAge);
  set('a-anchor-note', 'Anchored to the ' + (inputs.anchor === 'youngest' ? 'younger' : 'older') +
    ' spouse reaching age ' + inputs.retirementAge + '.');

  // ─── Slide 5 · Projection ───────────────────────────────
  set('p-start', fmtShort(inputs.retA + inputs.retB + inputs.discA + inputs.discB));
  set('p-end-real', fmtShort(p.finalTotalReal));
  set('p-end-real-sub', 'after ' + p.years + ' years · drawdown supports ' + fmtR(p.monthlyIncomeReal) + '/mo');
  set('p-end-nom', fmtShort(p.finalTotalNom));

  // ─── Slide 6 · Breakdown ────────────────────────────────
  var last = p.real.total.length - 1;
  set('br-initial', fmtShort(p.real.breakdown.initial[last]));
  set('br-contribs', fmtShort(p.real.breakdown.contribs[last]));
  set('br-growth', fmtShort(p.real.breakdown.growth[last]));

  // ─── Slide 7 · Capital events (if applicable) ──────────
  if (hasEvents && eventsSlide){
    var events = inputs.events.slice().sort(function(a, b){
      return (a.age || 0) - (b.age || 0);
    });
    var inflows  = events.filter(function(e){ return e.kind === 'inflow'; });
    var outflows = events.filter(function(e){ return e.kind === 'outflow'; });
    var inTotal  = inflows.reduce(function(s, e){ return s + (e.amount || 0); }, 0);
    var outTotal = outflows.reduce(function(s, e){ return s + (e.amount || 0); }, 0);
    var net      = inTotal - outTotal;

    set('ev-summary-count',
      '<span class="num">' + events.length + '</span> ' +
      (events.length === 1 ? 'event' : 'events') + ' modelled');
    set('ev-summary-sub',
      'Net ' + (net >= 0 ? '+ ' : '− ') + fmtR(Math.abs(net)) +
      ' over the horizon, in today\u2019s money.');
    set('ev-inflow-total',  (inflows.length  ? '+ ' : '') + fmtR(inTotal));
    set('ev-outflow-total', (outflows.length ? '− ' : '') + fmtR(outTotal));
    set('ev-inflow-sub',  inflows.length  + ' event' + (inflows.length  === 1 ? '' : 's'));
    set('ev-outflow-sub', outflows.length + ' event' + (outflows.length === 1 ? '' : 's'));

    // Timeline bounds: today (age of spouse A) → retirement (p.refAge + p.years)
    var tlStartAge = inputs.ageA;
    var tlEndAge   = p.refAge + p.years;
    var tlSpan     = Math.max(1, tlEndAge - tlStartAge);
    set('ev-tl-today',  'age ' + tlStartAge);
    set('ev-tl-retire', 'age ' + tlEndAge);

    // Event ages on the timeline could be spouse-A's age OR a year-offset;
    // treat `age` as spouse-A's age (the calculator's convention).
    var plot = document.getElementById('events-timeline-plot');
    if (plot){
      // Add year tick-marks every 5 years
      for (var t = 5; t < tlSpan; t += 5){
        var pct = (t / tlSpan) * 100;
        var tick = document.createElement('div');
        tick.className = 'timeline-tick';
        tick.style.left = pct + '%';
        plot.appendChild(tick);
        var tickLbl = document.createElement('div');
        tickLbl.className = 'timeline-tick-label';
        tickLbl.style.left = pct + '%';
        tickLbl.textContent = (tlStartAge + t);
        plot.appendChild(tickLbl);
      }

      // Events — alternate above/below to reduce label collisions
      events.forEach(function(e, i){
        var age = e.age != null ? e.age : tlStartAge;
        var rel = Math.max(0, Math.min(1, (age - tlStartAge) / tlSpan));
        var elx = document.createElement('div');
        elx.className = 'timeline-event ' + e.kind + ' ' + (i % 2 === 0 ? 'above' : 'below');
        elx.style.left = (rel * 100) + '%';
        var stemH = 44;
        elx.innerHTML =
          '<div class="stem" style="height: ' + stemH + 'px;"></div>' +
          '<div class="dot"></div>' +
          '<div class="lbl">' +
            '<span class="amt">' + (e.kind === 'inflow' ? '+ ' : '− ') + fmtShort(e.amount || 0) + '</span>' +
            '<span class="desc">' + (e.description || (e.kind === 'inflow' ? 'Inflow' : 'Outflow')) + '</span>' +
          '</div>';
        plot.appendChild(elx);
      });
    }

    // Event list (right column)
    var listBody = document.getElementById('events-list-body');
    if (listBody){
      var yearsFromNow = function(age){ return Math.max(0, age - inputs.ageA); };
      listBody.innerHTML = events.map(function(e){
        var age = e.age != null ? e.age : inputs.ageA;
        var yrs = yearsFromNow(age);
        var kindLbl = e.kind === 'inflow' ? 'Inflow' : 'Outflow';
        var sign = e.kind === 'inflow' ? '+ ' : '− ';
        var note = e.note || (e.kind === 'inflow'
          ? 'Added to the discretionary portfolio and left to compound to retirement.'
          : 'Drawn from the discretionary portfolio and not available to compound thereafter.');
        return (
          '<div class="row ' + e.kind + '">' +
            '<div class="age">age ' + age + '<em>year ' + yrs + '</em></div>' +
            '<div class="mid">' +
              '<div class="kind ' + e.kind + '">' + kindLbl + '</div>' +
              '<div class="desc">' + (e.description || kindLbl) + '</div>' +
              '<div class="note">' + note + '</div>' +
            '</div>' +
            '<div class="amt">' + sign + fmtR(e.amount || 0) + '</div>' +
          '</div>'
        );
      }).join('');
    }
  }

  // ─── Slide 8 · Compare (if applicable) ──────────────────
  if (baseline){
    var bp = baseline.p, bi = baseline.inputs;
    set('cmp-base-hero', fmtR(bp.monthlyIncomeReal));
    set('cmp-base-sub', 'monthly income · ' + fmtShort(bp.finalTotalReal) + ' capital');
    set('cmp-base-cret', fmtR(bi.contribRetA + bi.contribRetB) + '/mo');
    set('cmp-base-cdisc', fmtR(bi.contribDiscA + bi.contribDiscB) + '/mo');
    set('cmp-base-ret', fmtPct(bi.rNom * 100));
    set('cmp-base-age', 'age ' + bi.retirementAge);

    set('cmp-plan-hero', fmtR(p.monthlyIncomeReal));
    set('cmp-plan-sub', 'monthly income · ' + fmtShort(p.finalTotalReal) + ' capital');
    set('cmp-plan-cret', fmtR(inputs.contribRetA + inputs.contribRetB) + '/mo');
    set('cmp-plan-cdisc', fmtR(inputs.contribDiscA + inputs.contribDiscB) + '/mo');
    set('cmp-plan-ret', fmtPct(inputs.rNom * 100));
    set('cmp-plan-age', 'age ' + inputs.retirementAge);

    var dIncome = p.monthlyIncomeReal - bp.monthlyIncomeReal;
    var chip = document.querySelector('[data-field="cmp-chip"]');
    if (chip){
      chip.textContent = (dIncome >= 0 ? '+ ' : '− ') + fmtR(Math.abs(dIncome)) + ' / mo';
      chip.classList.toggle('neg', dIncome < 0);
    }

    function metaDelta(field, delta, kind, neg){
      var el = document.querySelector('[data-field="' + field + '"]');
      if (!el) return;
      var threshold = kind === 'pct' ? 0.01 : (kind === 'years' ? 0.5 : 1);
      if (Math.abs(delta) < threshold){ el.textContent = ''; return; }
      var sign = delta > 0 ? '+' : '−';
      var abs = Math.abs(delta);
      if (kind === 'currency') el.textContent = sign + fmtShort(abs).replace('R ', 'R');
      else if (kind === 'pct') el.textContent = sign + abs.toFixed(2) + '%';
      else el.textContent = sign + abs + 'y';
      if (neg) el.classList.add('neg');
    }
    metaDelta('cmp-plan-cret-d',
      (inputs.contribRetA + inputs.contribRetB) - (bi.contribRetA + bi.contribRetB), 'currency');
    metaDelta('cmp-plan-cdisc-d',
      (inputs.contribDiscA + inputs.contribDiscB) - (bi.contribDiscA + bi.contribDiscB), 'currency');
    metaDelta('cmp-plan-ret-d', (inputs.rNom - bi.rNom) * 100, 'pct');
    metaDelta('cmp-plan-age-d', inputs.retirementAge - bi.retirementAge, 'years');
  }

  // ─── Slide 8 · Year-by-year table (every 5th + milestones) ─
  var tbody = document.getElementById('year-table-body');
  if (tbody){
    var rows = [];
    for (var y = 0; y < p.labels.length; y++){
      var age = p.refAge + y;
      var isFirst = y === 0;
      var isLast = y === p.labels.length - 1;
      var isMilestone = (age % 5 === 0);
      if (!isFirst && !isLast && !isMilestone) continue;
      var cls = isLast ? 'retire' : (isMilestone && !isFirst ? 'milestone' : '');
      var yearLabel = isFirst ? 'Today · Y0' :
                      isLast ? 'Retirement · Y' + y :
                      'Age ' + age + ' · Y' + y;
      rows.push(
        '<tr class="' + cls + '">' +
          '<td>' + yearLabel + '</td>' +
          '<td>' + p.ageA[y] + '</td>' +
          '<td>' + p.ageB[y] + '</td>' +
          '<td>' + fmtShort(p.nominal.ret[y]) + '</td>' +
          '<td>' + fmtShort(p.nominal.disc[y]) + '</td>' +
          '<td>' + fmtShort(p.nominal.total[y]) + '</td>' +
          '<td>' + fmtShort(p.real.total[y]) + '</td>' +
        '</tr>'
      );
    }
    tbody.innerHTML = rows.join('');
  }

  // ─── Slide 9 · Methodology · events note ───────────────
  if (inputs.events && inputs.events.length > 0){
    var nIn = 0, nOut = 0;
    inputs.events.forEach(function(e){ if (e.kind === 'inflow') nIn++; else nOut++; });
    var parts = [];
    if (nIn) parts.push(nIn + ' inflow' + (nIn > 1 ? 's' : ''));
    if (nOut) parts.push(nOut + ' outflow' + (nOut > 1 ? 's' : ''));
    set('m-events', 'This projection applies ' + parts.join(' and ') +
      ' to the discretionary portfolio at the specified ages. Events are applied at year-end and do not affect the retirement-fund pool.');
  }

  // ─── Charts ─────────────────────────────────────────────
  Chart.defaults.font.family = "'Inter Tight', sans-serif";
  Chart.defaults.color = '#7a8292';

  function stackedCapitalChart(canvasId, labels, retData, discData, opts){
    opts = opts || {};
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var opacity = opts.opacity != null ? opts.opacity : 1;
    new Chart(ctx, {
      data: {
        labels: labels,
        datasets: [
          { label: 'Discretionary', data: discData,
            backgroundColor: 'rgba(184, 137, 60, ' + (0.92 * opacity) + ')',
            borderWidth: 0, type: 'bar', stack: 'cap' },
          { label: 'Retirement', data: retData,
            backgroundColor: 'rgba(31, 45, 61, ' + (0.92 * opacity) + ')',
            borderWidth: 0, type: 'bar', stack: 'cap' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c){ return c.dataset.label + ': ' + fmtShort(c.parsed.y); } } }
        },
        scales: {
          y: { stacked: true, beginAtZero: true,
            max: opts.yMax,
            ticks: { callback: function(v){ return fmtShort(v); }, font: { size: opts.tickSize || 13 } },
            grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { stacked: true,
            ticks: { font: { size: opts.tickSize || 13 }, maxTicksLimit: opts.maxXTicks || 10 },
            grid: { display: false } }
        }
      }
    });
  }

  function breakdownChart(canvasId, labels, series){
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    new Chart(ctx, {
      data: {
        labels: labels,
        datasets: [
          { label: 'Starting capital, compounded', data: series.initial,
            backgroundColor: 'rgba(154, 160, 169, 0.85)', borderWidth: 0, type: 'bar', stack: 'b' },
          { label: 'Cumulative contributions', data: series.contribs,
            backgroundColor: 'rgba(94, 100, 112, 0.88)', borderWidth: 0, type: 'bar', stack: 'b' },
          { label: 'Growth on contributions', data: series.growth,
            backgroundColor: 'rgba(184, 137, 60, 0.9)', borderWidth: 0, type: 'bar', stack: 'b' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function(c){ return c.dataset.label + ': ' + fmtShort(c.parsed.y); } } }
        },
        scales: {
          y: { stacked: true, beginAtZero: true,
            ticks: { callback: function(v){ return fmtShort(v); }, font: { size: 13 } },
            grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { stacked: true,
            ticks: { font: { size: 13 }, maxTicksLimit: 10 },
            grid: { display: false } }
        }
      }
    });
  }

  // Wait for fonts + next frame to ensure canvas is sized
  requestAnimationFrame(function(){
    // Slide 2 — real capital build
    stackedCapitalChart('chart-answer', p.labels, p.real.ret, p.real.disc, { tickSize: 11, maxXTicks: 8 });
    // Slide 5 — nominal full build
    stackedCapitalChart('chart-projection', p.labels, p.nominal.ret, p.nominal.disc, { tickSize: 14 });
    // Slide 6 — breakdown
    breakdownChart('chart-breakdown', p.labels, p.real.breakdown);

    // Slide 7 — compare charts (if baseline)
    if (baseline){
      var bp = baseline.p;
      var bMax = Math.max.apply(null, bp.real.total);
      var pMax = Math.max.apply(null, p.real.total);
      var shared = Math.max(bMax, pMax) * 1.05;
      stackedCapitalChart('chart-cmp-base', bp.labels, bp.real.ret, bp.real.disc, { opacity: 0.5, yMax: shared, tickSize: 11, maxXTicks: 6 });
      stackedCapitalChart('chart-cmp-plan', p.labels, p.real.ret, p.real.disc, { opacity: 1, yMax: shared, tickSize: 11, maxXTicks: 6 });
    }
  });
})();
