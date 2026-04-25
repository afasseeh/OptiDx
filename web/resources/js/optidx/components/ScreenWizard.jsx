// Wizard — New pathway setup (4 steps)
function ScreenWizard({ setScreen }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(null); // null | "test" | "optimize"
  const [objective, setObjective] = useState("Balanced MCDA");
  const [optimization, setOptimization] = useState({ status: "idle", progress: 0, stage: "", error: null });
  const steps = ["Disease", "Test library", "Constraints", "Review", "Run"];

  const runOptimization = async () => {
    if (optimization.status === "running") return;

    const stages = [
      "Preparing the test library and constraints.",
      "Enumerating feasible pathway templates.",
      "Calling the backend optimization engine.",
      "Ranking the Pareto frontier candidates.",
      "Packaging the best pathways for review.",
    ];

    setOptimization({ status: "running", progress: 8, stage: stages[0], error: null });
    let stageIndex = 0;
    const timer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, stages.length - 1);
      setOptimization(current => {
        if (current.status !== "running") return current;
        return {
          ...current,
          progress: Math.min(92, current.progress + (stageIndex < 2 ? 10 : 6)),
          stage: stages[stageIndex],
        };
      });
    }, 1100);

    try {
      const payload = {
        tests: window.SEED_TESTS.map(test => ({
          id: test.id,
          name: test.name,
          sensitivity: test.sens,
          specificity: test.spec,
          turnaround_time: test.tat,
          turnaround_time_unit: test.tatUnit,
          sample_types: [test.sample],
          skill_level: test.skill,
          cost: test.cost,
        })),
        constraints: {
          minimum_sensitivity: 0.85,
          minimum_specificity: 0.90,
          maximum_total_cost: 10,
        },
        prevalence: 0.08,
      };

      const result = await window.OptiDxActions.optimizePathways(payload);
      window.clearInterval(timer);
      setOptimization({
        status: "done",
        progress: 100,
        stage: `Prepared ${result?.candidate_count ?? 0} candidates.`,
        error: null,
      });
      window.setTimeout(() => {
        setScreen("scenarios");
      }, 650);
    } catch (error) {
      window.clearInterval(timer);
      setOptimization({
        status: "error",
        progress: 0,
        stage: "",
        error: error?.message || "Optimization failed.",
      });
      window.OptiDxActions.showToast?.("Optimization failed", "error");
    }
  };

  const onContinue = async () => {
    if (step < 4) setStep(step + 1);
    else if (mode === "optimize") await runOptimization();
    else setScreen("canvas");
  };

  return (
    <>
      <TopBar
        crumbs={["OptiDx", "New pathway"]}
        actions={<>
          <button className="btn btn--ghost" onClick={() => setScreen("home")}>Cancel</button>
          <button className="btn btn--primary" onClick={onContinue}
            disabled={step === 4 && !mode || optimization.status === "running"}>
            {step < 3 ? "Continue" : step === 3 ? "Continue" : (mode === "optimize" ? "Run optimization" : mode === "test" ? "Enter canvas" : "Choose a mode")}
            <Icon name="arrow-right"/>
          </button>
        </>}
      />
      <div style={{maxWidth:960, margin:"0 auto", padding:"16px 40px 56px"}}>
        {/* Stepper */}
        <div className="row" style={{marginBottom:28, gap:0}}>
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className="row" style={{gap:10, cursor:"pointer"}} onClick={() => setStep(i)}>
                <div style={{
                  width:28, height:28, borderRadius:"50%",
                  background: i <= step ? "var(--sme-orange)" : "var(--surface-3)",
                  color: i <= step ? "#fff" : "var(--fg-3)",
                  display:"grid", placeItems:"center",
                  fontSize:12, fontWeight:700
                }}>{i < step ? <Icon name="check" size={14}/> : i+1}</div>
                <div style={{fontSize:13, fontWeight: i === step ? 700 : 400,
                  color: i <= step ? "var(--fg-1)" : "var(--fg-3)"}}>{s}</div>
              </div>
              {i < steps.length - 1 && <div style={{flex:1, height:1, background:"var(--edge)", margin:"0 16px"}}/>}
            </React.Fragment>
          ))}
        </div>

        {step === 0 && <WizardStep1 objective={objective} setObjective={setObjective}/>}
        {step === 1 && <WizardStep2/>}
        {step === 2 && <WizardStep3/>}
        {step === 3 && <WizardStep4/>}
        {step === 4 && <WizardStep5 mode={mode} setMode={setMode}/>}
        {optimization.status !== "idle" && (
          <OptimizationOverlay optimization={optimization} />
        )}
      </div>
    </>
  );
}

