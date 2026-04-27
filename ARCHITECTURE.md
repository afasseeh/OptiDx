# OptiDx Architecture

## Current State

OptiDx is being productized from two source areas that already exist in the workspace:

- `optidx_package/optidx/engine.py` contains the canonical pathway evaluator.
- `OptiDx UI V2/optidx/...` contains the Syreon-branded UI prototype and design language.

The first implementation slice now lives in `web/` as a Laravel 12 application that mounts the copied UI V2 styling and component structure through Vite/React.

The implementation direction is now:

- Laravel 12 + PHP 8.3 for the web backend, persistence, validation, and report orchestration.
- React on Vite for the frontend.
- The existing Python engine remains the computational reference for pathway evaluation, while `optidx_package/optidx/optimizer.py` owns the CPBB-PF v3 search and ranking core.
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
- account-scoped workspace bootstrap state for persisted pathways, diagnostic tests, and scoped settings
- current-pathway record selection, duplication, and hydration into the live canvas
- active-project draft selection, hydration, and debounced autosave for the new-project wizard
- request/response presentation for evaluation and optimization
- optimization candidate imports now preserve engine-style node ids during frontend hydration, so optimized pathways and imported records can render in the builder even when the source payload uses keyed object maps
- optimizer and imported pathway drafts now preserve a missing discordant branch as a normal unresolved branch, which the canvas validates like any other unconnected output instead of forcing a synthetic inconclusive fallback
- the optimization overlay uses a fixed orange-accented progress card with staged feedback while the optimization run is in flight, then hides automatically when the terminal result is handed off to the scenarios view
- the optimization scenarios view now labels the fixed outputs by objective name, not generic candidate names, and its frontier chart plots average cost per patient against Youden's J so the scenario cards and chart axes match the optimizer contract
- results analysis now collapses disease-present and disease-absent cohort outputs into unique human-readable pathways, then renders probability-weighted cost and turnaround summaries from that deduplicated path set
- browser-side canonical graph serialization and hydration for save/export/import
- the new-project wizard now owns the diagnostic test library step, including a shared modal-backed create/update/delete editor and evidence imports that preserve the source test name
- shared modal-backed diagnostic test creation for both manual entry and evidence-library imports, with evidence records written back into the workspace test library before the wizard resumes
- preset library preview details open in a fixed overlay modal, and the import action writes the selected evidence test into the workspace test library before returning the wizard to the test-library step
- parallel block member management in the Builder, including drag/drop from the diagnostic library, explicit picker controls in the inspector, and repeated use of the same diagnostic test in one block
- orchestration of the optimization run UX while the backend search executes
- the authenticated shell now carries the current signed-in user profile in shared browser state, and the Settings/Profile view reads and writes that live account record instead of showing static Sara placeholders
- the Settings/Profile view now exposes explicit logout and permanent-delete actions, with logout clearing the shell state and delete-account preserving created workspace rows while removing the user record and personal auth data
- the optimization wizard now keeps the progress card visible for at least 30 seconds only when a backend run completes very quickly, using a gradual time-based progress ramp so fast runs still feel deliberate without delaying longer searches
- the authenticated shell layout, which uses a beta banner row plus a single content row; page top bars live inside the screen body so the shell does not reserve an empty middle track, and the full-bleed builder/report screens use an intrinsic-height top bar with a body that fills the remaining main area
- the shared top bar now accepts clickable crumb descriptors so screens can expose a real previous-step navigation path instead of static directory text
- the workspace home now hydrates the latest pathway evaluation summary into the recent-pathway cards and lets users rename pathways in-place through the pathway update endpoint

The UI must preserve the Syreon orange/charcoal language, Carlito/Open Sans typography, and the workflow-builder visual style from UI V2.

### Laravel Backend

The backend owns:

