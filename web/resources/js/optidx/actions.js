import axios from 'axios';

const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;

const api = axios.create({
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
  },
});

function dispatchWorkspaceEvent() {
  window.dispatchEvent(new CustomEvent('optidx-workspace-updated', {
    detail: window.OptiDxWorkspace || null,
  }));
}

function normalizeDiagnosticTestRecord(test) {
  if (!test || typeof test !== 'object') {
    return null;
  }

  const sampleTypes = Array.isArray(test.sample_types)
    ? test.sample_types.filter(Boolean)
    : test.sample
      ? [test.sample]
      : [];
  const turnaroundTime = test.turnaround_time ?? test.tat ?? null;
  const turnaroundUnit = test.turnaround_time_unit ?? test.tatUnit ?? 'min';
  const skill = test.skill_level ?? test.skill ?? null;

  return {
    id: test.id,
    name: test.name || 'Untitled test',
    category: test.category || 'clinical',
    icon: test.icon || 'flask-conical',
    cost: Number(test.cost ?? 0),
    currency: test.currency || 'USD',
    sens: Number(test.sensitivity ?? test.sens ?? 0),
    spec: Number(test.specificity ?? test.spec ?? 0),
    tat: Number(turnaroundTime ?? 0),
    tatUnit: turnaroundUnit,
    sample: sampleTypes[0] || 'none',
    sample_types: sampleTypes,
    skill: typeof skill === 'number' ? formatSkillLabel(skill) : (skill || 'Lab Tech'),
    skill_level: typeof skill === 'number' ? skill : null,
    evidence: test.provenance?.source || test.evidence || 'Workspace record',
    notes: test.notes || '',
    availability: test.availability ?? true,
    turnaround_time: turnaroundTime,
    turnaround_time_unit: turnaroundUnit,
    provenance: test.provenance || null,
  };
}

function normalizePathwayRecord(pathway) {
  if (!pathway || typeof pathway !== 'object') {
    return null;
  }

  const definition = pathway.editor_definition || pathway.engine_definition || pathway.definition || null;
  const normalized = definition ? normalizePathwayGraph(definition) : null;
  return {
    ...pathway,
    editor_definition: normalized || pathway.editor_definition || null,
    engine_definition: pathway.engine_definition || null,
    _canonical: normalized,
  };
}

function toWorkspaceIndex(items, key = 'id') {
  return Object.fromEntries(
    (Array.isArray(items) ? items : [])
      .filter(item => item && typeof item === 'object' && item[key] != null)
      .map(item => [String(item[key]), item]),
  );
}

function setWorkspaceSnapshot(partial) {
  window.OptiDxWorkspace = {
    pathways: window.OptiDxWorkspace?.pathways || [],
    tests: window.OptiDxWorkspace?.tests || [],
    settings: window.OptiDxWorkspace?.settings || [],
    pathwaysById: window.OptiDxWorkspace?.pathwaysById || {},
    testsById: window.OptiDxWorkspace?.testsById || {},
    settingsByKey: window.OptiDxWorkspace?.settingsByKey || {},
    ...window.OptiDxWorkspace,
    ...partial,
  };
  dispatchWorkspaceEvent();
  return window.OptiDxWorkspace;
}

function getWorkspacePathways() {
  return window.OptiDxWorkspace?.pathways || window.SEED_PATHWAYS || [];
}

function getWorkspaceTests() {
  return window.OptiDxWorkspace?.tests || window.SEED_TESTS || [];
}

function getWorkspaceSettings() {
  return window.OptiDxWorkspace?.settings || [];
}

function getWorkspaceSetting(key, scope = 'workspace') {
  const compoundKey = `${scope}:${key}`;
  return window.OptiDxWorkspace?.settingsByKey?.[compoundKey]?.value ?? null;
}

