import React, { useState, useEffect, useMemo, useRef } from 'react';

// OptiDx — main app
function App() {
  const [authed, setAuthed] = useState(false);
  const [authMode, setAuthMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("auth") === "reset" ? "reset" : "login";
  });
  const [screen, setScreen] = useState("home");
  const [variant, setVariant] = useState({ canvas: "A", results: "A" });
  const [openPanel, setOpenPanel] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showTestEditor, setShowTestEditor] = useState(false);
  const [testEditorSeed, setTestEditorSeed] = useState(null);

  // Tweaks panel
  useEffect(() => {
    const handler = e => {
      if (e.data?.type === "__activate_edit_mode") setShowTweaks(true);
      if (e.data?.type === "__deactivate_edit_mode") setShowTweaks(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({type:"__edit_mode_available"}, "*");
    return () => window.removeEventListener("message", handler);
  }, []);
  const [showTweaks, setShowTweaks] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    window.axios?.get('/auth/me')
      .then(response => {
        if (!active) return;
        if (response?.data?.authenticated) {
          setAuthed(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSessionChecked(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authed) {
      return;
    }

    let active = true;
    window.OptiDxActions?.loadWorkspaceData?.()
      .catch(() => {})
      .finally(() => {
        if (active) {
          setWorkspaceLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [authed]);

  useEffect(() => {
    const handler = event => {
      setTestEditorSeed(event?.detail || null);
      setShowTestEditor(true);
    };

    window.addEventListener('optidx-open-test-editor', handler);
    return () => window.removeEventListener('optidx-open-test-editor', handler);
  }, []);

  if (!sessionChecked && !authed) {
    return (
      <div className="app" style={{minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--surface)"}}>
        <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:12}}>
          <LogoMark size={54}/>
          <div style={{fontSize:12, color:"var(--fg-3)"}}>Checking session...</div>
        </div>
      </div>
    );
  }

  if (!authed) return <AuthShell mode={authMode} setMode={setAuthMode} onAuthed={() => { setAuthed(true); setAuthMode("login"); }}/>;

  return (
    <div className="app">
      <BetaBanner onOpenFeedback={() => setShowFeedback(true)}/>
      <Rail screen={screen} setScreen={setScreen} onHelp={() => setShowFeedback(true)}/>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)}/>}
      {screen === "home"     && <Frame><ScreenHome setScreen={setScreen}/></Frame>}
      {screen === "library"  && <Frame><ScreenLibrary setScreen={setScreen}/></Frame>}
      {screen === "wizard"   && <Frame><ScreenWizard setScreen={setScreen}/></Frame>}
      {screen === "scenarios"&& <Frame><ScreenScenarios setScreen={setScreen}/></Frame>}
      {screen === "canvas"   && <CanvasWrapper variant={variant.canvas} setVariant={v => setVariant(s => ({...s, canvas:v}))}
                                  openPanel={openPanel} setOpenPanel={setOpenPanel} setScreen={setScreen}/>}
      {screen === "results"  && <ResultsWrapper variant={variant.results} setVariant={v => setVariant(s => ({...s, results:v}))} setScreen={setScreen} onShare={() => setShowShare(true)}/>}
      {screen === "trace"    && <Frame><ScreenTrace setScreen={setScreen}/></Frame>}
      {screen === "compare"  && <Frame><ScreenCompare setScreen={setScreen}/></Frame>}
      {screen === "evidence" && <Frame><ScreenEvidence setScreen={setScreen}/></Frame>}
      {screen === "report"   && <Frame fullBleed><ScreenReport setScreen={setScreen} onShare={() => setShowShare(true)}/></Frame>}
      {screen === "settings" && <Frame><ScreenSettingsFull/></Frame>}
      {screen === "teams"    && <Frame><ScreenTeams/></Frame>}

      {openPanel === "parallel" && <ParallelModal onClose={() => setOpenPanel(null)}/>}
      {showTestEditor && <DiagnosticTestEditorModal
        seed={testEditorSeed}
        onClose={() => {
          setShowTestEditor(false);
          setTestEditorSeed(null);
        }}
      />}
      {showShare && <ShareModal onClose={() => setShowShare(false)}/>}
      {showTweaks && <OptiTweaks variant={variant} setVariant={setVariant} onClose={() => { setShowTweaks(false); window.parent.postMessage({type:"__edit_mode_dismissed"},"*"); }}/>}
    </div>
  );
}

function CanvasWrapper({ variant, setVariant, openPanel, setOpenPanel, setScreen }) {
  return (
    <Frame fullBleed>
      <TopBar
        crumbs={[
          { label: "OptiDx", onClick: () => setScreen("home"), title: "Back to home" },
          { label: "TB Community Screening", onClick: () => setScreen("wizard"), title: "Back to project setup" },
          { label: "Builder" },
        ]}
        actions={<>
          <div className="btn-group" style={{marginRight:6}}>
            <button className={"btn btn--sm " + (variant === "A" ? "btn--ink" : "")} onClick={() => setVariant("A")}>Layout A</button>
            <button className={"btn btn--sm " + (variant === "B" ? "btn--ink" : "")} onClick={() => setVariant("B")}>Layout B</button>
          </div>
          <button className="btn" onClick={async () => {
            try {
              await window.OptiDxActions.savePathway?.();
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to save pathway", "error");
            }
          }}><Icon name="save"/>Save</button>
          <button className="btn" onClick={() => window.OptiDxActions.downloadJson("optidx-pathway.json", window.OptiDxCurrentPathway || window.OptiDxCanvasDraft || window.SEED_PATHWAY || {})}><Icon name="download"/>Export</button>
          <button className="btn btn--primary" onClick={async () => {
            try {
              await window.OptiDxActions.evaluatePathway?.(window.OptiDxCurrentPathway || window.OptiDxCanvasDraft || window.SEED_PATHWAY || null);
              setScreen("results");
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to evaluate pathway", "error");
            }
          }}><Icon name="play"/>Run pathway</button>
        </>}/>
      <ScreenCanvas variant={variant} openPanel={openPanel} setOpenPanel={setOpenPanel}/>
    </Frame>
  );
}

function ResultsWrapper({ variant, setVariant, setScreen, onShare }) {
  return (
    <Frame>
      <ScreenResults variant={variant} setVariant={setVariant} setScreen={setScreen} onShare={onShare}/>
    </Frame>
  );
}

// --- Tweaks panel ---
function OptiTweaks({ variant, setVariant, onClose }) {
  return (
    <div style={{position:"fixed", right:16, top:64, width:280, zIndex:40,
      background:"#fff", border:"1px solid var(--edge)", borderRadius:8, boxShadow:"var(--shadow-4)"}}>
      <div style={{padding:"12px 14px", borderBottom:"1px solid var(--edge)", display:"flex", alignItems:"center", gap:8}}>
        <Icon name="sliders" size={14}/>
        <b style={{fontSize:13}}>Tweaks</b>
        <div style={{flex:1}}/>
        <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
      </div>
      <div style={{padding:14}}>
        <div className="stack" style={{gap:14}}>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:"var(--fg-3)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6}}>Canvas layout</div>
            <div className="btn-group" style={{width:"100%"}}>
              <button className={"btn btn--sm " + (variant.canvas==="A" ? "btn--ink" : "")} style={{flex:1}} onClick={() => setVariant({...variant, canvas:"A"})}>Dot grid</button>
              <button className={"btn btn--sm " + (variant.canvas==="B" ? "btn--ink" : "")} style={{flex:1}} onClick={() => setVariant({...variant, canvas:"B"})}>Line grid</button>
            </div>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:"var(--fg-3)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6}}>Results layout</div>
            <div className="btn-group" style={{width:"100%"}}>
              <button className={"btn btn--sm " + (variant.results==="A" ? "btn--ink" : "")} style={{flex:1}} onClick={() => setVariant({...variant, results:"A"})}>Compact</button>
              <button className={"btn btn--sm " + (variant.results==="B" ? "btn--ink" : "")} style={{flex:1}} onClick={() => setVariant({...variant, results:"B"})}>Hero gauges</button>
            </div>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:"var(--fg-3)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6}}>Semantic palette</div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:4}}>
              <SwatchCtl v="pos" c="var(--pos)" label="Pos"/>
              <SwatchCtl v="neg" c="var(--neg)" label="Neg"/>
              <SwatchCtl v="disc" c="var(--discord)" label="Disc"/>
              <SwatchCtl v="inc" c="var(--inconcl)" label="Inc"/>
            </div>
          </div>
          <div style={{fontSize:11, color:"var(--fg-3)", lineHeight:1.5, borderTop:"1px solid var(--edge)", paddingTop:10}}>
            Variants are also available inline on the Builder and Results screens.
          </div>
        </div>
      </div>
    </div>
  );
}
function SwatchCtl({ c, label }) {
  return <div style={{textAlign:"center", cursor:"pointer"}}>
    <div style={{height:26, background:c, borderRadius:3, marginBottom:3}}/>
    <div style={{fontSize:10, color:"var(--fg-3)"}}>{label}</div>
  </div>;
}

// --- Design spec modal ---
function SpecModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:860, maxHeight:"calc(100vh - 48px)"}}>
        <div className="modal__head">
          <Icon name="file-text"/>
          <div><h2>OptiDx, Design handoff</h2><div className="u-meta">v0.1 · 24 Apr 2026</div></div>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>
        <div className="modal__body" style={{lineHeight:1.55, fontSize:13}}>
          <SpecContent/>
        </div>
      </div>
    </div>
  );
}

