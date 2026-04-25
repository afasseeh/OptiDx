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

function setCsrfToken(token) {
  if (!token) {
    return;
  }

  api.defaults.headers.common['X-CSRF-TOKEN'] = token;

  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    meta.setAttribute('content', token);
  }
}

async function refreshCsrfToken() {
  const response = await api.get('/');
  const html = typeof response.data === 'string' ? response.data : '';
  const match = html.match(/<meta name="csrf-token" content="([^"]+)">/i);
  const token = match?.[1] || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || null;

  if (!token) {
    throw new Error('Unable to refresh CSRF token.');
  }

  setCsrfToken(token);
  return token;
}

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
      setActivePathwayDraft(latest._canonical || latest.editor_definition || latest.engine_definition || latest);
    }
  } else {
    setActivePathwayDraft(createStarterCanvasGraph());
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
  try {
    const response = await api.request({ method, url, data });
    return response.data;
  } catch (error) {
    if (error?.response?.status === 419 && !error.config?._optidxCsrfRetried) {
      try {
        await refreshCsrfToken();
        const retryConfig = {
          ...error.config,
          headers: {
            ...(error.config?.headers || {}),
            'X-CSRF-TOKEN': api.defaults.headers.common['X-CSRF-TOKEN'],
          },
          _optidxCsrfRetried: true,
        };
        const retryResponse = await api.request({
          ...retryConfig,
        });
        return retryResponse.data;
      } catch (retryError) {
        error = retryError;
      }
    }

    const payload = error?.response?.data;
    const validationErrors = payload?.validation?.errors;
    const message = Array.isArray(validationErrors) && validationErrors.length
      ? validationErrors.join(' ')
      : payload?.message || error?.message || 'Request failed.';

    const wrapped = new Error(message);
    wrapped.cause = error;
    wrapped.response = error?.response;
    wrapped.payload = payload;
    throw wrapped;
  }
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

  const display = Number.parseFloat(n.toFixed(2)).toString();

  if (unit === 'min') return `${display} min`;
  if (unit === 'hr' || unit === 'h') return `${display} h`;
  if (unit === 'day' || unit === 'days') return `${display} d`;
  return `${display} ${unit || ''}`.trim();
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

function parseSkillLevel(value) {
  if (value == null || value === '') {
    return 3;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(5, Math.round(value)));
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, Math.min(5, Math.round(numeric)));
  }

  const label = String(value).toLowerCase();
  if (label.includes('chw') || label.includes('self')) return 1;
  if (label.includes('nurse')) return 2;
  if (label.includes('lab')) return 3;
  if (label.includes('radiolog') || label.includes('specialist')) return 4;
  return 3;
}

function buildDiagnosticTestPayload(test = {}) {
  const sampleTypes = Array.isArray(test.sample_types)
    ? test.sample_types.filter(Boolean)
    : typeof test.sample_types === 'string'
      ? test.sample_types.split(',').map(item => item.trim()).filter(Boolean)
      : test.sample
        ? [test.sample]
        : [];
  const provenance = test.provenance && typeof test.provenance === 'object' ? test.provenance : {};

  return {
    project_id: test.project_id ?? null,
    name: String(test.name || test.test || test.label || test.title || 'Untitled test').trim(),
    category: test.category || 'clinical',
    sensitivity: Number(test.sensitivity ?? test.sens ?? 0),
    specificity: Number(test.specificity ?? test.spec ?? 0),
    cost: Number(test.cost ?? 0),
    currency: test.currency || 'USD',
    turnaround_time: Number(test.turnaround_time ?? test.tat ?? 0),
    turnaround_time_unit: test.turnaround_time_unit || test.tatUnit || 'min',
    sample_types: sampleTypes,
    skill_level: parseSkillLevel(test.skill_level ?? test.skill ?? test.skill_label),
    threshold: test.threshold || null,
    availability: test.availability ?? true,
    capacity_limit: test.capacity_limit ?? null,
    notes: test.notes || test.evidence || '',
    provenance: {
      source: test.source || provenance.source || 'Workspace record',
      country: test.country || provenance.country || null,
      year: test.year || provenance.year || null,
    },
    joint_probabilities: test.joint_probabilities || null,
    conditional_probabilities: test.conditional_probabilities || null,
  };
}

function isPersistedDiagnosticTestId(id) {
  return /^\d+$/.test(String(id ?? ''));
}

