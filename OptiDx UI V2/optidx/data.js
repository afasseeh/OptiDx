// OptiDx seed data — tests, pathways, evidence
window.SEED_TESTS = [
  { id: "t_symp", name: "Symptom Screen (WHO-4)", category: "clinical", icon: "clipboard-list", cost: 0.50, currency: "USD", sens: 0.77, spec: 0.68, tat: 5, tatUnit: "min", sample: "none", skill: "CHW", evidence: "WHO, 2021", notes: "Cough >2wk, fever, night sweats, weight loss", available: true },
  { id: "t_cxr", name: "Chest X-Ray (CAD4TB)", category: "imaging", icon: "scan", cost: 3.20, currency: "USD", sens: 0.90, spec: 0.76, tat: 30, tatUnit: "min", sample: "imaging", skill: "Radiographer", evidence: "Qin et al., 2021", notes: "AI-read chest radiograph, threshold ≥0.50", available: true },
  { id: "t_xpert", name: "Xpert MTB/RIF Ultra", category: "molecular", icon: "dna", cost: 9.98, currency: "USD", sens: 0.88, spec: 0.98, tat: 2, tatUnit: "hr", sample: "sputum", skill: "Lab Tech", evidence: "WHO, 2024", notes: "Cartridge-based NAAT, includes rifampicin resistance", available: true },
  { id: "t_lam", name: "Urine LF-LAM", category: "rapid", icon: "test-tube", cost: 3.50, currency: "USD", sens: 0.42, spec: 0.91, tat: 25, tatUnit: "min", sample: "urine", skill: "Nurse", evidence: "Bjerrum, 2019", notes: "Lateral flow, adults with HIV", available: true },
  { id: "t_smear", name: "Sputum Smear Microscopy", category: "pathology", icon: "microscope", cost: 1.80, currency: "USD", sens: 0.61, spec: 0.98, tat: 1, tatUnit: "hr", sample: "sputum", skill: "Lab Tech", evidence: "WHO, 2018", notes: "Ziehl-Neelsen stain", available: true },
  { id: "t_cult", name: "Liquid Culture (MGIT)", category: "culture", icon: "flask-conical", cost: 18.50, currency: "USD", sens: 0.98, spec: 0.99, tat: 14, tatUnit: "day", sample: "sputum", skill: "Specialist", evidence: "WHO, 2022", notes: "Gold standard; long TAT", available: true },
  { id: "t_trufi", name: "Truenat MTB Plus", category: "molecular", icon: "dna", cost: 7.20, currency: "USD", sens: 0.85, spec: 0.97, tat: 1, tatUnit: "hr", sample: "sputum", skill: "Lab Tech", evidence: "ICMR, 2020", notes: "Chip-based PCR, portable", available: true },
  { id: "t_ifn", name: "IGRA (IFN-γ release)", category: "biomarker", icon: "droplets", cost: 22.00, currency: "USD", sens: 0.80, spec: 0.97, tat: 24, tatUnit: "hr", sample: "blood", skill: "Lab Tech", evidence: "CDC, 2022", notes: "Not for active disease diagnosis", available: false },
];

window.SEED_PATHWAYS = [
  { id: "p_tb_main", name: "TB Community Screening", disease: "Pulmonary TB", updated: "2 days ago", owner: "A. Khalil", status: "Active", sens: 0.842, spec: 0.946, cost: 5.62, tat: "2.8 hr" },
  { id: "p_hiv", name: "HIV Serial Testing, Egypt", disease: "HIV", updated: "6 days ago", owner: "N. Ibrahim", status: "Draft", sens: 0.991, spec: 0.999, cost: 2.10, tat: "45 min" },
  { id: "p_hcc", name: "HCC Surveillance (US + AFP)", disease: "Hepatocellular carcinoma", updated: "2 weeks ago", owner: "A. Khalil", status: "Active", sens: 0.76, spec: 0.91, cost: 38.00, tat: "1 day" },
  { id: "p_hcv", name: "HCV Confirm Pathway, UAE", disease: "Hepatitis C", updated: "1 month ago", owner: "M. Osman", status: "Archived", sens: 0.98, spec: 0.995, cost: 12.30, tat: "3 day" },
];