function OptimizationOverlay({ optimization }) {
  const currentStage = optimization.stage || "Preparing candidate pathways.";
  return (
    <div className="optimization-overlay">
      <div className={"card optimization-card " + (optimization.status === "running" ? "is-running" : optimization.status === "done" ? "is-done" : optimization.status === "error" ? "is-error" : "")}>
        <div className="row" style={{alignItems:"flex-start"}}>
          <div className={"optimization-orb " + (optimization.status === "done" ? "is-done" : optimization.status === "error" ? "is-error" : "")}>
            <span />
          </div>
          <div style={{flex:1}}>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Backend optimization</div>
            <h3 style={{fontSize:18, marginBottom:6}}>
              {optimization.status === "done" ? "Optimization completed" : optimization.status === "error" ? "Optimization failed" : "Finding the optimal pathway"}
            </h3>
            <p style={{fontSize:13, color:"var(--fg-2)", lineHeight:1.55, marginBottom:14}}>
              {currentStage}
            </p>
            <div className="optimization-progress" aria-label="Optimization progress">
              <div
                className={"optimization-progress__bar " + (optimization.status === "running" ? "is-running" : "")}
                style={{width: `${optimization.progress}%`}}
              />
            </div>
            <div className="optimization-progress__meta">
              <span>{optimization.status === "done" ? "Finished" : optimization.status === "error" ? "Stopped" : "Running"}</span>
              <span>{optimization.progress}%</span>
            </div>
            {optimization.error && (
              <div className="banner banner--err" style={{marginTop:12}}>
                <Icon name="alert-triangle" size={14} className="banner__icon" />
                <div>{optimization.error}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep5({ mode, setMode }) {
  return (
    <div>
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 05</div>
      <h2 style={{fontSize:22, marginBottom:4}}>How would you like to proceed?</h2>
      <p style={{color:"var(--fg-3)", marginBottom:24, fontSize:13}}>
        Choose whether to build and test a specific pathway, or let the optimizer search for the best configurations under your constraints.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div onClick={() => setMode("test")} className="card card--pad" style={{
          cursor:"pointer", borderColor: mode === "test" ? "var(--sme-orange)" : undefined,
          borderWidth: mode === "test" ? 2 : 1, background: mode === "test" ? "var(--sme-orange-050)" : undefined,
          transition: "all 120ms"}}>
          <div style={{width:44, height:44, borderRadius:8, background:"var(--sme-orange)", color:"#fff",
            display:"grid", placeItems:"center", marginBottom:12}}>
            <Icon name="git-branch" size={22}/>
          </div>
          <h3 style={{fontSize:17, marginBottom:6}}>Test a pathway I have in mind</h3>
          <p style={{color:"var(--fg-3)", fontSize:13, lineHeight:1.5, marginBottom:14}}>
            Open the canvas and build a specific diagnostic pathway by dragging tests and routing
            rules. Run it to see sensitivity, specificity, cost per detected case and TAT.
          </p>
          <div className="stack" style={{gap:4, fontSize:12, color:"var(--fg-2)"}}>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>You know the clinical algorithm</div>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>Best for replicating WHO / published guidance</div>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>Full manual control</div>
          </div>
        </div>

        <div onClick={() => setMode("optimize")} className="card card--pad" style={{
          cursor:"pointer", borderColor: mode === "optimize" ? "var(--sme-orange)" : undefined,
          borderWidth: mode === "optimize" ? 2 : 1, background: mode === "optimize" ? "var(--sme-orange-050)" : undefined,
          transition: "all 120ms"}}>
          <div style={{width:44, height:44, borderRadius:8, background:"var(--sme-ink-900)", color:"var(--sme-orange)",
            display:"grid", placeItems:"center", marginBottom:12}}>
            <Icon name="sliders" size={22}/>
          </div>
          <h3 style={{fontSize:17, marginBottom:6}}>Find the optimal pathway</h3>
          <p style={{color:"var(--fg-3)", fontSize:13, lineHeight:1.5, marginBottom:14}}>
            Let OptiDx enumerate test orderings and rules under your constraints, then surface
            multiple optimization scenarios along the Pareto frontier to compare.
          </p>
          <div className="stack" style={{gap:4, fontSize:12, color:"var(--fg-2)"}}>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>Explore cost-optimal, sensitivity-maximal, fastest, etc.</div>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>Compare 3–6 candidates side-by-side</div>
            <div className="row"><Icon name="check" size={12} style={{color:"var(--pos)"}}/>Load any scenario back into the canvas to refine</div>
          </div>
        </div>
      </div>
      {mode && (
        <div className="banner banner--info" style={{marginTop:18}}>
          <Icon name="info" size={16} className="banner__icon"/>
          <div>
            {mode === "test"
              ? "The canvas will open with your selected tests placed on a blank grid."
              : "The optimizer will search the current test library and return the best feasible candidates along the Pareto frontier."}
          </div>
        </div>
      )}
    </div>
  );
}

function WizardStep1({ objective, setObjective }) {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 01</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Disease and clinical context</h2>
      <p style={{color:"var(--fg-3)", marginBottom:24, fontSize:13}}>
        Define what this pathway diagnoses, who it is for, and what it optimizes for.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="field">
          <label className="field__label">Condition name</label>
          <input className="input" defaultValue="Pulmonary tuberculosis"/>
        </div>
        <div className="field">
          <label className="field__label">Clinical context</label>
          <select className="select" defaultValue="comm"><option value="comm">Community screening</option><option>Primary care triage</option><option>Hospital admission</option></select>
        </div>
        <div className="field">
          <label className="field__label">Target population</label>
          <input className="input" defaultValue="Adults ≥15 yrs presenting with cough >2 weeks"/>
        </div>
        <div className="field field--with-suffix">
          <label className="field__label">Disease prevalence <span style={{fontWeight:400, color:"var(--fg-3)"}}>(optional)</span></label>
          <input className="input" defaultValue="8.0" type="number"/>
          <span className="field__suffix" style={{top:"70%"}}>%</span>
          <div className="field__hint">Enables PPV / NPV calculation in results.</div>
        </div>
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Pathway objective</label>
          <div className="row row--wrap" style={{gap:6}}>
            {["Minimize cost","Maximize sensitivity","Maximize specificity","Minimize TAT","Balanced MCDA","Custom"].map((o) =>
              <button key={o} type="button" onClick={() => setObjective(o)} className={"btn btn--sm" + (objective === o ? " btn--ink" : "")}>{o}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep2() {
  const [, setLibraryRevision] = useState(0);
  useEffect(() => {
    const onUpdate = () => setLibraryRevision(v => v + 1);
    window.addEventListener("optidx-tests-updated", onUpdate);
    return () => window.removeEventListener("optidx-tests-updated", onUpdate);
  }, []);

  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 02</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Diagnostic test library</h2>
      <p style={{color:"var(--fg-3)", marginBottom:20, fontSize:13}}>
        Add the tests you want available on the canvas. Import from evidence database or define manually.
      </p>
      <div className="row" style={{marginBottom:12, gap:8}}>
        <button className="btn btn--primary" onClick={() => window.OptiDxActions.addManualTest?.() }><Icon name="plus"/>Add test</button>
        <button className="btn" onClick={() => window.OptiDxActions.comingSoon("Import from evidence")}><Icon name="database"/>Import from evidence</button>
        <div className="spacer"/>
        <span className="u-meta">{window.SEED_TESTS.length} tests in library</span>
      </div>
      <div className="card card--flush">
        <table className="table">
          <thead><tr>
            <th>Test</th><th>Category</th><th className="num">Sens</th><th className="num">Spec</th>
            <th className="num">Cost</th><th>TAT</th><th>Sample</th><th>Skill</th><th/>
          </tr></thead>
          <tbody>
            {window.SEED_TESTS.slice(0,7).map(t => (
              <tr key={t.id}>
                <td><b>{t.name}</b></td>
                <td><span className="chip chip--outline">{t.category}</span></td>
                <td className="num mono">{t.sens.toFixed(2)}</td>
                <td className="num mono">{t.spec.toFixed(2)}</td>
                <td className="num mono">${t.cost.toFixed(2)}</td>
                <td className="mono">{t.tat}{t.tatUnit}</td>
                <td>{t.sample}</td>
                <td>{t.skill}</td>
                <td style={{textAlign:"right"}}><Icon name="more" size={14} style={{color:"var(--fg-3)"}}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WizardStep3() {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 03</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Constraints and feasibility</h2>
      <p style={{color:"var(--fg-3)", marginBottom:20, fontSize:13}}>
        These bound the search space and trigger warnings if violated.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
        {[
          ["Minimum acceptable sensitivity","0.85",""],
          ["Minimum acceptable specificity","0.90",""],
          ["Maximum cost per patient","10.00","USD"],
          ["Maximum turnaround time","72","hours"],
        ].map(([l,v,s]) => (
          <div key={l} className="field field--with-suffix">
            <label className="field__label">{l}</label>
            <input className="input" defaultValue={v}/>
            {s && <span className="field__suffix" style={{top:"70%"}}>{s}</span>}
          </div>
        ))}
        <div className="field">
          <label className="field__label">Max required skill level</label>
          <select className="select"><option>Lab technician</option><option>Radiologist</option><option>Specialist physician</option></select>
        </div>
        <div className="field">
          <label className="field__label">Setting</label>
          <select className="select"><option>Community</option><option>Primary care</option><option>Hospital</option><option>Mobile unit</option></select>
        </div>
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Allowed sample types</label>
          <div className="row row--wrap" style={{gap:6}}>
            {["None","Blood","Urine","Stool","Sputum","Nasal swab","Imaging"].map((s,i) =>
              <button key={s} type="button" onClick={() => window.OptiDxActions.comingSoon(`Sample type: ${s}`)} className={"btn btn--sm" + (i < 5 ? " btn--ink" : "")}>
                {i < 5 && <Icon name="check" size={11}/>}{s}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep4() {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 04</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Review and enter canvas</h2>
      <p style={{color:"var(--fg-3)", marginBottom:20, fontSize:13}}>
        Verify the configuration. You can edit any of this from the canvas.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:12}}>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Disease</div>
          <div style={{fontSize:15, fontWeight:700}}>Pulmonary tuberculosis</div>
          <div className="u-meta" style={{marginTop:4}}>Community screening · Adults ≥15 with cough {" > "}2 wk · Prevalence 8%</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Objective</div>
          <div style={{fontSize:15, fontWeight:700}}>Balanced MCDA</div>
          <div className="u-meta" style={{marginTop:4}}>Weights: Cost 0.3 · Sens 0.3 · Spec 0.3 · TAT 0.1</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Test library</div>
          <div style={{fontSize:15, fontWeight:700}}>7 tests · 4 categories</div>
          <div className="u-meta" style={{marginTop:4}}>Clinical · Imaging · Molecular · Pathology</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Constraints</div>
          <div style={{fontSize:15, fontWeight:700}}>Sens ≥ 0.85 · Spec ≥ 0.90</div>
          <div className="u-meta" style={{marginTop:4}}>Cost ≤ $10 · TAT ≤ 72h · Max skill: Lab tech</div>
        </div>
      </div>
      <div className="banner banner--info" style={{marginTop:20}}>
        <Icon name="info" size={16} className="banner__icon"/>
        <div>You can return to this wizard later from <b>Settings → Pathway parameters</b>.</div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenWizard });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

