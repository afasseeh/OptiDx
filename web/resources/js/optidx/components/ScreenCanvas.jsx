// Canvas — interactive workflow builder (probabilistic pathway modeller)

// ---------- Test library card (left rail) ----------
function TestCard({ test, draggable = true, onDragStart }) {
  return (
    <div className="test-card" draggable={draggable}
      onDragStart={e => {
        const payload = snapshotTestRecord(test);
        e.dataTransfer.setData("text/testId", payload.id);
        e.dataTransfer.setData("text/plain", payload.id);
        e.dataTransfer.effectAllowed = "copy";
        window.OptiDxDraggingTest = payload;
        onDragStart && onDragStart(payload);
      }}
      onDragEnd={() => {
        window.OptiDxDraggingTest = null;
      }}>
      <div className="test-card__head">
        <div className="test-card__icon"><Icon name={test.icon} size={14}/></div>
        <div style={{flex:1, minWidth:0}}>
          <div className="test-card__name" title={test.name}>{test.name}</div>
          <div className="test-card__cat">{test.category}</div>
        </div>
      </div>
      <div className="test-card__stats">
        <div className="test-card__stat"><span>Sens</span><b className="mono">{test.sens.toFixed(2)}</b></div>
        <div className="test-card__stat"><span>Spec</span><b className="mono">{test.spec.toFixed(2)}</b></div>
        <div className="test-card__stat"><span>Cost</span><b className="mono">${test.cost.toFixed(2)}</b></div>
        <div className="test-card__stat"><span>TAT</span><b className="mono">{test.tat}{test.tatUnit[0]}</b></div>
      </div>
      <div className="test-card__foot">
        <span className="chip chip--outline">{test.sample}</span>
        <span className="chip chip--outline">{test.skill}</span>
      </div>
    </div>
  );
}

