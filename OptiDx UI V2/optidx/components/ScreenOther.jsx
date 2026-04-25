// Remaining screens: trace, compare, evidence, report, settings, parallel modal
function ScreenTrace({ setScreen }) {
  const r = window.SEED_RESULTS;
  return (
    <>
      <TopBar crumbs={["OptiDx", "Results", "Path-level trace"]}
        actions={<><button className="btn"><Icon name="download"/>CSV</button><button className="btn btn--primary" onClick={() => setScreen("results")}>Back to dashboard</button></>}/>
      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Detailed trace</div>
            <h1>Path-level probability decomposition</h1>
            <p>Every terminal branch in the pathway, with conditional probabilities, cost, TAT, samples, and skill.</p>
          </div>
        </div>
        <div className="card card--flush">
          <table className="table">
            <thead><tr>
              <th>Path</th><th>Sequence</th><th>Terminal</th>
              <th className="num">P(path | D+)</th><th className="num">P(path | D−)</th>
              <th className="num">Cost</th><th className="num">TAT</th><th>Samples</th><th>Skill</th>
            </tr></thead>
            <tbody>
              {r.paths.map(p => (
                <tr key={p.id}>
                  <td className="mono"><b>{p.id}</b></td>
                  <td className="mono" style={{fontSize:12}}>{p.sequence}</td>
                  <td><span className={"chip " + (p.terminal.includes("Treat") ? "chip--pos" : "chip--neg")}>{p.terminal}</span></td>
                  <td className="num mono">{(p.pIfD*100).toFixed(1)}%</td>
                  <td className="num mono">{(p.pIfND*100).toFixed(1)}%</td>
                  <td className="num mono">${p.cost.toFixed(2)}</td>
                  <td className="num mono">{p.tat}</td>
                  <td>{p.samples}</td>
                  <td>{p.skill}</td>
                </tr>
              ))}
              <tr style={{background:"var(--surface-2)"}}>
                <td colSpan="3"><b>Totals</b></td>
                <td className="num mono"><b>100.0%</b></td>
                <td className="num mono"><b>100.0%</b></td>
                <td className="num mono"><b>$5.62</b></td>
                <td className="num mono"><b>2.8h</b></td>
                <td/><td/>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="banner banner--info" style={{marginTop:16}}>
          <Icon name="info" size={16} className="banner__icon"/>
          <div>Probabilities sum to 1.0 within each cohort (D+ and D−). Cost and TAT shown are path-specific; aggregates are probability-weighted.</div>
        </div>
      </div>
    </>
  );
}

function ScreenCompare({ setScreen }) {
  return (
    <>
      <TopBar crumbs={["OptiDx", "TB Community Screening", "Compare"]}
        actions={<><button className="btn"><Icon name="download"/>Export</button><button className="btn btn--primary">Apply suggestion</button></>}/>
      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Optimization</div>
            <h1>Compare candidate pathways</h1>
            <p>Trade-offs between cost, TAT, sensitivity, and specificity under current constraints.</p>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:"repeat(3, 1fr)", gap:12, marginBottom:16}}>
          {window.SEED_COMPARE.slice(0,3).map(c => (
            <div key={c.id} className="card card--pad" style={{borderColor: c.id === "c1" ? "var(--sme-orange)" : "var(--edge)"}}>
              <div className="row" style={{marginBottom:6}}>
                <div className="sme-eyebrow">{c.id === "c1" ? "Current" : c.name.split(" ")[0]}</div>
                <div className="spacer"/>
                {c.id === "c1" && <span className="chip chip--orange">Baseline</span>}
              </div>
              <h3 style={{fontSize:15, marginBottom:10}}>{c.name}</h3>
              <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:"6px 12px", fontSize:12}}>
                <div><span className="u-meta">Sens</span> <b className="mono">{(c.sens*100).toFixed(1)}%</b></div>
                <div><span className="u-meta">Spec</span> <b className="mono">{(c.spec*100).toFixed(1)}%</b></div>
                <div><span className="u-meta">Cost</span> <b className="mono">${c.cost.toFixed(2)}</b></div>
                <div><span className="u-meta">TAT</span> <b className="mono">{c.tat}</b></div>
              </div>
            </div>
          ))}
        </div>

        <div className="card card--flush">
          <div className="card__head"><h3>All candidates</h3><div className="spacer"/><span className="u-meta">6 candidates · 2 infeasible</span></div>
          <table className="table">
            <thead><tr>
              <th>Pathway</th><th className="num">Sens</th><th className="num">Spec</th>
              <th className="num">Cost</th><th className="num">TAT</th>
              <th className="num">PPV</th><th className="num">NPV</th>
              <th>Skill</th><th>Samples</th><th>Status</th>
            </tr></thead>
            <tbody>
              {window.SEED_COMPARE.map(c => (
                <tr key={c.id}>
                  <td><b>{c.name}</b>{c.reason && <div style={{fontSize:11, color:"var(--fg-3)"}}>{c.reason}</div>}</td>
                  <td className="num mono">{(c.sens*100).toFixed(1)}%</td>
                  <td className="num mono">{(c.spec*100).toFixed(1)}%</td>
                  <td className="num mono">${c.cost.toFixed(2)}</td>
                  <td className="num mono">{c.tat}</td>
                  <td className="num mono">{(c.ppv*100).toFixed(1)}%</td>
                  <td className="num mono">{(c.npv*100).toFixed(1)}%</td>
                  <td>{c.skill}</td>
                  <td className="mono">{c.samples}</td>
                  <td><span className={"chip " + (c.feasible ? "chip--pos" : "chip--disc")}>{c.feasible ? "Feasible" : "Infeasible"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16}}>
          <div className="card">
            <div className="card__head"><h3>Trade-off radar</h3></div>
            <div style={{padding:16, display:"grid", placeItems:"center"}}><RadarChart/></div>
          </div>
          <div className="card">
            <div className="card__head"><h3>Cost vs sensitivity</h3></div>
            <div style={{padding:16}}><ScatterChart/></div>
          </div>
        </div>
      </div>
    </>
  );
}

