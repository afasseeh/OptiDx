// Properties panel — context-sensitive right sidebar with rich condition builder
function PropertiesPanel({ selected, nodes, setOpenPanel, updateNode, deleteNode, duplicateNode, ungroupParallel }) {
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
        <button className="btn btn--xs" onClick={deleteNode} title="Delete (Del)"><Icon name="trash" size={10}/>Delete</button>
      </div>
      {node.type === "test" && <TestNodeProps node={node} updateNode={updateNode}/>}
      {node.type === "parallel" && <ParallelBlockProps node={node} updateNode={updateNode} ungroupParallel={ungroupParallel}/>}
      {node.type === "terminal" && <TerminalNodeProps node={node} updateNode={updateNode}/>}
      {node.type === "annotation" && <AnnotationProps node={node} updateNode={updateNode}/>}
    </div>
  );
}

function TestNodeProps({ node, updateNode }) {
  const test = window.SEED_TESTS.find(t => t.id === node.testId);
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
          <dt>Sensitivity</dt><dd className="mono">{test.sens.toFixed(3)}</dd>
          <dt>Specificity</dt><dd className="mono">{test.spec.toFixed(3)}</dd>
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

function ParallelBlockProps({ node, updateNode, ungroupParallel }) {
  const tests = (node.members || []).map(m => window.SEED_TESTS.find(t => t.id === m.testId)).filter(Boolean);
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
        <div className="parallel-members">
          {tests.map((t,i) => (
            <div key={i} className="parallel-member">
              <Icon name={t.icon} size={12}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12, fontWeight:700}}>{t.name}</div>
                <div style={{fontSize:11, color:"var(--fg-3)"}}>Se {t.sens.toFixed(2)} · Sp {t.spec.toFixed(2)} · {t.tat}{t.tatUnit[0]}</div>
              </div>
              <button className="btn btn--xs btn--icon" title="Remove from block" onClick={() => window.OptiDxActions.comingSoon("Remove test from block")}><Icon name="x" size={10}/></button>
            </div>
          ))}
          <button className="btn btn--sm" style={{marginTop:6}} onClick={() => window.OptiDxActions.comingSoon("Add test to block")}><Icon name="plus" size={11}/>Add test to block</button>
        </div>
      </div>

      <div className="props__section">
        <h4>Combined parameters</h4>
        <dl className="kv">
          <dt>Combined cost</dt><dd className="mono">${tests.reduce((s,t) => s + t.cost, 0).toFixed(2)}</dd>
          <dt>TAT (max rule)</dt><dd className="mono">{Math.max(...tests.map(t => t.tatUnit === "min" ? t.tat : t.tatUnit === "hr" ? t.tat*60 : t.tat*1440))} min</dd>
          <dt>Sample types</dt><dd>{[...new Set(tests.map(t => t.sample))].join(", ")}</dd>
          <dt>Max skill</dt><dd>Lab Tech</dd>
          <dt>Independence</dt><dd><span className="chip chip--info">Conditional, given D</span></dd>
        </dl>
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
        <button className="btn btn--sm" style={{marginTop:10}} onClick={() => window.OptiDxActions.comingSoon("Add custom branch")}><Icon name="git-branch" size={11}/>Add custom branch</button>
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
  const subLabel = node.subtype === "pos" ? "Final positive" : node.subtype === "neg" ? "Final negative" : node.subtype === "inc" ? "Inconclusive" : "Refer";
  return (
    <div className="props__section">
      <h4>Terminal classification</h4>
      <h4>Label</h4>
      <input className="input" value={node.label || ""}
        onChange={e => updateNode && updateNode(node.id, { label: e.target.value })}/>
      <dl className="kv" style={{marginTop:10}}>
        <dt>Type</dt><dd><span className={"chip chip--" + (node.subtype === "pos" ? "success" : node.subtype === "neg" ? "neutral" : "warning")}>{subLabel}</span></dd>
      </dl>
      <div style={{marginTop:12}}>
        <h4>Available terminal types</h4>
        <div style={{display:"grid", gap:6}}>
          {[
            {k:"pos", l:"Final positive (treat)"},
            {k:"neg", l:"Final negative (rule out)"},
            {k:"inc", l:"Inconclusive"},
            {k:"rep", l:"Repeat testing"},
            {k:"ref", l:"Refer for further work-up"},
          ].map(t => (
            <button key={t.k} className={"terminal-pick " + (node.subtype === t.k ? "is-active" : "")}
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
  const [mode, setMode] = useState("preset"); // preset | builder | custom
  const [preset, setPreset] = useState("POS");
  const [op, setOp] = useState("AND");
  const [destA, setDestA] = useState("Xpert MTB/RIF Ultra");
  const [destB, setDestB] = useState("TB Unlikely");

  const presetMeta = window.RULE_PRESETS.find(r => r.id === preset);
  const naturalText = (() => {
    if (preset === "POS")      return `If ${test.name} is positive, route to ${destA}. Otherwise, route to ${destB}.`;
    if (preset === "NEG")      return `If ${test.name} is negative, route to ${destB}. Otherwise, route to ${destA}.`;
    if (preset === "BOTH_POS") return `If ${test.name} AND the next test are both positive, route to ${destA}.`;
    if (preset === "BOTH_NEG") return `If ${test.name} AND the next test are both negative, route to ${destB}.`;
    if (preset === "DISCORD")  return `If ${test.name} and the next test disagree, route to a referee test.`;
    if (preset === "ANY_POS")  return `If any of the tests in this group is positive, route to ${destA}.`;
    if (preset === "ALL_NEG")  return `If all tests in this group are negative, route to ${destB}.`;
    return `If a custom Boolean expression evaluates true, route accordingly.`;
  })();

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
          {window.RULE_PRESETS.map(r => (
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
          <button className="btn btn--xs" style={{marginTop:6}} onClick={() => window.OptiDxActions.comingSoon("Add clause")}><Icon name="plus" size={10}/>Add clause</button>
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
      <button className="btn btn--xs" style={{marginTop:8}} onClick={() => window.OptiDxActions.comingSoon("Add discordant / inconclusive branch")}><Icon name="plus" size={10}/>Add discordant / inconclusive branch</button>
    </div>
  );
}

Object.assign(window, { PropertiesPanel, TestNodeProps, ParallelBlockProps, TerminalNodeProps, ConditionBuilder });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
