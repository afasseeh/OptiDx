# OptiDx Architecture

## Current State

OptiDx is being productized from two source areas that already exist in the workspace:

- `optidx_package/optidx/engine.py` contains the canonical pathway evaluator.
- `OptiDx UI V2/optidx/...` contains the Syreon-branded UI prototype and design language.

The first implementation slice now lives in `web/` as a Laravel 12 application that mounts the copied UI V2 styling and component structure through Vite/React.

The implementation direction is now:

- Laravel 12 + PHP 8.3 for the web backend, persistence, validation, and report orchestration.
- React on Vite for the frontend.
- The existing Python engine remains the computational reference for pathway evaluation during the first phase.
- Laragon is the local runtime target for development and demo use.

## Architectural Boundaries

### Frontend

The frontend owns:

- screen composition
- workflow canvas interaction
- stage-relative drag/drop hit testing on the builder canvas, including automatic promotion of test-on-test drops into parallel blocks and member insertion when a test is dropped onto an existing parallel block
- the builder now keeps its SVG branch anchors aligned to the visible port circles with shared port geometry constants, and it falls back to a synthetic diagnostic-test card when the workspace catalog is temporarily stale so dropped nodes still render
- dragged diagnostic tests now carry a browser-side snapshot into the canvas, and dropped nodes persist that snapshot alongside the canonical `testId` so the builder can render names and metrics even if the catalog has not refreshed yet
- the canvas now serializes parallel-member snapshot data back into the pathway test catalog so a parallel-only graph still validates and evaluates even when the workspace library is temporarily stale
- the builder measures port centers from the rendered DOM before drawing branch paths, which keeps SVG connectors pinned to the visible port centers instead of relying on hardcoded geometry
- client-side validation feedback
- pathway editor state
- required terminal-endpoint enforcement for considered-positive and considered-negative outcomes, with optional inconclusive endpoints
- shared workspace bootstrap state for persisted pathways, diagnostic tests, and scoped settings
- current-pathway record selection, duplication, and hydration into the live canvas
- active-project draft selection, hydration, and debounced autosave for the new-project wizard
- request/response presentation for evaluation and optimization
- optimization candidate imports now preserve engine-style node ids during frontend hydration, so optimized pathways and imported records can render in the builder even when the source payload uses keyed object maps
- the optimization overlay uses a fixed orange-accented progress card with staged feedback while the synchronous search runs
- results analysis now collapses disease-present and disease-absent cohort outputs into unique human-readable pathways, then renders probability-weighted cost and turnaround summaries from that deduplicated path set
- browser-side canonical graph serialization and hydration for save/export/import
- the new-project wizard now owns the diagnostic test library step, including a shared modal-backed create/update/delete editor and evidence imports that preserve the source test name
- shared modal-backed diagnostic test creation for both manual entry and evidence-library imports, with evidence records written back into the workspace test library before the wizard resumes
- preset library preview details open in a fixed overlay modal, and the import action writes the selected evidence test into the workspace test library before returning the wizard to the test-library step
- parallel block member management in the Builder, including drag/drop from the diagnostic library, explicit picker controls in the inspector, and repeated use of the same diagnostic test in one block
- orchestration of the optimization run UX while the backend search executes
- the authenticated shell layout, which uses a beta banner row plus a single content row; page top bars live inside the screen body so the shell does not reserve an empty middle track, and the full-bleed builder/report screens use an intrinsic-height top bar with a body that fills the remaining main area
- the shared top bar now accepts clickable crumb descriptors so screens can expose a real previous-step navigation path instead of static directory text

The UI must preserve the Syreon orange/charcoal language, Carlito/Open Sans typography, and the workflow-builder visual style from UI V2.

### Laravel Backend

The backend owns:

