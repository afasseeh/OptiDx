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

- **Context:** The Builder now uses a canonical pathway graph for save/export/import, the backend can hydrate that graph back into the editor, and optimized candidates can already be loaded into the canvas from the scenarios view.
- **Limitation:** Loading a candidate still replaces the active canvas state without preserving a recoverable draft of the previous working graph.
- **Improvement:** Add explicit draft bookmarking or rollback when applying a candidate so authors can compare options without losing in-progress work.
- **Benefit:** Keeps iterative optimizer review safer and makes it easier to bounce between alternatives.
- **Priority:** Medium

## 8. Shared test-schema normalization

- **Context:** The wizard still emits UI-oriented test records (`sens`, `spec`, `tat`, `sample`, `skill`) while the Python engine consumes canonical fields (`sensitivity`, `specificity`, `turnaround_time`, `sample_types`, `skill_level`).
- **Limitation:** The backend currently performs the translation inside `OptimizationService`, which keeps the run stable but duplicates schema knowledge that also exists in the browser seed data.
- **Improvement:** Extract a shared test-schema adapter so the frontend and backend use the same canonical mapping rules for seed data, imported libraries, and optimization payloads.
- **Benefit:** Reduces drift between UI fixtures and backend contracts and makes future optimizer inputs easier to validate.
- **Priority:** Medium

## 9. Asynchronous optimization runner

- **Context:** The optimize request now batches candidate evaluation inside one Python bridge call and no longer relies on a per-candidate process loop for the current seed library.
- **Limitation:** The browser still waits on a long synchronous HTTP request while the backend evaluates candidate pathways during the same request.
- **Improvement:** Move candidate generation/evaluation into a queued job or workflow endpoint and stream progress updates back to the UI.
- **Benefit:** Restores the intended snappy optimization experience and removes pressure from the request timeout ceiling as the library grows.
- **Priority:** High

## 10. Persisted latest evaluation state

- **Context:** The Results and Trace screens now read the most recent evaluation from shared browser state so each run can show its own metrics and path trace.
- **Limitation:** A page refresh still falls back to the bundled seed example until the user runs a new evaluation in the current session.
- **Improvement:** Persist the latest evaluation payload and normalized view alongside the current pathway so the UI can restore the last real run after refresh or screen reload.
- **Benefit:** Makes the results experience feel stable and keeps the last evaluated pathway visible during iterative review.

## 11. Persist optimization snapshots server-side

- **Context:** The optimizer now preserves test snapshots in the browser payload so a loaded candidate reruns against the same test metadata that produced the candidate.
- **Limitation:** That preservation is still session-bound unless the optimization result itself is stored with the snapshot payload; prevalence is now carried in-memory too, but both remain browser-session state.
- **Improvement:** Persist the full optimization candidate snapshot, including normalized test records, when scenarios are saved or shared.
- **Benefit:** Makes candidate reruns stable across browser sessions, workspace edits, and later library refreshes.
- **Priority:** Medium

## 12. Objective presets for optimizer constraints

- **Context:** The wizard now sends live project inputs and objective selection into the optimizer, and the backend ranking honors the objective string.
- **Limitation:** The objective buttons still only affect ranking weights; they do not yet auto-fill full constraint presets for cost-focused, sensitivity-focused, or speed-focused projects.
- **Improvement:** Map each objective choice to a preset bundle of threshold defaults and let the user override them afterward.
- **Benefit:** Reduces friction and makes the optimizer feel more responsive to the project setup choices.
- **Priority:** Medium
- **Priority:** Low

## 11. Persisted pathway summaries in workspace home

- **Context:** The authenticated workspace home now loads persisted pathways directly from `/api/pathways`.
- **Limitation:** Saved pathways can exist before any evaluation has been run, so their list cards currently render placeholder summary values.
- **Improvement:** Store and hydrate a small summary payload for each pathway, ideally from the latest evaluation result, so the home screen can show real cost, sensitivity, specificity, and turnaround values without guessing.
- **Benefit:** Gives the workspace list meaningful status at a glance and reduces the gap between saved records and the evaluated canvas state.
- **Priority:** Medium

## 12. Compare-screen candidate targeting

- **Context:** The compare screen can surface live optimization candidates alongside the scenarios view.
- **Limitation:** The current apply action still targets the first available candidate instead of an explicitly selected row.
- **Improvement:** Add candidate selection state to the compare screen and wire the apply action to the chosen candidate.
- **Benefit:** Prevents accidental loading of the wrong optimization option when reviewing multiple candidates.
- **Priority:** Low

## 13. Unify builder-side validation with engine validation

- **Context:** The Builder now shows live validation based on the current canonical graph and prevents invalid runs from reaching the Python bridge.
- **Limitation:** The in-browser validation panel is still a structural heuristic and does not yet call the same canonical validation path the backend uses for every engine run.
- **Improvement:** Add a debounced `/api/pathways/validate` round-trip for the active graph and merge those results into the Builder validation tab.
- **Benefit:** Keeps the visible Builder warnings perfectly aligned with the backend evaluator contract.
- **Priority:** Medium

