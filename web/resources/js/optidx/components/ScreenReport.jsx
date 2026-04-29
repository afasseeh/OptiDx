import React, { useEffect, useState } from 'react';

function PdfLogo({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{flexShrink:0}}>
      <rect x="2" y="2" width="20" height="20" rx="2.5" fill="#E4322B"/>
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="7.4" fontFamily="Arial, sans-serif" fontWeight="800">PDF</text>
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

function fmt(value, formatter, fallback = 'n/a') {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return formatter(n);
  return String(value);
}

function collectTests(pathway) {
  const nodes = Array.isArray(pathway?.nodes) ? pathway.nodes : pathway?.nodes && typeof pathway.nodes === 'object' ? Object.values(pathway.nodes) : [];
  const tests = pathway?.tests && typeof pathway.tests === 'object' ? pathway.tests : {};
  const workspaceTests = window.OptiDxActions.getWorkspaceTests?.() || [];
  const seen = new Set();
  const items = [];

  const add = ref => {
    const id = String(ref?.testId ?? ref?.id ?? ref ?? '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const source = tests[id] || tests[String(ref?.id ?? '')] || workspaceTests.find(item => String(item.id) === id) || ref || {};
    const samples = Array.isArray(source.sample_types) ? source.sample_types.filter(Boolean) : source.sample ? [source.sample] : [];
    items.push({
      id,
      name: source.name || source.label || id,
      cost: Number(source.cost ?? 0),
      sample: samples.join(', ') || source.sample || 'n/a',
      skill: source.skill_level ?? source.skill ?? 'n/a',
    });
  };

  for (const node of nodes) {
    if (node?.type === 'test') add(node);
    if (node?.type === 'parallel' && Array.isArray(node.members)) node.members.forEach(add);
  }
  return items;
}

function buildLivePreview(pathwayRecord = null, projectRecord = null) {
  const canonical = pathwayRecord?._canonical || pathwayRecord?.editor_definition || pathwayRecord?.engine_definition || null;
  const evaluation = pathwayRecord?.latestEvaluationResult?.result_payload || pathwayRecord?.latestEvaluationResult?.resultPayload || null;
  const ev = evaluation ? window.OptiDxActions.buildEvaluationView?.(evaluation) : null;
  return {
    title: pathwayRecord?.name || canonical?.metadata?.label || 'Selected pathway',
    projectLabel: projectRecord?.title || pathwayRecord?.project?.title || 'Workspace project',
    prevalence: ev?.prevalence ?? pathwayRecord?.prevalence ?? canonical?.prevalence ?? projectRecord?.prevalence ?? null,
    summary: {
      sensitivity: ev?.sens ?? pathwayRecord?.sens ?? null,
      specificity: ev?.spec ?? pathwayRecord?.spec ?? null,
      expectedCost: ev?.summary?.expectedCost ?? pathwayRecord?.cost ?? null,
      turnaround: ev?.summary?.expectedTatLabel ?? ev?.tatAverageLabel ?? pathwayRecord?.tat ?? null,
      ppv: ev?.ppv ?? null,
      npv: ev?.npv ?? null,
      pathCount: ev?.pathCount ?? 0,
      warnings: Array.isArray(ev?.warnings) ? ev.warnings.length : 0,
    },
    paths: Array.isArray(ev?.paths) ? ev.paths : [],
    tests: Array.isArray(ev?.testContributions) && ev.testContributions.length
      ? ev.testContributions.map(test => ({
          id: test.id,
          name: test.label || test.name || test.id,
          cost: Number(test.contribution ?? test.cost ?? 0),
          sample: Array.isArray(test.sample_types) ? test.sample_types.join(', ') : test.sample || 'n/a',
          skill: test.skill_level ?? test.skill ?? 'n/a',
        }))
      : collectTests(canonical),
    warnings: Array.isArray(ev?.warnings) ? ev.warnings : [],
    hasEvaluation: !!ev,
  };
}

function normalizeReportMeta(report) {
  if (!report || typeof report !== 'object') return null;
  return {
    id: report.id ?? null,
    title: report.title || report.metadata?.title || 'OptiDx report',
    subtitle: report.subtitle || report.metadata?.subtitle || 'Workspace pathway',
    generated_at: report.generated_at || report.created_at || null,
    summary: report.summary || {},
    format: report.format || 'pdf',
    has_pdf: !!report.has_pdf,
    has_html: !!report.has_html,
  };
}

function normalizeReportSnapshot(snapshot, fallbackMeta = null) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    title: snapshot.title || fallbackMeta?.title || 'OptiDx report',
    projectLabel: snapshot.project?.title || snapshot.projectLabel || fallbackMeta?.subtitle || 'Workspace project',
    prevalence: snapshot.summary?.prevalence ?? snapshot.prevalence ?? null,
    settings: snapshot.settings || fallbackMeta?.settings || null,
    pathway: snapshot.pathway || null,
    summary: {
      sensitivity: snapshot.summary?.sensitivity ?? null,
      specificity: snapshot.summary?.specificity ?? null,
      expectedCost: snapshot.summary?.expected_cost ?? snapshot.summary?.expectedCost ?? null,
      turnaround: snapshot.summary?.turnaround ?? null,
      ppv: snapshot.summary?.ppv ?? null,
      npv: snapshot.summary?.npv ?? null,
      pathCount: snapshot.summary?.path_count ?? snapshot.summary?.pathCount ?? (Array.isArray(snapshot.paths) ? snapshot.paths.length : 0),
      warnings: snapshot.summary?.warnings ?? (Array.isArray(snapshot.warnings) ? snapshot.warnings.length : 0),
    },
    sections: Array.isArray(snapshot.sections) ? snapshot.sections : Array.isArray(fallbackMeta?.sections) ? fallbackMeta.sections : [],
    paths: Array.isArray(snapshot.paths) ? snapshot.paths : [],
    tests: Array.isArray(snapshot.tests) ? snapshot.tests : [],
    warnings: Array.isArray(snapshot.warnings) ? snapshot.warnings : [],
    generatedSections: snapshot.generated_sections && typeof snapshot.generated_sections === 'object' ? snapshot.generated_sections : {},
    aiGeneration: snapshot.ai_generation || null,
    hasEvaluation: true,
  };
}

function buildFallbackSectionDraft(section, preview, selectedAudience) {
  const summary = preview.summary || {};
  const warnings = Array.isArray(preview.warnings) ? preview.warnings : [];
  const tests = Array.isArray(preview.tests) ? preview.tests : [];
  const paths = Array.isArray(preview.paths) ? preview.paths : [];
  const contentById = {
    cover: `This ${selectedAudience.toLowerCase()} report reviews the ${preview.title} pathway at an assumed prevalence of ${fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)}. Aggregate sensitivity is ${fmt(summary.sensitivity, n => `${(n * 100).toFixed(1)}%`)} and specificity is ${fmt(summary.specificity, n => `${(n * 100).toFixed(1)}%`)} with an expected cost of ${fmt(summary.expectedCost, n => `$${n.toFixed(2)}`)} per screened patient.`,
    diagram: `The current pathway snapshot is rendered from the stored node sequence and trace outputs. The report keeps the pathway label, evaluation assumptions, and export identity aligned with the persisted workspace record.`,
    aggregate: `Aggregate diagnostic accuracy for the stored evaluation is summarized from the pathway engine outputs. Positive predictive value is ${fmt(summary.ppv, n => `${(n * 100).toFixed(1)}%`)} and negative predictive value is ${fmt(summary.npv, n => `${(n * 100).toFixed(1)}%`)}.`,
    inputs: `The report uses the stored prevalence assumption of ${fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)} together with the latest evaluation payload, included test library metadata, and the pathway-specific branching structure persisted in the report snapshot.`,
    rules: `Decision rules are inherited directly from the saved pathway graph and the evaluation trace. Each branch in the report corresponds to a stored node transition rather than a post-hoc narrative reconstruction.`,
    paths: `The path table below captures ${paths.length} resolved pathway trace${paths.length === 1 ? '' : 's'} with probability, cost, and turnaround outputs taken from the evaluation snapshot.`,
    sensitivity: `Sensitivity analysis content is limited to the parameters already present in the stored pathway snapshot. Where a full tornado analysis has not yet been computed, the report should treat sensitivity drivers as directional rather than exhaustive.`,
    costing: `Resource use is derived from the included test set (${tests.length} test${tests.length === 1 ? '' : 's'}) and the path-level accumulation logic in the evaluation result. The current expected turnaround is ${summary.turnaround || 'n/a'}.`,
    comparators: `Comparator pathway analysis is only available when alternative stored pathways or benchmark comparators are attached to the same decision context. No additional comparator evidence is inferred beyond the persisted workspace snapshot.`,
    warnings: warnings.length
      ? `The current report carries ${warnings.length} warning${warnings.length === 1 ? '' : 's'} from the evaluation and validation pipeline. These warnings should be reviewed before decision use.`
      : 'No warnings were recorded in the stored evaluation snapshot.',
    references: 'Evidence references remain limited to the diagnostic tests, provenance notes, and validation context already stored in the workspace snapshot. Additional citations should be added only when they are present in the underlying evidence record.',
  };

  return {
    title: section.label || section.id || 'Section',
    content: contentById[section.id] || `${section.label || 'This section'} is based on the stored pathway and evaluation snapshot.`,
    bullets: [],
    tables: [],
  };
}