- project, pathway, evidence, report, and settings persistence
- schema validation
- API responses
- user authentication, session state, email verification, and password reset flows
- optimization orchestration
- bounded grammar expansion for single-test, serial, parallel, and discordant-referee optimization candidates, followed by dominance ranking of the feasible set and Pareto frontier
- optimization candidate filtering, synchronous batching, and ranking within the optimize request
- derived optimization metrics and fixed named scenario buckets, including cost per detected case, Balanced Accuracy, Youden's J, and DOR-based ranking over the feasible candidate set
- report generation jobs and export-file assembly for PDF/DOCX downloads
- bridge calls to the Python evaluator
- canonical compilation of parallel-block member occurrences into unique aliases so duplicate tests in the same block survive engine compilation without collapsing onto a single result key
- turnaround times are normalized to hours before aggregation so mixed-unit paths such as days plus hours stay numerically correct through the evaluator and results screens
- transactional email delivery through the configured SMTP transport

### Python Engine

The Python engine remains the canonical evaluator for:

- pathway traversal
- sensitivity/specificity aggregation
- conditional dependence handling
- operational metrics
- benchmark validation

The initial web integration should preserve the engine contract and extend it incrementally rather than replacing it.

## Data Flow

1. The browser edits a pathway using the canvas and properties panel.
2. The editor serializes the pathway into a structured JSON payload.
3. Laravel validates the payload and persists the project/pathway record.
4. Laravel invokes the Python bridge for evaluation or benchmark execution.
5. The bridge returns metrics, warnings, and path traces.
6. The frontend renders those results without re-deriving the mathematics.
7. The shared browser action layer stores the latest evaluation payload and a normalized evaluation view on `window.OptiDxLatestEvaluationResult` / `window.OptiDxLatestEvaluationView`, and the Results and Trace screens render from that live state instead of the bundled seed example once a run has completed.
- The results view layer now deduplicates disease-present and disease-absent path cohorts into unique pathway signatures, rewrites alias keys into human test names, and computes weighted cost/TAT summaries from the resulting unique path set.
8. The Builder serializes the live canvas into a canonical pathway graph, and the backend stores and rehydrates that same graph shape so save/export/import stay aligned with the engine contract.
9. The optimization wizard posts the test library and constraints to `/api/pathways/optimize`, and Laravel prunes ineligible test samples, expands a bounded diagnostic grammar, batches candidate evaluation through the Python bridge in a single process, then renders the ranked candidates and Pareto frontier returned by the optimizer service.
10. The optimizer service normalizes the wizard's UI-shaped test records into the Python engine schema before building single-test, serial, parallel, and discordant-referee templates, then sends the validated template set through one Python batch call so the browser can keep using the compact seed-library field names while the backend preserves the canonical engine contract.
11. On authenticated load, the browser action layer fetches `/api/pathways`, `/api/evidence/tests`, and `/api/settings` once, then keeps the normalized workspace snapshot on `window.OptiDxWorkspace` so the Home, Wizard, Library, Evidence, Scenario, and Settings screens operate from persisted records instead of static seed arrays.
12. On authenticated load, the same browser action layer also fetches `/api/projects`, restores the active project draft from local storage when available, and hydrates the new-project wizard from that draft so prevalence, constraints, and sample-type selections survive screen changes and refreshes.
13. The Builder and Results actions treat the active pathway record as first-class state; when a saved pathway is opened or re-evaluated, the backend preserves the existing pathway row and attaches the new evaluation to that record instead of creating a disconnected duplicate.
14. Report exports are server-generated on demand: the controller materializes a real PDF or DOCX download from the current pathway and its latest evaluation payload rather than streaming browser-generated text files.
15. Optimization candidates and imported engine-style pathway records are converted into canvas-ready builder graphs in the browser before they are mounted, with keyed object maps preserving their node ids during hydration so the canvas always receives node types, edge ports, and layout coordinates instead of a raw engine template or an empty graph.

Current bridge shape:

