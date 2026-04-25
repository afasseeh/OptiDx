// Home — Workspace home screen
function ScreenHome({ setScreen }) {
  const pathways = window.OptiDxActions.getWorkspacePathways?.() || window.SEED_PATHWAYS || [];
  const templates = window.SEED_TEMPLATES || [];
  return (
    <>
      <TopBar
        crumbs={["OptiDx", "Workspace"]}
        actions={<>
          <button className="btn" onClick={async () => {
            try {
              await window.OptiDxActions.importJsonFile(async (pathway) => {
                await window.OptiDxActions.loadPathwayIntoWorkspace?.(pathway);
                setScreen("canvas");
              });
            } catch (error) {
              window.OptiDxActions.showToast?.(error?.message || "Unable to import pathway", "error");
            }
          }}><Icon name="upload"/>Import JSON</button>
          <button className="btn btn--primary" onClick={() => setScreen("wizard")}>
            <Icon name="plus"/>New project
          </button>
        </>}
      />
      <div className="page">
        <div className="page__head">
          <div>
            <div className="sme-eyebrow" style={{marginBottom:6}}>Pathways</div>
            <h1>Diagnostic project workspace</h1>
            <p>Design, run, and compare diagnostic projects. Grounded in published evidence.</p>
          </div>
          <div className="row">
            <div className="u-meta">Workspace · <b style={{color:"var(--fg-1)"}}>Syreon MENA HTA</b></div>
          </div>
        </div>

        <section style={{marginBottom:36}}>
          <div className="row" style={{marginBottom:12}}>
            <h2 style={{fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-2)"}}>Recent pathways</h2>
            <div className="spacer"/>
            <button className="btn btn--sm btn--ghost" onClick={() => setScreen("library")}>View all <Icon name="chevron-right" size={12}/></button>
          </div>
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))"}}>
            {pathways.map(p => (
              <article key={p.id} className="card" onClick={async () => {
                try {
                  await window.OptiDxActions.openPathwayRecord?.(p);
                  setScreen("canvas");
                } catch (error) {
                  window.OptiDxActions.showToast?.(error?.message || "Unable to open pathway", "error");
                }
              }}
                style={{cursor:"pointer"}}>
                <div style={{padding:"14px 16px 10px", borderBottom:"1px solid var(--edge)"}}>
                  <div className="row" style={{marginBottom:8}}>
                    <span className={"chip " + (p.status === "Active" ? "chip--pos" : p.status === "Draft" ? "chip--orange" : "chip--outline")}>{p.status || "Draft"}</span>
                    <div className="spacer"/>
                    <Icon name="more" size={14} style={{color:"var(--fg-3)"}}/>
                  </div>
                  <h3 style={{fontSize:15, marginBottom:2}}>{p.name || "Untitled pathway"}</h3>
                  <div className="u-meta">{p.disease || "No summary metrics yet"}</div>
                </div>
                <div style={{padding:"10px 16px 14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 12px", fontSize:12}}>
                  <div><span className="u-meta">Sens</span> <b className="mono">{formatPercent(p.sens)}</b></div>
                  <div><span className="u-meta">Spec</span> <b className="mono">{formatPercent(p.spec)}</b></div>
                  <div><span className="u-meta">Cost</span> <b className="mono">{formatCurrency(p.cost)}</b></div>
                  <div><span className="u-meta">TAT</span> <b className="mono">{formatText(p.tat, "—")}</b></div>
                </div>
                <div style={{padding:"8px 16px", background:"var(--surface-2)", borderTop:"1px solid var(--edge)", fontSize:11, color:"var(--fg-3)"}}>
                  Updated {p.updated} · {p.owner}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{marginBottom:36}}>
          <div className="row" style={{marginBottom:12}}>
            <h2 style={{fontSize:14, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-2)"}}>Templates</h2>
            <div className="spacer"/>
            <span className="u-meta">Start from a proven pattern</span>
          </div>
          <div className="grid" style={{gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))"}}>
            {templates.map(t => (
              <article key={t.id} className="card card--pad" style={{cursor:"pointer"}}
                onClick={() => setScreen("wizard")}>
                <div style={{width:36, height:36, borderRadius:6, background:"var(--sme-orange-050)",
                  color:"var(--sme-orange-600)", display:"grid", placeItems:"center", marginBottom:10}}>
                  <Icon name={t.icon} size={18}/>
                </div>
                <h3 style={{fontSize:14, marginBottom:4}}>{t.name}</h3>
                <p style={{fontSize:12, color:"var(--fg-3)", lineHeight:1.45, marginBottom:12}}>{t.desc}</p>
                <div className="row" style={{fontSize:11, color:"var(--fg-3)"}}>
                  <span className="chip chip--outline">{t.tests} tests</span>
                  <div className="spacer"/>
                  <span style={{color:"var(--sme-orange)", fontWeight:700}}>Use template <Icon name="arrow-right" size={11}/></span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="grid" style={{gridTemplateColumns:"2fr 1fr", gap:16}}>
            <div className="card card--pad">
              <div className="sme-eyebrow" style={{marginBottom:6}}>Evidence database</div>
              <h3 style={{fontSize:16, marginBottom:4}}>Pre-curated diagnostic performance data</h3>
              <p style={{color:"var(--fg-3)", fontSize:13, marginBottom:12}}>
                Browse published sensitivity and specificity estimates from Cochrane, WHO guidance, and peer-reviewed
                meta-analyses. Import records directly into your pathway.
              </p>
              <button className="btn" onClick={() => setScreen("evidence")}>
                <Icon name="database"/>Open evidence database
              </button>
            </div>
            <div className="card card--pad" style={{background:"var(--sme-ink-900)", color:"#fff", borderColor:"var(--sme-ink-900)"}}>
              <div className="sme-eyebrow" style={{marginBottom:6, color:"var(--sme-orange)"}}>Getting started</div>
              <h3 style={{fontSize:16, marginBottom:4, color:"#fff"}}>Build your first pathway</h3>
              <p style={{color:"#B0B5B9", fontSize:13, marginBottom:12}}>
                A 4-step wizard walks you through the disease, test library, and constraints before you enter the canvas.
              </p>
              <button className="btn btn--primary" onClick={() => setScreen("wizard")}>
                <Icon name="plus"/>Start wizard
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function formatPercent(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return `${(numeric * 100).toFixed(1)}%`;
}

function formatCurrency(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return `$${numeric.toFixed(2)}`;
}

function formatText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

Object.assign(window, { ScreenHome });
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
