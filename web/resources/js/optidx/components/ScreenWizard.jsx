// Wizard — New pathway setup (4 steps)
const OPTIMIZATION_STAGES = [
  "Preparing the test library and constraints.",
  "Enumerating feasible pathway templates.",
  "Calling the backend optimization engine.",
  "Ranking the Pareto frontier candidates.",
  "Packaging the best pathways for review.",
];

function ScreenWizard({ setScreen }) {
  const [step, setStep] = useState(() => Number(window.OptiDxWizardStep ?? 0) || 0);
  const [mode, setMode] = useState(null); // null | "test" | "optimize"
  const [objective, setObjective] = useState("Balanced MCDA");
  const [sampleTypes, setSampleTypes] = useState(["None", "Blood", "Urine", "Stool", "Sputum"]);
  const [project, setProject] = useState(() => ({
    conditionName: "Pulmonary tuberculosis",
    clinicalContext: "comm",
    targetPopulation: "Adults ≥15 yrs presenting with cough >2 weeks",
    prevalence: "8.0",
    minimumSensitivity: "0.85",
    minimumSpecificity: "0.90",
    maximumCost: "10.00",
    maximumTat: "72",
    maxSkillLevel: "Lab technician",
  }));
  const [optimization, setOptimization] = useState({ status: "idle", progress: 0, stage: "", error: null });
  const steps = ["Disease", "Test library", "Constraints", "Review", "Run"];

  useEffect(() => {
    window.OptiDxWizardStep = step;
  }, [step]);

  const runOptimization = async () => {
    if (optimization.status === "running") return;

    const startedAt = performance.now();
    const minimumVisibleMs = 1200;
    setOptimization({ status: "running", progress: 12, stage: OPTIMIZATION_STAGES[0], error: null });
    let stageIndex = 0;
    const timer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, OPTIMIZATION_STAGES.length - 1);
      setOptimization(current => {
        if (current.status !== "running") return current;
        return {
          ...current,
          progress: Math.min(92, current.progress + (stageIndex < 2 ? 12 : 8)),
          stage: OPTIMIZATION_STAGES[stageIndex],
        };
      });
    }, 850);

    try {
      const prevalence = Number.parseFloat(project.prevalence);
      const minimumSensitivity = Number.parseFloat(project.minimumSensitivity);
      const minimumSpecificity = Number.parseFloat(project.minimumSpecificity);
      const maximumCost = Number.parseFloat(project.maximumCost);
      const maximumTat = Number.parseFloat(project.maximumTat);
      const maxSkillLevel = project.maxSkillLevel === "Radiologist" || project.maxSkillLevel === "Specialist physician" ? 4 : 3;
      const allowedSampleTypes = sampleTypes
        .filter(sample => sample && sample !== "None")
        .map(sample => sample.toLowerCase());
      const tests = (window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || []).map(test => ({
        id: test.id,
        name: test.name,
        sensitivity: test.sens,
        specificity: test.spec,
        turnaround_time: test.tat,
        turnaround_time_unit: test.tatUnit,
        sample_types: [test.sample],
        skill_level: test.skill,
        cost: test.cost,
      }));
      const payload = {
        tests,
        constraints: {
          objective,
          minimum_sensitivity: Number.isFinite(minimumSensitivity) ? minimumSensitivity : null,
          minimum_specificity: Number.isFinite(minimumSpecificity) ? minimumSpecificity : null,
          maximum_total_cost: Number.isFinite(maximumCost) ? maximumCost : null,
          maximum_turnaround_time: Number.isFinite(maximumTat) ? maximumTat : null,
          maximum_skill_level: maxSkillLevel,
          allowed_sample_types: allowedSampleTypes,
        },
        prevalence: Number.isFinite(prevalence) ? prevalence / 100 : null,
      };

      const result = await window.OptiDxActions.optimizePathways(payload);
      const elapsed = performance.now() - startedAt;
      if (elapsed < minimumVisibleMs) {
        await new Promise(resolve => window.setTimeout(resolve, minimumVisibleMs - elapsed));
      }
      window.clearInterval(timer);
      setOptimization({
        status: "done",
        progress: 100,
        stage: `Prepared ${result?.pareto_frontier?.length ?? result?.candidate_count ?? 0} candidates.`,
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
    else {
      window.OptiDxActions?.setActivePathwayDraft?.(window.OptiDxActions?.createStarterCanvasGraph?.());
      setScreen("canvas");
    }
  };

  return (
    <>
      <TopBar
        crumbs={["OptiDx", "New project"]}
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

        {step === 0 && <WizardStep1 objective={objective} setObjective={setObjective} project={project} setProject={setProject}/>}
        {step === 1 && <WizardStep2 setScreen={setScreen}/>}
        {step === 2 && <WizardStep3 sampleTypes={sampleTypes} setSampleTypes={setSampleTypes} project={project} setProject={setProject}/>}
        {step === 3 && <WizardStep4 objective={objective} sampleTypes={sampleTypes} project={project}/>}
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
  const currentStageIndex = Math.max(0, OPTIMIZATION_STAGES.findIndex(stage => stage === currentStage));
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
            <div className="optimization-progress__steps" aria-hidden="true">
              {OPTIMIZATION_STAGES.map((stage, index) => (
                <span
                  key={stage}
                  className={"optimization-progress__step" + (index <= currentStageIndex ? " is-active" : "")}
                >
                  {index + 1}
                </span>
              ))}
            </div>
            <div className="optimization-progress" aria-label="Optimization progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(optimization.progress || 0)}>
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
              ? "The canvas will open with required positive and negative endpoints already placed on the right side."
              : "The optimizer will search the current test library and return the best feasible candidates along the Pareto frontier."}
          </div>
        </div>
      )}
    </div>
  );
}

