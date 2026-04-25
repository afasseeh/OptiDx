// ScreenReport — rich, audience-tailored decision report
// Audiences: Technical (HTA), Clinical, Policymaker. Each shows different sections.

const useState_R = useState;
const useMemo_R = useMemo;

// ---- Brand SVG icons for export formats -----------------------------------
function PdfLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}>
      <rect x="2" y="2" width="20" height="20" rx="2.5" fill="#E4322B"/>
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="7.4" fontFamily="Arial, sans-serif" fontWeight="800" letterSpacing="0.02em">PDF</text>
    </svg>
  );
}
function DocxLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}>
      <rect x="2" y="2" width="20" height="20" rx="2.5" fill="#185ABD"/>
      <path d="M5.4 7.6h2.05l1.3 6.5h.04l1.42-6.5h2.18l1.42 6.5h.04l1.3-6.5h2.05l-2.2 8.8h-2.18l-1.46-6.5h-.04l-1.46 6.5H7.6L5.4 7.6z" fill="#fff"/>
    </svg>
  );
}

// ---- Section catalog per audience -----------------------------------------
const REPORT_SECTIONS = [
  // id, label, audiences (T=technical, C=clinical, P=policymaker), defaultOn for each, page
  { id:"cover",       label:"Cover & executive summary",      aud:["T","C","P"], page:1 },
  { id:"diagram",     label:"Pathway diagram",                aud:["T","C","P"], page:1 },
  { id:"aggregate",   label:"Aggregate diagnostic accuracy",  aud:["T","C","P"], page:2 },
  { id:"params",      label:"Input parameters & priors",      aud:["T"],         page:2 },
  { id:"rules",       label:"Decision rules per node",        aud:["T","C"],     page:2 },
  { id:"pathtable",   label:"Path-level outcome table",       aud:["T"],         page:3 },
  { id:"sensitivity", label:"Sensitivity analysis (tornado)", aud:["T"],         page:3 },
  { id:"clinical",    label:"Clinical interpretation",        aud:["C","P"],     page:3 },
  { id:"workflow",    label:"Operational workflow & TAT",     aud:["C"],         page:4 },
  { id:"costing",     label:"Costing & resource use",         aud:["T","P"],     page:4 },
  { id:"budget",      label:"Budget impact (annual)",         aud:["P"],         page:4 },
  { id:"equity",      label:"Equity & access notes",          aud:["P"],         page:5 },
  { id:"comparators", label:"Comparator pathways",            aud:["T","P"],     page:5 },
  { id:"warnings",    label:"Warnings & assumptions",         aud:["T","C","P"], page:5 },
  { id:"evidence",    label:"Evidence sources & references",  aud:["T","C"],     page:6 },
  { id:"policy",      label:"Policymaker key takeaways",      aud:["P"],         page:6 },
  { id:"glossary",    label:"Glossary",                       aud:["C","P"],     page:6 },
];

const AUDIENCES = [
  { id:"T", label:"Technical (HTA analyst)",  desc:"Full methodology, parameters, sensitivity, path table." },
  { id:"C", label:"Clinical",                 desc:"Pathway interpretation, decision rules, workflow." },
  { id:"P", label:"Policymaker",              desc:"Aggregate impact, costing, equity, key takeaways." },
];

function defaultIncludesFor(audId) {
  const o = {};
  REPORT_SECTIONS.forEach(s => { o[s.id] = s.aud.includes(audId); });
  return o;
}

