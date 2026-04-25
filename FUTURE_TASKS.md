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

## 5. PDF/DOCX reporting polish

- **Context:** HTML reporting is the safest initial path.
- **Limitation:** The current export pipeline now produces real server-side PDF and DOCX files, but the layout is still intentionally minimal.
- **Improvement:** Add branded page templates, richer charts, section pagination, and snapshot-driven export QA.
- **Benefit:** More reliable ministry/HTA-ready reporting with production-grade formatting.
- **Priority:** Medium

## 6. Collaboration and admin actions

- **Context:** Several team, collaboration, and workspace-management controls are now wired to clear feedback states in the UI shell.
- **Limitation:** Invite, role-management, and advanced collaboration flows are still simplified and do not yet persist full permissions or audit trails.
- **Improvement:** Implement the workspace collaboration backend, role-based permissions, and durable audit logging for those controls.
- **Benefit:** Makes the Teams surface operational rather than only demonstrative.
- **Priority:** High

## 7. Optimization candidate canvas handoff

- **Context:** The Builder now uses a canonical pathway graph for save/export/import and the backend can hydrate that graph back into the editor.
- **Limitation:** Optimization scenarios are still reviewed on the results screen and then manually rebuilt or imported if the user wants to continue editing a specific candidate.
- **Improvement:** Add one-click scenario-to-canvas loading from the results and compare screens, preserving the current canvas as a recoverable draft.
- **Benefit:** Shortens the loop from optimizer output back to pathway refinement.
- **Priority:** Medium

## 8. Shared test-schema normalization

- **Context:** The wizard still emits UI-oriented test records (`sens`, `spec`, `tat`, `sample`, `skill`) while the Python engine consumes canonical fields (`sensitivity`, `specificity`, `turnaround_time`, `sample_types`, `skill_level`).
- **Limitation:** The backend currently performs the translation inside `OptimizationService`, which keeps the run stable but duplicates schema knowledge that also exists in the browser seed data.
- **Improvement:** Extract a shared test-schema adapter so the frontend and backend use the same canonical mapping rules for seed data, imported libraries, and optimization payloads.
- **Benefit:** Reduces drift between UI fixtures and backend contracts and makes future optimizer inputs easier to validate.
- **Priority:** Medium

## 9. Asynchronous optimization runner

- **Context:** The optimize request now finishes under PHP's 30-second request limit by pruning mirrored pair permutations, but the run is still synchronous and takes noticeable time on the full seed library.
- **Limitation:** The browser waits on a long HTTP request while the backend evaluates candidate pathways one by one.
- **Improvement:** Move candidate generation/evaluation into a queued job or workflow endpoint and stream progress updates back to the UI.
- **Benefit:** Restores the intended snappy optimization experience and removes pressure from the request timeout ceiling as the library grows.
- **Priority:** High

## 10. Persisted latest evaluation state

- **Context:** The Results and Trace screens now read the most recent evaluation from shared browser state so each run can show its own metrics and path trace.
- **Limitation:** A page refresh still falls back to the bundled seed example until the user runs a new evaluation in the current session.
- **Improvement:** Persist the latest evaluation payload and normalized view alongside the current pathway so the UI can restore the last real run after refresh or screen reload.
- **Benefit:** Makes the results experience feel stable and keeps the last evaluated pathway visible during iterative review.
- **Priority:** Low