function RadarChart() {
  const axes = ["Sens","Spec","Low cost","Fast","Low skill","Few samples"];
  const current = [0.84,0.95,0.60,0.75,0.80,0.50];
  const balanced = [0.86,0.95,0.55,0.80,0.80,0.50];
  const cx=140, cy=140, R=100;
  const pt = (v,i) => {
    const a = (Math.PI*2*i)/axes.length - Math.PI/2;
    return [cx + Math.cos(a)*v*R, cy + Math.sin(a)*v*R];
  };
  const poly = arr => arr.map((v,i) => pt(v,i).join(",")).join(" ");
  return (
    <svg width="280" height="280" viewBox="0 0 280 280">
      {[0.25,0.5,0.75,1].map(r => <polygon key={r} points={poly(axes.map(()=>r))} fill="none" stroke="var(--edge)"/>)}
      {axes.map((a,i) => { const [x,y] = pt(1.1,i); return <text key={a} x={x} y={y} fontSize="10" fill="var(--fg-3)" textAnchor="middle">{a}</text>; })}
      <polygon points={poly(current)} fill="var(--sme-orange)" fillOpacity="0.2" stroke="var(--sme-orange)" strokeWidth="1.5"/>
      <polygon points={poly(balanced)} fill="var(--refer)" fillOpacity="0.15" stroke="var(--refer)" strokeWidth="1.5" strokeDasharray="3 3"/>
    </svg>
  );
}

function ScatterChart() {
  const pts = window.SEED_COMPARE.map(c => ({ ...c, px: 20 + c.cost*10, py: 200 - c.sens*200 }));
  return (
    <svg width="100%" height="220" viewBox="0 0 500 220">
      <line x1="40" y1="10" x2="40" y2="200" stroke="var(--edge)"/>
      <line x1="40" y1="200" x2="480" y2="200" stroke="var(--edge)"/>
      <text x="10" y="14" fontSize="10" fill="var(--fg-3)">Sens</text>
      <text x="470" y="215" fontSize="10" fill="var(--fg-3)" textAnchor="end">Cost ($)</text>
      {pts.map(p => (
        <g key={p.id}>
          <circle cx={40 + p.cost*12} cy={200 - p.sens*180} r={p.feasible ? 8 : 6}
            fill={p.id === "c1" ? "var(--sme-orange)" : p.feasible ? "var(--pos)" : "var(--fg-4)"}
            opacity={p.feasible ? 0.85 : 0.4}/>
          <text x={40 + p.cost*12 + 10} y={200 - p.sens*180 + 3} fontSize="10" fill="var(--fg-2)">{p.name.split(" ")[0]}</text>
        </g>
      ))}
    </svg>
  );
}