async function saveWorkspaceSetting(key, value, scope = 'workspace') {
  const response = await request('put', '/api/settings', {
    scope,
    key,
    value,
  });

  const nextSettings = [
    ...(getWorkspaceSettings().filter(setting => !(setting.key === key && (setting.scope || 'workspace') === scope))),
    response,
  ];

  setWorkspaceSnapshot({
    settings: nextSettings,
    settingsByKey: toWorkspaceIndex(nextSettings.map(setting => ({
      ...setting,
      compoundKey: `${setting.scope || 'workspace'}:${setting.key}`,
    })), 'compoundKey'),
  });

  return response;
}

async function loadWorkspaceData() {
  const [pathwaysResponse, testsResponse, settingsResponse] = await Promise.allSettled([
    request('get', '/api/pathways'),
    request('get', '/api/evidence/tests'),
    request('get', '/api/settings'),
  ]);

  const pathways = pathwaysResponse.status === 'fulfilled'
    ? (Array.isArray(pathwaysResponse.value) ? pathwaysResponse.value : [])
    : [];
  const tests = testsResponse.status === 'fulfilled'
    ? (Array.isArray(testsResponse.value) ? testsResponse.value : [])
    : [];
  const settings = settingsResponse.status === 'fulfilled'
    ? (Array.isArray(settingsResponse.value) ? settingsResponse.value : [])
    : [];

  const normalizedPathways = pathways.map(record => normalizePathwayRecord(record)).filter(Boolean);
  const normalizedTests = tests.map(record => normalizeDiagnosticTestRecord(record)).filter(Boolean);
  const settingsByKey = toWorkspaceIndex(settings.map(setting => ({
    ...setting,
    compoundKey: `${setting.scope || 'workspace'}:${setting.key}`,
  })), 'compoundKey');

  setWorkspaceSnapshot({
    pathways: normalizedPathways,
    tests: normalizedTests,
    settings,
    pathwaysById: toWorkspaceIndex(normalizedPathways),
    testsById: toWorkspaceIndex(normalizedTests),
    settingsByKey,
  });

  if (normalizedPathways.length) {
    window.SEED_PATHWAYS = normalizedPathways;
    if (!window.OptiDxCurrentPathwayRecord) {
      const latest = normalizedPathways[0];
      window.OptiDxCurrentPathwayRecord = latest;
      window.OptiDxCurrentPathway = latest._canonical || normalizePathwayGraph(latest.editor_definition || latest.engine_definition || latest);
      window.OptiDxCanvasDraft = window.OptiDxCurrentPathway;
      window.SEED_PATHWAY = window.OptiDxCurrentPathway;
    }
  }

  if (normalizedTests.length) {
    window.SEED_TESTS = normalizedTests;
  }

  return window.OptiDxWorkspace;
}

