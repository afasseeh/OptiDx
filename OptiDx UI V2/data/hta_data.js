// HTA Progress Map — data model
// 18 MENA/Gulf countries × 17 HTA elements
// Default data derived from HTA_MENA_FULL_Presentation_V3.pptx (progress scores,
// narrative bullets, country-specific detail slides).

window.HTA_ELEMENTS = [
  { id: "roadmap",         name: "HTA Roadmap",                       group: "Policy & Frameworks", desc: "A structured national plan outlining the phased development, governance, and implementation of HTA functions." },
  { id: "cet",             name: "Cost-effectiveness Threshold (CET)", group: "Policy & Frameworks", desc: "A benchmark value used to determine whether a health intervention offers sufficient value for money." },
  { id: "bia_threshold",   name: "BIA Threshold",                     group: "Policy & Frameworks", desc: "A predefined limit for acceptable short-term budget impact to support affordability assessments." },
  { id: "guidelines",      name: "Guidelines",                        group: "Methods & Tools",     desc: "Standardized methodological instructions for conducting and submitting HTA evaluations." },
  { id: "critical_appraisal", name: "Critical Appraisal Checklist",   group: "Methods & Tools",     desc: "A structured assessment tool used to evaluate the quality and rigor of HTA submissions." },
  { id: "mcda_orphan",     name: "MCDA Orphan Drugs",                 group: "Methods & Tools",     desc: "A multi-criteria decision analysis tool tailored to evaluate rare disease treatments using expanded value dimensions." },
  { id: "mcda_oop",        name: "MCDA Out-of-Patent Pharmaceuticals", group: "Methods & Tools",    desc: "A structured MCDA framework that guides decisions on generics and biosimilars procurement." },
  { id: "mea",             name: "Managed Entry Agreements Framework", group: "Policy & Frameworks", desc: "Policies enabling conditional reimbursement agreements, such as performance-based or financial-based MEAs." },
  { id: "biosimilars",     name: "Biosimilars Policy Framework",      group: "Policy & Frameworks", desc: "Rules that govern pricing, interchangeability, switching, and adoption of biosimilar products." },
  { id: "priority_setting",name: "Priority Setting Tool",             group: "Methods & Tools",     desc: "A decision-support framework that prioritizes innovative health interventions for assessment within capacity constraints." },
  { id: "patient_engagement", name: "Patient Engagement",             group: "Methods & Tools",     desc: "Structured processes enabling patient voice to be incorporated in HTA assessments and decision-making." },
  { id: "unit_establishment", name: "HTA Unit Establishment Support", group: "Institutional",       desc: "Technical and organizational assistance for creating or strengthening national or institutional HTA units." },
  { id: "foundational_cb", name: "Foundational Capacity Building",    group: "Training & Capacity", desc: "One-year training program aimed at building foundational technical HTA skills within the government." },
  { id: "decision_makers", name: "Decision Makers Training",          group: "Training & Capacity", desc: "Targeted training for policymakers to strengthen skills in interpreting HTA evidence and making value-based decisions." },
  { id: "tech_validation", name: "Technical Validation",              group: "Institutional",       desc: "Processes ensuring methodological quality, internal consistency, and transparency of HTA models and evidence." },
  { id: "ips_modelling",   name: "IPS Modelling Training",            group: "Training & Capacity", desc: "Specialized training on constructing and interpreting patient-level simulation models for HTA." },
  { id: "bia_training",    name: "BIA Training Course",               group: "Training & Capacity", desc: "Training focused on methods to quantify short-term financial impacts of new technologies." }
];