- `web/app/Services/PythonEngineBridge.php` executes `python -m optidx_package.optidx.cli`
- `optidx_package/optidx/cli.py` loads canonical engine payloads, evaluates them, and returns JSON
- `web/app/Services/PathwayDefinitionService.php` performs Laravel-side graph validation before evaluation
- `web/app/Services/PathwayGraphService.php` canonicalizes canvas graphs, hydrates saved graphs back into canvas-ready data, and compiles the engine-facing definition
- `web/app/Services/PathwayGraphService.php` also normalizes discordant branch labels emitted by the canvas (`disc` and `discord`) so legacy and current builder payloads compile into the same engine branch shape
- `web/app/Services/OptimizationService.php` canonicalizes wizard test-library records into the engine contract, expands the bounded diagnostic grammar across serial, parallel, and discordant-referee motifs, and then generates/evaluates candidate pathways within the synchronous optimize request before returning both the ranked set and Pareto frontier
- `web/app/Services/OptimizationService.php` also enriches each feasible candidate with derived ranking metrics and emits a `named_rankings` payload so the scenarios screen can render deterministic fixed buckets instead of relying on placeholder titles or array position
- `web/app/Http/Controllers/AuthController.php` owns the session-backed auth endpoints used by the React shell
- `web/app/Http/Controllers/AuthController.php` resolves the authenticated user from the guard after a successful login attempt so verified accounts are not misclassified as guests inside the same request
- `web/resources/js/app.js` bootstraps the browser runtime with Axios, CSRF/session defaults, and the component registry before mounting the React shell
- `web/resources/js/optidx/actions.js` now owns the shared browser helpers for save, optimize, manual test creation, canonical pathway serialization, import hydration, evaluation normalization, and canvas export
- `web/resources/js/optidx/actions.js` also bootstraps the workspace snapshot from `/api/pathways`, `/api/evidence/tests`, and `/api/settings`, tracks the active pathway record, and routes report/share/file-download interactions through the real backend endpoints
- `web/resources/js/optidx/actions.js` also bootstraps `/api/projects`, tracks the active project draft in local storage, and owns the browser helpers that create/update the draft project record behind the wizard
- `web/resources/js/optidx/actions.js` also converts imported records and optimization templates into canvas-ready drafts with node types, edge ports, and layout coordinates before the builder mounts them
- `web/resources/js/optidx/actions.js` also prefers the frozen test snapshot embedded in an optimization candidate or imported pathway when hydrating the canvas and rebuilding a canonical pathway, so rerunning a loaded scenario uses the same test costs, turnaround times, and sample metadata that were present when the candidate was produced
- `web/resources/js/optidx/actions.js` also carries optimization prevalence through the candidate snapshot, canvas draft, and pathway evaluator so cost and turnaround metrics stay aligned with the optimization cohort assumptions when a scenario is loaded back into the Builder
- `web/resources/js/optidx/components/ScreenWizard.jsx` now captures the live project/spec inputs as state, sends them to the optimizer payload, and no longer relies on fixed hardcoded sensitivity/specificity/cost thresholds for every run
- `web/app/Services/OptimizationService.php` now accepts a project objective string and adjusts candidate ranking weights so the optimizer can emphasize cost, sensitivity, specificity, or turnaround time instead of always using the same blended score
- `web/resources/js/optidx/actions.js` also preserves node ids when hydrating engine-style pathway objects into canvas-ready drafts, which prevents optimized imports from collapsing into empty canvases when the source payload uses keyed object maps
- `web/resources/js/optidx/actions.js` also injects and preserves the required builder terminal nodes (`required_positive`, `required_negative`) so every canvas draft, saved graph, and imported graph keeps the mandatory final endpoints
- `web/resources/js/optidx/actions.js` now rewrites imported optimizer-style positive/negative terminal nodes onto those required terminal endpoints before layout, which prevents generated pathways from keeping dummy final nodes alongside the hard-coded considered-positive/considered-negative endpoints
- `web/resources/js/optidx/actions.js` also owns the shared diagnostic-test persistence path, which normalizes manual form submissions and evidence imports into the evidence-test API schema, treats seed-library ids as non-persisted records, and refreshes the workspace library snapshot after create, update, or delete operations
- `web/resources/js/optidx/components/ScreenResults.jsx` and `web/resources/js/optidx/components/ScreenOther.jsx` read the latest live evaluation view from shared browser state so each run can surface its own pathway metrics, path trace, and trace export
- `web/resources/js/optidx/components/ScreenHome.jsx` renders persisted pathway records defensively, using placeholder values when summary metrics have not been populated yet so the authenticated shell stays stable while workspace records hydrate
- `web/resources/js/optidx/components/ScreenHome.jsx` exposes a kebab-menu on each recent pathway card so users can open or delete workspace pathways directly from Home without navigating into the canvas first
- `web/resources/js/optidx/components/ScreenCanvas.jsx` keeps the current canvas state mirrored on `window.OptiDxCanvasState` / `window.OptiDxCurrentPathway` so the shell can persist the live builder graph and restore imported canonical graphs
- `web/resources/js/optidx/components/ScreenCanvas.jsx` now derives the Builder `Paths` and `Validate` tabs from the live canonical graph instead of the bundled seed fixtures, and it reuses the latest evaluation payload only when that payload matches the current graph signature
- `web/resources/js/optidx/components/ScreenCanvas.jsx` also performs stage-relative drop hit testing so dropped tests can either become standalone nodes, be added directly into an existing parallel block, or promote an existing test node into a parallel block in place
- `web/resources/js/optidx/components/ScreenCanvas.jsx` now measures rendered port centers from the canvas DOM before drawing branch paths and also computes the minimap viewport from the live pan/zoom state
- `web/resources/js/optidx/components/ScreenCanvas.jsx` exposes an explicit endpoint-creation action, starts new pathway authoring sessions with the required positive/negative endpoints already placed, and prevents those required endpoints from being deleted in the builder UI
- `web/resources/js/optidx/components/PropertiesPanel.jsx` resolves parallel-member summaries from the live workspace test catalog first and falls back to the member snapshot payload when the catalog is stale, which keeps combined cost, turnaround, sample, and skill summaries accurate for authored, imported, and renamed tests
- `web/resources/js/optidx/actions.js` now resolves canvas test ids against the live workspace catalog with string-safe matching before hydrating, serializing, or rendering results, which keeps numeric database ids and string node ids aligned so saved graphs do not compile with zero-valued test metadata
- `web/resources/js/optidx/components/Shell.jsx` now renders clickable breadcrumb items when a screen provides navigation callbacks, which keeps the visible top-bar directory view aligned with actual screen transitions
- `web/resources/js/optidx/components/PropertiesPanel.jsx` now binds outgoing branch selectors to the real edge graph, so changing a branch target mutates the underlying canvas edge instead of editing placeholder copy
- `web/resources/js/optidx/components/PropertiesPanel.jsx` restricts terminal editing to the supported endpoint classes (positive, negative, inconclusive) and locks the required positive/negative endpoints so their outcome role cannot drift
- `web/app/Http/Controllers/Api/PathwayController.php` validates the compiled engine definition before invoking Python for evaluation and returns a structured `422` validation payload when the current graph cannot be evaluated, rather than surfacing a generic bridge `500`
- `web/app/Http/Controllers/Api/PathwayController.php` also falls back to the project prevalence when an evaluation request omits prevalence, so results, PPV/NPV, and population metrics stay aligned with the project record
- `web/app/Http/Controllers/Api/ProjectController.php` remains the minimal persistence endpoint for wizard draft records, with the frontend persisting wizard-only fields inside `projects.metadata`
- `optidx_package/optidx/engine.py` now converts turnaround units into hours before node and pathway aggregation so mixed-unit pathways remain numerically consistent

