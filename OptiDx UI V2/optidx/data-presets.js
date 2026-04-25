// =====================================================================
// OptiDx — Curated preset test library (admin-curated, "coming soon")
// Diagnostic performance values across many disease areas. Users can
// import these into a pathway and override any field — but the catalog
// itself is read-only and maintained by Syreon's clinical evidence team.
// =====================================================================

window.SEED_PRESET_DISEASES = [
  // [id, name, area, prevalenceTypical, testCount]
  { id: "tb",        name: "Tuberculosis",                 area: "Infectious",   prev: "0.5–8%",   count: 18 },
  { id: "hiv",       name: "HIV",                          area: "Infectious",   prev: "0.1–25%",  count: 12 },
  { id: "hcv",       name: "Hepatitis C",                  area: "Infectious",   prev: "0.5–10%",  count: 9  },
  { id: "hbv",       name: "Hepatitis B",                  area: "Infectious",   prev: "1–8%",     count: 8  },
  { id: "covid",     name: "COVID-19",                     area: "Infectious",   prev: "varies",   count: 14 },
  { id: "malaria",   name: "Malaria",                      area: "Infectious",   prev: "1–30%",    count: 7  },
  { id: "syphilis",  name: "Syphilis",                     area: "Infectious",   prev: "0.5–5%",   count: 6  },
  { id: "hpv",       name: "HPV / Cervical cancer",        area: "Oncology",     prev: "0.5–4%",   count: 11 },
  { id: "crc",       name: "Colorectal cancer",            area: "Oncology",     prev: "0.4–1.5%", count: 13 },
  { id: "bc",        name: "Breast cancer",                area: "Oncology",     prev: "0.3–1%",   count: 10 },
  { id: "lc",        name: "Lung cancer",                  area: "Oncology",     prev: "0.5–2%",   count: 9  },
  { id: "hcc",       name: "Hepatocellular carcinoma",     area: "Oncology",     prev: "0.5–3%",   count: 8  },
  { id: "pc",        name: "Prostate cancer",              area: "Oncology",     prev: "1–4%",     count: 7  },
  { id: "dm",        name: "Type 2 diabetes",              area: "NCD",          prev: "8–20%",    count: 6  },
  { id: "ckd",       name: "Chronic kidney disease",       area: "NCD",          prev: "8–15%",    count: 5  },
  { id: "cvd",       name: "Cardiovascular risk",          area: "NCD",          prev: "10–30%",   count: 8  },
  { id: "htn",       name: "Hypertension",                 area: "NCD",          prev: "20–40%",   count: 4  },
  { id: "thyroid",   name: "Thyroid disorders",            area: "Endocrine",    prev: "3–10%",    count: 5  },
  { id: "afib",      name: "Atrial fibrillation",          area: "Cardiology",   prev: "1–3%",     count: 6  },
  { id: "hf",        name: "Heart failure",                area: "Cardiology",   prev: "1–3%",     count: 7  },
  { id: "stroke",    name: "Stroke / TIA",                 area: "Neurology",    prev: "0.5–1%",   count: 5  },
  { id: "alz",       name: "Alzheimer's disease",          area: "Neurology",    prev: "5–10% 65+", count: 6 },
  { id: "ibd",       name: "Inflammatory bowel disease",   area: "GI",           prev: "0.3–0.5%", count: 5  },
  { id: "celiac",    name: "Celiac disease",               area: "GI",           prev: "0.5–1%",   count: 4  },
  { id: "ra",        name: "Rheumatoid arthritis",         area: "Rheum.",       prev: "0.5–1%",   count: 5  },
  { id: "asthma",    name: "Asthma",                       area: "Pulmonary",    prev: "5–10%",    count: 4  },
  { id: "copd",      name: "COPD",                         area: "Pulmonary",    prev: "5–10% 40+",count: 5  },
];