// ---------------------------------------------------------------------------
function ScreenReport({ setScreen, onShare }) {
  const [audience, setAudience] = useState_R("T");
  const [format, setFormat] = useState_R("pdf");
  const [includes, setIncludes] = useState_R(() => defaultIncludesFor("T"));

  // When audience changes, snap includes to that audience's defaults
  function chooseAudience(id) {
    setAudience(id);
    setIncludes(defaultIncludesFor(id));
  }

  const visible = useMemo_R(() => REPORT_SECTIONS.filter(s => s.aud.includes(audience) && includes[s.id]), [audience, includes]);
  const pageCount = useMemo_R(() => {
    const pages = new Set(visible.map(s => s.page));
    return Math.max(1, pages.size);
  }, [visible]);

  const audMeta = AUDIENCES.find(a => a.id === audience);
  const summaryText = useMemo_R(() => {
    const sectionLines = visible.map(s => `- ${s.label} (p.${s.page})`).join("\n");
    return [
      "OptiDx Report Preview",
      `Audience: ${audMeta.label}`,
      `Format: ${format.toUpperCase()}`,
      `Pages: ${pageCount}`,
      "",
      "Included sections:",
      sectionLines || "- None selected",
    ].join("\n");
  }, [audMeta.label, format, pageCount, visible]);

  return (
    <>
      <TopBar crumbs={["OptiDx","TB Community Screening","Report preview"]}
        actions={<>
          <button className="btn" onClick={() => window.OptiDxActions.copyText(summaryText)}><Icon name="copy"/>Copy summary</button>
          <button className="btn" onClick={onShare}><Icon name="upload"/>Share</button>
          <button className="btn" onClick={() => window.OptiDxActions.downloadText("optidx-report.docx.txt", summaryText)}>
            <DocxLogo size={14}/>Download DOCX
          </button>
          <button className="btn btn--primary" onClick={() => window.OptiDxActions.downloadText("optidx-report.pdf.txt", summaryText)}>
            <PdfLogo size={14}/>Download PDF
          </button>
        </>}/>

      <div style={{display:"grid", gridTemplateColumns:"300px 1fr", height:"100%", minHeight:0}}>
        {/* ---------- LEFT SIDEBAR ---------- */}
        <aside className="side" style={{width:"auto", overflow:"auto", minHeight:0}}>
          <div className="side__head"><h2>Report builder</h2></div>
          <div className="side__body" style={{paddingBottom:24}}>

            {/* Audience picker */}
            <div className="field">
              <label className="field__label">Audience</label>
              <div className="stack" style={{gap:6}}>
                {AUDIENCES.map(a => (
                  <label key={a.id} className="row" style={{
                    padding:"10px 12px", borderRadius:4, gap:10, alignItems:"flex-start",
                    cursor:"pointer", fontSize:12,
                    border:"1px solid " + (audience === a.id ? "var(--sme-orange)" : "var(--edge)"),
                    background: audience === a.id ? "var(--sme-orange-050)" : "var(--surface)",
                  }}>
                    <input type="radio" name="aud" checked={audience === a.id}
                      onChange={() => chooseAudience(a.id)}
                      style={{accentColor:"var(--sme-orange)", marginTop:2}}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:13, fontWeight:700, color:"var(--sme-ink-900)"}}>{a.label}</div>
                      <div className="u-meta" style={{marginTop:2, lineHeight:1.45, whiteSpace:"normal"}}>{a.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider"/>

            {/* Format with brand logos */}
            <div className="field">
              <label className="field__label">Format</label>
              <div className="stack" style={{gap:6}}>
                <label className="row" style={{
                  padding:"10px 12px", borderRadius:4, gap:10, cursor:"pointer", fontSize:13,
                  border:"1px solid " + (format === "pdf" ? "var(--sme-orange)" : "var(--edge)"),
                  background: format === "pdf" ? "var(--sme-orange-050)" : "var(--surface)",
                }}>
                  <input type="radio" name="fmt" checked={format === "pdf"} onChange={() => setFormat("pdf")} style={{accentColor:"var(--sme-orange)"}}/>
                  <PdfLogo size={20}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>PDF</div>
                    <div className="u-meta">Print-ready, signed digital report</div>
                  </div>
                </label>
                <label className="row" style={{
                  padding:"10px 12px", borderRadius:4, gap:10, cursor:"pointer", fontSize:13,
                  border:"1px solid " + (format === "docx" ? "var(--sme-orange)" : "var(--edge)"),
                  background: format === "docx" ? "var(--sme-orange-050)" : "var(--surface)",
                }}>
                  <input type="radio" name="fmt" checked={format === "docx"} onChange={() => setFormat("docx")} style={{accentColor:"var(--sme-orange)"}}/>
                  <DocxLogo size={20}/>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700}}>Microsoft Word (.docx)</div>
                    <div className="u-meta">Editable for ministry templates</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="divider"/>

            {/* Section toggles, only those relevant to audience */}
            <div className="field">
              <div className="row" style={{marginBottom:8}}>
                <label className="field__label" style={{margin:0}}>Sections</label>
                <div className="spacer"/>
                <span className="u-meta">{visible.length} on</span>
              </div>
              <div className="stack" style={{gap:2}}>
                {REPORT_SECTIONS.filter(s => s.aud.includes(audience)).map(s => (
                  <label key={s.id} className="row" style={{padding:"5px 0", fontSize:12, cursor:"pointer", gap:8}}>
                    <input type="checkbox" checked={!!includes[s.id]}
                      onChange={e => setIncludes(prev => ({...prev, [s.id]: e.target.checked}))}
                      style={{accentColor:"var(--sme-orange)"}}/>
                    <span style={{flex:1}}>{s.label}</span>
                    <span className="u-meta" style={{fontSize:10}}>p.{s.page}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="divider"/>
            <div style={{padding:"10px 12px", background:"var(--surface-2)", border:"1px solid var(--edge)", borderRadius:4, fontSize:11, color:"var(--fg-2)", lineHeight:1.5}}>
              <b style={{color:"var(--sme-ink-900)"}}>{visible.length} sections · {pageCount} page{pageCount > 1 ? "s" : ""}</b><br/>
              Tailored for <b style={{color:"var(--sme-orange-600)"}}>{audMeta.label}</b>.
            </div>
          </div>
        </aside>

        {/* ---------- DOCUMENT PREVIEW ---------- */}
        <main style={{overflow:"auto", padding:"16px 32px 32px", background:"var(--surface-3)"}}>
          <ReportDocument audience={audience} visible={visible} pageCount={pageCount}/>
        </main>
      </div>
    </>
  );
}

// ---------- DOCUMENT -------------------------------------------------------
function ReportDocument({ audience, visible, pageCount }) {
  // Group sections by page
  const pages = useMemo_R(() => {
    const byPage = {};
    visible.forEach(s => {
      if (!byPage[s.page]) byPage[s.page] = [];
      byPage[s.page].push(s);
    });
    return Object.keys(byPage).sort((a,b) => +a - +b).map(p => ({ num:+p, sections: byPage[p] }));
  }, [visible]);

  const audLabel = AUDIENCES.find(a => a.id === audience).label;
  const totalPages = pages.length;

  return (
    <div style={{maxWidth:840, margin:"0 auto", display:"flex", flexDirection:"column", gap:24, paddingBottom:32}}>
      {pages.map((p, i) => (
        <ReportPage key={p.num} pageNum={i+1} totalPages={totalPages} audience={audience} audLabel={audLabel}>
          {p.sections.map((s, si) => <ReportSection key={s.id} section={s} first={si === 0 && i === 0}/>)}
        </ReportPage>
      ))}
      {pages.length === 0 && (
        <div style={{padding:80, textAlign:"center", background:"#fff", border:"1px dashed var(--edge-2)", borderRadius:6, color:"var(--fg-3)"}}>
          No sections selected. Toggle sections in the sidebar.
        </div>
      )}
    </div>
  );
}

function ReportPage({ pageNum, totalPages, audience, audLabel, children }) {
  return (
    <div style={{
      background:"#fff",
      boxShadow:"var(--shadow-3)",
      padding:"42px 52px 36px",
      minHeight:1100,
      position:"relative",
      borderRadius:2,
    }}>
      {/* page header band on first page */}
      {pageNum === 1 && <ReportHeader audLabel={audLabel}/>}
      {pageNum !== 1 && <ReportRunningHeader audLabel={audLabel}/>}

      <div>{children}</div>

      {/* footer */}
      <div style={{
        position:"absolute", left:52, right:52, bottom:18,
        borderTop:"1px solid var(--edge)", paddingTop:10,
        display:"flex", justifyContent:"space-between",
        fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:"var(--fg-3)",
      }}>
        <span>TODAY'S RESEARCH FOR TOMORROW'S HEALTH</span>
        <span>www.syreon.me</span>
        <span>Page {pageNum} / {totalPages}</span>
      </div>
    </div>
  );
}

function ReportHeader({ audLabel }) {
  return (
    <>
      <div style={{display:"flex", alignItems:"flex-start", borderBottom:"3px solid var(--sme-orange)", paddingBottom:14, marginBottom:22}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:"flex", alignItems:"center", gap:10, marginBottom:8}}>
            <div style={{
              width:32, height:32, borderRadius:4,
              background:"var(--sme-orange)", color:"#fff",
              display:"grid", placeItems:"center",
              fontFamily:"var(--font-display)", fontWeight:800, fontSize:12, letterSpacing:"0.04em",
            }}>SME</div>
            <div>
              <div style={{fontSize:11, fontWeight:800, color:"var(--sme-orange-600)", letterSpacing:"0.08em", fontFamily:"var(--font-display)"}}>SYREON</div>
              <div className="u-meta" style={{fontSize:9, letterSpacing:"0.1em"}}>HEALTH TECHNOLOGY ASSESSMENT</div>
            </div>
          </div>
          <div className="sme-eyebrow" style={{marginBottom:4, color:"var(--fg-3)"}}>OptiDx Decision Report</div>
          <h1 style={{fontSize:24, marginBottom:6, color:"var(--sme-ink-900)", fontFamily:"var(--font-display)"}}>TB Community Screening Pathway</h1>
          <div className="u-meta">v3 · Computed 24 Apr 2026 · Prevalence 8% · {audLabel} edition</div>
        </div>
        <div style={{textAlign:"right", fontSize:10, color:"var(--fg-3)", lineHeight:1.5, paddingLeft:16, flexShrink:0}}>
          <div style={{fontWeight:800, color:"var(--sme-ink-900)", letterSpacing:"0.16em"}}>CONFIDENTIAL</div>
          <div>For intended recipients only</div>
          <div style={{marginTop:6, padding:"2px 6px", display:"inline-block", background:"var(--sme-orange-050)", color:"var(--sme-orange-600)", border:"1px solid var(--sme-orange-100)", borderRadius:2, fontWeight:700}}>BETA</div>
        </div>
      </div>
    </>
  );
}

function ReportRunningHeader({ audLabel }) {
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      paddingBottom:8, marginBottom:18,
      borderBottom:"1px solid var(--edge)",
      fontSize:10, color:"var(--fg-3)", letterSpacing:"0.08em", textTransform:"uppercase",
    }}>
      <span style={{
        width:14, height:14, borderRadius:2,
        background:"var(--sme-orange)", color:"#fff",
        display:"inline-grid", placeItems:"center",
        fontFamily:"var(--font-display)", fontWeight:800, fontSize:7,
      }}>SME</span>
      <span style={{fontWeight:700, color:"var(--sme-ink-900)"}}>OptiDx · TB Community Screening v3</span>
      <span style={{flex:1}}/>
      <span>{audLabel}</span>
    </div>
  );
}