function ScreenEvidence() {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [cat, setCat] = useState("all");
  const [activeDisease, setActiveDisease] = useState(null);
  const [previewing, setPreviewing] = useState(null); // preset row being inspected
  const [showAccess, setShowAccess] = useState(false);
  const [requested, setRequested] = useState(false);
  const [view, setView] = useState("grid"); // grid | table

  const diseases = window.SEED_PRESET_DISEASES;
  const presets = window.SEED_PRESET_TESTS;
  const areas = ["all", ...Array.from(new Set(diseases.map(d => d.area)))];
  const cats  = ["all","molecular","imaging","rapid","biomarker","clinical","pathology"];

  const filtered = presets.filter(p =>
    (!q || p.test.toLowerCase().includes(q.toLowerCase()) || p.disease.toLowerCase().includes(q.toLowerCase())) &&
    (cat === "all" || p.category === cat) &&
    (!activeDisease || p.diseaseId === activeDisease) &&
    (area === "all" || diseases.find(d => d.id === p.diseaseId)?.area === area)
  );

  return (
    <>
      <TopBar
        crumbs={["OptiDx","Preset test library"]}
        actions={<>
          <span className="chip chip--orange" style={{height:24, padding:"0 10px"}}>Preview · Coming soon</span>
          <div className="btn-group">
            <button className={"btn btn--sm " + (view==="grid" ? "btn--ink" : "")} onClick={() => setView("grid")}><Icon name="layout-grid" size={11}/></button>
            <button className={"btn btn--sm " + (view==="table" ? "btn--ink" : "")} onClick={() => setView("table")}><Icon name="grid" size={11}/></button>
          </div>
          <button className="btn" onClick={() => setShowAccess(true)}><Icon name="lock"/>Request edit access</button>
          <button className="btn btn--primary" disabled title="Coming soon"><Icon name="plus"/>Add record</button>
        </>}
      />

      {/* Hero / coming-soon banner */}
      <div style={{
        background:"linear-gradient(180deg, var(--sme-ink-900) 0%, #2C3338 100%)",
        color:"#fff", padding:"22px 32px", display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:32, alignItems:"center", position:"relative", overflow:"hidden",
      }}>
        {/* Decorative dot grid */}
        <svg viewBox="0 0 600 200" style={{position:"absolute", right:0, top:0, height:"100%", opacity:0.25}}>
          {Array.from({length:12}).map((_,r) => Array.from({length:30}).map((_,c) => (
            <circle key={r+"-"+c} cx={20 + c*20} cy={20 + r*15} r={(r+c)%7===0 ? 2 : 1} fill="#F37739"/>
          )))}
        </svg>
        <div style={{position:"relative"}}>
          <div className="sme-eyebrow" style={{color:"var(--sme-orange)", marginBottom:8}}>CURATED EVIDENCE · COMING SOON</div>
          <h1 style={{fontSize:24, lineHeight:1.2, color:"#fff", marginBottom:8, textWrap:"balance", letterSpacing:"-0.01em"}}>
            <span className="mono" style={{color:"var(--sme-orange)"}}>113+</span> diagnostic tests across <span className="mono" style={{color:"var(--sme-orange)"}}>{diseases.length}</span> disease areas
          </h1>
          <p style={{fontSize:13, color:"#B0B5B9", lineHeight:1.55, maxWidth:640, marginBottom:12}}>
            Sensitivity, specificity, turnaround time and cost, peer-reviewed, WHO-endorsed where available, and continuously curated by Syreon's clinical evidence team.
            Drop a preset into your pathway and override any field. Read-only library access is rolling out in <b style={{color:"#fff"}}>Q3 2027</b>.
          </p>
          <div className="row" style={{gap:6, fontSize:11, color:"#8A9299"}}>
            <Icon name="check" size={12}/> Source-cited
            <span style={{marginLeft:8}}>·</span>
            <Icon name="check" size={12}/> CI ranges
            <span style={{marginLeft:8}}>·</span>
            <Icon name="check" size={12}/> Region-specific
            <span style={{marginLeft:8}}>·</span>
            <Icon name="check" size={12}/> Editable per-pathway
          </div>
        </div>
        <div style={{position:"relative", display:"flex", justifyContent:"flex-end"}}>
          <PresetPreviewCard preset={presets[0]}/>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"260px 1fr", minHeight:"calc(100% - 192px)"}}>
        {/* Left rail: disease areas */}
        <aside className="side" style={{width:"auto", borderRight:"1px solid var(--edge)"}}>
          <div className="side__head"><h2>Disease areas</h2></div>
          <div style={{padding:"10px 12px", borderBottom:"1px solid var(--edge)"}}>
            <div className="field" style={{marginBottom:8}}>
              <label className="field__label">Area</label>
              <select className="select" value={area} onChange={e => setArea(e.target.value)}>
                {areas.map(a => <option key={a} value={a}>{a === "all" ? "All areas" : a}</option>)}
              </select>
            </div>
            <div className="field" style={{marginBottom:0}}>
              <label className="field__label">Test category</label>
              <select className="select" value={cat} onChange={e => setCat(e.target.value)}>
                {cats.map(c => <option key={c} value={c}>{c === "all" ? "All categories" : c}</option>)}
              </select>
            </div>
          </div>
          <div className="side__body" style={{padding:"6px"}}>
            <button className={"row " + (!activeDisease ? "is-active-soft" : "")}
              onClick={() => setActiveDisease(null)}
              style={diseaseRowStyle(!activeDisease)}>
              <Icon name="database" size={14} style={{color:"var(--fg-3)"}}/>
              <span style={{flex:1, fontSize:13, fontWeight:600}}>All diseases</span>
              <span className="u-meta mono">{presets.length}</span>
            </button>
            {diseases
              .filter(d => area === "all" || d.area === area)
              .map(d => {
              const count = presets.filter(p => p.diseaseId === d.id).length;
              return (
                <button key={d.id}
                  onClick={() => setActiveDisease(activeDisease === d.id ? null : d.id)}
                  style={diseaseRowStyle(activeDisease === d.id)}>
                  <span style={{
                    width:6, height:6, borderRadius:"50%",
                    background: areaColor(d.area),
                  }}/>
                  <div style={{flex:1, minWidth:0, textAlign:"left"}}>
                    <div style={{fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{d.name}</div>
                    <div className="u-meta" style={{fontSize:10}}>{d.area} · prev. {d.prev}</div>
                  </div>
                  <span className="u-meta mono">{count || d.count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main: preset list + preview pane */}
        <main style={{overflow:"auto", padding:"14px 28px 28px"}}>
          <div className="page__head" style={{marginBottom:12, paddingBottom:12}}>
            <div>
              <h2 style={{fontSize:18, marginBottom:2}}>
                {activeDisease ? diseases.find(d => d.id === activeDisease)?.name : "All preset tests"}
                <span className="u-meta" style={{marginLeft:8, fontWeight:400}}>{filtered.length} record{filtered.length!==1?"s":""}</span>
              </h2>
              <div className="u-meta">Read-only preview · Click a row to inspect · Edit access requires private beta</div>
            </div>
            <div style={{position:"relative"}}>
              <Icon name="search" style={{position:"absolute", left:10, top:10, color:"var(--fg-3)"}}/>
              <input className="input" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search test or disease…" style={{width:280, paddingLeft:32}}/>
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12}}>
              {filtered.map(p => (
                <PresetCard key={p.id} preset={p}
                  onClick={() => setPreviewing(p)}
                  selected={previewing?.id === p.id}/>
              ))}
              {filtered.length === 0 && (
                <div className="card card--pad" style={{gridColumn:"1 / -1", textAlign:"center", color:"var(--fg-3)"}}>
                  No tests match those filters.
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{padding:0, overflow:"hidden"}}>
              <table className="table">
                <thead><tr>
                  <th>Test</th><th>Disease</th><th>Cat.</th>
                  <th style={{textAlign:"right"}}>Sens</th>
                  <th style={{textAlign:"right"}}>Spec</th>
                  <th style={{textAlign:"right"}}>TAT</th>
                  <th style={{textAlign:"right"}}>Cost</th>
                  <th>Source</th><th>Conf.</th><th></th>
                </tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} style={{cursor:"pointer"}} onClick={() => setPreviewing(p)}>
                      <td>
                        <div style={{display:"flex", alignItems:"center", gap:8}}>
                          <div className="test-card__icon" style={{width:24, height:24}}><Icon name={catIcon(p.category)} size={12}/></div>
                          <div>
                            <div style={{fontWeight:700, fontSize:13}}>{p.test}</div>
                            {p.who && <span className="u-meta" style={{fontSize:10}}>WHO PQ</span>}
                          </div>
                        </div>
                      </td>
                      <td className="u-meta">{p.disease}</td>
                      <td><span className="chip chip--outline" style={{textTransform:"capitalize"}}>{p.category}</span></td>
                      <td className="mono" style={{textAlign:"right"}}>{p.sens.toFixed(2)}</td>
                      <td className="mono" style={{textAlign:"right"}}>{p.spec.toFixed(2)}</td>
                      <td className="mono" style={{textAlign:"right"}}>{p.tat}{p.tatUnit[0]}</td>
                      <td className="mono" style={{textAlign:"right"}}>${p.cost.toFixed(2)}</td>
                      <td className="u-meta" style={{maxWidth:200, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{p.source}</td>
                      <td>
                        <span className={"chip " + (p.confidence === "High" ? "chip--pos" : p.confidence === "Moderate" ? "chip--disc" : "chip--outline")}>{p.confidence}</span>
                      </td>
                      <td><Icon name="chevron-right" size={12} style={{color:"var(--fg-3)"}}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{marginTop:24, padding:"14px 18px", border:"1px dashed var(--edge-2)", borderRadius:6, background:"var(--surface-2)", display:"flex", gap:14, alignItems:"center"}}>
            <Icon name="info" size={16} style={{color:"var(--sme-orange)"}}/>
            <div style={{flex:1, fontSize:12, color:"var(--fg-2)"}}>
              <b>Don't see what you need?</b> Submit a request and our clinical evidence team will source, vet, and add it within 7 days. Custom catalogs can be scoped to your workspace.
            </div>
            <button className="btn btn--sm">Request a test</button>
          </div>
        </main>
      </div>

      {previewing && <PresetInspectModal preset={previewing} onClose={() => setPreviewing(null)} onRequest={() => { setPreviewing(null); setShowAccess(true); }}/>}
      {showAccess && <RequestAccessModal onClose={() => setShowAccess(false)} requested={requested} onRequest={() => setRequested(true)}/>}
    </>
  );
}

function diseaseRowStyle(active) {
  return {
    display:"flex", alignItems:"center", gap:8, width:"100%",
    padding:"7px 8px", borderRadius:5, cursor:"pointer",
    background: active ? "var(--sme-orange-050)" : "transparent",
    border:"1px solid " + (active ? "var(--sme-orange-200, var(--sme-orange))" : "transparent"),
    color: active ? "var(--sme-orange-700, var(--sme-orange))" : "var(--fg-1)",
    textAlign:"left",
  };
}
function areaColor(area) {
  return ({
    "Infectious": "var(--refer)",
    "Oncology":   "var(--sme-orange)",
    "NCD":        "var(--pos)",
    "Endocrine":  "#7B5BA6",
    "Cardiology": "var(--neg)",
    "Neurology":  "#5BA68F",
    "GI":         "var(--inconcl)",
    "Rheum.":     "#A66B5B",
    "Pulmonary":  "#5B8AA6",
  })[area] || "var(--fg-3)";
}
function catIcon(c) {
  return ({
    molecular: "dna", imaging: "scan", rapid: "droplets",
    biomarker: "test-tube", clinical: "stethoscope", pathology: "microscope",
  })[c] || "flask";
}

function PresetCard({ preset:p, onClick, selected }) {
  return (
    <article onClick={onClick}
      className={"card card--pad" + (selected ? " is-selected" : "")}
      style={{
        cursor:"pointer", position:"relative",
        borderColor: selected ? "var(--sme-orange)" : undefined,
        boxShadow: selected ? "0 0 0 2px var(--sme-orange-050)" : undefined,
      }}>
      <div className="row" style={{marginBottom:8}}>
        <div className="test-card__icon" style={{width:28, height:28, background: areaColor(getDiseaseArea(p.diseaseId)) + "20", color: areaColor(getDiseaseArea(p.diseaseId))}}>
          <Icon name={catIcon(p.category)} size={13}/>
        </div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13, fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{p.test}</div>
          <div className="u-meta" style={{fontSize:11}}>{p.disease}</div>
        </div>
        {p.who && <span title="WHO prequalified" style={{fontSize:9, fontWeight:700, color:"var(--pos)", border:"1px solid var(--pos)", padding:"1px 4px", borderRadius:3, letterSpacing:"0.06em"}}>WHO</span>}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8}}>
        <Stat label="Sensitivity" value={p.sens.toFixed(2)} sub={p.sensCI}/>
        <Stat label="Specificity" value={p.spec.toFixed(2)} sub={p.specCI}/>
        <Stat label="TAT" value={p.tat + " " + p.tatUnit} mono={false}/>
        <Stat label="Cost" value={"$" + p.cost.toFixed(2)} mono={false}/>
      </div>

      <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:8}}>
        <span className="chip chip--outline" style={{textTransform:"capitalize"}}>{p.category}</span>
        <span className="chip chip--outline">{p.sample}</span>
        <span className="chip chip--outline">{p.skill}</span>
      </div>

      <div style={{fontSize:10, color:"var(--fg-3)", lineHeight:1.4, paddingTop:8, borderTop:"1px solid var(--edge)"}}>
        <div style={{whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}><i>{p.source}</i></div>
        <div className="row" style={{justifyContent:"space-between", marginTop:4}}>
          <span>{p.country} · {p.year}</span>
          <span style={{color: p.confidence === "High" ? "var(--pos)" : p.confidence === "Moderate" ? "var(--inconcl)" : "var(--fg-3)", fontWeight:700}}>● {p.confidence}</span>
        </div>
      </div>
    </article>
  );
}

