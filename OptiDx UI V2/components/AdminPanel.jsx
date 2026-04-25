// AdminPanel — password gate + edit controls (add country, add element, export JSON, import)
const { useState: useStateAP } = React;

const ADMIN_PW = "syreon"; // default — user can change via UI

function AdminPanel({ isAdmin, setIsAdmin, data, setData, elements, setElements, onClose }) {
  const [pw, setPw] = useStateAP("");
  const [err, setErr] = useStateAP("");
  const [view, setView] = useStateAP("main");
  const [newCountry, setNewCountry] = useStateAP({ code: "", name: "", lat: 0, lng: 0 });
  const [newElement, setNewElement] = useStateAP({ id: "", name: "", group: "Policy & Frameworks", desc: "" });

  if (!isAdmin) {
    const storedPw = localStorage.getItem("sme_hta_admin_pw") || ADMIN_PW;
    return React.createElement("div", { className: "admin-overlay" },
      React.createElement("div", { className: "admin-modal" }, [
        React.createElement("button", { key: "x", className: "admin-close", onClick: onClose }, "×"),
        React.createElement("div", { key: "eb", className: "sme-eyebrow" }, "Admin"),
        React.createElement("h2", { key: "h" }, "Sign in"),
        React.createElement("p", { key: "p", className: "admin-hint" }, "Password is stored locally. Default is ", React.createElement("code", { key: "c" }, "syreon"), "."),
        React.createElement("input", { key: "i", type: "password", placeholder: "Password", value: pw,
          onChange: (e) => setPw(e.target.value),
          onKeyDown: (e) => { if (e.key === "Enter") trySignin(); } }),
        err ? React.createElement("div", { key: "e", className: "admin-err" }, err) : null,
        React.createElement("button", { key: "s", className: "sme-btn", onClick: trySignin }, "Sign in")
      ])
    );
    function trySignin() {
      if (pw === storedPw) { setIsAdmin(true); setErr(""); }
      else setErr("Incorrect password.");
    }
  }

  return React.createElement("div", { className: "admin-overlay" },
    React.createElement("div", { className: "admin-modal wide" }, [
      React.createElement("button", { key: "x", className: "admin-close", onClick: onClose }, "×"),
      React.createElement("div", { key: "h", className: "admin-head" }, [
        React.createElement("div", { key: "l" }, [
          React.createElement("div", { key: "eb", className: "sme-eyebrow" }, "Admin panel"),
          React.createElement("h2", { key: "h" }, "Manage HTA progress data")
        ]),
        React.createElement("button", { key: "out", className: "sme-btn ghost", onClick: () => setIsAdmin(false) }, "Sign out")
      ]),
      React.createElement("div", { key: "tabs", className: "admin-tabs" },
        [["main","Overview"],["addCountry","Add country"],["addElement","Add element"],["data","Data I/O"],["security","Security"]].map(([id,lbl]) =>
          React.createElement("button", { key: id, className: "admin-tab" + (view===id?" active":""), onClick: () => setView(id) }, lbl)
        )
      ),
      React.createElement("div", { key: "body", className: "admin-body" },
        view === "main" ? renderMain() :
        view === "addCountry" ? renderAddCountry() :
        view === "addElement" ? renderAddElement() :
        view === "data" ? renderDataIO() :
        renderSecurity()
      )
    ])
  );

  function renderMain() {
    return React.createElement("div", {}, [
      React.createElement("p", { key: "p", className: "admin-hint" }, "Admin mode is now active across the app. Country details show an editable checklist and per-element note fields; changes auto-save to this browser. Use Data I/O to back up or share."),
      React.createElement("div", { key: "g", className: "admin-grid" }, [
        stat("Countries", data.length),
        stat("Elements", elements.length),
        stat("Avg progress", avgProgress() + "%"),
        stat("Last saved", new Date().toLocaleString())
      ])
    ]);
  }

  function stat(label, value) {
    return React.createElement("div", { key: label, className: "admin-stat" }, [
      React.createElement("div", { key: "l", className: "sme-caption" }, label),
      React.createElement("div", { key: "v", className: "admin-stat-v" }, value)
    ]);
  }

  function avgProgress() {
    let t=0,d=0;
    data.forEach(c => { elements.forEach(e => { t++; if (c.status[e.id]) d++; }); });
    return t ? Math.round(d/t*100) : 0;
  }

  function renderAddCountry() {
    return React.createElement("div", { className: "admin-form" }, [
      ["code","ISO Code (3)", "e.g. LBN"], ["name","Country name", ""], ["lat","Latitude","0"], ["lng","Longitude","0"]
    ].map(([k,l,ph]) => React.createElement("label", { key: k }, [
      React.createElement("span", { key: "l", className: "sme-caption" }, l),
      React.createElement("input", { key: "i", value: newCountry[k], placeholder: ph,
        onChange: (e) => setNewCountry({ ...newCountry, [k]: (k==="lat"||k==="lng") ? +e.target.value : e.target.value }) })
    ])).concat([
      React.createElement("button", { key: "a", className: "sme-btn", onClick: addCountry }, "Add country")
    ]));
  }
  function addCountry() {
    if (!newCountry.code || !newCountry.name) return;
    const st = Object.fromEntries(elements.map(e => [e.id, false]));
    setData([...data, { ...newCountry, score: 0, agency: "", contact: "", narrative: "", metrics: {}, links: [], timeline: [], status: st }]);
    setNewCountry({ code: "", name: "", lat: 0, lng: 0 });
  }

  function renderAddElement() {
    return React.createElement("div", { className: "admin-form" }, [
      React.createElement("label", { key: "id" }, [
        React.createElement("span", { key: "l", className: "sme-caption" }, "ID (lowercase, underscores)"),
        React.createElement("input", { key: "i", value: newElement.id, onChange: (e) => setNewElement({ ...newElement, id: e.target.value.toLowerCase().replace(/\s+/g,"_") }) })
      ]),
      React.createElement("label", { key: "n" }, [
        React.createElement("span", { key: "l", className: "sme-caption" }, "Name"),
        React.createElement("input", { key: "i", value: newElement.name, onChange: (e) => setNewElement({ ...newElement, name: e.target.value }) })
      ]),
      React.createElement("label", { key: "g" }, [
        React.createElement("span", { key: "l", className: "sme-caption" }, "Group"),
        React.createElement("select", { key: "s", value: newElement.group, onChange: (e) => setNewElement({ ...newElement, group: e.target.value }) },
          ["Policy & Frameworks","Methods & Tools","Training & Capacity","Institutional"].map(g =>
            React.createElement("option", { key: g, value: g }, g)))
      ]),
      React.createElement("label", { key: "d" }, [
        React.createElement("span", { key: "l", className: "sme-caption" }, "Description"),
        React.createElement("textarea", { key: "i", rows: 3, value: newElement.desc, onChange: (e) => setNewElement({ ...newElement, desc: e.target.value }) })
      ]),
      React.createElement("button", { key: "a", className: "sme-btn", onClick: addElement }, "Add element")
    ]);
  }
  function addElement() {
    if (!newElement.id || !newElement.name) return;
    setElements([...elements, newElement]);
    setData(data.map(c => ({ ...c, status: { ...c.status, [newElement.id]: false } })));
    setNewElement({ id: "", name: "", group: "Policy & Frameworks", desc: "" });
  }

  function renderDataIO() {
    return React.createElement("div", { className: "admin-form" }, [
      React.createElement("p", { key: "p", className: "admin-hint" }, "Export a JSON snapshot of countries, elements, and all progress. Import overwrites current data."),
      React.createElement("div", { key: "row", className: "admin-row" }, [
        React.createElement("button", { key: "e", className: "sme-btn", onClick: doExport }, "Export JSON"),
        React.createElement("label", { key: "i", className: "sme-btn ghost file-btn" }, [
          "Import JSON",
          React.createElement("input", { key: "f", type: "file", accept: "application/json", onChange: doImport })
        ])
      ]),
      React.createElement("pre", { key: "pv", className: "admin-preview" }, JSON.stringify({ elements: elements.length, countries: data.length }, null, 2))
    ]);
  }
  function doExport() {
    const blob = new Blob([JSON.stringify({ elements, countries: data, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hta-progress-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.elements) setElements(parsed.elements);
        if (parsed.countries) setData(parsed.countries);
      } catch (err) { alert("Invalid JSON: " + err.message); }
    };
    reader.readAsText(file);
  }

  function renderSecurity() {
    return React.createElement("div", { className: "admin-form" }, [
      React.createElement("p", { key: "p", className: "admin-hint" }, "Change the admin password. Stored locally in this browser only."),
      React.createElement("input", { key: "i", type: "password", placeholder: "New password", id: "newpw" }),
      React.createElement("button", { key: "b", className: "sme-btn", onClick: () => {
        const v = document.getElementById("newpw").value;
        if (v) { localStorage.setItem("sme_hta_admin_pw", v); alert("Password updated."); }
      } }, "Update password")
    ]);
  }
}

window.AdminPanel = AdminPanel;