window.SEED_TEMPLATES = [
  { id: "tpl_tb", name: "TB screening pathway", desc: "WHO-4 symptoms → CAD4TB → Xpert Ultra confirm.", tests: 3, icon: "stethoscope" },
  { id: "tpl_hiv", name: "HIV serial testing", desc: "Two sequential rapid tests, confirm on discordance.", tests: 3, icon: "heart-pulse" },
  { id: "tpl_hcc", name: "HCC surveillance", desc: "Ultrasound + AFP in parallel with discordance referee.", tests: 3, icon: "activity" },
  { id: "tpl_2step", name: "Two-step screen-confirm", desc: "Generic sequential screen then confirm pattern.", tests: 2, icon: "arrow-right" },
  { id: "tpl_par", name: "Parallel + referee", desc: "Two parallel tests with a referee on discordance.", tests: 3, icon: "git-branch" },
];

// TB pathway layout — for the canvas
window.SEED_NODES = [
  { id: "n1", type: "test", testId: "t_symp", x: 20,  y: 240, label: "Entry: Symptom screen" },
  { id: "n2", type: "test", testId: "t_cxr",  x: 290, y: 240 },
  { id: "n3", type: "parallel", x: 560, y: 180, label: "Confirmatory parallel block",
    members: [
      { testId: "t_xpert" },
      { testId: "t_smear" },
    ],
    rule: "BOTH_POS"
  },
  { id: "n4", type: "test", testId: "t_cult", x: 880, y: 180, kind: "referee", label: "Referee on discordance" },
  { id: "n5", type: "terminal", subtype: "pos", label: "TB, Treat", x: 1160, y: 100 },
  { id: "n6", type: "terminal", subtype: "neg", label: "TB Unlikely", x: 1160, y: 280 },
  { id: "n7", type: "terminal", subtype: "neg", label: "No TB", x: 560, y: 440 },
  { id: "n8", type: "terminal", subtype: "inc", label: "Inconclusive", x: 1160, y: 440 },
  { id: "n9", type: "annotation", text: "Assumes conditional independence between Xpert and smear, given disease status (Qu et al., 2020).", x: 290, y: 440 },
];
window.SEED_EDGES = [
  { id: "e1", from: "n1", fromPort: "pos", to: "n2", label: "Positive", kind: "pos" },
  { id: "e2", from: "n1", fromPort: "neg", to: "n7", label: "Negative", kind: "neg" },
  { id: "e3", from: "n2", fromPort: "pos", to: "n3", label: "Positive", kind: "pos" },
  { id: "e4", from: "n2", fromPort: "neg", to: "n6", label: "Negative", kind: "neg" },
  { id: "e5", from: "n3", fromPort: "both_pos",  to: "n5", label: "Both positive", kind: "pos" },
  { id: "e6", from: "n3", fromPort: "both_neg",  to: "n6", label: "Both negative", kind: "neg" },
  { id: "e7", from: "n3", fromPort: "discord",   to: "n4", label: "Discordant → referee", kind: "disc" },
  { id: "e8", from: "n4", fromPort: "pos", to: "n5", label: "Positive", kind: "pos" },
  { id: "e9", from: "n4", fromPort: "neg", to: "n8", label: "Negative", kind: "inc" },
];

// Decision rule presets
window.RULE_PRESETS = [
  { id: "POS",        label: "Test is positive",        natural: "the test is positive" },
  { id: "NEG",        label: "Test is negative",        natural: "the test is negative" },
  { id: "BOTH_POS",   label: "Both tests positive",     natural: "both tests are positive" },
  { id: "BOTH_NEG",   label: "Both tests negative",     natural: "both tests are negative" },
  { id: "DISCORD",    label: "Results discordant",      natural: "the results are discordant" },
  { id: "ANY_POS",    label: "Any test positive",       natural: "any test is positive" },
  { id: "ALL_NEG",    label: "All tests negative",      natural: "all tests are negative" },
  { id: "CUSTOM",     label: "Custom rule (advanced)",  natural: "a custom Boolean expression evaluates true" },
];