function getDiseaseArea(id) {
  return window.SEED_PRESET_DISEASES.find(d => d.id === id)?.area || "Other";
}

function Stat({ label, value, sub, mono = true }) {
  return (
    <div style={{padding:"6px 8px", background:"var(--surface-2)", borderRadius:4}}>
      <div className="u-meta" style={{fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:1}}>{label}</div>
      <div className={mono ? "mono" : ""} style={{fontSize:14, fontWeight:700, color:"var(--fg-1)"}}>{value}</div>
      {sub && <div className="u-meta mono" style={{fontSize:10, marginTop:1}}>{sub}</div>}
    </div>
  );
}

function PresetPreviewCard({ preset:p }) {
  if (!p) return null;
  return (
    <div style={{
      background:"#fff", color:"var(--fg-1)",
      borderRadius:8, padding:14, width:340,
      boxShadow:"0 20px 50px rgba(0,0,0,0.4)",
      transform:"rotate(1.2deg)",
      border:"1px solid rgba(255,255,255,0.1)",
    }}>
      <div className="row" style={{marginBottom:8}}>
        <div className="test-card__icon" style={{width:26, height:26, background:"var(--sme-orange-050)", color:"var(--sme-orange-600)"}}><Icon name="dna" size={12}/></div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:13, fontWeight:700}}>{p.test}</div>
          <div className="u-meta" style={{fontSize:10}}>{p.disease}</div>
        </div>
        <span style={{fontSize:9, fontWeight:700, color:"var(--pos)", border:"1px solid var(--pos)", padding:"1px 4px", borderRadius:3}}>WHO</span>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:8}}>
        <Stat label="Sens" value={p.sens.toFixed(2)} sub={p.sensCI}/>
        <Stat label="Spec" value={p.spec.toFixed(2)} sub={p.specCI}/>
      </div>
      <div style={{fontSize:9, color:"var(--fg-3)", borderTop:"1px solid var(--edge)", paddingTop:6}}>
        <i>{p.source}</i><br/>{p.population} · {p.country} · {p.year}
      </div>
    </div>
  );
}