function buildReportSections() {
  return [
    { id: 'cover', label: 'Cover & executive summary', description: 'Title page, key metrics, and narrative summary.', page: 1, enabled: true },
    { id: 'diagram', label: 'Pathway diagram', description: 'Rendered pathway and document identity.', page: 1, enabled: true },
    { id: 'aggregate', label: 'Aggregate diagnostic accuracy', description: 'Sensitivity, specificity, PPV, and NPV.', page: 2, enabled: true },
    { id: 'inputs', label: 'Input parameters & priors', description: 'Model inputs, priors, and prevalence assumptions.', page: 2, enabled: true },
    { id: 'rules', label: 'Decision rules per node', description: 'Node-level branching and routing logic.', page: 2, enabled: true },
    { id: 'paths', label: 'Path-level outcome table', description: 'Resolved path trace and per-path metrics.', page: 3, enabled: true },
    { id: 'sensitivity', label: 'Sensitivity analysis (tornado)', description: 'Parameter influence and scenario sensitivity summary.', page: 3, enabled: true },
    { id: 'costing', label: 'Costing & resource use', description: 'Cost accumulation and resource assumptions.', page: 4, enabled: true },
    { id: 'comparators', label: 'Comparator pathways', description: 'Alternative pathway context and comparison points.', page: 5, enabled: true },
    { id: 'warnings', label: 'Warnings & assumptions', description: 'Validation warnings and caveats.', page: 5, enabled: true },
    { id: 'references', label: 'Evidence sources & references', description: 'Evidence base and references supporting the report.', page: 6, enabled: true },
  ];
}

function buildDefaultReportSettings() {
  return {
    template: 'OptiDx decision report',
    brand: {
      organization: 'Syreon',
      accent: '#F37739',
      footer: "Today's research for tomorrow's health",
      issuer: 'Syreon MENA HTA',
    },
    audience: {
      selected: 'technical',
      options: [
        { id: 'technical', label: 'Technical (HTA analyst)', description: 'Full methodology, parameters, sensitivity, path table.' },
        { id: 'clinical', label: 'Clinical', description: 'Pathway interpretation, decision rules, workflow.' },
        { id: 'policymaker', label: 'Policymaker', description: 'Aggregate impact, costing, equity, key takeaways.' },
      ],
    },
    output: {
      selected_format: 'pdf',
      formats: ['pdf', 'docx'],
      format_options: [
        { id: 'pdf', label: 'PDF', description: 'Print-ready, signed digital report' },
        { id: 'docx', label: 'Microsoft Word (.docx)', description: 'Editable for ministry templates' },
      ],
      render_mode: 'HTML-first -> PDF conversion',
      access: 'Authenticated workspace users',
    },
    include: {
      pathway_diagram: true,
      aggregate_metrics: true,
      cost_per_detected_case: true,
      path_level_trace_table: true,
      warnings_and_assumptions: true,
      evidence_references: true,
    },
    sections: buildReportSections(),
  };
}

function mergeReportSettings(snapshotSettings = null) {
  return {
    ...buildDefaultReportSettings(),
    ...(snapshotSettings || {}),
    brand: { ...buildDefaultReportSettings().brand, ...(snapshotSettings?.brand || {}) },
    audience: { ...buildDefaultReportSettings().audience, ...(snapshotSettings?.audience || {}) },
    output: { ...buildDefaultReportSettings().output, ...(snapshotSettings?.output || {}) },
    include: { ...buildDefaultReportSettings().include, ...(snapshotSettings?.include || {}) },
    sections: Array.isArray(snapshotSettings?.sections) && snapshotSettings.sections.length ? snapshotSettings.sections : buildReportSections(),
  };
}