// Validation findings — for the validation panel
window.SEED_VALIDATIONS = [
  { id: "v1", level: "warn", title: "Aggregate sensitivity below threshold",
    detail: "Pathway sensitivity (84.2%) is below the user-defined minimum of 85%.",
    fix: "Replace symptom screen with CAD4TB at entry, or remove the symptom-negative early exit.",
    target: "pathway" },
  { id: "v2", level: "info", title: "Conditional independence assumed",
    detail: "Parallel block ‘Confirmatory’ assumes Xpert and smear are conditionally independent given disease status.",
    fix: "Cite Qu et al. (2020) or supply a covariance term for the joint likelihood.",
    target: "n3" },
  { id: "v3", level: "warn", title: "Discordance branch lacks downstream resolution detail",
    detail: "Referee test (Liquid Culture) terminates an inconclusive 14-day path; consider an interim presumptive treat node.",
    fix: "Add an ‘Empiric treat pending culture’ terminal off the referee positive branch.",
    target: "n4" },
  { id: "v4", level: "info", title: "Three sample types required",
    detail: "Pathway requires None, Imaging, and Sputum. Operational burden flagged ‘moderate’.",
    fix: "Drop CAD4TB if imaging access is constrained at site level.",
    target: "pathway" },
];

// Path-level enumeration (root → terminal)
window.SEED_PATHS = [
  { id: "P1", sequence: [
      {label:"Symptom +", kind:"pos"}, {label:"CXR +", kind:"pos"},
      {label:"Xpert + & Smear +", kind:"pos"}],
    terminal: "TB, Treat", terminalKind: "pos",
    pIfD: 0.610, pIfND: 0.004, cost: 16.18, tat: "2.5 h", samples: "Sputum", skill: "Lab Tech" },
  { id: "P2", sequence: [
      {label:"Symptom +", kind:"pos"}, {label:"CXR +", kind:"pos"},
      {label:"Discordant", kind:"disc"}, {label:"Culture +", kind:"pos"}],
    terminal: "TB, Treat", terminalKind: "pos",
    pIfD: 0.182, pIfND: 0.018, cost: 34.68, tat: "14 d", samples: "Sputum", skill: "Specialist" },
  { id: "P3", sequence: [
      {label:"Symptom +", kind:"pos"}, {label:"CXR +", kind:"pos"},
      {label:"Discordant", kind:"disc"}, {label:"Culture −", kind:"neg"}],
    terminal: "Inconclusive", terminalKind: "inc",
    pIfD: 0.026, pIfND: 0.058, cost: 34.68, tat: "14 d", samples: "Sputum", skill: "Specialist" },
  { id: "P4", sequence: [
      {label:"Symptom +", kind:"pos"}, {label:"CXR +", kind:"pos"},
      {label:"Both negative", kind:"neg"}],
    terminal: "TB Unlikely", terminalKind: "neg",
    pIfD: 0.080, pIfND: 0.087, cost: 16.18, tat: "2.5 h", samples: "Sputum", skill: "Lab Tech" },
  { id: "P5", sequence: [
      {label:"Symptom +", kind:"pos"}, {label:"CXR −", kind:"neg"}],
    terminal: "TB Unlikely", terminalKind: "neg",
    pIfD: 0.077, pIfND: 0.220, cost: 3.70, tat: "35 m", samples: "Imaging", skill: "Radiographer" },
  { id: "P6", sequence: [
      {label:"Symptom −", kind:"neg"}],
    terminal: "No TB", terminalKind: "neg",
    pIfD: 0.025, pIfND: 0.613, cost: 0.50, tat: "5 m", samples: "None", skill: "CHW" },
];

