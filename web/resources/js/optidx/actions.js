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
  const response = await request('post', '/api/pathways', {
    name,
    editor_definition: payload,
    schema_version: payload?.schema_version || 'canvas-v1',
    start_node_id: payload?.start_node || null,
    metadata: payload?.metadata || {},
  });

  window.OptiDxSavedPathway = response;
  window.OptiDxCurrentPathway = normalizePathwayGraph(response?.editor_definition || payload);
  window.OptiDxCanvasDraft = window.OptiDxCurrentPathway;
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
    };
  });
}

function addManualTest() {
  const name = window.prompt("Name the new diagnostic test:");
  if (!name) {
    return null;
  }

  const cleaned = name.trim();
  if (!cleaned) {
    return null;
  }

  const id = `t_manual_${Date.now().toString(36)}`;
  const test = {
    id,
    name: cleaned,
    category: "clinical",
    icon: "flask-conical",
    cost: 1.0,
    currency: "USD",
    sens: 0.8,
    spec: 0.8,
    tat: 15,
    tatUnit: "min",
    sample: "blood",
    skill: "Lab Tech",
    evidence: "Manual entry",
    notes: "User-defined test.",
    available: true,
  };

  window.SEED_TESTS = [...(window.SEED_TESTS || []), test];
  window.dispatchEvent(new CustomEvent('optidx-tests-updated', { detail: test }));
  showToast(`Added "${cleaned}" to the library`, 'success');
  return test;
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
  };

  if (prevalence !== null && prevalence !== undefined) {
    payload.prevalence = prevalence;
  }

  const response = await request('post', '/api/pathways/evaluate', payload);
  window.OptiDxLatestEvaluationResult = response;
  window.OptiDxLatestEvaluationPathway = canonicalPathway;
  window.OptiDxLatestEvaluationView = buildEvaluationView(response);
  showToast('Pathway evaluation finished', 'success');
  return response;
}

async function loadPathwayIntoWorkspace(pathway) {
  const response = await request('post', '/api/pathways/import', { pathway });
  const canonical = normalizePathwayGraph(response?.editor_definition || response);
  window.OptiDxImportedPathway = response;
  window.OptiDxCurrentPathway = canonical;
  window.OptiDxCanvasDraft = canonical;
  window.dispatchEvent(new CustomEvent('optidx-pathway-loaded', { detail: canonical }));
  showToast(`Imported "${canonical.metadata?.label || 'pathway'}"`, 'success');
  return response;
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
  showToast(`${label} is not connected yet.`);
}

window.OptiDxActions = {
  api,
  request,
  showToast,
  copyText,
  ensureBlobDownload,
  buildCanonicalPathway,
  normalizePathwayGraph,
  loadPathwayIntoWorkspace,
  savePathway,
  optimizePathways,
  evaluatePathway,
  buildEvaluationView,
  buildOptimizationScenarios,
  addManualTest,
  downloadJson(filename, data) {
    ensureBlobDownload(filename, JSON.stringify(data, null, 2), 'application/json');
  },
  downloadText(filename, text) {
    ensureBlobDownload(filename, text, 'text/plain;charset=utf-8');
  },
  importJsonFile,
  comingSoon,
};