function formatDurationHours(value) {
  if (value == null || value === '') {
    return 'n/a';
  }

  const hours = Number(value);
  if (Number.isNaN(hours)) {
    return String(value);
  }

  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const days = Math.floor(totalMinutes / 1440);
  const remainingMinutes = totalMinutes % 1440;
  const hrs = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days} d`);
  if (hrs) parts.push(`${hrs} h`);
  if (!parts.length || mins) parts.push(`${mins} m`);

  return parts.join(' ');
}

function toHours(value, unit) {
  const numeric = Number(value ?? 0);
  const normalizedUnit = String(unit || 'hr').toLowerCase();

  if (Number.isNaN(numeric)) {
    return 0;
  }

  if (normalizedUnit === 'min' || normalizedUnit === 'minute' || normalizedUnit === 'minutes') {
    return numeric / 60;
  }

  if (normalizedUnit === 'day' || normalizedUnit === 'days' || normalizedUnit === 'd') {
    return numeric * 24;
  }

  if (normalizedUnit === 'week' || normalizedUnit === 'weeks' || normalizedUnit === 'w') {
    return numeric * 168;
  }

  return numeric;
}

function resolvePathwayTestCatalog(pathway) {
  const nodes = normalizeGraphItems(pathway?.nodes);
  const testsMap = pathway?.tests || {};
  const entries = [];
  const labelCounts = new Map();

  const addEntry = (key, testId, label, payload = {}) => {
    if (!key || !testId) {
      return;
    }

    const baseLabel = label || testId;
    const count = (labelCounts.get(baseLabel) || 0) + 1;
    labelCounts.set(baseLabel, count);

    entries.push({
      key: String(key),
      testId: String(testId),
      label: count > 1 ? `${baseLabel} #${count}` : baseLabel,
      baseLabel,
      cost: Number(payload.cost ?? 0),
      tatHours: Number(payload.tatHours ?? 0),
      tatLabel: payload.tatLabel ?? formatDurationHours(payload.tatHours ?? 0),
      sample: payload.sample ?? 'n/a',
      skill: payload.skill ?? 'n/a',
      category: payload.category ?? null,
    });
  };

  for (const node of nodes) {
    if (node?.type === 'test' && node.testId) {
      const test = testsMap[node.testId] || window.SEED_TESTS?.find(x => x.id === node.testId) || {};
      const tatHours = toHours(test.turnaround_time ?? test.tat ?? 0, test.turnaround_time_unit ?? test.tatUnit ?? 'hr');
      addEntry(node.testId, node.testId, test.name || node.label || node.testId, {
        cost: Number(test.cost ?? 0),
        tatHours,
        tatLabel: formatDurationHours(tatHours),
        sample: Array.isArray(test.sample_types) ? test.sample_types.filter(Boolean)[0] || test.sample || 'n/a' : test.sample || 'n/a',
        skill: typeof test.skill_level === 'number' ? formatSkillLabel(test.skill_level) : (test.skill || 'n/a'),
        category: test.category || null,
      });
    }

    if (node?.type === 'parallel') {
      for (const [index, member] of (node.members || []).entries()) {
        if (!member?.testId) {
          continue;
        }

        const test = testsMap[member.testId] || window.SEED_TESTS?.find(x => x.id === member.testId) || {};
        const tatHours = toHours(test.turnaround_time ?? test.tat ?? 0, test.turnaround_time_unit ?? test.tatUnit ?? 'hr');
        const alias = member.id || `${node.id}__member_${index + 1}__${member.testId}`;
        addEntry(alias, member.testId, test.name || member.testId, {
          cost: Number(test.cost ?? 0),
          tatHours,
          tatLabel: formatDurationHours(tatHours),
          sample: Array.isArray(test.sample_types) ? test.sample_types.filter(Boolean)[0] || test.sample || 'n/a' : test.sample || 'n/a',
          skill: typeof test.skill_level === 'number' ? formatSkillLabel(test.skill_level) : (test.skill || 'n/a'),
          category: test.category || null,
        });
      }
    }
  }

  return entries;
}

function formatPathSequence(outcomes, catalog = []) {
  const entries = Object.entries(outcomes || {});
  if (!entries.length) {
    return 'No test outcomes';
  }

  const lookup = new Map(catalog.map(entry => [String(entry.key), entry]));
  const labelUsage = new Map();

  return entries
    .map(([testId, outcome]) => {
      const entry = lookup.get(String(testId));
      const baseLabel = entry?.label || String(testId).replace(/[-_]+/g, ' ');
      const count = (labelUsage.get(baseLabel) || 0) + 1;
      labelUsage.set(baseLabel, count);
      const label = count > 1 ? `${baseLabel} #${count}` : baseLabel;
      return `${label}(${outcome === 'pos' ? '+' : '-'})`;
    })
    .join(' -> ');
}

