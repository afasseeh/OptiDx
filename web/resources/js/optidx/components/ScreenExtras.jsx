// ==========================================================================
// Additions: Scenarios (optimization candidates), Settings subpages, Share modal
// ==========================================================================

// ---------- PATHWAY LIBRARY -----------------------------------------------
function ScreenLibrary({ setScreen }) {
  const [query, setQuery] = useState("");
  const workspacePathways = window.OptiDxActions.getWorkspacePathways?.();
  const pathways = Array.isArray(workspacePathways)
    ? workspacePathways
    : Array.isArray(window.SEED_PATHWAYS)
      ? window.SEED_PATHWAYS
      : [];
  const filtered = pathways.filter(pathway => {
    const haystack = [
      pathway.name,
      pathway.metadata?.label,
      pathway.metadata?.disease,
      pathway.status,
    ].filter(Boolean).join(" ").toLowerCase();
    return !query || haystack.includes(query.toLowerCase());
  });

  return (
    <>
      <TopBar
        crumbs={["OptiDx", "Workspace", "Pathway library"]}
        actions={<>
          <button className="btn" onClick={() => setScreen("home")}><Icon name="arrow-left"/>Back home</button>
          <button className="btn btn--primary" onClick={() => setScreen("wizard")}><Icon name="plus"/>New project</button>
        </>}
      />
      <div className="page" style={{maxWidth:1320}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Persisted pathways</div>
            <h1>Saved pathway library</h1>
            <p>Open, edit, evaluate, duplicate, or export the pathways stored in the backend.</p>
          </div>
          <div style={{position:"relative", minWidth:280}}>
            <Icon name="search" style={{position:"absolute", left:10, top:10, color:"var(--fg-3)"}}/>
            <input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pathways..." style={{paddingLeft:32}}/>
          </div>
        </div>

        <div className="card card--flush">
          <table className="table">
            <thead>
              <tr>
                <th>Pathway</th>
                <th>Disease</th>
                <th>Status</th>
                <th className="num">Version</th>
                <th className="num">Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(pathway => (
                <tr key={pathway.id}>
                  <td>
                    <b>{pathway.name || pathway.metadata?.label || "Untitled pathway"}</b>
                    <div className="u-meta">{pathway.metadata?.source || pathway.notes || "Persisted record"}</div>
                  </td>
                  <td>{pathway.metadata?.disease || pathway.disease || "â"}</td>
                  <td><span className={"chip " + (String(pathway.validation_status || pathway.status || "").toLowerCase().includes("valid") ? "chip--pos" : "chip--outline")}>{pathway.validation_status || pathway.status || "Draft"}</span></td>
                  <td className="num mono">{pathway.version || 1}</td>
                  <td className="num mono">{pathway.updated_at ? new Date(pathway.updated_at).toLocaleDateString() : "â"}</td>
                  <td>
                    <div className="row" style={{justifyContent:"flex-end", gap:8}}>
                      <button className="btn btn--sm" onClick={async () => {
                        try {
                          await window.OptiDxActions.openPathwayRecord?.(pathway);
                          setScreen("canvas");
                        } catch (error) {
                          window.OptiDxActions.showToast?.(error?.message || "Unable to open pathway", "error");
                        }
                      }}>Open</button>
                      <button className="btn btn--sm" onClick={async () => {
                        try {
                          await window.OptiDxActions.openPathwayRecord?.(pathway);
                          await window.OptiDxActions.evaluatePathway?.(pathway.editor_definition || pathway._canonical || pathway);
                          setScreen("results");
                        } catch (error) {
                          window.OptiDxActions.showToast?.(error?.message || "Unable to evaluate pathway", "error");
                        }
                      }}>Evaluate</button>
                      <button className="btn btn--sm" onClick={async () => {
                        try {
                          await window.OptiDxActions.duplicatePathwayRecord?.(pathway);
                          window.OptiDxActions.showToast?.("Pathway duplicated", "success");
                        } catch (error) {
                          window.OptiDxActions.showToast?.(error?.message || "Unable to duplicate pathway", "error");
                        }
                      }}>Duplicate</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan="6" style={{textAlign:"center", color:"var(--fg-3)", padding:"28px 12px"}}>
                    No saved pathways match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function useOptimizationRunState() {
  const [optimization, setOptimization] = useState(() => window.OptiDxOptimizationResults || null);

  useEffect(() => {
    const syncOptimization = () => setOptimization(window.OptiDxOptimizationResults || null);
    window.addEventListener('optidx-optimization-updated', syncOptimization);
    syncOptimization();
    return () => window.removeEventListener('optidx-optimization-updated', syncOptimization);
  }, []);

  return optimization;
}

function formatOptimizationProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.0%";
  }

  return `${numericValue.toFixed(1)}%`;
}

// ---------- SCENARIOS (optimization results view) --------------------------
function LegacyScreenScenarios({ setScreen }) {
  const [selected, setSelected] = useState(0);
  const fallbackScenarios = [
    { id:"A", label:"Cost-optimal", sens:0.812, spec:0.946, cost:4.20, cpdc:51.72, tat:"2.1 h",
      notes:"Cheapest pathway that still meets minimum sensitivity.",
      tests:["WHO-4","CAD4TB","Xpert Ultra"], trade:"-0.03 sens vs balanced", tag:"Recommended for budget-constrained programs"},
    { id:"B", label:"Balanced constraints", sens:0.842, spec:0.946, cost:5.62, cpdc:66.74, tat:"2.8 h",
      notes:"Balanced trade-off across sensitivity, specificity, cost and TAT.",
      tests:["WHO-4","CAD4TB","Xpert Ultra"], trade:"Default configuration", tag:"Matches original pathway"},
    { id:"C", label:"Sensitivity-maximal", sens:0.891, spec:0.911, cost:8.05, cpdc:90.36, tat:"3.4 h",
      notes:"Adds parallel CRP to reduce false negatives.",
      tests:["WHO-4","CAD4TB","CRP","Xpert Ultra"], trade:"+0.05 sens Â· +$2.43 cost", tag:"For high-stakes active case-finding"},
    { id:"D", label:"Specificity-maximal", sens:0.798, spec:0.978, cost:6.95, cpdc:87.09, tat:"3.9 h",
      notes:"Adds confirmatory Culture node before treatment.",
      tests:["WHO-4","CAD4TB","Xpert Ultra","Culture"], trade:"+0.03 spec Â· -0.04 sens", tag:"Prioritizes treatment confirmation"},
    { id:"E", label:"Fastest TAT", sens:0.805, spec:0.928, cost:6.10, cpdc:75.78, tat:"1.4 h",
      notes:"Uses parallel CAD4TB + LF-LAM to cut molecular queue time.",
      tests:["WHO-4","CAD4TB","LF-LAM","Xpert Ultra"], trade:"Cuts TAT by 50% at higher cost"},
    { id:"F", label:"Low-resource", sens:0.773, spec:0.920, cost:2.85, cpdc:36.86, tat:"4.2 h",
      notes:"Drops Xpert, uses sputum-smear microscopy only.",
      tests:["WHO-4","Chest exam","Sputum smear"], trade:"-0.07 sens Â· -$2.77 cost"},
  ];
  const optimization = useOptimizationRunState();
  const generatedScenarios = window.OptiDxOptimizationScenarios?.length
    ? window.OptiDxOptimizationScenarios
    : window.OptiDxActions.buildOptimizationScenarios?.(optimization) || [];
  const scenarios = generatedScenarios.length
    ? generatedScenarios
    : ['queued', 'running'].includes(String(optimization?.status || '').toLowerCase())
      ? []
      : fallbackScenarios;
  const runLabel = optimization?.feasible_candidate_count
    ? `${optimization.feasible_candidate_count} candidates`
    : "6 candidates";
  const searchSpaceLabel = optimization?.feasible_candidate_count
    ? `${optimization.feasible_candidate_count} feasible`
    : "142 pathways";
  const testCountLabel = optimization?.selected_outputs?.least_cost_per_positive_test?.pathway_json?.tests
    ? `${Object.keys(optimization.selected_outputs.least_cost_per_positive_test.pathway_json.tests).length} tests`
    : "7 tests";
  const timeLabel = optimization?.run_ms
    ? `${(optimization.run_ms / 1000).toFixed(1)}s`
    : optimization ? "completed just now" : "2.1s";
  const current = scenarios[selected];
  const isRunning = ['queued', 'running'].includes(String(optimization?.status || '').toLowerCase());

  if (isRunning && !scenarios.length) {
    return (
      <>
        <TopBar
          crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
          actions={<>
            <button className="btn" onClick={() => setScreen("wizard")}>
              <Icon name="arrow-left"/>Back to setup
            </button>
          </>}
        />
        <div className="page" style={{maxWidth:1280}}>
        <div className="card card--pad" style={{borderLeft:"3px solid var(--sme-orange)"}}>
          <div className="row" style={{marginBottom:10}}>
            <div>
              <div className="u-meta">Background run</div>
              <h1 style={{fontSize:22, marginTop:4}}>The optimization is still running</h1>
              </div>
              <div className="spacer"/>
              <span className="chip chip--orange">{String(optimization?.run_mode || "light").toUpperCase()}</span>
            </div>
            <div className="optimization-progress optimization-progress--indeterminate" aria-label="Optimization activity" role="progressbar" aria-busy="true" aria-valuetext="Optimization in progress">
              <div className="optimization-progress__bar is-running" />
            </div>
            <div className="optimization-progress__meta">
              <span>{optimization?.progress_stage || optimization?.status || "Working"}</span>
              <span>Search in progress</span>
            </div>
            {optimization?.progress_message && (
              <p style={{marginTop:8, color:"var(--fg-2)", fontSize:13, lineHeight:1.5}}>{optimization.progress_message}</p>
            )}
            <p style={{marginTop:8, color:"var(--fg-3)", fontSize:12}}>
              Extensive runs continue in the background and will email the launching user when they finish.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
        actions={<>
          <button className="btn" onClick={() => setScreen("wizard")}>
            <Icon name="arrow-left"/>Back to setup
          </button>
          <button className="btn btn--primary" onClick={async () => {
            const scenario = current?.pathway;
            if (!scenario) {
              window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
              return;
            }
            try {
              await window.OptiDxActions.loadPathwayIntoWorkspace?.(scenario);
              setScreen("canvas");
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to open scenario", "error");
            }
          }}>
            <Icon name="git-branch"/>Open scenario {current.id}
          </button>
        </>}
      />
      <div className="page" style={{maxWidth:1280}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Optimization Â· {runLabel}</div>
            <h1>Pathway scenarios</h1>
            <p>{optimization ? "Optimization results from the latest run. Select a candidate to load it back into the canvas." : "The optimizer searched 142 pathway configurations and surfaced six along the Pareto frontier. Select one to load into the canvas."}</p>
          </div>
          <div className="row" style={{gap:12}}>
            <div style={{textAlign:"right"}}>
              <div className="u-meta">Search space</div>
              <div style={{fontWeight:700, fontSize:13}}>{searchSpaceLabel} Â· {testCountLabel}</div>
            </div>
            <div style={{width:1, height:32, background:"var(--edge)"}}/>
            <div style={{textAlign:"right"}}>
              <div className="u-meta">Time</div>
              <div style={{fontWeight:700, fontSize:13}}>{timeLabel}</div>
            </div>
          </div>
        </div>

        {isRunning && (
          <div className="card card--pad" style={{marginBottom:16, borderLeft:"3px solid var(--sme-orange)"}}>
            <div className="row" style={{marginBottom:10}}>
              <div>
                <div className="u-meta">Background run</div>
                <h2 style={{fontSize:18, marginTop:4}}>The optimization is still running</h2>
              </div>
              <div className="spacer"/>
              <span className="chip chip--orange">{String(optimization?.run_mode || "light").toUpperCase()}</span>
            </div>
            <div className="optimization-progress optimization-progress--indeterminate" aria-label="Optimization activity" role="progressbar" aria-busy="true" aria-valuetext="Optimization in progress">
              <div className="optimization-progress__bar is-running" />
            </div>
            <div className="optimization-progress__meta">
              <span>{optimization?.progress_stage || optimization?.status || "Working"}</span>
              <span>Search in progress</span>
            </div>
            {optimization?.progress_message && (
              <p style={{marginTop:8, color:"var(--fg-2)", fontSize:13, lineHeight:1.5}}>{optimization.progress_message}</p>
            )}
            <p style={{marginTop:8, color:"var(--fg-3)", fontSize:12}}>
              Extensive runs keep working after you leave the page. You will receive an email when the run finishes.
            </p>
          </div>
        )}

        {/* Scatter + table */}
        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
          <div className="card" style={{padding:16}}>
            <div className="row" style={{marginBottom:10}}>
              <h3 style={{fontSize:13}}>Average cost per patient × Youden's J</h3>
              <div className="spacer"/>
              <span className="u-meta">Pareto frontier â</span>
            </div>
            <svg viewBox="0 0 520 280" width="100%" height="280">
              <defs>
                <pattern id="gridp" width="52" height="28" patternUnits="userSpaceOnUse">
                  <path d="M52 0 L 0 0 0 28" stroke="#E2E4E6" strokeWidth="0.5" fill="none"/>
                </pattern>
              </defs>
              <rect x="40" y="20" width="460" height="220" fill="url(#gridp)"/>
              <line x1="40" y1="240" x2="500" y2="240" stroke="var(--edge-2)"/>
              <line x1="40" y1="20" x2="40" y2="240" stroke="var(--edge-2)"/>
              <text x="270" y="268" textAnchor="middle" fontSize="10" fill="var(--fg-3)" style={{letterSpacing:"0.1em"}}>AVERAGE COST PER PATIENT (USD) ?</text>
              <text x="20" y="130" textAnchor="middle" fontSize="10" fill="var(--fg-3)" transform="rotate(-90 20 130)" style={{letterSpacing:"0.1em"}}>YOUDEN'S J ?</text>
              {/* Pareto line */}
              <path d="M70 220 Q 160 180 230 110 Q 300 70 420 45" stroke="var(--sme-orange)" strokeWidth="1.5" fill="none" strokeDasharray="3 3"/>
              {(scenarios.length ? scenarios : []).map((s, i) => {
                const x = 40 + (s.cpdc / 100) * 460;
                const y = 240 - ((s.sens - 0.75) / 0.15) * 220;
                const isSel = i === selected;
                return (
                  <g key={s.id} style={{cursor:"pointer"}} onClick={() => setSelected(i)}>
                    <circle cx={x} cy={y} r={isSel ? 10 : 7}
                      fill={isSel ? "var(--sme-orange)" : "#fff"}
                      stroke={isSel ? "var(--sme-orange)" : "var(--sme-ink-600)"}
                      strokeWidth="1.5"/>
                    <text x={x} y={y+3} textAnchor="middle" fontSize="10" fontWeight="700"
                      fill={isSel ? "#fff" : "var(--sme-ink-900)"}>{s.id}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="card" style={{padding:0}}>
            <div className="row" style={{padding:"12px 16px", borderBottom:"1px solid var(--edge)"}}>
              <h3 style={{fontSize:13}}>Objective ranking</h3>
              <div className="spacer"/>
              <select className="select" style={{height:24, fontSize:11, width:"auto"}}>
                <option>Rank by selected output</option>
                <option>Rank by cost/case</option>
                <option>Rank by sensitivity</option>
              </select>
            </div>
            <table className="table">
              <thead>
                <tr><th></th><th>Pathway</th><th className="num">Sens</th><th className="num">Spec</th><th className="num">$/patient</th><th className="num">TAT</th></tr>
              </thead>
              <tbody>
                {(scenarios.length ? scenarios : []).map((s, i) => (
                  <tr key={s.id} onClick={() => setSelected(i)}
                    style={{cursor:"pointer", background: i === selected ? "var(--sme-orange-050)" : undefined}}>
                    <td>
                      <div style={{width:22, height:22, borderRadius:"50%",
                        background: i === selected ? "var(--sme-orange)" : "var(--surface-3)",
                        color: i === selected ? "#fff" : "var(--fg-2)",
                        display:"grid", placeItems:"center", fontSize:11, fontWeight:700}}>{s.id}</div>
                    </td>
                    <td><b>{s.label}</b></td>
                    <td className="num mono">{(s.sens*100).toFixed(1)}%</td>
                    <td className="num mono">{(s.spec*100).toFixed(1)}%</td>
                    <td className="num mono">${s.cpdc.toFixed(2)}</td>
                    <td className="num mono">{s.tat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected detail */}
        <div className="card" style={{padding:24, borderLeft:"3px solid var(--sme-orange)"}}>
          <div className="row" style={{marginBottom:14}}>
            <div style={{width:36, height:36, borderRadius:6, background:"var(--sme-orange)", color:"#fff",
              display:"grid", placeItems:"center", fontWeight:700, fontSize:16}}>{current.id}</div>
            <div>
              <div className="u-meta">Selected objective {current.id}</div>
              <h2 style={{fontSize:20, letterSpacing:"-0.01em"}}>{current.objectiveName || current.label}</h2>
            </div>
            <div className="spacer"/>
            {current.tag && <span className="chip chip--orange" style={{height:24, padding:"0 10px"}}>{current.tag}</span>}
          </div>
          {current.label && current.label !== current.objectiveName && (
            <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:8, lineHeight:1.45}}>{current.label}</p>
          )}
          <p style={{color:"var(--fg-2)", fontSize:14, marginBottom:18, lineHeight:1.55}}>{current.notes}</p>

          <div className="grid" style={{gridTemplateColumns:"repeat(5, 1fr)", gap:12, marginBottom:18}}>
            <Metric label="Sensitivity" value={(current.sens*100).toFixed(1) + "%"}/>
            <Metric label="Specificity" value={(current.spec*100).toFixed(1) + "%"}/>
            <Metric label="Cost / patient" value={"$" + current.cost.toFixed(2)}/>
            <Metric label="Cost / detected case" value={"$" + current.cpdc.toFixed(2)} accent/>
            <Metric label="Turnaround" value={current.tat}/>
          </div>

          <div className="row" style={{gap:24, borderTop:"1px solid var(--edge)", paddingTop:14}}>
            <div>
              <div className="u-meta">Tests used</div>
              <div style={{marginTop:4, display:"flex", gap:6, flexWrap:"wrap"}}>
                {(Array.isArray(current.tests) ? current.tests : []).map(t => <span key={t} className="chip chip--outline">{t}</span>)}
              </div>
            </div>
            <div style={{width:1, height:32, background:"var(--edge)"}}/>
            <div>
              <div className="u-meta">Trade-off vs balanced</div>
              <div style={{fontWeight:700, fontSize:13, marginTop:4}}>{current.trade}</div>
            </div>
            <div className="spacer"/>
            <button className="btn" onClick={async () => {
              if (!current?.pathway) {
                window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
                return;
              }
              try {
                await window.OptiDxActions.duplicatePathwayRecord?.(current.pathway);
                window.OptiDxActions.showToast?.("Scenario duplicated as a new pathway", "success");
              } catch (error) {
                window.OptiDxActions.showToast?.(error?.message || "Unable to duplicate scenario", "error");
              }
            }}>
              <Icon name="copy"/>Duplicate
            </button>
            <button className="btn btn--primary" onClick={async () => {
              if (!current?.pathway) {
                window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
                return;
              }
              try {
                await window.OptiDxActions.loadPathwayIntoWorkspace?.(current.pathway);
                setScreen("canvas");
              } catch (error) {
                window.OptiDxActions.showToast?.(error?.message || "Unable to load scenario into canvas", "error");
              }
            }}>
              <Icon name="git-branch"/>Load in canvas
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ScreenScenarios({ setScreen }) {
  const [selected, setSelected] = useState(0);
  const [sortKey, setSortKey] = useState("expected_cost_population");
  const optimization = useOptimizationRunState();
  const optimizationScenarios = Array.isArray(window.OptiDxOptimizationScenarios)
    ? window.OptiDxOptimizationScenarios
    : [];
  const generatedScenariosRaw = window.OptiDxActions.buildOptimizationScenarios?.(optimization);
  const generatedScenarios = Array.isArray(generatedScenariosRaw) ? generatedScenariosRaw : [];
  const scenarios = optimizationScenarios.length ? optimizationScenarios : generatedScenarios;
  const candidates = Array.isArray(optimization?.ranked_results) ? optimization.ranked_results : [];
  const current = scenarios[selected] || scenarios[0] || null;
  const selectedCandidateIndex = Number(current?.candidateIndex ?? current?.candidate_index ?? -1);
  const runLabel = optimization?.feasible_candidate_count
    ? `${optimization.feasible_candidate_count} candidates`
    : `${scenarios.length} named scenarios`;
  const searchSpaceLabel = optimization?.feasible_candidate_count
    ? `${optimization.feasible_candidate_count} feasible`
    : `${scenarios.length} named options`;
  const testCountLabel = optimization?.selected_outputs?.least_cost_per_positive_test?.pathway_json?.tests
    ? `${Object.keys(optimization.selected_outputs.least_cost_per_positive_test.pathway_json.tests).length} tests`
    : "0 tests";
  const timeLabel = optimization?.run_ms
    ? `${(optimization.run_ms / 1000).toFixed(1)}s`
    : optimization ? "completed just now" : "n/a";
  const isRunning = ['queued', 'running'].includes(String(optimization?.status || '').toLowerCase());

  if (isRunning && !scenarios.length) {
    return (
      <>
        <TopBar
          crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
          actions={<>
            <button className="btn" onClick={() => setScreen("wizard")}>
              <Icon name="arrow-left"/>Back to setup
            </button>
          </>}
        />
        <div className="page" style={{maxWidth:1280}}>
          <div className="card card--pad" style={{borderLeft:"3px solid var(--sme-orange)"}}>
            <div className="row" style={{marginBottom:10}}>
              <div>
                <div className="u-meta">Background run</div>
                <h1 style={{fontSize:22, marginTop:4}}>The optimization is still running</h1>
              </div>
              <div className="spacer"/>
              <span className="chip chip--orange">{String(optimization?.run_mode || "light").toUpperCase()}</span>
            </div>
            <div className="optimization-progress optimization-progress--indeterminate" aria-label="Optimization activity" role="progressbar" aria-busy="true" aria-valuetext="Optimization in progress">
              <div className="optimization-progress__bar is-running" />
            </div>
            <div className="optimization-progress__meta">
              <span>{optimization?.progress_stage || optimization?.status || "Running"}</span>
              <span>Search in progress</span>
            </div>
            {optimization?.progress_message && (
              <p style={{marginTop:8, color:"var(--fg-2)", fontSize:13, lineHeight:1.5}}>{optimization.progress_message}</p>
            )}
            <p style={{marginTop:8, color:"var(--fg-3)", fontSize:12}}>
              Extensive runs continue in the background and will email the launching user when they finish.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!current) {
    return (
      <>
        <TopBar
          crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
          actions={<>
            <button className="btn" onClick={() => setScreen("wizard")}>
              <Icon name="arrow-left"/>Back to setup
            </button>
          </>}
        />
        <div className="page" style={{maxWidth:1280}}>
          <div className="card card--pad">
            <div className="u-meta">No stored optimization result</div>
            <h1 style={{fontSize:22, marginTop:4}}>Run the optimizer to view scenarios</h1>
            <p style={{marginTop:8, color:"var(--fg-2)", lineHeight:1.5}}>
              This page opens a stored optimization result. If no run has completed yet, start one from the wizard.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!scenarios.length) {
    const statusTitle = optimization?.status === 'infeasible'
      ? 'No feasible pathway was found'
      : optimization?.status === 'no_feasible_found_time_limit'
        ? 'The search timed out before finding a feasible pathway'
        : 'No optimization scenarios are available yet';
    const statusMessage = optimization?.message
      || optimization?.failure_reason
      || (optimization?.status === 'infeasible'
        ? 'No pathway can fulfil the selected constraints.'
        : optimization?.status === 'no_feasible_found_time_limit'
          ? 'No feasible pathway was found within the time limit. Because the search was not exhaustive, the system cannot claim that no feasible pathway exists.'
          : 'Run the optimizer to populate the named scenario buckets and the sortable feasible-candidate table.');

    return (
      <>
        <TopBar
          crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
          actions={<>
            <button className="btn" onClick={() => setScreen("wizard")}>
              <Icon name="arrow-left"/>Back to setup
            </button>
          </>}
        />
        <div className="page" style={{maxWidth:1280}}>
          <div className="card card--pad" style={{borderLeft:"3px solid var(--sme-orange)"}}>
            <div className="row" style={{marginBottom:10}}>
              <div>
                <div className="u-meta">Optimization result</div>
                <h1 style={{fontSize:22, marginTop:4}}>{statusTitle}</h1>
              </div>
              <div className="spacer"/>
              <span className="chip chip--orange">{String(optimization?.run_mode || "light").toUpperCase()}</span>
            </div>
            <p style={{color:"var(--fg-2)", lineHeight:1.55, fontSize:13, marginBottom:12}}>
              {statusMessage}
            </p>
            <div className="row" style={{justifyContent:"flex-end"}}>
              <button className="btn btn--primary" onClick={() => setScreen("wizard")}>
                Back to setup
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const sortableCandidates = [...candidates].sort((left, right) => {
    const leftMetrics = left?.metrics || {};
    const rightMetrics = right?.metrics || {};
    const ascending = sortKey === "expected_cost_population"
      || sortKey === "cost_per_detected_case"
      || sortKey === "expected_turnaround_time_population";
    const leftValue = Number(leftMetrics[sortKey] ?? (ascending ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER));
    const rightValue = Number(rightMetrics[sortKey] ?? (ascending ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER));

    if (leftValue !== rightValue) {
      return ascending ? leftValue - rightValue : rightValue - leftValue;
    }

    const leftCost = Number(leftMetrics.expected_cost_population ?? Number.MAX_SAFE_INTEGER);
    const rightCost = Number(rightMetrics.expected_cost_population ?? Number.MAX_SAFE_INTEGER);
    if (leftCost !== rightCost) {
      return leftCost - rightCost;
    }

    const leftTat = Number(leftMetrics.expected_turnaround_time_population ?? Number.MAX_SAFE_INTEGER);
    const rightTat = Number(rightMetrics.expected_turnaround_time_population ?? Number.MAX_SAFE_INTEGER);
    if (leftTat !== rightTat) {
      return leftTat - rightTat;
    }

    return Number(left?.candidate_index ?? 0) - Number(right?.candidate_index ?? 0);
  });

  const scatterCandidates = Array.isArray(optimization?.pareto_frontier) && optimization.pareto_frontier.length
    ? optimization.pareto_frontier
    : candidates;
  const scatterMaxCostPerPatient = Math.max(
    ...scatterCandidates.map(candidate => Number(candidate?.metrics?.expected_cost_population ?? 0)),
    1,
  );

  return (
    <>
      <TopBar
        crumbs={["OptiDx","TB Community Screening","Optimization scenarios"]}
        actions={<>
          <button className="btn" onClick={() => setScreen("wizard")}>
            <Icon name="arrow-left"/>Back to setup
          </button>
          <button className="btn btn--primary" onClick={async () => {
            const scenario = current?.pathway;
            if (!scenario) {
              window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
              return;
            }
            try {
              await window.OptiDxActions.loadPathwayIntoWorkspace?.(scenario);
              setScreen("canvas");
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to open scenario", "error");
            }
          }}>
            <Icon name="git-branch"/>Open scenario {current?.id || "01"}
          </button>
        </>}
      />
      <div className="page" style={{maxWidth:1280}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Optimization Â· {runLabel}</div>
            <h1>Pathway scenarios</h1>
            <p>{optimization ? "Named scenario buckets are selected from the feasible optimization set after project constraints are applied. Review the fixed options first, then inspect the full candidate table and frontier." : "Run the optimizer to populate the named scenario buckets and the sortable feasible-candidate table."}</p>
          </div>
          <div className="row" style={{gap:12}}>
            <div style={{textAlign:"right"}}>
              <div className="u-meta">Search space</div>
              <div style={{fontWeight:700, fontSize:13}}>{searchSpaceLabel} Â· {testCountLabel}</div>
            </div>
            <div style={{width:1, height:32, background:"var(--edge)"}}/>
            <div style={{textAlign:"right"}}>
              <div className="u-meta">Time</div>
              <div style={{fontWeight:700, fontSize:13}}>{timeLabel}</div>
            </div>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:12, marginBottom:16}}>
          {scenarios.map((scenario, index) => (
            <button
              key={scenario.key || scenario.id || index}
              className="card"
              onClick={() => setSelected(index)}
              style={{
                padding:16,
                textAlign:"left",
                borderColor: index === selected ? "var(--sme-orange)" : "var(--edge)",
                boxShadow: index === selected ? "0 0 0 1px rgba(243, 119, 57, 0.18)" : undefined,
                background: index === selected ? "var(--sme-orange-050)" : undefined,
              }}
            >
              <div className="row" style={{marginBottom:8}}>
                <div className="u-meta">{scenario.id}</div>
                <div className="spacer"/>
                <span className="chip chip--outline">{scenario.metricDisplay}</span>
              </div>
              <div style={{fontWeight:700, fontSize:14, marginBottom:6}}>{scenario.objectiveName || scenario.label}</div>
              <div className="u-meta" style={{marginBottom:10}}>{String(scenario.metricName || "ranked metric").split("_").join(" ")}</div>
              <div style={{fontSize:12, color:"var(--fg-2)", lineHeight:1.45}}>{scenario.notes}</div>
            </button>
          ))}
          {!scenarios.length && (
            <div className="card" style={{padding:16, gridColumn:"1 / -1", color:"var(--fg-3)"}}>
              No optimization scenarios are available yet.
            </div>
          )}
        </div>

        <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
          <div className="card" style={{padding:16}}>
            <div className="row" style={{marginBottom:10}}>
              <h3 style={{fontSize:13}}>Average cost per patient × Youden's J</h3>
              <div className="spacer"/>
              <span className="u-meta">Pareto frontier</span>
            </div>
            <svg viewBox="0 0 520 280" width="100%" height="280">
              <defs>
                <pattern id="gridp-v2" width="52" height="28" patternUnits="userSpaceOnUse">
                  <path d="M52 0 L 0 0 0 28" stroke="#E2E4E6" strokeWidth="0.5" fill="none"/>
                </pattern>
              </defs>
              <rect x="40" y="20" width="460" height="220" fill="url(#gridp-v2)"/>
              <line x1="40" y1="240" x2="500" y2="240" stroke="var(--edge-2)"/>
              <line x1="40" y1="20" x2="40" y2="240" stroke="var(--edge-2)"/>
              <text x="270" y="268" textAnchor="middle" fontSize="10" fill="var(--fg-3)" style={{letterSpacing:"0.1em"}}>AVERAGE COST PER PATIENT (USD) ?</text>
              <text x="20" y="130" textAnchor="middle" fontSize="10" fill="var(--fg-3)" transform="rotate(-90 20 130)" style={{letterSpacing:"0.1em"}}>YOUDEN'S J ?</text>
              {scatterCandidates.map((candidate, index) => {
                const metrics = candidate?.metrics || {};
                const costPerPatient = Number(metrics.expected_cost_population ?? 0);
                const youdenJ = Number(metrics.youden_j ?? 0);
                const x = 40 + (costPerPatient / scatterMaxCostPerPatient) * 460;
                const y = 240 - (((Math.max(-1, Math.min(1, youdenJ)) + 1) / 2) * 220);
                const candidateIndex = Number(candidate?.candidate_index ?? index);
                const isSel = candidateIndex === selectedCandidateIndex;
                return (
                  <g key={candidateIndex}>
                    <circle cx={x} cy={y} r={isSel ? 10 : 7}
                      fill={isSel ? "var(--sme-orange)" : "#fff"}
                      stroke={isSel ? "var(--sme-orange)" : "var(--sme-ink-600)"}
                      strokeWidth="1.5"/>
                    <text x={x} y={y+3} textAnchor="middle" fontSize="10" fontWeight="700"
                      fill={isSel ? "#fff" : "var(--sme-ink-900)"}>{candidateIndex + 1}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="card" style={{padding:0}}>
            <div className="row" style={{padding:"12px 16px", borderBottom:"1px solid var(--edge)"}}>
              <h3 style={{fontSize:13}}>Feasible candidates</h3>
              <div className="spacer"/>
              <select className="select" style={{height:24, fontSize:11, width:"auto"}} value={sortKey} onChange={e => setSortKey(e.target.value)}>
                <option value="expected_cost_population">Rank by cost / patient</option>
                <option value="cost_per_detected_case">Rank by cost / detected case</option>
                <option value="sensitivity">Rank by sensitivity</option>
                <option value="diagnostic_odds_ratio">Rank by DOR</option>
                <option value="balanced_accuracy">Rank by balanced accuracy</option>
                <option value="youden_index">Rank by Youden&apos;s J</option>
                <option value="expected_turnaround_time_population">Rank by turnaround time</option>
              </select>
            </div>
            <table className="table">
              <thead>
                <tr><th>#</th><th>Pathway</th><th className="num">Sens</th><th className="num">Spec</th><th className="num">$/patient</th><th className="num">TAT</th></tr>
              </thead>
              <tbody>
                {sortableCandidates.map((candidate, index) => {
                  const metrics = candidate?.metrics || {};
                  const candidateIndex = Number(candidate?.candidate_index ?? index);
                  const isSel = candidateIndex === selectedCandidateIndex;

                  return (
                    <tr key={candidateIndex} style={{background: isSel ? "var(--sme-orange-050)" : undefined}}>
                      <td className="mono">{candidateIndex + 1}</td>
                      <td><b>{candidate?.label || `Pathway ${candidateIndex + 1}`}</b></td>
                      <td className="num mono">{((metrics.sensitivity ?? 0) * 100).toFixed(1)}%</td>
                      <td className="num mono">{((metrics.specificity ?? 0) * 100).toFixed(1)}%</td>
                      <td className="num mono">${Number(metrics.expected_cost_population ?? 0).toFixed(2)}</td>
                      <td className="num mono">{window.OptiDxActions.normalizeTAT?.(metrics.expected_turnaround_time_population ?? null, "hr") || "n/a"}</td>
                    </tr>
                  );
                })}
                {!sortableCandidates.length && (
                  <tr>
                    <td colSpan="6" style={{textAlign:"center", color:"var(--fg-3)", padding:"24px 12px"}}>
                      No feasible pathways returned from the optimizer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {current && (
          <div className="card" style={{padding:24, borderLeft:"3px solid var(--sme-orange)"}}>
            <div className="row" style={{marginBottom:14}}>
              <div style={{width:36, height:36, borderRadius:6, background:"var(--sme-orange)", color:"#fff",
                display:"grid", placeItems:"center", fontWeight:700, fontSize:16}}>{current.id}</div>
              <div>
                <div className="u-meta">Selected objective {current.id}</div>
                <h2 style={{fontSize:20, letterSpacing:"-0.01em"}}>{current.objectiveName || current.label}</h2>
              </div>
              <div className="spacer"/>
              {current.metricDisplay && <span className="chip chip--orange" style={{height:24, padding:"0 10px"}}>{current.metricDisplay}</span>}
            </div>
            {current.label && current.label !== current.objectiveName && (
              <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:8, lineHeight:1.45}}>{current.label}</p>
            )}
            <p style={{color:"var(--fg-2)", fontSize:14, marginBottom:18, lineHeight:1.55}}>{current.notes}</p>

            <div className="grid" style={{gridTemplateColumns:"repeat(6, 1fr)", gap:12, marginBottom:18}}>
              <Metric label="Sensitivity" value={(current.sens*100).toFixed(1) + "%"}/>
              <Metric label="Specificity" value={(current.spec*100).toFixed(1) + "%"}/>
              <Metric label="Cost / patient" value={"$" + current.cost.toFixed(2)}/>
              <Metric label="Cost / detected case" value={"$" + current.cpdc.toFixed(2)} accent/>
              <Metric label="Turnaround" value={current.tat}/>
              <Metric label="Youden's J" value={(current.youdenIndex*100).toFixed(1) + "%"}/>
            </div>

            <div className="row" style={{gap:24, borderTop:"1px solid var(--edge)", paddingTop:14}}>
              <div>
                <div className="u-meta">Tests used</div>
                <div style={{marginTop:4, display:"flex", gap:6, flexWrap:"wrap"}}>
                {(Array.isArray(current.tests) ? current.tests : []).map(t => <span key={t} className="chip chip--outline">{t}</span>)}
                </div>
              </div>
              <div style={{width:1, height:32, background:"var(--edge)"}}/>
              <div>
                <div className="u-meta">Objective</div>
                <div style={{fontWeight:700, fontSize:13, marginTop:4}}>{current.trade}</div>
              </div>
              <div className="spacer"/>
              <button className="btn" onClick={async () => {
                if (!current?.pathway) {
                  window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
                  return;
                }
                try {
                  await window.OptiDxActions.duplicatePathwayRecord?.(current.pathway);
                  window.OptiDxActions.showToast?.("Scenario duplicated as a new pathway", "success");
                } catch (error) {
                  window.OptiDxActions.showToast?.(error?.message || "Unable to duplicate scenario", "error");
                }
              }}>
                <Icon name="copy"/>Duplicate
              </button>
              <button className="btn btn--primary" onClick={async () => {
                if (!current?.pathway) {
                  window.OptiDxActions.showToast?.("No optimized pathway is loaded yet.", "info");
                  return;
                }
                try {
                  await window.OptiDxActions.loadPathwayIntoWorkspace?.(current.pathway);
                  setScreen("canvas");
                } catch (error) {
                  window.OptiDxActions.showToast?.(error?.message || "Unable to load scenario into canvas", "error");
                }
              }}>
                <Icon name="git-branch"/>Load in canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="metric" style={accent ? {borderColor:"var(--sme-orange-100)", background:"var(--sme-orange-050)"} : undefined}>
      <div className="metric__label">{label}</div>
      <div className="metric__value" style={{fontSize:22, color: accent ? "var(--sme-orange-600)" : undefined}}>{value}</div>
    </div>
  );
}

// ---------- SETTINGS (full tabbed experience) -----------------------------
function ScreenSettingsFull({ currentUser }) {
  const [tab, setTab] = useState("profile");
  const tabs = [
    { id:"profile", label:"Profile" },
    { id:"workspace", label:"Workspace" },
    { id:"defaults", label:"Pathway defaults" },
    { id:"branding", label:"Branding" },
    { id:"integrations", label:"Integrations" },
  ];
  return (
    <>
      <TopBar crumbs={["OptiDx","Settings"]}/>
      <div className="page" style={{maxWidth:1100}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Preferences</div>
            <h1>Settings</h1>
            <p>Workspace, defaults, branding, integrations. Changes save automatically.</p>
          </div>
        </div>
        <div className="tabs" style={{marginBottom:24}}>
          {tabs.map(t => (
            <div key={t.id}
              className={"tab " + (tab === t.id ? "is-active" : "")}
              onClick={() => setTab(t.id)}>{t.label}</div>
          ))}
        </div>
        {tab === "profile" && <SetProfile currentUser={currentUser}/>}
        {tab === "workspace" && <SetWorkspace currentUser={currentUser}/>}
        {tab === "defaults" && <SetDefaults/>}
        {tab === "branding" && <SetBranding/>}
        {tab === "integrations" && <SetIntegrations/>}
      </div>
    </>
  );
}

function buildProfileDraft(currentUser) {
  const fullName = String(currentUser?.name || "").trim();
  const defaultFirstName = fullName.split(/\s+/)[0] || "";
  const defaultLastName = fullName.split(/\s+/).slice(1).join(" ");

  return {
    first_name: String(currentUser?.first_name || defaultFirstName || "").trim(),
    last_name: String(currentUser?.last_name || defaultLastName || "").trim(),
    email: String(currentUser?.email || "").trim(),
    organization: String(currentUser?.organization || "").trim(),
    title: String(currentUser?.title || "").trim(),
    timezone: String(currentUser?.timezone || "Africa/Cairo").trim() || "Africa/Cairo",
  };
}

function getInitials(name = "") {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "U";
}

function SetProfile({ currentUser }) {
  const [profile, setProfile] = useState(() => buildProfileDraft(currentUser));
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setProfile(buildProfileDraft(currentUser));
    setConfirmDelete(false);
    setDeletePassword("");
    setDeleteError("");
  }, [currentUser]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await window.OptiDxActions.request("put", "/auth/profile", profile);
      const nextUser = response?.user || null;
      window.OptiDxActions.setCurrentUser?.(nextUser);
      setProfile(buildProfileDraft(nextUser));
      window.OptiDxActions.showToast?.(
        nextUser?.email_verified_at ? "Profile saved" : "Profile saved. Verify your new email address.",
        "success",
      );
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to save profile", "error");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await window.OptiDxActions.logout?.();
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to sign out", "error");
    } finally {
      setLoggingOut(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await window.OptiDxActions.deleteAccount?.(deletePassword);
    } catch (error) {
      setDeleteError(error?.message || "Unable to delete account");
      window.OptiDxActions.showToast?.(error?.message || "Unable to delete account", "error");
      setDeleting(false);
    }
  };

  return (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div className="card card--pad">
        <div className="row" style={{marginBottom:14}}>
          <h3 style={{fontSize:14}}>Personal information</h3>
          <div className="spacer"/>
          <button type="button" className="btn btn--sm btn--primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
        <div className="row" style={{gap:14, marginBottom:18}}>
          <div style={{width:72, height:72, borderRadius:"50%", background:"var(--sme-orange-050)",
            color:"var(--sme-orange-600)", display:"grid", placeItems:"center",
            fontSize:24, fontWeight:700, fontFamily:"var(--font-display)"}}>
            {getInitials([profile.first_name, profile.last_name].filter(Boolean).join(" "))}
          </div>
          <div>
            <div style={{fontSize:14, fontWeight:700}}>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Your profile"}</div>
            <div className="u-meta">{profile.email || "No email on file"}</div>
            <div className="u-meta" style={{marginTop:4}}>{profile.organization || "Organization not set"}</div>
          </div>
        </div>
        <div className="stack" style={{gap:12}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
            <div className="field"><label className="field__label">First name</label><input className="input" value={profile.first_name || ""} onChange={e => setProfile(current => ({ ...current, first_name: e.target.value }))}/></div>
            <div className="field"><label className="field__label">Last name</label><input className="input" value={profile.last_name || ""} onChange={e => setProfile(current => ({ ...current, last_name: e.target.value }))}/></div>
          </div>
          <div className="field"><label className="field__label">Email</label><input className="input" type="email" value={profile.email || ""} onChange={e => setProfile(current => ({ ...current, email: e.target.value }))}/></div>
          <div className="field"><label className="field__label">Organization</label><input className="input" value={profile.organization || ""} onChange={e => setProfile(current => ({ ...current, organization: e.target.value }))}/></div>
          <div className="field"><label className="field__label">Role / title</label><input className="input" value={profile.title || ""} onChange={e => setProfile(current => ({ ...current, title: e.target.value }))}/></div>
          <div className="field"><label className="field__label">Time zone</label>
            <select className="select" value={profile.timezone || "Africa/Cairo"} onChange={e => setProfile(current => ({ ...current, timezone: e.target.value }))}>
              <option value="Africa/Cairo">Cairo (GMT+2)</option>
              <option value="Europe/Istanbul">Istanbul (GMT+3)</option>
              <option value="Asia/Dubai">Dubai (GMT+4)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </div>

      <div className="stack" style={{gap:16}}>
        <div className="card card--pad">
          <div className="row" style={{marginBottom:14}}>
            <h3 style={{fontSize:14}}>Account actions</h3>
            <div className="spacer"/>
            <button type="button" className="btn btn--sm" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
          <div className="stack" style={{gap:10, fontSize:13, color:"var(--fg-2)", lineHeight:1.55}}>
            <div>Use logout to end the current session on this device.</div>
            <div>Profile changes save back to your account and are available across the shell after refresh.</div>
          </div>
        </div>

        <div className="card card--pad" style={{borderColor:"#F0C2BE", background:"linear-gradient(180deg, rgba(255,245,244,0.96), rgba(255,255,255,1))"}}>
          <h3 style={{fontSize:14, marginBottom:10, color:"#A13B33"}}>Delete account</h3>
          <div style={{fontSize:13, color:"var(--fg-2)", lineHeight:1.55, marginBottom:12}}>
            Permanently delete your login and personal account data. Workspace records you created are preserved, but ownership is removed so they can be reassigned later.
          </div>
          <label className="row" style={{gap:8, alignItems:"flex-start", marginBottom:12, cursor:"pointer"}}>
            <input type="checkbox" checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} style={{marginTop:3}}/>
            <span style={{fontSize:12, color:"var(--fg-2)", lineHeight:1.4}}>
              I understand this will permanently delete my account.
            </span>
          </label>
          <div className="field" style={{marginBottom:12}}>
            <label className="field__label">Re-enter password</label>
            <input className="input" type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Current password"/>
          </div>
          {deleteError && (
            <div className="banner banner--warn" style={{marginBottom:12}}>
              <Icon name="alert-triangle" size={14} className="banner__icon"/>
              <div>{deleteError}</div>
            </div>
          )}
          <button
            type="button"
            className="btn"
            style={{width:"100%", justifyContent:"center", borderColor:"#F0C2BE", color:"#A13B33"}}
            onClick={deleteAccount}
            disabled={!confirmDelete || !deletePassword || deleting}
          >
            {deleting ? "Deleting..." : "Delete account permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SetWorkspace({ currentUser }) {
  const [profile, setProfile] = useState(() => window.OptiDxActions.getWorkspaceSetting?.("workspace_profile", "workspace") || {
    name: "Syreon MENA HTA",
    slug: "syreon-mena-hta",
    currency: "USD",
    language: "English",
  });
  const [saving, setSaving] = useState(false);
  const currentMemberName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || currentUser?.name || "Current user";
  const currentMemberInitials = getInitials(currentMemberName);

  const save = async () => {
    setSaving(true);
    try {
      await window.OptiDxActions.saveWorkspaceSetting?.("workspace_profile", profile, "workspace");
      window.OptiDxActions.showToast?.("Workspace settings saved", "success");
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to save workspace settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div className="card card--pad">
        <div className="row" style={{marginBottom:14}}>
          <h3 style={{fontSize:14}}>Workspace</h3>
          <div className="spacer"/>
          <button className="btn btn--sm btn--primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save workspace"}</button>
        </div>
        <div className="stack" style={{gap:12}}>
          <div className="field"><label className="field__label">Workspace name</label><input className="input" value={profile.name || ""} onChange={e => setProfile(current => ({ ...current, name: e.target.value }))}/></div>
          <div className="field"><label className="field__label">URL slug</label>
            <div className="input-group"><input className="input" value={profile.slug || ""} onChange={e => setProfile(current => ({ ...current, slug: e.target.value }))}/><div className="input-addon">.optidx.app</div></div>
          </div>
          <div className="field"><label className="field__label">Default currency</label>
            <select className="select" value={profile.currency || "USD"} onChange={e => setProfile(current => ({ ...current, currency: e.target.value }))}><option>USD</option><option>EUR</option><option>EGP</option><option>AED</option></select>
          </div>
          <div className="field"><label className="field__label">Default language</label>
            <select className="select" value={profile.language || "English"} onChange={e => setProfile(current => ({ ...current, language: e.target.value }))}><option>English</option><option>Ø§ÙØ¹Ø±Ø¨ÙØ©</option><option>FranÃ§ais</option></select>
          </div>
        </div>
      </div>

      <div className="card card--pad">
        <div className="row" style={{marginBottom:14}}>
          <h3 style={{fontSize:14}}>Team members</h3>
          <div className="spacer"/>
          <button className="btn btn--sm" onClick={() => window.OptiDxActions.comingSoon("Invite workspace member")}><Icon name="plus" size={12}/>Invite</button>
        </div>
        <div className="stack" style={{gap:0}}>
          {[
            [currentMemberName, "Owner", currentMemberInitials, "var(--sme-orange)"],
            ["Ahmed Khalil","Editor","AK","var(--refer)"],
            ["Dr. Layla Haddad","Clinical reviewer","LH","var(--pos)"],
            ["Omar Fouad","Viewer","OF","var(--inconcl)"],
          ].map(([n,r,i,c]) => (
            <div key={n} className="row" style={{padding:"10px 0", borderBottom:"1px solid var(--edge)"}}>
              <div style={{width:30, height:30, borderRadius:"50%", background:c, color:"#fff",
                display:"grid", placeItems:"center", fontWeight:700, fontSize:11}}>{i}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13, fontWeight:700}}>{n}</div>
                <div className="u-meta">{r}</div>
              </div>
              <Icon name="more" size={14} style={{color:"var(--fg-3)"}}/>
            </div>
          ))}
        </div>
      </div>

      <div className="card card--pad" style={{gridColumn:"span 2"}}>
        <h3 style={{fontSize:14, marginBottom:14}}>Billing</h3>
        <div className="row" style={{gap:16}}>
          <div style={{flex:1, padding:16, background:"var(--sme-orange-050)", borderRadius:6, border:"1px solid var(--sme-orange-100)"}}>
            <div className="sme-eyebrow" style={{color:"var(--sme-orange-600)", marginBottom:4}}>Current plan</div>
            <div style={{fontSize:18, fontWeight:700}}>Research Â· Non-profit</div>
            <div className="u-meta" style={{marginTop:4}}>Unlimited pathways Â· 8 seats Â· Priority support</div>
          </div>
          <div style={{flex:1, padding:16, background:"var(--surface-2)", borderRadius:6}}>
            <div className="u-meta">Next renewal</div>
            <div style={{fontSize:15, fontWeight:700, marginTop:4}}>1 Jan 2027</div>
            <div className="u-meta" style={{marginTop:4}}>Waived, research license</div>
          </div>
          <div>
            <button className="btn" onClick={() => window.OptiDxActions.comingSoon("Manage billing")}>Manage billing</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetDefaults() {
  const [defaults, setDefaults] = useState(() => window.OptiDxActions.getWorkspaceSetting?.("pathway_defaults", "workspace") || {
    currency: "USD",
    rounding: "3 decimals",
    assumption: "Unless overridden by node-level flag",
    prevalence: "WHO TB report 2024",
    flags: {
      warnUnconnectedOutputs: true,
      warnMissingTerminals: true,
      warnCircularLogic: true,
      warnMissingPrevalence: true,
      flagEvidenceAge: false,
      blockLowSensitivity: false,
      requireReferee: true,
    },
    weights: {
      sensitivity: 0.30,
      specificity: 0.30,
      cost: 0.30,
      tat: 0.10,
    },
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await window.OptiDxActions.saveWorkspaceSetting?.("pathway_defaults", defaults, "workspace");
      window.OptiDxActions.showToast?.("Pathway defaults saved", "success");
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to save pathway defaults", "error");
    } finally {
      setSaving(false);
    }
  };

  const flagKeyMap = {
    "Warn if unconnected outputs": "warnUnconnectedOutputs",
    "Warn if missing terminal nodes": "warnMissingTerminals",
    "Warn if circular logic": "warnCircularLogic",
    "Warn if prevalence not set": "warnMissingPrevalence",
    "Flag evidence older than 10 years": "flagEvidenceAge",
    "Block save if below minimum sensitivity": "blockLowSensitivity",
    "Require referee on discordant branches": "requireReferee",
  };

  const weightKeyMap = {
    Sensitivity: "sensitivity",
    Specificity: "specificity",
    Cost: "cost",
    TAT: "tat",
  };

  return (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
      <div className="card card--pad">
        <div className="row" style={{marginBottom:12}}>
          <h3 style={{fontSize:14}}>Algorithm defaults</h3>
          <div className="spacer"/>
          <button className="btn btn--sm btn--primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save defaults"}</button>
        </div>
        <div className="stack" style={{gap:12}}>
          <div className="field"><label className="field__label">Default currency</label><select className="select" value={defaults.currency || "USD"} onChange={e => setDefaults(current => ({ ...current, currency: e.target.value }))}><option>USD</option><option>EUR</option><option>EGP</option><option>AED</option></select></div>
          <div className="field"><label className="field__label">Rounding precision</label><select className="select" value={defaults.rounding || "3 decimals"} onChange={e => setDefaults(current => ({ ...current, rounding: e.target.value }))}><option>3 decimals</option><option>2 decimals</option><option>4 decimals</option></select></div>
          <div className="field"><label className="field__label">Conditional independence assumption</label>
            <select className="select" value={defaults.assumption || "Unless overridden by node-level flag"} onChange={e => setDefaults(current => ({ ...current, assumption: e.target.value }))}><option>Unless overridden by node-level flag</option><option>Never (use raw correlations)</option><option>Always</option></select>
            <div className="field__hint">Applies to multi-test pathways with shared sample types.</div>
          </div>
          <div className="field"><label className="field__label">Default prevalence source</label>
            <select className="select" value={defaults.prevalence || "WHO TB report 2024"} onChange={e => setDefaults(current => ({ ...current, prevalence: e.target.value }))}><option>WHO TB report 2024</option><option>GBD 2023</option><option>Local (user-supplied)</option></select>
          </div>
        </div>
      </div>

      <div className="card card--pad">
        <h3 style={{fontSize:14, marginBottom:12}}>Validation rules</h3>
        <div className="stack" style={{gap:8, fontSize:13}}>
          {[
            ["Warn if unconnected outputs", true],
            ["Warn if missing terminal nodes", true],
            ["Warn if circular logic", true],
            ["Warn if prevalence not set", true],
            ["Flag evidence older than 10 years", false],
            ["Block save if below minimum sensitivity", false],
            ["Require referee on discordant branches", true],
          ].map(([l, d]) => {
            const key = flagKeyMap[l];
            return (
              <label key={l} className="row" style={{cursor:"pointer"}}>
                <span style={{flex:1}}>{l}</span>
                <Toggle
                  value={defaults.flags?.[key] ?? d}
                  onChange={next => setDefaults(current => ({
                    ...current,
                    flags: {
                      ...(current.flags || {}),
                      [key]: next,
                    },
                  }))}
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="card card--pad" style={{gridColumn:"span 2"}}>
        <h3 style={{fontSize:14, marginBottom:12}}>Default MCDA weights</h3>
        <p className="u-meta" style={{marginBottom:14}}>Applied when a new pathway uses the Balanced MCDA objective. Must sum to 1.00.</p>
        <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:16}}>
          {[["Sensitivity",0.30],["Specificity",0.30],["Cost",0.30],["TAT",0.10]].map(([l,v]) => {
            const key = weightKeyMap[l];
            return (
              <div key={l}>
                <div className="row"><span style={{fontSize:12, fontWeight:700}}>{l}</span><div className="spacer"/><span className="mono">{(defaults.weights?.[key] ?? v).toFixed(2)}</span></div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={defaults.weights?.[key] ?? v}
                  onChange={e => setDefaults(current => ({
                    ...current,
                    weights: {
                      ...(current.weights || {}),
                      [key]: Number(e.target.value),
                    },
                  }))}
                  style={{width:"100%", accentColor:"var(--sme-orange)"}}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SetBranding() {
  return (
    <>
      <ComingSoonHeader
        eyebrow="Reports use Syreon branding"
        title="Branding is not customizable"
        description={<>OptiDx reports always carry the official <b style={{color:"var(--sme-ink-900)"}}>Syreon</b> identity. As a non-profit public good, we keep the visual signature consistent so that every published pathway is recognizably traceable to a peer-curated source.</>}
      />
      <div className="grid" style={{gridTemplateColumns:"1.05fr 1fr", gap:16, marginTop:18}}>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:8}}>Locked elements</div>
          <h3 style={{fontSize:14, marginBottom:14}}>What's fixed in every report</h3>
          <div className="stack" style={{gap:10}}>
            {[
              { icon:"image", label:"Organization logo", val:"Syreon" },
              { icon:"sliders", label:"Accent color", val:"#F37739 Â· SME orange" },
              { icon:"file-text", label:"Report footer", val:"Today's research for tomorrow's health" },
              { icon:"users", label:"Issuing entity", val:"Syreon MENA HTA" },
              { icon:"info", label:"Publication domain", val:"optidx.syreon.me" },
            ].map(x => (
              <div key={x.label} className="row" style={{padding:"10px 12px", background:"var(--surface-2)", borderRadius:4, border:"1px solid var(--edge)"}}>
                <div style={{width:28, height:28, borderRadius:4, background:"var(--surface)", border:"1px solid var(--edge)", display:"grid", placeItems:"center", color:"var(--sme-orange-600)"}}>
                  <Icon name={x.icon} size={14}/>
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:12, color:"var(--fg-3)"}}>{x.label}</div>
                  <div style={{fontSize:13, fontWeight:700}}>{x.val}</div>
                </div>
                <Icon name="check" size={14} style={{color:"var(--fg-3)"}}/>
              </div>
            ))}
          </div>
          <div className="banner banner--info" style={{marginTop:14, fontSize:12}}>
            <Icon name="info" size={14} className="banner__icon"/>
            <div>White-label and custom branding are <b>not on the roadmap</b>. OptiDx is a non-profit public initiative, branding consistency is part of how we keep the platform free.</div>
          </div>
        </div>

        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:8}}>Preview</div>
          <h3 style={{fontSize:14, marginBottom:14}}>Standard report identity</h3>
          <div style={{background:"#fff", border:"1px solid var(--edge)", borderRadius:4, padding:24, fontSize:11, aspectRatio:"1/1.30"}}>
            <div className="row" style={{paddingBottom:12, borderBottom:"3px solid var(--sme-orange)"}}>
              <div>
                <div style={{fontWeight:800, color:"var(--sme-orange)", fontFamily:"var(--font-display)", fontSize:13, letterSpacing:"0.06em"}}>SYREON</div>
                <div style={{color:"var(--fg-3)", fontSize:9, marginTop:2}}>HEALTH TECHNOLOGY ASSESSMENT</div>
              </div>
              <div className="spacer"/>
              <div style={{color:"var(--fg-3)", fontSize:10, textAlign:"right"}}>OptiDx Decision Report<br/>v3 Â· 24 Apr 2026</div>
            </div>
            <div style={{padding:"16px 0 8px", fontWeight:700, fontSize:14, color:"var(--sme-ink-900)"}}>TB Community Screening Pathway</div>
            <div style={{color:"var(--fg-3)", lineHeight:1.5, fontSize:10}}>Under a prevalence of 8% in the target community, the proposed three-step pathway achieves an aggregate sensitivity of 84.2%...</div>
            <div style={{marginTop:14, height:64, background:"var(--surface-2)", borderRadius:3, display:"grid", placeItems:"center", color:"var(--fg-3)", fontSize:10}}>[ Pathway diagram ]</div>
            <div style={{marginTop:18, paddingTop:8, borderTop:"1px solid var(--edge)", display:"flex", justifyContent:"space-between", fontSize:8, color:"var(--fg-3)", letterSpacing:"0.1em"}}>
              <span>TODAY'S RESEARCH FOR TOMORROW'S HEALTH</span>
              <span>www.syreon.me</span>
            </div>
          </div>
          <div className="u-meta" style={{marginTop:10, textAlign:"center"}}>This identity ships on every PDF and DOCX export.</div>
        </div>
      </div>
    </>
  );
}

function ComingSoonHeader({ eyebrow, title, description, etaLabel = "Preview" }) {
  return (
    <div style={{
      position:"relative",
      borderRadius:8,
      background:"linear-gradient(135deg, var(--sme-ink-900) 0%, #1f262b 100%)",
      color:"#fff",
      padding:"24px 28px",
      overflow:"hidden",
    }}>
      <div style={{position:"absolute", inset:0, backgroundImage:"repeating-linear-gradient(135deg, rgba(243,119,57,0.05) 0 12px, transparent 12px 28px)", pointerEvents:"none"}}/>
      <div style={{position:"relative", display:"flex", alignItems:"flex-start", gap:18}}>
        <div style={{flex:1, minWidth:0}}>
          <div className="sme-eyebrow" style={{color:"var(--sme-orange-300, #F9B68C)", marginBottom:8}}>{eyebrow}</div>
          <h2 style={{fontSize:20, color:"#fff", marginBottom:8, fontFamily:"var(--font-display)"}}>{title}</h2>
          <p style={{fontSize:13, color:"#B0B5B9", lineHeight:1.6, maxWidth:680, margin:0}}>{description}</p>
        </div>
        <span style={{
          fontSize:10, fontWeight:800, letterSpacing:"0.16em", textTransform:"uppercase",
          padding:"5px 10px", borderRadius:3,
          background:"var(--sme-orange)", color:"#fff",
          fontFamily:"var(--font-display)", flexShrink:0,
        }}>{etaLabel}</span>
      </div>
    </div>
  );
}

function SetIntegrations() {
  const items = [
    { name:"REDCap", desc:"Import clinical data from REDCap projects.", icon:"database", category:"Data sources" },
    { name:"Zotero", desc:"Sync references from Zotero into your Evidence database.", icon:"file-text", category:"Evidence" },
    { name:"PubMed", desc:"Auto-link evidence records to PubMed identifiers.", icon:"database", category:"Evidence" },
    { name:"Cochrane Library", desc:"Pull systematic-review records into evidence cards.", icon:"file-text", category:"Evidence" },
    { name:"Microsoft Teams", desc:"Notify a Teams channel when a pathway run completes.", icon:"users", category:"Notifications" },
    { name:"Slack", desc:"Post pathway updates and shared reports to a Slack channel.", icon:"users", category:"Notifications" },
    { name:"DHIS2", desc:"Push aggregate pathway results to a DHIS2 instance.", icon:"bar-chart", category:"Health systems" },
    { name:"REST API", desc:"Call OptiDx pathway runs from your own analytics stack.", icon:"settings", category:"Developer" },
    { name:"Webhooks", desc:"Subscribe to run-completed events for downstream automation.", icon:"settings", category:"Developer" },
  ];
  return (
    <>
      <ComingSoonHeader
        eyebrow="Connect your stack"
        title="Integrations are coming soon"
        description={<>We're building first-class connectors for the data sources, evidence libraries, and notification channels HTA teams already use. This is a <b style={{color:"#fff"}}>preview</b> of what's on the roadmap, none of these are connectable yet.</>}
        etaLabel="Coming soon"
      />

      <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", marginTop:18}}>
        {items.map(it => (
          <div key={it.name} className="card card--pad" style={{display:"flex", flexDirection:"column", gap:10, position:"relative", opacity:0.92}}>
            <div className="row">
              <div style={{width:36, height:36, borderRadius:6, background:"var(--surface-2)", color:"var(--fg-2)", border:"1px solid var(--edge)", display:"grid", placeItems:"center"}}>
                <Icon name={it.icon} size={18}/>
              </div>
              <div className="spacer"/>
              <span className="chip chip--outline" style={{fontSize:10, letterSpacing:"0.1em"}}>Coming soon</span>
            </div>
            <div>
              <div style={{fontSize:14, fontWeight:700, color:"var(--sme-ink-900)"}}>{it.name}</div>
              <div className="u-meta" style={{marginTop:2}}>{it.category}</div>
              <div style={{fontSize:12, color:"var(--fg-2)", marginTop:8, lineHeight:1.5}}>{it.desc}</div>
            </div>
            <div style={{flex:1}}/>
            <button className="btn btn--sm" onClick={() => window.OptiDxActions.comingSoon("Notify me")}>
              <Icon name="info" size={12}/>Notify me
            </button>
          </div>
        ))}
      </div>

      <div style={{marginTop:18, padding:"14px 18px", border:"1px dashed var(--edge-2)", borderRadius:6, fontSize:12, color:"var(--fg-2)", textAlign:"center", lineHeight:1.6}}>
        Need a specific connector for your ministry, NGO or research group?<br/>
        Email <b style={{color:"var(--sme-orange-600)"}}>optidx@syreon.me</b>, we prioritise integrations that unblock public-health work.
      </div>
    </>
  );
}

function Toggle({ defaultOn = false, value, onChange }) {
  const [on, setOn] = useState(defaultOn);
  const active = value ?? on;
  return (
    <div onClick={() => {
      const next = !active;
      setOn(next);
      onChange?.(next);
    }} style={{
      width:32, height:18, borderRadius:999,
      background: active ? "var(--sme-orange)" : "var(--surface-3)",
      position:"relative", cursor:"pointer", transition:"background 120ms",
    }}>
      <div style={{
        position:"absolute", top:2, left: active ? 16 : 2,
        width:14, height:14, borderRadius:"50%", background:"#fff",
        boxShadow:"0 1px 2px rgba(0,0,0,0.2)", transition:"left 120ms",
      }}/>
    </div>
  );
}

// ---------- SHARE MODAL ---------------------------------------------------
function ShareModal({ onClose }) {
  const [copied, setCopied] = useState(false);
  const url = "https://optidx.app/s/tb-community-screening-pathway-v3";
  const platforms = [
    { id:"linkedin", label:"LinkedIn", color:"#0A66C2",
      icon:<path d="M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 1 1 8.25 6.5 1.75 1.75 0 0 1 6.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.82 0-1.62.62-1.62 1.96V19h-3v-9h2.9v1.3h.04c.29-.58 1.29-1.56 2.84-1.56 1.67 0 3.22 1 3.22 3.5V19z" fill="currentColor"/>},
    { id:"twitter", label:"X (Twitter)", color:"#000",
      icon:<path d="M18.244 2.25h3.308l-7.227 8.26L23.25 21.75h-6.66l-5.214-6.817-5.97 6.817H2.097l7.73-8.835L1.75 2.25h6.828l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>},
    { id:"facebook", label:"Facebook", color:"#1877F2",
      icon:<path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" fill="currentColor"/>},
    { id:"whatsapp", label:"WhatsApp", color:"#25D366",
      icon:<path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.2.3-.767.966-.94 1.164-.173.199-.347.223-.648.075-.3-.15-1.268-.467-2.415-1.483-.893-.795-1.496-1.78-1.671-2.08-.174-.3-.019-.465.13-.614.135-.135.3-.345.45-.52.149-.174.199-.3.299-.498.099-.2.05-.374-.025-.524-.074-.15-.672-1.62-.92-2.22-.241-.584-.487-.51-.67-.51-.174 0-.373-.019-.573-.019-.2 0-.523.074-.797.374-.273.3-1.045 1.02-1.045 2.49 0 1.47 1.07 2.89 1.22 3.09.149.2 2.102 3.204 5.097 4.49.712.31 1.269.494 1.703.632.715.227 1.366.195 1.88.118.574-.086 1.767-.72 2.018-1.414.249-.696.249-1.292.174-1.414-.074-.124-.274-.199-.574-.348zM12 2a10 10 0 0 0-8.42 15.37L2 22l4.78-1.25A10 10 0 1 0 12 2z" fill="currentColor"/>},
    { id:"email", label:"Email", color:"#5A6B78",
      icon:<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v.5l8 5 8-5V6H4zm16 2.65l-7.42 4.64a1.1 1.1 0 0 1-1.16 0L4 8.65V18h16V8.65z" fill="currentColor"/>},
    { id:"slack", label:"Slack", color:"#E01E5A",
      icon:<path d="M5 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5zm2-8a2 2 0 1 1 2-2v2H8zm0 1a2 2 0 1 1 0 4H3a2 2 0 1 1 0-4h5zm8 2a2 2 0 1 1 2 2h-2V10zm-1 0a2 2 0 1 1-4 0V5a2 2 0 1 1 4 0v5zm-2 8a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5z" fill="currentColor"/>},
  ];

  const copy = () => {
    return window.OptiDxActions.copyText?.(url)?.then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:560}}>
        <div className="modal__head">
          <div style={{width:36, height:36, borderRadius:6, background:"var(--sme-orange-050)",
            color:"var(--sme-orange-600)", display:"grid", placeItems:"center"}}>
            <Icon name="upload" size={16}/>
          </div>
          <div>
            <h2>Share pathway & summary</h2>
            <div className="u-meta">TB Community Screening Pathway Â· v3</div>
          </div>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>

        <div className="modal__body">
          {/* Preview card of what will be shared */}
          <div style={{border:"1px solid var(--edge)", borderRadius:6, overflow:"hidden", marginBottom:20}}>
            <div style={{padding:"14px 16px", background:"var(--sme-ink-900)", color:"#fff"}}>
              <div style={{fontSize:10, color:"var(--sme-orange)", letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, marginBottom:4}}>
                OptiDx Â· Pathway summary
              </div>
              <div style={{fontSize:15, fontWeight:700}}>TB Community Screening Pathway</div>
              <div style={{fontSize:11, color:"#B0B5B9", marginTop:4}}>WHO-4 â CAD4TB â Xpert Ultra Â· 3 tests Â· 8% prevalence</div>
            </div>
            <div style={{padding:"12px 16px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, fontSize:11}}>
              <div><div className="u-meta">Sens</div><b className="mono">84.2%</b></div>
              <div><div className="u-meta">Spec</div><b className="mono">94.6%</b></div>
              <div><div className="u-meta">$/case</div><b className="mono">$66.74</b></div>
              <div><div className="u-meta">TAT</div><b className="mono">2.8h</b></div>
            </div>
          </div>

          {/* Share surface */}
          <div className="field" style={{marginBottom:20}}>
            <label className="field__label">Share via</label>
            <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8}}>
              {platforms.map(p => (
                <button key={p.id} className="btn" style={{
                  flexDirection:"column", height:64, gap:6, padding:0, justifyContent:"center",
                }} onClick={() => window.OptiDxActions.comingSoon(`Share via ${p.label}`)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" style={{color:p.color}}>{p.icon}</svg>
                  <span style={{fontSize:10, fontWeight:400, color:"var(--fg-2)"}}>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Link */}
          <div className="field" style={{marginBottom:18}}>
            <label className="field__label">Or copy link</label>
            <div className="input-group">
              <input className="input" value={url} readOnly/>
              <button className="input-addon" onClick={copy} style={{cursor:"pointer", fontWeight:700, color: copied ? "var(--pos)" : "var(--sme-orange)"}}>
                {copied ? <><Icon name="check" size={12}/> Copied</> : <><Icon name="copy" size={12}/> Copy</>}
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="field" style={{marginBottom:14}}>
            <label className="field__label">What to include</label>
            <div className="stack" style={{gap:6, fontSize:13}}>
              {[
                ["Pathway diagram (SVG)", true],
                ["Aggregate metrics", true],
                ["Cost per detected case", true],
                ["Path-level trace table", false],
                ["Evidence references", false],
              ].map(([l, d]) => (
                <label key={l} className="row" style={{cursor:"pointer"}}>
                  <input type="checkbox" defaultChecked={d} style={{accentColor:"var(--sme-orange)"}}/>
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Access */}
          <div className="field">
            <label className="field__label">Link access</label>
            <select className="select">
              <option>Anyone with the link (view only)</option>
              <option>Anyone in Syreon MENA HTA</option>
              <option>Specific people</option>
            </select>
            <div className="field__hint">Viewers see a read-only snapshot. Editing requires sign-in.</div>
          </div>
        </div>

        <div className="modal__foot">
          <button className="btn" onClick={onClose}>Done</button>
          <button className="btn btn--primary" onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({ title: "OptiDx pathway", text: "Share this pathway", url });
              } else {
                await copy();
              }
              onClose?.();
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to share pathway", "error");
            }
          }}><Icon name="upload"/>Share</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenLibrary, ScreenScenarios, ScreenSettingsFull, ShareModal, ScreenTeams });

// ---------- TEAMS (coming soon) -------------------------------------------
function ScreenTeams() {
  const [email, setEmail] = useState("");
  const [waitlisted, setWaitlisted] = useState(false);

  return (
    <>
      <TopBar
        crumbs={["OptiDx","Teams"]}
        actions={<span className="chip chip--orange" style={{height:24, padding:"0 10px"}}>Coming soon</span>}
      />
      <div className="page" style={{maxWidth:1200}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Collaboration Â· In development</div>
            <h1>Teams &amp; collaboration</h1>
            <p>Invite colleagues, share pathways for review, and co-author with role-based permissions. Currently in private beta, join the waitlist to get early access.</p>
          </div>
        </div>

        {/* Hero / waitlist */}
        <div className="card" style={{padding:0, overflow:"hidden", marginBottom:24, position:"relative"}}>
          <div style={{
            background:"var(--sme-ink-900)", color:"#fff",
            padding:"40px 48px",
            display:"grid", gridTemplateColumns:"1.1fr 1fr", gap:48, alignItems:"center",
            position:"relative", overflow:"hidden",
          }}>
            {/* Decorative network */}
            <svg viewBox="0 0 460 280" style={{position:"absolute", right:0, top:0, height:"100%", opacity:0.45}}>
              {[
                [80,80],[180,50],[280,90],[380,60],
                [60,180],[160,200],[260,170],[360,210],
                [120,260],[220,250],[320,250],
              ].map(([x,y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill="#F37739"/>
                  <circle cx={x} cy={y} r="14" fill="none" stroke="#F37739" strokeOpacity="0.3"/>
                </g>
              ))}
              <g stroke="#5A6B78" strokeOpacity="0.4" fill="none" strokeWidth="0.8">
                <path d="M80 80 L180 50 M180 50 L280 90 M280 90 L380 60"/>
                <path d="M60 180 L160 200 M160 200 L260 170 M260 170 L360 210"/>
                <path d="M80 80 L60 180 M180 50 L160 200 M280 90 L260 170 M380 60 L360 210"/>
                <path d="M60 180 L120 260 M160 200 L220 250 M260 170 L320 250"/>
              </g>
            </svg>

            <div style={{position:"relative", zIndex:1}}>
              <div className="sme-eyebrow" style={{color:"var(--sme-orange)", marginBottom:14}}>FEATURE PREVIEW</div>
              <h2 style={{fontSize:32, lineHeight:1.15, letterSpacing:"-0.02em", color:"#fff", marginBottom:14, textWrap:"balance"}}>
                Bring your whole HTA team into the same pathway.
              </h2>
              <p style={{fontSize:14, color:"#B0B5B9", lineHeight:1.55, marginBottom:24, maxWidth:480}}>
                Workspaces, projects, granular roles, and review threads on every node, designed for the way clinicians, economists and lab directors actually work together.
              </p>

              {!waitlisted ? (
                <form onSubmit={e => { e.preventDefault(); setWaitlisted(true); }}
                  style={{display:"flex", gap:8, maxWidth:460}}>
                  <input className="input" placeholder="Work email" value={email}
                    onChange={e => setEmail(e.target.value)} required
                    style={{background:"#3A4248", borderColor:"#4A5056", color:"#fff", height:40}}/>
                  <button type="submit" className="btn btn--primary" style={{height:40}}>
                    Join waitlist <Icon name="arrow-right"/>
                  </button>
                </form>
              ) : (
                <div className="banner" style={{background:"rgba(91,138,95,0.15)", border:"1px solid #5B8A5F", color:"#A8D4AB", maxWidth:460}}>
                  <Icon name="check" size={16} className="banner__icon" style={{color:"#5B8A5F"}}/>
                  <div>You're on the list. We'll email <b style={{color:"#fff"}}>{email}</b> as soon as Teams is available.</div>
                </div>
              )}
              <div style={{marginTop:14, fontSize:11, color:"#8A9299"}}>
                Estimated rollout: <b style={{color:"#fff"}}>Q3 2027</b> Â· Already invited 142 organizations
              </div>
            </div>

            <div style={{position:"relative", zIndex:1}}>
              <TeamsPreviewCard currentUser={currentUser}/>
            </div>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid" style={{gridTemplateColumns:"repeat(3, 1fr)", gap:16, marginBottom:24}}>
          <FeatureCard icon="users" title="Workspaces &amp; projects"
            desc="Group pathways under projects with separate evidence libraries, defaults and report branding per workspace." />
          <FeatureCard icon="user" title="Granular roles"
            desc="Owner, Editor, Clinical reviewer, Analyst and Viewer roles with explicit permissions for runs, edits and exports." />
          <FeatureCard icon="clipboard-list" title="Review threads"
            desc="Comment on any node, edge or assumption. Resolve threads, request changes, and approve sign-offs." />
          <FeatureCard icon="git-branch" title="Branches &amp; suggestions"
            desc="Propose changes to a pathway without overwriting it. Diff and merge between collaborators." />
          <FeatureCard icon="lock" title="SSO &amp; SCIM"
            desc="Map IdP groups to OptiDx roles. Auto-provision and de-provision when staff join or leave." />
          <FeatureCard icon="check" title="Audit log"
            desc="Tamper-evident history of who edited what, who ran the optimizer, and who exported reports." />
        </div>

        {/* Mock team list */}
        <div className="card" style={{padding:0, opacity:0.85}}>
          <div className="card__head">
            <h3>Members <span className="u-meta" style={{marginLeft:8, fontWeight:400}}>(preview Â· disabled)</span></h3>
            <div className="spacer"/>
            <button className="btn btn--sm" onClick={() => window.OptiDxActions.comingSoon("Invite member")}><Icon name="plus" size={12}/>Invite member</button>
          </div>
          <table className="table">
            <thead><tr>
              <th>Member</th><th>Role</th><th>Projects</th><th>Last active</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {[
                [[currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || currentUser?.name || "Current user", currentUser?.email || "your.email@example.com", currentUser?.title || "Owner", "All projects","Just now","active", getInitials([currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || currentUser?.name || "Current user"), "var(--sme-orange)"],
                ["Ahmed Khalil","ahmed.khalil@syreon.me","Editor","TB MENA Â· NCD Egypt","2h ago","active","AK","var(--refer)"],
                ["Dr. Layla Haddad","l.haddad@cu.edu.eg","Clinical reviewer","TB MENA","Yesterday","invited","LH","var(--pos)"],
                ["Omar Fouad","omar.f@minhealth.gov.eg","Viewer","NCD Egypt","3 days","active","OF","var(--inconcl)"],
                ["Reem Saleh","reem.saleh@who.int","Analyst","All projects","1 wk","invited","RS","#7B5BA6"],
              ].map(([n,e,r,p,t,s,i,c]) => (
                <tr key={n}>
                  <td>
                    <div className="row" style={{gap:10}}>
                      <div style={{width:30, height:30, borderRadius:"50%", background:c, color:"#fff",
                        display:"grid", placeItems:"center", fontWeight:700, fontSize:11}}>{i}</div>
                      <div>
                        <div style={{fontSize:13, fontWeight:700}}>{n}</div>
                        <div className="u-meta">{e}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip chip--outline">{r}</span></td>
                  <td className="u-meta">{p}</td>
                  <td className="u-meta mono">{t}</td>
                  <td>
                    <span className={"chip " + (s === "active" ? "chip--pos" : "chip--inc")}>
                      {s === "active" ? "Active" : "Invited"}
                    </span>
                  </td>
                  <td><Icon name="more" size={14} style={{color:"var(--fg-3)"}}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{padding:"14px 20px", borderTop:"1px solid var(--edge)", textAlign:"center", color:"var(--fg-3)", fontSize:12, background:"var(--surface-2)"}}>
            <Icon name="info" size={12}/> Member management is part of the Teams feature, currently in private beta.
          </div>
        </div>
      </div>
    </>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card card--pad" style={{display:"flex", flexDirection:"column", gap:10}}>
      <div style={{width:36, height:36, borderRadius:6, background:"var(--sme-orange-050)",
        color:"var(--sme-orange-600)", display:"grid", placeItems:"center"}}>
        <Icon name={icon} size={18}/>
      </div>
      <div style={{fontSize:14, fontWeight:700}} dangerouslySetInnerHTML={{__html: title}}/>
      <div style={{fontSize:12, color:"var(--fg-3)", lineHeight:1.5}} dangerouslySetInnerHTML={{__html: desc}}/>
    </div>
  );
}

function TeamsPreviewCard({ currentUser }) {
  const currentName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || currentUser?.name || "Current user";
  const currentInitials = getInitials(currentName);
  return (
    <div style={{
      background:"#fff", color:"var(--fg-1)",
      borderRadius:8, boxShadow:"0 30px 60px rgba(0,0,0,0.4)",
      padding:18, transform:"rotate(-1.5deg)",
    }}>
      <div className="row" style={{marginBottom:14, paddingBottom:10, borderBottom:"1px solid var(--edge)"}}>
        <div style={{width:8, height:8, borderRadius:"50%", background:"var(--pos)"}}/>
        <b style={{fontSize:12}}>TB Community Screening Â· v3</b>
        <div className="spacer"/>
        <div style={{display:"flex"}}>
          {[[currentInitials,"var(--sme-orange)"],["AK","var(--refer)"],["LH","var(--pos)"]].map(([i,c],k) => (
            <div key={i} style={{
              width:22, height:22, borderRadius:"50%", background:c, color:"#fff",
              display:"grid", placeItems:"center", fontWeight:700, fontSize:9,
              border:"2px solid #fff", marginLeft: k > 0 ? -8 : 0,
            }}>{i}</div>
          ))}
        </div>
      </div>

      <div className="stack" style={{gap:10}}>
        <CommentRow initials="LH" color="var(--pos)" name="Dr. Layla Haddad" time="2h" role="Clinical reviewer"
          text="The Xpert-negative branch may miss early disease, should we add LF-LAM in parallel for HIV+ cohorts?"/>
        <CommentRow initials="AK" color="var(--refer)" name="Ahmed Khalil" time="1h" role="Editor"
          text="Good catch. Adding parallel LF-LAM bumps sens 0.03 at +$0.40/pt." reply/>
        <CommentRow initials={currentInitials} color="var(--sme-orange)" name={currentName} time="just now" role="Owner"
          text="Approving v3 with the parallel addition. Ready for export." status="approved"/>
      </div>
    </div>
  );
}

function CommentRow({ initials, color, name, role, time, text, reply, status }) {
  return (
    <div style={{display:"flex", gap:8, paddingLeft: reply ? 22 : 0}}>
      <div style={{width:24, height:24, borderRadius:"50%", background:color, color:"#fff",
        display:"grid", placeItems:"center", fontWeight:700, fontSize:9, flexShrink:0}}>{initials}</div>
      <div style={{flex:1, fontSize:11, lineHeight:1.45}}>
        <div className="row" style={{gap:6, marginBottom:2}}>
          <b>{name}</b>
          <span className="u-meta" style={{fontSize:10}}>{role} Â· {time}</span>
          {status === "approved" && <span className="chip chip--pos" style={{height:16, padding:"0 6px", fontSize:9}}>Approved</span>}
        </div>
        <div style={{color:"var(--fg-2)"}}>{text}</div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';