// Test catalog — much larger than the legacy SEED_EVIDENCE list. ~70 entries.
// Fields: { id, test, disease, diseaseId, category, sens, spec, sensCI, specCI,
//   cost, costCcy, tat, tatUnit, sample, skill, source, year, country, confidence,
//   population, who, prevalenceCohort }
window.SEED_PRESET_TESTS = [
  // ---------------- TB ----------------
  { id:"p-tb-1",  test:"Xpert MTB/RIF Ultra", disease:"Pulmonary TB", diseaseId:"tb", category:"molecular", sens:0.88, spec:0.98, sensCI:"0.84–0.92", specCI:"0.97–0.99", cost:9.98, costCcy:"USD", tat:90, tatUnit:"min", sample:"Sputum", skill:"Lab tech", source:"Zifodya et al., Cochrane 2021", year:2021, country:"Global", confidence:"High", population:"Adults w/ pulmonary symptoms", who:true },
  { id:"p-tb-2",  test:"Xpert MTB/RIF (legacy)", disease:"Pulmonary TB", diseaseId:"tb", category:"molecular", sens:0.85, spec:0.98, sensCI:"0.82–0.88", specCI:"0.97–0.99", cost:7.97, costCcy:"USD", tat:120, tatUnit:"min", sample:"Sputum", skill:"Lab tech", source:"Steingart et al., Cochrane 2014", year:2014, country:"Global", confidence:"High", population:"Adult presumptive TB", who:true },
  { id:"p-tb-3",  test:"Truenat MTB Plus", disease:"Pulmonary TB", diseaseId:"tb", category:"molecular", sens:0.85, spec:0.97, sensCI:"0.81–0.89", specCI:"0.95–0.98", cost:6.50, costCcy:"USD", tat:60, tatUnit:"min", sample:"Sputum", skill:"Lab tech", source:"ICMR multi-centric 2020", year:2020, country:"India", confidence:"Moderate", population:"Peripheral lab network", who:true },
  { id:"p-tb-4",  test:"CAD4TB v6", disease:"Pulmonary TB", diseaseId:"tb", category:"imaging", sens:0.90, spec:0.76, sensCI:"0.86–0.93", specCI:"0.71–0.81", cost:1.20, costCcy:"USD", tat:5, tatUnit:"min", sample:"CXR", skill:"Auto", source:"Qin et al., Lancet Digital Health 2021", year:2021, country:"Multi", confidence:"High", population:"Symptomatic adults", who:false },
  { id:"p-tb-5",  test:"qXR (Qure.ai)", disease:"Pulmonary TB", diseaseId:"tb", category:"imaging", sens:0.92, spec:0.74, sensCI:"0.88–0.95", specCI:"0.69–0.79", cost:1.50, costCcy:"USD", tat:5, tatUnit:"min", sample:"CXR", skill:"Auto", source:"Khan et al., 2020", year:2020, country:"Multi", confidence:"High", population:"Community screening", who:false },
  { id:"p-tb-6",  test:"Lunit INSIGHT CXR", disease:"Pulmonary TB", diseaseId:"tb", category:"imaging", sens:0.91, spec:0.78, sensCI:"0.87–0.94", specCI:"0.73–0.83", cost:1.40, costCcy:"USD", tat:5, tatUnit:"min", sample:"CXR", skill:"Auto", source:"Codlin et al., 2021", year:2021, country:"Multi", confidence:"High", population:"Symptomatic adults", who:false },
  { id:"p-tb-7",  test:"Sputum smear (FM)", disease:"Pulmonary TB", diseaseId:"tb", category:"clinical", sens:0.61, spec:0.98, sensCI:"0.55–0.66", specCI:"0.97–0.99", cost:1.20, costCcy:"USD", tat:60, tatUnit:"min", sample:"Sputum", skill:"Lab tech", source:"Steingart et al., 2006", year:2006, country:"Global", confidence:"High", population:"Adult symptomatic", who:true },
  { id:"p-tb-8",  test:"MGIT liquid culture", disease:"Pulmonary TB", diseaseId:"tb", category:"clinical", sens:0.98, spec:0.99, sensCI:"0.96–0.99", specCI:"0.98–1.00", cost:14.00, costCcy:"USD", tat:14, tatUnit:"days", sample:"Sputum", skill:"BSL-3", source:"WHO Handbook 2022", year:2022, country:"Global", confidence:"High", population:"Reference standard", who:true },
  { id:"p-tb-9",  test:"LF-LAM (Determine)", disease:"TB in PLHIV", diseaseId:"tb", category:"rapid", sens:0.42, spec:0.91, sensCI:"0.36–0.48", specCI:"0.88–0.93", cost:3.50, costCcy:"USD", tat:25, tatUnit:"min", sample:"Urine", skill:"CHW", source:"Bjerrum et al., Cochrane 2019", year:2019, country:"SSA", confidence:"Moderate", population:"HIV+ CD4<200", who:true },
  { id:"p-tb-10", test:"Symptom screening (W4SS)", disease:"Pulmonary TB", diseaseId:"tb", category:"clinical", sens:0.71, spec:0.65, sensCI:"0.65–0.76", specCI:"0.60–0.70", cost:0.10, costCcy:"USD", tat:5, tatUnit:"min", sample:"None", skill:"CHW", source:"Hamada et al., 2018", year:2018, country:"Global", confidence:"Moderate", population:"PLHIV ART entry", who:true },
  { id:"p-tb-11", test:"IGRA (QFT-Plus)", disease:"Latent TB", diseaseId:"tb", category:"biomarker", sens:0.83, spec:0.96, sensCI:"0.78–0.87", specCI:"0.94–0.98", cost:24.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Blood", skill:"Lab tech", source:"Pai et al., 2014", year:2014, country:"Global", confidence:"High", population:"Contacts, HCWs", who:true },

  // ---------------- HIV ----------------
  { id:"p-hiv-1", test:"4th-gen HIV Ag/Ab ELISA", disease:"HIV", diseaseId:"hiv", category:"biomarker", sens:0.999, spec:0.998, sensCI:"0.997–1.00", specCI:"0.997–0.999", cost:2.50, costCcy:"USD", tat:90, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"CDC validation 2018", year:2018, country:"Global", confidence:"High", population:"Adults, all-comers", who:true },
  { id:"p-hiv-2", test:"HIV self-test (oral)", disease:"HIV", diseaseId:"hiv", category:"rapid", sens:0.93, spec:0.998, sensCI:"0.91–0.95", specCI:"0.997–0.999", cost:1.00, costCcy:"USD", tat:20, tatUnit:"min", sample:"Oral fluid", skill:"Self", source:"Figueroa et al., 2018", year:2018, country:"Global", confidence:"High", population:"At-risk adults", who:true },
  { id:"p-hiv-3", test:"Determine HIV-1/2 (RDT)", disease:"HIV", diseaseId:"hiv", category:"rapid", sens:0.998, spec:0.997, sensCI:"0.995–1.00", specCI:"0.995–0.999", cost:0.85, costCcy:"USD", tat:20, tatUnit:"min", sample:"Blood", skill:"CHW", source:"WHO PQ 2020", year:2020, country:"Global", confidence:"High", population:"Adult screening", who:true },
  { id:"p-hiv-4", test:"HIV viral load (RT-PCR)", disease:"HIV", diseaseId:"hiv", category:"molecular", sens:0.99, spec:0.99, sensCI:"0.98–1.00", specCI:"0.98–1.00", cost:18.00, costCcy:"USD", tat:48, tatUnit:"hr", sample:"Plasma", skill:"BSL-2", source:"WHO consolidated 2021", year:2021, country:"Global", confidence:"High", population:"On-ART monitoring", who:true },

  // ---------------- HCV ----------------
  { id:"p-hcv-1", test:"Anti-HCV RDT", disease:"Hepatitis C", diseaseId:"hcv", category:"rapid", sens:0.98, spec:0.99, sensCI:"0.96–0.99", specCI:"0.98–0.99", cost:0.95, costCcy:"USD", tat:20, tatUnit:"min", sample:"Blood", skill:"CHW", source:"WHO HCV guidelines 2022", year:2022, country:"Global", confidence:"High", population:"Adult screening", who:true },
  { id:"p-hcv-2", test:"HCV core antigen", disease:"Hepatitis C", diseaseId:"hcv", category:"biomarker", sens:0.94, spec:0.99, sensCI:"0.92–0.96", specCI:"0.98–0.99", cost:11.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Plasma", skill:"Lab tech", source:"Freiman et al., 2016", year:2016, country:"Global", confidence:"High", population:"Confirmation pre-RNA", who:false },
  { id:"p-hcv-3", test:"HCV RNA (PCR)", disease:"Hepatitis C", diseaseId:"hcv", category:"molecular", sens:0.99, spec:0.99, sensCI:"0.98–1.00", specCI:"0.98–1.00", cost:24.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Plasma", skill:"BSL-2", source:"WHO consolidated 2022", year:2022, country:"Global", confidence:"High", population:"Confirmation / cure", who:true },
  { id:"p-hcv-4", test:"GeneXpert HCV VL", disease:"Hepatitis C", diseaseId:"hcv", category:"molecular", sens:0.99, spec:0.99, sensCI:"0.97–1.00", specCI:"0.98–1.00", cost:14.90, costCcy:"USD", tat:105, tatUnit:"min", sample:"Plasma", skill:"Lab tech", source:"Lamoury et al., 2018", year:2018, country:"Multi", confidence:"High", population:"Decentralized confirm", who:true },

  // ---------------- HBV ----------------
  { id:"p-hbv-1", test:"HBsAg RDT", disease:"Hepatitis B", diseaseId:"hbv", category:"rapid", sens:0.90, spec:0.99, sensCI:"0.87–0.93", specCI:"0.98–0.99", cost:0.80, costCcy:"USD", tat:20, tatUnit:"min", sample:"Blood", skill:"CHW", source:"WHO HBV testing 2017", year:2017, country:"Global", confidence:"High", population:"Adult screening", who:true },
  { id:"p-hbv-2", test:"HBsAg ELISA", disease:"Hepatitis B", diseaseId:"hbv", category:"biomarker", sens:0.98, spec:0.99, sensCI:"0.97–0.99", specCI:"0.98–0.99", cost:2.10, costCcy:"USD", tat:90, tatUnit:"min", sample:"Plasma", skill:"Lab tech", source:"WHO HBV testing 2017", year:2017, country:"Global", confidence:"High", population:"Confirmation", who:true },
  { id:"p-hbv-3", test:"HBV DNA (PCR)", disease:"Hepatitis B", diseaseId:"hbv", category:"molecular", sens:0.99, spec:0.99, sensCI:"0.98–1.00", specCI:"0.98–1.00", cost:22.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Plasma", skill:"BSL-2", source:"AASLD 2018", year:2018, country:"Global", confidence:"High", population:"Treatment eligibility", who:true },

  // ---------------- COVID-19 ----------------
  { id:"p-cov-1", test:"RT-PCR (NP swab)", disease:"COVID-19", diseaseId:"covid", category:"molecular", sens:0.95, spec:0.99, sensCI:"0.92–0.97", specCI:"0.98–0.99", cost:18.00, costCcy:"USD", tat:6, tatUnit:"hr", sample:"NP swab", skill:"Lab tech", source:"Cochrane Review 2022", year:2022, country:"Global", confidence:"High", population:"Symptomatic", who:true },
  { id:"p-cov-2", test:"Antigen RDT (Ag-RDT)", disease:"COVID-19", diseaseId:"covid", category:"rapid", sens:0.72, spec:0.99, sensCI:"0.66–0.78", specCI:"0.98–0.99", cost:1.20, costCcy:"USD", tat:15, tatUnit:"min", sample:"NP swab", skill:"CHW", source:"Dinnes et al., Cochrane 2022", year:2022, country:"Global", confidence:"High", population:"Symptomatic ≤7d", who:true },
  { id:"p-cov-3", test:"LAMP (Lucira)", disease:"COVID-19", diseaseId:"covid", category:"molecular", sens:0.94, spec:0.98, sensCI:"0.90–0.97", specCI:"0.96–0.99", cost:20.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Nasal swab", skill:"Self", source:"FDA EUA 2022", year:2022, country:"USA", confidence:"Moderate", population:"OTC home use", who:false },

  // ---------------- Malaria ----------------
  { id:"p-mal-1", test:"HRP2 RDT (P. falciparum)", disease:"Malaria", diseaseId:"malaria", category:"rapid", sens:0.94, spec:0.97, sensCI:"0.91–0.96", specCI:"0.95–0.98", cost:0.50, costCcy:"USD", tat:20, tatUnit:"min", sample:"Blood", skill:"CHW", source:"Cochrane Review 2015", year:2015, country:"SSA", confidence:"High", population:"Febrile patients", who:true },
  { id:"p-mal-2", test:"Microscopy (thick film)", disease:"Malaria", diseaseId:"malaria", category:"clinical", sens:0.85, spec:0.98, sensCI:"0.80–0.89", specCI:"0.96–0.99", cost:1.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"WHO Reference 2016", year:2016, country:"Global", confidence:"High", population:"Reference (low-dens limit)", who:true },

  // ---------------- HPV / Cervical ----------------
  { id:"p-hpv-1", test:"HPV DNA (hrHPV PCR)", disease:"Cervical cancer screening", diseaseId:"hpv", category:"molecular", sens:0.96, spec:0.91, sensCI:"0.94–0.98", specCI:"0.89–0.93", cost:14.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Cervical swab", skill:"Lab tech", source:"Arbyn et al., 2021", year:2021, country:"Global", confidence:"High", population:"Women 30–65", who:true },
  { id:"p-hpv-2", test:"VIA (visual inspection)", disease:"Cervical cancer screening", diseaseId:"hpv", category:"clinical", sens:0.71, spec:0.81, sensCI:"0.65–0.77", specCI:"0.77–0.85", cost:0.90, costCcy:"USD", tat:5, tatUnit:"min", sample:"Cervix", skill:"Nurse", source:"Sankaranarayanan et al., 2009", year:2009, country:"India", confidence:"Moderate", population:"LMIC screening", who:true },
  { id:"p-hpv-3", test:"Pap smear (cytology)", disease:"Cervical cancer screening", diseaseId:"hpv", category:"pathology", sens:0.55, spec:0.97, sensCI:"0.50–0.60", specCI:"0.95–0.98", cost:8.00, costCcy:"USD", tat:48, tatUnit:"hr", sample:"Cervical brush", skill:"Cytotech", source:"Cuzick et al., 2008", year:2008, country:"Global", confidence:"High", population:"Routine screening", who:true },
  { id:"p-hpv-4", test:"AVE (AI visual eval.)", disease:"Cervical cancer screening", diseaseId:"hpv", category:"imaging", sens:0.86, spec:0.78, sensCI:"0.81–0.90", specCI:"0.74–0.82", cost:1.50, costCcy:"USD", tat:5, tatUnit:"min", sample:"Cervix image", skill:"Auto", source:"Hu et al., NIH 2019", year:2019, country:"Multi", confidence:"Moderate", population:"Screen-and-treat", who:false },

  // ---------------- CRC ----------------
  { id:"p-crc-1", test:"FIT (faecal immunochem.)", disease:"Colorectal cancer", diseaseId:"crc", category:"biomarker", sens:0.79, spec:0.94, sensCI:"0.69–0.86", specCI:"0.93–0.95", cost:3.50, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Stool", skill:"Self", source:"USPSTF 2021", year:2021, country:"Global", confidence:"High", population:"Avg-risk 45–75", who:true },
  { id:"p-crc-2", test:"Colonoscopy", disease:"Colorectal cancer", diseaseId:"crc", category:"clinical", sens:0.95, spec:0.99, sensCI:"0.92–0.97", specCI:"0.98–1.00", cost:600.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Endoscopy", skill:"GI specialist", source:"Lin et al., JAMA 2021", year:2021, country:"USA", confidence:"High", population:"Reference / diagnostic", who:true },
  { id:"p-crc-3", test:"Cologuard (mt-sDNA)", disease:"Colorectal cancer", diseaseId:"crc", category:"molecular", sens:0.92, spec:0.87, sensCI:"0.84–0.97", specCI:"0.85–0.89", cost:600.00, costCcy:"USD", tat:14, tatUnit:"days", sample:"Stool", skill:"Self", source:"Imperiale et al., NEJM 2014", year:2014, country:"USA", confidence:"High", population:"Avg-risk 45–84", who:false },
  { id:"p-crc-4", test:"Septin9 (blood mDNA)", disease:"Colorectal cancer", diseaseId:"crc", category:"molecular", sens:0.68, spec:0.79, sensCI:"0.62–0.74", specCI:"0.76–0.82", cost:120.00, costCcy:"USD", tat:48, tatUnit:"hr", sample:"Blood", skill:"Lab tech", source:"Church et al., 2014", year:2014, country:"Multi", confidence:"Moderate", population:"Blood-based screen", who:false },

  // ---------------- Breast cancer ----------------
  { id:"p-bc-1", test:"Mammography (digital)", disease:"Breast cancer", diseaseId:"bc", category:"imaging", sens:0.87, spec:0.92, sensCI:"0.84–0.89", specCI:"0.91–0.93", cost:80.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"USPSTF 2024", year:2024, country:"USA", confidence:"High", population:"Women 40–74", who:true },
  { id:"p-bc-2", test:"Mammo + AI (CAD)", disease:"Breast cancer", diseaseId:"bc", category:"imaging", sens:0.91, spec:0.93, sensCI:"0.89–0.93", specCI:"0.92–0.94", cost:90.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"AI + Rad.", source:"Lång et al., Lancet 2023", year:2023, country:"Sweden", confidence:"High", population:"Women 40–74", who:false },
  { id:"p-bc-3", test:"Breast US (ABUS)", disease:"Breast cancer", diseaseId:"bc", category:"imaging", sens:0.81, spec:0.84, sensCI:"0.76–0.85", specCI:"0.81–0.87", cost:60.00, costCcy:"USD", tat:25, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"Berg et al., 2016", year:2016, country:"USA", confidence:"Moderate", population:"Dense breast", who:false },
  { id:"p-bc-4", test:"Clinical breast exam", disease:"Breast cancer", diseaseId:"bc", category:"clinical", sens:0.54, spec:0.94, sensCI:"0.48–0.60", specCI:"0.92–0.95", cost:0.50, costCcy:"USD", tat:5, tatUnit:"min", sample:"None", skill:"Nurse", source:"Mittra et al., BMJ 2021", year:2021, country:"India", confidence:"Moderate", population:"LMIC screening", who:true },

  // ---------------- Lung cancer ----------------
  { id:"p-lc-1", test:"Low-dose CT (LDCT)", disease:"Lung cancer", diseaseId:"lc", category:"imaging", sens:0.94, spec:0.73, sensCI:"0.91–0.96", specCI:"0.71–0.75", cost:280.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"NLST / NELSON 2020", year:2020, country:"USA", confidence:"High", population:"Heavy smokers 50–80", who:true },
  { id:"p-lc-2", test:"LDCT + Lunit AI", disease:"Lung cancer", diseaseId:"lc", category:"imaging", sens:0.96, spec:0.79, sensCI:"0.94–0.98", specCI:"0.77–0.81", cost:290.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"AI + Rad.", source:"Park et al., 2023", year:2023, country:"Korea", confidence:"Moderate", population:"Smokers", who:false },
  { id:"p-lc-3", test:"Liquid biopsy (cfDNA)", disease:"Lung cancer", diseaseId:"lc", category:"molecular", sens:0.51, spec:0.99, sensCI:"0.45–0.57", specCI:"0.98–1.00", cost:950.00, costCcy:"USD", tat:7, tatUnit:"days", sample:"Blood", skill:"Lab", source:"Galleri MCED 2023", year:2023, country:"USA", confidence:"Moderate", population:"Multi-cancer screen", who:false },

  // ---------------- HCC ----------------
  { id:"p-hcc-1", test:"AFP serum (>20 ng/mL)", disease:"Hepatocellular carcinoma", diseaseId:"hcc", category:"biomarker", sens:0.61, spec:0.86, sensCI:"0.55–0.67", specCI:"0.83–0.89", cost:5.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"Tzartzeva et al., 2018", year:2018, country:"Global", confidence:"High", population:"Cirrhotics surveillance", who:true },
  { id:"p-hcc-2", test:"Liver ultrasound", disease:"Hepatocellular carcinoma", diseaseId:"hcc", category:"imaging", sens:0.84, spec:0.91, sensCI:"0.78–0.89", specCI:"0.88–0.93", cost:35.00, costCcy:"USD", tat:20, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"Singal et al., 2009", year:2009, country:"Global", confidence:"High", population:"Cirrhosis surveillance", who:true },
  { id:"p-hcc-3", test:"AFP-L3 + DCP (GAAD)", disease:"Hepatocellular carcinoma", diseaseId:"hcc", category:"biomarker", sens:0.71, spec:0.93, sensCI:"0.66–0.76", specCI:"0.90–0.95", cost:48.00, costCcy:"USD", tat:120, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"Yang et al., 2019", year:2019, country:"Asia", confidence:"Moderate", population:"Early-stage HCC", who:false },
  { id:"p-hcc-4", test:"Multiphase CT abdomen", disease:"Hepatocellular carcinoma", diseaseId:"hcc", category:"imaging", sens:0.92, spec:0.94, sensCI:"0.89–0.94", specCI:"0.91–0.96", cost:240.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"Roberts et al., 2018", year:2018, country:"Global", confidence:"High", population:"Diagnostic confirmation", who:true },

  // ---------------- Prostate ----------------
  { id:"p-pc-1", test:"PSA serum (>4 ng/mL)", disease:"Prostate cancer", diseaseId:"pc", category:"biomarker", sens:0.93, spec:0.20, sensCI:"0.88–0.96", specCI:"0.17–0.23", cost:8.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"USPSTF 2018", year:2018, country:"USA", confidence:"High", population:"Men 55–69", who:false },
  { id:"p-pc-2", test:"MRI multiparametric", disease:"Prostate cancer", diseaseId:"pc", category:"imaging", sens:0.91, spec:0.37, sensCI:"0.86–0.94", specCI:"0.30–0.45", cost:520.00, costCcy:"USD", tat:45, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"PROMIS 2017", year:2017, country:"UK", confidence:"High", population:"PSA elevated", who:false },

  // ---------------- Diabetes ----------------
  { id:"p-dm-1", test:"HbA1c (≥6.5%)", disease:"Type 2 diabetes", diseaseId:"dm", category:"biomarker", sens:0.55, spec:0.96, sensCI:"0.50–0.60", specCI:"0.95–0.97", cost:6.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"ADA 2024", year:2024, country:"Global", confidence:"High", population:"Adults", who:true },
  { id:"p-dm-2", test:"Fasting plasma glucose", disease:"Type 2 diabetes", diseaseId:"dm", category:"biomarker", sens:0.50, spec:0.98, sensCI:"0.45–0.55", specCI:"0.97–0.99", cost:1.50, costCcy:"USD", tat:30, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"ADA 2024", year:2024, country:"Global", confidence:"High", population:"Adults fasting", who:true },
  { id:"p-dm-3", test:"OGTT (75 g)", disease:"Type 2 diabetes", diseaseId:"dm", category:"biomarker", sens:0.83, spec:0.97, sensCI:"0.78–0.87", specCI:"0.96–0.98", cost:9.00, costCcy:"USD", tat:120, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"WHO 2019", year:2019, country:"Global", confidence:"High", population:"Reference", who:true },
  { id:"p-dm-4", test:"FINDRISC questionnaire", disease:"Type 2 diabetes", diseaseId:"dm", category:"clinical", sens:0.78, spec:0.65, sensCI:"0.74–0.82", specCI:"0.62–0.68", cost:0.05, costCcy:"USD", tat:5, tatUnit:"min", sample:"None", skill:"Self", source:"Lindstrom et al., 2003", year:2003, country:"Finland", confidence:"Moderate", population:"Adult risk strat", who:false },

  // ---------------- CKD ----------------
  { id:"p-ckd-1", test:"eGFR (creatinine)", disease:"Chronic kidney disease", diseaseId:"ckd", category:"biomarker", sens:0.85, spec:0.92, sensCI:"0.80–0.89", specCI:"0.90–0.94", cost:1.80, costCcy:"USD", tat:30, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"KDIGO 2024", year:2024, country:"Global", confidence:"High", population:"Adults", who:true },
  { id:"p-ckd-2", test:"Urine ACR", disease:"Chronic kidney disease", diseaseId:"ckd", category:"biomarker", sens:0.78, spec:0.90, sensCI:"0.73–0.83", specCI:"0.87–0.92", cost:2.50, costCcy:"USD", tat:30, tatUnit:"min", sample:"Urine", skill:"Lab tech", source:"KDIGO 2024", year:2024, country:"Global", confidence:"High", population:"Diabetics, HTN", who:true },

  // ---------------- CVD ----------------
  { id:"p-cvd-1", test:"Lipid panel", disease:"Cardiovascular risk", diseaseId:"cvd", category:"biomarker", sens:0.74, spec:0.85, sensCI:"0.70–0.78", specCI:"0.82–0.88", cost:7.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"AHA 2023", year:2023, country:"Global", confidence:"High", population:"Risk strat", who:true },
  { id:"p-cvd-2", test:"Coronary CT calcium score", disease:"Cardiovascular risk", diseaseId:"cvd", category:"imaging", sens:0.85, spec:0.78, sensCI:"0.81–0.89", specCI:"0.74–0.82", cost:200.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"MESA 2022", year:2022, country:"USA", confidence:"High", population:"Intermediate risk", who:false },
  { id:"p-cvd-3", test:"hs-Troponin", disease:"Acute coronary syndrome", diseaseId:"cvd", category:"biomarker", sens:0.96, spec:0.81, sensCI:"0.93–0.98", specCI:"0.78–0.84", cost:9.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"ESC 2023", year:2023, country:"EU", confidence:"High", population:"Chest pain ED", who:true },

  // ---------------- HTN ----------------
  { id:"p-htn-1", test:"Office BP measurement", disease:"Hypertension", diseaseId:"htn", category:"clinical", sens:0.74, spec:0.74, sensCI:"0.70–0.78", specCI:"0.70–0.78", cost:0.20, costCcy:"USD", tat:5, tatUnit:"min", sample:"None", skill:"Nurse", source:"Piper et al., USPSTF 2015", year:2015, country:"Global", confidence:"High", population:"Adults", who:true },
  { id:"p-htn-2", test:"24h ambulatory BP", disease:"Hypertension", diseaseId:"htn", category:"clinical", sens:0.91, spec:0.92, sensCI:"0.88–0.94", specCI:"0.90–0.94", cost:55.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"None", skill:"Tech", source:"Hodgkinson et al., BMJ 2011", year:2011, country:"UK", confidence:"High", population:"Confirmation", who:true },

  // ---------------- Thyroid ----------------
  { id:"p-thy-1", test:"TSH", disease:"Hypothyroidism", diseaseId:"thyroid", category:"biomarker", sens:0.96, spec:0.94, sensCI:"0.94–0.97", specCI:"0.92–0.96", cost:5.50, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"ATA 2014", year:2014, country:"Global", confidence:"High", population:"Adult screen", who:true },

  // ---------------- AFib ----------------
  { id:"p-af-1", test:"12-lead ECG", disease:"Atrial fibrillation", diseaseId:"afib", category:"clinical", sens:0.89, spec:0.99, sensCI:"0.84–0.93", specCI:"0.98–1.00", cost:8.00, costCcy:"USD", tat:10, tatUnit:"min", sample:"None", skill:"Nurse", source:"ESC 2020", year:2020, country:"EU", confidence:"High", population:"Symptomatic", who:true },
  { id:"p-af-2", test:"Smartwatch PPG (Apple/Fitbit)", disease:"Atrial fibrillation", diseaseId:"afib", category:"clinical", sens:0.88, spec:0.99, sensCI:"0.83–0.92", specCI:"0.98–0.99", cost:0.00, costCcy:"USD", tat:1, tatUnit:"hr", sample:"Wrist", skill:"Self", source:"Apple Heart Study 2019", year:2019, country:"USA", confidence:"Moderate", population:"Adults at home", who:false },
  { id:"p-af-3", test:"7-day Holter", disease:"Atrial fibrillation", diseaseId:"afib", category:"clinical", sens:0.93, spec:0.99, sensCI:"0.90–0.95", specCI:"0.98–1.00", cost:120.00, costCcy:"USD", tat:7, tatUnit:"days", sample:"None", skill:"Cardiology", source:"AHA 2022", year:2022, country:"USA", confidence:"High", population:"Cryptogenic stroke", who:true },

  // ---------------- HF ----------------
  { id:"p-hf-1", test:"NT-proBNP", disease:"Heart failure", diseaseId:"hf", category:"biomarker", sens:0.93, spec:0.65, sensCI:"0.90–0.95", specCI:"0.61–0.68", cost:18.00, costCcy:"USD", tat:60, tatUnit:"min", sample:"Blood", skill:"Lab tech", source:"ESC 2021", year:2021, country:"EU", confidence:"High", population:"Dyspnea", who:true },
  { id:"p-hf-2", test:"Echocardiogram", disease:"Heart failure", diseaseId:"hf", category:"imaging", sens:0.86, spec:0.94, sensCI:"0.82–0.89", specCI:"0.91–0.96", cost:140.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Cardiology", source:"AHA 2022", year:2022, country:"Global", confidence:"High", population:"HF confirm", who:true },

  // ---------------- Stroke ----------------
  { id:"p-str-1", test:"Non-contrast CT head", disease:"Acute stroke", diseaseId:"stroke", category:"imaging", sens:0.46, spec:0.99, sensCI:"0.40–0.52", specCI:"0.98–1.00", cost:120.00, costCcy:"USD", tat:15, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"AHA 2019", year:2019, country:"Global", confidence:"High", population:"Excl. hemorrhage", who:true },
  { id:"p-str-2", test:"MRI diffusion", disease:"Acute stroke", diseaseId:"stroke", category:"imaging", sens:0.99, spec:0.92, sensCI:"0.97–1.00", specCI:"0.89–0.94", cost:520.00, costCcy:"USD", tat:30, tatUnit:"min", sample:"Imaging", skill:"Radiologist", source:"Chalela et al., 2007", year:2007, country:"USA", confidence:"High", population:"Acute ischemic", who:true },

  // ---------------- Alzheimer's ----------------
  { id:"p-alz-1", test:"MMSE (≤24)", disease:"Cognitive impairment", diseaseId:"alz", category:"clinical", sens:0.81, spec:0.89, sensCI:"0.78–0.84", specCI:"0.86–0.91", cost:0.20, costCcy:"USD", tat:10, tatUnit:"min", sample:"None", skill:"Nurse", source:"Tsoi et al., 2015", year:2015, country:"Global", confidence:"High", population:"Adults 65+", who:true },
  { id:"p-alz-2", test:"Blood pTau-217", disease:"Alzheimer's disease", diseaseId:"alz", category:"biomarker", sens:0.92, spec:0.97, sensCI:"0.88–0.95", specCI:"0.94–0.99", cost:240.00, costCcy:"USD", tat:7, tatUnit:"days", sample:"Blood", skill:"Lab", source:"Ashton et al., JAMA 2024", year:2024, country:"Multi", confidence:"High", population:"MCI / suspected AD", who:false },

  // ---------------- Celiac ----------------
  { id:"p-cel-1", test:"Anti-tTG IgA", disease:"Celiac disease", diseaseId:"celiac", category:"biomarker", sens:0.93, spec:0.97, sensCI:"0.91–0.95", specCI:"0.95–0.98", cost:14.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Blood", skill:"Lab tech", source:"ACG 2023", year:2023, country:"Global", confidence:"High", population:"Adults / children", who:true },

  // ---------------- IBD ----------------
  { id:"p-ibd-1", test:"Faecal calprotectin", disease:"Inflammatory bowel disease", diseaseId:"ibd", category:"biomarker", sens:0.93, spec:0.96, sensCI:"0.91–0.95", specCI:"0.94–0.97", cost:22.00, costCcy:"USD", tat:24, tatUnit:"hr", sample:"Stool", skill:"Lab tech", source:"NICE DG11 2017", year:2017, country:"UK", confidence:"High", population:"Differentiate IBS/IBD", who:false },

  // ---------------- COPD ----------------
  { id:"p-copd-1", test:"Spirometry (FEV1/FVC<0.7)", disease:"COPD", diseaseId:"copd", category:"clinical", sens:0.80, spec:0.97, sensCI:"0.76–0.84", specCI:"0.95–0.98", cost:12.00, costCcy:"USD", tat:20, tatUnit:"min", sample:"None", skill:"Tech", source:"GOLD 2024", year:2024, country:"Global", confidence:"High", population:"Adults symptomatic", who:true },

  // ---------------- Syphilis ----------------
  { id:"p-syph-1", test:"Treponemal RDT", disease:"Syphilis", diseaseId:"syphilis", category:"rapid", sens:0.86, spec:0.99, sensCI:"0.82–0.89", specCI:"0.98–0.99", cost:0.65, costCcy:"USD", tat:20, tatUnit:"min", sample:"Blood", skill:"CHW", source:"WHO STI 2021", year:2021, country:"Global", confidence:"High", population:"ANC, KPs", who:true },
  { id:"p-syph-2", test:"Dual HIV/Syphilis RDT", disease:"HIV / Syphilis (dual)", diseaseId:"syphilis", category:"rapid", sens:0.96, spec:0.99, sensCI:"0.93–0.98", specCI:"0.98–1.00", cost:1.10, costCcy:"USD", tat:25, tatUnit:"min", sample:"Blood", skill:"CHW", source:"WHO PQ 2020", year:2020, country:"Global", confidence:"High", population:"ANC dual screen", who:true },

  // ---------------- Asthma ----------------
  { id:"p-asth-1", test:"Peak flow + reversibility", disease:"Asthma", diseaseId:"asthma", category:"clinical", sens:0.71, spec:0.85, sensCI:"0.66–0.75", specCI:"0.82–0.88", cost:1.00, costCcy:"USD", tat:15, tatUnit:"min", sample:"None", skill:"Nurse", source:"GINA 2024", year:2024, country:"Global", confidence:"Moderate", population:"Symptomatic adults", who:true },
  { id:"p-asth-2", test:"FeNO", disease:"Asthma", diseaseId:"asthma", category:"biomarker", sens:0.65, spec:0.82, sensCI:"0.60–0.70", specCI:"0.78–0.85", cost:25.00, costCcy:"USD", tat:5, tatUnit:"min", sample:"Breath", skill:"Tech", source:"NICE 2017", year:2017, country:"UK", confidence:"Moderate", population:"Eosinophilic asthma", who:false },

  // ---------------- RA ----------------
  { id:"p-ra-1", test:"Anti-CCP IgG", disease:"Rheumatoid arthritis", diseaseId:"ra", category:"biomarker", sens:0.67, spec:0.95, sensCI:"0.62–0.71", specCI:"0.93–0.96", cost:18.00, costCcy:"USD", tat:48, tatUnit:"hr", sample:"Blood", skill:"Lab tech", source:"Whiting et al., 2010", year:2010, country:"Multi", confidence:"High", population:"Inflam. arthritis", who:false },
];