function buildDiagnosticTestDraft(seed = null) {
  const sampleTypes = Array.isArray(seed?.sample_types)
    ? seed.sample_types.join(", ")
    : seed?.sample
      ? seed.sample
      : "blood";
  const skillLabel = String(seed?.skill_level ?? seed?.skill ?? "3").toLowerCase();
  const skillLevel = Number(seed?.skill_level ?? seed?.skill);

  return {
    name: seed?.name || seed?.test || seed?.label || "",
    category: seed?.category || "clinical",
    sensitivity: seed?.sensitivity ?? seed?.sens ?? 0.8,
    specificity: seed?.specificity ?? seed?.spec ?? 0.8,
    cost: seed?.cost ?? 1,
    currency: seed?.currency || "USD",
    turnaround_time: seed?.turnaround_time ?? seed?.tat ?? 15,
    turnaround_time_unit: seed?.turnaround_time_unit || seed?.tatUnit || "min",
    sample_types: sampleTypes,
    skill_level: Number.isFinite(skillLevel)
      ? skillLevel
      : skillLabel.includes("chw") || skillLabel.includes("self")
        ? 1
        : skillLabel.includes("nurse")
          ? 2
          : skillLabel.includes("lab")
            ? 3
            : skillLabel.includes("radiolog") || skillLabel.includes("specialist")
              ? 4
              : 3,
    availability: seed?.availability ?? true,
    notes: seed?.notes || "",
    source: seed?.source || seed?.provenance?.source || "",
    country: seed?.country || seed?.provenance?.country || "",
    year: seed?.year || seed?.provenance?.year || "",
  };
}