### Auth and Email

OptiDx now uses Laravel session authentication for the web shell and relies on email verification before a new account can access the authenticated experience.

The active flow is:

1. A user registers or requests a resend/reset action from the React shell.
2. Laravel creates or looks up the user record and dispatches the appropriate notification.
3. Notifications are sent through the SMTP mailer configured for SendGrid.
4. Verification and password-reset links route back into the Laravel app, which completes the state change and redirects the user into the shell.

Important implementation details:

- `App\Models\User` implements `MustVerifyEmail`.
- Verification uses a signed Laravel route at `/verify-email/{id}/{hash}`.
- Password reset tokens are handled by Laravel's password broker.
- The React shell reads auth state from `/auth/me` on startup and switches between auth, verified, and reset states based on query parameters.
- `web/resources/js/optidx/actions.js` exposes a shared browser action helper for clipboard, download, and temporary UX messaging so the UI can progress from mockup screens to functional controls without duplicating logic in every component.
- The same helper layer now also owns workspace bootstrap, scoped settings writes, persisted pathway duplication/opening, live evidence import, and server-generated report downloads so the UI no longer depends on static seed data for those controls.
- The same helper layer now also handles live Builder save/optimize actions, manual test creation, and optimization result normalization for the scenarios screen.
- During the migration away from the prototype shell, the Vite entry also exposes the React hooks expected by the legacy component modules so the existing JSX structure can boot without a wholesale rewrite.

