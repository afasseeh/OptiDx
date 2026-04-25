// Main App wiring — country list, globe, panel, admin, tweaks
const { useState, useEffect, useMemo } = React;

function App() {
  // Load/save to localStorage
  const [elements, setElements] = useState(() => {
    const s = localStorage.getItem("sme_hta_elements");
    return s ? JSON.parse(s) : window.HTA_ELEMENTS;
  });
  const [countries, setCountries] = useState(() => {
    const s = localStorage.getItem("sme_hta_countries");
    return s ? JSON.parse(s) : window.HTA_COUNTRIES;
  });
  const [selected, setSelected] = useState("OMN");
  const [query, setQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaks] = useState(window.TWEAK_DEFAULTS || {});

  useEffect(() => { localStorage.setItem("sme_hta_elements", JSON.stringify(elements)); }, [elements]);
  useEffect(() => { localStorage.setItem("sme_hta_countries", JSON.stringify(countries)); }, [countries]);

  // Tweaks protocol
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const applyTweak = (k, v) => {
    const next = { ...tweaks, [k]: v };
    setTweaks(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
  };

  const country = countries.find(c => c.code === selected);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = countries;
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    return list.slice().sort((a,b) => progressPct(b) - progressPct(a));
  }, [countries, query]);

  // Apply theme vars
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.mapTheme || "day");
    document.documentElement.setAttribute("data-layout", tweaks.layout || "split");
    document.documentElement.setAttribute("data-accent", tweaks.accent || "orange");
  }, [tweaks.mapTheme, tweaks.layout, tweaks.accent]);

  const toggleStatus = (code, elId) => {
    setCountries(countries.map(c => c.code === code ? { ...c, status: { ...c.status, [elId]: !c.status[elId] } } : c));
  };
  const updateNotes = (code, elId, val) => {
    setCountries(countries.map(c => {
      if (c.code !== code) return c;
      // Heuristic: YYYY-MM → date field, else note
      const isDate = /^\d{4}-\d{2}/.test(val.trim());
      if (isDate) return { ...c, dates: { ...(c.dates||{}), [elId]: val } };
      return { ...c, notes: { ...(c.notes||{}), [elId]: val } };
    }));
  };

  return React.createElement("div", { className: "app" }, [
    React.createElement(TopBar, { key: "top", isAdmin, onAdminClick: () => setAdminOpen(true), tweaks, applyTweak }),
    React.createElement("div", { key: "main", className: "main" }, [
      React.createElement("aside", { key: "sb", className: "sidebar" }, [
        React.createElement(CountryList, { key: "cl", countries: filtered, selected, onSelect: setSelected, elements, query, setQuery })
      ]),
      React.createElement("section", { key: "gl", className: "stage" }, [
        React.createElement(Globe3D, { key: "g", countries, selectedCode: selected, onSelect: setSelected, theme: tweaks.mapTheme || "day" }),
        React.createElement(Legend, { key: "lg" }),
        React.createElement(StageFooter, { key: "sf", country })
      ]),
      React.createElement("aside", { key: "rp", className: "rightpanel" }, [
        React.createElement(CountryPanel, {
          key: "cp", country, elements, isAdmin, onToggleStatus: toggleStatus, onUpdateNotes: updateNotes
        })
      ])
    ]),
    adminOpen ? React.createElement(AdminPanel, {
      key: "adm", isAdmin, setIsAdmin,
      data: countries, setData: setCountries, elements, setElements,
      onClose: () => setAdminOpen(false)
    }) : null,
    tweaksOpen ? React.createElement(TweaksPanel, { key: "tw", tweaks, applyTweak, onClose: () => setTweaksOpen(false) }) : null
  ]);
}

function TopBar({ isAdmin, onAdminClick, tweaks, applyTweak }) {
  return React.createElement("header", { className: "topbar" }, [
    React.createElement("div", { key: "l", className: "tb-left" }, [
      React.createElement("img", { key: "lg", src: "assets/logo-syreon-middle-east.png", className: "tb-logo", alt: "Syreon Middle East" }),
      React.createElement("div", { key: "div", className: "tb-divider" }),
      React.createElement("div", { key: "t" }, [
        React.createElement("div", { key: "eb", className: "sme-eyebrow" }, "Regional HTA Tracker"),
        React.createElement("div", { key: "h", className: "tb-title" }, "HTA Implementation Progress")
      ])
    ]),
    React.createElement("div", { key: "r", className: "tb-right" }, [
      React.createElement("button", { key: "a", className: "sme-btn ghost", onClick: onAdminClick },
        isAdmin ? "Admin ●" : "Admin")
    ])
  ]);
}

