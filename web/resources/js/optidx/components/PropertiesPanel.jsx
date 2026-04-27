// Properties panel — context-sensitive right sidebar with rich condition builder
function isLockedTerminalNode(node) {
  return node?.type === "terminal" && (node.terminalRole === "required_positive" || node.terminalRole === "required_negative");
}

function getPanelTestCatalog() {
  const workspaceTests = window.OptiDxActions?.getWorkspaceTests?.();
  return Array.isArray(workspaceTests)
    ? workspaceTests
    : Array.isArray(window.SEED_TESTS)
      ? window.SEED_TESTS
      : [];
}

function normalizePanelText(value, fallback = "") {
  if (value == null) {
    return fallback;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    return normalizePanelText(
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

function normalizePanelRenderableTest(testRef, fallbackLabel = null) {
  const id = normalizePanelText(testRef?.id ?? testRef?.testId ?? fallbackLabel, "test");
  const sens = Number(testRef?.sens ?? testRef?.sensitivity ?? 0);
  const spec = Number(testRef?.spec ?? testRef?.specificity ?? 0);
  const cost = Number(testRef?.cost ?? 0);
  const tat = Number(testRef?.tat ?? testRef?.turnaround_time ?? 0);

  return {
    id,
    name: normalizePanelText(testRef?.name ?? testRef?.label ?? testRef?.test ?? fallbackLabel, id),
    icon: normalizePanelText(testRef?.icon, "flask-conical"),
    category: normalizePanelText(testRef?.category, "clinical"),
    sens: Number.isFinite(sens) ? sens : 0,
    spec: Number.isFinite(spec) ? spec : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    tat: Number.isFinite(tat) ? tat : 0,
    tatUnit: normalizePanelText(testRef?.tatUnit ?? testRef?.turnaround_time_unit, "min"),
    sample: normalizePanelText(testRef?.sample, testRef?.sample_types?.[0] || "n/a"),
    sample_types: Array.isArray(testRef?.sample_types) ? testRef.sample_types.filter(Boolean).map(item => normalizePanelText(item)).filter(Boolean) : [],
    skill: normalizePanelText(testRef?.skill, testRef?.skill_level || "n/a"),
    skill_level: testRef?.skill_level ?? null,
    evidence: normalizePanelText(testRef?.evidence ?? testRef?.provenance?.source, "Workspace record"),
  };
}

function parsePanelSkillLevel(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(5, Math.round(value)));
  }

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return Math.max(0, Math.min(5, Math.round(numeric)));
  }

  const label = String(value).toLowerCase();
  if (label.includes("chw") || label.includes("self")) return 1;
  if (label.includes("nurse")) return 2;
  if (label.includes("lab")) return 3;
  if (label.includes("radiolog") || label.includes("specialist") || label.includes("patholog")) return 4;
  return null;
}

function formatPanelSkillLabel(level) {
  if (level == null || level === "") {
    return "n/a";
  }

  const numeric = Number(level);
  if (Number.isNaN(numeric)) {
    return String(level);
  }

  const labels = {
    1: "CHW / self",
    2: "Nurse",
    3: "Lab tech",
    4: "Specialist",
    5: "Specialist",
  };

  return labels[numeric] || `Skill ${numeric}`;
}

function getPanelRenderableTest(testRef, fallbackLabel = null) {
  const catalog = getPanelTestCatalog();
  const lookupId = typeof testRef === "string"
    ? testRef
    : testRef?.testId ?? testRef?.id ?? fallbackLabel ?? null;

  if (lookupId != null) {
    const found = catalog.find(item => String(item.id) === String(lookupId));
    if (found) {
      return normalizePanelRenderableTest(found, fallbackLabel);
    }
  }

  if (testRef && typeof testRef === "object") {
    return normalizePanelRenderableTest(testRef, fallbackLabel);
  }

  const resolvedId = String(lookupId ?? fallbackLabel ?? "test");
  return normalizePanelRenderableTest({ id: resolvedId, label: fallbackLabel || resolvedId }, fallbackLabel);
}

function getPanelTatMinutes(test) {
  const tat = Number(test?.tat ?? test?.turnaround_time ?? 0);
  const unit = String(test?.tatUnit ?? test?.turnaround_time_unit ?? "min").toLowerCase();

  if (!Number.isFinite(tat)) {
    return 0;
  }

  if (unit === "min" || unit === "minute" || unit === "minutes") return tat;
  if (unit === "hr" || unit === "h" || unit === "hour" || unit === "hours") return tat * 60;
  if (unit === "day" || unit === "days" || unit === "d") return tat * 1440;
  return tat;
}

function getPanelSkillRank(test) {
  return parsePanelSkillLevel(test?.skill_level ?? test?.skill ?? null);
}

function getPanelSkillLabel(test) {
  const rank = getPanelSkillRank(test);
  if (rank != null) {
    return formatPanelSkillLabel(rank);
  }

  return test?.skill || test?.skill_level || "n/a";
}

