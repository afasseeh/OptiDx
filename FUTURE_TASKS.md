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
- **Limitation:** The current export pipeline now renders HTML on the backend and converts it to PDF, the report builder now restores the original audience/format/section controls, but the layout is still intentionally minimal, the previous-report browser can still be polished further, and some Windows runtimes still need the new compatibility-PDF fallback instead of the browser renderer.
- **Improvement:** Add branded page templates, richer charts, section pagination, stored-report comparison, snapshot-driven export QA, and a more deterministic server-side PDF renderer that does not depend on the browser stack.
- **Benefit:** More reliable ministry/HTA-ready reporting with production-grade formatting and fewer environment-specific export surprises.
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
- **Limitation:** The backend currently performs the translation inside `OptimizationService`, which keeps the run stable but duplicates schema knowledge that also exists in the browser seed data. Numeric persisted ids and prevalence scaling rules have already shown that browser and backend adapters can drift in subtle ways.
- **Improvement:** Extract a shared test-schema and constraint adapter so the frontend and backend use the same canonical mapping rules for seed data, imported libraries, optimization payloads, numeric database ids, and prevalence normalization.
- **Benefit:** Reduces drift between UI fixtures and backend contracts and makes future optimizer inputs easier to validate.
- **Priority:** Medium

## 9. Asynchronous optimization runner

- **Context:** The optimizer now launches through a detached Artisan command and the browser polls the run-status endpoint until completion.
- **Limitation:** Progress snapshots are live now, but there is still no append-only history view or cancellation support, and the run list still only rehydrates the latest matching result.
- **Improvement:** Add incremental progress history, cancellation support, and structured stage messages to the detached run lifecycle.
- **Benefit:** Makes large optimization runs feel more responsive and auditable without reintroducing a long synchronous request or queue-worker dependency.
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

## 12. Constraint presets for optimizer runs

- **Context:** The wizard now captures canonical optimizer constraints directly, including prevalence, minimum sensitivity/specificity, cost, turnaround, roles, settings, and sample flags.
- **Limitation:** The current setup is precise but still entirely manual, so recurring project types require the same thresholds to be entered repeatedly.
- **Improvement:** Add optional named presets for common program profiles, then let the user override any field before queuing a run.
- **Benefit:** Reduces setup friction without reintroducing the old objective-led ranking model.
- **Priority:** Medium

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

## 14. AI-authored report sections

- **Context:** The report detail page now exposes the stored template settings and section map, and the builder page preserves the restored report-template controls before export.
- **Limitation:** OpenRouter-backed draft generation now exists, but the request still runs inline in the web request and the preview does not yet support manual per-section editing or approval states.
- **Improvement:** Move AI generation onto a queued job with progress state, add per-section review/edit controls, and optionally store revision history for regenerated sections.
- **Benefit:** Produces richer report narratives without blocking the request cycle and gives reviewers tighter control over generated content changes.
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
- **Limitation:** The compose stack is deployed and verified, but repeat releases still require manual SSH steps to rebuild and restart the containers, and the database volume overlays the app's `database/` tree unless the migration files are synced first.
- **Improvement:** Add a small provisioning script or deployment helper that pulls the latest code, syncs `web/database` into the mounted volume, refreshes the environment file if needed, runs `docker compose up -d --build`, confirms the `python` runtime and `/var/www/optidx_package` bind mount are present, checks the tunnel health endpoint, and alerts on optimization runs that remain queued or running longer than expected.
- **Benefit:** Makes future releases safer and removes the remaining manual step from the deployment path.
- **Priority:** High

## 21. Project-scoped evidence libraries and project picker

- **Context:** The new-project wizard now persists a draft project record, but the diagnostic test library remains shared workspace-wide for this incremental fix.
- **Limitation:** There is still no first-class project picker, and tests are not yet scoped to an individual project record.
- **Improvement:** Add a real project management surface with explicit draft selection, project-specific evidence libraries, and clear archive/delete actions for old drafts.
- **Benefit:** Makes the project model match the persistence model and reduces ambiguity once multiple concurrent projects are supported.
- **Priority:** Medium

## 22. Historical unowned workspace rows

- **Context:** The new account-scoped ownership layer now keeps future project, pathway, test, and settings records isolated per authenticated user.
- **Limitation:** Legacy workspace rows that were created before ownership columns existed are only backfilled to a default account when a confident project owner cannot be inferred, so some historical attribution may still be approximate.
- **Improvement:** Add an admin audit flow that reviews and reassigns or archives those ambiguous legacy rows explicitly.
- **Benefit:** Preserves useful historical data while removing the last ambiguous shared-state leftovers and making ownership provenance explicit.
- **Priority:** Low

## 23. Reassignment workflow for preserved deleted-account records

- **Context:** Account deletion now preserves created workspace rows but nulls ownership so the records can survive the user purge.
- **Limitation:** Those preserved rows are currently invisible to normal account-scoped users until an admin or future workspace owner manually reassigns them.
- **Improvement:** Add an admin-only reassignment surface that can search null-owned rows, restore ownership in bulk, and show what was preserved during deletion.
- **Benefit:** Prevents useful pathway and test history from becoming stranded after a user leaves the system.
- **Priority:** Medium

## 24. Tighter optimizer upper bounds and continuation equivalence

- **Context:** The new CPBB-PF v3 optimizer now uses safe optimistic probability-mass bounds and canonical partial-state signatures to prune the search tree early.
- **Limitation:** The v1 bounds are intentionally conservative, so some structurally different states with effectively equivalent future continuation opportunities will still survive longer than necessary.
- **Improvement:** Add tighter test-aware upper bounds, richer unresolved-continuation equivalence classes, and more aggressive frontier-against-state pruning once the current behavior is benchmarked on real 15-tool catalogs.
- **Benefit:** Improves runtime headroom under the 900-second cap without weakening correctness or changing the completed-pathway scoring authority.
- **Priority:** High