function ensureBlobDownload(filename, content, mimeType = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

async function request(method, url, data = undefined) {
  const response = await api.request({ method, url, data });
  return response.data;
}

function showToast(message, tone = 'info') {
  const existing = document.querySelector('[data-optidx-toast]');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.setAttribute('data-optidx-toast', 'true');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.right = '16px';
  toast.style.bottom = '16px';
  toast.style.zIndex = '2000';
  toast.style.maxWidth = '360px';
  toast.style.padding = '12px 14px';
  toast.style.borderRadius = '8px';
  toast.style.boxShadow = '0 18px 40px rgba(17, 24, 39, 0.22)';
  toast.style.font = '600 13px/1.4 inherit';
  toast.style.color = tone === 'error' ? '#fff' : '#172026';
  toast.style.background = tone === 'error'
    ? 'rgba(176, 40, 30, 0.96)'
    : tone === 'success'
      ? 'rgba(231, 248, 236, 0.98)'
      : 'rgba(255, 255, 255, 0.98)';
  toast.style.border = tone === 'error'
    ? '1px solid rgba(176, 40, 30, 0.65)'
    : '1px solid rgba(226, 228, 230, 0.95)';
  document.body.appendChild(toast);

  window.clearTimeout(window.__optidxToastTimer);
  window.__optidxToastTimer = window.setTimeout(() => {
    toast.remove();
  }, 2400);
}

function normalizeTAT(value, unit) {
  if (value == null) {
    return 'n/a';
  }

  const n = Number(value);
  if (Number.isNaN(n)) {
    return String(value);
  }

  if (unit === 'min') return `${n} min`;
  if (unit === 'hr' || unit === 'h') return `${n} h`;
  if (unit === 'day' || unit === 'days') return `${n} d`;
  return `${n} ${unit || ''}`.trim();
}

function formatSkillLabel(level) {
  if (level == null || level === '') {
    return 'n/a';
  }

  const numeric = Number(level);
  if (Number.isNaN(numeric)) {
    return String(level);
  }

  const labels = {
    1: 'CHW / self',
    2: 'Nurse',
    3: 'Lab tech',
    4: 'Specialist',
    5: 'Specialist',
  };

  return labels[numeric] || `Skill ${numeric}`;
}

function formatPathSequence(outcomes) {
  const entries = Object.entries(outcomes || {});
  if (!entries.length) {
    return 'No test outcomes';
  }

  return entries
    .map(([testId, outcome]) => `${testId}(${outcome === 'pos' ? '+' : '-'})`)
    .join(' → ');
}

function buildPathRowsFromEvaluation(metrics) {
  const present = Array.isArray(metrics?.paths_disease_present) ? metrics.paths_disease_present : [];
  const absent = Array.isArray(metrics?.paths_disease_absent) ? metrics.paths_disease_absent : [];
  const rows = [...present.map(path => ({ ...path, cohort: 'D+' })), ...absent.map(path => ({ ...path, cohort: 'D-' }))];

  return rows.map((path, index) => {
    const positive = path.final_classification === 'positive';
    return {
      id: `P${index + 1}`,
      sequence: formatPathSequence(path.outcomes),
      terminal: positive ? 'Positive result' : 'Negative result',
      terminalKind: positive ? 'pos' : 'neg',
      pIfD: Number(path.cohort === 'D+' ? path.probability ?? 0 : 0),
      pIfND: Number(path.cohort === 'D-' ? path.probability ?? 0 : 0),
      cost: Number(path.cost ?? 0),
      tat: normalizeTAT(path.turnaround_time, 'hr'),
      samples: Array.isArray(path.sample_types) && path.sample_types.length ? path.sample_types.join(' · ') : 'n/a',
      skill: formatSkillLabel(path.skill_level),
      cohort: path.cohort,
    };
  });
}

function buildEvaluationView(result) {
  const metrics = result?.metrics || {};
  const sensitivity = Number(metrics.sensitivity ?? 0);
  const specificity = Number(metrics.specificity ?? 0);
  const falseNegativeRate = Number(metrics.false_negative_rate ?? (1 - sensitivity));
  const falsePositiveRate = Number(metrics.false_positive_rate ?? (1 - specificity));
  const warnings = [];

  if (Array.isArray(metrics.warnings)) {
    metrics.warnings.forEach(text => warnings.push({ kind: 'info', text }));
  }

  if (Array.isArray(metrics.assumptions)) {
    metrics.assumptions.forEach(text => warnings.push({ kind: 'info', text }));
  }

  if (Array.isArray(result?.validation?.warnings)) {
    result.validation.warnings.forEach(text => warnings.push({ kind: 'warn', text }));
  }

  return {
    sens: sensitivity,
    spec: specificity,
    fnr: falseNegativeRate,
    fpr: falsePositiveRate,
    cost: Number(metrics.expected_cost_population ?? metrics.expected_cost_given_disease ?? 0),
    tat: normalizeTAT(metrics.expected_turnaround_time_population ?? metrics.expected_turnaround_time_given_disease ?? null, 'hr'),
    ppv: Number(metrics.ppv ?? 0),
    npv: Number(metrics.npv ?? 0),
    prevalence: result?.prevalence ?? null,
    warnings,
    paths: buildPathRowsFromEvaluation(metrics),
    metrics,
    source: result,
  };
}

function collectCanvasTests(pathway) {
  const nodes = Array.isArray(pathway?.nodes) ? pathway.nodes : [];
  const tests = new Map();

  for (const node of nodes) {
    if (node?.type === 'test' && node.testId) {
      const test = window.SEED_TESTS?.find(item => item.id === node.testId);
      if (!test) continue;
      tests.set(test.id, {
        id: test.id,
        name: test.name,
        sensitivity: test.sens,
        specificity: test.spec,
        turnaround_time: test.tat,
        turnaround_time_unit: test.tatUnit,
        sample_types: [test.sample],
        skill_level: test.skill,
        cost: test.cost,
        category: test.category,
      });
    }

    if (node?.type === 'parallel') {
      for (const member of node.members || []) {
        const test = window.SEED_TESTS?.find(item => item.id === member?.testId);
        if (!test) continue;
        tests.set(test.id, {
          id: test.id,
          name: test.name,
          sensitivity: test.sens,
          specificity: test.spec,
          turnaround_time: test.tat,
          turnaround_time_unit: test.tatUnit,
          sample_types: [test.sample],
          skill_level: test.skill,
          cost: test.cost,
          category: test.category,
        });
      }
    }
  }

  return Object.fromEntries(tests.entries());
}

function normalizeGraphItems(value) {
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object');
  }

  if (value && typeof value === 'object') {
    return Object.values(value).filter(item => item && typeof item === 'object');
  }

  return [];
}