function WizardStep1({ objective, setObjective, project, setProject }) {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 01</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Project and clinical context</h2>
      <p style={{color:"var(--fg-3)", marginBottom:24, fontSize:13}}>
        Define what this project diagnoses, who it is for, and what it optimizes for.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="field">
          <label className="field__label">Condition name</label>
          <input
            className="input"
            value={project.conditionName}
            onChange={e => setProject(current => ({ ...current, conditionName: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field__label">Clinical context</label>
          <select
            className="select"
            value={project.clinicalContext}
            onChange={e => setProject(current => ({ ...current, clinicalContext: e.target.value }))}
          >
            <option value="comm">Community screening</option>
            <option value="primary">Primary care triage</option>
            <option value="hospital">Hospital admission</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Target population</label>
          <input
            className="input"
            value={project.targetPopulation}
            onChange={e => setProject(current => ({ ...current, targetPopulation: e.target.value }))}
          />
        </div>
        <div className="field field--with-suffix">
          <label className="field__label">Disease prevalence <span style={{fontWeight:400, color:"var(--fg-3)"}}>(optional)</span></label>
          <input
            className="input"
            value={project.prevalence}
            onChange={e => setProject(current => ({ ...current, prevalence: e.target.value }))}
            type="number"
            min="0"
            max="100"
            step="0.1"
          />
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

function WizardStep2({ setScreen }) {
  const [, setLibraryRevision] = useState(0);
  const [menuFor, setMenuFor] = useState(null);
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
        Add the tests you want available for this project. Import from the evidence database or define them manually.
      </p>
      <div className="row" style={{marginBottom:12, gap:8}}>
        <button className="btn btn--primary" onClick={async () => {
          try {
            await window.OptiDxActions.addManualTest?.();
          } catch (error) {
            window.OptiDxActions.showToast?.(error?.message || "Unable to add test", "error");
          }
        }}><Icon name="plus"/>Add test</button>
        <button className="btn" onClick={() => setScreen("evidence")}><Icon name="database"/>Import from evidence</button>
        <div className="spacer"/>
        <span className="u-meta">{(window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || []).length} tests in library</span>
      </div>
      <div className="card card--flush" style={{maxHeight:"none"}}>
        <table className="table">
          <thead><tr>
            <th>Test</th><th>Category</th><th className="num">Sens</th><th className="num">Spec</th>
            <th className="num">Cost</th><th>TAT</th><th>Sample</th><th>Skill</th><th/>
          </tr></thead>
          <tbody>
            {(window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || []).map(t => (
              <tr key={t.id}>
                <td><b>{t.name}</b></td>
                <td><span className="chip chip--outline">{t.category}</span></td>
                <td className="num mono">{t.sens.toFixed(2)}</td>
                <td className="num mono">{t.spec.toFixed(2)}</td>
                <td className="num mono">${t.cost.toFixed(2)}</td>
                <td className="mono">{t.tat}{t.tatUnit}</td>
                <td>{t.sample}</td>
                <td>{t.skill}</td>
                <td style={{textAlign:"right", position:"relative"}}>
                  <button
                    type="button"
                    className="btn btn--sm btn--icon"
                    onClick={() => setMenuFor(current => current === t.id ? null : t.id)}
                    aria-label="Test actions"
                  >
                    <Icon name="more" size={14} style={{color:"var(--fg-3)"}}/>
                  </button>
                  {menuFor === t.id && (
                    <div style={{
                      position:"absolute",
                      right:0,
                      top:"calc(100% + 4px)",
                      background:"var(--surface)",
                      border:"1px solid var(--edge)",
                      borderRadius:6,
                      boxShadow:"var(--shadow-4)",
                      minWidth:140,
                      zIndex:20,
                      overflow:"hidden",
                    }}>
                      <button
                        type="button"
                        className="btn"
                        style={{width:"100%", justifyContent:"flex-start", borderRadius:0, border:0}}
                        onClick={() => {
                          window.OptiDxActions.openDiagnosticTestEditor?.(t);
                          setMenuFor(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{width:"100%", justifyContent:"flex-start", borderRadius:0, border:0}}
                        onClick={async () => {
                          setMenuFor(null);
                          if (!window.confirm(`Delete "${t.name}" from the library?`)) {
                            return;
                          }
                          try {
                            await window.OptiDxActions.deleteDiagnosticTest?.(t.id);
                          } catch (error) {
                            window.OptiDxActions.showToast?.(error?.message || "Unable to delete test", "error");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WizardStep3({ sampleTypes, setSampleTypes, project, setProject }) {
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
            <input
              className="input"
              value={
                l === "Minimum acceptable sensitivity" ? project.minimumSensitivity
                  : l === "Minimum acceptable specificity" ? project.minimumSpecificity
                  : l === "Maximum cost per patient" ? project.maximumCost
                  : project.maximumTat
              }
              onChange={e => setProject(current => ({
                ...current,
                minimumSensitivity: l === "Minimum acceptable sensitivity" ? e.target.value : current.minimumSensitivity,
                minimumSpecificity: l === "Minimum acceptable specificity" ? e.target.value : current.minimumSpecificity,
                maximumCost: l === "Maximum cost per patient" ? e.target.value : current.maximumCost,
                maximumTat: l === "Maximum turnaround time" ? e.target.value : current.maximumTat,
              }))}
            />
            {s && <span className="field__suffix" style={{top:"70%"}}>{s}</span>}
          </div>
        ))}
        <div className="field">
          <label className="field__label">Max required skill level</label>
          <select
            className="select"
            value={project.maxSkillLevel}
            onChange={e => setProject(current => ({ ...current, maxSkillLevel: e.target.value }))}
          >
            <option>Lab technician</option>
            <option>Radiologist</option>
            <option>Specialist physician</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label">Setting</label>
          <select className="select"><option>Community</option><option>Primary care</option><option>Hospital</option><option>Mobile unit</option></select>
        </div>
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Allowed sample types</label>
          <div className="row row--wrap" style={{gap:6}}>
            {["None","Blood","Urine","Stool","Sputum","Nasal swab","Imaging"].map((s) =>
              <button key={s} type="button" onClick={() => setSampleTypes(current => current.includes(s) ? current.filter(item => item !== s) : [...current, s])}
                className={"btn btn--sm" + (sampleTypes.includes(s) ? " btn--ink" : "")}>
                {sampleTypes.includes(s) && <Icon name="check" size={11}/>}
                {s}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep4({ objective, sampleTypes, project }) {
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
          <div style={{fontSize:15, fontWeight:700}}>{project.conditionName}</div>
          <div className="u-meta" style={{marginTop:4}}>{project.clinicalContext} | Live wizard state | Prevalence {project.prevalence || "n/a"}%</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Objective</div>
          <div style={{fontSize:15, fontWeight:700}}>{objective}</div>
          <div className="u-meta" style={{marginTop:4}}>Weights and constraints reflect the live wizard state.</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Test library</div>
          <div style={{fontSize:15, fontWeight:700}}>{(window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || []).length} tests</div>
          <div className="u-meta" style={{marginTop:4}}>{sampleTypes.join(" | ")}</div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Constraints</div>
          <div style={{fontSize:15, fontWeight:700}}>Sens &gt;= {project.minimumSensitivity} | Spec &gt;= {project.minimumSpecificity}</div>
          <div className="u-meta" style={{marginTop:4}}>Cost &lt;= ${project.maximumCost} | TAT &lt;= {project.maximumTat}h | Max skill: {project.maxSkillLevel}</div>
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