function TestLibrary({ collapsed, onToggle }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [, setLibraryRevision] = useState(0);
  const cats = ["all", "clinical", "imaging", "rapid", "molecular", "pathology", "biomarker"];
  useEffect(() => {
    const onUpdate = () => setLibraryRevision(v => v + 1);
    window.addEventListener("optidx-tests-updated", onUpdate);
    return () => window.removeEventListener("optidx-tests-updated", onUpdate);
  }, []);
  const filtered = getTestCatalog().filter(t =>
    (cat === "all" || t.category === cat) &&
    (!q || t.name.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <aside className="side" style={{position:"relative"}}>
      {!collapsed && (
        <div className="side__head">
          <h2>Diagnostic tests</h2>
          <div className="spacer"/>
          <button className="btn btn--sm btn--icon" title="Add test parameter" onClick={() => window.OptiDxActions.addManualTest?.()}><Icon name="plus" size={12}/></button>
        </div>
      )}
      {collapsed && (
        <div className="panel-collapsed-label">Diagnostic tests</div>
      )}
      <div className="lib__search">
        <Icon name="search"/>
        <input className="input" placeholder="Search test parameters…" value={q} onChange={e => setQ(e.target.value)}/>
      </div>
      <div className="lib__filters">
        {cats.map(c => (
          <button key={c} className={"lib__filter" + (cat === c ? " is-active" : "")}
            onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="lib__list scroll">
        {filtered.map(t => <TestCard key={t.id} test={t}/>)}
      </div>
      <div className="lib__hint" style={{padding:"10px 12px", borderTop:"1px solid var(--edge)", fontSize:11, color:"var(--fg-3)", lineHeight:1.5}}>
        <b style={{color:"var(--fg-2)"}}>Tip.</b> Drag onto the canvas to add a pathway node. Hold <kbd className="kbd">Shift</kbd> and drag-select to group as a parallel block.
      </div>
      <button className="panel-collapse panel-collapse--lib" onClick={onToggle}
        title={collapsed ? "Expand test library" : "Collapse test library"}>
        <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={12}/>
      </button>
    </aside>
  );
}

// ---------- Test node ----------
function NodeTestCard({ node, test, selected, onSelect, onDragNode, onDragNodeStart, invalid, isReferee, onPortDown }) {
  const drag = useRef({});
  const onDown = e => {
    if (e.target.classList.contains("port")) return;
    e.stopPropagation();
    drag.current = { down: true, x: e.clientX, y: e.clientY, ox: node.x, oy: node.y, moved: false };
    onSelect(node.id);
    const move = ev => {
      if (!drag.current.moved) { drag.current.moved = true; onDragNodeStart && onDragNodeStart(); }
      onDragNode(node.id, drag.current.ox + (ev.clientX - drag.current.x), drag.current.oy + (ev.clientY - drag.current.y));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const cls = "node" + (selected ? " is-selected" : "") + (invalid ? " is-invalid" : "") + (isReferee ? " node--referee" : "");
  return (
    <div className={cls} data-node-id={node.id} style={{left: node.x, top: node.y}} onMouseDown={onDown}
      onClick={e => { e.stopPropagation(); onSelect(node.id); }}>
      {isReferee && <div className="node__ribbon">Referee</div>}
      <div className="node__head">
        <div className="node__icon"><Icon name={test.icon} size={12}/></div>
        <div style={{flex:1}}>
          <div className="node__title">{test.name}</div>
          <div className="node__meta">{node.label || (test.category + " · pathway node")}</div>
        </div>
      </div>
      <div className="node__body">
        <div className="node__chips">
          <span className="chip chip--mono">Se {test.sens.toFixed(2)}</span>
          <span className="chip chip--mono">Sp {test.spec.toFixed(2)}</span>
          <span className="chip chip--mono">${test.cost.toFixed(2)}</span>
          <span className="chip chip--mono">{test.tat}{test.tatUnit[0]}</span>
        </div>
      </div>
      <div className="node__outputs">
        <div className="node__output pos"><span className="branch-dot branch-dot--pos"/>Positive</div>
        <div className="spacer"/>
        <div className="node__output neg"><span className="branch-dot branch-dot--neg"/>Negative</div>
      </div>
      <div className="port port--in" data-port="in"/>
      <div className="port port--out pos" data-port="pos" title="Drag to wire positive branch" onMouseDown={onPortDown && onPortDown(node.id, "pos", "pos")}/>
      <div className="port port--out neg" data-port="neg" title="Drag to wire negative branch" onMouseDown={onPortDown && onPortDown(node.id, "neg", "neg")}/>
    </div>
  );
}

// ---------- Parallel block ----------
function NodeParallel({ node, selected, onSelect, onDragNode, onDragNodeStart, invalid, onPortDown, onAddMember, onRemoveMember }) {
  const drag = useRef({});
  const [isDropActive, setIsDropActive] = useState(false);
  const memberRows = (node.members || [])
    .map((member, index) => {
      const test = getRenderableTest(member.testId, member);
      return {
        member,
        test,
        key: member.id || `${member.testId}-${index}`,
        occurrence: index + 1,
      };
    })
    .filter(Boolean);
  const tests = memberRows.map(row => row.test);
  const onDown = e => {
    if (e.target.classList.contains("port")) return;
    e.stopPropagation();
    drag.current = { down: true, x: e.clientX, y: e.clientY, ox: node.x, oy: node.y, moved: false };
    onSelect(node.id);
    const move = ev => {
      if (!drag.current.moved) { drag.current.moved = true; onDragNodeStart && onDragNodeStart(); }
      onDragNode(node.id, drag.current.ox + (ev.clientX - drag.current.x), drag.current.oy + (ev.clientY - drag.current.y));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const handleAddTest = (testId) => {
    if (!testId) return;
    onAddMember?.(node.id, testId);
  };
  const handleDrop = (e) => {
    const draggedTest = window.OptiDxDraggingTest || null;
    const testId = e.dataTransfer.getData("text/testId") || e.dataTransfer.getData("text/plain") || draggedTest?.id || "";
    if (!testId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
    handleAddTest(draggedTest || testId);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDropActive) setIsDropActive(true);
  };
  const handleDragLeave = (e) => {
    if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget)) {
      setIsDropActive(false);
    }
  };
  const totalCost = tests.reduce((s,t) => s + t.cost, 0);
  const maxTAT = tests.reduce((m,t) => {
    const mins = t.tatUnit === "min" ? t.tat : t.tatUnit === "hr" ? t.tat*60 : t.tat*1440;
    return Math.max(m, mins);
  }, 0);
  const fmtTAT = m => m < 60 ? `${m}m` : m < 1440 ? `${(m/60).toFixed(1)}h` : `${(m/1440).toFixed(1)}d`;
  const samples = [...new Set(tests.map(t => t.sample))].join(" · ");
  return (
    <div className={"node node--parallel" + (selected ? " is-selected" : "") + (invalid ? " is-invalid" : "")}
      data-node-id={node.id}
      style={{left: node.x, top: node.y}}
      onMouseDown={onDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
      onClick={e => { e.stopPropagation(); onSelect(node.id); }}>
      <div className="parallel__label"><Icon name="merge" size={10}/>Parallel testing block</div>
      <div className="parallel__title">{node.label || "Parallel block"}</div>
      <div className={"parallel__dropzone" + (isDropActive ? " is-active" : "")}>
        <Icon name="download" size={10}/>
        <span>Drop a test here or use the Add button in the inspector</span>
      </div>
      <div className="parallel__inner">
        {memberRows.map(({ member, test, key, occurrence }) => (
          <div className="parallel__row" key={key}>
            <Icon name={test.icon} size={11}/>
            <span className="parallel__name">
              {test.name}
              <span className="parallel__duplicate-tag">#{occurrence}</span>
            </span>
            <span className="mono parallel__se">Se {test.sens.toFixed(2)}</span>
            <span className="mono parallel__sp">Sp {test.spec.toFixed(2)}</span>
            <button
              className="btn btn--xs btn--icon parallel__remove"
              title="Remove this member"
              onClick={e => {
                e.stopPropagation();
                e.preventDefault();
                onRemoveMember?.(node.id, member.id || member.testId);
              }}
            >
              <Icon name="x" size={10}/>
            </button>
          </div>
        ))}
      </div>
      <div className="parallel__stats">
        <div><span>Combined cost</span><b className="mono">${totalCost.toFixed(2)}</b></div>
        <div><span>TAT (max rule)</span><b className="mono">{fmtTAT(maxTAT)}</b></div>
        <div><span>Samples</span><b>{samples}</b></div>
      </div>
      <div className="node__outputs node__outputs--3">
        <div className="node__output pos"><span className="branch-dot branch-dot--pos"/>Both +</div>
        <div className="node__output disc"><span className="branch-dot branch-dot--disc"/>Discordant</div>
        <div className="node__output neg"><span className="branch-dot branch-dot--neg"/>Both −</div>
      </div>
      <div className="port port--in" data-port="in"/>
      <div className="port port--out pos parallel__port--bp" data-port="both_pos" onMouseDown={onPortDown && onPortDown(node.id, "both_pos", "pos")}/>
      <div className="port port--out disc parallel__port--d" data-port="discord" onMouseDown={onPortDown && onPortDown(node.id, "discord", "disc")}/>
      <div className="port port--out neg parallel__port--bn" data-port="both_neg" onMouseDown={onPortDown && onPortDown(node.id, "both_neg", "neg")}/>
    </div>
  );
}

// ---------- Terminal node ----------
function NodeTerminal({ node, selected, onSelect, onDragNode, onDragNodeStart, invalid }) {
  const drag = useRef({});
  const onDown = e => {
    e.stopPropagation();
    drag.current = { down: true, x: e.clientX, y: e.clientY, ox: node.x, oy: node.y, moved: false };
    onSelect(node.id);
    const move = ev => {
      if (!drag.current.moved) { drag.current.moved = true; onDragNodeStart && onDragNodeStart(); }
      onDragNode(node.id, drag.current.ox + (ev.clientX - drag.current.x), drag.current.oy + (ev.clientY - drag.current.y));
    };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const iconName = node.subtype === "pos" ? "check" : node.subtype === "neg" ? "x" : node.subtype === "inc" ? "help" : "arrow-right";
  const subLabel = isRequiredTerminalNode(node)
    ? (node.subtype === "pos" ? "Required positive endpoint" : "Required negative endpoint")
    : node.subtype === "pos" ? "Final positive" : node.subtype === "neg" ? "Final negative" : node.subtype === "inc" ? "Inconclusive" : "Refer";
  return (
    <div className={"node node--terminal " + (node.subtype === "neg" ? "is-neg" : node.subtype === "inc" ? "is-inc" : node.subtype === "ref" ? "is-ref" : "") + (selected ? " is-selected" : "") + (invalid ? " is-invalid" : "")}
      data-node-id={node.id}
      style={{left: node.x, top: node.y}} onMouseDown={onDown}
      onClick={e => { e.stopPropagation(); onSelect(node.id); }}>
      <div className="node__head">
        <div className="node__icon"><Icon name={iconName} size={12}/></div>
        <div style={{flex:1}}>
          <div className="node__title">{node.label}</div>
          <div className="node__meta">{subLabel} · terminal</div>
        </div>
      </div>
      <div className="port port--in" data-port="in"/>
    </div>
  );
}

function NodeAnnotation({ node, onDragNode }) {
  const drag = useRef({});
  const onDown = e => {
    e.stopPropagation();
    drag.current = { down: true, x: e.clientX, y: e.clientY, ox: node.x, oy: node.y };
    const move = ev => onDragNode(node.id, drag.current.ox + (ev.clientX - drag.current.x), drag.current.oy + (ev.clientY - drag.current.y));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  return (
    <div className="node node--annotation" style={{left:node.x, top:node.y}} onMouseDown={onDown}>
      <div style={{fontSize:10, fontWeight:700, letterSpacing:"0.12em", color:"#8A7315", textTransform:"uppercase", marginBottom:4}}>Assumption</div>
      {node.text}
    </div>
  );
}

function cloneCanvasNode(node) {
  return {
    ...node,
    members: Array.isArray(node.members) ? node.members.map(member => ({ ...member })) : node.members ?? null,
  };
}

function hydrateCanvasGraph(pathway) {
  const normalized = window.OptiDxActions?.buildCanvasDraftFromPathway?.(pathway) || window.OptiDxActions?.normalizePathwayGraph?.(pathway) || pathway || {};
  const nodes = Array.isArray(normalized.nodes)
    ? normalized.nodes.map(cloneCanvasNode)
    : Object.values(normalized.nodes || {}).map(cloneCanvasNode);
  const edges = Array.isArray(normalized.edges)
    ? normalized.edges.map(edge => ({ ...edge }))
    : Object.values(normalized.edges || {}).map(edge => ({ ...edge }));

  return {
    schema_version: normalized.schema_version || 'canvas-v1',
    metadata: normalized.metadata || {},
    start_node: normalized.start_node || nodes.find(node => node.type !== 'annotation')?.id || 'n1',
    nodes,
    edges,
  };
}

function getTestCatalog() {
  const workspaceTests = window.OptiDxActions?.getWorkspaceTests?.();
  return Array.isArray(workspaceTests)
    ? workspaceTests
    : Array.isArray(window.SEED_TESTS)
      ? window.SEED_TESTS
      : [];
}

function normalizeCanvasText(value, fallback = "") {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    return normalizeCanvasText(
      value.name
        ?? value.label
        ?? value.test
        ?? value.testId
        ?? value.id,
      fallback,
    );
  }

  return fallback;
}

function snapshotTestRecord(test, fallbackLabel = null) {
  const source = typeof test === "string"
    ? getTestCatalog().find(item => item.id === test) || null
    : test && typeof test === "object"
      ? test
      : null;

  const fallback = source || {};
  const fallbackText = normalizeCanvasText(fallbackLabel, "test");
  const id = normalizeCanvasText(fallback.id ?? test ?? fallbackLabel, "test");
  const name = normalizeCanvasText(
    fallback.name || fallback.label || fallback.test || fallback.testId || fallbackLabel,
    id,
  );
  const sens = Number(fallback.sens ?? fallback.sensitivity ?? 0);
  const spec = Number(fallback.spec ?? fallback.specificity ?? 0);
  const cost = Number(fallback.cost ?? 0);
  const tat = Number(fallback.tat ?? fallback.turnaround_time ?? 0);

  return {
    id,
    name,
    icon: fallback.icon || "flask-conical",
    category: fallback.category || "clinical",
    sens: Number.isFinite(sens) ? sens : 0,
    spec: Number.isFinite(spec) ? spec : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    tat: Number.isFinite(tat) ? tat : 0,
    tatUnit: normalizeCanvasText(fallback.tatUnit || fallback.turnaround_time_unit, "min"),
    sample: normalizeCanvasText(fallback.sample, fallback.sample_types?.[0] || "n/a"),
    skill: normalizeCanvasText(fallback.skill, fallback.skill_level || "n/a"),
  };
}

function getRenderableTest(testId, fallbackLabel = null) {
  const catalog = getTestCatalog();
  const found = catalog.find(test => String(test.id) === String(testId));
  if (found) {
    return found;
  }

  return snapshotTestRecord(testId, fallbackLabel);
}

function getNodeTest(node) {
  return getRenderableTest(node?.testId, node);
}

function getNodeLabel(node) {
  if (!node) return "Unknown node";
  if (node.type === "test") return node.label || getNodeTest(node)?.name || node.id;
  if (node.type === "parallel") return node.label || "Parallel block";
  if (node.type === "terminal") return node.label || (node.subtype === "pos" ? "Positive" : node.subtype === "neg" ? "Negative" : "Inconclusive");
  return node.label || node.id;
}

function isRequiredTerminalNode(node) {
  return node?.type === "terminal" && (node.terminalRole === "required_positive" || node.terminalRole === "required_negative");
}

function getPortDefinitions(node) {
  if (!node) return [];
  if (node.type === "parallel") {
    return [
      { port: "both_pos", label: "Both positive", kind: "pos" },
      { port: "discord", label: "Discordant", kind: "disc" },
      { port: "both_neg", label: "Both negative", kind: "neg" },
    ];
  }

  if (node.type === "test") {
    return [
      { port: "pos", label: "Positive", kind: "pos" },
      { port: "neg", label: "Negative", kind: "neg" },
    ];
  }

  return [];
}

function getEdgeForPort(edges, nodeId, port) {
  return edges.find(edge => edge.from === nodeId && edge.fromPort === port) || null;
}

function formatMetricValue(value, formatter = null) {
  if (value == null || value === "") return "n/a";
  return formatter ? formatter(value) : String(value);
}

function formatPathMetric(value, formatter = null) {
  if (value == null || value === "") {
    return "n/a";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return formatter ? formatter(numeric) : numeric.toFixed(2);
}

function buildStructuralPaths(nodes, edges, startNode) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const outgoing = new Map();

  edges.forEach(edge => {
    if (!outgoing.has(edge.from)) {
      outgoing.set(edge.from, []);
    }
    outgoing.get(edge.from).push(edge);
  });

  const paths = [];
  const walk = (nodeId, sequence, visited) => {
    const node = nodeMap.get(nodeId);
    if (!node || visited.has(nodeId)) return;

    if (node.type === "terminal") {
      paths.push({
        id: `P${paths.length + 1}`,
        sequence,
        terminal: getNodeLabel(node),
        terminalKind: node.subtype === "pos" ? "pos" : node.subtype === "neg" ? "neg" : "inc",
        pIfD: null,
        pIfND: null,
        cost: null,
        tat: null,
        samples: null,
        skill: null,
      });
      return;
    }

    const nextVisited = new Set(visited);
    nextVisited.add(nodeId);

    for (const edge of outgoing.get(nodeId) || []) {
      const port = getPortDefinitions(node).find(item => item.port === edge.fromPort);
      walk(edge.to, [...sequence, {
        label: edge.label || port?.label || edge.fromPort,
        kind: edge.kind || port?.kind || "pos",
      }], nextVisited);
    }
  };

  if (startNode) {
    walk(startNode, [], new Set());
  }

  return paths;
}

function buildLiveValidation(nodes, edges, startNode, activeEvaluationView) {
  const items = [];
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const activeNodes = nodes.filter(node => node.type !== "annotation");
  const terminals = nodes.filter(node => node.type === "terminal");

  if (!activeNodes.length) {
    return [{
      id: "pathway-empty",
      level: "error",
      title: "Pathway is empty",
      detail: "Add at least one pathway node before validating or running the pathway.",
      fix: "Drag a diagnostic test onto the canvas to start building the graph.",
      target: "pathway",
    }];
  }

  if (!startNode || !nodeMap.has(startNode)) {
    items.push({
      id: "start-node-missing",
      level: "error",
      title: "Start node is missing",
      detail: "The canonical pathway does not currently resolve to a valid start node.",
      fix: "Ensure the graph contains a connected entry node.",
      target: "pathway",
    });
  }

  if (!terminals.some(node => node.subtype === "pos")) {
    items.push({
      id: "positive-terminal-missing",
      level: "error",
      title: "Positive terminal is missing",
      detail: "The pathway must end in at least one positive outcome terminal.",
      fix: "Add a positive terminal node and connect at least one branch to it.",
      target: "pathway",
    });
  }

  if (!terminals.some(node => node.subtype === "neg")) {
    items.push({
      id: "negative-terminal-missing",
      level: "error",
      title: "Negative terminal is missing",
      detail: "The pathway must end in at least one negative outcome terminal.",
      fix: "Add a negative terminal node and connect at least one branch to it.",
      target: "pathway",
    });
  }

  for (const node of activeNodes) {
    if (node.type === "test" && !getNodeTest(node)) {
      items.push({
        id: `missing-test-${node.id}`,
        level: "error",
        title: "Test node references a missing test",
        detail: `${getNodeLabel(node)} does not resolve to a current diagnostic test.`,
        fix: "Reassign the node to a valid test or import the missing one.",
        target: node.id,
      });
    }

    if (node.type === "parallel" && !(node.members || []).length) {
      items.push({
        id: `parallel-empty-${node.id}`,
        level: "error",
        title: "Parallel block has no member tests",
        detail: `${getNodeLabel(node)} cannot evaluate because it has no member tests.`,
        fix: "Add tests to the parallel block before running the pathway.",
        target: node.id,
      });
    }

    if (node.type === "test" || node.type === "parallel") {
      for (const port of getPortDefinitions(node)) {
        const edge = getEdgeForPort(edges, node.id, port.port);
        if (!edge) {
          items.push({
            id: `branch-missing-${node.id}-${port.port}`,
            level: "warn",
            title: `${getNodeLabel(node)} is missing a ${port.label.toLowerCase()} branch`,
            detail: `The ${port.label.toLowerCase()} output is visible but not connected to another node.`,
            fix: `Connect the ${port.label.toLowerCase()} port to the appropriate downstream node.`,
            target: node.id,
          });
          continue;
        }

        if (!nodeMap.has(edge.to)) {
          items.push({
            id: `branch-target-missing-${edge.id}`,
            level: "error",
            title: "Branch target is missing",
            detail: `A branch from ${getNodeLabel(node)} points to a node that no longer exists.`,
            fix: "Reconnect the branch to a valid node.",
            target: node.id,
          });
        }
      }
    }
  }

  const reachable = new Set();
  const visit = nodeId => {
    if (!nodeId || reachable.has(nodeId) || !nodeMap.has(nodeId)) return;
    reachable.add(nodeId);
    edges.filter(edge => edge.from === nodeId).forEach(edge => visit(edge.to));
  };
  visit(startNode);

  activeNodes
    .filter(node => !reachable.has(node.id))
    .forEach(node => {
      items.push({
        id: `unreachable-${node.id}`,
        level: "warn",
        title: "Node is unreachable from the start",
        detail: `${getNodeLabel(node)} is not reachable from the current canonical start path.`,
        fix: "Connect it to the graph or remove it if it is no longer needed.",
        target: node.id,
      });
    });

  const sampleTypes = [...new Set(activeNodes.flatMap(node => {
    if (node.type === "parallel") {
      return (node.members || [])
        .map(member => getTestCatalog().find(test => test.id === member.testId)?.sample)
        .filter(Boolean);
    }

    if (node.type === "test") {
      const sample = getNodeTest(node)?.sample;
      return sample ? [sample] : [];
    }

    return [];
  }))];

  if (sampleTypes.length > 1) {
    items.push({
      id: "sample-types-multiple",
      level: "info",
      title: "Multiple sample types are required",
      detail: `The current pathway uses ${sampleTypes.join(", ")} across its connected test nodes.`,
      fix: "Keep this if the site can handle it, or simplify the pathway to reduce operational burden.",
      target: "pathway",
    });
  }

  if (activeEvaluationView?.warnings?.length) {
    activeEvaluationView.warnings.forEach((warning, index) => {
      items.push({
        id: `evaluation-warning-${index}`,
        level: warning.kind === "warn" ? "warn" : "info",
        title: warning.kind === "warn" ? "Evaluation warning" : "Evaluation note",
        detail: warning.text,
        fix: "Adjust the graph or test assumptions, then run the pathway again.",
        target: "pathway",
      });
    });
  }

  return items;
}

// ---------- Canvas ----------
function ScreenCanvas({ variant = "A", openPanel, setOpenPanel }) {
  const initialGraph = hydrateCanvasGraph(
    window.OptiDxCanvasDraft
    || window.OptiDxCurrentPathway
    || window.SEED_PATHWAY
    || window.OptiDxActions?.createStarterCanvasGraph?.()
    || {
      nodes: window.SEED_NODES,
      edges: window.SEED_EDGES,
    }
  );
  const [nodes, _setNodes] = useState(initialGraph.nodes);
  const [edges, _setEdges] = useState(initialGraph.edges);
  const [selected, setSelected] = useState(initialGraph.start_node);
  const [pan, setPan] = useState({ x: 20, y: -40, scale: 0.62 });
  const [rightTab, setRightTab] = useState("props"); // props | paths | validate
  const [libCollapsed, setLibCollapsed] = useState(false);
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [snap, setSnap] = useState(false);
  const [linking, setLinking] = useState(null); // { fromId, fromPort, kind, x, y } while drawing a new edge
  const [toast, setToast] = useState(null);
  const panRef = useRef({});
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const portCentersRef = useRef({});
  const portCentersSignatureRef = useRef("");
  const [, setPortLayoutRevision] = useState(0);
  const canonicalPathway = useMemo(() => window.OptiDxActions?.buildCanonicalPathway?.({
    schema_version: 'canvas-v1',
    nodes,
    edges,
    metadata: window.OptiDxCanvasMeta || window.OptiDxCanvasDraft?.metadata || window.OptiDxCurrentPathway?.metadata || { label: "TB Community Screening" },
  }) || null, [nodes, edges]);
  const canonicalSignature = useMemo(
    () => window.OptiDxActions?.buildPathwaySignature?.(canonicalPathway) || "",
    [canonicalPathway]
  );
  const activeEvaluationView = useMemo(() => (
    canonicalSignature && canonicalSignature === window.OptiDxLatestEvaluationSignature
      ? window.OptiDxLatestEvaluationView || null
      : null
  ), [canonicalSignature]);
  const livePaths = useMemo(() => {
    if (activeEvaluationView?.paths?.length) {
      return activeEvaluationView.paths.map((path, index) => ({
        ...path,
        id: path.id || `P${index + 1}`,
        sequence: Array.isArray(path.sequence)
          ? path.sequence
          : String(path.sequence || "")
              .split("→")
              .map(item => item.trim())
              .filter(Boolean)
              .map(label => ({ label, kind: /discord/i.test(label) ? "disc" : /negative|−|neg/i.test(label) ? "neg" : "pos" })),
      }));
    }

    return buildStructuralPaths(nodes, edges, canonicalPathway?.start_node || initialGraph.start_node);
  }, [activeEvaluationView, nodes, edges, canonicalPathway, initialGraph.start_node]);
  const validations = useMemo(
    () => buildLiveValidation(nodes, edges, canonicalPathway?.start_node || initialGraph.start_node, activeEvaluationView),
    [nodes, edges, canonicalPathway, initialGraph.start_node, activeEvaluationView]
  );

  useEffect(() => {
    window.OptiDxCanvasState = {
      nodes: nodes.map(n => ({
        ...n,
        members: n.members ? n.members.map(m => ({ ...m })) : undefined,
      })),
      edges: edges.map(e => ({ ...e })),
    };
    window.OptiDxCanvasMeta = canonicalPathway?.metadata || { label: "TB Community Screening" };
    window.OptiDxCurrentPathway = canonicalPathway;
    window.OptiDxCanvasDraft = canonicalPathway;
    window.SEED_PATHWAY = canonicalPathway;
  }, [nodes, edges, canonicalPathway]);

  useEffect(() => {
    const onWorkspaceLoad = event => {
      const source = event?.detail || window.OptiDxCurrentPathway || window.OptiDxCanvasDraft;
      if (!source) return;
      const graph = hydrateCanvasGraph(source);
      _setNodes(graph.nodes);
      _setEdges(graph.edges);
      setSelected(graph.start_node);
      setPan({ x: 20, y: -40, scale: 0.62 });
    };

    window.addEventListener('optidx-pathway-loaded', onWorkspaceLoad);
    return () => window.removeEventListener('optidx-pathway-loaded', onWorkspaceLoad);
  }, []);

  // ---- History (undo/redo) ----
  const historyRef = useRef({ past: [], future: [] });
  const skipHistoryRef = useRef(false);
  const snapshot = () => ({ nodes: nodes.map(n => ({...n, members: n.members ? n.members.map(m => ({...m})) : undefined })), edges: edges.map(e => ({...e})) });
  const pushHistory = () => { historyRef.current.past.push(snapshot()); historyRef.current.future = []; if (historyRef.current.past.length > 50) historyRef.current.past.shift(); };
  const setNodes = (u) => { if (!skipHistoryRef.current) pushHistory(); _setNodes(u); };
  const setEdges = (u) => { if (!skipHistoryRef.current) pushHistory(); _setEdges(u); };
  const undo = () => {
    const h = historyRef.current;
    if (!h.past.length) return flash("Nothing to undo");
    const prev = h.past.pop();
    h.future.push(snapshot());
    skipHistoryRef.current = true;
    _setNodes(prev.nodes); _setEdges(prev.edges);
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
  };
  const redo = () => {
    const h = historyRef.current;
    if (!h.future.length) return flash("Nothing to redo");
    const next = h.future.pop();
    h.past.push(snapshot());
    skipHistoryRef.current = true;
    _setNodes(next.nodes); _setEdges(next.edges);
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
  };
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1600); };

  // Fit pathway on mount + on resize/collapse
  useEffect(() => {
    const fit = () => {
      if (!canvasRef.current) return;
      const W = canvasRef.current.getBoundingClientRect().width;
      const targetScale = Math.min(1, Math.max(0.45, (W - 80) / 1380));
      setPan(p => ({ x: 20, y: -20, scale: targetScale }));
    };
    fit();
    const t = setTimeout(fit, 220);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, [libCollapsed, propsCollapsed]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return undefined;
    }

    const onNativeWheel = event => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();
      const delta = event.deltaY || 0;
      const scaleDelta = delta < 0 ? 0.08 : -0.08;
      setPan(p => ({ ...p, scale: Math.max(0.4, Math.min(2, p.scale + scaleDelta)) }));
    };

    canvasEl.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => canvasEl.removeEventListener("wheel", onNativeWheel);
  }, []);

  useLayoutEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    const rect = canvasEl.getBoundingClientRect();
    const stageOffsetX = stageRef.current?.offsetLeft || 0;
    const stageOffsetY = stageRef.current?.offsetTop || 0;
    const next = {};

    const toStagePoint = (clientX, clientY) => ({
      x: (clientX - rect.left - stageOffsetX - pan.x) / pan.scale,
      y: (clientY - rect.top - stageOffsetY - pan.y) / pan.scale,
    });

    for (const node of nodes) {
      const nodeEl = canvasEl.querySelector(`[data-node-id="${node.id}"]`);
      if (!nodeEl) {
        continue;
      }

      const portMap = {};
      const ports = ["in", ...getPortDefinitions(node).map(port => port.port)];
      for (const port of ports) {
        const portEl = nodeEl.querySelector(`[data-port="${port}"]`);
        if (!portEl) {
          continue;
        }

        const portRect = portEl.getBoundingClientRect();
        const clientX = portRect.left + portRect.width / 2;
        const clientY = portRect.top + portRect.height / 2;
        portMap[port] = toStagePoint(clientX, clientY);
      }

      if (Object.keys(portMap).length) {
        next[node.id] = portMap;
      }
    }

    const nextSignature = JSON.stringify(next);
    if (nextSignature !== portCentersSignatureRef.current) {
      portCentersSignatureRef.current = nextSignature;
      portCentersRef.current = next;
      setPortLayoutRevision(v => v + 1);
    }
  }, [nodes, pan.x, pan.y, pan.scale]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((cmd && (e.key === "y" || (e.key === "z" && e.shiftKey)))) { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selected) { e.preventDefault(); deleteSelected(); }
      else if (e.key === "Escape") { setSelected(null); setLinking(null); }
      else if (cmd && e.key === "d" && selected) { e.preventDefault(); duplicateSelected(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const invalidIds = useMemo(() => {
    const m = {};
    validations.forEach(v => { if (v.target && v.target !== "pathway") m[v.target] = v.level; });
    return m;
  }, [validations]);
  const focusValidationTarget = (target) => {
    if (!target) return;
    setSelected(target);
    setRightTab("props");
    setOpenPanel && setOpenPanel("node");
    flash("Selected " + target + " in the inspector");
  };

  // ---- Node + edge mutation helpers ----
  const updateNode = (id, patch) => setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  const upsertEdge = (fromId, fromPort, toId) => {
    const node = nodes.find(item => item.id === fromId);
    const portMeta = getPortDefinitions(node).find(item => item.port === fromPort);

    setEdges(es => {
      const existing = es.find(edge => edge.from === fromId && edge.fromPort === fromPort);
      if (!toId) {
        return es.filter(edge => !(edge.from === fromId && edge.fromPort === fromPort));
      }

      if (existing) {
        return es.map(edge => edge.id === existing.id ? {
          ...edge,
          to: toId,
          kind: portMeta?.kind || edge.kind,
          label: portMeta?.label || edge.label,
        } : edge);
      }

      return [...es, {
        id: "e" + (Date.now() % 100000) + "-" + fromPort,
        from: fromId,
        fromPort,
        to: toId,
        kind: portMeta?.kind || "pos",
        label: portMeta?.label || fromPort,
      }];
    });
  };
  const deleteSelected = () => {
    if (!selected) return;
    const node = nodes.find(item => item.id === selected);
    if (isRequiredTerminalNode(node)) {
      flash("Required pathway endpoints cannot be deleted");
      return;
    }
    setNodes(ns => ns.filter(n => n.id !== selected));
    _setEdges(es => es.filter(e => e.from !== selected && e.to !== selected));
    setSelected(null);
    flash("Node deleted");
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const n = nodes.find(x => x.id === selected);
    if (!n) return;
    const newId = "n" + (Date.now() % 100000);
    const dup = { ...n, id: newId, x: n.x + 40, y: n.y + 40, label: n.label ? n.label + " (copy)" : undefined };
    setNodes(ns => [...ns, dup]);
    setSelected(newId);
    flash("Duplicated");
  };
  const addReferee = () => {
    const newId = "n" + (Date.now() % 100000);
    setNodes(ns => [...ns, { id: newId, type: "test", testId: "t_cult", x: 1100, y: 600, kind: "referee", label: "Referee on discordance" }]);
    setSelected(newId);
    flash("Referee added");
  };
  const addTerminalNode = () => {
    const picked = window.prompt(
      "Add endpoint type:\n- positive\n- negative\n- inconclusive",
      "inconclusive"
    );
    if (!picked) return;

    const normalized = picked.trim().toLowerCase();
    const subtype = normalized === "positive" || normalized === "pos"
      ? "pos"
      : normalized === "negative" || normalized === "neg"
        ? "neg"
        : normalized === "inconclusive" || normalized === "inc"
          ? "inc"
          : null;

    if (!subtype) {
      flash("Choose positive, negative, or inconclusive");
      return;
    }

    const newId = "n" + (Date.now() % 100000);
    const terminalCount = nodes.filter(node => node.type === "terminal").length;
    const label = subtype === "pos"
      ? "Considered Positive"
      : subtype === "neg"
        ? "Considered Negative"
        : "Inconclusive";

    setNodes(ns => [...ns, {
      id: newId,
      type: "terminal",
      subtype,
      label,
      x: 1120,
      y: 220 + terminalCount * 120,
    }]);
    setSelected(newId);
    flash("Endpoint added");
  };
  const autoLayout = () => {
    // Topological column layout: BFS from entry, group by depth
    const ids = nodes.filter(n => n.type !== "annotation").map(n => n.id);
    const incoming = Object.fromEntries(ids.map(id => [id, 0]));
    edges.forEach(e => { if (incoming[e.to] !== undefined) incoming[e.to]++; });
    const roots = ids.filter(id => incoming[id] === 0);
    const depth = {};
    const queue = roots.map(id => [id, 0]);
    while (queue.length) {
      const [id, d] = queue.shift();
      if (depth[id] !== undefined && depth[id] >= d) continue;
      depth[id] = d;
      edges.filter(e => e.from === id).forEach(e => queue.push([e.to, d+1]));
    }
    const cols = {};
    ids.forEach(id => { const d = depth[id] ?? 0; (cols[d] = cols[d] || []).push(id); });
    setNodes(ns => ns.map(n => {
      const d = depth[n.id];
      if (d === undefined) return n;
      const col = cols[d];
      const idx = col.indexOf(n.id);
      const colCount = col.length;
      const xStep = 340, yStep = 220;
      return { ...n, x: 40 + d * xStep, y: 90 + idx * yStep - (colCount - 1) * yStep / 2 + 240 };
    }));
    flash("Auto-laid out");
  };
  const makeParallelMember = (testId) => ({
    id: `pm-${testId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    testId,
  });
  const addParallelMember = (nodeId, testId) => {
    const test = snapshotTestRecord(testId);
    if (!test) {
      flash("Choose a valid test to add");
      return;
    }

    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId || n.type !== "parallel") return n;
      if ((n.members || []).length >= 2) {
        flash("Parallel blocks are limited to two tests right now");
        return n;
      }
      flash(`Added ${test.name} to the block`);
      return {
        ...n,
        members: [...(n.members || []), {
          ...makeParallelMember(test.id),
          label: test.name,
          icon: test.icon,
          category: test.category,
          sens: test.sens,
          spec: test.spec,
          cost: test.cost,
          tat: test.tat,
          tatUnit: test.tatUnit,
          sample: test.sample,
          skill: test.skill,
        }],
      };
    }));
  };
  const removeParallelMember = (nodeId, memberRef) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId || n.type !== "parallel") return n;
      const members = n.members || [];
      const removeIndex = members.findIndex(member => member.id === memberRef || member.testId === memberRef);
      if (removeIndex < 0) return n;
      const removed = members[removeIndex];
      const nextMembers = [...members.slice(0, removeIndex), ...members.slice(removeIndex + 1)];
      flash(`Removed ${snapshotTestRecord(removed, removed).name || "test"} from the block`);
      return { ...n, members: nextMembers };
    }));
  };
  const updateParallelRule = (nodeId, rule) => {
    setNodes(ns => ns.map(n => n.id === nodeId && n.type === "parallel" ? { ...n, rule } : n));
    flash("Parallel routing updated");
  };
  const groupAsParallel = () => {
    // Pick the two non-referee test nodes adjacent to selected; for the demo, use defaults
    const id = "p" + (Date.now() % 100000);
    setNodes(ns => [...ns, {
      id, type: "parallel", x: 700, y: 600,
      label: "New parallel block",
      members: [],
      rule: "BOTH_POS"
    }]);
    setSelected(id);
    setOpenPanel(null);
    flash("Parallel block created");
  };
  const ungroupParallel = (id) => {
    const n = nodes.find(x => x.id === id);
    if (!n || n.type !== "parallel") return;
    const newNodes = (n.members || []).map((m, i) => ({
      id: id + "_m" + i,
      type: "test",
      testId: m.testId,
      label: m.label || snapshotTestRecord(m, m).name,
      icon: m.icon || snapshotTestRecord(m, m).icon,
      category: m.category || snapshotTestRecord(m, m).category,
      sens: m.sens ?? snapshotTestRecord(m, m).sens,
      spec: m.spec ?? snapshotTestRecord(m, m).spec,
      cost: m.cost ?? snapshotTestRecord(m, m).cost,
      tat: m.tat ?? snapshotTestRecord(m, m).tat,
      tatUnit: m.tatUnit || snapshotTestRecord(m, m).tatUnit,
      sample: m.sample || snapshotTestRecord(m, m).sample,
      skill: m.skill || snapshotTestRecord(m, m).skill,
      x: n.x + i * 280,
      y: n.y - 40
    }));
    setNodes(ns => [...ns.filter(x => x.id !== id), ...newNodes]);
    _setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    setSelected(newNodes[0]?.id || null);
    flash("Block ungrouped");
  };

  const onCanvasMouseDown = e => {
    if (e.target !== canvasRef.current && !e.target.classList.contains("canvas__stage")) return;
    setSelected(null); setLinking(null);
    panRef.current = { down: true, x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    const move = ev => { if (!panRef.current.down) return; setPan(p => ({ ...p, x: panRef.current.ox + (ev.clientX - panRef.current.x), y: panRef.current.oy + (ev.clientY - panRef.current.y) })); };
    const up = () => { panRef.current.down = false; window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  };
  const onWheel = e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setPan(p => ({ ...p, scale: Math.max(0.4, Math.min(2, p.scale - e.deltaY * 0.001)) }));
  };
  const screenToStage = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const stageOffsetX = stageRef.current?.offsetLeft || 0;
    const stageOffsetY = stageRef.current?.offsetTop || 0;
    return {
      x: (clientX - rect.left - stageOffsetX - pan.x) / pan.scale,
      y: (clientY - rect.top - stageOffsetY - pan.y) / pan.scale,
    };
  };
  const dragNode = (id, x, y) => {
    if (snap) { x = Math.round(x / 20) * 20; y = Math.round(y / 20) * 20; }
    skipHistoryRef.current = true;
    _setNodes(ns => ns.map(n => n.id === id ? {...n, x, y} : n));
    skipHistoryRef.current = false;
  };
  const dragNodeStart = () => { pushHistory(); };
  const onDrop = e => {
    e.preventDefault();
    const draggedTest = window.OptiDxDraggingTest || null;
    const testId = e.dataTransfer.getData("text/testId") || e.dataTransfer.getData("text/plain") || draggedTest?.id || "";
    if (!testId) return;
    const droppedTest = snapshotTestRecord(draggedTest || testId);
    const { x, y } = screenToStage(e.clientX, e.clientY);

    const getBounds = node => {
      if (!node) return null;
      if (node.type === "parallel") return { left: node.x, top: node.y, right: node.x + PW, bottom: node.y + PH };
      if (node.type === "terminal") return { left: node.x, top: node.y, right: node.x + TW, bottom: node.y + TH };
      if (node.type === "test") return { left: node.x, top: node.y, right: node.x + NW, bottom: node.y + NH };
      return null;
    };

    const target = [...nodes].reverse().find(node => {
      const bounds = getBounds(node);
      return bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
    });

    if (target?.type === "parallel") {
      addParallelMember(target.id, droppedTest);
      setSelected(target.id);
      return;
    }

    if (target?.type === "test") {
      const targetTest = snapshotTestRecord(target.testId, target);

      setNodes(ns => ns.map(node => {
        if (node.id !== target.id) return node;
        return {
          ...node,
          type: "parallel",
          label: node.label || "Parallel block",
          rule: node.rule || "BOTH_POS",
          members: [
            {
              ...makeParallelMember(targetTest.id),
              label: targetTest.name,
              icon: targetTest.icon,
              category: targetTest.category,
              sens: targetTest.sens,
              spec: targetTest.spec,
              cost: targetTest.cost,
              tat: targetTest.tat,
              tatUnit: targetTest.tatUnit,
              sample: targetTest.sample,
              skill: targetTest.skill,
            },
            {
              ...makeParallelMember(droppedTest.id),
              label: droppedTest.name,
              icon: droppedTest.icon,
              category: droppedTest.category,
              sens: droppedTest.sens,
              spec: droppedTest.spec,
              cost: droppedTest.cost,
              tat: droppedTest.tat,
              tatUnit: droppedTest.tatUnit,
              sample: droppedTest.sample,
              skill: droppedTest.skill,
            },
          ],
        };
      }));

      setEdges(es => es.map(edge => {
        if (edge.from !== target.id) return edge;
        if (edge.fromPort === "pos") return { ...edge, fromPort: "both_pos", kind: "pos", label: "Both positive" };
        if (edge.fromPort === "neg") return { ...edge, fromPort: "both_neg", kind: "neg", label: "Both negative" };
        return edge;
      }));

      setSelected(target.id);
      flash(`Grouped ${droppedTest.name} with ${targetTest.name}`);
      return;
    }

    const newId = "n" + (Date.now() % 100000);
    setNodes(ns => [...ns, {
      id: newId,
      type: "test",
      testId: droppedTest.id,
      label: droppedTest.name,
      icon: droppedTest.icon,
      category: droppedTest.category,
      sens: droppedTest.sens,
      spec: droppedTest.spec,
      cost: droppedTest.cost,
      tat: droppedTest.tat,
      tatUnit: droppedTest.tatUnit,
      sample: droppedTest.sample,
      skill: droppedTest.skill,
      x: x - 100,
      y: y - 40,
    }]);
    setSelected(newId);
    flash("Test added — wire it up via the output ports");
  };

  // ---- Edge linking interaction (click an output port → click a node) ----
  const startLink = (fromId, port, kind) => (e) => {
    e.stopPropagation();
    const { x, y } = screenToStage(e.clientX, e.clientY);
    setLinking({ fromId, fromPort: port, kind, x, y });
    const move = (ev) => {
      const p = screenToStage(ev.clientX, ev.clientY);
      setLinking(l => l ? { ...l, x: p.x, y: p.y } : null);
    };
    const up = (ev) => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      const tgt = ev.target.closest && ev.target.closest("[data-node-id]");
      if (tgt) {
        const toId = tgt.getAttribute("data-node-id");
        if (toId !== fromId) {
          const newEdge = {
            id: "e" + (Date.now() % 100000),
            from: fromId, fromPort: port, to: toId, kind,
            label: kind === "pos" ? "Positive" : kind === "neg" ? "Negative" : kind === "disc" ? "Discordant" : "Inconclusive"
          };
          setEdges(es => [...es, newEdge]);
          flash("Edge added");
        }
      }
      setLinking(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const NW = 240, NH = 130, PW = 280, PH = 220, TW = 180, TH = 80;
  const STAGE_WIDTH = 2400;
  const STAGE_HEIGHT = 1400;
  const TEST_PORT_POS_Y = NH - 68;
  const TEST_PORT_NEG_Y = NH - 12;
  const PARALLEL_PORT_POS_Y = PH - 92;
  const PARALLEL_PORT_DISC_Y = PH - 48;
  const PARALLEL_PORT_NEG_Y = PH - 4;
  const nodePoint = (id, port) => {
    const n = nodes.find(x => x.id === id);
    if (!n) return { x: 0, y: 0 };
    const measuredPoint = portCentersRef.current?.[id]?.[port];
    if (measuredPoint) {
      return measuredPoint;
    }
    if (n.type === "test") {
      if (port === "in")  return { x: n.x, y: n.y + NH/2 };
      if (port === "pos") return { x: n.x + NW, y: n.y + TEST_PORT_POS_Y };
      if (port === "neg") return { x: n.x + NW, y: n.y + TEST_PORT_NEG_Y };
      return { x: n.x + NW, y: n.y + NH/2 };
    }
    if (n.type === "parallel") {
      if (port === "in")        return { x: n.x, y: n.y + PH/2 };
      if (port === "both_pos")  return { x: n.x + PW, y: n.y + PARALLEL_PORT_POS_Y };
      if (port === "discord")   return { x: n.x + PW, y: n.y + PARALLEL_PORT_DISC_Y };
      if (port === "both_neg")  return { x: n.x + PW, y: n.y + PARALLEL_PORT_NEG_Y };
      return { x: n.x + PW, y: n.y + PH/2 };
    }
    if (n.type === "terminal") return { x: n.x, y: n.y + TH/2 };
    return { x: n.x, y: n.y + 20 };
  };

  // Smart bezier routing — gives discordance branches a visible curve
  const pathD = (a, b, kind) => {
    const dx = Math.max(110, Math.abs(b.x - a.x) * 0.42);
    const yOffset = kind === "disc" ? 42 : kind === "inc" ? -26 : 0;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y + yOffset}, ${b.x - dx} ${b.y - yOffset}, ${b.x} ${b.y}`;
  };

  const canvasStyle = variant === "B" ? {
    backgroundImage: "linear-gradient(var(--canvas-grid) 1px, transparent 1px), linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px)",
    backgroundSize: "24px 24px", backgroundColor: "#FBFBFC"
  } : undefined;

  const errCount = validations.filter(v => v.level === "error").length;
  const warnCount = validations.filter(v => v.level === "warn").length;
  const infoCount = validations.filter(v => v.level === "info").length;
  const selectedNode = nodes.find(node => node.id === selected) || null;
  const selectedNodeLocked = isRequiredTerminalNode(selectedNode);

  return (
    <div className={"canvas-layout" + (libCollapsed ? " is-lib-collapsed" : "") + (propsCollapsed ? " is-props-collapsed" : "")}>
      <TestLibrary collapsed={libCollapsed} onToggle={() => setLibCollapsed(c => !c)}/>

      <div className="canvas" ref={canvasRef}
        style={canvasStyle}
        onMouseDown={onCanvasMouseDown}
        onWheel={e => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }}
        onDragOver={e => e.preventDefault()}
        onDrop={onDrop}>

        <div className="canvas__toolbar">
          <div className="btn-group">
            <button className="btn btn--sm" title="Undo (⌘Z)" onClick={undo}><Icon name="undo" size={12}/></button>
            <button className="btn btn--sm" title="Redo (⇧⌘Z)" onClick={redo}><Icon name="redo" size={12}/></button>
          </div>
          <div className="btn-group">
            <button className={"btn btn--sm" + (snap ? " btn--ink" : "")} onClick={() => setSnap(s => !s)} title="Snap to 20px grid"><Icon name="grid" size={12}/>Snap</button>
            <button className="btn btn--sm" onClick={autoLayout} title="Re-flow nodes into columns"><Icon name="wand" size={12}/>Auto-layout</button>
          </div>
          <button className="btn btn--sm" onClick={groupAsParallel}>
            <Icon name="merge" size={12}/>Group as parallel
          </button>
          <button className="btn btn--sm" onClick={addReferee}>
            <Icon name="git-branch" size={12}/>Add referee test
          </button>
          <button className="btn btn--sm" onClick={addTerminalNode}>
            <Icon name="plus" size={12}/>Add endpoint
          </button>
          {selected && (
            <button
              className="btn btn--sm"
              onClick={deleteSelected}
              disabled={selectedNodeLocked}
              title={selectedNodeLocked ? "Required endpoints cannot be deleted" : "Delete selected (Del)"}
              style={{marginLeft:"auto", opacity: selectedNodeLocked ? 0.55 : 1}}
            >
              <Icon name="trash" size={12}/>Delete
            </button>
          )}
        </div>

        <div className="canvas__status">
          <span className={"canvas__status-dot " + (errCount ? "is-err" : warnCount ? "is-warn" : "is-ok")}/>
          <b>{errCount ? "Invalid" : warnCount ? "Valid with warnings" : "Valid"}</b>
          <span className="canvas__status-sep"/>
          <span className="canvas__status-meta">
            {nodes.length} nodes · {edges.length} edges · {livePaths.length} terminal paths
          </span>
          {toast && (
            <span style={{
              marginLeft:14, padding:"4px 10px", borderRadius:6,
              background:"var(--sme-ink-900)", color:"#fff", fontSize:11, fontWeight:600,
              whiteSpace:"nowrap", animation:"toast-fade 1.6s ease forwards"
            }}>{toast}</span>
          )}
        </div>

        <div className="canvas__legend">
          <div className="canvas__legend-title">Branches</div>
          <span className="legend-item"><span className="legend-swatch legend-swatch--pos"/>Positive</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch--neg"/>Negative</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch--disc"/>Discordant</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch--inc"/>Inconclusive</span>
          <span className="legend-item"><span className="legend-swatch legend-swatch--ref"/>Referee</span>
        </div>

        <div ref={stageRef} className="canvas__stage" style={{transform:`translate(${pan.x}px, ${pan.y}px) scale(${pan.scale})`}}>
          <svg className="canvas__edges" style={{width: STAGE_WIDTH, height: STAGE_HEIGHT}}>
            <defs>
              {["pos","neg","disc","inc"].map(k => (
                <marker key={k} id={"arrow-"+k} viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={`var(--branch-${k})`}/>
                </marker>
              ))}
            </defs>
            {edges.map(e => {
              const k = e.kind || "pos";
              const a = nodePoint(e.from, e.fromPort);
              const b = nodePoint(e.to, "in");
              return (
                <g key={e.id}>
                  <path className={"edge-path edge-path--" + k} d={pathD(a, b, k)}
                    markerEnd={`url(#arrow-${k})`}/>
                </g>
              );
            })}
            {linking && (() => {
              const a = nodePoint(linking.fromId, linking.fromPort);
              return <path className={"edge-path edge-path--" + linking.kind} d={pathD(a, {x: linking.x, y: linking.y}, linking.kind)}
                style={{strokeDasharray:"6 4", opacity:0.7}}/>;
            })()}
          </svg>

          {edges.map(e => {
            const k = e.kind || "pos";
            const a = nodePoint(e.from, e.fromPort);
            const b = nodePoint(e.to, "in");
            const mx = (a.x + b.x)/2, my = (a.y + b.y)/2 - 8;
            return (
              <div key={"lab-"+e.id} className="edge-label-wrap" style={{left:mx, top:my}}>
                <span className={"edge-label edge-label--" + k}
                  onClick={(ev) => { ev.stopPropagation(); if (window.confirm("Delete this edge?")) { setEdges(es => es.filter(x => x.id !== e.id)); flash("Edge deleted"); } }}
                  style={{cursor:"pointer"}}
                  title="Click to delete edge">
                  <span className={"branch-dot branch-dot--" + k}/>
                  {e.label}
                </span>
              </div>
            );
          })}

          {nodes.map(n => {
            const inv = invalidIds[n.id] || (n.id === "n3" ? "info" : null);
            if (n.type === "test") {
              const test = getRenderableTest(n.testId, n.label);
              return <NodeTestCard key={n.id} node={n} test={test}
                selected={selected === n.id}
                invalid={inv === "error"}
                isReferee={n.kind === "referee"}
                onSelect={id => { setSelected(id); setOpenPanel("node"); }}
                onDragNode={dragNode} onDragNodeStart={dragNodeStart}
                onPortDown={startLink}/>;
            }
            if (n.type === "parallel") {
              return <NodeParallel key={n.id} node={n}
                selected={selected === n.id}
                invalid={inv === "error"}
                onSelect={id => { setSelected(id); setOpenPanel("node"); }}
                onDragNode={dragNode} onDragNodeStart={dragNodeStart}
                onPortDown={startLink}
                onAddMember={addParallelMember}
                onRemoveMember={removeParallelMember}/>;
            }
            if (n.type === "terminal") {
              return <NodeTerminal key={n.id} node={n}
                selected={selected === n.id}
                invalid={inv === "error"}
                onSelect={setSelected} onDragNode={dragNode} onDragNodeStart={dragNodeStart}/>;
            }
            if (n.type === "annotation") {
              return <NodeAnnotation key={n.id} node={n} onDragNode={dragNode}/>;
            }
            return null;
          })}
        </div>

        <div className="canvas__controls">
          <button onClick={() => setPan(p => ({...p, scale: Math.min(2, p.scale + 0.1)}))}><Icon name="zoom-in" size={14}/></button>
          <button onClick={() => setPan(p => ({...p, scale: Math.max(0.4, p.scale - 0.1)}))}><Icon name="zoom-out" size={14}/></button>
          <button onClick={() => setPan({x:0,y:0,scale:1})}><Icon name="maximize" size={14}/></button>
        </div>

        <div className="canvas__minimap">
          <svg viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} width="100%" height="100%">
            {edges.map(e => {
              const a = nodePoint(e.from, e.fromPort);
              const b = nodePoint(e.to, "in");
              return <path key={e.id} d={pathD(a,b)} fill="none" stroke="#9A9FA4" strokeWidth="3"/>;
            })}
            {nodes.filter(n => n.type !== "annotation").map(n => {
              const w = n.type === "parallel" ? PW : n.type === "terminal" ? TW : NW;
              const h = n.type === "parallel" ? PH : n.type === "terminal" ? TH : NH;
              return <rect key={n.id} x={n.x} y={n.y} width={w} height={h}
                fill={n.type === "terminal" ? "var(--branch-pos-050)" : n.type === "parallel" ? "var(--sme-orange-050)" : "#fff"}
                stroke="#4A5056" strokeWidth="2" rx="4"/>;
            })}
            {(() => {
              const canvasRect = canvasRef.current?.getBoundingClientRect();
              if (!canvasRect || !pan.scale) {
                return null;
              }

              const viewport = {
                x: Math.max(0, (-pan.x) / pan.scale),
                y: Math.max(0, (-pan.y) / pan.scale),
                width: Math.min(STAGE_WIDTH, canvasRect.width / pan.scale),
                height: Math.min(STAGE_HEIGHT, canvasRect.height / pan.scale),
              };

              return (
                <rect
                  className="minimap__viewport"
                  x={viewport.x}
                  y={viewport.y}
                  width={viewport.width}
                  height={viewport.height}
                  rx="3"
                />
              );
            })()}
          </svg>
        </div>
      </div>

      <aside className="side side--right" style={{position:"relative"}}>
        {propsCollapsed && (
          <div className="panel-collapsed-label">Properties · Paths · Validate</div>
        )}
        <div className="props__tabs">
          <button className={"props__tab " + (rightTab==="props"?"is-active":"")} onClick={()=>setRightTab("props")}>
            <Icon name="settings" size={11}/>Properties
          </button>
          <button className={"props__tab " + (rightTab==="paths"?"is-active":"")} onClick={()=>setRightTab("paths")}>
            <Icon name="git-branch" size={11}/>Paths
            <span className="props__tab-badge">{livePaths.length}</span>
          </button>
          <button className={"props__tab " + (rightTab==="validate"?"is-active":"")} onClick={()=>setRightTab("validate")}>
            <Icon name="alert-triangle" size={11}/>Validate
            <span className={"props__tab-badge " + (warnCount ? "is-warn" : "is-ok")}>{warnCount + errCount + infoCount}</span>
          </button>
        </div>
        <div className="props__body side__body scroll" style={{padding:0}}>
          {rightTab === "props" && <PropertiesPanel selected={selected} nodes={nodes} edges={edges} setOpenPanel={setOpenPanel}
            updateNode={updateNode} deleteNode={deleteSelected} duplicateNode={duplicateSelected}
            ungroupParallel={ungroupParallel} addParallelMember={addParallelMember}
            removeParallelMember={removeParallelMember} updateParallelRule={updateParallelRule} upsertEdge={upsertEdge}/>}
          {rightTab === "paths" && <LivePathExplorer paths={livePaths}/>}
          {rightTab === "validate" && <LiveValidationPanel validations={validations} focusValidationTarget={focusValidationTarget}/>}
        </div>
        <button className="panel-collapse panel-collapse--props" onClick={() => setPropsCollapsed(c => !c)}
          title={propsCollapsed ? "Expand inspector" : "Collapse inspector"}>
          <Icon name={propsCollapsed ? "chevron-left" : "chevron-right"} size={12}/>
        </button>
      </aside>
    </div>
  );
}

// ---------- Path Explorer ----------
function LivePathExplorer({ paths }) {
  return (
    <div>
      <div className="props__section">
        <h4>Path explorer</h4>
        <div style={{fontSize:11.5, color:"var(--fg-3)", lineHeight:1.5, marginTop:-4}}>
          Every root-to-terminal path the engine evaluates. Each row is a complete pathway with its likelihoods, expected cost and TAT.
        </div>
      </div>
      {paths.map(p => (
        <div key={p.id} className="path-row">
          <div className="path-row__head">
            <div className="path-row__id">{p.id}</div>
            <div className={"path-row__terminal path-row__terminal--" + p.terminalKind}>
              <Icon name={p.terminalKind === "pos" ? "check" : p.terminalKind === "inc" ? "help" : "x"} size={10}/>
              {p.terminal}
            </div>
          </div>
          <div className="path-row__seq">
            {p.sequence.map((s,i) => (
              <React.Fragment key={i}>
                <span className={"path-step path-step--" + s.kind}>{s.label}</span>
                {i < p.sequence.length - 1 && <Icon name="arrow-right" size={9} style={{color:"var(--fg-4)"}}/>}
              </React.Fragment>
            ))}
          </div>
          <div className="path-row__metrics">
            <div><span>P( · | D⁺ )</span><b className="mono">{formatPathMetric(p.pIfD)}</b></div>
            <div><span>P( · | D⁻ )</span><b className="mono">{formatPathMetric(p.pIfND)}</b></div>
            <div><span>E[cost]</span><b className="mono">${formatPathMetric(p.cost)}</b></div>
            <div><span>E[TAT]</span><b className="mono">{formatPathMetric(p.tat)}</b></div>
          </div>
          <div className="path-row__foot">
            <span className="chip chip--outline">{p.samples}</span>
            <span className="chip chip--outline">{p.skill}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Validation Panel ----------
function ValidationPanel() {
  const v = Array.isArray(window.SEED_VALIDATIONS) ? window.SEED_VALIDATIONS : [];
  const errs = v.filter(x => x.level === "error");
  const warns = v.filter(x => x.level === "warn");
  const infos = v.filter(x => x.level === "info");
  return (
    <div>
      <div className="props__section">
        <h4>Pathway validation</h4>
        <div className="valid-summary">
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--err"/><b>{errs.length}</b><span>errors</span></div>
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--warn"/><b>{warns.length}</b><span>warnings</span></div>
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--info"/><b>{infos.length}</b><span>notes</span></div>
        </div>
      </div>
      {[...errs, ...warns, ...infos].map(item => (
        <div key={item.id} className={"valid-card valid-card--" + item.level}>
          <div className="valid-card__head">
            <Icon name={item.level === "error" ? "alert-circle" : item.level === "warn" ? "alert-triangle" : "info"} size={12}/>
            <span>{item.title}</span>
          </div>
          <div className="valid-card__detail">{item.detail}</div>
          <div className="valid-card__fix"><b>Suggested fix.</b> {item.fix}</div>
          {item.target && item.target !== "pathway" && (
            <button className="valid-card__locate" onClick={() => focusValidationTarget(item.target)}><Icon name="crosshair" size={10}/>Locate on canvas</button>
          )}
        </div>
      ))}
    </div>
  );
}

function PathExplorer({ paths }) {
  return (
    <div>
      <div className="props__section">
        <h4>Path explorer</h4>
        <div style={{fontSize:11.5, color:"var(--fg-3)", lineHeight:1.5, marginTop:-4}}>
          Every root-to-terminal path in the live canonical pathway. Metrics populate after a successful run.
        </div>
      </div>
      {paths.map(p => (
        <div key={p.id} className="path-row">
          <div className="path-row__head">
            <div className="path-row__id">{p.id}</div>
            <div className={"path-row__terminal path-row__terminal--" + p.terminalKind}>
              <Icon name={p.terminalKind === "pos" ? "check" : p.terminalKind === "inc" ? "help" : "x"} size={10}/>
              {p.terminal}
            </div>
          </div>
          <div className="path-row__seq">
            {p.sequence.map((s,i) => (
              <React.Fragment key={i}>
                <span className={"path-step path-step--" + s.kind}>{s.label}</span>
                {i < p.sequence.length - 1 && <Icon name="arrow-right" size={9} style={{color:"var(--fg-4)"}}/>}
              </React.Fragment>
            ))}
          </div>
          <div className="path-row__metrics">
            <div><span>P( · | D+ )</span><b className="mono">{formatMetricValue(p.pIfD, value => Number(value).toFixed(2))}</b></div>
            <div><span>P( · | D- )</span><b className="mono">{formatMetricValue(p.pIfND, value => Number(value).toFixed(2))}</b></div>
            <div><span>E[cost]</span><b className="mono">{formatMetricValue(p.cost, value => `$${Number(value).toFixed(2)}`)}</b></div>
            <div><span>E[TAT]</span><b className="mono">{formatMetricValue(p.tat)}</b></div>
          </div>
          <div className="path-row__foot">
            <span className="chip chip--outline">{formatMetricValue(p.samples)}</span>
            <span className="chip chip--outline">{formatMetricValue(p.skill)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveValidationPanel({ validations, focusValidationTarget }) {
  const errs = validations.filter(x => x.level === "error");
  const warns = validations.filter(x => x.level === "warn");
  const infos = validations.filter(x => x.level === "info");
  return (
    <div>
      <div className="props__section">
        <h4>Pathway validation</h4>
        <div className="valid-summary">
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--err"/><b>{errs.length}</b><span>errors</span></div>
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--warn"/><b>{warns.length}</b><span>warnings</span></div>
          <div className="valid-summary__cell"><span className="valid-dot valid-dot--info"/><b>{infos.length}</b><span>notes</span></div>
        </div>
      </div>
      {[...errs, ...warns, ...infos].map(item => (
        <div key={item.id} className={"valid-card valid-card--" + item.level}>
          <div className="valid-card__head">
            <Icon name={item.level === "error" ? "alert-circle" : item.level === "warn" ? "alert-triangle" : "info"} size={12}/>
            <span>{item.title}</span>
          </div>
          <div className="valid-card__detail">{item.detail}</div>
          <div className="valid-card__fix"><b>Suggested fix.</b> {item.fix}</div>
          {item.target && item.target !== "pathway" && (
            <button className="valid-card__locate" onClick={() => focusValidationTarget(item.target)}><Icon name="crosshair" size={10}/>Locate on canvas</button>
          )}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  ScreenCanvas,
  TestCard,
  TestLibrary,
  PathExplorer: LivePathExplorer,
  ValidationPanel: LiveValidationPanel,
});
import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
