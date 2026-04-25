// Results dashboard (variant A and B)
function ScreenResults({ variant = "A", setVariant, setScreen, onShare }) {
  const r = window.OptiDxLatestEvaluationView || window.SEED_RESULTS;
  const pathwayLabel = window.OptiDxLatestEvaluationPathway?.metadata?.label || "Latest pathway";
  const prevalenceLabel = window.OptiDxLatestEvaluationView?.prevalence != null
    ? `${(Number(window.OptiDxLatestEvaluationView.prevalence) * 100).toFixed(1)}% prevalence`
    : "Current evaluation";
  const pathCount = Array.isArray(r.paths) ? r.paths.length : 0;
  return (
    <>
      <TopBar
        crumbs={["OptiDx", pathwayLabel, "Results"]}
        actions={<>
        <div className="btn-group" style={{marginRight:6}}>
          <button className={"btn btn--sm " + (variant === "A" ? "btn--ink" : "")} onClick={() => setVariant && setVariant("A")}>Compact</button>
          <button className={"btn btn--sm " + (variant === "B" ? "btn--ink" : "")} onClick={() => setVariant && setVariant("B")}>Hero</button>
        </div>
          <button className="btn" onClick={async () => {
            try {
              await window.OptiDxActions.evaluatePathway?.(window.OptiDxCurrentPathway || window.OptiDxCanvasDraft || window.SEED_PATHWAY || null);
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to rerun pathway", "error");
            }
          }}><Icon name="play"/>Re-run</button>
          {onShare && <button className="btn" onClick={onShare}><Icon name="upload"/>Share</button>}
          <button className="btn" onClick={() => window.OptiDxActions.downloadJson("optidx-results.json", r)}><Icon name="download"/>Export</button>
          <button className="btn btn--primary" onClick={() => setScreen("report")}>
            <Icon name="file-text"/>Generate report
          </button>
        </>}
      />
      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Pathway Analysis</div>
            <h1>{pathwayLabel} <span style={{fontWeight:400, fontSize:16, color:"var(--fg-3)"}}>· live evaluation</span></h1>
            <p>{prevalenceLabel} · Probabilistic diagnostic pathway algorithm</p>
          </div>
          <div className="row" style={{gap:8}}>
            <span className="chip chip--pos"><Icon name="check" size={10}/> Feasible</span>
            <span className="chip chip--disc">{r.warnings.length} warning{r.warnings.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* Summary metrics */}
        {variant === "A" ? <MetricsRow r={r}/> : <MetricsRowB r={r}/>}

        {/* Warnings */}
        <div className="stack" style={{gap:8, margin:"20px 0"}}>
          {r.warnings.map((w, i) => (
            <div key={i} className={"banner " + (w.kind === "warn" ? "banner--warn" : "banner--info")}>
              <Icon name={w.kind === "warn" ? "alert" : "info"} size={16} className="banner__icon"/>
              <div>{w.text}</div>
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid" style={{gridTemplateColumns: variant === "A" ? "2fr 1fr" : "1fr 1fr", gap:16}}>
          <div className="card card--flush">
            <div className="card__head">
              <h3>Path-level trace</h3>
              <div className="spacer"/>
              <span className="u-meta">{pathCount} paths covered</span>
              <button className="btn btn--sm btn--ghost" onClick={() => setScreen("trace")}>Expand <Icon name="maximize" size={11}/></button>
            </div>
            <table className="table">
              <thead><tr>
                <th>Path</th><th>Sequence</th><th>Terminal</th>
                <th className="num">P(path | D)</th><th className="num">P(path | ¬D)</th>
                <th className="num">Cost</th><th>TAT</th>
              </tr></thead>
              <tbody>
                {r.paths.map(p => (
                  <tr key={p.id}>
                    <td className="mono"><b>{p.id}</b></td>
                    <td className="mono" style={{fontSize:11}}>{p.sequence}</td>
                    <td><span className={"chip " + (
                      p.terminalKind === "pos" ? "chip--pos"
                      : p.terminalKind === "neg" ? "chip--neg"
                      : p.terminal.includes("Treat") ? "chip--pos"
                      : p.terminal.includes("Unlikely") || p.terminal === "No TB" ? "chip--neg"
                      : "chip--inc"
                    )}>{p.terminal}</span></td>
                    <td className="num mono">{(p.pIfD*100).toFixed(1)}%</td>
                    <td className="num mono">{(p.pIfND*100).toFixed(1)}%</td>
                    <td className="num mono">${p.cost.toFixed(2)}</td>
                    <td className="mono">{p.tat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="stack" style={{gap:16}}>
            <div className="card">
              <div className="card__head"><h3>Branch flow</h3><div className="spacer"/><span className="u-meta">1,000 simulated patients</span></div>
              <div style={{padding:16}}>
                <SankeyMini/>
              </div>
            </div>

            <div className="card">
              <div className="card__head"><h3>Trade-off summary</h3></div>
              <div style={{padding:"4px 0"}}>
                {[
                  ["Good at", "Ruling out non-disease at low cost", "pos"],
                  ["Watch", "Xpert-negative after CXR-positive may miss early disease", "disc"],
                  ["High-cost branch", "P1: symptom → CXR → Xpert ($13.68)", "neg"],
                  ["Simplification", "Dropping Xpert raises FNR from 15.8 → 24.2%", "inc"],
                ].map(([k,v,kind],i) => (
                  <div key={i} style={{padding:"10px 16px", borderTop: i > 0 ? "1px solid var(--edge)" : "none", fontSize:12}}>
                    <div className="row" style={{marginBottom:2}}>
                      <span className={"chip chip--" + kind}>{k}</span>
                    </div>
                    <div style={{color:"var(--fg-2)", lineHeight:1.45}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cost + TAT */}
        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
          <div className="card">
            <div className="card__head"><h3>Cost contribution</h3></div>
            <div style={{padding:16}}>
              {[
                ["Symptom Screen", 0.50, "#C4C8CB"],
                ["Chest X-Ray", 3.20, "#F9C09A"],
                ["Xpert MTB/RIF", 1.92, "#F37739"],
              ].map(([l,v,c]) => (
                <div key={l} style={{marginBottom:10}}>
                  <div className="row" style={{fontSize:12, marginBottom:4}}><span>{l}</span><div className="spacer"/><b className="mono">${v.toFixed(2)}</b></div>
                  <div className="bar"><div className="bar__fill" style={{width: `${v/5.62*100}%`, background:c}}/></div>
                </div>
              ))}
              <div className="row" style={{fontSize:13, marginTop:14, paddingTop:10, borderTop:"1px solid var(--edge)"}}>
                <b>Expected population cost</b><div className="spacer"/><b className="mono">$5.62</b>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card__head"><h3>Turnaround time</h3></div>
            <div style={{padding:16}}>
              <div className="row" style={{gap:20, alignItems:"flex-end", marginBottom:16}}>
                <div>
                  <div className="u-meta">Expected pathway TAT</div>
                  <div style={{fontSize:34, fontWeight:700, letterSpacing:"-0.02em"}}>2.8 <span style={{fontSize:16, color:"var(--fg-3)"}}>hr</span></div>
                </div>
                <div className="spacer"/>
                <div style={{fontSize:11, color:"var(--fg-3)"}}>
                  <div>Longest branch: <b className="mono">Symp → CXR → Xpert</b></div>
                  <div>2h 35min · Lab dependent</div>
                </div>
              </div>
              <div className="bar" style={{height:10, background:"var(--surface-3)"}}>
                <div className="bar__fill" style={{width:"4%", background:"#C4C8CB"}}/>
              </div>
              <div className="row" style={{marginTop:4, fontSize:10, color:"var(--fg-3)", justifyContent:"space-between"}}>
                <span>5m</span><span>30m</span><span>2h</span><span>3h (target)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function MetricsRow({ r }) {
  const cpdc = r.cost / (r.sens * 0.08);
  return (
    <div className="grid" style={{gridTemplateColumns:"repeat(8, 1fr)", gap:12}}>
      <BigMetric label="Sensitivity" value={(r.sens*100).toFixed(1)+"%"} accent="pos" gauge={r.sens}/>
      <BigMetric label="Specificity" value={(r.spec*100).toFixed(1)+"%"} accent="pos" gauge={r.spec}/>
      <BigMetric label="FNR" value={(r.fnr*100).toFixed(1)+"%"} accent="neg"/>
      <BigMetric label="Cost / pt" value={"$"+r.cost.toFixed(2)}/>
      <BigMetric label="$ / case" value={"$"+cpdc.toFixed(2)} accent="orange" sub="per detected"/>
      <BigMetric label="TAT" value={r.tat}/>
      <BigMetric label="PPV" value={(r.ppv*100).toFixed(1)+"%"} accent="info"/>
      <BigMetric label="NPV" value={(r.npv*100).toFixed(1)+"%"} accent="info"/>
    </div>
  );
}

function MetricsRowB({ r }) {
  const cpdc = r.cost / (r.sens * 0.08);
  return (
    <div className="grid" style={{gridTemplateColumns:"repeat(4, 1fr)", gap:12}}>
      <div className="card card--pad" style={{padding:20, position:"relative", overflow:"hidden"}}>
        <div className="sme-eyebrow" style={{marginBottom:6}}>Pathway performance</div>
        <div className="row" style={{gap:24, alignItems:"center", marginTop:8}}>
          <div className="gauge" style={{"--p": r.sens, "--c":"var(--pos)"}}>
            <div className="gauge__val">{(r.sens*100).toFixed(0)}%</div>
          </div>
          <div className="gauge" style={{"--p": r.spec, "--c":"var(--pos)"}}>
            <div className="gauge__val">{(r.spec*100).toFixed(0)}%</div>
          </div>
        </div>
        <div className="row" style={{gap:48, marginTop:28, fontSize:11, color:"var(--fg-3)", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:700}}>
          <div>Sens</div><div>Spec</div>
        </div>
      </div>
      <div className="card card--pad" style={{background:"var(--sme-orange-050)", borderColor:"var(--sme-orange-100)"}}>
        <div className="sme-eyebrow" style={{marginBottom:6, color:"var(--sme-orange-600)"}}>Screening program metric</div>
        <div style={{fontSize:32, fontWeight:700, letterSpacing:"-0.02em", color:"var(--sme-orange-600)", marginTop:6}}>
          ${cpdc.toFixed(2)}
        </div>
        <div style={{fontSize:12, color:"var(--fg-2)", marginTop:4}}>Cost per detected case</div>
        <div className="u-meta" style={{marginTop:10, lineHeight:1.4}}>At 8% prevalence · ${r.cost.toFixed(2)}/patient ÷ ({(r.sens*100).toFixed(0)}% × 8%)</div>
      </div>
      <BigMetric label="Cost / patient" value={"$"+r.cost.toFixed(2)} sub="Weighted by path prob"/>
      <div className="card card--pad" style={{background:"var(--sme-ink-900)", color:"#fff", borderColor:"var(--sme-ink-900)"}}>
        <div className="sme-eyebrow" style={{marginBottom:6, color:"var(--sme-orange)"}}>Decision support</div>
        <div className="kv" style={{gridTemplateColumns:"80px 1fr", color:"#D4D6D8"}}>
          <dt style={{color:"#A9ADB1"}}>PPV</dt><dd style={{color:"#fff"}} className="mono">{(r.ppv*100).toFixed(1)}%</dd>
          <dt style={{color:"#A9ADB1"}}>NPV</dt><dd style={{color:"#fff"}} className="mono">{(r.npv*100).toFixed(1)}%</dd>
          <dt style={{color:"#A9ADB1"}}>FNR</dt><dd style={{color:"#fff"}} className="mono">{(r.fnr*100).toFixed(1)}%</dd>
          <dt style={{color:"#A9ADB1"}}>TAT</dt><dd style={{color:"#fff"}} className="mono">{r.tat}</dd>
        </div>
      </div>
    </div>
  );
}

function BigMetric({ label, value, sub, accent, gauge }) {
  return (
    <div className={"metric" + (accent === "orange" ? " metric--orange" : "")}>
      <div className="metric__label">{label}</div>
      <div className="metric__value" style={{color: accent === "pos" ? "var(--pos)" : accent === "neg" ? "var(--neg)" : accent === "info" ? "var(--refer)" : accent === "orange" ? "var(--sme-orange-600)" : "var(--fg-1)"}}>{value}</div>
      {sub && <div className="metric__sub">{sub}</div>}
      {gauge !== undefined && <div className="bar bar--pos" style={{marginTop:8}}><div className="bar__fill" style={{width:`${gauge*100}%`}}/></div>}
    </div>
  );
}

function SankeyMini() {
  // Stylized Sankey — two cohorts flow through 4 terminals
  return (
    <svg viewBox="0 0 480 200" width="100%" height="200">
      {/* Disease-present cohort (top half) */}
      <rect x="0" y="10" width="20" height="60" fill="var(--pos)" opacity="0.7"/>
      <text x="-4" y="8" fontSize="9" fill="var(--fg-3)" fontWeight="700" textAnchor="start">D+ (80 pts)</text>
      {/* Disease-absent cohort */}
      <rect x="0" y="110" width="20" height="80" fill="var(--neg)" opacity="0.6"/>
      <text x="-4" y="208" fontSize="9" fill="var(--fg-3)" fontWeight="700" textAnchor="start">D− (920 pts)</text>

      {/* Flows from D+ */}
      <path d="M 20 10 C 140 10, 340 10, 460 10 L 460 40 C 340 40, 140 40, 20 40 Z" fill="var(--pos)" opacity="0.6"/>
      <path d="M 20 40 C 140 40, 340 60, 460 60 L 460 70 C 340 80, 140 70, 20 55 Z" fill="var(--neg)" opacity="0.35"/>
      <path d="M 20 55 C 140 55, 340 80, 460 80 L 460 90 C 340 100, 140 75, 20 65 Z" fill="var(--inconcl)" opacity="0.3"/>
      <path d="M 20 65 C 140 65, 340 140, 460 140 L 460 170 C 340 160, 140 75, 20 70 Z" fill="var(--neg)" opacity="0.2"/>

      {/* Flows from D- */}
      <path d="M 20 110 C 140 110, 340 100, 460 100 L 460 110 C 340 110, 140 115, 20 115 Z" fill="var(--pos)" opacity="0.25"/>
      <path d="M 20 115 C 140 115, 340 110, 460 110 L 460 140 C 340 150, 140 135, 20 135 Z" fill="var(--neg)" opacity="0.5"/>
      <path d="M 20 135 C 140 135, 340 160, 460 160 L 460 190 C 340 195, 140 185, 20 190 Z" fill="var(--neg)" opacity="0.35"/>

      {/* Terminal labels */}
      <g fontSize="10" fill="var(--fg-2)" fontWeight="700">
        <rect x="460" y="10" width="16" height="30" fill="var(--pos)"/>
        <text x="430" y="26" textAnchor="end">TB, Treat</text>
        <rect x="460" y="60" width="16" height="50" fill="var(--neg)" opacity="0.7"/>
        <text x="430" y="88" textAnchor="end">TB Unlikely</text>
        <rect x="460" y="140" width="16" height="60" fill="var(--neg)" opacity="0.5"/>
        <text x="430" y="174" textAnchor="end">No TB</text>
      </g>
    </svg>
  );
}

Object.assign(window, { ScreenResults });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
