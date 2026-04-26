// Wizard — New pathway setup (4 steps)
const OPTIMIZATION_STAGES = [
  "Preparing the test library and constraints.",
  "Searching the grammar-constrained pathway space.",
  "Calling the backend optimization engine.",
  "Ranking the Pareto frontier candidates.",
  "Packaging the best pathways for review.",
];

const DEFAULT_WIZARD_PROJECT = {
  conditionName: "Pulmonary tuberculosis",
  clinicalContext: "comm",
  targetPopulation: "Adults >=15 yrs presenting with cough >2 weeks",
  prevalence: "8.0",
  objective: null,
  minSensitivity: "0.85",
  minSpecificity: "0.90",
  maxCostPerPatientUsd: "10.00",
  maxTurnaroundTimeHours: "72",
  allowLabTechnician: true,
  allowRadiologist: false,
  allowSpecialistPhysician: false,
  allowSampleNone: true,
  allowSampleBlood: true,
  allowSampleUrine: true,
  allowSampleStool: true,
  allowSampleSputum: true,
  allowSampleNasalSwab: true,
  allowSampleImaging: false,
  settingPrimaryCare: true,
  settingHospital: false,
  settingCommunity: true,
  settingMobileUnit: false,
};

function getWizardProjectState(source = null) {
  return window.OptiDxActions?.buildProjectWizardState?.(source || window.OptiDxCurrentProjectRecord || window.OptiDxCurrentProject || DEFAULT_WIZARD_PROJECT)
    || { ...DEFAULT_WIZARD_PROJECT };
}

function formatOptimizationProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "0.0%";
  }

  return `${numericValue.toFixed(1)}%`;
}

function serializeWizardProjectState(project) {
  const safeProject = getWizardProjectState(project);
  return JSON.stringify({
    conditionName: safeProject.conditionName,
    clinicalContext: safeProject.clinicalContext,
    targetPopulation: safeProject.targetPopulation,
    prevalence: safeProject.prevalence,
    objective: safeProject.objective,
    minSensitivity: safeProject.minSensitivity,
    minSpecificity: safeProject.minSpecificity,
    maxCostPerPatientUsd: safeProject.maxCostPerPatientUsd,
    maxTurnaroundTimeHours: safeProject.maxTurnaroundTimeHours,
    allowLabTechnician: !!safeProject.allowLabTechnician,
    allowRadiologist: !!safeProject.allowRadiologist,
    allowSpecialistPhysician: !!safeProject.allowSpecialistPhysician,
    allowSampleNone: !!safeProject.allowSampleNone,
    allowSampleBlood: !!safeProject.allowSampleBlood,
    allowSampleUrine: !!safeProject.allowSampleUrine,
    allowSampleStool: !!safeProject.allowSampleStool,
    allowSampleSputum: !!safeProject.allowSampleSputum,
    allowSampleNasalSwab: !!safeProject.allowSampleNasalSwab,
    allowSampleImaging: !!safeProject.allowSampleImaging,
    settingPrimaryCare: !!safeProject.settingPrimaryCare,
    settingHospital: !!safeProject.settingHospital,
    settingCommunity: !!safeProject.settingCommunity,
    settingMobileUnit: !!safeProject.settingMobileUnit,
  });
}