function buildPathRowsFromEvaluation(metrics) {
  const pathway = metrics?.pathway?.editor_definition
    || metrics?.pathway?.engine_definition
    || metrics?.pathway
    || window.OptiDxLatestEvaluationPathway
    || window.OptiDxCurrentPathway
    || null;
  const catalog = resolvePathwayTestCatalog(pathway);
  const present = Array.isArray(metrics?.paths_disease_present) ? metrics.paths_disease_present : [];
  const absent = Array.isArray(metrics?.paths_disease_absent) ? metrics.paths_disease_absent : [];
  const prevalence = metrics?.prevalence != null ? Number(metrics.prevalence) : null;
  const uniqueRows = new Map();

  const addPath = (path, cohort) => {
    const outcomes = path?.outcomes || {};
    const signature = JSON.stringify(Object.entries(outcomes).sort(([a], [b]) => String(a).localeCompare(String(b))));
    const probability = Number(path?.probability ?? 0);
    let row = uniqueRows.get(signature);

    if (!row) {
      const positive = path?.final_classification === 'positive';
      row = {
        id: `P${uniqueRows.size + 1}`,
        sequence: formatPathSequence(outcomes, catalog),
        terminal: positive ? 'Positive result' : 'Negative result',
        terminalKind: positive ? 'pos' : 'neg',
        pIfD: 0,
        pIfND: 0,
        cost: Number(path?.cost ?? 0),
        tatHours: Number(path?.turnaround_time ?? 0),
        tat: formatDurationHours(path?.turnaround_time ?? 0),
        samples: Array.isArray(path?.sample_types) && path.sample_types.length ? path.sample_types.join(' · ') : 'n/a',
        skill: formatSkillLabel(path?.skill_level),
        cohort,
        outcomeKeys: Object.keys(outcomes),
      };
      uniqueRows.set(signature, row);
    }

    if (cohort === 'D+') {
      row.pIfD += probability;
    } else {
      row.pIfND += probability;
    }
  };

  present.forEach(path => addPath(path, 'D+'));
  absent.forEach(path => addPath(path, 'D-'));

  return Array.from(uniqueRows.values()).map(row => ({
    ...row,
    probability: prevalence != null
      ? (prevalence * row.pIfD) + ((1 - prevalence) * row.pIfND)
      : (row.pIfD + row.pIfND) / 2,
  }));
}

function buildEvaluationView(result) {
  const metrics = result?.metrics || {};
  const sensitivity = Number(metrics.sensitivity ?? 0);
  const specificity = Number(metrics.specificity ?? 0);
  const falseNegativeRate = Number(metrics.false_negative_rate ?? (1 - sensitivity));
  const falsePositiveRate = Number(metrics.false_positive_rate ?? (1 - specificity));
  const pathwaySource = result?.pathway?.editor_definition
    || result?.pathway?.engine_definition
    || result?.pathway
    || window.OptiDxLatestEvaluationPathway
    || null;
  const pathRows = buildPathRowsFromEvaluation({
    ...metrics,
    pathway: pathwaySource,
    prevalence: result?.prevalence ?? null,
  });
  const totalWeight = pathRows.reduce((sum, path) => sum + Number(path.probability ?? 0), 0) || 1;
  const weightedTatHours = pathRows.reduce((sum, path) => sum + (Number(path.probability ?? 0) * Number(path.tatHours ?? 0)), 0) / totalWeight;
  const minTatHours = pathRows.length ? Math.min(...pathRows.map(path => Number(path.tatHours ?? 0))) : null;
  const maxTatHours = pathRows.length ? Math.max(...pathRows.map(path => Number(path.tatHours ?? 0))) : null;
  const catalog = resolvePathwayTestCatalog(pathwaySource);
  const warnings = [];
  const seenWarnings = new Set();
  const addWarning = (kind, text) => {
    const normalized = String(text || '').trim();
    if (!normalized || seenWarnings.has(normalized)) {
      return;
    }
    seenWarnings.add(normalized);
    warnings.push({ kind, text: normalized });
  };

  if (Array.isArray(metrics.warnings)) {
    metrics.warnings.forEach(text => addWarning('info', text));
  }

  if (Array.isArray(metrics.assumptions)) {
    metrics.assumptions.forEach(text => addWarning('info', text));
  }

  if (Array.isArray(result?.validation?.warnings)) {
    result.validation.warnings.forEach(text => addWarning('warn', text));
  }

  const testContributions = catalog.map(entry => {
    const probability = pathRows.reduce((sum, path) => (
      path.outcomeKeys?.includes(entry.key) ? sum + Number(path.probability ?? 0) : sum
    ), 0);

    return {
      ...entry,
      weight: probability,
      contribution: probability * Number(entry.cost ?? 0),
    };
  }).filter(entry => Number.isFinite(entry.contribution)).sort((a, b) => b.contribution - a.contribution);

  return {
    sens: sensitivity,
    spec: specificity,
    fnr: falseNegativeRate,
    fpr: falsePositiveRate,
    cost: Number(metrics.expected_cost_population ?? metrics.expected_cost_given_disease ?? 0),
    tat: formatDurationHours(weightedTatHours),
    tatAverageHours: weightedTatHours,
    tatAverageLabel: formatDurationHours(weightedTatHours),
    tatMinHours: minTatHours,
    tatMinLabel: formatDurationHours(minTatHours),
    tatMaxHours: maxTatHours,
    tatMaxLabel: formatDurationHours(maxTatHours),
    ppv: Number(metrics.ppv ?? 0),
    npv: Number(metrics.npv ?? 0),
    prevalence: result?.prevalence ?? null,
    warnings,
    pathCount: pathRows.length,
    paths: pathRows,
    testContributions,
    summary: {
      pathCount: pathRows.length,
      expectedCost: Number(metrics.expected_cost_population ?? metrics.expected_cost_given_disease ?? 0),
      expectedTatHours: weightedTatHours,
      expectedTatLabel: formatDurationHours(weightedTatHours),
      minTatHours,
      minTatLabel: formatDurationHours(minTatHours),
      maxTatHours,
      maxTatLabel: formatDurationHours(maxTatHours),
    },
    metrics,
    source: result,
  };
}