function PresetInspectModal({ preset:p, onClose, onRequest }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--lg" onClick={e => e.stopPropagation()} style={{maxWidth:680}}>
        <div className="modal__head">
          <div>
            <div className="u-meta" style={{textTransform:"uppercase", letterSpacing:"0.08em", fontSize:10, marginBottom:2}}>Preset · Read-only preview</div>
            <h2>{p.test}</h2>
            <div className="u-meta">{p.disease} · {p.category}</div>
          </div>
          <button className="btn btn--icon" onClick={onClose}><Icon name="x"/></button>
        </div>
        <div className="modal__body">
          {/* Performance */}
          <h4 style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--fg-3)", marginBottom:8}}>Diagnostic performance</h4>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18}}>
            <BigStat label="Sensitivity" value={p.sens.toFixed(2)} ci={p.sensCI} color="var(--pos)"/>
            <BigStat label="Specificity" value={p.spec.toFixed(2)} ci={p.specCI} color="var(--refer)"/>
            <BigStat label="Turnaround time" value={p.tat + " " + p.tatUnit} color="var(--inconcl)"/>
            <BigStat label="Unit cost" value={"$" + p.cost.toFixed(2)} sub={p.costCcy} color="var(--neg)"/>
          </div>

          {/* Operational */}
          <h4 style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--fg-3)", marginBottom:8}}>Operational profile</h4>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18}}>
            <FieldRow label="Sample" value={p.sample}/>
            <FieldRow label="Skill required" value={p.skill}/>
            <FieldRow label="Confidence" value={p.confidence}/>
          </div>

          {/* Source */}
          <h4 style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--fg-3)", marginBottom:8}}>Source</h4>
          <div className="card card--pad" style={{background:"var(--surface-2)", marginBottom:18}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>{p.source}</div>
            <div className="u-meta" style={{fontSize:12, lineHeight:1.5}}>
              {p.population} · {p.country} · Published {p.year}
              {p.who && <> · <span style={{color:"var(--pos)", fontWeight:700}}>WHO prequalified</span></>}
            </div>
          </div>

          {/* Locked editor preview */}
          <h4 style={{fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:"var(--fg-3)", marginBottom:8}}>
            <Icon name="lock" size={11} style={{verticalAlign:"middle"}}/> Override values for this pathway
          </h4>
          <div className="card card--pad" style={{position:"relative", overflow:"hidden"}}>
            <div style={{
              position:"absolute", inset:0, background:"rgba(255,255,255,0.6)",
              backdropFilter:"blur(2px)", display:"grid", placeItems:"center", zIndex:2, padding:20,
            }}>
              <div style={{textAlign:"center", maxWidth:380}}>
                <div style={{width:36, height:36, borderRadius:"50%", background:"var(--sme-ink-900)", color:"#fff", margin:"0 auto 8px", display:"grid", placeItems:"center"}}>
                  <Icon name="lock" size={16}/>
                </div>
                <div style={{fontSize:13, fontWeight:700, marginBottom:4}}>Editing presets is part of the curated library</div>
                <div className="u-meta" style={{fontSize:11, lineHeight:1.5, marginBottom:10}}>
                  When access rolls out, you'll be able to override sens/spec, TAT and cost per pathway. Source defaults are preserved for audit.
                </div>
                <button className="btn btn--primary btn--sm" onClick={onRequest}>Request early access</button>
              </div>
            </div>
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:10}} aria-hidden="true">
              <FieldEdit label="Sensitivity (override)" value={p.sens.toFixed(2)}/>
              <FieldEdit label="Specificity (override)" value={p.spec.toFixed(2)}/>
              <FieldEdit label="TAT (min)" value={p.tatUnit === "min" ? p.tat : p.tat + " " + p.tatUnit}/>
              <FieldEdit label="Cost (USD)" value={p.cost.toFixed(2)}/>
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn" onClick={onClose}>Close</button>
          <div className="spacer"/>
          <button className="btn" disabled title="Coming soon"><Icon name="file"/>View source PDF</button>
          <button className="btn btn--primary" disabled title="Coming soon"><Icon name="plus"/>Import to pathway</button>
        </div>
      </div>
    </div>
  );
}