function PropertiesPanel({ selected, nodes, setOpenPanel, updateNode, deleteNode, duplicateNode, ungroupParallel, addParallelMember, removeParallelMember, updateParallelRule }) {
  const node = nodes.find(n => n.id === selected);
  if (!node) {
    return (
      <div style={{padding:24, textAlign:"center", color:"var(--fg-3)", fontSize:12.5}}>
        <Icon name="pointer" size={20} style={{marginBottom:10, color:"var(--fg-4)"}}/>
        <div style={{fontWeight:700, color:"var(--fg-2)", marginBottom:4}}>Nothing selected</div>
        <div>Select a pathway node, parallel block, or routing edge to edit its parameters and decision rules.</div>
        <div style={{marginTop:14, fontSize:11, color:"var(--fg-4)", lineHeight:1.6}}>
          <div><b>Tips:</b></div>
          <div>· Drag a test from the library onto the canvas</div>
          <div>· Drag from a coloured port to wire a branch</div>
          <div>· Click an edge label to delete it</div>
          <div>· Press <kbd>⌘Z</kbd> to undo, <kbd>Del</kbd> to remove</div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="props__section" style={{display:"flex", gap:6, paddingBottom:8}}>
        <button className="btn btn--xs" onClick={duplicateNode} title="Duplicate (⌘D)"><Icon name="copy" size={10}/>Duplicate</button>
        <button className="btn btn--xs" onClick={deleteNode} title={isLockedTerminalNode(node) ? "Required endpoints cannot be deleted" : "Delete (Del)"} disabled={isLockedTerminalNode(node)}><Icon name="trash" size={10}/>Delete</button>
      </div>
      {node.type === "test" && <TestNodeProps node={node} updateNode={updateNode}/>}
      {node.type === "parallel" && <ParallelBlockProps node={node} updateNode={updateNode} ungroupParallel={ungroupParallel} addParallelMember={addParallelMember} removeParallelMember={removeParallelMember} updateParallelRule={updateParallelRule}/>}
      {node.type === "terminal" && <TerminalNodeProps node={node} updateNode={updateNode}/>}
      {node.type === "annotation" && <AnnotationProps node={node} updateNode={updateNode}/>}
    </div>
  );
}

function TestNodeProps({ node, updateNode }) {
  const test = getPanelRenderableTest(node.testId, node.label || node.testId);
  if (!test) return null;
  return (
    <div>
      <div className="props__section">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <div className="node__icon" style={{width:28, height:28}}><Icon name={test.icon} size={14}/></div>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>{test.name}</div>
            <div className="u-meta">{node.kind === "referee" ? "Referee · pathway node" : "Diagnostic test · pathway node"}</div>
          </div>
        </div>
        <h4>Custom label (optional)</h4>
        <input className="input" value={node.label || ""} placeholder={test.category + " · pathway node"}
          onChange={e => updateNode && updateNode(node.id, { label: e.target.value })}/>
        <dl className="kv" style={{marginTop:10}}>
          <dt>Sensitivity</dt><dd className="mono">{test.sens.toFixed(2)}</dd>
          <dt>Specificity</dt><dd className="mono">{test.spec.toFixed(2)}</dd>
          <dt>Cost</dt><dd className="mono">${test.cost.toFixed(2)}</dd>
          <dt>Turnaround</dt><dd className="mono">{test.tat} {test.tatUnit}</dd>
          <dt>Sample type</dt><dd>{test.sample}</dd>
          <dt>Skill required</dt><dd>{test.skill}</dd>
          <dt>Evidence</dt><dd style={{fontWeight:500, color:"var(--fg-2)"}}>{test.evidence}</dd>
          <dt>Confidence</dt><dd><span className="chip chip--success">High</span></dd>
        </dl>
        <label style={{display:"flex", alignItems:"center", gap:8, marginTop:10, fontSize:12}}>
          <input type="checkbox" checked={node.kind === "referee"}
            onChange={e => updateNode && updateNode(node.id, { kind: e.target.checked ? "referee" : null })}/>
          Mark as referee test (used on discordance)
        </label>
      </div>
      <ConditionBuilder node={node} test={test}/>
    </div>
  );
}

function ParallelBlockProps({ node, updateNode, ungroupParallel, addParallelMember, removeParallelMember, updateParallelRule }) {
  const memberRows = (node.members || [])
    .map((member, index) => {
      const test = getPanelRenderableTest(member, member?.label || member?.testId || member?.id);
      if (!test) return null;
      return { member, test, key: member.id || `${member.testId}-${index}`, occurrence: index + 1 };
    })
    .filter(Boolean);
  const tests = memberRows.map(row => row.test);
  const [selectedTestId, setSelectedTestId] = useState(getPanelTestCatalog()[0]?.id || "");
  const [isDropActive, setIsDropActive] = useState(false);

  const addMember = (testId) => {
    if (!testId) return;
    addParallelMember?.(node.id, testId);
  };

  const handleDrop = (e) => {
    const testId = e.dataTransfer.getData("text/testId");
    if (!testId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
    addMember(testId);
  };

  const handleDragOver = (e) => {
    if (!e.dataTransfer.types?.includes("text/testId")) return;
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
  return (
    <div>
      <div className="props__section">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <div className="node__icon" style={{width:28, height:28, background:"var(--sme-orange)"}}><Icon name="merge" size={14}/></div>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>{node.label || "Parallel block"}</div>
            <div className="u-meta">Parallel testing block · combined node</div>
          </div>
        </div>
        <h4 style={{marginTop:6}}>Member tests</h4>
        <div className={"parallel__dropzone parallel__dropzone--panel" + (isDropActive ? " is-active" : "")}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}>
          <Icon name="download" size={10}/>
          <span>Drop a test from the library, or add one from the list below.</span>
        </div>
        <div className="parallel-add-row">
          <select className="parallel-add-select" value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}>
            {getPanelTestCatalog().map(test => (
              <option key={test.id} value={test.id}>{test.name}</option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={() => addMember(selectedTestId)}>
            <Icon name="plus" size={11}/>Add test
          </button>
        </div>
        <div className="parallel-add-hint">The same diagnostic test can be added more than once.</div>
        <div className="parallel-members">
          {memberRows.map(({ member, test, key, occurrence }) => (
            <div key={key} className="parallel-member">
              <Icon name={test.icon} size={12}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12, fontWeight:700}}>
                  {test.name} <span className="parallel__duplicate-tag">#{occurrence}</span>
                </div>
                <div style={{fontSize:11, color:"var(--fg-3)"}}>Se {test.sens.toFixed(2)} · Sp {test.spec.toFixed(2)} · {test.tat}{test.tatUnit[0]}</div>
              </div>
              <button
                className="btn btn--xs btn--icon"
                title="Remove from block"
                onClick={() => removeParallelMember?.(node.id, member.id || member.testId)}>
                <Icon name="x" size={10}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="props__section">
        <h4>Combined parameters</h4>
        {(() => {
          const combinedCost = tests.reduce((sum, test) => sum + Number(test?.cost ?? 0), 0);
          const maxTat = tests.length
            ? Math.max(...tests.map(getPanelTatMinutes))
            : 0;
          const sampleTypes = [...new Set(tests.flatMap(test => {
            if (Array.isArray(test?.sample_types) && test.sample_types.length) {
              return test.sample_types;
            }
            return test?.sample ? [test.sample] : [];
          }))].filter(Boolean);
          const skillRanks = tests.map(getPanelSkillRank).filter(rank => rank != null);
          const maxSkill = skillRanks.length ? Math.max(...skillRanks) : null;
          const maxSkillLabel = maxSkill != null ? formatPanelSkillLabel(maxSkill) : "n/a";
          return (
            <dl className="kv">
              <dt>Combined cost</dt><dd className="mono">${combinedCost.toFixed(2)}</dd>
              <dt>TAT (max rule)</dt><dd className="mono">{tests.length ? `${maxTat} min` : "n/a"}</dd>
              <dt>Sample types</dt><dd>{sampleTypes.length ? sampleTypes.join(", ") : "n/a"}</dd>
              <dt>Max skill</dt><dd>{maxSkillLabel}</dd>
              <dt>Independence</dt><dd><span className="chip chip--info">Conditional, given D</span></dd>
            </dl>
          );
        })()}
      </div>

      <div className="props__section">
        <h4>Output logic</h4>
        <div className="parallel-outputs">
          <div className="parallel-output parallel-output--pos">
            <span className="branch-dot branch-dot--pos"/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:12}}>Both positive</div>
              <div style={{fontSize:11, color:"var(--fg-3)"}}>Routes to <b>TB, Treat</b></div>
            </div>
          </div>
          <div className="parallel-output parallel-output--neg">
            <span className="branch-dot branch-dot--neg"/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:12}}>Both negative</div>
              <div style={{fontSize:11, color:"var(--fg-3)"}}>Routes to <b>TB Unlikely</b></div>
            </div>
          </div>
          <div className="parallel-output parallel-output--disc">
            <span className="branch-dot branch-dot--disc"/>
            <div style={{flex:1}}>
              <div style={{fontWeight:700, fontSize:12}}>Discordant</div>
              <div style={{fontSize:11, color:"var(--fg-3)"}}>Routes to <b>Liquid Culture</b> (referee)</div>
            </div>
          </div>
        </div>
        <button className="btn btn--sm" style={{marginTop:10}} onClick={() => {
          updateParallelRule?.(node.id, "CUSTOM");
          window.OptiDxActions?.showToast?.("Parallel block marked as custom", "success");
        }}><Icon name="git-branch" size={11}/>Add custom branch</button>
      </div>

      <div className="props__section">
        <button className="btn btn--ghost" style={{width:"100%"}}
          onClick={() => ungroupParallel && ungroupParallel(node.id)}>
          <Icon name="ungroup" size={11}/>Ungroup parallel block
        </button>
      </div>
    </div>
  );
}

function TerminalNodeProps({ node, updateNode }) {
  const locked = isLockedTerminalNode(node);
  const subLabel = locked
    ? (node.subtype === "pos" ? "Required positive endpoint" : "Required negative endpoint")
    : node.subtype === "pos" ? "Final positive" : node.subtype === "neg" ? "Final negative" : "Inconclusive";

  return (
    <div className="props__section">
      <h4>Terminal classification</h4>
      <h4>Label</h4>
      <input className="input" value={node.label || ""} disabled={locked}
        onChange={e => updateNode && updateNode(node.id, { label: e.target.value })}/>
      <dl className="kv" style={{marginTop:10}}>
        <dt>Type</dt><dd><span className={"chip chip--" + (node.subtype === "pos" ? "success" : node.subtype === "neg" ? "neutral" : "warning")}>{subLabel}</span></dd>
      </dl>
      {locked && (
        <div style={{marginTop:10, fontSize:11, color:"var(--fg-3)", lineHeight:1.5}}>
          Every pathway keeps a built-in positive and negative endpoint. This required endpoint stays on the canvas and its outcome type cannot be changed.
        </div>
      )}
      <div style={{marginTop:12}}>
        <h4>Available terminal types</h4>
        <div style={{display:"grid", gap:6}}>
          {[
            {k:"pos", l:"Considered positive"},
            {k:"neg", l:"Considered negative"},
            {k:"inc", l:"Inconclusive"},
          ].map(t => (
            <button key={t.k} className={"terminal-pick " + (node.subtype === t.k ? "is-active" : "")} disabled={locked}
              onClick={() => updateNode && updateNode(node.id, { subtype: t.k })}>
              <span className={"branch-dot branch-dot--" + (t.k === "pos" ? "pos" : t.k === "neg" ? "neg" : t.k === "inc" ? "inc" : "ref")}/>
              {t.l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnotationProps({ node, updateNode }) {
  return (
    <div className="props__section">
      <h4>Assumption note</h4>
      <textarea className="input" rows={5} value={node.text || ""}
        onChange={e => updateNode && updateNode(node.id, { text: e.target.value })}
        style={{height:"auto", padding:8, fontSize:12, resize:"vertical"}}/>
      <div style={{fontSize:11, color:"var(--fg-3)", marginTop:8}}>Annotations are surfaced in the Validation panel and on report exports.</div>
    </div>
  );
}

// ---------- Condition builder (the rich one) ----------
function ConditionBuilder({ node, test }) {
  const [mode, setMode] = useState("preset");
  const [preset, setPreset] = useState("POS");
  const [op, setOp] = useState("AND");
  const [destA, setDestA] = useState("Xpert MTB/RIF Ultra");
  const [destB, setDestB] = useState("TB Unlikely");
  const [extraClauses, setExtraClauses] = useState([]);

  const allowedPresets = node.type === "parallel"
    ? ["POS", "NEG", "BOTH_POS", "BOTH_NEG", "DISCORD", "ANY_POS", "ALL_NEG", "CUSTOM"]
    : ["POS", "NEG", "CUSTOM"];

  const naturalText = (() => {
    if (preset === "POS") return `If ${test.name} is positive, route to ${destA}. Otherwise, route to ${destB}.`;
    if (preset === "NEG") return `If ${test.name} is negative, route to ${destB}. Otherwise, route to ${destA}.`;
    if (preset === "BOTH_POS") return `If both tests are positive, route to ${destA}.`;
    if (preset === "BOTH_NEG") return `If both tests are negative, route to ${destB}.`;
    if (preset === "DISCORD") return `If the parallel results disagree, route to a referee test.`;
    if (preset === "ANY_POS") return `If any test in the group is positive, route to ${destA}.`;
    if (preset === "ALL_NEG") return `If all tests in the group are negative, route to ${destB}.`;
    return `If a custom Boolean expression evaluates true, route accordingly.`;
  })();

  const addClause = () => {
    setExtraClauses(items => [...items, {
      id: `clause-${Date.now()}-${items.length}`,
      label: `Clause ${items.length + 3}`,
      target: "Repeat testing",
    }]);
  };

  return (
    <div className="props__section">
      <h4>Decision rule (routing condition)</h4>
      <div className="cb__modes">
        <button className={"cb__mode " + (mode==="preset"?"is-active":"")} onClick={()=>setMode("preset")}>Preset</button>
        <button className={"cb__mode " + (mode==="builder"?"is-active":"")} onClick={()=>setMode("builder")}>Builder</button>
        <button className={"cb__mode " + (mode==="custom"?"is-active":"")} onClick={()=>setMode("custom")}>Custom</button>
      </div>

      {mode === "preset" && (
        <div className="cb__presets">
          {window.RULE_PRESETS.filter(r => allowedPresets.includes(r.id)).map(r => (
            <button key={r.id} className={"cb__preset " + (preset === r.id ? "is-active" : "")}
              onClick={() => setPreset(r.id)}>
              <span className="cb__preset-icon">
                <Icon name={r.id.includes("POS") ? "check" : r.id.includes("NEG") ? "x" : r.id === "DISCORD" ? "git-branch" : r.id === "CUSTOM" ? "code" : "filter"} size={11}/>
              </span>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {mode === "builder" && (
        <div className="cb__builder">
          <div className="cb__row">
            <span className="cb__chip cb__chip--var">{test.name}</span>
            <span className="cb__chip cb__chip--op">is</span>
            <span className="cb__chip cb__chip--val cb__chip--pos">positive</span>
          </div>
          <div className="cb__row">
            <button className={"cb__op-toggle " + (op==="AND"?"is-and":"is-or")}
              onClick={() => setOp(o => o === "AND" ? "OR" : "AND")}>{op}</button>
          </div>
          <div className="cb__row">
            <span className="cb__chip cb__chip--var">Next test</span>
            <span className="cb__chip cb__chip--op">is</span>
            <span className="cb__chip cb__chip--val cb__chip--neg">negative</span>
          </div>
          {extraClauses.map(clause => (
            <div key={clause.id} className="cb__row">
              <span className="cb__chip cb__chip--var">{clause.label}</span>
              <span className="cb__chip cb__chip--op">routes to</span>
              <select className="cb__branch-target" defaultValue={clause.target}>
                <option>Repeat testing</option>
                <option>Refer</option>
                <option>TB, Treat</option>
                <option>TB Unlikely</option>
              </select>
            </div>
          ))}
          <button className="btn btn--xs" style={{marginTop:6}} onClick={addClause}><Icon name="plus" size={10}/>Add clause</button>
        </div>
      )}

      {mode === "custom" && (
        <div className="cb__custom">
          <textarea className="input cb__expr" rows={4}
            defaultValue={`( ${test.name.replace(/[^a-z]/gi,"_")}.result == "POS" AND next.result == "NEG" )\n  OR\n( next.confidence < 0.6 )`}/>
          <div className="cb__custom-help">
            <Icon name="info" size={10}/>
            Variables: <code>.result</code>, <code>.confidence</code>, <code>.cycle_threshold</code>. Operators: AND, OR, NOT, ==, !=, &lt;, &gt;.
          </div>
        </div>
      )}

      <div className="cb__natural">
        <div className="cb__natural-label">Natural-language preview</div>
        <div className="cb__natural-text">{naturalText}</div>
      </div>

      <h4 style={{marginTop:14}}>Outgoing branches</h4>
      <div className="cb__branches">
        <div className="cb__branch cb__branch--pos">
          <span className="branch-dot branch-dot--pos"/>
          <span className="cb__branch-label">Positive</span>
          <span className="cb__branch-arrow"><Icon name="arrow-right" size={10}/></span>
          <select className="cb__branch-target" defaultValue={destA} onChange={e => setDestA(e.target.value)}>
            <option>Xpert MTB/RIF Ultra</option>
            <option>Parallel block</option>
            <option>TB, Treat</option>
            <option>Refer</option>
          </select>
        </div>
        <div className="cb__branch cb__branch--neg">
          <span className="branch-dot branch-dot--neg"/>
          <span className="cb__branch-label">Negative</span>
          <span className="cb__branch-arrow"><Icon name="arrow-right" size={10}/></span>
          <select className="cb__branch-target" defaultValue={destB} onChange={e => setDestB(e.target.value)}>
            <option>TB Unlikely</option>
            <option>Repeat testing</option>
            <option>No TB</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function panelNodeLabel(node, nodes) {
  const nodeRecord = Array.isArray(nodes)
    ? nodes.find(item => item.id === node)
    : null;
  const testCatalog = Array.isArray(window.SEED_TESTS) ? window.SEED_TESTS : [];
  return nodeRecord?.label || testCatalog.find(test => test.id === nodeRecord?.testId)?.name || node;
}

function panelBranchPorts(node) {
  if (node?.type === "parallel") {
    return [
      { port: "both_pos", label: "Both positive", kind: "pos" },
      { port: "discord", label: "Discordant", kind: "disc" },
      { port: "both_neg", label: "Both negative", kind: "neg" },
    ];
  }

  return [
    { port: "pos", label: "Positive", kind: "pos" },
    { port: "neg", label: "Negative", kind: "neg" },
  ];
}

function LivePropertiesPanel({ selected, nodes, edges, setOpenPanel, updateNode, deleteNode, duplicateNode, ungroupParallel, addParallelMember, removeParallelMember, updateParallelRule, upsertEdge }) {
  const node = nodes.find(n => n.id === selected);
  if (!node) {
    return (
      <div style={{padding:24, textAlign:"center", color:"var(--fg-3)", fontSize:12.5}}>
        <Icon name="pointer" size={20} style={{marginBottom:10, color:"var(--fg-4)"}}/>
        <div style={{fontWeight:700, color:"var(--fg-2)", marginBottom:4}}>Nothing selected</div>
        <div>Select a pathway node, parallel block, or routing edge to edit its parameters and decision rules.</div>
        <div style={{marginTop:14, fontSize:11, color:"var(--fg-4)", lineHeight:1.6}}>
          <div><b>Tips:</b></div>
          <div>· Drag a test from the library onto the canvas</div>
          <div>· Drag from a coloured port to wire a branch</div>
          <div>· Click an edge label to delete it</div>
          <div>· Press <kbd>⌘Z</kbd> to undo, <kbd>Del</kbd> to remove</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="props__section" style={{display:"flex", gap:6, paddingBottom:8}}>
        <button className="btn btn--xs" onClick={duplicateNode} title="Duplicate (⌘D)"><Icon name="copy" size={10}/>Duplicate</button>
        <button className="btn btn--xs" onClick={deleteNode} title={isLockedTerminalNode(node) ? "Required endpoints cannot be deleted" : "Delete (Del)"} disabled={isLockedTerminalNode(node)}><Icon name="trash" size={10}/>Delete</button>
      </div>
      {node.type === "test" && <LiveTestNodeProps node={node} nodes={nodes} edges={edges} updateNode={updateNode} upsertEdge={upsertEdge}/>}
      {node.type === "parallel" && <LiveParallelBlockProps node={node} nodes={nodes} edges={edges} updateNode={updateNode} ungroupParallel={ungroupParallel} addParallelMember={addParallelMember} removeParallelMember={removeParallelMember} updateParallelRule={updateParallelRule} upsertEdge={upsertEdge}/>}
      {node.type === "terminal" && <TerminalNodeProps node={node} updateNode={updateNode}/>}
      {node.type === "annotation" && <AnnotationProps node={node} updateNode={updateNode}/>}
    </div>
  );
}

function LiveTestNodeProps({ node, nodes, edges, updateNode, upsertEdge }) {
  const test = getPanelRenderableTest(node.testId, node.label || node.testId);
  if (!test) return null;

  return (
    <div>
      <div className="props__section">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <div className="node__icon" style={{width:28, height:28}}><Icon name={test.icon} size={14}/></div>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>{test.name}</div>
            <div className="u-meta">{node.kind === "referee" ? "Referee · pathway node" : "Diagnostic test · pathway node"}</div>
          </div>
        </div>
        <h4>Custom label (optional)</h4>
        <input className="input" value={node.label || ""} placeholder={test.category + " · pathway node"}
          onChange={e => updateNode && updateNode(node.id, { label: e.target.value })}/>
        <dl className="kv" style={{marginTop:10}}>
          <dt>Sensitivity</dt><dd className="mono">{test.sens.toFixed(2)}</dd>
          <dt>Specificity</dt><dd className="mono">{test.spec.toFixed(2)}</dd>
          <dt>Cost</dt><dd className="mono">${test.cost.toFixed(2)}</dd>
          <dt>Turnaround</dt><dd className="mono">{test.tat} {test.tatUnit}</dd>
          <dt>Sample type</dt><dd>{test.sample}</dd>
          <dt>Skill required</dt><dd>{test.skill}</dd>
          <dt>Evidence</dt><dd style={{fontWeight:500, color:"var(--fg-2)"}}>{test.evidence}</dd>
          <dt>Confidence</dt><dd><span className="chip chip--success">High</span></dd>
        </dl>
        <label style={{display:"flex", alignItems:"center", gap:8, marginTop:10, fontSize:12}}>
          <input type="checkbox" checked={node.kind === "referee"}
            onChange={e => updateNode && updateNode(node.id, { kind: e.target.checked ? "referee" : null })}/>
          Mark as referee test (used on discordance)
        </label>
      </div>
      <LiveConditionBuilder node={node} test={test} nodes={nodes} edges={edges} upsertEdge={upsertEdge}/>
    </div>
  );
}

function LiveParallelBlockProps({ node, nodes, edges, updateNode, ungroupParallel, addParallelMember, removeParallelMember, updateParallelRule, upsertEdge }) {
  const memberRows = (node.members || [])
    .map((member, index) => {
      const test = getPanelRenderableTest(member, member?.label || member?.testId || member?.id);
      if (!test) return null;
      return { member, test, key: member.id || `${member.testId}-${index}`, occurrence: index + 1 };
    })
    .filter(Boolean);
  const tests = memberRows.map(row => row.test);
  const [selectedTestId, setSelectedTestId] = useState(getPanelTestCatalog()[0]?.id || "");
  const [isDropActive, setIsDropActive] = useState(false);

  const addMember = (testId) => {
    if (!testId) return;
    addParallelMember?.(node.id, testId);
  };

  const handleDrop = (e) => {
    const testId = e.dataTransfer.getData("text/testId");
    if (!testId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDropActive(false);
    addMember(testId);
  };

  const handleDragOver = (e) => {
    if (!e.dataTransfer.types?.includes("text/testId")) return;
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

  return (
    <div>
      <div className="props__section">
        <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:10}}>
          <div className="node__icon" style={{width:28, height:28, background:"var(--sme-orange)"}}><Icon name="merge" size={14}/></div>
          <div>
            <div style={{fontSize:13, fontWeight:700}}>{node.label || "Parallel block"}</div>
            <div className="u-meta">Parallel testing block · combined node</div>
          </div>
        </div>
        <h4 style={{marginTop:6}}>Member tests</h4>
        <div className={"parallel__dropzone parallel__dropzone--panel" + (isDropActive ? " is-active" : "")}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}>
          <Icon name="download" size={10}/>
          <span>Drop a test from the library, or add one from the list below.</span>
        </div>
        <div className="parallel-add-row">
          <select className="parallel-add-select" value={selectedTestId} onChange={e => setSelectedTestId(e.target.value)}>
            {getPanelTestCatalog().map(test => (
              <option key={test.id} value={test.id}>{test.name}</option>
            ))}
          </select>
          <button className="btn btn--sm" onClick={() => addMember(selectedTestId)}>
            <Icon name="plus" size={11}/>Add test
          </button>
        </div>
        <div className="parallel-add-hint">The same diagnostic test can be added more than once.</div>
        <div className="parallel-members">
          {memberRows.map(({ member, test, key, occurrence }) => (
            <div key={key} className="parallel-member">
              <Icon name={test.icon} size={12}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12, fontWeight:700}}>
                  {test.name} <span className="parallel__duplicate-tag">#{occurrence}</span>
                </div>
                <div style={{fontSize:11, color:"var(--fg-3)"}}>Se {test.sens.toFixed(2)} · Sp {test.spec.toFixed(2)} · {test.tat}{test.tatUnit[0]}</div>
              </div>
              <button
                className="btn btn--xs btn--icon"
                title="Remove from block"
                onClick={() => removeParallelMember?.(node.id, member.id || member.testId)}>
                <Icon name="x" size={10}/>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="props__section">
        <h4>Combined parameters</h4>
        <dl className="kv">
          <dt>Combined cost</dt><dd className="mono">${tests.reduce((sum, test) => sum + Number(test?.cost ?? 0), 0).toFixed(2)}</dd>
          <dt>TAT (max rule)</dt><dd className="mono">{tests.length ? `${Math.max(...tests.map(getPanelTatMinutes))} min` : "n/a"}</dd>
          <dt>Sample types</dt><dd>{[...new Set(tests.flatMap(test => Array.isArray(test?.sample_types) && test.sample_types.length ? test.sample_types : (test?.sample ? [test.sample] : [])))].filter(Boolean).join(", ") || "n/a"}</dd>
          <dt>Max skill</dt><dd>{(() => {
            const skillRanks = tests.map(getPanelSkillRank).filter(rank => rank != null);
            return skillRanks.length ? formatPanelSkillLabel(Math.max(...skillRanks)) : "n/a";
          })()}</dd>
          <dt>Independence</dt><dd><span className="chip chip--info">Conditional, given D</span></dd>
        </dl>
      </div>

      <div className="props__section">
        <h4>Output logic</h4>
        <div className="parallel-outputs">
          {panelBranchPorts(node).map(branch => {
            const edge = edges.find(item => item.from === node.id && item.fromPort === branch.port);
            return (
              <div key={branch.port} className={"parallel-output parallel-output--" + branch.kind}>
                <span className={"branch-dot branch-dot--" + branch.kind}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700, fontSize:12}}>{branch.label}</div>
                </div>
                <select className="cb__branch-target" value={edge?.to || ""} onChange={e => upsertEdge?.(node.id, branch.port, e.target.value || null)}>
                  <option value="">Not connected</option>
                  {nodes.filter(candidate => candidate.id !== node.id && candidate.type !== "annotation").map(candidate => (
                    <option key={candidate.id} value={candidate.id}>{panelNodeLabel(candidate.id, nodes)}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <button className="btn btn--sm" style={{marginTop:10}} onClick={() => {
          updateParallelRule?.(node.id, "CUSTOM");
          window.OptiDxActions?.showToast?.("Parallel block marked as custom", "success");
        }}><Icon name="git-branch" size={11}/>Add custom branch</button>
      </div>

      <div className="props__section">
        <button className="btn btn--ghost" style={{width:"100%"}}
          onClick={() => ungroupParallel && ungroupParallel(node.id)}>
          <Icon name="ungroup" size={11}/>Ungroup parallel block
        </button>
      </div>
    </div>
  );
}

function LiveConditionBuilder({ node, test, nodes, edges, upsertEdge }) {
  const [mode, setMode] = useState("preset");
  const [preset, setPreset] = useState("POS");
  const [op, setOp] = useState("AND");
  const [extraClauses, setExtraClauses] = useState([]);

  const allowedPresets = node.type === "parallel"
    ? ["POS", "NEG", "BOTH_POS", "BOTH_NEG", "DISCORD", "ANY_POS", "ALL_NEG", "CUSTOM"]
    : ["POS", "NEG", "CUSTOM"];

  const branchRows = panelBranchPorts(node).map(branch => ({
    ...branch,
    edge: edges.find(item => item.from === node.id && item.fromPort === branch.port) || null,
  }));
  const naturalText = branchRows.length
    ? branchRows.map(branch => `${branch.label} → ${branch.edge ? panelNodeLabel(branch.edge.to, nodes) : "Not connected"}`).join(" • ")
    : `If a custom Boolean expression evaluates true, route accordingly.`;

  const addClause = () => {
    setExtraClauses(items => [...items, {
      id: `clause-${Date.now()}-${items.length}`,
      label: `Clause ${items.length + 3}`,
      target: "Repeat testing",
    }]);
  };

  return (
    <div className="props__section">
      <h4>Decision rule (routing condition)</h4>
      <div className="cb__modes">
        <button className={"cb__mode " + (mode==="preset"?"is-active":"")} onClick={()=>setMode("preset")}>Preset</button>
        <button className={"cb__mode " + (mode==="builder"?"is-active":"")} onClick={()=>setMode("builder")}>Builder</button>
        <button className={"cb__mode " + (mode==="custom"?"is-active":"")} onClick={()=>setMode("custom")}>Custom</button>
      </div>

      {mode === "preset" && (
        <div className="cb__presets">
          {window.RULE_PRESETS.filter(r => allowedPresets.includes(r.id)).map(r => (
            <button key={r.id} className={"cb__preset " + (preset === r.id ? "is-active" : "")}
              onClick={() => setPreset(r.id)}>
              <span className="cb__preset-icon">
                <Icon name={r.id.includes("POS") ? "check" : r.id.includes("NEG") ? "x" : r.id === "DISCORD" ? "git-branch" : r.id === "CUSTOM" ? "code" : "filter"} size={11}/>
              </span>
              {r.label}
            </button>
          ))}
        </div>
      )}

      {mode === "builder" && (
        <div className="cb__builder">
          <div className="cb__row">
            <span className="cb__chip cb__chip--var">{test.name}</span>
            <span className="cb__chip cb__chip--op">is</span>
            <span className="cb__chip cb__chip--val cb__chip--pos">positive</span>
          </div>
          <div className="cb__row">
            <button className={"cb__op-toggle " + (op==="AND"?"is-and":"is-or")}
              onClick={() => setOp(o => o === "AND" ? "OR" : "AND")}>{op}</button>
          </div>
          <div className="cb__row">
            <span className="cb__chip cb__chip--var">Next test</span>
            <span className="cb__chip cb__chip--op">is</span>
            <span className="cb__chip cb__chip--val cb__chip--neg">negative</span>
          </div>
          {extraClauses.map(clause => (
            <div key={clause.id} className="cb__row">
              <span className="cb__chip cb__chip--var">{clause.label}</span>
              <span className="cb__chip cb__chip--op">routes to</span>
              <select className="cb__branch-target" defaultValue={clause.target}>
                <option>Repeat testing</option>
                <option>Refer</option>
                <option>TB, Treat</option>
                <option>TB Unlikely</option>
              </select>
            </div>
          ))}
          <button className="btn btn--xs" style={{marginTop:6}} onClick={addClause}><Icon name="plus" size={10}/>Add clause</button>
        </div>
      )}

      {mode === "custom" && (
        <div className="cb__custom">
          <textarea className="input cb__expr" rows={4}
            defaultValue={`( ${test.name.replace(/[^a-z]/gi,"_")}.result == "POS" AND next.result == "NEG" )\n  OR\n( next.confidence < 0.6 )`}/>
          <div className="cb__custom-help">
            <Icon name="info" size={10}/>
            Variables: <code>.result</code>, <code>.confidence</code>, <code>.cycle_threshold</code>. Operators: AND, OR, NOT, ==, !=, &lt;, &gt;.
          </div>
        </div>
      )}

      <div className="cb__natural">
        <div className="cb__natural-label">Natural-language preview</div>
        <div className="cb__natural-text">{naturalText}</div>
      </div>

      <h4 style={{marginTop:14}}>Outgoing branches</h4>
      <div className="cb__branches">
        {branchRows.map(branch => (
          <div key={branch.port} className={"cb__branch cb__branch--" + branch.kind}>
            <span className={"branch-dot branch-dot--" + branch.kind}/>
            <span className="cb__branch-label">{branch.label}</span>
            <span className="cb__branch-arrow"><Icon name="arrow-right" size={10}/></span>
            <select className="cb__branch-target" value={branch.edge?.to || ""} onChange={e => upsertEdge?.(node.id, branch.port, e.target.value || null)}>
              <option value="">Not connected</option>
              {nodes.filter(candidate => candidate.id !== node.id && candidate.type !== "annotation").map(candidate => (
                <option key={candidate.id} value={candidate.id}>{panelNodeLabel(candidate.id, nodes)}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  PropertiesPanel: LivePropertiesPanel,
  TestNodeProps: LiveTestNodeProps,
  ParallelBlockProps: LiveParallelBlockProps,
  TerminalNodeProps,
  ConditionBuilder: LiveConditionBuilder,
});
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
