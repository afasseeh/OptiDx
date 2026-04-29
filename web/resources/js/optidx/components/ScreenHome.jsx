import React, { useEffect, useState } from 'react';

function ScreenHome({ setScreen }) {
  const projects = Array.isArray(window.OptiDxActions.getWorkspaceProjects?.())
    ? window.OptiDxActions.getWorkspaceProjects?.()
    : Array.isArray(window.SEED_PROJECTS)
      ? window.SEED_PROJECTS
      : [];
  const pathways = Array.isArray(window.OptiDxActions.getWorkspacePathways?.())
    ? window.OptiDxActions.getWorkspacePathways?.()
    : Array.isArray(window.SEED_PATHWAYS)
      ? window.SEED_PATHWAYS
      : [];
  const templates = Array.isArray(window.SEED_TEMPLATES) ? window.SEED_TEMPLATES : [];
  const standalonePathways = pathways.filter(pathway => !pathway.project_id && !pathway.project?.id);
  const [menuFor, setMenuFor] = useState(null);
  const [optimization, setOptimization] = useState(() => window.OptiDxOptimizationResults || null);

  useEffect(() => {
    const onPointerDown = event => {
      if (!event.target.closest?.('[data-home-action-menu]')) {
        setMenuFor(null);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const syncOptimization = () => setOptimization(window.OptiDxOptimizationResults || null);
    window.addEventListener('optidx-optimization-updated', syncOptimization);
    syncOptimization();
    return () => window.removeEventListener('optidx-optimization-updated', syncOptimization);
  }, []);

  const projectPathwayCount = projectId => pathways.filter(pathway => String(pathway.project_id ?? pathway.project?.id ?? '') === String(projectId)).length;

  const openProject = async project => {
    await window.OptiDxActions.openProject?.(project);
    setScreen('wizard');
  };

  const startNewProject = () => {
    window.OptiDxActions.selectProject?.(null);
    window.OptiDxActions.setActiveProjectDraft?.({});
    setScreen('wizard');
  };

  const startStandalonePathway = () => {
    window.OptiDxActions.createStandalonePathway?.();
    setScreen('canvas');
  };

  return (
    <>
      <TopBar
        crumbs={["OptiDx", "Workspace"]}
        actions={<>
          <button className="btn" onClick={() => setScreen('history')}>
            <Icon name="history"/>Optimization history
          </button>
          <button className="btn" onClick={startStandalonePathway}>
            <Icon name="git-branch"/>New standalone pathway
          </button>
          <button className="btn" onClick={async () => {
            try {
              await window.OptiDxActions.importJsonFile(async (pathway) => {
                await window.OptiDxActions.loadPathwayIntoWorkspace?.(pathway);
                setScreen('canvas');
              });
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || 'Unable to import pathway', 'error');
            }
          }}><Icon name="upload"/>Import JSON</button>
          <button className="btn btn--primary" onClick={startNewProject}>
            <Icon name="plus"/>New project
          </button>
        </>}
      />

      <div className="page">
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Workspace</div>
            <h1>Diagnostic project workspace</h1>
            <p>Create projects, review standalone pathways, and export report snapshots from persisted evaluations.</p>
          </div>
          <div className="row">
            <div className="u-meta">Workspace - <b style={{color:'var(--fg-1)'}}>Syreon MENA HTA</b></div>
          </div>
        </div>

        {optimization && ['queued', 'running'].includes(String(optimization.status || '').toLowerCase()) && (
          <section style={{marginBottom:24}}>
            <div className="card card--pad" style={{borderLeft:'3px solid var(--sme-orange)'}}>
              <div className="row" style={{marginBottom:10}}>
                <div>
                  <div className="u-meta">Active optimization run</div>
                  <h2 style={{fontSize:18, marginTop:4}}>An optimization run is still in progress</h2>
                </div>
                <div className="spacer"/>
                <span className="chip chip--orange">{String(optimization.run_mode || 'light').toUpperCase()}</span>
              </div>
              <div className="optimization-progress optimization-progress--indeterminate" aria-label="Optimization activity" role="progressbar" aria-busy="true" aria-valuetext="Optimization in progress">
                <div className="optimization-progress__bar is-running" />
              </div>
              <div className="optimization-progress__meta">
                <span>{optimization.progress_stage || optimization.status || 'Run status'}</span>
                <span>Working</span>
              </div>
              <div className="row" style={{marginTop:12, justifyContent:'flex-end'}}>
                <button className="btn btn--primary" onClick={() => window.OptiDxActions.cancelOptimizationRun?.(optimization.id)}>
                  Stop run
                </button>
                <button className="btn btn--primary" onClick={() => setScreen('scenarios')}>
                  Open run status
                </button>
              </div>
            </div>
          </section>
        )}

        <section style={{marginBottom:36}}>
          <div className="row" style={{marginBottom:12}}>
            <h2 style={{fontSize:14, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fg-2)'}}>Projects</h2>
            <div className="spacer"/>
            <button className="btn btn--sm btn--ghost" onClick={() => setScreen('wizard')}>
              Open wizard <Icon name="chevron-right" size={12}/>
            </button>
          </div>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))'}}>
            {projects.length === 0 ? (
              <div className="card card--pad" style={{gridColumn:'1 / -1', color:'var(--fg-3)'}}>
                No projects have been created yet. Start a project to save wizard settings and run optimization against it.
              </div>
            ) : projects.map(project => (
              <article key={project.id} className="card" style={{cursor:'pointer'}} onClick={() => openProject(project)}>
                <div style={{padding:'14px 16px 12px', borderBottom:'1px solid var(--edge)'}}>
                  <div className="row" style={{marginBottom:8}}>
                    <span className="chip chip--orange">Project</span>
                    <div className="spacer"/>
                    <div style={{position:'relative'}} data-home-action-menu>
                      <button
                        type="button"
                        className="btn btn--sm btn--icon"
                        onClick={e => {
                          e.stopPropagation();
                          setMenuFor(current => current === `project:${project.id}` ? null : `project:${project.id}`);
                        }}
                        aria-label={`Project actions for ${project.title || project.name || 'Untitled project'}`}
                      >
                        <Icon name="more" size={14} style={{color:'var(--fg-3)'}}/>
                      </button>
                      {menuFor === `project:${project.id}` && (
                        <div style={{position:'absolute', right:0, top:'calc(100% + 4px)', background:'var(--surface)', border:'1px solid var(--edge)', borderRadius:6, boxShadow:'var(--shadow-4)', minWidth:160, zIndex:20, overflow:'hidden'}}>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            await openProject(project);
                          }}>
                            Open
                          </button>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            await openProject(project);
                            setScreen('wizard');
                          }}>
                            Edit
                          </button>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            if (!window.confirm(`Delete "${project.title || project.name || 'Untitled project'}"? Attached pathways will remain as standalone pathways.`)) {
                              return;
                            }

                            try {
                              await window.OptiDxActions.deleteProjectRecord?.(project);
                            } catch (error) {
                              window.OptiDxActions.showToast?.(error?.message || 'Unable to delete project', 'error');
                            }
                          }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 style={{fontSize:15, marginBottom:4}}>{project.title || project.name || 'Untitled project'}</h3>
                  <div className="u-meta">{project.disease_area || project.intended_use || 'Project workspace'}</div>
                </div>
                <div style={{padding:'12px 16px 14px'}}>
                  <div className="grid" style={{gridTemplateColumns:'1fr 1fr', gap:'8px 12px', fontSize:12}}>
                    <div><span className="u-meta">Prevalence</span> <b className="mono">{formatPercent(project.prevalence)}</b></div>
                    <div><span className="u-meta">Pathways</span> <b className="mono">{projectPathwayCount(project.id)}</b></div>
                    <div><span className="u-meta">Setting</span> <b className="mono">{formatText(project.setting, '-')}</b></div>
                    <div><span className="u-meta">Updated</span> <b className="mono">{formatText(project.updated_at ? new Date(project.updated_at).toLocaleDateString() : project.updated, '-')}</b></div>
                  </div>
                  <div className="row" style={{marginTop:12, justifyContent:'space-between', gap:12}}>
                    <span className="u-meta">{project.target_population || 'No target population saved'}</span>
                    <button className="btn btn--sm btn--primary" onClick={async e => {
                      e.stopPropagation();
                      await openProject(project);
                      setScreen('wizard');
                    }}>
                      Run optimization
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{marginBottom:36}}>
          <div className="row" style={{marginBottom:12}}>
            <h2 style={{fontSize:14, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fg-2)'}}>Standalone pathways</h2>
            <div className="spacer"/>
            <button className="btn btn--sm btn--ghost" onClick={() => setScreen('canvas')}>
              Open builder <Icon name="chevron-right" size={12}/>
            </button>
          </div>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))'}}>
            {standalonePathways.length === 0 ? (
              <div className="card card--pad" style={{gridColumn:'1 / -1', color:'var(--fg-3)'}}>
                No standalone pathways are currently saved. Use the builder or import a pathway to create one outside a project.
              </div>
            ) : standalonePathways.map(pathway => (
              <article key={pathway.id} className="card" style={{cursor:'pointer'}} onClick={async () => {
                try {
                  await window.OptiDxActions.openPathwayRecord?.(pathway);
                  setScreen('canvas');
                } catch (error) {
                  window.OptiDxActions.showToast?.(error?.message || 'Unable to open pathway', 'error');
                }
              }}>
                <div style={{padding:'14px 16px 10px', borderBottom:'1px solid var(--edge)'}}>
                  <div className="row" style={{marginBottom:8}}>
                    <span className="chip chip--outline">Standalone</span>
                    <div className="spacer"/>
                    <div style={{position:'relative'}} data-home-action-menu>
                      <button
                        type="button"
                        className="btn btn--sm btn--icon"
                        onClick={e => {
                          e.stopPropagation();
                          setMenuFor(current => current === `pathway:${pathway.id}` ? null : `pathway:${pathway.id}`);
                        }}
                        aria-label={`Pathway actions for ${pathway.name || 'Untitled pathway'}`}
                      >
                        <Icon name="more" size={14} style={{color:'var(--fg-3)'}}/>
                      </button>
                      {menuFor === `pathway:${pathway.id}` && (
                        <div style={{position:'absolute', right:0, top:'calc(100% + 4px)', background:'var(--surface)', border:'1px solid var(--edge)', borderRadius:6, boxShadow:'var(--shadow-4)', minWidth:140, zIndex:20, overflow:'hidden'}}>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            await window.OptiDxActions.openPathwayRecord?.(pathway);
                            setScreen('canvas');
                          }}>
                            Open
                          </button>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            await window.OptiDxActions.openPathwayRecord?.(pathway);
                            setScreen('canvas');
                          }}>
                            Edit
                          </button>
                          <button type="button" className="btn" style={{width:'100%', justifyContent:'flex-start', borderRadius:0, border:0}} onClick={async e => {
                            e.stopPropagation();
                            setMenuFor(null);
                            if (!window.confirm(`Delete "${pathway.name || pathway.metadata?.label || 'Untitled pathway'}"?`)) {
                              return;
                            }

                            try {
                              await window.OptiDxActions.deletePathwayRecord?.(pathway);
                            } catch (error) {
                              window.OptiDxActions.showToast?.(error?.message || 'Unable to delete pathway', 'error');
                            }
                          }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 style={{fontSize:15, marginBottom:2}}>{pathway.name || 'Untitled pathway'}</h3>
                  <div className="u-meta">{[pathway.condition || pathway.disease, pathway.project_title].filter(Boolean).join(' - ') || 'No project attached'}</div>
                </div>
                <div style={{padding:'10px 16px 14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', fontSize:12}}>
                  <div><span className="u-meta">Sens</span> <b className="mono">{formatPercent(pathway.sens)}</b></div>
                  <div><span className="u-meta">Spec</span> <b className="mono">{formatPercent(pathway.spec)}</b></div>
                  <div><span className="u-meta">Cost</span> <b className="mono">{formatCurrency(pathway.cost)}</b></div>
                  <div><span className="u-meta">TAT</span> <b className="mono">{formatText(pathway.tat, '-')}</b></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{marginBottom:36}}>
          <div className="row" style={{marginBottom:12}}>
            <h2 style={{fontSize:14, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--fg-2)'}}>Templates</h2>
            <div className="spacer"/>
            <span className="u-meta">Start from a proven pattern</span>
          </div>
          <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))'}}>
            {templates.map(template => (
              <article key={template.id} className="card card--pad" style={{cursor:'pointer'}} onClick={() => setScreen('wizard')}>
                <div style={{width:36, height:36, borderRadius:6, background:'var(--sme-orange-050)', color:'var(--sme-orange-600)', display:'grid', placeItems:'center', marginBottom:10}}>
                  <Icon name={template.icon} size={18}/>
                </div>
                <h3 style={{fontSize:14, marginBottom:4}}>{template.name}</h3>
                <p style={{fontSize:12, color:'var(--fg-3)', lineHeight:1.45, marginBottom:12}}>{template.desc}</p>
                <div className="row" style={{fontSize:11, color:'var(--fg-3)'}}>
                  <span className="chip chip--outline">{template.tests} tests</span>
                  <div className="spacer"/>
                  <span style={{color:'var(--sme-orange)', fontWeight:700}}>Use template <Icon name="arrow-right" size={11}/></span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="grid" style={{gridTemplateColumns:'2fr 1fr', gap:16}}>
            <div className="card card--pad">
              <div className="sme-eyebrow" style={{marginBottom:6}}>Evidence database</div>
              <h3 style={{fontSize:16, marginBottom:4}}>Pre-curated diagnostic performance data</h3>
              <p style={{color:'var(--fg-3)', fontSize:13, marginBottom:12}}>
                Browse published sensitivity and specificity estimates from Cochrane, WHO guidance, and peer-reviewed meta-analyses. Import records directly into your pathway.
              </p>
              <button className="btn" onClick={() => setScreen('evidence')}>
                <Icon name="database"/>Open evidence database
              </button>
            </div>
            <div className="card card--pad" style={{background:'var(--sme-ink-900)', color:'#fff', borderColor:'var(--sme-ink-900)'}}>
              <div className="sme-eyebrow" style={{marginBottom:6, color:'var(--sme-orange)'}}>Getting started</div>
              <h3 style={{fontSize:16, marginBottom:4, color:'#fff'}}>Build your first pathway</h3>
              <p style={{color:'#B0B5B9', fontSize:13, marginBottom:12}}>
                A 4-step wizard walks you through the disease, test library, and constraints before you enter the canvas.
              </p>
              <button className="btn btn--primary" onClick={startNewProject}>
                <Icon name="plus"/>Start wizard
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function formatPercent(value, fallback = '-') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return `${(numeric * 100).toFixed(1)}%`;
}

function formatCurrency(value, fallback = '-') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return `$${numeric.toFixed(2)}`;
}

function formatText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return String(value);
}

Object.assign(window, { ScreenHome });