function detectStartNode(nodes, edges) {
  const startNode = nodes.find(node => node?.type !== 'annotation' && !edges.some(edge => edge.to === node.id))?.id
    || nodes.find(node => node?.type !== 'annotation')?.id
    || 'n1';

  return startNode;
}

function normalizePathwayGraph(pathway) {
  const graph = pathway?.editor_definition || pathway?.engine_definition || pathway || {};
  const nodes = normalizeGraphItems(graph.nodes);
  const edges = normalizeGraphItems(graph.edges);
  const tests = normalizeGraphItems(graph.tests);

  return {
    schema_version: graph.schema_version || 'canvas-v1',
    start_node: graph.start_node || graph.startNode || detectStartNode(nodes, edges),
    metadata: graph.metadata || {},
    tests: Object.fromEntries(tests.filter(test => test.id).map(test => [test.id, { ...test }])),
    nodes: Object.fromEntries(nodes.filter(node => node.id).map(node => [node.id, {
      ...node,
      members: Array.isArray(node.members) ? node.members.map(member => ({ ...member })) : node.members ?? null,
    }])),
    edges: edges
      .filter(edge => edge.from && edge.to)
      .map(edge => ({ ...edge })),
  };
}

function getActivePathwayRecord() {
  return window.OptiDxCurrentPathwayRecord || null;
}

function setActivePathwayRecord(record) {
  window.OptiDxCurrentPathwayRecord = record || null;
  if (record) {
    const canonical = record._canonical || normalizePathwayGraph(record.editor_definition || record.engine_definition || record);
    window.OptiDxCurrentPathway = canonical;
    window.OptiDxCanvasDraft = canonical;
    window.SEED_PATHWAY = canonical;
  }
  return record || null;
}

function setActivePathwayDraft(pathway) {
  const canonical = normalizePathwayGraph(pathway);
  window.OptiDxCurrentPathway = canonical;
  window.OptiDxCanvasDraft = canonical;
  window.SEED_PATHWAY = canonical;
  return canonical;
}

