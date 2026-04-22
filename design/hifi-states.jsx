/* global React, HiFiChart, Field, Slider */

// Three canvas states: empty, filled-single, baseline+scenario (compare)
// All states work WITHOUT a left rail — inputs live in a top "Plan inputs"
// summary bar that can expand into an edit drawer.

// ─── Shared: Plan inputs top bar ──────────────────────────────
const PlanInputs = ({ empty = false, editing = false }) => {
  const [open, setOpen] = React.useState(editing);
  return (
    <div className={`plan-bar ${open ? 'open' : ''} ${empty ? 'empty' : ''}`}>
      <div className="plan-bar-row">
        <div className="plan-bar-logo">
          <span className="logo-mark">SW</span>
          <div>
            <div className="plan-bar-brand">Simple Wealth</div>
            <div className="plan-bar-for">
              {empty ? <span style={{ color: 'var(--mute)', fontStyle: 'italic' }}>Client name</span>
                     : <span>M. &amp; J. Pillay</span>}
            </div>
          </div>
        </div>

        <div className="plan-bar-facts">
          <div className="fact">
            <span className="fact-label">Household</span>
            <span className="fact-val">{empty ? '— / —' : '2 spouses · age 40'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Combined starting capital</span>
            <span className="fact-val num">{empty ? 'R —' : 'R 3.5m'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Monthly contributions</span>
            <span className="fact-val num">{empty ? 'R —' : 'R 20 000'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Retire at</span>
            <span className="fact-val">{empty ? '—' : 'age 65'}</span>
          </div>
          <div className="fact">
            <span className="fact-label">Return · CPI</span>
            <span className="fact-val num">10% · 5%</span>
          </div>
        </div>

        <button className="btn ghost plan-bar-edit" onClick={() => setOpen(v => !v)}>
          {open ? 'Close ↑' : 'Edit plan ↓'}
        </button>
      </div>

      {open && (
        <div className="plan-bar-drawer">
          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">I.</span> Household
              <span className="plan-drawer-meta">
                <span className={`dot ${empty ? 'incomplete' : ''}`} />
                {empty ? '0 / 2' : '2 / 2'}
              </span>
            </div>
            <div className="spouse-mini">
              <div className="spouse-mini-name">Spouse A <span>age {empty ? '—' : '40'}</span></div>
              <Field label="Retirement balance" value={empty ? '' : '1 500 000'} empty={empty} />
              <Field label="Monthly retirement" value={empty ? '' : '8 000'} empty={empty} />
            </div>
            <div className="spouse-mini">
              <div className="spouse-mini-name">Spouse B <span>age {empty ? '—' : '40'}</span></div>
              <Field label="Retirement balance" value={empty ? '' : '1 200 000'} empty={empty} />
              <Field label="Monthly retirement" value={empty ? '' : '7 000'} empty={empty} />
            </div>
          </div>

          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">II.</span> Retirement
              <span className="plan-drawer-meta">
                <span className={`dot ${empty ? 'incomplete' : ''}`} />
                {empty ? 'pick age' : 'age 65'}
              </span>
            </div>
            <div className="anchor">
              <div className="anchor-age">
                <span>When the</span>
                <div className="seg"><span className="on">youngest</span><span>oldest</span></div>
                <span>reaches</span>
                <input defaultValue="65" />
              </div>
            </div>
            <div className="plan-drawer-head" style={{ marginTop: 18 }}>
              <span className="rom">IV.</span> Capital events
              <span className="plan-drawer-meta">none</span>
            </div>
            <button className="add-btn">＋ Add an event</button>
          </div>

          <div className="plan-drawer-col">
            <div className="plan-drawer-head">
              <span className="rom">III.</span> Market assumptions
              <span className="plan-drawer-meta"><span className="dot" /> defaults</span>
            </div>
            <Slider label="Expected return (nominal)" value="10.00%" fill={0.58} />
            <Slider label="Inflation (CPI)" value="5.00%" fill={0.37} />
            <Slider label="Contribution escalation" value="6.00%" fill={0.50} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── State 1: EMPTY (setup / title page) ───────────────
// Elegant, simple setup flow. No busy plan-bar drawer — just the three
// names up top, then balances & contributions collected in a quiet
// two-column layout. Preview sits muted at the bottom.
const CanvasEmpty = () => (
  <main className="canvas canvas-norail canvas-empty">
    <div className="empty-titleplate">
      <div className="empty-eyebrow">Simple Wealth · Retirement projection</div>
      <h1 className="empty-title">
        A plan for <span className="empty-family" contentEditable suppressContentEditableWarning>the _______ family</span>.
      </h1>
      <div className="empty-date">Prepared 22 April 2026</div>
    </div>

    <div className="empty-setup">
      <div className="empty-setup-col">
        <div className="empty-step-label"><span className="rom">I.</span> Spouse A</div>
        <div className="empty-name-input">
          <input placeholder="First name" defaultValue="" />
          <span className="empty-age">age <input defaultValue="" placeholder="—" /></span>
        </div>
        <Field label="Retirement balance" empty />
        <Field label="Discretionary balance" empty />
        <Field label="Monthly retirement" empty />
        <Field label="Monthly discretionary" empty />
      </div>

      <div className="empty-setup-divider" />

      <div className="empty-setup-col">
        <div className="empty-step-label"><span className="rom">II.</span> Spouse B</div>
        <div className="empty-name-input">
          <input placeholder="First name" defaultValue="" />
          <span className="empty-age">age <input defaultValue="" placeholder="—" /></span>
        </div>
        <Field label="Retirement balance" empty />
        <Field label="Discretionary balance" empty />
        <Field label="Monthly retirement" empty />
        <Field label="Monthly discretionary" empty />
      </div>
    </div>

    <div className="empty-foot">
      <div className="empty-foot-left">
        <div className="empty-foot-eyebrow">Retire when the youngest reaches</div>
        <div className="empty-foot-value">
          <input defaultValue="65" className="empty-age-input" />
          <span className="empty-foot-hint">default · adjust later</span>
        </div>
      </div>
      <div className="empty-foot-right">
        <div className="empty-foot-eyebrow">Market assumptions</div>
        <div className="empty-foot-value">
          <span className="num">10%</span><span className="empty-dot">·</span>
          <span className="num">5%</span><span className="empty-dot">·</span>
          <span className="num">6%</span>
          <span className="empty-foot-hint">return · CPI · escalation</span>
        </div>
      </div>
    </div>

    <div className="empty-preview">
      <span className="empty-preview-label">The projection will appear here</span>
    </div>
  </main>
);

// ─── State 2: FILLED, no baseline locked ───
const CanvasFilled = () => (
  <main className="canvas canvas-norail">
    <PlanInputs />

    <div className="canvas-head" style={{ marginTop: 24 }}>
      <div>
        <div className="canvas-head-eyebrow">Projected outcome at retirement</div>
        <h1 className="headline">
          At 65, <span className="gold-under"><span className="num">R 48 200</span></span> a month —<br/>
          <em>comfortably</em>, at today's prices.
        </h1>
        <p className="headline-sub">
          The household reaches retirement with R 11.6m in combined capital,
          supporting a 5% drawdown before tax.
        </p>
      </div>
      <div className="canvas-actions">
        <div className="seg mini">
          <span className="on">Real</span><span>Nominal</span>
        </div>
        <button className="btn primary">Lock as baseline →</button>
      </div>
    </div>

    <div className="chart-card">
      <div className="chart-card-head">
        <div className="chart-legend">
          <span className="k"><span className="sw" style={{ background: 'var(--navy)' }} /> Retirement fund</span>
          <span className="k"><span className="sw" style={{ background: 'var(--gold)' }} /> Discretionary</span>
        </div>
        <div className="seg mini">
          <span className="on">Capital</span><span>Breakdown</span><span>Table</span>
        </div>
      </div>
      <HiFiChart height={280} bars={26} peakIdx={25} />
      <div style={{ height: 22 }} />
    </div>

    <div className="outcome-strip">
      <div className="outcome-cell primary">
        <div className="ocap">Monthly income</div>
        <div className="oval num">R 48 200</div>
        <div className="osub">today's money · before tax</div>
      </div>
      <div className="outcome-cell">
        <div className="ocap">Household capital</div>
        <div className="oval num">R 11.6m</div>
        <div className="osub">at age 65 · today's money</div>
      </div>
      <div className="outcome-cell">
        <div className="ocap">Years to retirement</div>
        <div className="oval num">25</div>
        <div className="osub">retiring in 2051</div>
      </div>
    </div>

    <div className="narrative">
      <div className="narrative-eyebrow">In plain terms</div>
      <div className="narrative-body">
        <p>
          On your current course, the household reaches retirement with roughly <strong>R 11.6m</strong> in
          today's money — enough to support about <strong>R 48 200</strong> per month at a 5% draw.
        </p>
        <p>
          Contributions drive most of the gain in the first decade; compounding does the heavy
          lifting in the last. If markets return 8% instead of 10%, the monthly figure would settle
          closer to <strong>R 36 400</strong>.
        </p>
      </div>
    </div>

    <div className="canvas-foot">
      <span>Illustrative only · assumes monthly contributions escalate at 6% p.a.</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn ghost">Table view</button>
        <button className="btn">Print / PDF</button>
      </div>
    </div>
  </main>
);

// ─── State 3: BASELINE locked — F layout, full width ───
const CanvasCompare = () => (
  <main className="canvas canvas-norail canvas-compare">
    <PlanInputs />

    <div className="canvas-head compact" style={{ marginTop: 24 }}>
      <div>
        <div className="canvas-head-eyebrow">Scenario compare · baseline locked</div>
        <h1 className="headline" style={{ fontSize: 42, lineHeight: 1.08 }}>
          What if we <span className="gold-under"><span className="num">contributed R 5 000 more</span></span>?
        </h1>
      </div>
      <div className="canvas-actions">
        <div className="seg mini">
          <span className="on">Real</span><span>Nominal</span>
        </div>
        <button className="btn ghost">Clear baseline</button>
        <button className="btn primary">Re-lock as new baseline</button>
      </div>
    </div>

    <div className="compare big">
      <div className="compare-card baseline">
        <div className="compare-card-head">
          <span className="compare-tag">Baseline · current plan</span>
          <span style={{ fontSize: 10, color: 'var(--mute)', letterSpacing: 1.2, textTransform: 'uppercase' }}>locked</span>
        </div>
        <div className="compare-val num">R 48 200</div>
        <div className="compare-sub">monthly income · R 11.6m capital</div>
        <div style={{ margin: '18px -4px 14px' }}>
          <HiFiChart height={280} bars={26} faded />
        </div>
        <div className="compare-meta">
          <div className="row"><span>Retirement contrib.</span><span>R 15 000</span></div>
          <div className="row"><span>Discretionary contrib.</span><span>R 5 000</span></div>
          <div className="row"><span>Expected return</span><span>10.00%</span></div>
          <div className="row"><span>Retire at</span><span>age 65</span></div>
        </div>
      </div>

      <div className="compare-card scenario">
        <div className="compare-card-head">
          <span className="compare-tag">Planned scenario</span>
          <span className="delta-chip pos">+ R 11 400 / mo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div className="compare-val num">R 59 600</div>
        </div>
        <div className="compare-sub">monthly income · R 14.3m capital</div>
        <div style={{ margin: '18px -4px 14px' }}>
          <HiFiChart height={280} bars={26} peakIdx={25} />
        </div>
        <div className="compare-meta">
          <div className="row"><span>Retirement contrib.</span><span>R 20 000 <em style={{ color: 'var(--gold-2)', fontStyle: 'normal' }}>+5k</em></span></div>
          <div className="row"><span>Discretionary contrib.</span><span>R 5 000</span></div>
          <div className="row"><span>Expected return</span><span>10.00%</span></div>
          <div className="row"><span>Retire at</span><span>age 65</span></div>
        </div>
      </div>
    </div>

    <div className="chart-legend" style={{ margin: '10px 0 20px', justifyContent: 'center' }}>
      <span className="k"><span className="sw" style={{ background: 'var(--navy)' }} /> Retirement fund</span>
      <span className="k"><span className="sw" style={{ background: 'var(--gold)' }} /> Discretionary</span>
    </div>

    <div className="scenario-levers">
      <div className="scenario-levers-head">
        <span className="scenario-levers-title">Scenario levers</span>
        <span className="scenario-levers-hint">centered on the locked baseline — nudge to explore</span>
      </div>
      <div className="scenario-grid">
        <Slider label="Retirement contributions" value="R 20 000" fill={0.65} delta="+R 5 000" />
        <Slider label="Discretionary contributions" value="R 5 000" fill={0.5} />
        <Slider label="Expected return" value="10.00%" fill={0.5} />
        <Slider label="Retirement age" value="65" fill={0.5} />
      </div>
    </div>
  </main>
);

Object.assign(window, { CanvasEmpty, CanvasFilled, CanvasCompare, PlanInputs });
