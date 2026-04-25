// Canvas — interactive workflow builder (probabilistic pathway modeller)

// ---------- Test library card (left rail) ----------
function TestCard({ test, draggable = true, onDragStart }) {
  return (
    <div className="test-card" draggable={draggable}
      onDragStart={e => { e.dataTransfer.setData("text/testId", test.id); onDragStart && onDragStart(test); }}>
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
  const filtered = window.SEED_TESTS.filter(t =>
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
      <div className="port port--in"/>
      <div className="port port--out pos" title="Drag to wire positive branch" onMouseDown={onPortDown && onPortDown(node.id, "pos", "pos")}/>
      <div className="port port--out neg" title="Drag to wire negative branch" onMouseDown={onPortDown && onPortDown(node.id, "neg", "neg")}/>
    </div>
  );
}

// ---------- Parallel block ----------
function NodeParallel({ node, selected, onSelect, onDragNode, onDragNodeStart, invalid, onPortDown }) {
  const drag = useRef({});
  const tests = (node.members || []).map(m => window.SEED_TESTS.find(t => t.id === m.testId)).filter(Boolean);
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
      onClick={e => { e.stopPropagation(); onSelect(node.id); }}>
      <div className="parallel__label"><Icon name="merge" size={10}/>Parallel testing block</div>
      <div className="parallel__title">{node.label || "Parallel block"}</div>
      <div className="parallel__inner">
        {tests.map((t,i) => (
          <div className="parallel__row" key={i}>
            <Icon name={t.icon} size={11}/>
            <span className="parallel__name">{t.name}</span>
            <span className="mono parallel__se">Se {t.sens.toFixed(2)}</span>
            <span className="mono parallel__sp">Sp {t.spec.toFixed(2)}</span>
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
      <div className="port port--in"/>
      <div className="port port--out pos parallel__port--bp" onMouseDown={onPortDown && onPortDown(node.id, "both_pos", "pos")}/>
      <div className="port port--out disc parallel__port--d" onMouseDown={onPortDown && onPortDown(node.id, "discord", "disc")}/>
      <div className="port port--out neg parallel__port--bn" onMouseDown={onPortDown && onPortDown(node.id, "both_neg", "neg")}/>
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
  const subLabel = node.subtype === "pos" ? "Final positive" : node.subtype === "neg" ? "Final negative" : node.subtype === "inc" ? "Inconclusive" : "Refer";
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
      <div className="port port--in"/>
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
  const normalized = window.OptiDxActions?.normalizePathwayGraph?.(pathway) || pathway || {};
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

// ---------- Canvas ----------
function ScreenCanvas({ variant = "A", openPanel, setOpenPanel }) {
  const initialGraph = hydrateCanvasGraph(window.OptiDxCanvasDraft || window.OptiDxCurrentPathway || window.SEED_PATHWAY || {
    nodes: window.SEED_NODES,
    edges: window.SEED_EDGES,
  });
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

  useEffect(() => {
    const canonical = window.OptiDxActions?.buildCanonicalPathway?.({
      schema_version: window.OptiDxCanvasDraft?.schema_version || window.OptiDxCurrentPathway?.schema_version || 'canvas-v1',
      nodes,
      edges,
      metadata: window.OptiDxCanvasMeta || window.OptiDxCanvasDraft?.metadata || window.OptiDxCurrentPathway?.metadata || { label: "TB Community Screening" },
    }) || null;

    window.OptiDxCanvasState = {
      nodes: nodes.map(n => ({
        ...n,
        members: n.members ? n.members.map(m => ({ ...m })) : undefined,
      })),
      edges: edges.map(e => ({ ...e })),
    };
    window.OptiDxCanvasMeta = canonical?.metadata || { label: "TB Community Screening" };
    window.OptiDxCurrentPathway = canonical;
    window.OptiDxCanvasDraft = canonical;
    window.SEED_PATHWAY = canonical;
  }, [nodes, edges]);

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
    window.SEED_VALIDATIONS.forEach(v => { if (v.target && v.target !== "pathway") m[v.target] = v.level; });
    return m;
  }, []);
  const focusValidationTarget = (target) => {
    if (!target) return;
    setSelected(target);
    setRightTab("props");
    setOpenPanel && setOpenPanel("node");
    flash("Selected " + target + " in the inspector");
  };

  // ---- Node + edge mutation helpers ----
  const updateNode = (id, patch) => setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
  const deleteSelected = () => {
    if (!selected) return;
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
  const addParallelMember = (nodeId, testId) => {
    const test = window.SEED_TESTS.find(t => t.id === testId);
    if (!test) {
      flash("Choose a valid test to add");
      return;
    }

    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId || n.type !== "parallel") return n;
      const members = n.members ? [...n.members] : [];
      if (members.some(m => m.testId === testId)) {
        flash("That test is already in the block");
        return n;
      }
      flash(`Added ${test.name} to the block`);
      return { ...n, members: [...members, { testId }] };
    }));
  };
  const removeParallelMember = (nodeId, testId) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId || n.type !== "parallel") return n;
      const members = (n.members || []).filter(m => m.testId !== testId);
      flash(`Removed ${window.SEED_TESTS.find(t => t.id === testId)?.name || "test"} from the block`);
      return { ...n, members };
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
      members: [ { testId: "t_xpert" }, { testId: "t_smear" } ],
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
      id: id + "_m" + i, type: "test", testId: m.testId,
      x: n.x + i * 280, y: n.y - 40
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
    return { x: (clientX - rect.left - pan.x) / pan.scale, y: (clientY - rect.top - pan.y) / pan.scale };
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
    const testId = e.dataTransfer.getData("text/testId");
    if (!testId) return;
    const { x, y } = screenToStage(e.clientX, e.clientY);
    const newId = "n" + (Date.now() % 100000);
    setNodes(ns => [...ns, { id: newId, type:"test", testId, x: x - 100, y: y - 40 }]);
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
  const nodePoint = (id, port) => {
    const n = nodes.find(x => x.id === id);
    if (!n) return { x: 0, y: 0 };
    if (n.type === "test") {
      const isRef = n.kind === "referee";
      if (port === "in")  return { x: n.x, y: n.y + NH/2 };
      if (port === "pos") return { x: n.x + NW, y: n.y + 92 };
      if (port === "neg") return { x: n.x + NW, y: n.y + 114 };
      return { x: n.x + NW, y: n.y + NH/2 };
    }
    if (n.type === "parallel") {
      if (port === "in")        return { x: n.x, y: n.y + PH/2 };
      if (port === "both_pos")  return { x: n.x + PW, y: n.y + 86 };
      if (port === "discord")   return { x: n.x + PW, y: n.y + 126 };
      if (port === "both_neg")  return { x: n.x + PW, y: n.y + 166 };
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

  const validations = window.SEED_VALIDATIONS;
  const errCount = validations.filter(v => v.level === "error").length;
  const warnCount = validations.filter(v => v.level === "warn").length;
  const infoCount = validations.filter(v => v.level === "info").length;

  return (
    <div className={"canvas-layout" + (libCollapsed ? " is-lib-collapsed" : "") + (propsCollapsed ? " is-props-collapsed" : "")}>
      <TestLibrary collapsed={libCollapsed} onToggle={() => setLibCollapsed(c => !c)}/>

      <div className="canvas" ref={canvasRef}
        style={canvasStyle}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
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
          {selected && (
            <button className="btn btn--sm" onClick={deleteSelected} title="Delete selected (Del)" style={{marginLeft:"auto"}}>
              <Icon name="trash" size={12}/>Delete
            </button>
          )}
        </div>

        <div className="canvas__status">
          <span className={"canvas__status-dot " + (errCount ? "is-err" : warnCount ? "is-warn" : "is-ok")}/>
          <b>{errCount ? "Invalid" : warnCount ? "Valid with warnings" : "Valid"}</b>
          <span className="canvas__status-sep"/>
          <span className="canvas__status-meta">
            {nodes.length} nodes · {edges.length} edges · {window.SEED_PATHS.length} terminal paths
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

        <div className="canvas__stage" style={{transform:`translate(${pan.x}px, ${pan.y}px) scale(${pan.scale})`}}>
          <svg className="canvas__edges" style={{width: 2400, height: 1400}}>
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
              const test = window.SEED_TESTS.find(t => t.id === n.testId);
              if (!test) return null;
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
                onPortDown={startLink}/>;
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
          <svg viewBox="-50 100 1500 700" width="100%" height="100%">
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
          </svg>
          <div className="minimap__viewport" style={{left:20,top:30,width:80,height:50}}/>
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
            <span className="props__tab-badge">{window.SEED_PATHS.length}</span>
          </button>
          <button className={"props__tab " + (rightTab==="validate"?"is-active":"")} onClick={()=>setRightTab("validate")}>
            <Icon name="alert-triangle" size={11}/>Validate
            <span className={"props__tab-badge " + (warnCount ? "is-warn" : "is-ok")}>{warnCount + errCount + infoCount}</span>
          </button>
        </div>
        <div className="props__body side__body scroll" style={{padding:0}}>
          {rightTab === "props" && <PropertiesPanel selected={selected} nodes={nodes} setOpenPanel={setOpenPanel}
            updateNode={updateNode} deleteNode={deleteSelected} duplicateNode={duplicateSelected}
            ungroupParallel={ungroupParallel} addParallelMember={addParallelMember}
            removeParallelMember={removeParallelMember} updateParallelRule={updateParallelRule}/>}
          {rightTab === "paths" && <PathExplorer/>}
          {rightTab === "validate" && <ValidationPanel/>}
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
function PathExplorer() {
  const paths = window.SEED_PATHS;
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
            <div><span>P( · | D⁺ )</span><b className="mono">{p.pIfD.toFixed(3)}</b></div>
            <div><span>P( · | D⁻ )</span><b className="mono">{p.pIfND.toFixed(3)}</b></div>
            <div><span>E[cost]</span><b className="mono">${p.cost.toFixed(2)}</b></div>
            <div><span>E[TAT]</span><b className="mono">{p.tat}</b></div>
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
  const v = window.SEED_VALIDATIONS;
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

Object.assign(window, { ScreenCanvas, TestCard, TestLibrary, PathExplorer, ValidationPanel });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
