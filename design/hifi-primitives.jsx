/* global React */
// Chart + shared primitives for hi-fi mock

// Stacked bar chart with optional baseline overlay (dashed line) — SVG, styled.
const HiFiChart = ({ height = 220, bars = 26, mode = 'single', peakIdx, showBaseline = false, faded = false }) => {
  const data = React.useMemo(() => {
    const out = [];
    for (let i = 0; i < bars; i++) {
      const t = i / (bars - 1);
      // gentle curve so compounding accelerates late
      const curve = Math.pow(t, 1.35);
      const retire = 15 + curve * 82 + Math.sin(i * 0.8) * 1.2;
      const disc   = 7  + curve * 26 + Math.cos(i * 0.6) * 0.8;
      out.push({ retire, disc });
    }
    return out;
  }, [bars]);

  const baseline = React.useMemo(() => {
    // lower trajectory for baseline
    return data.map(d => ({ retire: d.retire * 0.85, disc: d.disc * 0.82 }));
  }, [data]);

  const max = Math.max(...data.map(d => d.retire + d.disc)) * 1.08;
  const W = 100, H = 100;
  const padL = 0, padR = 0, padB = 0, padT = 2;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const barW = innerW / bars;
  const gap = barW * 0.15;
  const bw = barW - gap;

  return (
    <div style={{ display: 'flex', height, width: '100%' }}>
      {/* Y axis */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)', paddingRight: 8,
        textAlign: 'right', width: 38, paddingTop: 4, paddingBottom: 4 }}>
        {[1, 0.75, 0.5, 0.25, 0].map(p => (
          <span key={p}>R{((max * p) / 10).toFixed(1)}m</span>
        ))}
      </div>

      {/* Plot area */}
      <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        {/* Gridlines */}
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {[0.25, 0.5, 0.75].map(p => (
            <line key={p} x1="0" x2={W} y1={padT + innerH * p} y2={padT + innerH * p} stroke="var(--hairline)" strokeWidth="0.15" />
          ))}

          {/* Bars */}
          {data.map((d, i) => {
            const x = padL + i * barW + gap/2;
            const totalH = ((d.retire + d.disc) / max) * innerH;
            const retireH = (d.retire / max) * innerH;
            const discH = (d.disc / max) * innerH;
            const yTop = padT + innerH - totalH;
            const opacity = faded ? 0.35 : 1;
            return (
              <g key={i} opacity={opacity}>
                <rect x={x} y={yTop} width={bw} height={discH} fill="var(--gold)" />
                <rect x={x} y={yTop + discH} width={bw} height={retireH} fill="var(--navy)" />
              </g>
            );
          })}

          {/* Baseline dashed overlay */}
          {showBaseline && (
            <polyline
              points={baseline.map((d, i) => {
                const x = padL + i * barW + barW/2;
                const y = padT + innerH - ((d.retire + d.disc) / max) * innerH;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="var(--ink-2)"
              strokeWidth="0.5"
              strokeDasharray="1.5 1.2"
              opacity="0.7"
            />
          )}

          {/* Peak marker */}
          {peakIdx != null && (
            <g>
              {(() => {
                const x = padL + peakIdx * barW + barW/2;
                const d = data[peakIdx];
                const y = padT + innerH - ((d.retire + d.disc) / max) * innerH;
                return (
                  <>
                    <line x1={x} x2={x} y1={y - 3} y2={y - 1} stroke="var(--gold-2)" strokeWidth="0.4" />
                    <circle cx={x} cy={y - 1} r="0.6" fill="var(--gold-2)" />
                  </>
                );
              })()}
            </g>
          )}
        </svg>

        {/* Peak label */}
        {peakIdx != null && (
          <div style={{
            position: 'absolute',
            left: `${((peakIdx + 0.5) / bars) * 100}%`,
            top: 4,
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: 'var(--gold-2)',
            fontFamily: 'var(--sans)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            letterSpacing: 0.3,
          }}>retirement</div>
        )}

        {/* X axis labels */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -20,
          display: 'flex', justifyContent: 'space-between',
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--mute)' }}>
          {[0, 5, 10, 15, 20, 25].map(y => (
            <span key={y}>age {40 + y}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Field — label + input (pill)
const Field = ({ label, prefix = 'R', value, empty = false, hint }) => (
  <div className="field">
    <div className="field-label">
      <span>{label}</span>
      {hint && <span className="muted">{hint}</span>}
    </div>
    <div className={`field-input ${empty ? 'empty' : ''}`}>
      {prefix && <span className="pfx">{prefix}</span>}
      <input defaultValue={value} placeholder={empty ? '—' : ''} />
    </div>
  </div>
);

const Slider = ({ label, value, fill = 0.5, delta }) => (
  <div className="slider">
    <div className="slider-head">
      <span className="slider-label">{label}</span>
      <span className="slider-value">
        {value}
        {delta && <span className={`delta ${delta.startsWith('-') ? 'neg' : ''}`}>{delta}</span>}
      </span>
    </div>
    <div className="slider-rail" style={{ '--fill': `${fill * 100}%` }}>
      <div className="slider-thumb" />
    </div>
  </div>
);

const RailSection = ({ num, title, meta, complete = true, children }) => (
  <div className="rail-section">
    <div className="rail-section-head">
      <div>
        <span className="rail-section-num">{num}</span>
        <span className="rail-section-title">{title}</span>
      </div>
      {meta != null && (
        <span className="rail-section-meta">
          <span className={`dot ${complete ? '' : 'incomplete'}`} />
          {meta}
        </span>
      )}
    </div>
    <div className="rail-section-body">{children}</div>
  </div>
);

// Entire left rail — accepts a mode flag so we can show 'empty' state
const LeftRail = ({ state = 'filled', defaultCollapsed = false }) => {
  const empty = state === 'empty';
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  if (collapsed) {
    return (
      <aside className="rail rail-collapsed">
        <button className="rail-expand" onClick={() => setCollapsed(false)} title="Show inputs">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M5 3l4 4-4 4"/></svg>
        </button>
        <div className="rail-collapsed-logo">SW</div>
        <div className="rail-collapsed-stack">
          {[
            { n: 'I', t: 'Household', ok: !empty },
            { n: 'II', t: 'Retirement', ok: !empty },
            { n: 'III', t: 'Markets', ok: true },
            { n: 'IV', t: 'Events', ok: true },
          ].map(s => (
            <div key={s.n} className="rail-collapsed-row" onClick={() => setCollapsed(false)}>
              <span className="rail-collapsed-num">{s.n}.</span>
              <span className={`dot ${s.ok ? '' : 'incomplete'}`} />
              <span className="rail-collapsed-label">{s.t}</span>
            </div>
          ))}
        </div>
        <div className="rail-collapsed-foot">
          <div className="rail-collapsed-client">M. & J. Pillay</div>
          <div className="rail-collapsed-date">22 Apr 26</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="rail">
      <div className="rail-head">
        <div className="logo">
          <span className="logo-mark">SW</span>
          <span>Simple Wealth</span>
        </div>
        <button className="rail-collapse" onClick={() => setCollapsed(true)} title="Minimise inputs">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M9 3l-4 4 4 4"/></svg>
        </button>
        <div className="rail-sub">Retirement projection</div>
      </div>

      <div className="rail-body">
        <RailSection num="I." title="Household" meta={empty ? '0 / 2' : '40 / 40'} complete={!empty}>
          <div className="spouse-group">
            <div className="spouse-head">
              <span className="spouse-name" contentEditable suppressContentEditableWarning>Spouse A</span>
              <span className="spouse-age">age <input defaultValue={empty ? '' : '40'} placeholder="—" /></span>
            </div>
            <Field label="Retirement balance" value={empty ? '' : '1 500 000'} empty={empty} />
            <Field label="Discretionary balance" value={empty ? '' : '500 000'} empty={empty} />
            <Field label="Monthly retirement" value={empty ? '' : '8 000'} empty={empty} />
            <Field label="Monthly discretionary" value={empty ? '' : '3 000'} empty={empty} />
          </div>
          <div className="spouse-group">
            <div className="spouse-head">
              <span className="spouse-name" contentEditable suppressContentEditableWarning>Spouse B</span>
              <span className="spouse-age">age <input defaultValue={empty ? '' : '40'} placeholder="—" /></span>
            </div>
            <Field label="Retirement balance" value={empty ? '' : '1 200 000'} empty={empty} />
            <Field label="Discretionary balance" value={empty ? '' : '300 000'} empty={empty} />
            <Field label="Monthly retirement" value={empty ? '' : '7 000'} empty={empty} />
            <Field label="Monthly discretionary" value={empty ? '' : '2 000'} empty={empty} />
          </div>
        </RailSection>

        <RailSection num="II." title="Retirement" meta={empty ? '—' : 'age 65'} complete={!empty}>
          <div className="anchor">
            <div className="anchor-age">
              <span>When the</span>
              <div className="seg">
                <span className="on">youngest</span><span>oldest</span>
              </div>
              <span>reaches</span>
              <input defaultValue="65" />
            </div>
          </div>
        </RailSection>

        <RailSection num="III." title="Market assumptions" meta={empty ? 'defaults' : '10% · 5% · 6%'} complete={!empty}>
          <Slider label="Expected return (nominal)" value="10.00%" fill={0.58} />
          <Slider label="Inflation (CPI)" value="5.00%" fill={0.37} />
          <Slider label="Contribution escalation" value="6.00%" fill={0.50} />
        </RailSection>

        <RailSection num="IV." title="Capital events" meta="none" complete>
          <button className="add-btn">＋ Add an event</button>
        </RailSection>
      </div>

      <div className="rail-foot">
        <div className="rail-foot-label">Prepared for</div>
        <div className="rail-foot-client">
          <span contentEditable suppressContentEditableWarning>{empty ? 'Client name' : 'M. & J. Pillay'}</span>
        </div>
        <div className="rail-foot-date">22 April 2026 · Simple Wealth (Pty) Ltd</div>
      </div>
    </aside>
  );
};

Object.assign(window, { HiFiChart, Field, Slider, RailSection, LeftRail });