- project, pathway, evidence, report, and settings persistence
- account-scoped persistence for projects, pathways, evidence tests, and workspace settings
- schema validation
- API responses
- user authentication, session state, email verification, and password reset flows
- optimization orchestration and run-state persistence
- CPBB-PF v3 run creation, polling, and result hydration for the eight fixed optimizer outputs
- derived optimization metrics and fixed named scenario buckets, including cost per positive test, Balanced Accuracy, Youden's J, worst-case turnaround time, and Pareto frontier identity tracking
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

The optimizer now sits beside that evaluator as a separate Python responsibility:

- `optidx_package/optidx/optimizer.py` owns the CPBB-PF v3 search loop
- the search uses a grammar-constrained best-first branch-and-bound queue, not naïve full-template brute force
- partial states carry optimistic sensitivity/specificity, cost, and turnaround bounds so infeasible branches can be pruned before full evaluation
- only complete builder-compatible pathways are compiled into canonical pathway JSON and handed to `DiagnosticPathwayEngine`
- repeated diagnostic tools are emitted with invocation aliases such as `A__2` so the evaluator can score repeated use without outcome-key collisions
- the optimizer maintains a feasible Pareto frontier during search and selects the eight required fixed outputs from that frontier only

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
9. The optimization wizard creates an `optimization_runs` record through `/api/pathways/optimize`, stores the selected `run_mode`, immediately marks the run as `running`, and Laravel launches the same detached Artisan optimizer command for both `light` and `extensive` runs. The detached launcher uses a Windows new-console process option so the child survives the HTTP request instead of relying on a database queue worker, and both the launcher and the Python bridge force Symfony Process onto a project-local writable temp directory so Windows installations that resolve `C:\Windows` as the default temp location do not fail before the child process starts. The launcher must also resolve a CLI-capable PHP binary explicitly, because web requests on Windows can run under `php-cgi.exe`, which is not a safe background Artisan runtime. The optimization run record now stores the detached process PID so stalled runs can be cancelled explicitly from the UI, and the browser stores live runs and terminal results in separate browser-state slots so an in-flight run can survive refresh/navigation without overwriting the last completed result.
10. The Python optimizer normalizes the wizard's UI-shaped test records into the canonical schema, prefilters disallowed tools, expands only legal CPBB-PF v3 grammar actions through a best-first branch-and-bound queue, prunes infeasible or dominated partial states early, evaluates only complete builder-valid pathways through `DiagnosticPathwayEngine`, and returns the feasible Pareto frontier plus the eight fixed selected outputs with explicit infeasible and time-limit states. It also emits structured progress snapshots so Laravel can persist real progress counters and stage text during queued runs.
11. The optimization request path now defensively normalizes prevalence back into a fraction, preserves persisted numeric diagnostic-test ids when canonicalizing the catalog, and falls back to the authenticated workspace test library if the browser submits an empty `tests` array. This keeps legacy drafts, autosaved wizard records, and persisted evidence imports from being misinterpreted as an infeasible optimization problem before the Python search starts. The browser now also keeps active optimization state separate from terminal result state so a live run can be dismissed from the workspace without erasing the last completed result, and active runs expose a stop action that cancels the backend process before the workspace state is cleared.
12. On authenticated load, the browser action layer fetches the signed-in account's `/api/pathways`, `/api/evidence/tests`, and `/api/settings` once, then keeps the normalized workspace snapshot on `window.OptiDxWorkspace` so the Home, Wizard, Library, Evidence, Scenario, and Settings screens operate from persisted records instead of static seed arrays.
13. On authenticated load, the same browser action layer also fetches the signed-in account's `/api/projects`, restores the active project draft from local storage when available, and hydrates the new-project wizard from that draft so prevalence, constraints, and sample-type selections survive screen changes and refreshes without leaking between users.
14. The Builder and Results actions treat the active pathway record as first-class state; when a saved pathway is opened or re-evaluated, the backend preserves the existing pathway row and attaches the new evaluation to that record instead of creating a disconnected duplicate.
15. Report exports are server-generated on demand: the controller materializes a real PDF or DOCX download from the current pathway and its latest evaluation payload rather than streaming browser-generated text files.
16. Optimization candidates and imported engine-style pathway records are converted into canvas-ready builder graphs in the browser before they are mounted, with keyed object maps preserving their node ids during hydration so the canvas always receives node types, edge ports, and layout coordinates instead of a raw engine template or an empty graph.
17. The workspace home recent-pathway cards read the persisted pathway name plus the latest evaluation summary from the workspace snapshot, and the card menu can rename the pathway through the same persisted `PUT /api/pathways/{id}` update path used by the canvas saver.