function ScreenWizard({ setScreen }) {
  const initialProject = getWizardProjectState();
  const [step, setStep] = useState(() => Number(window.OptiDxWizardStep ?? 0) || 0);
  const [mode, setMode] = useState(null); // null | "test" | "optimize"
  const [runMode, setRunMode] = useState("light");
  const [project, setProject] = useState(() => ({
    conditionName: initialProject.conditionName,
    clinicalContext: initialProject.clinicalContext,
    targetPopulation: "Adults ≥15 yrs presenting with cough >2 weeks",
    prevalence: initialProject.prevalence,
    objective: initialProject.objective,
    minSensitivity: initialProject.minSensitivity,
    minSpecificity: initialProject.minSpecificity,
    maxCostPerPatientUsd: initialProject.maxCostPerPatientUsd,
    maxTurnaroundTimeHours: initialProject.maxTurnaroundTimeHours,
    allowLabTechnician: initialProject.allowLabTechnician,
    allowRadiologist: initialProject.allowRadiologist,
    allowSpecialistPhysician: initialProject.allowSpecialistPhysician,
    allowSampleNone: initialProject.allowSampleNone,
    allowSampleBlood: initialProject.allowSampleBlood,
    allowSampleUrine: initialProject.allowSampleUrine,
    allowSampleStool: initialProject.allowSampleStool,
    allowSampleSputum: initialProject.allowSampleSputum,
    allowSampleNasalSwab: initialProject.allowSampleNasalSwab,
    allowSampleImaging: initialProject.allowSampleImaging,
    settingPrimaryCare: initialProject.settingPrimaryCare,
    settingHospital: initialProject.settingHospital,
    settingCommunity: initialProject.settingCommunity,
    settingMobileUnit: initialProject.settingMobileUnit,
  }));
  const [optimization, setOptimization] = useState({ status: "idle", progress: 0, stage: "", error: null });
  const steps = ["Disease", "Test library", "Constraints", "Review", "Run"];

  useEffect(() => {
    window.OptiDxWizardStep = step;
  }, [step]);

  useEffect(() => {
    const syncOptimizationState = () => {
      const run = window.OptiDxOptimizationResults;
      if (!run) {
        return;
      }

      const normalizedStatus = String(run.status || '').toLowerCase();
      const nextStage = run.progress_stage || run.progress_message || run.status || '';
      setOptimization(current => ({
        ...current,
        status: normalizedStatus === 'failed'
          ? 'error'
          : ['queued', 'running'].includes(normalizedStatus)
            ? 'running'
            : 'done',
        progress: Number.isFinite(Number(run.progress_percent))
          ? Number(run.progress_percent)
          : current.progress,
        stage: nextStage,
        error: normalizedStatus === 'failed'
          ? run.failure_reason || run.progress_message || 'Optimization failed.'
          : null,
      }));
    };

    window.addEventListener('optidx-optimization-updated', syncOptimizationState);
    syncOptimizationState();
    return () => window.removeEventListener('optidx-optimization-updated', syncOptimizationState);
  }, []);

  const projectRef = useRef(project);
  const lastSavedSnapshotRef = useRef(serializeWizardProjectState(project));
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    let active = true;
    const hydratedProject = getWizardProjectState(window.OptiDxActions?.getActiveProjectRecord?.() || window.OptiDxActions?.getWorkspaceProjects?.()?.[0] || projectRef.current);

    if (active) {
      setProject(hydratedProject);
      projectRef.current = hydratedProject;
      lastSavedSnapshotRef.current = serializeWizardProjectState(hydratedProject);
      hydratedRef.current = true;
    }

    return () => {
      active = false;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (hydratedRef.current && serializeWizardProjectState(projectRef.current) !== lastSavedSnapshotRef.current) {
        void window.OptiDxActions?.saveProjectDraft?.(projectRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onWorkspaceUpdated = () => {
      const activeProject = window.OptiDxActions?.getActiveProjectRecord?.();
      if (!activeProject) {
        return;
      }

      const hydratedProject = getWizardProjectState(activeProject);
      const snapshot = serializeWizardProjectState(hydratedProject);
      if (snapshot === lastSavedSnapshotRef.current) {
        return;
      }

      setProject(hydratedProject);
      projectRef.current = hydratedProject;
      lastSavedSnapshotRef.current = snapshot;
      hydratedRef.current = true;
    };

    window.addEventListener("optidx-workspace-updated", onWorkspaceUpdated);
    return () => window.removeEventListener("optidx-workspace-updated", onWorkspaceUpdated);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    const snapshot = serializeWizardProjectState(project);
    if (snapshot === lastSavedSnapshotRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void (async () => {
        try {
          const saved = await window.OptiDxActions?.saveProjectDraft?.(projectRef.current);
          if (saved) {
            const normalized = getWizardProjectState(saved);
            projectRef.current = normalized;
            setProject(normalized);
            lastSavedSnapshotRef.current = serializeWizardProjectState(normalized);
          }
        } catch (error) {
          window.OptiDxActions.showToast?.(error?.message || "Unable to save project draft", "error");
        }
      })();
    }, 350);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [project]);

  const flushProjectDraft = async () => {
    const snapshot = serializeWizardProjectState(projectRef.current);
    if (snapshot === lastSavedSnapshotRef.current) {
      return null;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const saved = await window.OptiDxActions?.saveProjectDraft?.(projectRef.current);
    if (saved) {
      const normalized = getWizardProjectState(saved);
      projectRef.current = normalized;
      setProject(normalized);
      lastSavedSnapshotRef.current = serializeWizardProjectState(normalized);
    }

    return saved;
  };

  const activeProjectId = window.OptiDxActions?.getActiveProjectRecord?.()?.id
    ?? window.OptiDxCurrentProjectRecord?.id
    ?? null;

  const runOptimization = async () => {
    if (optimization.status === "running") return;

    setOptimization({ status: "running", progress: 2, stage: OPTIMIZATION_STAGES[0], error: null });

    try {
      await flushProjectDraft();
      const currentProject = projectRef.current;
      const minSensitivity = Number.parseFloat(currentProject.minSensitivity);
      const minSpecificity = Number.parseFloat(currentProject.minSpecificity);
      const maxCostPerPatientUsd = Number.parseFloat(currentProject.maxCostPerPatientUsd);
      const maxTurnaroundTimeHours = Number.parseFloat(currentProject.maxTurnaroundTimeHours);
      const workspaceTests = window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || [];
      if (!workspaceTests.length) {
        throw new Error("Add at least one diagnostic test before running the optimization.");
      }

      const normalizedPrevalencePercent = (() => {
        const numeric = Number.parseFloat(currentProject.prevalence);
        if (!Number.isFinite(numeric) || numeric < 0) {
          return null;
        }

        let normalized = numeric;
        while (normalized > 100) {
          normalized /= 100;
        }

        return normalized;
      })();

      const tests = workspaceTests.map(test => {
        const sampleTypes = (Array.isArray(test.sample_types) && test.sample_types.length
          ? test.sample_types
          : [test.sample].filter(Boolean))
          .map(value => String(value).trim())
          .filter(Boolean);
        const normalizedSampleTypes = sampleTypes.map(value => value.toLowerCase().replace(/[\s-]+/g, "_"));

        return {
          id: test.id,
          name: test.name,
          sensitivity: test.sensitivity ?? test.sens,
          specificity: test.specificity ?? test.spec,
          turnaround_time: test.turnaround_time ?? test.tat,
          turnaround_time_unit: test.turnaround_time_unit ?? test.tatUnit,
          sample_types: sampleTypes,
          skill_level: test.skill_level ?? test.skill,
          cost: test.cost,
          requires_lab_technician: test.requires_lab_technician ?? false,
          requires_radiologist: test.requires_radiologist ?? false,
          requires_specialist_physician: test.requires_specialist_physician ?? false,
          sample_none: normalizedSampleTypes.includes("none"),
          sample_blood: normalizedSampleTypes.includes("blood"),
          sample_urine: normalizedSampleTypes.includes("urine"),
          sample_stool: normalizedSampleTypes.includes("stool"),
          sample_sputum: normalizedSampleTypes.includes("sputum"),
          sample_nasal_swab: normalizedSampleTypes.includes("nasal_swab"),
          sample_imaging: normalizedSampleTypes.includes("imaging"),
        };
      });
      const payload = {
        project_id: activeProjectId,
        tests,
        constraints: {
          prevalence: Number.isFinite(normalizedPrevalencePercent) ? normalizedPrevalencePercent / 100 : null,
          min_sensitivity: Number.isFinite(minSensitivity) ? minSensitivity : null,
          min_specificity: Number.isFinite(minSpecificity) ? minSpecificity : null,
          max_cost_per_patient_usd: Number.isFinite(maxCostPerPatientUsd) ? maxCostPerPatientUsd : null,
          max_turnaround_time_hours: Number.isFinite(maxTurnaroundTimeHours) ? maxTurnaroundTimeHours : null,
          lab_technician_allowed: !!currentProject.allowLabTechnician,
          radiologist_allowed: !!currentProject.allowRadiologist,
          specialist_physician_allowed: !!currentProject.allowSpecialistPhysician,
          none_allowed: !!currentProject.allowSampleNone,
          blood_allowed: !!currentProject.allowSampleBlood,
          urine_allowed: !!currentProject.allowSampleUrine,
          stool_allowed: !!currentProject.allowSampleStool,
          sputum_allowed: !!currentProject.allowSampleSputum,
          nasal_swab_allowed: !!currentProject.allowSampleNasalSwab,
          imaging_allowed: !!currentProject.allowSampleImaging,
          primary_care: !!currentProject.settingPrimaryCare,
          hospital: !!currentProject.settingHospital,
          community: !!currentProject.settingCommunity,
          mobile_unit: !!currentProject.settingMobileUnit,
        },
        run_mode: runMode,
      };

      const result = await window.OptiDxActions.optimizePathways(payload, {
        waitForCompletion: runMode !== "extensive",
      });
      const finalState = window.OptiDxOptimizationResults || result;
      const candidateCount = finalState?.pareto_frontier_ids?.length ?? finalState?.feasible_candidate_count ?? 0;

      if (runMode === "extensive" || ['queued', 'running'].includes(String(finalState?.status || '').toLowerCase())) {
        setOptimization({
          status: "done",
          progress: Number.isFinite(Number(finalState?.progress_percent)) ? Number(finalState.progress_percent) : 12,
          stage: finalState?.progress_stage || "Optimization continues in the background.",
          error: null,
        });
        setScreen("scenarios");
        return;
      }

      setOptimization({
        status: "done",
        progress: 100,
        stage: `Prepared ${candidateCount} candidates.`,
        error: null,
      });
      setScreen("scenarios");
    } catch (error) {
      setOptimization({
        status: "error",
        progress: 0,
        stage: "",
        error: error?.message || "Optimization failed.",
      });
      window.OptiDxActions.showToast?.(error?.message || "Optimization failed.", "error");
    }
  };

  const onContinue = async () => {
    try {
      await flushProjectDraft();
      if (step < 4) setStep(step + 1);
      else if (mode === "optimize") await runOptimization();
      else {
        window.OptiDxActions?.setActivePathwayDraft?.(window.OptiDxActions?.createStarterCanvasGraph?.());
        setScreen("canvas");
      }
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || "Unable to save project draft", "error");
    }
  };

  return (
    <>
      <TopBar
        crumbs={["OptiDx", "New project"]}
        actions={<>
          <button className="btn btn--ghost" onClick={async () => {
            try {
              await flushProjectDraft();
              setScreen("home");
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to save project draft", "error");
            }
          }}>Cancel</button>
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

        {step === 0 && <WizardStep1 project={project} setProject={setProject}/>}
        {step === 1 && <WizardStep2 onOpenEvidence={async () => {
          try {
            await flushProjectDraft();
            setScreen("evidence");
          } catch (error) {
            window.OptiDxActions.showToast?.(error?.message || "Unable to save project draft", "error");
          }
        }}/>}
        {step === 2 && <WizardStep3 project={project} setProject={setProject}/>}
        {step === 3 && <WizardStep4 project={project}/>}
        {step === 4 && <WizardStep5 mode={mode} setMode={setMode} runMode={runMode} setRunMode={setRunMode}/>}
        {optimization.status !== "idle" && (
          <OptimizationOverlay optimization={optimization} onOpenScenarios={() => setScreen("scenarios")} />
        )}
      </div>
    </>
  );
}

function OptimizationOverlay({ optimization, onOpenScenarios }) {
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
            <div className="sme-eyebrow" style={{marginBottom:6}}>Optimization run</div>
            <h3 style={{fontSize:18, marginBottom:6}}>
              {optimization.status === "done" ? "Optimization completed" : optimization.status === "error" ? "Optimization needs attention" : "Searching for the best pathway"}
            </h3>
            <p style={{fontSize:13, color:"var(--fg-2)", lineHeight:1.55, marginBottom:14}}>
              {optimization.status === "error"
                ? "The run stopped before it finished. You can return to the wizard or open the run status view."
                : currentStage}
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
              <span>{formatOptimizationProgress(optimization.progress)}</span>
            </div>
            {optimization.error && (
              <div className="banner banner--err" style={{marginTop:12}}>
                <Icon name="alert-triangle" size={14} className="banner__icon" />
                <div>{optimization.error}</div>
              </div>
            )}
            <div className="row" style={{marginTop:14, gap:8, justifyContent:"flex-end"}}>
              <button className="btn" type="button" onClick={onOpenScenarios}>
                Open run status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep5({ mode, setMode, runMode, setRunMode }) {
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
      {mode === "optimize" && (
        <div className="card card--pad" style={{marginTop:18, borderLeft:"3px solid var(--sme-orange)"}}>
          <div className="u-meta" style={{marginBottom:8}}>Optimization run mode</div>
          <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:10}}>
            <button
              type="button"
              className={"btn " + (runMode === "light" ? "btn--primary" : "")}
              onClick={() => setRunMode("light")}
            >
              Light
            </button>
            <button
              type="button"
              className={"btn " + (runMode === "extensive" ? "btn--primary" : "")}
              onClick={() => setRunMode("extensive")}
            >
              Extensive
            </button>
          </div>
          <div style={{marginTop:10, fontSize:12, color:"var(--fg-3)", lineHeight:1.5}}>
            {runMode === "light"
              ? "Light mode targets a result in about five minutes using a smaller search budget."
              : "Extensive mode keeps searching in the background and emails you when it completes."}
          </div>
        </div>
      )}
      {mode && (
        <div className="banner banner--info" style={{marginTop:18}}>
          <Icon name="info" size={16} className="banner__icon"/>
          <div>
            {mode === "test"
              ? "The canvas will open with required positive and negative endpoints already placed on the right side."
              : runMode === "extensive"
                ? "Extensive mode keeps searching in the background and sends the launching user an email when it completes."
                : "Light mode uses a smaller search budget and is tuned to return within about five minutes."}
          </div>
        </div>
      )}
    </div>
  );
}