## Persistence Model

The web app will persist:

- projects
- diagnostic tests
- pathways
- evaluation results
- optimization runs
- evidence records
- benchmark cases
- reports
- settings

For the MVP, the schema will favor JSON columns for pathway definitions and provenance so the editor graph can be preserved without forcing premature normalization.

Implemented tables in `web/database/migrations`:

- `projects`
- `diagnostic_tests`
- `pathways`
- `evaluation_results`
- `optimization_runs`
- `reports`
- `benchmark_cases`
- `settings`

The `projects` table now serves as the persisted draft record for the new-project wizard, with wizard-only settings stored in `projects.metadata` so the browser can restore the same draft after leaving and returning to the setup flow.

## Operational Notes

- Laragon-friendly local setup is the primary deployment target for the first implementation slice.
- Redis is reserved for queueing and transient coordination.
- PostgreSQL remains the preferred long-term system of record, but the Laragon MVP can use MariaDB if needed for local ergonomics.
- Docker is the standard runtime envelope for the VPS deployment path, while local development can remain non-containerized when that is simpler.
- The `web/` app now ships with a production Docker Compose stack that builds the Laravel/PHP runtime, compiles Vite assets, and exposes the OptiDx container on host port `8082` for the shared Cloudflare tunnel.
- The live Cloudflare deployment uses a shared tunnel on the `Main` account. `journalrecommendation.syreon.me` maps to `http://127.0.0.1:8081`, and `optidx.syreon.me` maps to `http://127.0.0.1:8082` so both websites can coexist on the same VPS without competing for the public ports.
- The production compose image installs the system `python` entrypoint and bind-mounts `/opt/optidx/optidx_package` into `/var/www/optidx_package` for all runtime services so the Laravel optimizer can invoke the canonical Python engine without a separate Python container.
- The browser shell currently uses local file downloads for some export controls; those should be replaced with server-side DOCX/PDF generation when the reporting pipeline is finalized.
- The reporting pipeline now returns real DOCX/PDF files from Laravel, but the layout remains intentionally minimal and should be upgraded when the product team is ready for production-grade publishing.
- The signed email-verification flow assumes the app URL matches the live dev host. In local development the host is `http://127.0.0.1:8000`, which keeps signed verification links and redirects consistent during browser testing.
- The optimization wizard currently runs synchronously in the browser request/response cycle. The optimizer now batches candidate evaluation inside a single Python bridge call and filters sample-unsafe tests up front, but a queue-backed or workflow-backed runner will still be needed if the product needs the earlier sub-3-second UX target at larger test-library sizes.