function DiagnosticTestEditorModal({ seed, onClose }) {
  const [form, setForm] = useState(() => buildDiagnosticTestDraft(seed));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(buildDiagnosticTestDraft(seed));
  }, [seed]);

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const submit = async event => {
    event.preventDefault();
    if (saving) {
      return;
    }

    try {
      setSaving(true);
      await window.OptiDxActions.saveDiagnosticTest?.(form);
      onClose?.();
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to save test", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal modal--lg" onClick={e => e.stopPropagation()} onSubmit={submit} style={{width:920}}>
        <div className="modal__head">
          <div>
            <div className="u-meta" style={{textTransform:"uppercase", letterSpacing:"0.08em", fontSize:10, marginBottom:2}}>Diagnostic test</div>
            <h2>Create test</h2>
            <div className="u-meta">Capture the full record now instead of prompting for a name later.</div>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose}><Icon name="x"/></button>
        </div>
        <div className="modal__body">
          <div className="grid" style={{gridTemplateColumns:"1.4fr 0.8fr", gap:14}}>
            <div className="field">
              <label className="field__label">Test name</label>
              <input className="input" value={form.name} onChange={e => update("name", e.target.value)} required />
            </div>
            <div className="field">
              <label className="field__label">Category</label>
              <select className="select" value={form.category} onChange={e => update("category", e.target.value)}>
                {["clinical","molecular","imaging","rapid","biomarker","pathology"].map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>

            <div className="field">
              <label className="field__label">Sensitivity</label>
              <input className="input" type="number" min="0" max="1" step="0.01" value={form.sensitivity} onChange={e => update("sensitivity", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">Specificity</label>
              <input className="input" type="number" min="0" max="1" step="0.01" value={form.specificity} onChange={e => update("specificity", e.target.value)} />
            </div>

            <div className="field">
              <label className="field__label">Cost</label>
              <input className="input" type="number" min="0" step="0.01" value={form.cost} onChange={e => update("cost", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">Currency</label>
              <input className="input" value={form.currency} onChange={e => update("currency", e.target.value)} />
            </div>

            <div className="field">
              <label className="field__label">Turnaround time</label>
              <input className="input" type="number" min="0" step="0.1" value={form.turnaround_time} onChange={e => update("turnaround_time", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">TAT unit</label>
              <select className="select" value={form.turnaround_time_unit} onChange={e => update("turnaround_time_unit", e.target.value)}>
                <option value="min">Minutes</option>
                <option value="hr">Hours</option>
                <option value="day">Days</option>
              </select>
            </div>

            <div className="field">
              <label className="field__label">Sample types</label>
              <input className="input" value={form.sample_types} onChange={e => update("sample_types", e.target.value)} placeholder="blood, urine, sputum" />
              <div className="field__hint">Use commas to separate multiple sample types.</div>
            </div>
            <div className="field">
              <label className="field__label">Skill level</label>
              <select className="select" value={form.skill_level} onChange={e => update("skill_level", e.target.value)}>
                <option value={1}>1 - CHW / self</option>
                <option value={2}>2 - Nurse</option>
                <option value={3}>3 - Lab tech</option>
                <option value={4}>4 - Specialist</option>
                <option value={5}>5 - Specialist</option>
              </select>
            </div>

            <div className="field">
              <label className="field__label">Evidence source</label>
              <input className="input" value={form.source} onChange={e => update("source", e.target.value)} placeholder="WHO, journal article, internal catalog" />
            </div>
            <div className="field">
              <label className="field__label">Availability</label>
              <label className="row" style={{gap:8, alignItems:"center"}}>
                <input type="checkbox" checked={Boolean(form.availability)} onChange={e => update("availability", e.target.checked)} />
                <span className="u-meta">Available for selection in the library</span>
              </label>
            </div>

            <div className="field">
              <label className="field__label">Country</label>
              <input className="input" value={form.country} onChange={e => update("country", e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">Year</label>
              <input className="input" type="number" min="1900" max="2100" value={form.year} onChange={e => update("year", e.target.value)} />
            </div>

            <div className="field" style={{gridColumn:"1 / -1"}}>
              <label className="field__label">Notes</label>
              <textarea className="input" rows={4} value={form.notes} onChange={e => update("notes", e.target.value)} style={{resize:"vertical", minHeight:96}} />
            </div>
          </div>
        </div>
        <div className="modal__foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? "Saving..." : "Create test"}</button>
        </div>
      </form>
    </div>
  );
}

function SpecContent() {
  return <>
    <Spec title="1 · Product UX concept">
      <p>OptiDx is a diagnostic pathway design-and-evaluation canvas for non-technical users. It combines a drag-and-drop node editor (a-la n8n / React Flow) with a probabilistic pathway engine, surfaced through a workflow-first IA. The experience is built around three pillars: <b>compose</b> pathways visually, <b>evaluate</b> them probabilistically, and <b>communicate</b> results to mixed audiences (clinician, health economist, lab manager, policymaker).</p>
    </Spec>
    <Spec title="2 · Information architecture">
      <ol>
        <li><b>Workspace home</b>, recent pathways, templates, evidence, entry points.</li>
        <li><b>Wizard</b> (4 steps), disease → test library → constraints → review.</li>
        <li><b>Builder</b>, 3-pane canvas: library · canvas · properties.</li>
        <li><b>Results</b>, summary metrics, path-level trace, Sankey, trade-off, warnings.</li>
        <li><b>Compare</b>, optimization candidates table + radar + scatter.</li>
        <li><b>Evidence</b>, browseable DB with import-to-pathway.</li>
        <li><b>Report</b>, printable multi-page document with audience toggles.</li>
        <li><b>Settings</b>, profile, workspace, pathway defaults, branding, integrations.</li>
      </ol>
    </Spec>
    <Spec title="3 · Design tokens (Syreon-aligned)">
      <ul>
        <li><b>Accent:</b> <code>#F37739</code> (primary), <code>#EC743F</code> (pressed), <code>#FEF1E8</code> (tint).</li>
        <li><b>Neutral scale:</b> <code>#2C3338 → #F7F8F8</code> (8 stops).</li>
        <li><b>Semantic (new):</b> <code>--pos #3F7D5B</code>, <code>--neg #5A6B78</code>, <code>--discord #C08A2A</code>, <code>--inconcl #8A6AA8</code>, <code>--refer #4A7DA6</code>. All muted to coexist with the brand orange, no saturated software-UI greens/reds.</li>
        <li><b>Type:</b> Carlito 400/700 with Open Sans fallback. Scale 10 / 11 / 12 / 13 / 14 / 15 / 18 / 24 / 28.</li>
        <li><b>Spacing:</b> 4pt grid (4, 8, 12, 16, 24, 32, 48, 64).</li>
        <li><b>Radii:</b> 3 (chip) / 4 (input) / 6 (card) / 8 (node) / 10 (large card) / 999 (pill).</li>
        <li><b>Elevation:</b> 4 tiers; nodes at shadow-2, selected at shadow-3 + 2px orange ring, modals at shadow-4.</li>
      </ul>
    </Spec>
    <Spec title="4 · Node & edge visual language">
      <ul>
        <li><b>Test node</b> (default): white card, grey head, orange icon chip, Se/Sp/cost/TAT chips, pos + neg output ports.</li>
        <li><b>Parallel block:</b> dashed orange container wrapping 2+ test nodes, outputs: both-pos / both-neg / discordant / custom.</li>
        <li><b>Decision node:</b> amber header, IF/THEN rule builder.</li>
        <li><b>Referee node:</b> blue-tinted header, styled to signal confirmatory role.</li>
        <li><b>Terminal:</b> compact card, color-coded by subtype (pos/neg/inc/ref).</li>
        <li><b>Annotation:</b> pale yellow note, no ports.</li>
        <li><b>Edges:</b> bezier, 1.75 px. Positive = solid green. Negative = dashed grey-blue. Discordant = dotted amber. Inconclusive = long-dashed violet.</li>
      </ul>
    </Spec>
    <Spec title="5 · Canvas interaction spec">
      <ul>
        <li>Drag test card from library → drops at cursor position in canvas space (accounting for pan/zoom).</li>
        <li>Pan: click-drag empty canvas. Zoom: Ctrl/Cmd + wheel. Min 0.4× / max 2×.</li>
        <li>Node drag: mousedown on node body (not ports). Snap to 8px grid when toggled.</li>
        <li>Edge creation: drag from output port (pos/neg) to input port. Edge inherits port color.</li>
        <li>Edge condition: click edge → right panel opens rule builder. Natural-language preview updates live.</li>
        <li>Group as parallel: multi-select → toolbar action → modal with combined-output configuration.</li>
        <li>Validation runs on change; status pill (top-right) shows Valid / Warnings / Invalid with counts.</li>
      </ul>
    </Spec>
    <Spec title="6 · Condition builder">
      <p>Chip-based DSL: <i>TestRef</i> · <i>Operator</i> · <i>Value</i> · <i>ThenTarget</i>. Operators: =, ≠, AND, OR, XOR, IN. Values constrained by referenced test (pos/neg/score range). A natural-language preview sentence is generated server-side per rule. Advanced users can toggle to a plain-text expression.</p>
    </Spec>
    <Spec title="7 · Results dashboard layout">
      <p>Top row: 8 metric cards (compact) or 4 hero cards with dual gauges (hero). Warnings banner stack. Grid: (2fr) path-level trace table + (1fr) Sankey + trade-off summary. Bottom row: Cost contribution bars + TAT breakdown. Every metric is copy-on-click.</p>
    </Spec>
    <Spec title="8 · Accessibility">
      <ul>
        <li>All color pairs meet WCAG AA, semantic hues tested against surface-2.</li>
        <li>Keyboard: Tab through rail → top → library → canvas nodes. Arrow keys move selected node by 8px (Shift = 24px).</li>
        <li>Edges gain a visible <code>:focus</code> ring; rule builder is fully keyboard-operable.</li>
        <li>All icons paired with text or <code>aria-label</code>.</li>
        <li>Do-not-rely-on-color: edges are differentiated by dash pattern + label, not hue alone.</li>
      </ul>
    </Spec>
    <Spec title="9 · Responsive behavior">
      <ul>
        <li>Desktop first (≥1280). Tablet (≥1024): library and properties collapse to drawers; canvas full-width.</li>
        <li>Below 1024: builder switches to read-only view with "open on desktop" banner. Home, Results, Compare, Evidence, Report remain fully usable.</li>
      </ul>
    </Spec>
    <Spec title="10 · Microcopy">
      <ul>
        <li>Actions: <i>Add diagnostic test</i>, <i>Define routing rule</i>, <i>Group as parallel block</i>, <i>Run pathway analysis</i>.</li>
        <li>Warnings: <i>Sensitivity below threshold</i>, <i>Assumes conditional independence</i>, <i>Terminal branch missing</i>, <i>Discordant branch unresolved</i>.</li>
        <li>Empty states: <i>No pathways yet, start from a template or import JSON.</i></li>
      </ul>
    </Spec>
    <Spec title="11 · Assumptions">
      <ul>
        <li>Pathway algorithm is server-side; UI treats results as read-only payload.</li>
        <li>Evidence DB is centrally curated with periodic Cochrane/WHO ingest.</li>
        <li>Single-user editing per pathway for v1; real-time collaboration deferred.</li>
        <li>Licensing: Carlito (OFL) shipped, no Calibri dependency.</li>
      </ul>
    </Spec>
    <Spec title="12 · Frontend handoff">
      <p>Stack: <b>React + TypeScript + Tailwind + shadcn/ui + React Flow</b>. Directory:</p>
      <pre style={{background:"var(--surface-2)", padding:12, borderRadius:4, fontSize:11, overflow:"auto"}}>{`src/
  tokens.css             , ported from this file
  routes/
    home, wizard, builder, results, compare, evidence, report, settings
  flows/
    nodes/{Test,Parallel,Decision,Referee,Terminal,Annotation}.tsx
    edges/ConditionEdge.tsx
  panels/
    TestLibrary.tsx
    PropertiesPanel.tsx
  charts/{Sankey,Radar,Scatter}.tsx`}</pre>
      <p>Node types register with React Flow; edge data carries <code>kind</code> (pos/neg/disc/inc) + <code>rule</code> (condition tree). Engine contract is a typed JSON schema: <code>{`{nodes, edges, constraints, prevalence}`}</code> → <code>{`{sens, spec, paths[], warnings[]}`}</code>.</p>
    </Spec>
  </>;
}

function Spec({ title, children }) {
  return (
    <section style={{marginBottom:18, paddingBottom:12, borderBottom:"1px solid var(--edge)"}}>
      <h3 style={{fontSize:13, letterSpacing:"0.04em", color:"var(--sme-orange-600)", marginBottom:8}}>{title}</h3>
      {children}
    </section>
  );
}

// --- Beta banner (across whole app) ---
function BetaBanner({ onOpenFeedback }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <>
      <div className="app__beta">
        <span className="beta__tag">
          BETA
        </span>
        <span className="beta__msg">
          <b>Public beta</b> by Syreon.
          <span className="beta__sep hide-sm">·</span>
          <span className="hide-sm">Non‑profit, free to use.</span>
          <span className="beta__sep">·</span>
          <span className="pill pill--hide-md"><span className="dot"/>Not yet validated</span>
        </span>
        <div className="beta__actions">
          <button className="beta__cta" onClick={onOpenFeedback}>
            <Icon name="edit" size={12}/>Send feedback
          </button>
          <button className="beta__cta beta__cta--primary" onClick={() => setShowInfo(true)}>
            About beta <Icon name="arrow-right" size={12}/>
          </button>
        </div>
      </div>
      {showInfo && <BetaModal onClose={() => setShowInfo(false)} onOpenFeedback={() => { setShowInfo(false); onOpenFeedback?.(); }}/>}
    </>
  );
}

function BetaModal({ onClose, onOpenFeedback }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:600}}>
        <div className="modal__head">
          <div className="node__icon" style={{width:32, height:32, background:"var(--sme-orange-050)", color:"var(--sme-orange-600)"}}>
            <Icon name="info" size={16}/>
          </div>
          <div>
            <h2>OptiDx is in public beta</h2>
            <div className="u-meta">A non‑profit initiative by Syreon</div>
          </div>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>
        <div className="modal__body">
          <p style={{marginBottom:14, lineHeight:1.6, fontSize:13}}>
            OptiDx is built and maintained by the <b>Syreon</b> health‑economics team
            as a <b>non‑profit public good</b>. Our goal is to make probabilistic diagnostic
            pathway analysis accessible to ministries of health, NGOs, and researchers, without
            licensing barriers.
          </p>

          <div style={{
            marginBottom:12, padding:"12px 14px", borderRadius:4,
            background:"#FFF6E5", border:"1px solid #FFE0A6",
            display:"flex", gap:10, alignItems:"flex-start", fontSize:13, lineHeight:1.55,
          }}>
            <Icon name="info" size={16} style={{color:"#C08A2A", flexShrink:0, marginTop:2}}/>
            <div>
              <b style={{color:"var(--sme-ink-900)"}}>The platform is not yet clinically validated.</b><br/>
              <span style={{color:"var(--fg-2)"}}>We are actively working on validation studies. In the meantime, OptiDx outputs are intended for analytical exploration and decision support, not clinical use.</span>
            </div>
          </div>

          <div className="banner banner--info" style={{marginBottom:12}}>
            <Icon name="info" size={16} className="banner__icon"/>
            <div>
              <b>The whole platform is in BETA.</b> Our team works on improvements daily and we
              will keep OptiDx <b>open for public use as long as we can sustain it</b>. Features
              may change and you may encounter rough edges.
            </div>
          </div>

          <div style={{
            marginBottom:14, padding:"12px 14px",
            background:"var(--surface-2)", border:"1px solid var(--edge)", borderRadius:4,
            fontSize:13, lineHeight:1.55,
          }}>
            <div className="row" style={{marginBottom:6, gap:8}}>
              <Icon name="database" size={14} style={{color:"var(--sme-orange-600)"}}/>
              <b style={{color:"var(--sme-ink-900)"}}>Comprehensive evidence database (in progress)</b>
            </div>
            <div style={{color:"var(--fg-2)"}}>
              We are building a large, curated database of diagnostic evidence so you don't have
              to source parameters yourself. This is a substantial effort and will roll out
              progressively over the coming months.
            </div>
          </div>

          <h3 style={{fontSize:13, marginBottom:8, color:"var(--sme-ink-900)"}}>What this means for you</h3>
          <ul style={{paddingLeft:20, lineHeight:1.7, fontSize:13, marginBottom:14}}>
            <li>All core features are <b>free to use</b>. No paywall, no usage caps.</li>
            <li>Outputs are <b>analytical decision support</b>, not clinical advice.</li>
            <li>Please <b>cite Syreon</b> when using results in publications or reports.</li>
          </ul>

          <div style={{padding:"12px 14px", background:"var(--sme-ink-900)", color:"#fff", borderRadius:4, display:"flex", gap:12, alignItems:"center"}}>
            <Icon name="info" size={18} style={{color:"var(--sme-orange)", flexShrink:0}}/>
            <div style={{flex:1, fontSize:12, lineHeight:1.5}}>
              <b>Want a feature, or found a bug?</b><br/>
              <span style={{color:"#B0B5B9"}}>Tell us. We prioritise requests that unblock public‑health work.</span>
            </div>
            <button className="btn btn--sm" style={{background:"var(--sme-orange)", color:"#fff", borderColor:"var(--sme-orange)"}} onClick={onOpenFeedback}>Send feedback</button>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ onClose }) {
  const [kind, setKind] = useState("feature");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{width:460}}>
          <div className="modal__body" style={{padding:"36px 32px", textAlign:"center"}}>
            <div style={{
              width:56, height:56, borderRadius:"50%",
              background:"var(--pos-050)", color:"var(--pos)",
              display:"grid", placeItems:"center", margin:"0 auto 16px",
            }}>
              <Icon name="check" size={28}/>
            </div>
            <h2 style={{marginBottom:8}}>Thanks, your feedback was received.</h2>
            <p style={{color:"var(--fg-2)", fontSize:13, lineHeight:1.55, marginBottom:18}}>
              The Syreon team reviews submissions weekly. We will reach out if we need clarification.
            </p>
            <button className="btn btn--primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:560}}>
        <div className="modal__head">
          <div className="node__icon" style={{width:32, height:32, background:"var(--sme-orange-050)", color:"var(--sme-orange-600)"}}>
            <Icon name="info" size={16}/>
          </div>
          <div>
            <h2>Send feedback</h2>
            <div className="u-meta">Help us shape OptiDx</div>
          </div>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>
        <div className="modal__body">
          <p style={{marginBottom:14, fontSize:13, lineHeight:1.6, color:"var(--fg-2)"}}>
            We are working on many new features. If you'd like to see something specific,
            tell us here. If you encounter a bug, report it here too.
          </p>

          <div className="field">
            <label className="field__label">Type</label>
            <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:8}}>
              {[
                { id:"feature", label:"Feature suggestion", icon:"plus", desc:"Something you'd like OptiDx to do." },
                { id:"bug",     label:"Bug report",         icon:"info", desc:"Something that's broken or wrong." },
              ].map(o => (
                <label key={o.id} style={{
                  padding:"12px 14px", borderRadius:4, cursor:"pointer",
                  border:"1px solid " + (kind === o.id ? "var(--sme-orange)" : "var(--edge)"),
                  background: kind === o.id ? "var(--sme-orange-050)" : "var(--surface)",
                  display:"flex", alignItems:"flex-start", gap:10,
                }}>
                  <input type="radio" name="ftype" checked={kind === o.id} onChange={() => setKind(o.id)} style={{accentColor:"var(--sme-orange)", marginTop:3}}/>
                  <div>
                    <div style={{fontSize:13, fontWeight:700, color:"var(--sme-ink-900)", display:"flex", alignItems:"center", gap:6}}>
                      <Icon name={o.icon} size={12}/>{o.label}
                    </div>
                    <div className="u-meta" style={{marginTop:2, whiteSpace:"normal"}}>{o.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field__label">Title</label>
            <input className="input" placeholder={kind === "bug" ? "e.g. CXR node deletes when I press backspace in name field" : "e.g. Add Markov chain extension for chronic disease pathways"}/>
          </div>

          {kind === "bug" && (
            <div className="field">
              <label className="field__label">Where did it happen?</label>
              <select className="select" defaultValue="">
                <option value="" disabled>Select a screen...</option>
                <option>Home</option>
                <option>New project wizard</option>
                <option>Builder (canvas)</option>
                <option>Results</option>
                <option>Compare</option>
                <option>Evidence</option>
                <option>Report</option>
                <option>Settings</option>
                <option>Other</option>
              </select>
            </div>
          )}

          <div className="field">
            <label className="field__label">{kind === "bug" ? "What happened? What did you expect?" : "Describe the feature"}</label>
            <textarea className="input" rows="5" style={{resize:"vertical", fontFamily:"inherit"}} placeholder={kind === "bug"
              ? "Steps to reproduce, what you saw, and what you expected."
              : "What problem would this solve? Who would benefit?"}/>
          </div>

          <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:12}}>
            <div className="field" style={{margin:0}}>
              <label className="field__label">Your name (optional)</label>
              <input className="input" placeholder="Dr. Layla Ibrahim"/>
            </div>
            <div className="field" style={{margin:0}}>
              <label className="field__label">Email (optional)</label>
              <input className="input" placeholder="you@org.org" type="email"/>
            </div>
          </div>

          <label className="row" style={{marginTop:14, fontSize:12, gap:8, alignItems:"flex-start"}}>
            <input type="checkbox" defaultChecked style={{accentColor:"var(--sme-orange)", marginTop:2}}/>
            <span style={{color:"var(--fg-2)"}}>It is OK for the Syreon team to contact me about this submission.</span>
          </label>
        </div>
        <div className="modal__foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={() => setSubmitted(true)}>
            <Icon name="upload" size={12}/>
            {kind === "bug" ? "Submit bug report" : "Submit suggestion"}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App });