function CountryList({ countries, selected, onSelect, elements, query, setQuery }) {
  return React.createElement("div", { className: "country-list-wrap" }, [
    React.createElement("div", { key: "h", className: "cl-head" }, [
      React.createElement("div", { key: "eb", className: "sme-eyebrow" }, "Countries · " + countries.length),
      React.createElement("input", { key: "s", className: "cl-search", placeholder: "Search…",
        value: query, onChange: (e) => setQuery(e.target.value) })
    ]),
    React.createElement("ul", { key: "ul", className: "country-list" },
      countries.map(c => {
        const total = elements.length;
        const done = elements.filter(e => c.status[e.id]).length;
        const pct = Math.round(done/total*100);
        const isSel = c.code === selected;
        return React.createElement("li", { key: c.code, className: "cl-item" + (isSel ? " selected" : ""),
          onClick: () => onSelect(c.code) }, [
          React.createElement("div", { key: "l", className: "cl-bar", style: { width: pct + "%" } }),
          React.createElement("div", { key: "row", className: "cl-row" }, [
            React.createElement("div", { key: "n", className: "cl-name" }, [
              React.createElement("span", { key: "c", className: "cl-code" }, c.code),
              React.createElement("span", { key: "nm" }, c.name)
            ]),
            React.createElement("div", { key: "p", className: "cl-pct" }, pct + "%")
          ]),
          React.createElement("div", { key: "sub", className: "cl-sub" }, done + "/" + total + " elements")
        ]);
      })
    )
  ]);
}

function Legend() {
  return React.createElement("div", { className: "legend" }, [
    React.createElement("div", { key: "t", className: "sme-caption" }, "Progress key"),
    React.createElement("div", { key: "r", className: "legend-row" }, [
      swatch("#B0B5B9", "None"),
      swatch("#FCE0CC", "1-3"),
      swatch("#F9C09A", "4-11"),
      swatch("#F37739", "12-17")
    ])
  ]);
  function swatch(color, label) {
    return React.createElement("div", { key: label, className: "swatch" }, [
      React.createElement("span", { key: "s", style: { background: color } }),
      React.createElement("span", { key: "l" }, label)
    ]);
  }
}

function StageFooter({ country }) {
  if (!country) return null;
  return React.createElement("div", { className: "stage-footer" }, [
    React.createElement("div", { key: "l", className: "sme-caption" }, "Focused region"),
    React.createElement("div", { key: "n" }, country.name),
    React.createElement("div", { key: "m", className: "sme-caption" }, country.lat.toFixed(1) + "° N, " + country.lng.toFixed(1) + "° E")
  ]);
}

function TweaksPanel({ tweaks, applyTweak, onClose }) {
  return React.createElement("div", { className: "tweaks-panel" }, [
    React.createElement("div", { key: "h", className: "tweaks-head" }, [
      React.createElement("div", { key: "t" }, [
        React.createElement("div", { key: "eb", className: "sme-eyebrow" }, "Tweaks"),
        React.createElement("div", { key: "h", className: "tweaks-title" }, "Design variations")
      ]),
      React.createElement("button", { key: "x", className: "tweaks-close", onClick: onClose }, "×")
    ]),
    tweakGroup("Map theme", [
      ["day", "Day"], ["night", "Night / orange accent"]
    ], "mapTheme"),
    tweakGroup("Layout", [
      ["split", "Split (list · globe · panel)"], ["globe-first", "Globe hero, panel slides in"], ["panel-left", "Panel left, list right"]
    ], "layout"),
    tweakGroup("Accent", [
      ["orange", "Syreon orange"], ["mono", "Mono / charcoal only"], ["sunrise", "Orange + warm sand"]
    ], "accent"),
    tweakGroup("Pattern overlay", [
      ["none", "None"], ["ghost", "Ghost S pattern"]
    ], "pattern")
  ]);
  function tweakGroup(label, options, key) {
    const current = tweaks[key] || options[0][0];
    return React.createElement("div", { key: label, className: "tweak-group" }, [
      React.createElement("div", { key: "l", className: "sme-caption" }, label),
      React.createElement("div", { key: "o", className: "tweak-options" },
        options.map(([v, l]) => React.createElement("button", {
          key: v, className: "tweak-opt" + (current === v ? " active" : ""),
          onClick: () => applyTweak(key, v)
        }, l))
      )
    ]);
  }
}

window.App = App;