// Evidence DB
window.SEED_EVIDENCE = [
  { id: "ev1", test: "Xpert MTB/RIF Ultra", disease: "Pulmonary TB", sens: 0.88, spec: 0.98, source: "Zifodya et al., Cochrane 2021", country: "Global", year: 2021, confidence: "High", population: "Adults, sputum-positive suspects" },
  { id: "ev2", test: "CAD4TB v6", disease: "Pulmonary TB", sens: 0.90, spec: 0.76, source: "Qin et al., Lancet Digital Health 2021", country: "Multi", year: 2021, confidence: "High", population: "Symptomatic adults, screening" },
  { id: "ev3", test: "LF-LAM", disease: "TB in PLHIV", sens: 0.42, spec: 0.91, source: "Bjerrum et al., Cochrane 2019", country: "SSA", year: 2019, confidence: "Moderate", population: "HIV+ adults, CD4<200" },
  { id: "ev4", test: "Truenat MTB Plus", disease: "Pulmonary TB", sens: 0.85, spec: 0.97, source: "ICMR multi-centric, 2020", country: "India", year: 2020, confidence: "Moderate", population: "Peripheral lab network" },
  { id: "ev5", test: "Sputum smear", disease: "Pulmonary TB", sens: 0.61, spec: 0.98, source: "Steingart et al., 2006", country: "Global", year: 2006, confidence: "High", population: "Adult symptomatic" },
  { id: "ev6", test: "MGIT culture", disease: "Pulmonary TB", sens: 0.98, spec: 0.99, source: "WHO Handbook, 2022", country: "Global", year: 2022, confidence: "High", population: "Reference standard" },
];

// Results — precomputed for TB pathway
window.SEED_RESULTS = {
  sens: 0.842, spec: 0.946, fnr: 0.158, fpr: 0.054,
  cost: 5.62, tat: "2.8 hr", ppv: 0.58, npv: 0.987, prevalence: 0.08,
  skill: "Lab Tech", samples: ["None", "Imaging", "Sputum"],
  paths: [
    { id: "P1", sequence: "Symp(+) → CXR(+) → Xpert(+)", terminal: "TB, Treat",   pIfD: 0.610, pIfND: 0.004, cost: 13.68, tat: "2.5h", samples: "Spu", skill: "Lab" },
    { id: "P2", sequence: "Symp(+) → CXR(+) → Xpert(−)", terminal: "TB Unlikely",  pIfD: 0.083, pIfND: 0.163, cost: 13.68, tat: "2.5h", samples: "Spu", skill: "Lab" },
    { id: "P3", sequence: "Symp(+) → CXR(−)",             terminal: "TB Unlikely", pIfD: 0.077, pIfND: 0.220, cost: 3.70,  tat: "35m", samples: "Img", skill: "Rad" },
    { id: "P4", sequence: "Symp(−)",                       terminal: "No TB",       pIfD: 0.230, pIfND: 0.613, cost: 0.50,  tat: "5m",  samples: ",",   skill: "CHW" },
  ],
  warnings: [
    { kind: "info", text: "Assumes conditional independence between CXR and Xpert given disease status." },
    { kind: "warn", text: "Sensitivity (84.2%) is below the user-defined minimum threshold of 85%." },
    { kind: "info", text: "Three sample types required: none, imaging, sputum. Operational burden: moderate." },
  ],
};

window.SEED_COMPARE = [
  { id: "c1", name: "Current pathway",        sens: 0.842, spec: 0.946, cost: 5.62,  tat: "2.8h", ppv: 0.58, npv: 0.987, skill: "Lab Tech",  samples: 3, feasible: true },
  { id: "c2", name: "Cheapest viable",        sens: 0.810, spec: 0.925, cost: 3.80,  tat: "2.1h", ppv: 0.48, npv: 0.982, skill: "Lab Tech",  samples: 2, feasible: true },
  { id: "c3", name: "Fastest viable",         sens: 0.798, spec: 0.934, cost: 4.90,  tat: "40m", ppv: 0.51, npv: 0.981, skill: "Radiographer", samples: 2, feasible: true },
  { id: "c4", name: "Highest sensitivity",    sens: 0.962, spec: 0.901, cost: 24.30, tat: "15d", ppv: 0.46, npv: 0.996, skill: "Specialist", samples: 2, feasible: false, reason: "TAT > 72h constraint" },
  { id: "c5", name: "Highest specificity",    sens: 0.712, spec: 0.993, cost: 11.20, tat: "3.5h", ppv: 0.86, npv: 0.976, skill: "Lab Tech",  samples: 3, feasible: true },
  { id: "c6", name: "Balanced MCDA",          sens: 0.856, spec: 0.951, cost: 6.10,  tat: "2.4h", ppv: 0.60, npv: 0.988, skill: "Lab Tech",  samples: 3, feasible: true },
];