function ReportDocument({ preview, stored }) {
  const summary = preview.summary || {};
  const settings = preview.settings || {};
  const sections = Array.isArray(preview.sections) ? preview.sections : [];
  const selectedAudience = settings.audience?.options?.find(option => option.id === settings.audience?.selected)?.label || settings.audience?.selected || 'Technical (HTA analyst)';
  const selectedFormat = settings.output?.selected_format || settings.output?.formats?.[0] || 'pdf';
  const activeSectionCount = sections.filter(section => section.enabled !== false).length;
  const pageCount = Math.max(1, ...sections.map(section => Number(section.page) || 1));
  const pages = [
    { label: 'Page 1', title: preview.title, subtitle: `${preview.projectLabel} - ${fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)} prevalence - ${selectedAudience} edition` },
    { label: 'Page 2', title: 'Path trace and warnings', subtitle: stored ? 'Stored snapshot' : 'Live preview' },
    { label: 'Page 3', title: 'Report settings and sections', subtitle: stored ? 'Template settings' : 'Live preview' },
  ];

  return (
    <div className="report-document">
      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">OptiDx report</div>
            <h1 style={{fontSize:22, marginBottom:6}}>{pages[0].title}</h1>
            <p className="meta">{pages[0].subtitle}</p>
          </div>
          <div style={{textAlign:'right', fontSize:11, color:'var(--fg-3)'}}>
            <div style={{fontWeight:700, letterSpacing:'0.14em', color:'var(--sme-ink-900)'}}>CONFIDENTIAL</div>
            <div>{new Date().toLocaleString()}</div>
            <div className="pill" style={{marginTop:10}}>{pages[0].label}</div>
          </div>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12, marginBottom:18}}>
          {[
            ['Sensitivity', fmt(summary.sensitivity, n => `${(n * 100).toFixed(1)}%`)],
            ['Specificity', fmt(summary.specificity, n => `${(n * 100).toFixed(1)}%`)],
            ['Expected cost', fmt(summary.expectedCost, n => `$${n.toFixed(2)}`)],
          ].map(([label, value]) => (
            <div key={label} className="metric metric--accent">
              <div className="metric__label">{label}</div>
              <div className="metric__value" style={{fontSize:22}}>{value}</div>
            </div>
          ))}
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12}}>
          <div className="box">
            <h2>Project context</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Project:</strong> {preview.projectLabel}</div>
              <div><strong>Pathway:</strong> {preview.title}</div>
              <div><strong>Prevalence:</strong> {fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)}</div>
            </div>
          </div>
          <div className="box">
            <h2>Operational summary</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Path count:</strong> {summary.pathCount || 0}</div>
              <div><strong>Warnings:</strong> {summary.warnings || 0}</div>
              <div><strong>Turnaround:</strong> {summary.turnaround || 'n/a'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">Path-level outcomes</div>
            <h1 style={{fontSize:22, marginBottom:6}}>Path trace and test contribution</h1>
            <p className="meta">Resolved pathways, included tests, and evaluation warnings.</p>
          </div>
          <div className="pill">{pages[1].label}</div>
        </div>
        <div className="box" style={{marginBottom:18}}>
          <h2>Path-level outcome table</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Path</th><th>Sequence</th><th>Terminal</th><th className="num">P(path | D+)</th><th className="num">P(path | D-)</th><th className="num">Cost</th><th className="num">TAT</th>
              </tr>
            </thead>
            <tbody>
              {preview.paths.length === 0 ? (
                <tr><td colSpan={7} className="meta">No path trace was available for this report snapshot.</td></tr>
              ) : preview.paths.map(path => (
                <tr key={path.id || `${path.sequence}-${path.terminal}`}>
                  <td>{path.id || 'n/a'}</td>
                  <td>{path.sequence || 'n/a'}</td>
                  <td>{path.terminal || 'n/a'}</td>
                  <td className="num">{fmt(path.pIfD, n => `${(n * 100).toFixed(1)}%`)}</td>
                  <td className="num">{fmt(path.pIfND, n => `${(n * 100).toFixed(1)}%`)}</td>
                  <td className="num">{fmt(path.cost, n => `$${n.toFixed(2)}`)}</td>
                  <td className="num">{path.tat || 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12}}>
          <div className="box">
            <h2>Included tests</h2>
            <table className="table">
              <thead><tr><th>Test</th><th className="num">Cost</th></tr></thead>
              <tbody>
                {preview.tests.length === 0 ? (
                  <tr><td colSpan={2} className="meta">No tests were attached to this report snapshot.</td></tr>
                ) : preview.tests.map(test => (
                  <tr key={test.id}>
                    <td><div style={{fontWeight:700}}>{test.name}</div><div className="meta">{test.sample} - {test.skill}</div></td>
                    <td className="num">{fmt(test.cost, n => `$${n.toFixed(2)}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="box">
            <h2>Warnings</h2>
            {preview.warnings.length === 0 ? (
              <div className="meta">No warnings were recorded for this export snapshot.</div>
            ) : preview.warnings.map((warning, index) => (
              <div key={`${warning.kind || 'info'}-${index}`} className="warning">{warning.text || warning}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">Template settings</div>
            <h1 style={{fontSize:22, marginBottom:6}}>{pages[2].title}</h1>
            <p className="meta">Document settings, audience controls, and the section map that generated the report snapshot.</p>
          </div>
          <div className="pill">{pages[2].label}</div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12, marginBottom:18}}>
          <div className="box">
            <h2>Brand and output</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Template:</strong> {settings.template || 'OptiDx decision report'}</div>
              <div><strong>Organization:</strong> {settings.brand?.organization || 'Syreon'}</div>
              <div><strong>Issuer:</strong> {settings.brand?.issuer || 'Syreon MENA HTA'}</div>
              <div><strong>Accent:</strong> {settings.brand?.accent || '#F37739'}</div>
              <div><strong>Footer:</strong> {settings.brand?.footer || "Today's research for tomorrow's health"}</div>
              <div><strong>Formats:</strong> {Array.isArray(settings.output?.formats) ? settings.output.formats.join(' · ') : 'pdf · docx'}</div>
              <div><strong>Render mode:</strong> {settings.output?.render_mode || 'HTML-first -> PDF conversion'}</div>
              <div><strong>Access:</strong> {settings.output?.access || 'Authenticated workspace users'}</div>
            </div>
          </div>
          <div className="box">
            <h2>Audience and include toggles</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Primary audience:</strong> {settings.audience?.primary || 'Decision makers'}</div>
              <div><strong>Secondary audience:</strong> {settings.audience?.secondary || 'HTA reviewers and implementation teams'}</div>
            </div>
            <table className="table" style={{marginTop:12}}>
              <thead>
                <tr><th>Include setting</th><th className="num">Enabled</th></tr>
              </thead>
              <tbody>
                {Object.entries(settings.include || {}).length === 0 ? (
                  <tr><td colSpan={2} className="meta">No include settings were stored for this report snapshot.</td></tr>
                ) : Object.entries(settings.include || {}).map(([key, enabled]) => (
                  <tr key={key}>
                    <td>{key.replace(/_/g, ' ')}</td>
                    <td className="num">{enabled ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <h2>Section map</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr><td colSpan={2} className="meta">No section metadata was stored for this report snapshot.</td></tr>
              ) : sections.map(section => (
                <tr key={section.id || section.label}>
                  <td>{section.label || section.id || 'Section'}</td>
                  <td className="meta">{section.description || 'No description available.'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ReportDocumentV2({ preview, stored }) {
  const summary = preview.summary || {};
  const settings = preview.settings || {};
  const sections = Array.isArray(preview.sections) ? preview.sections : [];
  const generatedSections = preview.generatedSections && typeof preview.generatedSections === 'object' ? preview.generatedSections : {};
  const selectedAudienceOption = settings.audience?.options?.find(option => option.id === settings.audience?.selected) || null;
  const selectedAudience = selectedAudienceOption?.label || settings.audience?.selected || 'Technical (HTA analyst)';
  const selectedFormatOption = settings.output?.format_options?.find(option => option.id === settings.output?.selected_format) || null;
  const selectedFormat = selectedFormatOption?.label || settings.output?.selected_format || settings.output?.formats?.[0] || 'pdf';
  const activeSectionCount = sections.filter(section => section.enabled !== false).length;
  const pageCount = Math.max(1, ...sections.map(section => Number(section.page) || 1));
  const enabledSections = sections.filter(section => section.enabled !== false);

  return (
    <div className="report-document">
      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">OptiDx decision report</div>
            <h1 style={{fontSize:22, marginBottom:6}}>{preview.title}</h1>
            <p className="meta">
              {preview.projectLabel} - {fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)} prevalence - {selectedAudience} edition
            </p>
          </div>
          <div style={{textAlign:'right', fontSize:11, color:'var(--fg-3)'}}>
            <div style={{fontWeight:700, letterSpacing:'0.14em', color:'var(--sme-ink-900)'}}>CONFIDENTIAL</div>
            <div>{new Date().toLocaleString()}</div>
            <div className="pill" style={{marginTop:10}}>Page 1</div>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:12, marginBottom:18}}>
          {[
            ['Sensitivity', fmt(summary.sensitivity, n => `${(n * 100).toFixed(1)}%`)],
            ['Specificity', fmt(summary.specificity, n => `${(n * 100).toFixed(1)}%`)],
            ['Expected cost', fmt(summary.expectedCost, n => `$${n.toFixed(2)}`)],
          ].map(([label, value]) => (
            <div key={label} className="metric metric--accent">
              <div className="metric__label">{label}</div>
              <div className="metric__value" style={{fontSize:22}}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12}}>
          <div className="box">
            <h2>Project context</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Project:</strong> {preview.projectLabel}</div>
              <div><strong>Pathway:</strong> {preview.title}</div>
              <div><strong>Prevalence:</strong> {fmt(preview.prevalence, n => `${(n * 100).toFixed(1)}%`)}</div>
            </div>
          </div>
          <div className="box">
            <h2>Operational summary</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Path count:</strong> {summary.pathCount || 0}</div>
              <div><strong>Warnings:</strong> {summary.warnings || 0}</div>
              <div><strong>Turnaround:</strong> {summary.turnaround || 'n/a'}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">Path-level outcomes</div>
            <h1 style={{fontSize:22, marginBottom:6}}>Path trace and test contribution</h1>
            <p className="meta">Each row mirrors a path in the evaluation snapshot.</p>
          </div>
          <div className="pill">Page 2</div>
        </div>

        <div className="box" style={{marginBottom:18}}>
          <h2>Path trace table</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Sequence</th>
                <th>Terminal</th>
                <th className="num">P(d)</th>
                <th className="num">P(no d)</th>
                <th className="num">Cost</th>
                <th className="num">TAT</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(preview.paths) && preview.paths.length > 0 ? preview.paths.map(path => (
                <tr key={path.id || path.sequence || path.terminal}>
                  <td>{path.id || 'path'}</td>
                  <td>{Array.isArray(path.sequence) ? path.sequence.join(' → ') : path.sequence || 'n/a'}</td>
                  <td>{path.terminal || 'n/a'}</td>
                  <td className="num">{fmt(path.pIfD, n => `${(n * 100).toFixed(1)}%`)}</td>
                  <td className="num">{fmt(path.pIfND, n => `${(n * 100).toFixed(1)}%`)}</td>
                  <td className="num">{fmt(path.cost, n => `$${n.toFixed(2)}`)}</td>
                  <td className="num">{path.tat || 'n/a'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="meta">No path trace was stored for this report snapshot.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12}}>
          <div className="box">
            <h2>Included tests</h2>
            <table className="table">
              <thead><tr><th>Test</th><th className="num">Cost</th></tr></thead>
              <tbody>
                {preview.tests.length === 0 ? (
                  <tr><td colSpan={2} className="meta">No tests were attached to this report snapshot.</td></tr>
                ) : preview.tests.map(test => (
                  <tr key={test.id}>
                    <td><div style={{fontWeight:700}}>{test.name}</div><div className="meta">{test.sample} - {test.skill}</div></td>
                    <td className="num">{fmt(test.cost, n => `$${n.toFixed(2)}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="box">
            <h2>Warnings</h2>
            {preview.warnings.length === 0 ? (
              <div className="meta">No warnings were recorded for this export snapshot.</div>
            ) : preview.warnings.map((warning, index) => (
              <div key={`${warning.kind || 'info'}-${index}`} className="warning">{warning.text || warning}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">Template settings</div>
            <h1 style={{fontSize:22, marginBottom:6}}>Report settings and sections</h1>
            <p className="meta">Document settings, audience controls, and the section map that generated the report snapshot.</p>
          </div>
          <div className="pill">Page 3</div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:12, marginBottom:18}}>
          <div className="box">
            <h2>Brand and output</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Template:</strong> {settings.template || 'OptiDx decision report'}</div>
              <div><strong>Organization:</strong> {settings.brand?.organization || 'Syreon'}</div>
              <div><strong>Issuer:</strong> {settings.brand?.issuer || 'Syreon MENA HTA'}</div>
              <div><strong>Accent:</strong> {settings.brand?.accent || '#F37739'}</div>
              <div><strong>Footer:</strong> {settings.brand?.footer || "Today's research for tomorrow's health"}</div>
              <div><strong>Formats:</strong> {Array.isArray(settings.output?.formats) ? settings.output.formats.join(' · ') : 'pdf · docx'}</div>
              <div><strong>Selected format:</strong> {selectedFormat}</div>
              <div><strong>Render mode:</strong> {settings.output?.render_mode || 'HTML-first -> PDF conversion'}</div>
              <div><strong>Access:</strong> {settings.output?.access || 'Authenticated workspace users'}</div>
            </div>
          </div>
          <div className="box">
            <h2>Audience and include toggles</h2>
            <div className="meta" style={{lineHeight:1.7}}>
              <div><strong>Selected audience:</strong> {selectedAudience}</div>
              <div><strong>Audience note:</strong> {selectedAudienceOption?.description || 'Decision makers and technical reviewers'}</div>
              <div><strong>Active sections:</strong> {activeSectionCount}</div>
              <div><strong>Pages:</strong> {pageCount}</div>
            </div>
            <table className="table" style={{marginTop:12}}>
              <thead>
                <tr><th>Include setting</th><th className="num">Enabled</th></tr>
              </thead>
              <tbody>
                {Object.entries(settings.include || {}).length === 0 ? (
                  <tr><td colSpan={2} className="meta">No include settings were stored for this report snapshot.</td></tr>
                ) : Object.entries(settings.include || {}).map(([key, enabled]) => (
                  <tr key={key}>
                    <td>{key.replace(/_/g, ' ')}</td>
                    <td className="num">{enabled ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="box">
          <h2>Section map</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Description</th>
                <th className="num">Page</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr><td colSpan={3} className="meta">No section metadata was stored for this report snapshot.</td></tr>
              ) : sections.map(section => (
                <tr key={section.id || section.label}>
                  <td>{section.label || section.id || 'Section'}</td>
                  <td className="meta">{section.description || 'No description available.'}</td>
                  <td className="num">{section.page || 'n/a'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-page">
        <div className="brand" style={{marginBottom:18}}>
          <div>
            <div className="eyebrow">Narrative sections</div>
            <h1 style={{fontSize:22, marginBottom:6}}>Generated report sections</h1>
            <p className="meta">Each section below prefers persisted AI-authored draft content and falls back to deterministic snapshot text when AI content is not yet available.</p>
          </div>
          <div className="pill">Page 4</div>
        </div>

        <div className="stack" style={{gap:14}}>
          {enabledSections.map(section => {
            const draft = generatedSections?.[section.id] || buildFallbackSectionDraft(section, preview, selectedAudience);
            return (
              <div key={section.id} className="box">
                <div className="row" style={{justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
                  <h2 style={{marginBottom:0}}>{draft.title || section.label || section.id}</h2>
                  <span className="pill">{section.page ? `p.${section.page}` : 'enabled'}</span>
                </div>
                <div className="meta" style={{fontSize:14, color:'var(--fg-1)', lineHeight:1.75, whiteSpace:'pre-wrap'}}>
                  {draft.content}
                </div>
                {Array.isArray(draft.bullets) && draft.bullets.length > 0 ? (
                  <ul style={{margin:'12px 0 0 18px', color:'var(--fg-1)', lineHeight:1.7}}>
                    {draft.bullets.map((bullet, index) => (
                      <li key={`${section.id}-bullet-${index}`}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {Array.isArray(draft.tables) && draft.tables.length > 0 ? draft.tables.map((table, tableIndex) => (
                  <div key={`${section.id}-table-${tableIndex}`} style={{marginTop:14}}>
                    {table.title ? <div style={{fontWeight:700, marginBottom:8}}>{table.title}</div> : null}
                    <table className="table">
                      {Array.isArray(table.columns) && table.columns.length > 0 ? (
                        <thead>
                          <tr>
                            {table.columns.map((column, columnIndex) => <th key={`${section.id}-column-${columnIndex}`}>{column}</th>)}
                          </tr>
                        </thead>
                      ) : null}
                      <tbody>
                        {(table.rows || []).map((row, rowIndex) => (
                          <tr key={`${section.id}-row-${rowIndex}`}>
                            {row.map((value, valueIndex) => <td key={`${section.id}-row-${rowIndex}-value-${valueIndex}`}>{value}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )) : null}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ScreenReport({ setScreen, selectedPathwayId, onSelectPathwayId, onOpenReport }) {
  const [projectFilter, setProjectFilter] = useState('all');
  const [selectedPathwayKey, setSelectedPathwayKey] = useState(selectedPathwayId || null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [detailReportId, setDetailReportId] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportDetail, setReportDetail] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingReportDetail, setLoadingReportDetail] = useState(false);
  const [revision, setRevision] = useState(0);

  const projects = Array.isArray(window.OptiDxActions.getWorkspaceProjects?.()) ? window.OptiDxActions.getWorkspaceProjects?.() : [];
  const pathways = Array.isArray(window.OptiDxActions.getWorkspacePathways?.()) ? window.OptiDxActions.getWorkspacePathways?.() : [];

  useEffect(() => {
    const sync = () => setRevision(value => value + 1);
    window.addEventListener('optidx-workspace-updated', sync);
    window.addEventListener('optidx-optimization-updated', sync);
    window.addEventListener('optidx-pathway-loaded', sync);
    return () => {
      window.removeEventListener('optidx-workspace-updated', sync);
      window.removeEventListener('optidx-optimization-updated', sync);
      window.removeEventListener('optidx-pathway-loaded', sync);
    };
  }, []);

  useEffect(() => {
    const selectedFromProp = selectedPathwayId ? pathways.find(item => String(item.id) === String(selectedPathwayId)) : null;
    if (selectedFromProp) {
      setSelectedPathwayKey(selectedFromProp.id);
      onSelectPathwayId?.(selectedFromProp.id);
      if (selectedFromProp.project_id || selectedFromProp.project?.id) {
        setProjectFilter(String(selectedFromProp.project_id ?? selectedFromProp.project?.id));
      }
    }
  }, [onSelectPathwayId, pathways, selectedPathwayId, revision]);

  useEffect(() => {
    if (selectedPathwayKey || !pathways.length || selectedPathwayId) return;
    const fallback = pathways.find(item => item.latestEvaluationResult?.result_payload || item.latestEvaluationResult?.resultPayload) || pathways[0];
    if (fallback) {
      setSelectedPathwayKey(fallback.id);
      onSelectPathwayId?.(fallback.id);
      if (fallback.project_id || fallback.project?.id) {
        setProjectFilter(String(fallback.project_id ?? fallback.project?.id));
      }
    }
  }, [onSelectPathwayId, pathways, selectedPathwayId, selectedPathwayKey, revision]);

  const selectedPathway = pathways.find(item => String(item.id) === String(selectedPathwayKey)) || null;
  const selectedProjectId = projectFilter === 'all' ? selectedPathway?.project_id ?? selectedPathway?.project?.id ?? null : projectFilter;
  const selectedProject = selectedProjectId != null ? projects.find(project => String(project.id) === String(selectedProjectId)) || selectedPathway?.project || null : null;
  const visiblePathways = projectFilter === 'all'
    ? pathways
    : pathways.filter(pathway => String(pathway.project_id ?? pathway.project?.id ?? '') === String(projectFilter));
  const livePreview = buildLivePreview(selectedPathway, selectedProject);
  const selectedReport = reports.find(report => String(report.id) === String(selectedReportId)) || null;
  const detailedReport = reports.find(report => String(report.id) === String(detailReportId)) || null;
  const activePreview = reportDetail?.snapshot || livePreview;

  const openReportDetail = async (reportId, pathwayId = null) => {
    if (!reportId) {
      return null;
    }

    if (typeof onOpenReport === 'function') {
      onOpenReport(reportId, pathwayId);
      return reportId;
    }

    setDetailReportId(reportId);
    setLoadingReportDetail(true);
    try {
      const response = await window.OptiDxActions.fetchReportRecord?.(reportId);
      const meta = normalizeReportMeta(response?.data?.report || response?.report || response?.data?.meta || response?.meta || response);
      const snapshot = normalizeReportSnapshot(response?.data?.data || response?.data || response?.data?.snapshot || response?.snapshot, meta);
      const detail = { meta, snapshot };
      setReportDetail(detail);
      setSelectedReportId(reportId);
      return detail;
    } catch (error) {
      setDetailReportId(null);
      setReportDetail(null);
      window.OptiDxActions.showToast?.(error?.message || 'Unable to open report', 'error');
      return null;
    } finally {
      setLoadingReportDetail(false);
    }
  };

  const closeReportDetail = () => {
    setDetailReportId(null);
    setReportDetail(null);
  };

  useEffect(() => {
    let active = true;
    if (!selectedPathway?.id) {
      setReports([]);
      setReportDetail(null);
      setSelectedReportId(null);
      setDetailReportId(null);
      return undefined;
    }

    setLoadingReports(true);
    window.OptiDxActions.fetchPathwayReports?.(selectedPathway.id)
      .then(items => {
        if (!active) return;
        setReports(items);
        const nextId = selectedReportId && items.some(report => String(report.id) === String(selectedReportId))
          ? selectedReportId
          : items[0]?.id || null;
        setSelectedReportId(nextId);
        if (detailReportId && items.some(report => String(report.id) === String(detailReportId))) {
          return openReportDetail(detailReportId);
        }
        if (!items.some(report => String(report.id) === String(detailReportId))) {
          setDetailReportId(null);
          setReportDetail(null);
        }
        return null;
      })
      .catch(error => {
        if (!active) return;
        window.OptiDxActions.showToast?.(error?.message || 'Unable to load report history', 'error');
        setReports([]);
      })
      .finally(() => {
        if (active) setLoadingReports(false);
      });

    return () => { active = false; };
    }, [revision, selectedPathway?.id]);

  const projectOptions = [
    { id: 'all', title: 'All projects', count: pathways.length },
    ...projects.map(project => ({
      id: project.id,
      title: project.title || project.name || 'Untitled project',
      count: pathways.filter(pathway => String(pathway.project_id ?? pathway.project?.id ?? '') === String(project.id)).length,
    })),
  ];

  const canExport = Boolean(selectedPathway?.id && livePreview.hasEvaluation);
  const currentDetailTitle = reportDetail?.meta?.title || detailedReport?.title || 'Stored report';
  const handleOpenReport = (reportId, pathwayId = null) => {
    void openReportDetail(reportId, pathwayId);
  };

  const refreshReports = async pathwayId => {
    if (!pathwayId) {
      return [];
    }

    const nextReports = await window.OptiDxActions.fetchPathwayReports?.(pathwayId) || [];
    setReports(nextReports);
    setSelectedReportId(current => current && nextReports.some(report => String(report.id) === String(current))
      ? current
      : nextReports[0]?.id || null);
    return nextReports;
  };

  const renameReport = async report => {
    const currentTitle = report?.title || report?.metadata?.title || 'OptiDx report';
    const nextTitle = window.prompt('Rename report', currentTitle);
    const trimmed = String(nextTitle || '').trim();
    if (!trimmed || trimmed === currentTitle) {
      return;
    }

    try {
      await window.OptiDxActions.renameReportRecord?.(report.id, trimmed);
      await refreshReports(selectedPathway?.id);
      if (String(detailReportId) === String(report.id)) {
        await openReportDetail(report.id, report.pathway_id);
      }
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to rename report', 'error');
    }
  };

  const deleteReport = async report => {
    const title = report?.title || report?.metadata?.title || 'this report';
    if (!window.confirm(`Delete "${title}"? This will remove the stored snapshot and export files.`)) {
      return;
    }

    try {
      await window.OptiDxActions.deleteReportRecord?.(report.id);
      const nextReports = await refreshReports(selectedPathway?.id);
      if (String(detailReportId) === String(report.id) || !nextReports.some(item => String(item.id) === String(detailReportId))) {
        closeReportDetail();
      }
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to delete report', 'error');
    }
  };

  if (detailReportId) {
    return (
      <>
        <TopBar
          crumbs={[
            { label: 'OptiDx', onClick: () => setScreen('home'), title: 'Back to home' },
            { label: 'Report hub', onClick: () => closeReportDetail(), title: 'Back to report list' },
            { label: currentDetailTitle },
          ]}
          actions={<>
            <button className="btn" onClick={() => closeReportDetail()}>
              <Icon name="arrow-left"/>Back to reports
            </button>
            <button className="btn" disabled={!reportDetail?.meta?.id && !detailReportId} onClick={async () => {
              try {
                await window.OptiDxActions.downloadStoredReport?.(detailReportId, 'docx');
              } catch (error) {
                window.OptiDxActions.showToast?.(error?.message || 'Unable to download DOCX', 'error');
              }
            }}>
              <DocxLogo size={14}/>Download DOCX
            </button>
            <button className="btn" disabled={!detailReportId} onClick={async () => {
              try {
                await window.OptiDxActions.downloadStoredReport?.(detailReportId, 'pdf');
              } catch (error) {
                window.OptiDxActions.showToast?.(error?.message || 'Unable to download PDF', 'error');
              }
            }}>
              <PdfLogo size={14}/>Download PDF
            </button>
            <button className="btn" disabled={!reportDetail?.meta?.id && !detailReportId} onClick={() => renameReport(reportDetail?.meta || detailedReport || selectedReport)}>
              Rename
            </button>
            <button className="btn btn--primary" disabled={!reportDetail?.meta?.id && !detailReportId} onClick={() => deleteReport(reportDetail?.meta || detailedReport || selectedReport)}>
              Delete
            </button>
          </>}
        />

        <div className="page" style={{maxWidth:1440}}>
          <div className="page__head">
            <div>
              <div className="sme-eyebrow" style={{marginBottom:6}}>Report detail</div>
              <h1>{currentDetailTitle}</h1>
              <p>{reportDetail?.meta?.subtitle || selectedPathway?.project?.title || livePreview.projectLabel}</p>
            </div>
          </div>

          {loadingReportDetail && !reportDetail ? (
            <div className="card card--pad" style={{padding:32}}>Loading report snapshot...</div>
          ) : reportDetail ? (
            <div className="grid" style={{gridTemplateColumns:'300px minmax(0, 1fr)', gap:16, alignItems:'start'}}>
              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Report snapshot</h3></div>
                <div className="stack" style={{gap:8}}>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Generated</div>
                    <div className="u-meta">{reportDetail.meta?.generated_at ? new Date(reportDetail.meta.generated_at).toLocaleString() : 'Unknown date'}</div>
                  </div>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Format</div>
                    <div className="u-meta">{reportDetail.meta?.format || 'pdf'}</div>
                  </div>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Summary warnings</div>
                    <div className="u-meta">{reportDetail.snapshot?.summary?.warnings ?? reportDetail.snapshot?.warnings?.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="card card--pad" style={{background:'var(--surface-3)'}}>
                <div className="card__head" style={{padding:0, marginBottom:16}}><h3>Document preview</h3><div className="spacer"/><span className="u-meta">Stored report</span></div>
                <ReportDocumentV2 preview={reportDetail.snapshot || livePreview} stored />
              </div>
            </div>
          ) : (
            <div className="card card--pad" style={{padding:32}}>The selected report could not be loaded.</div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        crumbs={[
          { label: 'OptiDx', onClick: () => setScreen('home'), title: 'Back to home' },
          { label: 'Report hub' },
          { label: reportDetail ? reportDetail.meta?.subtitle : livePreview.projectLabel },
        ]}
        actions={<>
          <button className="btn" disabled={!selectedPathway?.id} onClick={() => setScreen('canvas')}>
            <Icon name="git-branch"/>Open builder
          </button>
          <button className="btn" disabled={!canExport} onClick={async () => {
            if (!canExport) {
              window.OptiDxActions.showToast?.('Select a pathway with a completed evaluation before exporting.', 'info');
              return;
            }
            try {
              await window.OptiDxActions.downloadReport?.('docx', selectedPathway.id);
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || 'Unable to download DOCX', 'error');
            }
          }}>
            <DocxLogo size={14}/>Download DOCX
          </button>
          <button className="btn btn--primary" disabled={!canExport} onClick={async () => {
            if (!canExport) {
              window.OptiDxActions.showToast?.('Select a pathway with a completed evaluation before exporting.', 'info');
              return;
            }
            try {
              await window.OptiDxActions.downloadReport?.('pdf', selectedPathway.id);
              const nextReports = await window.OptiDxActions.fetchPathwayReports?.(selectedPathway.id);
              setReports(nextReports);
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
            <div className="sme-eyebrow" style={{marginBottom:6}}>Report hub</div>
            <h1>Projects and pathway reports</h1>
            <p>Choose a persisted pathway, review its latest evaluation, and reopen previous report snapshots.</p>
          </div>
        </div>

        <div className="grid" style={{gridTemplateColumns:'300px minmax(0, 1fr)', gap:16, alignItems:'start'}}>
          <div className="stack" style={{gap:16}}>
            <div className="card card--pad">
              <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Projects</h3></div>
              <div className="stack" style={{gap:8}}>
                {projectOptions.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    className="card card--pad"
                    onClick={() => setProjectFilter(project.id)}
                    style={{width:'100%', textAlign:'left', borderColor: projectFilter === project.id ? 'var(--sme-orange)' : 'var(--edge)', background: projectFilter === project.id ? 'var(--sme-orange-050)' : 'var(--surface)'}}
                  >
                    <div style={{fontWeight:700, marginBottom:4}}>{project.title}</div>
                    <div className="u-meta">{project.count} pathway{project.count === 1 ? '' : 's'}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card card--pad">
              <div className="row" style={{marginBottom:10}}><h3>Previous reports</h3><div className="spacer"/><span className="u-meta">{reports.length}</span></div>
              {loadingReports ? (
                <div style={{padding:16, color:'var(--fg-3)'}}>Loading report history...</div>
              ) : reports.length === 0 ? (
                <div style={{padding:16, color:'var(--fg-3)'}}>No previous reports have been saved for the selected pathway.</div>
              ) : (
                <div className="stack" style={{gap:8}}>
                  {reports.map(report => {
                    const active = String(report.id) === String(selectedReportId);
                    return (
                      <div
                        key={report.id}
                        className="card card--pad"
                        onClick={() => handleOpenReport(report.id)}
                        style={{borderColor: active ? 'var(--sme-orange)' : 'var(--edge)', background: active ? 'var(--sme-orange-050)' : 'var(--surface)', cursor:'pointer'}}
                      >
                        <div className="row" style={{marginBottom:6}}>
                          <div style={{minWidth:0}}>
                            <div style={{fontWeight:700}}>{report.title || 'Stored report'}</div>
                            <div className="u-meta">{report.generated_at ? new Date(report.generated_at).toLocaleString() : 'Unknown date'}</div>
                          </div>
                          <div className="spacer"/>
                          <span className="chip chip--outline">{report.format || 'pdf'}</span>
                        </div>
                        <div className="row" style={{gap:8}} onClick={event => event.stopPropagation()}>
                          <button type="button" className="btn btn--sm btn--primary" onClick={event => { event.stopPropagation(); handleOpenReport(report.id, report.pathway_id); }}>Open</button>
                          <button type="button" className="btn btn--sm" onClick={async event => {
                            event.stopPropagation();
                            try {
                              await window.OptiDxActions.downloadStoredReport?.(report.id, 'pdf');
                            } catch (error) {
                              window.OptiDxActions.showToast?.(error?.message || 'Unable to download stored report', 'error');
                            }
                          }}>PDF</button>
                          <button type="button" className="btn btn--sm" onClick={event => { event.stopPropagation(); renameReport(report); }}>Rename</button>
                          <button type="button" className="btn btn--sm" onClick={event => { event.stopPropagation(); deleteReport(report); }}>Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="stack" style={{gap:16}}>
            <div className="card card--flush">
              <div className="card__head"><h3>Pathways</h3><div className="spacer"/><span className="u-meta">{visiblePathways.length} shown</span></div>
              {visiblePathways.length === 0 ? (
                <div style={{padding:16, color:'var(--fg-3)'}}>No persisted pathways are available for the selected project.</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Pathway</th><th>Project</th><th>Status</th><th className="num">Sens</th><th className="num">Spec</th><th className="num">Cost</th><th className="num">Updated</th></tr></thead>
                  <tbody>
                    {visiblePathways.map(pathway => {
                      const hasEval = Boolean(pathway.latestEvaluationResult?.result_payload || pathway.latestEvaluationResult?.resultPayload);
                      const active = String(pathway.id) === String(selectedPathway?.id);
                      return (
                        <tr key={pathway.id} onClick={() => {
                          setSelectedPathwayKey(pathway.id);
                          onSelectPathwayId?.(pathway.id);
                          if (pathway.project_id || pathway.project?.id) setProjectFilter(String(pathway.project_id ?? pathway.project?.id));
                        }} style={{cursor:'pointer', background: active ? 'var(--sme-orange-050)' : undefined}}>
                          <td><b>{pathway.name || 'Untitled pathway'}</b><div className="u-meta">{hasEval ? 'Latest evaluation available' : 'No evaluation yet'}</div></td>
                          <td>{pathway.project?.title || pathway.project?.name || selectedProject?.title || 'Unassigned'}</td>
                          <td><span className={'chip ' + (hasEval ? 'chip--pos' : 'chip--outline')}>{hasEval ? 'Evaluated' : 'Draft'}</span></td>
                          <td className="num mono">{fmt(pathway.sens, n => `${(n * 100).toFixed(1)}%`)}</td>
                          <td className="num mono">{fmt(pathway.spec, n => `${(n * 100).toFixed(1)}%`)}</td>
                          <td className="num mono">{fmt(pathway.cost, n => `$${n.toFixed(2)}`)}</td>
                          <td className="num mono">{pathway.updated || pathway.updated_at ? String(pathway.updated || new Date(pathway.updated_at).toLocaleDateString()) : 'n/a'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!selectedPathway ? (
              <div className="card card--pad" style={{padding:32}}>
                <div className="sme-eyebrow" style={{marginBottom:8}}>No pathway selected</div>
                <h2 style={{marginBottom:8}}>Pick a project and pathway to build a report</h2>
                <p style={{color:'var(--fg-2)', maxWidth:720, lineHeight:1.6}}>Reports are generated from persisted pathway records. Select a pathway with an evaluation to enable PDF and DOCX export.</p>
              </div>
            ) : !activePreview.hasEvaluation ? (
              <div className="card card--pad" style={{padding:32}}>
                <div className="sme-eyebrow" style={{marginBottom:8}}>Report unavailable</div>
                <h2 style={{marginBottom:8}}>{activePreview.title}</h2>
                <p style={{color:'var(--fg-2)', maxWidth:720, lineHeight:1.6, marginBottom:16}}>This pathway has not been evaluated yet. Run the pathway first, then open the report page to review the generated snapshot.</p>
                <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                  <button className="btn btn--primary" onClick={() => setScreen('canvas')}><Icon name="git-branch"/>Open builder</button>
                  <button className="btn" onClick={() => setScreen('results')}><Icon name="activity"/>Open results</button>
                </div>
              </div>
            ) : (
              <div className="grid" style={{gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:12}}>
                <div className="metric metric--accent"><div className="metric__label">Sensitivity</div><div className="metric__value">{fmt(activePreview.summary.sensitivity, n => `${(n * 100).toFixed(1)}%`)}</div></div>
                <div className="metric metric--accent"><div className="metric__label">Specificity</div><div className="metric__value">{fmt(activePreview.summary.specificity, n => `${(n * 100).toFixed(1)}%`)}</div></div>
                <div className="metric metric--accent"><div className="metric__label">Expected cost</div><div className="metric__value">{fmt(activePreview.summary.expectedCost, n => `$${n.toFixed(2)}`)}</div></div>
                <div className="metric metric--accent"><div className="metric__label">Turnaround</div><div className="metric__value">{activePreview.summary.turnaround || 'n/a'}</div></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ScreenReportDetail({ setScreen, reportId, onClose, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [reportDetail, setReportDetail] = useState(null);

  const loadReport = async currentReportId => {
    if (!currentReportId) {
      return null;
    }

    setLoading(true);
    try {
      const response = await window.OptiDxActions.fetchReportRecord?.(currentReportId);
      const meta = normalizeReportMeta(response?.data?.report || response?.report || response?.data?.meta || response?.meta || response);
      const snapshot = normalizeReportSnapshot(response?.data?.data || response?.data || response?.data?.snapshot || response?.snapshot, meta);
      setReportDetail({ meta, snapshot });
      return { meta, snapshot };
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to load report', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!reportId) {
      setReportDetail(null);
      return;
    }

    void loadReport(reportId);
  }, [reportId, setScreen]);

  const snapshot = reportDetail?.snapshot || null;
  const meta = reportDetail?.meta || null;
  const title = meta?.title || snapshot?.title || 'Stored report';
  const subtitle = meta?.subtitle || snapshot?.projectLabel || 'Workspace pathway';
  const settings = snapshot?.settings || meta?.settings || {};
  const sections = Array.isArray(snapshot?.sections) ? snapshot.sections : [];
  const includeEntries = Object.entries(settings.include || {});

  const refreshDetail = async () => {
    if (!reportId) {
      return null;
    }

    return loadReport(reportId);
  };

  const renameReport = async () => {
    const currentTitle = title;
    const nextTitle = window.prompt('Rename report', currentTitle);
    const trimmed = String(nextTitle || '').trim();
    if (!trimmed || trimmed === currentTitle) {
      return;
    }

    try {
      await window.OptiDxActions.renameReportRecord?.(reportId, trimmed);
      await refreshDetail();
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to rename report', 'error');
    }
  };

  const deleteReport = async () => {
    if (!window.confirm(`Delete "${title}"? This will remove the stored snapshot and export files.`)) {
      return;
    }

    try {
      await window.OptiDxActions.deleteReportRecord?.(reportId);
      onDelete?.(reportId);
      onClose?.();
      setScreen('report');
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to delete report', 'error');
    }
  };

  const download = async format => {
    try {
      await window.OptiDxActions.downloadStoredReport?.(reportId, format);
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || `Unable to download ${format.toUpperCase()}`, 'error');
    }
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: 'OptiDx', onClick: () => setScreen('home'), title: 'Back to home' },
          { label: 'Report hub', onClick: () => { onClose?.(); setScreen('report'); }, title: 'Back to report list' },
          { label: title },
        ]}
        actions={<>
          <button className="btn" onClick={() => { onClose?.(); setScreen('report'); }}>
            <Icon name="arrow-left"/>Back to reports
          </button>
          <button className="btn" onClick={() => download('docx')}>
            <DocxLogo size={14}/>Download DOCX
          </button>
          <button className="btn btn--primary" onClick={() => download('pdf')}>
            <PdfLogo size={14}/>Download PDF
          </button>
          <button className="btn" onClick={renameReport}>
            Rename
          </button>
          <button className="btn btn--primary" onClick={deleteReport}>
            Delete
          </button>
        </>}
      />

      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Report detail</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>

        {loading && !reportDetail ? (
          <div className="card card--pad" style={{padding:32}}>Loading report snapshot...</div>
        ) : reportDetail ? (
          <div className="grid" style={{gridTemplateColumns:'320px minmax(0, 1fr)', gap:16, alignItems:'start'}}>
            <div className="stack" style={{gap:16}}>
              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Report summary</h3></div>
                <div className="stack" style={{gap:8}}>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Generated</div>
                    <div className="u-meta">{meta?.generated_at ? new Date(meta.generated_at).toLocaleString() : 'Unknown date'}</div>
                  </div>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Format</div>
                    <div className="u-meta">{meta?.format || 'pdf'}</div>
                  </div>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Project</div>
                    <div className="u-meta">{snapshot?.projectLabel || 'Workspace project'}</div>
                  </div>
                  <div className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                    <div style={{fontWeight:700, marginBottom:3}}>Warnings</div>
                    <div className="u-meta">{snapshot?.summary?.warnings ?? snapshot?.warnings?.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Report settings</h3></div>
                <div className="meta" style={{lineHeight:1.7}}>
                  <div><strong>Template:</strong> {settings.template || 'OptiDx decision report'}</div>
                  <div><strong>Organization:</strong> {settings.brand?.organization || 'Syreon'}</div>
                  <div><strong>Issuer:</strong> {settings.brand?.issuer || 'Syreon MENA HTA'}</div>
                  <div><strong>Footer:</strong> {settings.brand?.footer || "Today's research for tomorrow's health"}</div>
                  <div><strong>Primary audience:</strong> {settings.audience?.primary || 'Decision makers'}</div>
                  <div><strong>Secondary audience:</strong> {settings.audience?.secondary || 'HTA reviewers and implementation teams'}</div>
                  <div><strong>Formats:</strong> {Array.isArray(settings.output?.formats) ? settings.output.formats.join(' · ') : 'pdf · docx'}</div>
                  <div><strong>Render mode:</strong> {settings.output?.render_mode || 'HTML-first -> PDF conversion'}</div>
                  <div><strong>Access:</strong> {settings.output?.access || 'Authenticated workspace users'}</div>
                </div>
                <div className="divider"/>
                <div className="stack" style={{gap:6}}>
                  {includeEntries.length === 0 ? (
                    <div className="u-meta">No include toggles were stored for this report snapshot.</div>
                  ) : includeEntries.map(([key, value]) => (
                    <div key={key} className="row" style={{justifyContent:'space-between'}}>
                      <span>{key.replace(/_/g, ' ')}</span>
                      <span className={'chip ' + (value ? 'chip--pos' : 'chip--outline')}>{value ? 'On' : 'Off'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card--pad">
                <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Section map</h3></div>
                <div className="stack" style={{gap:8}}>
                  {sections.length === 0 ? (
                    <div className="u-meta">No section metadata was stored for this report snapshot.</div>
                  ) : sections.map(section => (
                    <div key={section.id || section.label} className="card card--pad" style={{padding:'12px 14px', background:'var(--surface-2)', border:'1px solid var(--edge)'}}>
                      <div style={{fontWeight:700, marginBottom:3}}>{section.label || section.id || 'Section'}</div>
                      <div className="u-meta">{section.description || 'No description available.'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card card--pad" style={{background:'var(--surface-3)'}}>
              <div className="card__head" style={{padding:0, marginBottom:16}}><h3>Document preview</h3><div className="spacer"/><span className="u-meta">Stored report</span></div>
              <ReportDocumentV2 preview={snapshot || { title, projectLabel: subtitle, summary: {}, paths: [], tests: [], warnings: [], settings, sections }} stored />
            </div>
          </div>
        ) : (
          <div className="card card--pad" style={{padding:32}}>The selected report could not be loaded.</div>
        )}
        {!reportId && !loading ? (
          <div className="card card--pad" style={{padding:32}}>Select a report from the hub to open its stored detail page.</div>
        ) : null}
      </div>
    </>
  );
}

function ScreenReportBuilder({ setScreen, reportId, pathwayId, onClose, onDelete }) {
  const [reportSettings, setReportSettings] = useState(() => buildDefaultReportSettings());
  const [loadedReport, setLoadedReport] = useState(null);
  const [loadingExistingReport, setLoadingExistingReport] = useState(false);
  const [workingReportId, setWorkingReportId] = useState(reportId || null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const workspacePathways = window.OptiDxActions.getWorkspacePathways?.() || [];
  const workspaceProjects = window.OptiDxActions.getWorkspaceProjects?.() || [];
  const activePathway = workspacePathways.find(item => String(item.id) === String(pathwayId || loadedReport?.snapshot?.pathway?.id || '')) || window.OptiDxLatestEvaluationPathway || null;
  const activeProjectId = activePathway?.project_id ?? activePathway?.project?.id ?? null;
  const activeProject = activeProjectId != null
    ? workspaceProjects.find(item => String(item.id) === String(activeProjectId)) || activePathway?.project || null
    : null;
  const activePreview = buildLivePreview(activePathway, activeProject);
  const title = loadedReport?.meta?.title || activePathway?.name || activePreview.title || 'Report builder';
  const subtitle = loadedReport?.meta?.subtitle || activeProject?.title || activePreview.projectLabel || 'Workspace pathway';
  const sections = Array.isArray(reportSettings.sections) ? reportSettings.sections : buildReportSections();
  const selectedAudience = reportSettings.audience?.selected || 'technical';
  const selectedFormat = reportSettings.output?.selected_format || 'pdf';
  const activeSections = sections.filter(section => section.enabled !== false).length;
  const pageCount = Math.max(1, ...sections.map(section => Number(section.page) || 1));
  const previewGeneratedSections = loadedReport?.snapshot?.generatedSections || {};
  const previewAiGeneration = loadedReport?.snapshot?.aiGeneration || null;

  useEffect(() => {
    setWorkingReportId(reportId || null);
  }, [reportId]);

  useEffect(() => {
    let active = true;

    if (!workingReportId) {
      setLoadedReport(null);
      setReportSettings(buildDefaultReportSettings());
      setLoadingExistingReport(false);
      return undefined;
    }

    setLoadingExistingReport(true);
    window.OptiDxActions.fetchReportRecord?.(workingReportId)
      .then(response => {
        if (!active) {
          return;
        }

        const meta = normalizeReportMeta(response?.data?.report || response?.report || response?.data?.meta || response?.meta || response);
        const snapshot = normalizeReportSnapshot(response?.data?.data || response?.data || response?.data?.snapshot || response?.snapshot, meta);
        setLoadedReport({ meta, snapshot });
        setReportSettings(mergeReportSettings(snapshot?.settings || meta?.settings || {}));

      })
      .catch(error => {
        if (active) {
          window.OptiDxActions.showToast?.(error?.message || 'Unable to load report settings', 'error');
          setLoadedReport(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingExistingReport(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pathwayId, workingReportId]);

  const updateAudience = audienceId => setReportSettings(current => ({
    ...current,
    audience: { ...(current.audience || {}), selected: audienceId },
  }));

  const updateFormat = formatId => setReportSettings(current => ({
    ...current,
    output: { ...(current.output || {}), selected_format: formatId },
  }));

  const toggleSection = sectionId => setReportSettings(current => ({
    ...current,
    sections: (current.sections || buildReportSections()).map(section => (
      section.id === sectionId ? { ...section, enabled: section.enabled === false ? true : false } : section
    )),
  }));

  const exportReport = async format => {
    try {
      await window.OptiDxActions.downloadReport?.(format, pathwayId || activePathway?.id, {
        ...reportSettings,
        report_id: workingReportId || null,
      });
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || `Unable to export ${format.toUpperCase()}`, 'error');
    }
  };

  const generateAiDraft = async () => {
    if (!activePathway?.id) {
      window.OptiDxActions.showToast?.('Select an evaluated pathway before generating the AI draft.', 'error');
      return;
    }

    setGeneratingAi(true);
    try {
      const response = await window.OptiDxActions.generateAiReportDraft?.(
        activePathway.id,
        reportSettings,
        workingReportId || null
      );
      const meta = normalizeReportMeta(response?.data?.report || response?.report || response?.data?.meta || response?.meta || response);
      const snapshot = normalizeReportSnapshot(response?.data?.data || response?.data || response?.data?.snapshot || response?.snapshot, meta);
      setWorkingReportId(meta?.id || workingReportId || null);
      setLoadedReport({ meta, snapshot });
      setReportSettings(mergeReportSettings(snapshot?.settings || reportSettings));
    } catch (error) {
      window.OptiDxActions.showToast?.(error?.message || 'Unable to generate the AI report draft.', 'error');
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <>
      <TopBar
        crumbs={[
          { label: 'OptiDx', onClick: () => setScreen('home'), title: 'Back to home' },
          { label: 'Report hub', onClick: () => { onClose?.(); setScreen('report'); }, title: 'Back to report list' },
          { label: title },
        ]}
        actions={<>
          <button className="btn" onClick={() => { onClose?.(); setScreen('report'); }}>
            <Icon name="arrow-left"/>Back to reports
          </button>
          <button className="btn" type="button" onClick={generateAiDraft} disabled={generatingAi}>
            <Icon name="activity"/>{generatingAi ? 'Generating AI draft...' : 'Generate AI draft'}
          </button>
          <button className="btn" onClick={() => exportReport('docx')}>
            <DocxLogo size={14}/>Generate DOCX
          </button>
          <button className="btn btn--primary" onClick={() => exportReport('pdf')}>
            <PdfLogo size={14}/>Generate PDF
          </button>
        </>}
      />

      <div className="page" style={{maxWidth:1440}}>
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Report builder</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="row" style={{gap:8, flexWrap:'wrap'}}>
            <span className="chip chip--outline">{reportSettings.audience?.options?.find(option => option.id === selectedAudience)?.label || 'Technical (HTA analyst)'}</span>
            <span className="chip chip--outline">{selectedFormat.toUpperCase()}</span>
            <span className="chip chip--outline">{activeSections} sections · {pageCount} pages</span>
          </div>
        </div>

        {loadingExistingReport ? (
          <div className="card card--pad" style={{marginBottom:16, padding:16}}>
            Loading stored report settings...
          </div>
        ) : null}
        {previewAiGeneration ? (
          <div className="card card--pad" style={{marginBottom:16, padding:16}}>
            <div className="row" style={{justifyContent:'space-between', gap:12, flexWrap:'wrap'}}>
              <div>
                <div style={{fontWeight:700, marginBottom:4}}>AI draft ready</div>
                <div className="u-meta">
                  {previewAiGeneration.model || 'OpenRouter'} · {previewAiGeneration.generated_at ? new Date(previewAiGeneration.generated_at).toLocaleString() : 'Unknown time'}
                </div>
              </div>
              <span className="chip chip--pos">{Object.keys(previewGeneratedSections).length} sections drafted</span>
            </div>
          </div>
        ) : null}

        <div className="grid" style={{gridTemplateColumns:'360px minmax(0, 1fr)', gap:16, alignItems:'start'}}>
          <div className="stack" style={{gap:16}}>
            <div className="card card--pad">
              <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Audience</h3></div>
              <div className="stack" style={{gap:8}}>
                {(reportSettings.audience?.options || []).map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className="card card--pad"
                    onClick={() => updateAudience(option.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderColor: selectedAudience === option.id ? 'var(--sme-orange)' : 'var(--edge)',
                      background: selectedAudience === option.id ? 'var(--sme-orange-050)' : 'var(--surface)',
                    }}
                  >
                    <div style={{fontWeight:700, marginBottom:4}}>{option.label}</div>
                    <div className="u-meta">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card card--pad">
              <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Format</h3></div>
              <div className="stack" style={{gap:8}}>
                {(reportSettings.output?.format_options || []).map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className="card card--pad"
                    onClick={() => updateFormat(option.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      borderColor: selectedFormat === option.id ? 'var(--sme-orange)' : 'var(--edge)',
                      background: selectedFormat === option.id ? 'var(--sme-orange-050)' : 'var(--surface)',
                    }}
                  >
                    <div style={{fontWeight:700, marginBottom:4}}>{option.label}</div>
                    <div className="u-meta">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card card--pad">
              <div className="card__head" style={{padding:0, marginBottom:12}}><h3>Sections</h3></div>
              <div className="stack" style={{gap:8}}>
                {sections.map(section => (
                  <label key={section.id} className="card card--pad" style={{padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start', cursor:'pointer'}}>
                    <input
                      type="checkbox"
                      checked={section.enabled !== false}
                      onChange={() => toggleSection(section.id)}
                      style={{accentColor:'var(--sme-orange)', marginTop:3}}
                    />
                    <div style={{minWidth:0}}>
                      <div className="row" style={{gap:8, marginBottom:3}}>
                        <div style={{fontWeight:700}}>{section.label}</div>
                        <span className="chip chip--outline">{section.page ? `p.${section.page}` : 'on'}</span>
                      </div>
                      <div className="u-meta">{section.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

            <div className="card card--pad" style={{background:'var(--surface-3)'}}>
            <div className="card__head" style={{padding:0, marginBottom:16}}>
              <h3>HTML preview</h3>
              <div className="spacer"/>
              <span className="u-meta">{previewAiGeneration ? 'AI-assisted draft' : 'Draft report'}</span>
            </div>
            <ReportDocumentV2 preview={{
              title,
              projectLabel: subtitle,
              prevalence: activePreview.prevalence,
              summary: { ...activePreview.summary, audience: selectedAudience, format: selectedFormat },
              paths: activePreview.paths,
              tests: activePreview.tests,
              warnings: activePreview.warnings,
              settings: reportSettings,
              sections,
              generatedSections: previewGeneratedSections,
              aiGeneration: previewAiGeneration,
            }} stored={false} />
          </div>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { ScreenReport, ScreenReportDetail, ScreenReportBuilder });