function buildCanonicalPathway(source = null) {
  const nodes = Array.isArray(source?.nodes)
    ? source.nodes
    : Array.isArray(window.OptiDxCanvasState?.nodes)
      ? window.OptiDxCanvasState.nodes
      : Array.isArray(window.SEED_NODES)
        ? window.SEED_NODES
        : [];
  const edges = Array.isArray(source?.edges)
    ? source.edges
    : Array.isArray(window.OptiDxCanvasState?.edges)
      ? window.OptiDxCanvasState.edges
      : Array.isArray(window.SEED_EDGES)
        ? window.SEED_EDGES
        : [];
  const metadata = source?.metadata || window.OptiDxCanvasMeta || {};

  return {
    schema_version: source?.schema_version || 'canvas-v1',
    start_node: source?.start_node || source?.startNode || detectStartNode(nodes, edges),
    tests: collectCanvasTests({ nodes }),
    nodes: Object.fromEntries(nodes.map(node => [node.id, {
      id: node.id,
      type: node.type,
      testId: node.testId ?? null,
      label: node.label ?? null,
      kind: node.kind ?? null,
      subtype: node.subtype ?? null,
      members: node.members?.map(member => ({ ...member })) ?? null,
      text: node.text ?? null,
      x: node.x,
      y: node.y,
      rule: node.rule ?? null,
    }])),
    edges: edges.map(edge => ({ ...edge })),
    metadata: {
      label: metadata.label || 'TB Community Screening',
      source: metadata.source || 'Builder canvas',
      disease: metadata.disease || null,
    },
  };
}

async function savePathway(pathway = null) {
  const payload = normalizePathwayGraph(pathway || window.OptiDxCurrentPathway || buildCanonicalPathway());
  const name = payload?.metadata?.label || 'Builder pathway';
  const currentRecord = getActivePathwayRecord();
  const response = currentRecord?.id
    ? await request('put', `/api/pathways/${currentRecord.id}`, {
        project_id: currentRecord.project_id ?? null,
        name,
        editor_definition: payload,
        schema_version: payload?.schema_version || 'canvas-v1',
        start_node_id: payload?.start_node || null,
        metadata: payload?.metadata || {},
      })
    : await request('post', '/api/pathways', {
      name,
      editor_definition: payload,
      schema_version: payload?.schema_version || 'canvas-v1',
      start_node_id: payload?.start_node || null,
      metadata: payload?.metadata || {},
    });

  window.OptiDxSavedPathway = response;
  window.OptiDxCurrentPathwayRecord = normalizePathwayRecord(response);
  setActivePathwayDraft(response?.editor_definition || payload);
  showToast(`Saved "${name}"`, 'success');
  return response;
}

function scenarioTitle(index, label) {
  if (label) return label;
  const titles = ['Cost-optimal', 'Balanced MCDA', 'Sensitivity-maximal', 'Specificity-maximal', 'Fastest TAT', 'Low-resource'];
  return titles[index] || `Candidate ${index + 1}`;
}

function buildOptimizationScenarios(result) {
  const ranked = Array.isArray(result?.ranked_results) ? result.ranked_results : [];
  return ranked.slice(0, 6).map((entry, index) => {
    const metrics = entry?.metrics || {};
    const sens = Number(metrics.sensitivity ?? 0);
    const spec = Number(metrics.specificity ?? 0);
    const cost = Number(metrics.expected_cost_population ?? metrics.expected_cost_given_disease ?? 0);
    const tat = metrics.expected_turnaround_time_population ?? metrics.expected_turnaround_time_given_disease ?? null;
    const cpdc = sens > 0 ? cost / Math.max(sens * 0.08, 0.001) : cost;
    const pathway = entry?.pathway || {};
    const testNames = Object.keys(pathway.tests || {});

    return {
      id: String.fromCharCode(65 + index),
      label: scenarioTitle(index, entry?.label),
      sens,
      spec,
      cost,
      cpdc,
      tat: normalizeTAT(tat, 'hr'),
      notes: entry?.warnings?.[0] || `Backend-ranked candidate ${index + 1}.`,
      tests: testNames.map(id => window.SEED_TESTS?.find(test => test.id === id)?.name || id),
      trade: index === 0
        ? 'Top ranked by expected population cost'
        : index === 1
          ? 'Balanced trade-off candidate'
          : 'Pareto frontier candidate',
      tag: index === 0
        ? 'Best feasible cost'
        : index === 1
          ? 'Closest balanced option'
          : 'Optimizer output',
      pathway: pathway && Object.keys(pathway).length ? normalizePathwayGraph(pathway) : null,
    };
  });
}

