# Future Tasks

## 1. TypeScript evaluator parity

- **Context:** The Python engine is currently the canonical evaluator.
- **Limitation:** Browser-side offline evaluation is not yet available.
- **Improvement:** Port the evaluator to TypeScript after benchmark parity is frozen.
- **Benefit:** Fully offline-capable client-side calculation.
- **Priority:** Medium

## 2. React Flow canvas hardening

- **Context:** The current UI V2 canvas is a prototype.
- **Limitation:** Advanced graph editing behaviors still need production-grade edge cases, keyboard handling, and persistence testing.
- **Improvement:** Formalize node/edge adapters, keyboard shortcuts, and undo/redo state.
- **Benefit:** Safer pathway authoring experience.
- **Priority:** High

## 3. PostgreSQL production profile

- **Context:** Laragon local development may start with MariaDB.
- **Limitation:** The long-term target is PostgreSQL, but the local stack is not yet locked to it.
- **Improvement:** Add a PostgreSQL profile and verify JSON/query compatibility.
- **Benefit:** Better alignment with the preferred production datastore.
- **Priority:** Medium

## 4. Evidence ingestion pipeline

- **Context:** Evidence records are currently expected to be curated manually at first.
- **Limitation:** Literature ingestion and provenance enrichment are not implemented yet.
- **Improvement:** Add import tooling for evidence exports, DOI/PMID lookup, and benchmark curation.
- **Benefit:** Faster and more reliable evidence database growth.
- **Priority:** High

## 5. PDF reporting polish

- **Context:** HTML reporting is the safest initial path.
- **Limitation:** PDF export quality and pagination still need validation.
- **Improvement:** Add a dedicated PDF rendering pipeline and layout snapshots.
- **Benefit:** More reliable ministry/HTA-ready reporting.
- **Priority:** Medium