// Countries with ISO codes, lat/lng (for globe placement) and progress score (0-10 from deck).
// Defaults for element status are seeded from country narratives in the deck.
// Anything not explicitly described in the deck starts as "not done" — admins fill in the rest.
window.HTA_COUNTRIES = [
  {
    code: "OMN", name: "Oman", lat: 21.0, lng: 55.9, score: 5,
    agency: "Ministry of Health — HTA Unit",
    contact: "info@moh.gov.om",
    narrative: "Oman has published comprehensive national HTA methodological guidelines, formalizing and standardizing HTA practice. It established official cost-effectiveness thresholds (CETs) with differential considerations including higher thresholds for orphan drugs, and introduced an advanced critical appraisal checklist with 100+ evaluation questions.",
    metrics: { cet: "Tiered CET (baseline + rarity + priority multipliers)", bia: "—", appraisal_questions: "100+" },
    links: [
      { label: "Ministry of Health (Oman)", url: "https://www.moh.gov.om" },
      { label: "HTA Guidelines Publication", url: "https://www.moh.gov.om" }
    ],
    timeline: [
      { date: "2022-01", title: "HTA Roadmap drafted" },
      { date: "2023-06", title: "National HTA Guidelines published" },
      { date: "2024-02", title: "Critical Appraisal Checklist (100+ Q) released" },
      { date: "2024-11", title: "Official CETs with orphan-drug modifier adopted" }
    ],
    status: {
      roadmap: true, cet: true, bia_threshold: false, guidelines: true,
      critical_appraisal: true, mcda_orphan: true, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: true, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: false,
      tech_validation: true, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "ARE", name: "United Arab Emirates", lat: 24.0, lng: 54.0, score: 7,
    agency: "Department of Health — Abu Dhabi (DoH)",
    contact: "info@doh.gov.ae",
    narrative: "DoH has published comprehensive national HTA methodological guidelines, advancing formalization and standardization of HTA practice. It established official CETs with differential modifiers, including enhanced thresholds for orphan drugs. HTA development aligns with Abu Dhabi's broader transition toward value-based healthcare.",
    metrics: { cet: "Baseline × Relative Health Gain × Severity × Rarity multipliers", bia: "—", appraisal_questions: "—" },
    links: [
      { label: "Department of Health Abu Dhabi", url: "https://www.doh.gov.ae" },
      { label: "UAE Ministry of Health & Prevention", url: "https://mohap.gov.ae" }
    ],
    timeline: [
      { date: "2022-09", title: "HTA Roadmap adopted" },
      { date: "2023-03", title: "Guidelines published" },
      { date: "2024-05", title: "CET with 4 multipliers formalized" },
      { date: "2025-01", title: "Value-based healthcare integration" }
    ],
    status: {
      roadmap: true, cet: true, bia_threshold: false, guidelines: true,
      critical_appraisal: true, mcda_orphan: true, mcda_oop: false, mea: true,
      biosimilars: false, priority_setting: true, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: true,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "EGY", name: "Egypt", lat: 26.8, lng: 30.8, score: 7,
    agency: "UPA, EDA, UHIA & Ministry of Health and Population",
    contact: "info@mohp.gov.eg",
    narrative: "The HTA landscape in Egypt has evolved in recent years with the establishment of the Unified Procurement Authority (UPA), Egyptian Drug Authority (EDA), Universal Health Insurance Authority (UHIA) and strengthened stewardship by the Ministry of Health and Population. Ongoing efforts are developing a more inclusive, unified HTA process across agencies, supported by collaboration with international partners.",
    metrics: { cet: "Baseline + rarity + out-of-pocket multipliers", bia: "—", appraisal_questions: "—" },
    links: [
      { label: "Ministry of Health and Population", url: "https://www.mohp.gov.eg" },
      { label: "Egyptian Drug Authority", url: "https://www.edaegypt.gov.eg" },
      { label: "Universal Health Insurance Authority", url: "https://uhia.gov.eg" }
    ],
    timeline: [
      { date: "2019-01", title: "UHIA & EDA established" },
      { date: "2022-07", title: "UPA centralized procurement" },
      { date: "2024-09", title: "Draft national HTA process" }
    ],
    status: {
      roadmap: true, cet: true, bia_threshold: false, guidelines: true,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: true, mea: true,
      biosimilars: true, priority_setting: true, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "SAU", name: "Saudi Arabia", lat: 23.9, lng: 45.1, score: 7,
    agency: "Saudi Food and Drug Authority / MoH",
    contact: "info@sfda.gov.sa",
    narrative: "Saudi Arabia has advanced HTA capabilities through SFDA and MoH initiatives, with a focus on high-cost pharmaceuticals and national capacity building.",
    metrics: { cet: "Under development", bia: "—", appraisal_questions: "—" },
    links: [{ label: "Saudi FDA", url: "https://www.sfda.gov.sa" }, { label: "Ministry of Health", url: "https://www.moh.gov.sa" }],
    timeline: [
      { date: "2021-03", title: "HTA Roadmap initiated" },
      { date: "2023-06", title: "Guidelines draft circulated" }
    ],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: true,
      critical_appraisal: true, mcda_orphan: false, mcda_oop: false, mea: true,
      biosimilars: true, priority_setting: true, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "TUN", name: "Tunisia", lat: 33.9, lng: 9.5, score: 7,
    agency: "Ministry of Health — National Instance for Health Assessment & Accreditation (INEAS)",
    contact: "contact@ineas.tn",
    narrative: "Tunisia, via INEAS, has issued methodological guidance and conducted capacity-building, leveraging collaboration with WHO and international partners.",
    metrics: { cet: "Under development", bia: "—", appraisal_questions: "—" },
    links: [{ label: "INEAS", url: "https://www.ineas.tn" }],
    timeline: [
      { date: "2020-05", title: "INEAS HTA mandate expanded" },
      { date: "2023-02", title: "HTA Methodological Guide published" }
    ],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: true,
      critical_appraisal: true, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: true, patient_engagement: true,
      unit_establishment: true, foundational_cb: true, decision_makers: true,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "JOR", name: "Jordan", lat: 31.2, lng: 36.5, score: 6,
    agency: "Ministry of Health / Jordan Food and Drug Administration",
    contact: "info@moh.gov.jo",
    narrative: "Jordan has advanced in HTA governance with guidelines development, capacity training, and active collaboration with international partners.",
    metrics: { cet: "—", bia: "—", appraisal_questions: "—" },
    links: [{ label: "Ministry of Health (Jordan)", url: "https://www.moh.gov.jo" }],
    timeline: [
      { date: "2022-11", title: "HTA Roadmap drafted" },
      { date: "2024-04", title: "Training programs expanded" }
    ],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: true,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: true, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: true,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "KWT", name: "Kuwait", lat: 29.3, lng: 47.5, score: 3,
    agency: "Ministry of Health — HTA Strategic Plan Office",
    contact: "info@moh.gov.kw",
    narrative: "Kuwait demonstrates strong political commitment and strategic vision for HTA. The Ministry of Health is implementing a dedicated three-year HTA strategic plan focused on capacity building and developing core HTA tools and processes, preparing robust human and technical resources for efficient, equitable healthcare decisions.",
    metrics: { cet: "Planned", bia: "Planned", appraisal_questions: "—" },
    links: [{ label: "Ministry of Health (Kuwait)", url: "https://www.moh.gov.kw" }],
    timeline: [
      { date: "2024-01", title: "Three-year HTA strategic plan launched" },
      { date: "2024-10", title: "Foundational capacity building cohort 1" }
    ],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: false,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: false, patient_engagement: false,
      unit_establishment: true, foundational_cb: true, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "QAT", name: "Qatar", lat: 25.3, lng: 51.2, score: 0,
    agency: "Ministry of Public Health",
    contact: "info@moph.gov.qa",
    narrative: "No formal standalone HTA agency yet, but clear steps toward institutionalizing HTA. The National HTA project has been launched under the Ministry of Public Health as a core component of Qatar's National Health Strategy 2024–2030.",
    metrics: { cet: "—", bia: "—", appraisal_questions: "—" },
    links: [{ label: "Ministry of Public Health (Qatar)", url: "https://www.moph.gov.qa" }],
    timeline: [
      { date: "2024-03", title: "National HTA project launched" }
    ],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: false,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: false, patient_engagement: false,
      unit_establishment: false, foundational_cb: false, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "BHR", name: "Bahrain", lat: 26.0, lng: 50.5, score: 0,
    agency: "Supreme Council of Health",
    contact: "info@moh.gov.bh",
    narrative: "Early exploration; no formal HTA institution yet.",
    metrics: {},
    links: [{ label: "Ministry of Health (Bahrain)", url: "https://www.moh.gov.bh" }],
    timeline: [],
    status: Object.fromEntries(window.HTA_ELEMENTS.map(e => [e.id, false]))
  },
  {
    code: "DZA", name: "Algeria", lat: 28.0, lng: 2.6, score: 2,
    agency: "Ministry of Health, Population and Hospital Reform",
    contact: "contact@sante.gov.dz",
    narrative: "Early-stage HTA development; initial regulatory steps and international collaboration underway.",
    metrics: {},
    links: [{ label: "Ministry of Health (Algeria)", url: "http://www.sante.gov.dz" }],
    timeline: [],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: false,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: false, patient_engagement: false,
      unit_establishment: false, foundational_cb: true, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "MAR", name: "Morocco", lat: 31.8, lng: -7.1, score: 4,
    agency: "Ministry of Health and Social Protection",
    contact: "contact@sante.gov.ma",
    narrative: "Developing HTA processes with emphasis on pharmaceutical assessment and reimbursement reform.",
    metrics: {},
    links: [{ label: "Ministry of Health (Morocco)", url: "https://www.sante.gov.ma" }],
    timeline: [],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: true,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: true, patient_engagement: false,
      unit_establishment: false, foundational_cb: true, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "IRN", name: "Iran", lat: 32.4, lng: 53.7, score: 3,
    agency: "Ministry of Health and Medical Education",
    contact: "info@behdasht.gov.ir",
    narrative: "Established HTA office; active assessments with international collaboration.",
    metrics: {},
    links: [{ label: "Ministry of Health (Iran)", url: "https://behdasht.gov.ir" }],
    timeline: [],
    status: {
      roadmap: true, cet: false, bia_threshold: false, guidelines: true,
      critical_appraisal: false, mcda_orphan: false, mcda_oop: false, mea: false,
      biosimilars: false, priority_setting: false, patient_engagement: false,
      unit_establishment: true, foundational_cb: false, decision_makers: false,
      tech_validation: false, ips_modelling: false, bia_training: false
    }
  },
  {
    code: "IRQ", name: "Iraq", lat: 33.2, lng: 43.7, score: 1,
    agency: "Ministry of Health",
    contact: "info@moh.gov.iq",
    narrative: "Early exploration of HTA methods.",
    metrics: {}, links: [{ label: "Ministry of Health (Iraq)", url: "https://moh.gov.iq" }], timeline: [],
    status: {
      roadmap: true, ...Object.fromEntries(window.HTA_ELEMENTS.slice(1).map(e => [e.id, false]))
    }
  },
  {
    code: "ISR", name: "Israel", lat: 31.0, lng: 34.9, score: 10,
    agency: "Ministry of Health — Basket Committee",
    contact: "call.habriut@moh.gov.il",
    narrative: "Long-established HTA-style basket process evaluating new technologies annually within a fixed budget.",
    metrics: { cet: "Implicit via basket budget" },
    links: [{ label: "Ministry of Health (Israel)", url: "https://www.gov.il/en/departments/ministry_of_health" }],
    timeline: [{ date: "1995-01", title: "National Health Insurance Law" }, { date: "1999-01", title: "Basket Committee formalized" }],
    status: Object.fromEntries(window.HTA_ELEMENTS.map(e => [e.id, true]))
  },
  {
    code: "LBN", name: "Lebanon", lat: 33.9, lng: 35.8, score: 2,
    agency: "Ministry of Public Health",
    contact: "info@moph.gov.lb",
    narrative: "Limited HTA activity; exploring frameworks.",
    metrics: {}, links: [{ label: "Ministry of Public Health (Lebanon)", url: "https://www.moph.gov.lb" }], timeline: [],
    status: Object.fromEntries(window.HTA_ELEMENTS.map((e,i) => [e.id, i < 1]))
  },
  {
    code: "LBY", name: "Libya", lat: 26.3, lng: 17.2, score: 0,
    agency: "Ministry of Health",
    contact: "info@moh.gov.ly",
    narrative: "No formal HTA activity.", metrics: {}, links: [], timeline: [],
    status: Object.fromEntries(window.HTA_ELEMENTS.map(e => [e.id, false]))
  },
  {
    code: "SYR", name: "Syria", lat: 34.8, lng: 38.9, score: 0,
    agency: "Ministry of Health", contact: "", narrative: "No formal HTA activity.",
    metrics: {}, links: [], timeline: [],
    status: Object.fromEntries(window.HTA_ELEMENTS.map(e => [e.id, false]))
  },
  {
    code: "YEM", name: "Yemen", lat: 15.5, lng: 48.5, score: 0,
    agency: "Ministry of Public Health and Population", contact: "",
    narrative: "No formal HTA activity.", metrics: {}, links: [], timeline: [],
    status: Object.fromEntries(window.HTA_ELEMENTS.map(e => [e.id, false]))
  }
];