## 25. Frontend chunk splitting for optimizer-era bundle growth

- **Context:** The queued optimizer cutover and workspace features now build successfully, but the current Vite production bundle emits a chunk-size warning above 500 kB.
- **Limitation:** The app still ships one large main JavaScript chunk, which increases first-load cost and makes future UI additions more likely to regress bundle size further.
- **Improvement:** Introduce route-level or screen-level dynamic imports and, if needed, explicit Rollup manual chunking for the optimizer/scenario surfaces.
- **Benefit:** Reduces initial download size and keeps the browser shell responsive as the product grows.
- **Priority:** Medium

## 26. Verification-mail transport hardening

- **Context:** Registration now relies on the framework's built-in `Registered` event listener for the initial verification email, which avoids duplicate notification sends.
- **Limitation:** If the SMTP transport or recipient suppression list rejects a verification message, the registration controller still depends on that send path succeeding synchronously.
- **Improvement:** Add explicit notification error handling and a retry/fallback path for registration and resend flows so account creation can complete even when mail delivery is temporarily unavailable.
- **Benefit:** Prevents external mail-provider failures from surfacing as opaque registration errors and gives support a clearer recovery path.
- **Priority:** Medium

## 27. Optimization progress calibration and run detail view

- **Context:** The optimizer now streams live progress snapshots from Python into `optimization_runs` and the browser renders those backend values directly.
- **Limitation:** The UI now uses an indeterminate activity animation and there is a basic stored-run history page, but there is still no append-only progress audit trail or notification history for a long extensive run.
- **Improvement:** Add progress snapshot history, notification history, and richer per-stage event logging so the history page can show how a run evolved over time instead of only the final snapshot.
- **Benefit:** Gives users a clearer audit trail for long-running optimization work without pretending the app knows the final pathway count in advance.

## 28. Optimization result library

- **Context:** Optimization results are now persisted on `optimization_runs`, the browser stores the last run reference, and the latest stored result can be reopened without re-running when the request signature matches.
- **Limitation:** Reuse is still limited to the current account's stored runs and the page does not yet offer saved filters, comparison mode, or cross-project search.
- **Improvement:** Add searchable filters, pagination, and side-by-side comparison of previous optimization outputs.
- **Benefit:** Makes optimization work reusable across sessions and provides a durable review trail for decision-making.
- **Priority:** Medium

## 29. Optimization watchdog for orphaned detached runs

- **Context:** Detached optimization runs now store a PID and can be cancelled from the UI, which solves the common stalled-run case.
- **Limitation:** If a detached child is orphaned outside the normal PID path, the app still depends on the OS kill command or a later manual cleanup.
- **Improvement:** Add a lightweight watchdog that periodically confirms the detached optimizer process is still alive and reconciles orphaned runs back into a terminal state if the process disappears unexpectedly.
- **Benefit:** Makes long-running optimization supervision more robust on Windows and reduces the chance of stale active-run records.
- **Priority:** Low

## 30. Normalize legacy optimization history payloads at rest

- **Context:** The browser now hardens optimization-history and scenario rendering against older `optimization_runs` records where infeasible fixed outputs were saved as eight known keys with `null` entries.
- **Limitation:** The UI no longer crashes on those records, but the database still contains mixed payload shapes that require extra defensive branches in the frontend.
- **Improvement:** Add a one-time repair command or migration that rewrites legacy infeasible result payloads into a single canonical shape with explicit placeholder metadata for each fixed objective.
- **Benefit:** Simplifies frontend rendering, reduces future regression risk, and makes stored optimization history easier to inspect or export consistently.
- **Priority:** Medium

## 31. Consolidate workspace comparison preview helpers

- **Context:** The report and compare screens now both read from live workspace state instead of seeded demo data.
- **Limitation:** The live-data normalization logic still lives in the browser component layer, which leaves a small amount of duplication across the report and compare preview paths.
- **Improvement:** Extract a shared workspace preview helper for pathway summaries, comparison rows, and report metrics so both screens reuse one normalization boundary.
- **Benefit:** Reduces drift between the report preview, compare view, and future export previews while keeping the real-data rule in one place.
- **Priority:** Low

## 32. Remove remaining legacy compare and branding shims

- **Context:** The rail and settings pages no longer expose compare or branding as product surfaces, and the report hub now uses persisted pathway selection.
- **Limitation:** A few legacy compatibility strings and no-op component stubs still remain in the browser bundle so older entry points and search hits can degrade gracefully during the cutover.
- **Improvement:** Delete the remaining compare/branding compatibility stubs once the new history/report navigation has been stable for a release or two.
- **Benefit:** Shrinks the frontend surface area and removes the last vestiges of retired product language.
- **Priority:** Low
# Stabilize Vite Dev Loading For Legacy Global Components

- Context: The React workspace still loads several legacy component modules that assign themselves onto `window`, and some of those files keep their `import React ...` statement at the bottom of the file.
- Current limitation: The production bundle works, but the Vite hot client can throw `Cannot access 'React' before initialization` in local dev because ESM evaluation is less forgiving than the current built bundle path.
- Proposed improvement: Normalize the legacy component files so imports live at the top and the global registration pattern is phased into standard module exports/imports.
- Expected benefit: Local dev debugging becomes reliable with unminified stacks, which makes future Builder/runtime regressions materially faster to diagnose.
- Priority: Medium
