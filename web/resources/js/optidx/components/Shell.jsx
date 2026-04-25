import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// Shell — rail + top bar + screen router

function Rail({ screen, setScreen, onHelp }) {
  const items = [
    { id: "home",     icon: "home",        label: "Home" },
    { id: "wizard",   icon: "layout-grid", label: "New" },
    { id: "canvas",   icon: "git-branch",  label: "Builder" },
    { id: "results",  icon: "bar-chart",   label: "Results" },
    { id: "compare",  icon: "sliders",     label: "Compare" },
    { id: "evidence", icon: "database",    label: "Evidence" },
    { id: "report",   icon: "file-text",   label: "Report" },
    { id: "teams",    icon: "users",       label: "Teams" },
  ];
  return (
    <nav className="app__rail">
      <div style={{marginBottom:12}}><LogoMark size={40}/></div>
      {items.map(it => (
        <div key={it.id}
          className={"rail__item " + (screen === it.id ? "is-active" : "")}
          onClick={() => setScreen(it.id)}
          title={it.label}>
          <Icon name={it.icon} size={20} stroke={1.6}/>
        </div>
      ))}
      <div className="rail__spacer"/>
      <div className="rail__item" title="Send feedback or report a bug" onClick={onHelp}><Icon name="help" size={20} stroke={1.6}/></div>
      <div className="rail__item"
        onClick={() => setScreen("settings")}
        title="Settings"><Icon name="settings" size={20} stroke={1.6}/></div>
    </nav>
  );
}

function TopBar({ crumbs, actions }) {
  return (
    <header className="app__top">
      <div className="top__crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevron-right" size={12} className="sep"/>}
            <span className={i === crumbs.length - 1 ? "u-strong" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="top__spacer"/>
      <div className="top__actions">{actions}</div>
    </header>
  );
}

// Frame keeps the authenticated shell body consistent across screens.
// Normal screens scroll inside .app__main, while fullBleed screens render a
// top bar plus a body that fills the remaining space without stretching the
// bar itself.
function Frame({ children, fullBleed = false }) {
  return (
    <main className={"app__main" + (fullBleed ? " app__main--flush" : "")}>{children}</main>
  );
}

Object.assign(window, { Rail, TopBar, Frame });