function snapshotCanvasTestRecord(test, fallbackLabel = null) {
  const source = typeof test === 'string'
    ? getWorkspaceTests().find(item => String(item.id) === String(test)) || null
    : test && typeof test === 'object'
      ? test
      : null;

  const fallback = source || {};
  const resolvedId = String(
    fallback.testId
    ?? fallback.id
    ?? test
    ?? fallbackLabel
    ?? 'test'
  );
  const name = fallback.name || fallback.label || fallback.test || fallbackLabel || resolvedId;
  const sensitivity = Number(fallback.sens ?? fallback.sensitivity ?? 0);
  const specificity = Number(fallback.spec ?? fallback.specificity ?? 0);
  const turnaroundTime = Number(fallback.tat ?? fallback.turnaround_time ?? 0);
  const cost = Number(fallback.cost ?? 0);

  return {
    id: resolvedId,
    name,
    sensitivity: Number.isFinite(sensitivity) ? sensitivity : 0,
    specificity: Number.isFinite(specificity) ? specificity : 0,
    turnaround_time: Number.isFinite(turnaroundTime) ? turnaroundTime : 0,
    turnaround_time_unit: fallback.tatUnit || fallback.turnaround_time_unit || 'min',
    sample_types: [fallback.sample || 'n/a'],
    skill_level: fallback.skill || fallback.skill_level || 'n/a',
    cost: Number.isFinite(cost) ? cost : 0,
    category: fallback.category || 'clinical',
  };
}