function WizardStep1({ project, setProject }) {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 01</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Project and clinical context</h2>
      <p style={{color:"var(--fg-3)", marginBottom:24, fontSize:13}}>
        Define the project context and prevalence before configuring the optimizer.
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
            step="any"
            inputMode="decimal"
          />
          <span className="field__suffix" style={{top:"70%"}}>%</span>
          <div className="field__hint">Prevalence is mandatory for optimization and report metrics.</div>
        </div>
      </div>
    </div>
  );
}

function WizardStep2({ onOpenEvidence }) {
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
        <button className="btn" onClick={onOpenEvidence}><Icon name="database"/>Import from evidence</button>
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

function WizardStep3({ project, setProject }) {
  return (
    <div className="card card--pad">
      <div className="sme-eyebrow" style={{marginBottom:6}}>Step 03</div>
      <h2 style={{fontSize:22, marginBottom:4}}>Constraints and feasibility</h2>
      <p style={{color:"var(--fg-3)", marginBottom:20, fontSize:13}}>
        These bound the search space and define the allowed operational settings.
      </p>
      <div className="grid" style={{gridTemplateColumns:"1fr 1fr", gap:16}}>
        {[
          ["Minimum acceptable sensitivity","minSensitivity",""],
          ["Minimum acceptable specificity","minSpecificity",""],
          ["Maximum cost per patient","maxCostPerPatientUsd","USD"],
          ["Maximum turnaround time","maxTurnaroundTimeHours","hours"],
        ].map(([l,v,s]) => (
          <div key={l} className="field field--with-suffix">
            <label className="field__label">{l}</label>
            <input
              className="input"
              value={project[v]}
              onChange={e => setProject(current => ({ ...current, [v]: e.target.value }))}
            />
            {s && <span className="field__suffix" style={{top:"70%"}}>{s}</span>}
          </div>
        ))}
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Allowed roles</label>
          <div className="row row--wrap" style={{gap:6}}>
            {[
              ["Lab technician","allowLabTechnician"],
              ["Radiologist","allowRadiologist"],
              ["Specialist physician","allowSpecialistPhysician"],
            ].map(([label, key]) => (
              <button
                key={label}
                type="button"
                className={"btn btn--sm" + (project[key] ? " btn--ink" : "")}
                onClick={() => setProject(current => ({ ...current, [key]: !current[key] }))}
              >
                {project[key] && <Icon name="check" size={11}/>}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Allowed sample types</label>
          <div className="row row--wrap" style={{gap:6}}>
            {[
              ["None","allowSampleNone"],
              ["Blood","allowSampleBlood"],
              ["Urine","allowSampleUrine"],
              ["Stool","allowSampleStool"],
              ["Sputum","allowSampleSputum"],
              ["Nasal swab","allowSampleNasalSwab"],
              ["Imaging","allowSampleImaging"],
            ].map(([label, key]) => (
              <button
                key={label}
                type="button"
                className={"btn btn--sm" + (project[key] ? " btn--ink" : "")}
                onClick={() => setProject(current => ({ ...current, [key]: !current[key] }))}
              >
                {project[key] && <Icon name="check" size={11}/>}
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{gridColumn:"span 2"}}>
          <label className="field__label">Report-only settings</label>
          <div className="row row--wrap" style={{gap:6}}>
            {[
              ["Primary care","settingPrimaryCare"],
              ["Hospital","settingHospital"],
              ["Community","settingCommunity"],
              ["Mobile unit","settingMobileUnit"],
            ].map(([label, key]) => (
              <button
                key={label}
                type="button"
                className={"btn btn--sm" + (project[key] ? " btn--ink" : "")}
                onClick={() => setProject(current => ({ ...current, [key]: !current[key] }))}
              >
                {project[key] && <Icon name="check" size={11}/>}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardStep4({ project }) {
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
          <div className="sme-eyebrow" style={{marginBottom:6}}>Operational scope</div>
          <div style={{fontSize:15, fontWeight:700}}>
            {[
              project.allowLabTechnician ? "Lab technician" : null,
              project.allowRadiologist ? "Radiologist" : null,
              project.allowSpecialistPhysician ? "Specialist physician" : null,
            ].filter(Boolean).join(" · ") || "No roles selected"}
          </div>
          <div className="u-meta" style={{marginTop:4}}>
            {[
              project.settingPrimaryCare ? "Primary care" : null,
              project.settingHospital ? "Hospital" : null,
              project.settingCommunity ? "Community" : null,
              project.settingMobileUnit ? "Mobile unit" : null,
            ].filter(Boolean).join(" · ") || "No settings selected"}
          </div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Test library</div>
          <div style={{fontSize:15, fontWeight:700}}>{(window.OptiDxActions.getWorkspaceTests?.() || window.SEED_TESTS || []).length} tests</div>
          <div className="u-meta" style={{marginTop:4}}>
            {[
              project.allowSampleNone ? "None" : null,
              project.allowSampleBlood ? "Blood" : null,
              project.allowSampleUrine ? "Urine" : null,
              project.allowSampleStool ? "Stool" : null,
              project.allowSampleSputum ? "Sputum" : null,
              project.allowSampleNasalSwab ? "Nasal swab" : null,
              project.allowSampleImaging ? "Imaging" : null,
            ].filter(Boolean).join(" | ") || "No sample types selected"}
          </div>
        </div>
        <div className="card card--pad">
          <div className="sme-eyebrow" style={{marginBottom:6}}>Constraints</div>
          <div style={{fontSize:15, fontWeight:700}}>Sens &gt;= {project.minSensitivity} | Spec &gt;= {project.minSpecificity}</div>
          <div className="u-meta" style={{marginTop:4}}>Cost &lt;= ${project.maxCostPerPatientUsd} | TAT &lt;= {project.maxTurnaroundTimeHours}h</div>
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
