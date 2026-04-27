import React, { useEffect, useMemo, useState } from 'react';

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

function formatReportNumber(value, formatter) {
  if (value === null || value === undefined || value === '') {
    return 'n/a';
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  return formatter(numeric);
}

function collectReportPathwayTests(pathway) {
  const nodes = Array.isArray(pathway?.nodes)
    ? pathway.nodes
    : pathway?.nodes && typeof pathway.nodes === 'object'
      ? Object.values(pathway.nodes)
      : [];
  const tests = pathway?.tests && typeof pathway.tests === 'object' ? pathway.tests : {};
  const workspaceTests = window.OptiDxActions.getWorkspaceTests?.() || [];
  const seen = new Set();
  const items = [];

  const addTest = testRef => {
    const testId = String(testRef?.testId ?? testRef?.id ?? testRef ?? '').trim();
    if (!testId || seen.has(testId)) {
      return;
    }

    seen.add(testId);
    const source = tests[testId] || tests[String(testRef?.id ?? '')] || workspaceTests.find(item => String(item.id) === testId) || testRef || {};
    const sampleTypes = Array.isArray(source.sample_types)
      ? source.sample_types.filter(Boolean)
      : source.sample
        ? [source.sample]
        : [];

    items.push({
      id: testId,
      name: source.name || source.label || testId,
      cost: Number(source.cost ?? 0),
      sample: sampleTypes.join(', ') || source.sample || 'n/a',
      skill: source.skill_level ?? source.skill ?? 'n/a',
    });
  };

  for (const node of nodes) {
    if (node?.type === 'test') {
      addTest(node);
    }

    if (node?.type === 'parallel' && Array.isArray(node.members)) {
      node.members.forEach(addTest);
    }
  }

  return items;
}

function buildWorkspaceReportPreview() {
  const project = window.OptiDxActions.getActiveProjectRecord?.()
    || window.OptiDxCurrentProjectRecord
    || null;
  const pathwayRecord = window.OptiDxCurrentPathwayRecord
    || window.OptiDxSavedPathway
    || null;
  const pathwayDraft = window.OptiDxCurrentPathway
    || window.OptiDxCanvasDraft
    || pathwayRecord?._canonical
    || pathwayRecord?.editor_definition
    || pathwayRecord?.engine_definition
    || null;
  const evaluationResult = window.OptiDxLatestEvaluationResult
    || pathwayRecord?.latestEvaluationResult?.result_payload
    || pathwayRecord?.latestEvaluationResult?.resultPayload
    || null;
  const evaluationView = window.OptiDxLatestEvaluationView
    || (evaluationResult ? window.OptiDxActions.buildEvaluationView?.(evaluationResult) : null)
    || null;

  const projectLabel = project?.title || project?.name || project?.label || 'Workspace project';
  const pathwayLabel = pathwayRecord?.name
    || pathwayDraft?.metadata?.label
    || evaluationView?.source?.pathway?.metadata?.label
    || evaluationResult?.pathway?.metadata?.label
    || 'Current pathway';
  const prevalence = evaluationView?.prevalence
    ?? pathwayRecord?.prevalence
    ?? pathwayDraft?.prevalence
    ?? project?.prevalence
    ?? null;

  const summary = {
    sensitivity: evaluationView?.sens ?? pathwayRecord?.sens ?? null,
    specificity: evaluationView?.spec ?? pathwayRecord?.spec ?? null,
    expectedCost: evaluationView?.summary?.expectedCost ?? pathwayRecord?.cost ?? null,
    turnaround: evaluationView?.summary?.expectedTatLabel ?? evaluationView?.tatAverageLabel ?? pathwayRecord?.tat ?? null,
    ppv: evaluationView?.ppv ?? null,
    npv: evaluationView?.npv ?? null,
    pathCount: evaluationView?.pathCount ?? 0,
    warnings: Array.isArray(evaluationView?.warnings) ? evaluationView.warnings.length : 0,
  };

  const tests = Array.isArray(evaluationView?.testContributions) && evaluationView.testContributions.length
    ? evaluationView.testContributions.map(test => ({
        id: test.id,
        name: test.label || test.name || test.id,
        cost: Number(test.contribution ?? test.cost ?? 0),
        sample: Array.isArray(test.sample_types) ? test.sample_types.join(', ') : test.sample || 'n/a',
        skill: test.skill_level ?? test.skill ?? 'n/a',
      }))
    : collectReportPathwayTests(pathwayDraft);

  const paths = Array.isArray(evaluationView?.paths) ? evaluationView.paths : [];
  const warnings = Array.isArray(evaluationView?.warnings) ? evaluationView.warnings : [];

  return {
    hasData: Boolean(pathwayRecord || pathwayDraft || evaluationView || project),
    projectLabel,
    pathwayLabel,
    prevalence,
    summary,
    tests,
    paths,
    warnings,
    pathwayRecord,
    evaluationView,
  };
}

function MetricCard({ label, value, accent }) {
  return (
    <div className="metric" style={accent ? {borderColor:"var(--sme-orange-100)", background:"var(--sme-orange-050)"} : undefined}>
      <div className="metric__label">{label}</div>
      <div className="metric__value" style={{fontSize:22, color: accent === 'orange' ? 'var(--sme-orange-600)' : undefined}}>{value}</div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div style={{padding:"10px 12px", background:"var(--surface-2)", border:"1px solid var(--edge)", borderRadius:6}}>
      <div className="u-meta" style={{marginBottom:4}}>{label}</div>
      <div style={{fontWeight:700, lineHeight:1.4}}>{value}</div>
    </div>
  );
}

function ScreenReport({ setScreen }) {
  const [preview, setPreview] = useState(() => buildWorkspaceReportPreview());

  useEffect(() => {
    const sync = () => setPreview(buildWorkspaceReportPreview());
    window.addEventListener('optidx-workspace-updated', sync);
    window.addEventListener('optidx-optimization-updated', sync);
    window.addEventListener('optidx-pathway-loaded', sync);
    return () => {
      window.removeEventListener('optidx-workspace-updated', sync);
      window.removeEventListener('optidx-optimization-updated', sync);
      window.removeEventListener('optidx-pathway-loaded', sync);
    };
  }, []);

  const summaryText = useMemo(() => {
    const summary = preview.summary || {};
    return [
      'OptiDx report preview',
      `Project: ${preview.projectLabel}`,
      `Pathway: ${preview.pathwayLabel}`,
      `Prevalence: ${formatReportNumber(preview.prevalence, value => `${(value * 100).toFixed(1)}%`)}`,
      `Sensitivity: ${formatReportNumber(summary.sensitivity, value => `${(value * 100).toFixed(1)}%`)}`,
      `Specificity: ${formatReportNumber(summary.specificity, value => `${(value * 100).toFixed(1)}%`)}`,
      `Expected cost: ${formatReportNumber(summary.expectedCost, value => `$${value.toFixed(2)}`)}`,
      `Turnaround: ${summary.turnaround || 'n/a'}`,
    ].join('\n');
  }, [preview]);

  const currentPathwayId = preview.pathwayRecord?.id || window.OptiDxLatestEvaluationPathway?.id || null;
  const canExport = Boolean(currentPathwayId);

  return (
    <>
      <TopBar
        crumbs={[
          { label: 'OptiDx', onClick: () => setScreen('home'), title: 'Back to home' },
          { label: preview.projectLabel },
          { label: 'Report preview' },
        ]}
        actions={<>
          <button className="btn" onClick={() => window.OptiDxActions.copyText(summaryText)}><Icon name="copy"/>Copy summary</button>
          <button className="btn" onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({ title: 'OptiDx report', text: summaryText, url: window.location.href });
              } else {
                await window.OptiDxActions.copyShareLink?.(window.location.href);
                window.OptiDxActions.showToast?.('Share link copied', 'success');
              }
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || 'Unable to share report', 'error');
            }
          }}><Icon name="upload"/>Share</button>
          <button className="btn" disabled={!canExport} onClick={async () => {
            try {
              if (!canExport) {
                window.OptiDxActions.showToast?.('Evaluate or save a pathway before downloading a report.', 'info');
                return;
              }
              await window.OptiDxActions.downloadReport?.('docx');
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || 'Unable to download DOCX', 'error');
            }
          }}>
            <DocxLogo size={14}/>Download DOCX
          </button>
          <button className="btn btn--primary" disabled={!canExport} onClick={async () => {
            try {
              if (!canExport) {
                window.OptiDxActions.showToast?.('Evaluate or save a pathway before downloading a report.', 'info');
                return;
              }
              await window.OptiDxActions.downloadReport?.('pdf');
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || 'Unable to download PDF', 'error');
            }
          }}>
            <PdfLogo size={14}/>Download PDF
          </button>
        </>}
      />

      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Report preview</div>
            <h1>{preview.pathwayLabel}</h1>
            <p>{preview.projectLabel} • {formatReportNumber(preview.prevalence, value => `${(value * 100).toFixed(1)}% prevalence`)}</p>
          </div>
        </div>

        {!preview.hasData ? (
          <div className="card card--pad" style={{padding:32}}>
            <div className="sme-eyebrow" style={{marginBottom:8}}>No real report data yet</div>
            <h2 style={{marginBottom:8}}>Evaluate or save a pathway to populate the report</h2>
            <p style={{color:"var(--fg-2)", maxWidth:720, lineHeight:1.6, marginBottom:16}}>
              This screen now reflects the active project and the latest evaluated pathway. It stays empty until the workspace has a real pathway record or evaluation result to display.
            </p>
            <div className="row" style={{gap:8, flexWrap:"wrap"}}>
              <button className="btn btn--primary" onClick={() => setScreen('canvas')}>
                <Icon name="git-branch"/>Open builder
              </button>
              <button className="btn" onClick={() => setScreen('results')}>
                <Icon name="activity"/>Open results
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid" style={{gridTemplateColumns:"repeat(4, minmax(0, 1fr))", gap:12, marginBottom:16}}>
              <MetricCard label="Sensitivity" value={formatReportNumber(preview.summary.sensitivity, value => `${(value * 100).toFixed(1)}%`)} accent="pos" />
              <MetricCard label="Specificity" value={formatReportNumber(preview.summary.specificity, value => `${(value * 100).toFixed(1)}%`)} accent="pos" />
              <MetricCard label="Expected cost" value={formatReportNumber(preview.summary.expectedCost, value => `$${value.toFixed(2)}`)} accent="orange" />
              <MetricCard label="Turnaround" value={preview.summary.turnaround || 'n/a'} accent="info" />
            </div>

            <div className="grid" style={{gridTemplateColumns:"minmax(0, 2fr) minmax(320px, 1fr)", gap:16, alignItems:"start"}}>
              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}>
                  <h3>Pathway summary</h3>
                  <div className="spacer"/>
                  <span className="chip chip--outline">{preview.summary.pathCount || 0} paths</span>
                </div>

                <div className="stack" style={{gap:12}}>
                  <div className="grid" style={{gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:12}}>
                    <InfoTile label="Project" value={preview.projectLabel} />
                    <InfoTile label="Pathway" value={preview.pathwayLabel} />
                    <InfoTile label="Prevalence" value={formatReportNumber(preview.prevalence, value => `${(value * 100).toFixed(1)}%`)} />
                  </div>

                  <div className="banner banner--info">
                    <Icon name="info" size={16} className="banner__icon"/>
                    <div>
                      Report content is pulled from the active workspace pathway and its latest evaluation result. If the preview looks incomplete, rerun the pathway or save the current builder graph first.
                    </div>
                  </div>

                  <div className="grid" style={{gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:12}}>
                    <InfoTile label="PPV" value={formatReportNumber(preview.summary.ppv, value => `${(value * 100).toFixed(1)}%`)} />
                    <InfoTile label="NPV" value={formatReportNumber(preview.summary.npv, value => `${(value * 100).toFixed(1)}%`)} />
                    <InfoTile label="Warnings" value={String(preview.summary.warnings || 0)} />
                  </div>
                </div>
              </div>

              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}>
                  <h3>Operational summary</h3>
                </div>
                <div className="stack" style={{gap:10}}>
                  {[
                    ['Latest evaluation', preview.evaluationView ? 'Available' : 'Not available'],
                    ['Path count', preview.summary.pathCount || 0],
                    ['Included tests', preview.tests.length],
                  ].map(([label, value]) => (
                    <div key={label} className="row" style={{justifyContent:'space-between', padding:'10px 12px', background:'var(--surface-2)', border:'1px solid var(--edge)', borderRadius:6}}>
                      <span className="u-meta">{label}</span>
                      <b>{value}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid" style={{gridTemplateColumns:"minmax(0, 1.3fr) minmax(0, 0.7fr)", gap:16, marginTop:16}}>
              <div className="card card--flush">
                <div className="card__head">
                  <h3>Path trace</h3>
                  <div className="spacer"/>
                  <span className="u-meta">{preview.paths.length} path{preview.paths.length === 1 ? '' : 's'}</span>
                </div>
                {preview.paths.length === 0 ? (
                  <div style={{padding:16, color:'var(--fg-3)'}}>Run an evaluation to populate the path trace for this report.</div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Path</th>
                        <th>Sequence</th>
                        <th>Terminal</th>
                        <th className="num">P(path | D+)</th>
                        <th className="num">P(path | D-)</th>
                        <th className="num">Cost</th>
                        <th>TAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.paths.map(path => (
                        <tr key={path.id}>
                          <td className="mono"><b>{path.id}</b></td>
                          <td className="mono" style={{fontSize:11}}>{path.sequence}</td>
                          <td>{path.terminal}</td>
                          <td className="num mono">{formatReportNumber(path.pIfD, value => `${(value * 100).toFixed(1)}%`)}</td>
                          <td className="num mono">{formatReportNumber(path.pIfND, value => `${(value * 100).toFixed(1)}%`)}</td>
                          <td className="num mono">{formatReportNumber(path.cost, value => `$${value.toFixed(2)}`)}</td>
                          <td className="mono">{path.tat || 'n/a'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="stack" style={{gap:16}}>
                <div className="card card--flush">
                  <div className="card__head">
                    <h3>Test contribution</h3>
                  </div>
                  {preview.tests.length === 0 ? (
                    <div style={{padding:16, color:'var(--fg-3)'}}>No tests are attached to the current pathway yet.</div>
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Test</th>
                          <th className="num">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.tests.map(test => (
                          <tr key={test.id}>
                            <td>
                              <div style={{fontWeight:700}}>{test.name}</div>
                              <div className="u-meta" style={{fontSize:10}}>
                                {test.sample} • {test.skill}
                              </div>
                            </td>
                            <td className="num mono">{formatReportNumber(test.cost, value => `$${value.toFixed(2)}`)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card card--pad">
                  <div className="card__head" style={{padding:0, marginBottom:12}}>
                    <h3>Warnings</h3>
                  </div>
                  {preview.warnings.length === 0 ? (
                    <div style={{color:'var(--fg-3)'}}>No warnings are attached to the current evaluation.</div>
                  ) : (
                    <div className="stack" style={{gap:8}}>
                      {preview.warnings.map((warning, index) => (
                        <div key={`${warning.kind || 'info'}-${index}`} className={"banner " + (warning.kind === 'warn' ? 'banner--warn' : 'banner--info')}>
                          <Icon name={warning.kind === 'warn' ? 'alert' : 'info'} size={16} className="banner__icon"/>
                          <div>{warning.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

Object.assign(window, { ScreenReport });