function collectCanvasTests(pathway) {
  const nodes = Array.isArray(pathway?.nodes) ? pathway.nodes : [];
  const tests = new Map();

  const addTest = (testRecord, aliases = []) => {
    if (!testRecord?.id) {
      return;
    }

    const payload = {
      id: testRecord.id,
      name: testRecord.name,
      sensitivity: testRecord.sensitivity,
      specificity: testRecord.specificity,
      turnaround_time: testRecord.turnaround_time,
      turnaround_time_unit: testRecord.turnaround_time_unit,
      sample_types: testRecord.sample_types,
      skill_level: testRecord.skill_level,
      cost: testRecord.cost,
      category: testRecord.category,
    };

    tests.set(testRecord.id, payload);
    for (const alias of aliases) {
      if (!alias || alias === testRecord.id) {
        continue;
      }
      tests.set(alias, { ...payload, id: alias });
    }
  };

  for (const node of nodes) {
    if (node?.type === 'test' && node.testId) {
      addTest(snapshotCanvasTestRecord(node, node.label || node.testId), [node.testId]);
    }

    if (node?.type === 'parallel') {
      for (const member of node.members || []) {
        const testRecord = snapshotCanvasTestRecord(member, member?.label || member?.testId || member?.id);
        addTest(testRecord, [member?.id, member?.testId]);
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

function isRequiredTerminalRole(role) {
  return role === 'required_positive' || role === 'required_negative';
}

function buildRequiredTerminalNode(role, existingNodes = []) {
  const subtype = role === 'required_positive' ? 'pos' : 'neg';
  const label = role === 'required_positive' ? 'Considered Positive' : 'Considered Negative';
  const fallbackId = role === 'required_positive' ? '__terminal_positive__' : '__terminal_negative__';
  const y = role === 'required_positive' ? 260 : 420;
  let candidateId = fallbackId;
  let suffix = 1;

  while (existingNodes.some(node => node?.id === candidateId)) {
    candidateId = `${fallbackId}_${suffix}`;
    suffix += 1;
  }

  return {
    id: candidateId,
    type: 'terminal',
    subtype,
    label,
    terminalRole: role,
    x: 1120,
    y,
  };
}

function ensureRequiredTerminalNodes(nodes) {
  const nextNodes = Array.isArray(nodes)
    ? nodes.map(node => ({ ...node }))
    : [];

  ['required_positive', 'required_negative'].forEach(role => {
    const subtype = role === 'required_positive' ? 'pos' : 'neg';
    const fallbackId = role === 'required_positive' ? '__terminal_positive__' : '__terminal_negative__';
    const existingIndex = nextNodes.findIndex(node =>
      node?.type === 'terminal'
      && (node.terminalRole === role || (node.terminalRole == null && node.id === fallbackId))
    );

    if (existingIndex >= 0) {
      nextNodes[existingIndex] = {
        ...nextNodes[existingIndex],
        type: 'terminal',
        subtype,
        terminalRole: role,
        label: nextNodes[existingIndex].label || (role === 'required_positive' ? 'Considered Positive' : 'Considered Negative'),
        x: Number.isFinite(Number(nextNodes[existingIndex].x)) ? Number(nextNodes[existingIndex].x) : 1120,
        y: Number.isFinite(Number(nextNodes[existingIndex].y)) ? Number(nextNodes[existingIndex].y) : (role === 'required_positive' ? 260 : 420),
      };
      return;
    }

    nextNodes.push(buildRequiredTerminalNode(role, nextNodes));
  });

  return nextNodes;
}

function createStarterCanvasGraph() {
  const nodes = ensureRequiredTerminalNodes([]);

  return {
    schema_version: 'canvas-v1',
    start_node: detectStartNode(nodes, []),
    metadata: {
      label: 'New project',
      source: 'Builder canvas',
      disease: null,
    },
    tests: {},
    nodes,
    edges: [],
  };
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
      terminalRole: node.terminalRole ?? null,
      members: Array.isArray(node.members) ? node.members.map(member => ({ ...member })) : node.members ?? null,
    }])),
    edges: edges
      .filter(edge => edge.from && edge.to)
      .map(edge => ({ ...edge })),
  };
}

function normalizeCanvasNode(node, fallbackId) {
  const members = Array.isArray(node.members)
    ? node.members.map(member => ({ ...member }))
    : null;

  return {
    id: node.id || fallbackId,
    type: node.type || 'test',
    testId: node.testId ?? null,
    label: node.label ?? null,
    kind: node.kind ?? null,
    subtype: node.subtype ?? null,
    terminalRole: node.terminalRole ?? null,
    members,
    text: node.text ?? null,
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
    rule: node.rule ?? null,
  };
}

function inferCanvasNodeType(node) {
  if (node?.type === 'annotation') {
    return 'annotation';
  }

  if (node?.type === 'parallel') {
    return 'parallel';
  }

  if (node?.type === 'terminal' || node?.final_classification) {
    return 'terminal';
  }

  const testNames = Array.isArray(node?.action?.test_names)
    ? node.action.test_names.filter(Boolean)
    : [];

  if (testNames.length > 1 && (node?.action?.mode === 'parallel' || node?.action?.parallel_time)) {
    return 'parallel';
  }

  if (testNames.length > 0 || node?.action) {
    return 'test';
  }

  return 'test';
}

function inferTerminalSubtype(node) {
  if (node?.subtype) {
    return node.subtype;
  }

  return node?.final_classification === 'positive'
    ? 'pos'
    : node?.final_classification === 'negative'
      ? 'neg'
      : 'inc';
}

function inferBranchPort(node, branch) {
  if (!branch || typeof branch !== 'object') {
    return 'pos';
  }

  const conditions = branch.conditions || {};
  const testNames = Array.isArray(node?.action?.test_names) ? node.action.test_names.filter(Boolean) : [];
  const conditionEntries = Object.entries(conditions).filter(([, value]) => value != null);

  if (node?.type === 'parallel' || (testNames.length > 1 && (node?.action?.mode === 'parallel' || node?.action?.parallel_time))) {
    if (conditionEntries.length > 0 && conditionEntries.every(([, value]) => value === 'pos')) {
      return 'both_pos';
    }

    if (conditionEntries.length > 0 && conditionEntries.every(([, value]) => value === 'neg')) {
      return 'both_neg';
    }

    return 'disc';
  }

  const firstOutcome = conditionEntries[0]?.[1];
  return firstOutcome === 'neg' ? 'neg' : 'pos';
}

