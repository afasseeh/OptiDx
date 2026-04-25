// CountryPanel — detail panel for a selected country
const { useState: useStateCP } = React;

function CountryPanel({ country, elements, onEdit, isAdmin, onToggleStatus, onUpdateNotes }) {
  const [tab, setTab] = useStateCP("elements");
  if (!country) return null;

  const byGroup = {};
  elements.forEach(e => { (byGroup[e.group] = byGroup[e.group] || []).push(e); });
  const total = elements.length;
  const done = elements.filter(e => country.status[e.id]).length;
  const pct = Math.round((done / total) * 100);

  return React.createElement("div", { className: "country-panel" }, [
    React.createElement("div", { key: "head", className: "cp-head" }, [
      React.createElement("div", { key: "l" }, [
        React.createElement("div", { key: "eb", className: "sme-eyebrow" }, country.code),
        React.createElement("h2", { key: "h" }, country.name),
        React.createElement("div", { key: "ag", className: "cp-agency" }, country.agency || "—")
      ]),
      React.createElement("div", { key: "r", className: "cp-progress" }, [
        React.createElement("svg", { key: "ring", viewBox: "0 0 80 80", className: "prog-ring" }, [
          React.createElement("circle", { key: "bg", cx: 40, cy: 40, r: 32, fill: "none", stroke: "#E2E4E6", strokeWidth: 8 }),
          React.createElement("circle", {
            key: "fg", cx: 40, cy: 40, r: 32, fill: "none", stroke: "#F37739", strokeWidth: 8,
            strokeDasharray: 2 * Math.PI * 32, strokeDashoffset: 2 * Math.PI * 32 * (1 - pct/100),
            transform: "rotate(-90 40 40)", strokeLinecap: "round"
          })
        ]),
        React.createElement("div", { key: "num", className: "prog-num" }, [
          React.createElement("div", { key: "p", className: "prog-pct" }, pct + "%"),
          React.createElement("div", { key: "l", className: "prog-label" }, done + "/" + total)
        ])
      ])
    ]),

    React.createElement("div", { key: "tabs", className: "cp-tabs" }, [
      ["elements", "Elements"], ["overview", "Overview"], ["timeline", "Timeline"], ["links", "Links"]
    ].map(([id, label]) =>
      React.createElement("button", {
        key: id, className: "cp-tab" + (tab === id ? " active" : ""),
        onClick: () => setTab(id)
      }, label))),

    React.createElement("div", { key: "body", className: "cp-body" },
      tab === "elements" ? renderElements(country, byGroup, isAdmin, onToggleStatus, onUpdateNotes) :
      tab === "overview" ? renderOverview(country) :
      tab === "timeline" ? renderTimeline(country) :
      renderLinks(country)
    )
  ]);
}

function renderElements(country, byGroup, isAdmin, onToggleStatus, onUpdateNotes) {
  return React.createElement("div", { className: "cp-elements" },
    Object.entries(byGroup).map(([group, items]) =>
      React.createElement("div", { key: group, className: "cp-group" }, [
        React.createElement("div", { key: "gh", className: "sme-caption cp-group-head" }, group),
        React.createElement("ul", { key: "ul" }, items.map(el => {
          const done = !!country.status[el.id];
          const note = (country.notes || {})[el.id] || "";
          const dateKey = (country.dates || {})[el.id] || "";
          return React.createElement("li", { key: el.id, className: "cp-elem" + (done ? " done" : "") }, [
            React.createElement("div", { key: "row", className: "cp-elem-row" }, [
              React.createElement("button", {
                key: "chk", className: "cp-chk", disabled: !isAdmin,
                onClick: () => isAdmin && onToggleStatus(country.code, el.id),
                "aria-pressed": done
              }, done ? "✓" : ""),
              React.createElement("div", { key: "txt", className: "cp-elem-txt" }, [
                React.createElement("div", { key: "n", className: "cp-elem-name" }, el.name),
                React.createElement("div", { key: "d", className: "cp-elem-desc" }, el.desc)
              ]),
              React.createElement("div", { key: "meta", className: "cp-elem-meta" },
                done ? (dateKey || "Implemented") : "Not implemented")
            ]),
            note ? React.createElement("div", { key: "note", className: "cp-elem-note" }, note) : null,
            isAdmin ? React.createElement("input", {
              key: "input", className: "cp-elem-input",
              placeholder: "Add note or date (YYYY-MM)…",
              defaultValue: note,
              onBlur: (e) => onUpdateNotes(country.code, el.id, e.target.value)
            }) : null
          ]);
        }))
      ])
    )
  );
}

function renderOverview(country) {
  return React.createElement("div", { className: "cp-overview" }, [
    React.createElement("p", { key: "n", className: "cp-narr" }, country.narrative || "No narrative yet."),
    country.metrics && Object.keys(country.metrics).length ?
      React.createElement("div", { key: "m", className: "cp-metrics" },
        Object.entries(country.metrics).map(([k,v]) =>
          React.createElement("div", { key: k, className: "cp-metric" }, [
            React.createElement("div", { key: "l", className: "sme-caption" }, metricLabel(k)),
            React.createElement("div", { key: "v", className: "cp-metric-v" }, v || "—")
          ])
        )
      ) : null,
    React.createElement("div", { key: "contact", className: "cp-contact" }, [
      React.createElement("div", { key: "a" }, [React.createElement("span", {key:"l", className: "sme-caption"}, "Responsible agency"), React.createElement("div", {key:"v"}, country.agency || "—")]),
      React.createElement("div", { key: "c" }, [React.createElement("span", {key:"l", className: "sme-caption"}, "Contact"), React.createElement("div", {key:"v"}, country.contact || "—")])
    ])
  ]);
}
function metricLabel(k){return {cet:"Cost-Effectiveness Threshold", bia:"BIA Threshold", appraisal_questions:"Critical Appraisal Questions"}[k] || k;}

function renderTimeline(country) {
  const tl = (country.timeline || []).slice().sort((a,b) => (a.date||"").localeCompare(b.date||""));
  if (!tl.length) return React.createElement("div", { className: "cp-empty" }, "No milestones recorded yet.");
  return React.createElement("ol", { className: "cp-timeline" },
    tl.map((e,i) => React.createElement("li", { key: i }, [
      React.createElement("div", { key: "d", className: "tl-date" }, e.date || "—"),
      React.createElement("div", { key: "t", className: "tl-title" }, e.title)
    ]))
  );
}

function renderLinks(country) {
  const links = country.links || [];
  if (!links.length) return React.createElement("div", { className: "cp-empty" }, "No external links yet.");
  return React.createElement("ul", { className: "cp-links" },
    links.map((l,i) => React.createElement("li", { key: i },
      React.createElement("a", { href: l.url, target: "_blank", rel: "noopener" }, [
        React.createElement("span", { key: "t" }, l.label),
        React.createElement("span", { key: "a", className: "cp-link-arrow" }, "↗")
      ])
    ))
  );
}

window.CountryPanel = CountryPanel;