async function addManualTest() {
  const name = window.prompt("Name the new diagnostic test:");
  if (!name) {
    return null;
  }

  const cleaned = name.trim();
  if (!cleaned) {
    return null;
  }

  const test = await request('post', '/api/evidence/tests', {
    name: cleaned,
    category: "clinical",
    sensitivity: 0.8,
    specificity: 0.8,
    cost: 1.0,
    currency: "USD",
    turnaround_time: 15,
    turnaround_time_unit: "min",
    sample_types: ["blood"],
    skill_level: 3,
    notes: "User-defined test.",
    availability: true,
    provenance: { source: "Manual entry" },
  });

  const normalized = normalizeDiagnosticTestRecord(test);
  const nextTests = [...getWorkspaceTests(), normalized];
  window.SEED_TESTS = nextTests;
  setWorkspaceSnapshot({
    tests: nextTests,
    testsById: toWorkspaceIndex(nextTests),
  });
  showToast(`Added "${cleaned}" to the library`, 'success');
  return normalized;
}

async function optimizePathways(payload) {
  const response = await request('post', '/api/pathways/optimize', payload);
  window.OptiDxOptimizationResults = response;
  window.OptiDxOptimizationScenarios = buildOptimizationScenarios(response);
  showToast(`Optimization finished with ${response?.candidate_count ?? 0} candidates`, 'success');
  return response;
}

async function evaluatePathway(pathway = null, prevalence = null) {
  const canonicalPathway = normalizePathwayGraph(pathway || buildCanonicalPathway());
  const payload = {
    pathway: canonicalPathway,
    pathway_id: getActivePathwayRecord()?.id || null,
  };

  if (prevalence !== null && prevalence !== undefined) {
    payload.prevalence = prevalence;
  }

  const response = await request('post', '/api/pathways/evaluate', payload);
  window.OptiDxLatestEvaluationResult = response;
  window.OptiDxLatestEvaluationPathway = canonicalPathway;
  window.OptiDxLatestEvaluationView = buildEvaluationView(response);
  if (response?.pathway) {
    window.OptiDxCurrentPathwayRecord = normalizePathwayRecord(response.pathway);
  }
  showToast('Pathway evaluation finished', 'success');
  return response;
}

async function loadPathwayIntoWorkspace(pathway) {
  const response = await request('post', '/api/pathways/import', { pathway });
  const canonical = normalizePathwayGraph(response?.editor_definition || response);
  window.OptiDxImportedPathway = response;
  window.OptiDxCurrentPathwayRecord = normalizePathwayRecord(response);
  setActivePathwayDraft(canonical);
  window.dispatchEvent(new CustomEvent('optidx-pathway-loaded', { detail: canonical }));
  showToast(`Imported "${canonical.metadata?.label || 'pathway'}"`, 'success');
  return response;
}

async function openPathwayRecord(pathway) {
  if (!pathway) {
    return null;
  }

  const record = pathway.editor_definition || pathway.engine_definition ? pathway : await request('get', `/api/pathways/${pathway.id}`);
  const normalized = normalizePathwayRecord(record);
  window.OptiDxCurrentPathwayRecord = normalized;
  setActivePathwayDraft(normalized._canonical || normalized.editor_definition || normalized);
  window.dispatchEvent(new CustomEvent('optidx-pathway-loaded', { detail: window.OptiDxCurrentPathway }));
  return normalized;
}

async function duplicatePathwayRecord(pathway) {
  const record = normalizePathwayRecord(pathway || getActivePathwayRecord());
  if (!record) {
    return null;
  }

  const copyName = `${record.name || record.metadata?.label || 'Untitled pathway'} Copy`;
  const response = await request('post', '/api/pathways', {
    project_id: record.project_id ?? null,
    name: copyName,
    editor_definition: record.editor_definition || record._canonical || buildCanonicalPathway(),
    schema_version: record.schema_version || 'canvas-v1',
    start_node_id: record.start_node_id || record.editor_definition?.start_node || null,
    metadata: {
      ...(record.metadata || {}),
      label: copyName,
      source: record.metadata?.source || 'Duplicate pathway',
    },
  });

  const normalized = normalizePathwayRecord(response);
  const existing = getWorkspacePathways().filter(item => String(item.id) !== String(normalized.id));
  const nextPathways = [normalized, ...existing];
  window.SEED_PATHWAYS = nextPathways;
  setWorkspaceSnapshot({
    pathways: nextPathways,
    pathwaysById: toWorkspaceIndex(nextPathways),
  });
  return normalized;
}