function inferBranchKind(port) {
  return port === 'neg'
    ? 'neg'
    : port === 'disc'
      ? 'disc'
      : port === 'both_neg'
        ? 'neg'
        : 'pos';
}

function layoutCanvasGraph(nodes, edges, startNode) {
  const nodeIds = nodes.map(node => node.id);
  const incoming = Object.fromEntries(nodeIds.map(id => [id, 0]));
  const outgoing = new Map();

  for (const edge of edges) {
    if (!edge?.from || !edge?.to) {
      continue;
    }

    if (incoming[edge.to] !== undefined) {
      incoming[edge.to] += 1;
    }

    if (!outgoing.has(edge.from)) {
      outgoing.set(edge.from, []);
    }

    outgoing.get(edge.from).push(edge.to);
  }

  const rootId = nodeIds.includes(startNode) ? startNode : nodeIds.find(id => incoming[id] === 0) || nodeIds[0] || null;
  const depth = {};
  const queue = rootId ? [rootId] : [];

  if (rootId) {
    depth[rootId] = 0;
  }

  while (queue.length) {
    const currentId = queue.shift();
    const currentDepth = depth[currentId] ?? 0;
    for (const nextId of outgoing.get(currentId) || []) {
      const nextDepth = currentDepth + 1;
      if (depth[nextId] === undefined || nextDepth > depth[nextId]) {
        depth[nextId] = nextDepth;
        queue.push(nextId);
      }
    }
  }

  const columns = new Map();
  for (const node of nodes) {
    const nodeDepth = depth[node.id] ?? 0;
    if (!columns.has(nodeDepth)) {
      columns.set(nodeDepth, []);
    }
    columns.get(nodeDepth).push(node.id);
  }

  const xStep = 340;
  const yStep = 220;
  const baseX = 40;
  const baseY = 330;

  return nodes.map(node => {
    const nodeDepth = depth[node.id] ?? 0;
    const column = columns.get(nodeDepth) || [node.id];
    const index = column.indexOf(node.id);
    const height = column.length;

    return {
      ...node,
      x: baseX + nodeDepth * xStep,
      y: baseY + index * yStep - ((height - 1) * yStep) / 2,
    };
  });
}

function buildCanvasDraftFromPathway(pathway) {
  const normalized = normalizePathwayGraph(pathway);
  const rawNodes = Object.entries(normalized.nodes || {});
  const isCanvasGraph = rawNodes.some(([, node]) => {
    if (!node || typeof node !== 'object') {
      return false;
    }

    return node.type || node.testId || node.members || node.x !== undefined || node.y !== undefined || node.text !== undefined;
  });

  if (isCanvasGraph) {
    const nodes = ensureRequiredTerminalNodes(rawNodes.map(([nodeId, node]) => normalizeCanvasNode(node, nodeId)));
    const edges = (normalized.edges || []).map(edge => ({ ...edge }));

    return {
      schema_version: normalized.schema_version || 'canvas-v1',
      start_node: normalized.start_node || nodes.find(node => node.type !== 'annotation')?.id || 'n1',
      metadata: normalized.metadata || {},
      tests: normalized.tests || {},
      nodes,
      edges,
    };
  }

  const convertedNodes = rawNodes.map(([nodeId, node]) => {
    const type = inferCanvasNodeType(node);
    const testNames = Array.isArray(node?.action?.test_names) ? node.action.test_names.filter(Boolean) : [];
    const subtype = inferTerminalSubtype(node);

    if (type === 'parallel') {
      return normalizeCanvasNode({
        id: nodeId,
        type: 'parallel',
        label: node.label ?? node.description ?? 'Parallel block',
        members: testNames.map(testId => ({ testId })),
      }, nodeId);
    }

    if (type === 'terminal') {
      return normalizeCanvasNode({
        id: nodeId,
        type: 'terminal',
        subtype,
        label:
          node.label
          || node.description
          || (subtype === 'pos' ? 'Positive' : subtype === 'neg' ? 'Negative' : subtype === 'inc' ? 'Inconclusive' : 'Refer'),
      }, nodeId);
    }

    return normalizeCanvasNode({
      id: nodeId,
      type: 'test',
      testId: testNames[0] ?? null,
      label: node.label ?? node.description ?? null,
      kind: node.kind ?? null,
    }, nodeId);
  });

  const convertedEdges = [];
  for (const [nodeId, node] of rawNodes) {
    if (!Array.isArray(node?.branches)) {
      continue;
    }

    for (const branch of node.branches) {
      const nextNode = branch?.next_node;
      if (!nextNode) {
        continue;
      }

      const port = inferBranchPort(node, branch);
      convertedEdges.push({
        id: branch.id || `${nodeId}->${nextNode}:${port}:${convertedEdges.length}`,
        from: nodeId,
        fromPort: port,
        to: nextNode,
        kind: inferBranchKind(port),
        label: branch.label || (port === 'both_pos' ? 'Positive' : port === 'both_neg' ? 'Negative' : port === 'disc' ? 'Discordant' : port === 'neg' ? 'Negative' : 'Positive'),
      });
    }
  }

  const laidOutNodes = ensureRequiredTerminalNodes(layoutCanvasGraph(convertedNodes, convertedEdges, normalized.start_node));

  return {
    schema_version: normalized.schema_version || 'canvas-v1',
    start_node: normalized.start_node || laidOutNodes.find(node => node.type !== 'annotation')?.id || 'n1',
    metadata: normalized.metadata || {},
    tests: normalized.tests || {},
    nodes: laidOutNodes,
    edges: convertedEdges,
  };
}