Current bridge shape:

- `web/app/Services/PythonEngineBridge.php` resolves the Python executable explicitly, preferring `PYTHON_EXECUTABLE` / `PYTHON_BIN`, then the Laragon Python install on Windows, then the usual launcher fallbacks, before executing `optidx_package.optidx.cli`; the same service also resolves a CLI-safe PHP executable for detached Artisan launches so request-time CGI runtimes do not get reused for background optimization work, and it disables Symfony Process timeouts so long extensive optimization searches are not killed by the PHP launcher after one minute
- `optidx_package/optidx/cli.py` loads canonical engine payloads, dispatches either evaluation or optimization, and returns JSON
- `web/app/Services/PathwayDefinitionService.php` performs Laravel-side graph validation before evaluation
- `web/app/Services/PathwayGraphService.php` canonicalizes canvas graphs, hydrates saved graphs back into canvas-ready data, and compiles the engine-facing definition
- `web/app/Services/PathwayGraphService.php` also normalizes discordant branch labels emitted by the canvas (`disc` and `discord`) so legacy and current builder payloads compile into the same engine branch shape
- `web/app/Services/OptimizationService.php` canonicalizes wizard test-library records and the canonical CPBB-PF v3 constraint contract before handing them to the Python optimizer bridge, preserves numeric database ids when resolving optimizer test keys, and records queued optimization run lifecycle state on `optimization_runs`
- `web/app/Jobs/ExecuteOptimizationRun.php` owns the queue worker handoff for CPBB-PF v3 extensive runs, marking the run as started, invoking the Python optimizer, and persisting the final payload or failure reason back onto the same record
- `web/app/Http/Controllers/Api/OptimizationRunController.php` exposes polling for a queued optimization run and a `latest` lookup so the browser can wait for completion or reopen the most recent stored result without rerunning the optimizer
- `web/app/Http/Controllers/Api/OptimizationRunController.php` also exposes an account-scoped `index()` endpoint that lists stored optimization runs for the workspace history page, including the stored mode, progress snapshot, and selected objective keys so the browser can browse prior runs without launching a new optimization
- `web/app/Http/Controllers/Api/OptimizationRunController.php` also exposes a cancel endpoint for active optimization runs, which marks the run cancelled, records the stop reason, and asks the backend service to terminate the detached process by PID when one is available
- `web/app/Http/Controllers/AuthController.php` owns the session-backed auth endpoints used by the React shell
- `web/app/Http/Controllers/AuthController.php` resolves the authenticated user from the guard after a successful login attempt so verified accounts are not misclassified as guests inside the same request
- `web/app/Http/Controllers/Api/PathwayController.php` eager-loads the latest evaluation result on pathway index/show/update responses so the workspace home can render summary metrics without a separate round-trip
- `web/resources/js/app.js` bootstraps the browser runtime with Axios, CSRF/session defaults, and the component registry before mounting the React shell
- `web/resources/js/optidx/actions.js` now owns the shared browser helpers for save, optimize, manual test creation, canonical pathway serialization, import hydration, evaluation normalization, and canvas export
- `web/resources/js/optidx/actions.js` also bootstraps the workspace snapshot from `/api/pathways`, `/api/evidence/tests`, and `/api/settings`, tracks the active pathway record, and routes report/share/file-download interactions through the real backend endpoints
- `web/resources/js/optidx/actions.js` now receives account-scoped workspace payloads from `/api/pathways`, `/api/evidence/tests`, and `/api/settings`, so the browser snapshot stays isolated to the current signed-in user
- `web/resources/js/optidx/actions.js` now also carries the current authenticated user in shared browser state and exposes session cleanup helpers for logout and delete-account so the React shell can clear auth/workspace state consistently
- `web/resources/js/optidx/actions.js` also bootstraps `/api/projects`, tracks the active project draft in local storage, and owns the browser helpers that create/update the draft project record behind the wizard
- `web/resources/js/optidx/components/App.jsx` and `web/resources/js/optidx/actions.js` now seed the Builder with a clean starter canvas as soon as auth succeeds and again when workspace bootstrap begins, so screen navigation cannot reopen the legacy prototype seed graph while the real account-scoped pathways are still loading
- `web/resources/js/optidx/actions.js` also converts imported records and optimization templates into canvas-ready drafts with node types, edge ports, and layout coordinates before the builder mounts them
- `web/resources/js/optidx/actions.js` also prefers the frozen test snapshot embedded in an optimization candidate or imported pathway when hydrating the canvas and rebuilding a canonical pathway, so rerunning a loaded scenario uses the same test costs, turnaround times, and sample metadata that were present when the candidate was produced
- `web/resources/js/optidx/actions.js` also carries optimization prevalence through the candidate snapshot, canvas draft, and pathway evaluator so cost and turnaround metrics stay aligned with the optimization cohort assumptions when a scenario is loaded back into the Builder
- `web/resources/js/optidx/components/ScreenWizard.jsx` now captures the live project/spec inputs as state, sends the canonical `*_allowed` constraint payload to the optimizer, and no longer drives the run from an objective-led ranking selector
- `web/resources/js/optidx/actions.js` now polls queued optimization runs, keeps active and terminal optimization state in separate browser-storage slots, exposes a browser-level stop action for live runs, reuses an existing run when the request signature matches, and builds the scenarios view from `selected_outputs` while keeping compatibility aliases for the older dashboard surfaces during the cutover
- `web/resources/js/optidx/actions.js` also exposes the reusable optimization-run history loader used by the new workspace history page, which lists prior runs, reopens a selected stored run, and routes into the scenarios view without rerunning the same project
- `web/resources/js/optidx/actions.js` now treats workspace snapshot writes as the single normalization boundary for projects, pathways, tests, and settings, so partially hydrated or stale state cannot reintroduce malformed collections after a refresh or screen transition
- `web/resources/js/optidx/actions.js` also preserves node ids when hydrating engine-style pathway objects into canvas-ready drafts, which prevents optimized imports from collapsing into empty canvases when the source payload uses keyed object maps
- `web/resources/js/optidx/actions.js` also injects and preserves the required builder terminal nodes (`required_positive`, `required_negative`) so every canvas draft, saved graph, and imported graph keeps the mandatory final endpoints
- `web/resources/js/optidx/actions.js` now rewrites imported optimizer-style positive/negative terminal nodes onto those required terminal endpoints before layout, which prevents generated pathways from keeping dummy final nodes alongside the hard-coded considered-positive/considered-negative endpoints
- `web/resources/js/optidx/actions.js` also owns the shared diagnostic-test persistence path, which normalizes manual form submissions and evidence imports into the evidence-test API schema, treats seed-library ids as non-persisted records, and refreshes the workspace library snapshot after create, update, or delete operations
- `web/resources/js/optidx/components/ScreenResults.jsx` and `web/resources/js/optidx/components/ScreenOther.jsx` read the latest live evaluation view from shared browser state so each run can surface its own pathway metrics, path trace, and trace export
- `web/resources/js/optidx/components/ScreenHome.jsx` renders persisted pathway records defensively, using placeholder values when summary metrics have not been populated yet so the authenticated shell stays stable while workspace records hydrate
- `web/resources/js/optidx/components/ScreenHome.jsx` now only shows an optimization banner for live queued/running runs; stored terminal optimization results are intentionally kept off the Home surface and are reopened from the optimization history page instead
- `web/resources/js/optidx/components/ScreenHome.jsx` exposes a kebab-menu on each recent pathway card so users can open or delete workspace pathways directly from Home without navigating into the canvas first
- `web/resources/js/optidx/actions.js` now coerces workspace collections to arrays before exposing them to screens, which prevents stale or malformed snapshot data from crashing shared `.map()` render paths across Home, Wizard, Library, and Scenarios
- `web/resources/js/optidx/components/ScreenWizard.jsx` now defines the test-library snapshot at component scope instead of inside the optimization handler, and `ScreenExtras.jsx` falls back to an empty-state message when no stored optimization result is available so those screens do not throw during render
- `web/resources/js/optidx/components/ScreenOther.jsx` and `web/resources/js/optidx/components/ScreenResults.jsx` now normalize their legacy seed fallbacks to empty arrays or stub objects before rendering, which keeps trace, compare, evidence, results, history, and compare-detail screens from crashing when older browser state is partially hydrated
- `web/resources/js/optidx/components/ScreenCanvas.jsx` keeps the current canvas state mirrored on `window.OptiDxCanvasState` / `window.OptiDxCurrentPathway` so the shell can persist the live builder graph and restore imported canonical graphs
- `web/resources/js/optidx/components/ScreenCanvas.jsx` now derives the Builder `Paths` and `Validate` tabs from the live canonical graph instead of the bundled seed fixtures, and it reuses the latest evaluation payload only when that payload matches the current graph signature
- `web/resources/js/optidx/components/ScreenCanvas.jsx` also performs stage-relative drop hit testing so dropped tests can either become standalone nodes, be added directly into an existing parallel block, or promote an existing test node into a parallel block in place
- `web/resources/js/optidx/components/ScreenCanvas.jsx` now measures rendered port centers from the canvas DOM before drawing branch paths and also computes the minimap viewport from the live pan/zoom state
- `web/resources/js/optidx/components/ScreenCanvas.jsx` exposes an explicit endpoint-creation action, starts new pathway authoring sessions with the required positive/negative endpoints already placed, and prevents those required endpoints from being deleted in the builder UI
- `web/resources/js/optidx/components/PropertiesPanel.jsx` resolves parallel-member summaries from the live workspace test catalog first and falls back to the member snapshot payload when the catalog is stale, which keeps combined cost, turnaround, sample, and skill summaries accurate for authored, imported, and renamed tests
- `web/resources/js/optidx/actions.js` now resolves canvas test ids against the live workspace catalog with string-safe matching before hydrating, serializing, or rendering results, which keeps numeric database ids and string node ids aligned so saved graphs do not compile with zero-valued test metadata
- `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, and `web/resources/js/optidx/components/ScreenOther.jsx` now guard the remaining seed-array reads (`SEED_TESTS`, `SEED_COMPARE`, `SEED_PRESET_DISEASES`, and `SEED_VALIDATIONS`) so late workspace hydration cannot throw a render-time error boundary on Builder or the utility screens
- `web/resources/js/optidx/components/Shell.jsx` now renders clickable breadcrumb items when a screen provides navigation callbacks, which keeps the visible top-bar directory view aligned with actual screen transitions
- `web/resources/js/optidx/components/App.jsx` now wraps the authenticated workspace shell in a React error boundary so a render-time failure shows a readable recovery state instead of a blank white screen
- `web/resources/js/optidx/components/App.jsx` now wraps each workspace screen in its own error boundary so a render-time failure is isolated to the active screen instead of blocking navigation to the rest of the app
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
- Registration now dispatches the framework `Registered` event only once and relies on Laravel's built-in email-verification listener for the initial verification mail, which keeps the account-creation path from double-sending notifications.
- Password reset tokens are handled by Laravel's password broker.
- The React shell reads auth state from `/auth/me` on startup and switches between auth, verified, and reset states based on query parameters.
- The shell also persists the authenticated user profile in browser state so settings, logout, and destructive account flows can operate from the current signed-in identity without hardcoded placeholders.
- The auth controller now exposes profile read/update endpoints and a delete-account endpoint under `/auth/*`; profile edits persist first name, last name, email, organization, title, and timezone on the user row.
- Logout clears both the Laravel session and the browser-side workspace/auth state, while delete-account removes the user record, deletes login artifacts, and nulls ownership on preserved workspace rows so they can be reassigned later.
- `web/resources/js/optidx/actions.js` exposes a shared browser action helper for clipboard, download, and temporary UX messaging so the UI can progress from mockup screens to functional controls without duplicating logic in every component.
- The same helper layer now also owns workspace bootstrap, scoped settings writes, persisted pathway duplication/opening, live evidence import, and server-generated report downloads so the UI no longer depends on static seed data for those controls.
- The same helper layer now also handles live Builder save/optimize actions, manual test creation, and optimization result normalization for the scenarios screen.
- The same helper layer now also normalizes pathway evaluation summaries from `latestEvaluationResult`, keeps the workspace pathway snapshot in sync after save/evaluate/import/duplicate/rename operations, and exposes a pathway update helper used by the workspace home rename action.
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

Ownership columns:

- `projects.created_by`
- `diagnostic_tests.created_by`
- `pathways.created_by`
- `settings.created_by`

These ownership columns are enforced by the model layer and authenticated API routes so the browser only sees records that belong to the current account.

Legacy SQLite files may still predate the ownership rollout. The defensive repair migration `2026_04_26_000220_repair_workspace_ownership_columns.php` exists specifically to add any missing `created_by` columns and backfill ownership safely on drifted local databases before normal account-scoped model behavior runs.

The `users` table now stores the signed-in account profile fields that the shell edits directly: first/last name, organization, title, and timezone. The `name` column remains the canonical display name, while the dedicated fields provide structured profile data for the settings UI and auth payloads.

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
- The optimization wizard now supports two backend budgets: `light` runs target roughly five minutes and launch a detached Artisan worker command so they begin processing without requiring an always-on queue worker in local development, while `extensive` runs are dispatched onto the durable queue and notify the launching user when they complete or fail.
- The optimization run record now stores live progress fields (`progress_percent`, `progress_stage`, `progress_message`, `progress_payload`) plus the selected `run_mode` and completion notification timestamp so the browser can render honest backend progress instead of a fake timer.
- The browser no longer relies on a forced minimum progress duration; it renders whatever the backend reports and leaves extensive runs running after navigation.
- The browser now keeps the optimization overlay visible for at least 30 seconds only when a backend run finishes very quickly; longer runs use real backend activity updates, the running indicator is intentionally indeterminate, and the overlay disappears as soon as the result handoff is complete.
- The latest optimization run is persisted server-side on `optimization_runs` and can be reopened later from the workspace home or scenarios flow without creating a duplicate run when the request signature matches.
- Historical optimization runs are not guaranteed to store a fully populated selected-output object for every fixed objective. Older infeasible runs can still persist the eight fixed objective keys with `null` entries, so the browser must normalize history/detail/compare/scenario state defensively and treat those outputs as explicit non-feasible placeholders rather than renderable pathways.
- The Python bridge disables its subprocess timeout for optimization calls, because extensive runs are intentionally allowed to exceed one minute and must not be terminated by Symfony Process before the optimizer finishes.
- When the browser restores a running optimization run from storage, it immediately reattaches the poller so the active run can continue to a terminal state instead of freezing on the last known progress snapshot after a refresh or navigation.
- The wizard treats only runs it launched in the current session as blocking state; restored live runs are informational only, so authors can start a new optimization without waiting for a background run to clear.
- The Home surface now exposes a `Hide from workspace` action for live optimization cards so users can dismiss a stale in-flight indicator without canceling the backend job.