function BigStat({ label, value, ci, sub, color }) {
  return (
    <div style={{padding:"12px 14px", borderLeft:"3px solid " + color, background:"var(--surface-2)", borderRadius:"0 4px 4px 0"}}>
      <div className="u-meta" style={{fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2}}>{label}</div>
      <div className="mono" style={{fontSize:22, fontWeight:700, color:"var(--fg-1)", lineHeight:1.1}}>{value}</div>
      {ci && <div className="u-meta mono" style={{fontSize:10, marginTop:2}}>95% CI: {ci}</div>}
      {sub && <div className="u-meta" style={{fontSize:10, marginTop:2}}>{sub}</div>}
    </div>
  );
}
function FieldRow({ label, value }) {
  return (
    <div>
      <div className="u-meta" style={{fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2}}>{label}</div>
      <div style={{fontSize:13, fontWeight:600}}>{value}</div>
    </div>
  );
}
function FieldEdit({ label, value }) {
  return (
    <div className="field" style={{marginBottom:0}}>
      <label className="field__label">{label}</label>
      <input className="input" defaultValue={value} disabled/>
    </div>
  );
}

function RequestAccessModal({ onClose, requested, onRequest }) {
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
        <div className="modal__head">
          <div>
            <h2>Join the preset library beta</h2>
            <div className="u-meta">Read-write access to curated diagnostics, Q3 2027</div>
          </div>
          <button className="btn btn--icon" onClick={onClose}><Icon name="x"/></button>
        </div>
        <div className="modal__body">
          {!requested ? (
            <form onSubmit={e => { e.preventDefault(); onRequest(); }}>
              <div className="field">
                <label className="field__label">Work email</label>
                <input className="input" required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@institution.org"/>
              </div>
              <div className="field">
                <label className="field__label">Organization</label>
                <input className="input" required value={org} onChange={e => setOrg(e.target.value)} placeholder="Ministry of Health · WHO · Hospital"/>
              </div>
              <div className="field">
                <label className="field__label">Primary disease areas of interest</label>
                <div className="row" style={{gap:6, flexWrap:"wrap"}}>
                  {["TB","HIV","HCV","Cancer screening","NCD","Maternal/Child","Other"].map(t => (
                    <label key={t} className="chip chip--outline" style={{cursor:"pointer"}}>
                      <input type="checkbox" style={{marginRight:4, transform:"scale(0.9)"}}/>{t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="banner" style={{marginTop:14}}>
                <Icon name="info" size={14} className="banner__icon"/>
                <div style={{fontSize:12, lineHeight:1.5}}>Beta seats are prioritized for HTA agencies, Ministries of Health, and academic centers. Most requests answered within 5 business days.</div>
              </div>
              <div className="row" style={{marginTop:16, justifyContent:"flex-end", gap:8}}>
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn--primary">Request access</button>
              </div>
            </form>
          ) : (
            <div style={{textAlign:"center", padding:"20px 10px"}}>
              <div style={{width:48, height:48, borderRadius:"50%", background:"var(--pos)", color:"#fff", margin:"0 auto 12px", display:"grid", placeItems:"center"}}>
                <Icon name="check" size={20}/>
              </div>
              <h3 style={{fontSize:16, marginBottom:4}}>You're on the list</h3>
              <p className="u-meta" style={{maxWidth:340, margin:"0 auto", lineHeight:1.5}}>
                We'll email <b style={{color:"var(--fg-1)"}}>{email || "you"}</b> as soon as your access is approved. Meanwhile, you can browse the catalog read-only.
              </p>
              <button className="btn btn--primary" style={{marginTop:18}} onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function ScreenSettingsLegacy() {
  return (
    <>
      <TopBar crumbs={["OptiDx","Settings"]}/>
      <div className="page" style={{maxWidth:960}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Preferences</div>
            <h1>Workspace settings</h1>
          </div>
        </div>
        <div className="tabs" style={{marginBottom:24}}>
          {["Profile","Workspace","Pathway defaults","Branding","Integrations"].map((t,i) =>
            <div key={t} className={"tab " + (i === 2 ? "is-active" : "")}>{t}</div>
          )}
        </div>
        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
          <div className="card card--pad">
            <h3 style={{fontSize:14, marginBottom:12}}>Algorithm defaults</h3>
            <div className="stack">
              <div className="field"><label className="field__label">Default currency</label><select className="select"><option>USD</option><option>EUR</option><option>EGP</option><option>AED</option></select></div>
              <div className="field"><label className="field__label">Rounding</label><select className="select"><option>3 decimals</option><option>2 decimals</option></select></div>
              <div className="field"><label className="field__label">Assume conditional independence</label><select className="select"><option>Unless overridden</option><option>Never</option></select></div>
            </div>
          </div>
          <div className="card card--pad">
            <h3 style={{fontSize:14, marginBottom:12}}>Validation</h3>
            <div className="stack">
              {["Warn if unconnected outputs","Warn if missing terminal nodes","Warn if circular logic","Warn if prevalence not set","Flag evidence older than 10 years"].map((l,i) => (
                <label key={l} className="row" style={{fontSize:13, cursor:"pointer"}}>
                  <input type="checkbox" defaultChecked={i < 4} style={{accentColor:"var(--sme-orange)"}}/>{l}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Parallel block configuration — as a modal invoked from canvas toolbar
function ParallelModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div className="node__icon" style={{width:28, height:28, background:"var(--sme-orange-050)", color:"var(--sme-orange-600)"}}>
            <Icon name="merge" size={14}/>
          </div>
          <div>
            <h2>Group as parallel block</h2>
            <div className="u-meta">2 tests selected · tests run simultaneously</div>
          </div>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>
        <div className="modal__body">
          <div className="stack">
            <div className="field">
              <label className="field__label">Tests in block</label>
              <div className="stack" style={{gap:6}}>
                <div className="row" style={{padding:"8px 10px", background:"var(--surface-2)", borderRadius:4, border:"1px solid var(--edge)"}}>
                  <Icon name="scan"/><b>Chest X-Ray (CAD4TB)</b><div className="spacer"/><span className="chip chip--mono">Se 0.90</span>
                </div>
                <div className="row" style={{padding:"8px 10px", background:"var(--surface-2)", borderRadius:4, border:"1px solid var(--edge)"}}>
                  <Icon name="dna"/><b>Xpert MTB/RIF Ultra</b><div className="spacer"/><span className="chip chip--mono">Se 0.88</span>
                </div>
              </div>
            </div>

            <div className="field">
              <label className="field__label">Timing rule</label>
              <div className="btn-group">
                <button className="btn btn--ink" style={{flex:1}}>Max TAT (parallel)</button>
                <button className="btn" style={{flex:1}}>Sum TAT (sequential)</button>
              </div>
              <div className="field__hint">Parallel blocks report the longest test TAT, not the sum.</div>
            </div>

            <div className="field">
              <label className="field__label">Combined outputs</label>
              <div className="stack" style={{gap:6}}>
                <div className="row" style={{padding:"8px 10px", background:"var(--pos-050)", borderRadius:4, border:"1px solid var(--pos-100)"}}>
                  <span className="chip chip--pos">Both positive</span>
                  <div className="spacer"/>
                  <span className="u-meta">A(+) ∧ B(+)</span>
                </div>
                <div className="row" style={{padding:"8px 10px", background:"var(--neg-050)", borderRadius:4, border:"1px solid var(--neg-100)"}}>
                  <span className="chip chip--neg">Both negative</span>
                  <div className="spacer"/>
                  <span className="u-meta">A(−) ∧ B(−)</span>
                </div>
                <div className="row" style={{padding:"8px 10px", background:"var(--discord-050)", borderRadius:4, border:"1px solid var(--discord-100)"}}>
                  <span className="chip chip--disc">Discordant</span>
                  <div className="spacer"/>
                  <span className="u-meta">A(+) ⊕ B(+)</span>
                </div>
                <button className="btn btn--sm" style={{alignSelf:"flex-start"}}><Icon name="plus" size={11}/>Add custom combination</button>
              </div>
            </div>

            <div className="banner banner--info">
              <Icon name="info" size={16} className="banner__icon"/>
              <div>Parallel tests share sample type <b>sputum</b>, operational burden is not doubled.</div>
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={onClose}>Create parallel block</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenTrace, ScreenCompare, ScreenEvidence, ParallelModal });