## 14. Backend enforcement for required terminal endpoint roles

- **Context:** The Builder now injects non-deletable positive and negative endpoints into every canvas draft and lets authors add optional inconclusive endpoints from the UI.
- **Limitation:** Required endpoint presence and role locking are currently enforced in the browser serialization/hydration layer, not as a dedicated backend graph invariant.
- **Improvement:** Teach the Laravel pathway graph validation layer to require and preserve explicit terminal roles for mandatory positive/negative endpoints.
- **Benefit:** Prevents malformed graphs from bypassing the UI and keeps imports, API writes, and future editor clients aligned with the same endpoint contract.
- **Priority:** Medium

## 15. Legacy parallel-member id backfill

- **Context:** New parallel members now get stable per-entry ids so duplicate tests can be added, displayed, and compiled independently.
- **Limitation:** Historical saved graphs may still contain parallel members without those ids, which leaves exact duplicate-member removal less deterministic until the graph is rewritten.
- **Improvement:** Backfill stable member ids during graph hydration or run a one-time migration over stored pathway JSON so legacy parallel blocks carry the same per-entry identity as newly authored ones.
- **Benefit:** Makes duplicate-member editing fully deterministic for old pathways and keeps the editor state model consistent across imported and newly created graphs.

## 16. Shared modal shell primitive

- **Context:** Legacy screens still use a `modal-backdrop` class name while the main stylesheet also exposes `modal-overlay`.
- **Limitation:** The overlay behavior currently relies on class aliasing instead of one shared dialog primitive.
- **Improvement:** Consolidate these into a single reusable modal shell and migrate all callers to it.
- **Benefit:** Reduces CSS drift and keeps popup behavior consistent across the shell.
- **Priority:** Low

## 17. Terminology cleanup for legacy pathway copy

- **Context:** The new-project wizard and evidence screens are now project-oriented, but a few older secondary labels and comments still say pathway.
- **Limitation:** Mixed terminology can confuse users and future maintainers even when the underlying behavior is correct.
- **Improvement:** Sweep remaining user-facing copy and comments so the new creation flow consistently says project while reserved pathway wording stays only where it refers to the actual graph/result model.
- **Benefit:** Keeps the product language aligned with the project-level workflow and reduces future copy drift.
- **Priority:** Low

## 18. Canvas grouping transaction hardening

- **Context:** Dropping a test onto another test now promotes the target node into a parallel block, and dropping onto an existing parallel block appends a member directly.
- **Limitation:** The current implementation uses a pragmatic in-place node conversion and simple branch remapping, which is enough for the current workflow but still heuristic for more complex graph topologies.
- **Improvement:** Introduce a dedicated grouping transaction that preserves branch intent, selection state, and undo metadata in a single canonical step.
- **Benefit:** Makes canvas grouping more deterministic and reduces the chance of subtle edge-state drift as the editor grows.
- **Priority:** Low

## 19. Optimization metric definitions in product copy

- **Context:** The optimizer now surfaces fixed named buckets such as cost-effective, highest DOR, highest Balanced Accuracy, and highest Youden's J directly in the Run step.
- **Limitation:** The UI currently exposes these names and values but does not yet provide embedded definitions or formula tooltips for non-technical users.
- **Improvement:** Add concise inline definitions and help text for each derived optimization metric, ideally sourced from one shared glossary.
- **Benefit:** Reduces interpretation mistakes during scenario review and keeps stakeholder-facing exports consistent with the optimizer math.
- **Priority:** Medium

## 20. VPS container bootstrap for OptiDx

- **Context:** Cloudflare now routes `optidx.syreon.me` through the shared tunnel to `127.0.0.1:8082`.
- **Limitation:** The compose stack is deployed and verified, but repeat releases still require manual SSH steps to rebuild and restart the containers.
- **Improvement:** Add a small provisioning script or deployment helper that pulls the latest code, refreshes the environment file if needed, runs `docker compose up -d --build`, confirms the `python` runtime and `/var/www/optidx_package` bind mount are present, and checks the tunnel health endpoint.
- **Benefit:** Makes future releases safer and removes the remaining manual step from the deployment path.
- **Priority:** High

## 21. Project-scoped evidence libraries and project picker

- **Context:** The new-project wizard now persists a draft project record, but the diagnostic test library remains shared workspace-wide for this incremental fix.
- **Limitation:** There is still no first-class project picker, and tests are not yet scoped to an individual project record.
- **Improvement:** Add a real project management surface with explicit draft selection, project-specific evidence libraries, and clear archive/delete actions for old drafts.
- **Benefit:** Makes the project model match the persistence model and reduces ambiguity once multiple concurrent projects are supported.
- **Priority:** Medium