function buildPathwaySignature(pathway) {
  return JSON.stringify(normalizePathwayGraph(pathway || buildCanonicalPathway()));
}

function getActivePathwayRecord() {
  return window.OptiDxCurrentPathwayRecord || null;
}

function setActivePathwayRecord(record) {
  window.OptiDxCurrentPathwayRecord = record || null;
  if (record) {
    const canvasDraft = buildCanvasDraftFromPathway(record._canonical || record.editor_definition || record.engine_definition || record);
    window.OptiDxCurrentPathway = canvasDraft;
    window.OptiDxCanvasDraft = canvasDraft;
    window.SEED_PATHWAY = canvasDraft;
  }
  return record || null;
}

function setActivePathwayDraft(pathway) {
  const canvasDraft = buildCanvasDraftFromPathway(pathway || createStarterCanvasGraph());
  window.OptiDxCurrentPathway = canvasDraft;
  window.OptiDxCanvasDraft = canvasDraft;
  window.SEED_PATHWAY = canvasDraft;
  return canvasDraft;
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
  const normalizedNodes = ensureRequiredTerminalNodes(nodes);

  return {
    schema_version: source?.schema_version || 'canvas-v1',
    start_node: source?.start_node || source?.startNode || detectStartNode(normalizedNodes, edges),
    tests: collectCanvasTests({ nodes: normalizedNodes }),
    nodes: Object.fromEntries(normalizedNodes.map(node => [node.id, {
      id: node.id,
      type: node.type,
      testId: node.testId ?? null,
      label: node.label ?? null,
      kind: node.kind ?? null,
      subtype: node.subtype ?? null,
      terminalRole: node.terminalRole ?? null,
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
      pathway: pathway && Object.keys(pathway).length ? buildCanvasDraftFromPathway(pathway) : null,
    };
  });
}

async function persistDiagnosticTest(test) {
  const payload = buildDiagnosticTestPayload(test);
  if (!payload.name) {
    throw new Error('Test name is required.');
  }

  const testRecord = isPersistedDiagnosticTestId(test?.id)
    ? await request('put', `/api/evidence/tests/${test.id}`, payload)
    : await request('post', '/api/evidence/tests', payload);
  const normalized = normalizeDiagnosticTestRecord(testRecord);
  const nextTests = [...getWorkspaceTests(), normalized];
  window.SEED_TESTS = nextTests;
  setWorkspaceSnapshot({
    tests: nextTests,
    testsById: toWorkspaceIndex(nextTests),
  });
  window.dispatchEvent(new Event('optidx-tests-updated'));
  return normalized;
}

async function saveDiagnosticTest(test) {
  const normalized = await persistDiagnosticTest(test);
  showToast(`${test?.id ? 'Updated' : 'Added'} "${normalized.name}" in the library`, 'success');
  return normalized;
}

function openDiagnosticTestEditor(initialTest = null) {
  window.dispatchEvent(new CustomEvent('optidx-open-test-editor', {
    detail: initialTest && typeof initialTest === 'object' ? initialTest : null,
  }));
  return initialTest || null;
}

async function addManualTest(initialTest = null) {
  return openDiagnosticTestEditor(initialTest);
}

async function deleteDiagnosticTest(testId) {
  if (!testId) {
    return null;
  }

  if (!isPersistedDiagnosticTestId(testId)) {
    const remaining = getWorkspaceTests().filter(item => String(item.id) !== String(testId));
    window.SEED_TESTS = remaining;
    setWorkspaceSnapshot({
      tests: remaining,
      testsById: toWorkspaceIndex(remaining),
    });
    window.dispatchEvent(new Event('optidx-tests-updated'));
    showToast('Test removed from the library', 'success');
    return true;
  }

  await request('delete', `/api/evidence/tests/${testId}`);
  const remaining = getWorkspaceTests().filter(item => String(item.id) !== String(testId));
  window.SEED_TESTS = remaining;
  setWorkspaceSnapshot({
    tests: remaining,
    testsById: toWorkspaceIndex(remaining),
  });
  window.dispatchEvent(new Event('optidx-tests-updated'));
  showToast('Test removed from the library', 'success');
  return true;
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
  window.OptiDxLatestEvaluationSignature = buildPathwaySignature(canonicalPathway);
  window.OptiDxLatestEvaluationView = buildEvaluationView(response);
  if (response?.pathway) {
    window.OptiDxCurrentPathwayRecord = normalizePathwayRecord(response.pathway);
  }
  showToast('Pathway evaluation finished', 'success');
  return response;
}

async function loadPathwayIntoWorkspace(pathway) {
  const response = await request('post', '/api/pathways/import', { pathway });
  const canvasDraft = buildCanvasDraftFromPathway(pathway);
  window.OptiDxImportedPathway = response;
  window.OptiDxCurrentPathwayRecord = normalizePathwayRecord(response);
  setActivePathwayDraft(canvasDraft);
  window.dispatchEvent(new CustomEvent('optidx-pathway-loaded', { detail: canvasDraft }));
  showToast(`Imported "${canvasDraft.metadata?.label || 'pathway'}"`, 'success');
  return response;
}

async function importPresetTestToPathway(test) {
  if (!test || typeof test !== 'object') {
    return null;
  }

  const baseDraft = window.OptiDxCurrentPathway || window.OptiDxCanvasDraft || createStarterCanvasGraph();
  const canvasDraft = buildCanvasDraftFromPathway(baseDraft);
  const nodes = Array.isArray(canvasDraft.nodes)
    ? canvasDraft.nodes.map(node => ({
        ...node,
        members: Array.isArray(node.members) ? node.members.map(member => ({ ...member })) : node.members,
      }))
    : [];

  const placedNodes = nodes.filter(node => node.type !== 'terminal' && node.type !== 'annotation');
  const rightmostX = placedNodes.length
    ? Math.max(...placedNodes.map(node => Number(node.x) || 0))
    : 360;
  const averageY = placedNodes.length
    ? placedNodes.reduce((sum, node) => sum + (Number(node.y) || 0), 0) / placedNodes.length
    : 260;
  const offsetY = (placedNodes.length % 3) * 88 - 88;
  const safeId = String(test.id || test.name || 'preset-test')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const nextNode = {
    id: `preset-${safeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'test',
    testId: test.id ?? null,
    label: test.name || 'Preset test',
    x: rightmostX + 280,
    y: averageY + offsetY,
  };

  const nextDraft = {
    ...canvasDraft,
    nodes: [...nodes, nextNode],
  };

  setActivePathwayDraft(nextDraft);
  window.dispatchEvent(new CustomEvent('optidx-pathway-loaded', { detail: nextDraft }));
  showToast(`Added "${test.name || 'preset test'}" to the active pathway`, 'success');
  return nextDraft;
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
  const normalized = await persistDiagnosticTest({
    ...test,
    name: String(test.name || test.test || test.label || test.title || 'Imported evidence test').trim(),
    notes: test.notes || test.evidence || 'Imported from evidence library.',
    availability: true,
    provenance: {
      source: test.source || test.provenance?.source || 'Evidence library',
      country: test.country || test.provenance?.country || null,
      year: test.year || test.provenance?.year || null,
    },
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
  createStarterCanvasGraph,
  showToast,
  copyText,
  copyShareLink,
  ensureBlobDownload,
  buildCanonicalPathway,
  buildPathwaySignature,
  normalizePathwayGraph,
  buildCanvasDraftFromPathway,
  loadPathwayIntoWorkspace,
  importPresetTestToPathway,
  openPathwayRecord,
  savePathway,
  optimizePathways,
  evaluatePathway,
  buildEvaluationView,
  buildOptimizationScenarios,
  openDiagnosticTestEditor,
  addManualTest,
  deleteDiagnosticTest,
  saveDiagnosticTest,
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