// ---------- SECTIONS -------------------------------------------------------
function ReportSection({ section, first }) {
  const Comp = SECTION_RENDERERS[section.id];
  if (!Comp) return null;
  return (
    <section style={{marginBottom:22}}>
      {!first && <h2 style={{fontSize:15, margin:"4px 0 10px", color:"var(--sme-ink-900)", fontFamily:"var(--font-display)", letterSpacing:"0.01em"}}>{section.label}</h2>}
      {first && <h2 style={{fontSize:15, margin:"0 0 10px", color:"var(--sme-ink-900)", fontFamily:"var(--font-display)"}}>{section.label}</h2>}
      <Comp/>
    </section>
  );
}

const SECTION_RENDERERS = {
  cover: () => (
    <p style={{lineHeight:1.65, fontSize:13, color:"var(--fg-1)", marginBottom:10}}>
      Under a prevalence of <b>8%</b> in the target community, the proposed three-step pathway
      (WHO-4 symptom screening → CAD4TB chest X-ray → Xpert MTB/RIF Ultra) achieves an
      aggregate sensitivity of <b>84.2%</b> and specificity of <b>94.6%</b>, at an expected cost
      of <b>$5.62</b> per patient screened. Mean turnaround is <b>2.8 hours</b>. The pathway is
      <b> feasible</b> under the declared operational constraints with one warning: aggregate
      sensitivity falls 0.8 pp below the user-defined minimum of 85%.
    </p>
  ),

  diagram: () => (
    <div style={{background:"var(--canvas-bg)", padding:18, border:"1px solid var(--edge)", borderRadius:6, marginBottom:6}}>
      <svg viewBox="0 0 720 200" width="100%" style={{maxHeight:200}}>
        <defs>
          <marker id="arR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--pos)"/>
          </marker>
        </defs>
        {[
          ["WHO-4 symptom", 30, "Se 0.71"],
          ["CAD4TB CXR",   240, "Se 0.90"],
          ["Xpert Ultra",  450, "Se 0.88"],
        ].map(([l,x,s]) => (
          <g key={l}>
            <rect x={x} y="70" width="150" height="60" fill="#fff" stroke="var(--edge-2)" rx="4"/>
            <text x={x+75} y="95" fontSize="12" fontWeight="700" textAnchor="middle" fill="var(--sme-ink-900)">{l}</text>
            <text x={x+75} y="115" fontSize="10" textAnchor="middle" fill="var(--fg-3)" fontFamily="monospace">{s}</text>
          </g>
        ))}
        <rect x="620" y="32" width="80" height="34" fill="var(--pos-050)" stroke="var(--pos-100)" rx="4"/>
        <text x="660" y="54" fontSize="11" fontWeight="700" fill="var(--pos)" textAnchor="middle">TB · Treat</text>
        <rect x="620" y="134" width="80" height="34" fill="var(--neg-050)" stroke="var(--neg-100)" rx="4"/>
        <text x="660" y="156" fontSize="11" fontWeight="700" fill="var(--neg)" textAnchor="middle">No TB</text>
        <path d="M180 100 L240 100" stroke="var(--pos)" strokeWidth="1.6" fill="none" markerEnd="url(#arR)"/>
        <path d="M390 100 L450 100" stroke="var(--pos)" strokeWidth="1.6" fill="none" markerEnd="url(#arR)"/>
        <path d="M600 100 L620 50"  stroke="var(--pos)" strokeWidth="1.6" fill="none"/>
        <path d="M600 100 L620 150" stroke="var(--neg)" strokeWidth="1.6" strokeDasharray="4 3" fill="none"/>
      </svg>
    </div>
  ),

  aggregate: () => (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:8}}>
      <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:12}}>
        <tbody>
          <tr><td>Sensitivity</td><td className="num mono"><b>84.2%</b></td></tr>
          <tr><td>Specificity</td><td className="num mono"><b>94.6%</b></td></tr>
          <tr><td>False neg. rate</td><td className="num mono">15.8%</td></tr>
          <tr><td>False pos. rate</td><td className="num mono">5.4%</td></tr>
        </tbody>
      </table>
      <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:12}}>
        <tbody>
          <tr><td>PPV @ 8% prev.</td><td className="num mono">58.0%</td></tr>
          <tr><td>NPV @ 8% prev.</td><td className="num mono">98.7%</td></tr>
          <tr><td>Expected cost</td><td className="num mono"><b>$5.62</b></td></tr>
          <tr><td>Turnaround time</td><td className="num mono"><b>2.8 hr</b></td></tr>
        </tbody>
      </table>
    </div>
  ),

  params: () => (
    <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:12}}>
      <thead><tr><th>Parameter</th><th>Value</th><th>Source</th></tr></thead>
      <tbody>
        <tr><td>Prevalence (community)</td><td className="num mono">8.0%</td><td>Local prevalence survey, 2024</td></tr>
        <tr><td>WHO-4 symptom Se / Sp</td><td className="num mono">0.71 / 0.78</td><td>WHO 2021 systematic review</td></tr>
        <tr><td>CAD4TB Se / Sp (threshold 60)</td><td className="num mono">0.90 / 0.79</td><td>Qin et al., Lancet Digit Health 2023</td></tr>
        <tr><td>Xpert MTB/RIF Ultra Se / Sp</td><td className="num mono">0.88 / 0.97</td><td>Cochrane review CD009593 (2021)</td></tr>
        <tr><td>Conditional independence</td><td>Assumed (CXR ⊥ Xpert | TB)</td><td>User-defined</td></tr>
        <tr><td>Cost: WHO-4 screen</td><td className="num mono">$0.30</td><td>Local activity-based costing</td></tr>
        <tr><td>Cost: CAD4TB CXR</td><td className="num mono">$2.40</td><td>Local activity-based costing</td></tr>
        <tr><td>Cost: Xpert Ultra</td><td className="num mono">$10.80</td><td>GDF concessionary price 2025</td></tr>
      </tbody>
    </table>
  ),

  rules: () => (
    <div className="stack" style={{gap:8}}>
      {[
        ["Node 1, WHO-4 symptom", "If POSITIVE → CXR. If NEGATIVE → exit (No TB)."],
        ["Node 2, CAD4TB",        "If score ≥ 60 → Xpert. If < 60 → exit (No TB)."],
        ["Node 3, Xpert Ultra",   "If MTB DETECTED → Treat. If NOT DETECTED → exit (No TB)."],
      ].map(([t,r]) => (
        <div key={t} style={{padding:"10px 12px", border:"1px solid var(--edge)", borderRadius:4, background:"var(--surface-2)"}}>
          <div style={{fontSize:12, fontWeight:700, color:"var(--sme-ink-900)", marginBottom:2}}>{t}</div>
          <div style={{fontSize:12, color:"var(--fg-2)"}}>{r}</div>
        </div>
      ))}
    </div>
  ),

  pathtable: () => (
    <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:11}}>
      <thead>
        <tr><th>Path</th><th>Sequence</th><th>P(disease)</th><th>P(path)</th><th>Cost</th><th>TAT</th></tr>
      </thead>
      <tbody>
        <tr><td>P1</td><td>S+ → CXR+ → Xpert+</td><td className="num mono">0.978</td><td className="num mono">0.067</td><td className="num mono">$13.50</td><td className="num mono">3.2h</td></tr>
        <tr><td>P2</td><td>S+ → CXR+ → Xpert−</td><td className="num mono">0.012</td><td className="num mono">0.022</td><td className="num mono">$13.50</td><td className="num mono">3.2h</td></tr>
        <tr><td>P3</td><td>S+ → CXR− (exit)</td><td className="num mono">0.018</td><td className="num mono">0.142</td><td className="num mono">$2.70</td><td className="num mono">0.6h</td></tr>
        <tr><td>P4</td><td>S− (exit)</td><td className="num mono">0.022</td><td className="num mono">0.769</td><td className="num mono">$0.30</td><td className="num mono">0.1h</td></tr>
      </tbody>
    </table>
  ),

  sensitivity: () => (
    <div style={{border:"1px solid var(--edge)", borderRadius:4, padding:14, background:"var(--surface-2)"}}>
      <div style={{fontSize:11, color:"var(--fg-3)", marginBottom:8}}>Tornado plot, impact on aggregate sensitivity (±20%)</div>
      <svg viewBox="0 0 600 130" width="100%">
        <line x1="300" y1="10" x2="300" y2="120" stroke="var(--edge-2)"/>
        {[
          ["Xpert Se",     -68, 70, "#F37739"],
          ["CAD4TB Se",    -55, 58, "#F37739"],
          ["WHO-4 Se",     -42, 45, "#F37739"],
          ["Prevalence",   -18, 18, "#9098A0"],
          ["Cond. indep.", -12, 12, "#9098A0"],
        ].map(([l, neg, pos, c], i) => {
          const y = 14 + i*22;
          return (
            <g key={l}>
              <text x="294" y={y+5} fontSize="10" textAnchor="end" fill="var(--fg-2)">{l}</text>
              <rect x={300+neg} y={y-6} width={-neg} height="12" fill={c} opacity="0.55"/>
              <rect x="300" y={y-6} width={pos} height="12" fill={c}/>
            </g>
          );
        })}
        <text x="220" y="128" fontSize="9" fill="var(--fg-3)">−10 pp</text>
        <text x="375" y="128" fontSize="9" fill="var(--fg-3)">+10 pp</text>
      </svg>
    </div>
  ),

  clinical: () => (
    <p style={{fontSize:13, lineHeight:1.65, color:"var(--fg-1)"}}>
      In a community of 10 000 individuals at 8% TB prevalence, this pathway would correctly
      identify <b>674 of 800</b> people with active TB (true positives) while sparing
      <b> 8 703 of 9 200</b> uninfected individuals from confirmatory testing. <b>126 cases
      would be missed</b> at the symptom-screen and CXR steps; <b>497 false positives</b> would
      proceed to Xpert and be cleared. The clinical implication: this pathway is well-suited to
      high-throughput community settings where Xpert capacity is constrained, but should be
      paired with active follow-up of symptomatic patients screened-out at Node 1.
    </p>
  ),

  workflow: () => (
    <div className="stack" style={{gap:8}}>
      {[
        ["Step 1, Symptom screen", "Community health worker · WHO-4 questionnaire · 5 min · No sample"],
        ["Step 2, Digital CXR + CAD4TB", "Mobile X-ray unit · CAD4TB v7 read · 15 min · Image"],
        ["Step 3, Xpert MTB/RIF Ultra", "Decentralised lab · GeneXpert IV · 2 hr 30 min · Sputum"],
        ["Result return", "SMS to patient + facility · within 24 hr of Step 3"],
      ].map(([t, d]) => (
        <div key={t} className="row" style={{padding:"10px 12px", border:"1px solid var(--edge)", borderRadius:4}}>
          <div style={{width:6, height:36, background:"var(--sme-orange)", borderRadius:1}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:12, fontWeight:700, color:"var(--sme-ink-900)"}}>{t}</div>
            <div className="u-meta" style={{marginTop:2}}>{d}</div>
          </div>
        </div>
      ))}
    </div>
  ),

  costing: () => (
    <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:12}}>
      <thead><tr><th>Resource</th><th>Unit cost</th><th>Per 1 000 screened</th><th>Annual @ 50k</th></tr></thead>
      <tbody>
        <tr><td>WHO-4 screen (CHW time)</td><td className="num mono">$0.30</td><td className="num mono">$300</td><td className="num mono">$15 000</td></tr>
        <tr><td>CAD4TB CXR</td><td className="num mono">$2.40</td><td className="num mono">$553</td><td className="num mono">$27 650</td></tr>
        <tr><td>Xpert MTB/RIF Ultra cartridge</td><td className="num mono">$10.80</td><td className="num mono">$960</td><td className="num mono">$48 000</td></tr>
        <tr><td>Sample transport & lab time</td><td className="num mono">$0.85</td><td className="num mono">$76</td><td className="num mono">$3 800</td></tr>
        <tr style={{background:"var(--surface-2)"}}><td><b>Total</b></td><td/><td className="num mono"><b>$1 889</b></td><td className="num mono"><b>$94 450</b></td></tr>
      </tbody>
    </table>
  ),

  budget: () => (
    <div className="grid" style={{gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
      {[
        ["Annual screening volume", "50 000", "people"],
        ["TB cases detected", "3 370", "cases / year"],
        ["Cost per case detected", "$28.03", "all-in"],
        ["Total annual cost", "$94 450", "operational"],
        ["Cost vs. status quo", "−18%", "smear-microscopy baseline"],
        ["Break-even at", "Year 1.4", "vs. status quo"],
      ].map(([l,v,sub]) => (
        <div key={l} style={{padding:"12px 14px", border:"1px solid var(--edge)", borderRadius:4, background:"var(--surface)"}}>
          <div className="u-meta" style={{fontSize:10, marginBottom:4}}>{l}</div>
          <div style={{fontSize:18, fontWeight:800, color:"var(--sme-ink-900)", fontFamily:"var(--font-display)"}}>{v}</div>
          <div style={{fontSize:11, color:"var(--fg-3)"}}>{sub}</div>
        </div>
      ))}
    </div>
  ),

  equity: () => (
    <ul style={{paddingLeft:20, lineHeight:1.7, fontSize:13}}>
      <li><b>Geographic reach.</b> Mobile CXR + decentralised Xpert reduces travel burden for rural communities by ~3.5 hours per visit vs. central referral.</li>
      <li><b>Gender.</b> Symptom-screen sensitivity is 6 pp lower in women than men in published cohorts; supplemental CXR mitigates this gap.</li>
      <li><b>Cost to patient.</b> Pathway is delivered free at point of care under the proposed configuration.</li>
      <li><b>Stigma.</b> Screening at community sites (vs. TB-specific clinics) reduces self-deselection in published programmes.</li>
    </ul>
  ),

  comparators: () => (
    <table className="table" style={{border:"1px solid var(--edge)", borderRadius:4, fontSize:12}}>
      <thead><tr><th>Pathway</th><th>Se</th><th>Sp</th><th>Cost</th><th>TAT</th></tr></thead>
      <tbody>
        <tr style={{background:"var(--sme-orange-050)"}}><td><b>Proposed (S → CXR → Xpert)</b></td><td className="num mono"><b>84.2%</b></td><td className="num mono"><b>94.6%</b></td><td className="num mono"><b>$5.62</b></td><td className="num mono"><b>2.8h</b></td></tr>
        <tr><td>Symptom + Xpert (no CXR)</td><td className="num mono">62.5%</td><td className="num mono">97.6%</td><td className="num mono">$8.10</td><td className="num mono">2.6h</td></tr>
        <tr><td>CXR-only mass screen</td><td className="num mono">90.0%</td><td className="num mono">79.0%</td><td className="num mono">$2.40</td><td className="num mono">0.3h</td></tr>
        <tr><td>Smear microscopy (status quo)</td><td className="num mono">61.0%</td><td className="num mono">98.0%</td><td className="num mono">$1.80</td><td className="num mono">2.0h</td></tr>
      </tbody>
    </table>
  ),

  warnings: () => (
    <ul style={{paddingLeft:20, lineHeight:1.7, fontSize:13}}>
      <li><b>Conditional independence assumed</b> between CXR and Xpert given disease status. Violations will inflate aggregate sensitivity.</li>
      <li>Aggregate sensitivity (<b>84.2%</b>) is <b>0.8 pp below</b> the user-defined minimum threshold of 85%.</li>
      <li>Three sample types required across pathway: <b>none, imaging, sputum</b>, operational complexity.</li>
      <li>Costing uses 2025 GDF concessionary cartridge pricing; non-GDF buyers should re-cost Node 3.</li>
    </ul>
  ),

  evidence: () => (
    <ol style={{paddingLeft:20, lineHeight:1.7, fontSize:12, color:"var(--fg-1)"}}>
      <li>WHO. <i>Systematic screening for active tuberculosis: principles and recommendations.</i> 2021 update.</li>
      <li>Qin ZZ et al. CAD for TB triage: a multi-country diagnostic accuracy study. <i>Lancet Digit Health</i>. 2023.</li>
      <li>Cochrane Collaboration. Xpert MTB/RIF Ultra for pulmonary TB diagnosis. <i>Cochrane Database Syst Rev</i>. CD009593 (2021).</li>
      <li>Stop TB Partnership. <i>Global Drug Facility cartridge pricing 2025.</i></li>
      <li>Local prevalence survey 2024 (data on file, Syreon).</li>
    </ol>
  ),

  policy: () => (
    <div className="stack" style={{gap:10}}>
      {[
        ["Detect 3 370 TB cases per year at 50k screening volume", "pos"],
        ["18% lower per-case cost vs. smear-microscopy baseline", "pos"],
        ["Pathway is operationally feasible with mobile CXR + decentralised Xpert", "pos"],
        ["Aggregate sensitivity is 0.8 pp below the user-defined target", "warn"],
        ["Requires sustained Xpert cartridge supply (GDF or equivalent procurement)", "warn"],
      ].map(([t, k]) => (
        <div key={t} className="row" style={{
          padding:"10px 12px", borderRadius:4,
          background: k === "pos" ? "var(--pos-050)" : "var(--warn-050, #FFF6E5)",
          border: "1px solid " + (k === "pos" ? "var(--pos-100)" : "var(--warn-100, #FFE0A6)"),
        }}>
          <Icon name={k === "pos" ? "check" : "info"} size={14} style={{color: k === "pos" ? "var(--pos)" : "var(--sme-orange-600)"}}/>
          <div style={{fontSize:13, color:"var(--fg-1)"}}>{t}</div>
        </div>
      ))}
    </div>
  ),

  glossary: () => (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:6, fontSize:11}}>
      {[
        ["Sensitivity", "Probability the test is positive when disease is present."],
        ["Specificity", "Probability the test is negative when disease is absent."],
        ["PPV", "Probability of disease given a positive test result."],
        ["NPV", "Probability of no disease given a negative test result."],
        ["TAT", "Turnaround time from sample to result."],
        ["Conditional independence", "Two tests are independent given disease status."],
      ].map(([t,d]) => (
        <div key={t} style={{padding:"8px 10px", border:"1px solid var(--edge)", borderRadius:3, background:"var(--surface-2)"}}>
          <div style={{fontWeight:700, color:"var(--sme-ink-900)"}}>{t}</div>
          <div style={{color:"var(--fg-2)", marginTop:2, lineHeight:1.5}}>{d}</div>
        </div>
      ))}
    </div>
  ),
};

Object.assign(window, { ScreenReport });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