async function importEvidenceTest(test) {
  if (!test || typeof test !== 'object') {
    return null;
  }

  const payload = {
    name: test.name || 'Imported evidence test',
    category: test.category || 'clinical',
    sensitivity: Number(test.sens ?? test.sensitivity ?? 0),
    specificity: Number(test.spec ?? test.specificity ?? 0),
    cost: Number(test.cost ?? 0),
    currency: test.currency || 'USD',
    turnaround_time: Number(test.tat ?? test.turnaround_time ?? 0),
    turnaround_time_unit: test.tatUnit || test.turnaround_time_unit || 'min',
    sample_types: Array.isArray(test.sample_types) ? test.sample_types : test.sample ? [test.sample] : [],
    skill_level: test.skill_level ?? test.skill ?? 3,
    notes: test.notes || test.evidence || 'Imported from evidence library.',
    availability: true,
    provenance: {
      source: test.source || test.provenance?.source || 'Evidence library',
      country: test.country || null,
      year: test.year || null,
    },
  };

  const response = await request('post', '/api/evidence/tests', payload);
  const normalized = normalizeDiagnosticTestRecord(response);
  const existing = getWorkspaceTests().filter(item => String(item.id) !== String(normalized.id));
  const nextTests = [normalized, ...existing];
  window.SEED_TESTS = nextTests;
  setWorkspaceSnapshot({
    tests: nextTests,
    testsById: toWorkspaceIndex(nextTests),
  });
  showToast(`Imported "${normalized.name}"`, 'success');
  return normalized;
}

async function downloadReport(format = 'pdf') {
  const pathwayId = getActivePathwayRecord()?.id || window.OptiDxLatestEvaluationPathway?.id;
  if (!pathwayId) {
    showToast('Save or run a pathway before exporting a report.', 'error');
    return null;
  }

  const response = await api.request({
    method: 'get',
    url: `/api/pathways/${pathwayId}/export/report`,
    params: { format },
    responseType: 'blob',
  });

  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `optidx-report.${format}`;
  ensureBlobDownload(filename, response.data, response.headers?.['content-type'] || 'application/octet-stream');
  return response.data;
}

function copyShareLink(url = window.location.origin + '/?screen=results') {
  return copyText(url);
}

function importJsonFile(onParsed) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result ?? '{}'));
          Promise.resolve(onParsed?.(parsed))
            .then(() => resolve(parsed))
            .catch(reject);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

function comingSoon(label) {
  showToast(`${label} is available in a later beta.`, 'info');
}

window.OptiDxActions = {
  api,
  request,
  loadWorkspaceData,
  getWorkspacePathways,
  getWorkspaceTests,
  getWorkspaceSettings,
  getWorkspaceSetting,
  saveWorkspaceSetting,
  setWorkspaceSnapshot,
  getActivePathwayRecord,
  setActivePathwayRecord,
  setActivePathwayDraft,
  showToast,
  copyText,
  copyShareLink,
  ensureBlobDownload,
  buildCanonicalPathway,
  normalizePathwayGraph,
  loadPathwayIntoWorkspace,
  openPathwayRecord,
  savePathway,
  optimizePathways,
  evaluatePathway,
  buildEvaluationView,
  buildOptimizationScenarios,
  addManualTest,
  duplicatePathwayRecord,
  importEvidenceTest,
  downloadReport,
  downloadJson(filename, data) {
    ensureBlobDownload(filename, JSON.stringify(data, null, 2), 'application/json');
  },
  downloadText(filename, text) {
    ensureBlobDownload(filename, text, 'text/plain;charset=utf-8');
  },
  importJsonFile,
  comingSoon,
};
