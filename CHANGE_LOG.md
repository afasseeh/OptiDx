# Change Log

## 2026-04-28 - Bind teams, report, and compare screens to live workspace data

- Summary: Passed the authenticated user into the Teams screen so it can render its preview card without an out-of-scope variable, replaced the report preview with a workspace-backed summary of the active project/pathway/evaluation, and changed the compare screen to prefer live optimizer outputs or evaluated workspace pathways instead of seeded demo candidates.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenReport.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Teams page was throwing a render error, while the Report and Compare pages were still showing generic prepopulated TB sample content that did not reflect the actual project currently loaded in the workspace.
- Architecture impact: The report and compare surfaces now consume the same live workspace state boundary used elsewhere in the shell, so they only render real project data or an explicit empty state when no evaluation exists yet.
- Migration or deployment impact: Frontend bundle rebuild only; no schema or backend migration was required.
- Follow-up notes: Validation passed with `npm run build` and `php artisan test --filter PathwayApiTest`.

## 2026-04-28 - Fix optimization runs to survive production handoff

- Summary: Replaced the broken request-owned detached optimization launch with a queue-worker handoff that starts the optimizer through a worker-owned `nohup` process on Linux, preserving the PID-backed cancel path while letting the long-running child survive the HTTP request lifecycle.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Jobs/ExecuteOptimizationRun.php`, `web/app/Services/OptimizationService.php`, `web/tests/Unit/OptimizationServiceTest.php`, `ARCHITECTURE.md`, `README.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Production optimization runs were remaining in `running` forever because the child process launched from the request died immediately on the VPS, leaving the row without a terminal update.
- Architecture impact: Optimization dispatch now flows through the queue worker, which becomes the parent of the detached background optimizer process; the worker then records the PID so cancellation can still terminate the live process when needed.
- Migration or deployment impact: Rebuilt and redeployed the Docker stack on the VPS, then ran a live smoke optimization that completed successfully with `status=success` on the new build.
- Follow-up notes: The earlier broken smoke rows were marked `failed` so the workspace history no longer shows them as active runs.

## 2026-04-27 - Replace production deployment and sync database migrations

- Summary: Deployed the current local `main` release to `optidx.syreon.me`, backed up the live SQLite/storage volumes and code tree, rebuilt the Docker stack, and then synced the `web/database` tree into the mounted database volume so Laravel could see and apply the new migrations.
- Files or modules affected: `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`, and the live VPS deployment under `/opt/optidx/web`, `/opt/optidx/optidx_package`, and the Docker volumes `web_optidx-database` and `web_optidx-storage`.
- Reason for the change: The live site was still running an older release behind local `main`, and the Docker database volume was masking the newer migration files so the schema upgrade would have been skipped without an explicit sync step.
- Architecture impact: The production compose stack now has a confirmed operational requirement to mirror the `web/database` tree into the database volume before startup, because that volume overlays `/var/www/html/database` at runtime.
- Migration or deployment impact: Production was rebuilt in place, the six pending migrations through `2026_04_27_000240_add_process_tracking_to_optimization_runs_table` were applied, and the app/queue/scheduler containers were restarted successfully.
- Follow-up notes: Future releases should automate the database-tree sync step so container startup cannot silently miss new migration files.

## 2026-04-27 - Normalize extensive optimization terminal snapshots

- Summary: Updated the shared optimization run-state normalization so terminal `result_payload` data is flattened before the wizard and scenarios screens consume it, and cleared the wizard's live-run latch when a terminal state arrives.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Extensive optimization runs could complete successfully in the backend but still leave the browser stuck on a stale running snapshot, which kept the progress card visible instead of handing control to the actual scenario results.
- Architecture impact: Browser-side optimization state is now normalized at the shared action layer before it reaches any screen, which keeps the wizard, Home, and scenarios views aligned on the same terminal contract.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the updated browser-state normalization ships. No database migration was required.
- Follow-up notes: Validate a full extensive optimization flow in the browser to confirm the progress card dismisses and the scenarios view opens with the completed outputs.

## 2026-04-27 - Fix optimization history metric renderer

- Summary: Added the missing metric card renderer to the optimization-history screen so stored runs can render their summary blocks without throwing a `Metric is not defined` runtime error.
- Files or modules affected: `web/resources/js/optidx/components/ScreenOther.jsx`, `CHANGE_LOG.md`.
- Reason for the change: The history page was still crashing even after the compare view was stabilized because it referenced a component that only existed in another module's file scope.
- Architecture impact: Kept the history screen self-contained and removed an accidental cross-file component dependency from the browser workspace.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the history renderer fix ships. No database migration was required.
- Follow-up notes: Browser verification on the latest bundle shows the history page now loads and lists stored optimization runs without a render error.

## 2026-04-27 - Normalize compare and history scenario summaries

- Summary: Hardened the compare and optimization-history rendering paths so stored scenario summaries are normalized before display, which prevents older optimization payloads with missing names or partial fixed-objective records from crashing the workspace screens.
- Files or modules affected: `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The compare screen and history-to-scenarios flow were still assuming every scenario record had the current full shape, but older stored optimization results can omit labels or carry partial fixed-objective payloads.
- Architecture impact: Reinforced the browser compatibility boundary for historical optimization results by treating comparison data as untrusted presentation input that must be normalized before rendering.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the compare/history normalization ships. No database migration was required.
- Follow-up notes: A longer-term repair task still tracks canonicalizing the legacy `optimization_runs` payloads at rest so these compatibility branches can eventually be removed.

## 2026-04-27 - Seed the builder with a clean starter draft during auth bootstrap

- Summary: Updated the authenticated shell and browser workspace bootstrap so they both install a clean starter canvas before async account-scoped workspace requests finish, preventing the Builder from mounting against stale demo graph data during fast navigation immediately after login or session restore.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Builder could still hit the workspace error boundary when users opened it in the narrow gap between auth success and `/api/projects`, `/api/pathways`, `/api/evidence/tests`, and `/api/settings` hydration, because the screen briefly read the old prototype `SEED_PATHWAY`.
- Architecture impact: Auth bootstrap and workspace bootstrap now share responsibility for installing an immediate safe Builder baseline before persisted-pathway hydration takes over, which removes the race between shell navigation and account-scoped data loading.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the bootstrap guard ships. No database migration was required.
- Follow-up notes: A deferred cleanup item was added for the legacy global-component files so Vite dev mode can provide unminified runtime stacks reliably.

## 2026-04-27 - Guard remaining seed-array reads

- Summary: Hardened the last unguarded seed-data reads in Builder and utility screens so `SEED_TESTS`, `SEED_COMPARE`, `SEED_PRESET_DISEASES`, and `SEED_VALIDATIONS` are treated as empty arrays when the workspace has not fully hydrated yet.
- Files or modules affected: `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The workspace error boundary could still appear when a screen rendered before seed fixtures or workspace collections were available, especially on Builder and secondary utility pages.
- Architecture impact: Closed the remaining direct global-seed access paths in the browser UI so collection hydration is consistently defensive across the shell, Builder, and auxiliary screens.
- Migration or deployment impact: Rebuild the frontend bundle only; no schema or backend migration was required.
- Follow-up notes: The production bundle was rebuilt successfully after the change.

## 2026-04-27 - Harden workspace collection hydration

- Summary: Coerced the shared workspace getters and the Home, Wizard, Library, Scenarios, Canvas, and Properties panel consumers to arrays before rendering so malformed snapshot data cannot crash the workspace shell through a shared `.map()` path.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The workspace error overlay was still appearing when screen components consumed a non-array workspace snapshot and failed during render.
- Architecture impact: Tightened the browser-side boundary between workspace state hydration and screen rendering by normalizing collection-shaped data at the action layer and at the consuming screen layer, and removed two render-time crash sources in the wizard and scenarios screens.
- Migration or deployment impact: Rebuild the frontend bundle only; no schema or backend migration was required.
- Follow-up notes: The production bundle was rebuilt successfully after the change.

## 2026-04-27 - Scope workspace error handling to individual screens

- Summary: Moved the React error boundary from the entire authenticated shell to each individual screen so a render failure is isolated to the active page instead of blocking navigation across the workspace.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The global boundary was too broad and made a single screen failure feel like the whole app had crashed, even though other screens could still render correctly.
- Architecture impact: The workspace shell and rail remain live even if one screen throws, which keeps the app navigable and makes screen-specific issues easier to recover from.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so screen-level recovery boundaries are active. No database migration was required.
- Follow-up notes: The fallback card is now tied to the current screen only, which is the appropriate blast radius for a render-time error in a multi-screen workspace.

## 2026-04-27 - Hide stored optimization results from workspace Home

- Summary: Changed the Home screen optimization banner so it only appears for live queued or running optimizations, while terminal stored results are accessed from the optimization history page instead of occupying the workspace front page.
- Files or modules affected: `web/resources/js/optidx/components/ScreenHome.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The persistent stored-result card was visually confusing and looked like a still-running optimization, even though it was only a saved terminal result.
- Architecture impact: Home now functions as a workspace launcher and live-run surface only; historical optimization outputs are retained in the run library/history page rather than being duplicated on the landing view.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the Home surface no longer shows stored terminal optimization banners.
- Follow-up notes: The optimization history page remains the place to inspect older runs or reopen stored results.

## 2026-04-27 - Reset workspace error boundary on screen change

- Summary: Made the authenticated workspace error boundary clear itself when the active screen changes, so a transient render failure on one screen does not permanently trap the user in the recovery card.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The user reported that Builder and other pages could not be opened after an optimization-related runtime error appeared, which meant the shell needed a way to recover without a full reload.
- Architecture impact: The workspace error boundary is now scoped to the current screen rather than acting like a session-wide dead end after the first render exception.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the reset behavior ships with the app. No database migration was required.
- Follow-up notes: The boundary still preserves the visible recovery card for the screen that actually failed, but users can now navigate away and continue working.

## 2026-04-27 - Add workspace error boundary for white-screen recovery

- Summary: Wrapped the authenticated workspace shell in a React error boundary so any render-time failure shows a readable recovery card with retry and reload actions instead of a blank white page.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The user reported intermittent white screens and crashes across multiple pages, so the shell needed a predictable recovery path even if a screen throws at render time.
- Architecture impact: The workspace now has a top-level client-side safety net that isolates screen render failures from the rest of the app shell and makes the failure visible to the user.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the error boundary ships with the workspace shell. No database migration was required.
- Follow-up notes: I reproduced the main workspace screens locally after signing in and they render, but this boundary prevents a hidden render error from taking the whole shell down if it reappears.

## 2026-04-27 - Add stored optimization run history page

- Summary: Added an account-scoped optimization run history endpoint and a dedicated workspace page that lists prior runs, opens a stored run in detail view, and routes into the scenarios screen without rerunning the same project.
- Files or modules affected: `web/app/Http/Controllers/Api/OptimizationRunController.php`, `web/routes/api.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Users needed a durable place to inspect previous optimization runs and reopen their stored details instead of launching the same optimization multiple times.
- Architecture impact: Optimization runs now have a browsable history surface in addition to the latest-result shortcut, and the browser can reopen a saved optimization run directly from the history list.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the Laravel app so the new history route, index endpoint, and browser page are live. No database migration was required for this slice.
- Follow-up notes: Validation was run with `npm run build`, and a feature test now covers account-scoped optimization run history listing.

## 2026-04-27 - Rename optimization scenarios to objective labels

- Summary: Updated the scenarios screen so the fixed optimization cards and the detail card are labeled by objective name, removed generic candidate wording from the main scenario view, and changed the Pareto plot to average cost per patient versus Youden's J.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The scenario cards needed to read like real optimization objectives instead of placeholder candidate buckets, and the chart needed to match the optimizer metrics users are asked to compare.
- Architecture impact: The optimization UI now presents the eight fixed outputs using the canonical objective labels and aligns the frontier chart axes with average cost per patient and Youden's J.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the updated scenario labels and chart axes are active. No database migration was required.
- Follow-up notes: Validation passed with `npm run build`.

## 2026-04-27 - Preserve unresolved discordant branches on import

- Summary: Removed the canvas hydration fallback that auto-wired a missing parallel discordant branch to an inconclusive terminal, so imported optimizer drafts now keep the branch unresolved until a user connects it like any other output.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The discordant output should remain editable and routeable to any valid downstream node rather than being hardcoded to inconclusive during hydration.
- Architecture impact: Parallel discordant branches now behave like the other pathway outputs at import time, which keeps validation honest and lets the user decide whether the branch should end in positive, negative, inconclusive, or continue into another test.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the updated canvas hydration logic is active. No database migration was required.
- Follow-up notes: Validation passed with `npm run build`.

## 2026-04-27 - Auto-connect missing parallel discordant branches

- Summary: Updated the canvas hydration path so optimizer and imported pathway drafts automatically add a discordant branch target for parallel blocks when that port is missing, using an inconclusive terminal as the fallback endpoint.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Loaded optimizer pathways were rendering a dangling discordant port on parallel blocks, which made the draft look incomplete and forced users to wire the branch manually.
- Architecture impact: Parallel-block hydration now guarantees a visible downstream target for the discordant output when the source graph omits it, which keeps optimizer results builder-valid and easier to edit.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the updated canvas hydration logic is active. No database migration was required.
- Follow-up notes: Validation should include a browser smoke of an imported optimizer result to confirm the discordant branch renders to the new inconclusive fallback node.

## 2026-04-27 - Add a real stop action for stalled optimization runs

- Summary: Added a cancel endpoint for optimization runs, stored the detached process PID on launch, made the optimization service terminate active runs by PID when possible, and exposed a Stop run button on the wizard and workspace home surfaces.
- Files or modules affected: `web/app/Http/Controllers/Api/OptimizationRunController.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/OptimizationService.php`, `web/app/Models/OptimizationRun.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/database/migrations/2026_04_27_000240_add_process_tracking_to_optimization_runs_table.php`, `web/tests/Unit/OptimizationServiceTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: A stalled optimization run could be dismissed from the workspace but not truly killed, which left no supported way to stop a long-running detached optimizer process.
- Architecture impact: Optimization runs now have an explicit backend cancellation path, the detached launcher records the child PID, and the service ignores late progress/result writes from runs that were cancelled mid-flight.
- Migration or deployment impact: Apply the new optimization-runs migration, rebuild the frontend bundle, and redeploy the PHP app so the stop action and PID-backed cancellation are active.
- Follow-up notes: Validation passed with `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, and `npm run build`.

## 2026-04-27 - Separate active and terminal optimization run storage

- Summary: Split browser persistence for optimization runs into active and terminal slots so an in-flight run can survive refresh/navigation without overwriting the last completed result, and changed the Home card to show active work only while the run is actually queued or running.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenHome.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The workspace was getting stuck on a live optimization card because the same storage slot was being reused for both in-flight progress and completed results.
- Architecture impact: Browser state now distinguishes live optimization work from stored optimization results, which lets the UI dismiss a live run without deleting the last terminal result and prevents stale active state from shadowing saved results.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the browser state split is active. No database migration was required.
- Follow-up notes: Validation passed with `php artisan test --filter=PathwayApiTest` and `npm run build`.

## 2026-04-27 - Make restored optimization runs non-blocking

- Summary: Changed the wizard so it only treats optimization runs launched in the current session as blocking state, added a `Hide from workspace` action for live optimization cards on Home, and kept background runs informational instead of preventing new work from starting.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: A restored running optimization could leave the workspace feeling stuck because the browser treated the saved run as an active blocker even after the user navigated away.
- Architecture impact: Restored optimization state is now advisory unless the current wizard session launched it, which keeps the background run visible without locking the user out of new optimization work.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the non-blocking restore behavior and hide action are live. No database migration was required.
- Follow-up notes: Validation passed with `php artisan test --filter=PathwayApiTest` and `npm run build`.

## 2026-04-27 - Reattach polling for restored optimization runs

- Summary: Fixed the browser restore path so a running optimization run loaded from local storage immediately reattaches the poller and continues until a terminal state instead of freezing on the last known 100% snapshot after navigation or refresh.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Extended runs could appear stuck at finalizing outputs when the page was refreshed or revisited because the stored run state was restored without resuming polling.
- Architecture impact: Restored active runs are now treated as live background work again, not as static state snapshots.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the restored-run polling fix is active. No database migration was required.
- Follow-up notes: Validation passed with `php artisan test --filter=PathwayApiTest` and `npm run build`.

## 2026-04-27 - Switch optimization progress to indeterminate activity

- Summary: Replaced the percentage-style optimization progress bars with indeterminate activity animations on the wizard, scenarios, and workspace home surfaces so the UI no longer implies a known total pathway count.
- Files or modules affected: `web/resources/js/optidx/app.css`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer does not know the total number of pathways up front, so a completion-style bar was misleading even when the backend was genuinely making progress.
- Architecture impact: The progress indicator is now an activity animation rather than a completion meter, while the backend still owns the live run status and terminal result.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the new activity animation is live. No database migration was required.
- Follow-up notes: Validation should include a quick browser smoke once the rebuilt bundle is deployed so the wizard and scenarios screens both show the new indeterminate treatment.

## 2026-04-27 - Remove the Python bridge timeout for optimization runs

- Summary: Disabled Symfony Process timeouts in the Python bridge so long extensive optimization runs are not terminated after 60 seconds by the PHP launcher, while keeping the existing detached launcher and progress-persistence flow intact.
- Files or modules affected: `web/app/Services/PythonEngineBridge.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Extensive optimization runs were still being killed by the default Process timeout even though the detached launcher was working correctly and the optimizer itself was still running.
- Architecture impact: The Python bridge now treats optimization subprocesses as long-lived work units with no launcher-imposed timeout, which matches the intended background-search behavior.
- Migration or deployment impact: Rebuild and redeploy the PHP app so the bridge timeout change is active. No database migration was required.
- Follow-up notes: Validation passed with `php artisan test --filter=PythonEngineBridgeTest` and `php artisan test --filter=OptimizationServiceTest`.

## 2026-04-27 - Persist and reopen optimization runs

- Summary: Added server-side latest-run lookup for optimization results, stored the last optimization run reference and request signature in browser storage so identical runs can reopen stored results instead of rerunning, hid the wizard overlay once terminal results are handed off, and kept the minimum 30-second progress illusion only for runs that actually finish very quickly.
- Files or modules affected: `web/app/Http/Controllers/Api/OptimizationRunController.php`, `web/routes/api.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer results were being treated as one-off UI state, the completion overlay was lingering longer than it should, and the fast-run smoothing rule needed to apply only to genuinely short runs instead of every optimization.
- Architecture impact: Optimization results are now rehydratable from persisted run records, the browser can reuse a stored result when the request signature matches, and the wizard progress overlay is now a transient display layer rather than a persistent blocking surface.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the Laravel app so the latest-run endpoint, result reuse, and overlay timing changes are active. No database migration was required.
- Follow-up notes: Validation passed with `php artisan test --filter=PathwayApiTest`, `php artisan test --filter=OptimizationServiceTest`, and `npm run build`.

## 2026-04-27 - Detach optimization runs from the queue worker on Windows

- Summary: Switched both light and extensive optimization launches to a detached Artisan process with a Windows new-console option, marked runs as `running` immediately instead of leaving them queued, and verified the launcher by invoking it against a live run that completed to a terminal result.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/app/Services/OptimizationService.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Extensive runs were never leaving the `queued` state because the database queue worker was not active, and the previous detached launch path did not reliably survive the Windows request boundary.
- Architecture impact: Optimization execution is now owned by a single detached Artisan command path for both run modes, with queued jobs no longer required for the optimization lifecycle on this environment.
- Migration or deployment impact: Redeploy the PHP app and rebuild the frontend bundle so the new detached-launch controller path is live. No database migration was needed.
- Follow-up notes: Verification passed with `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, and a live `php -r` smoke that launched a run and observed it reach `infeasible` through the detached path.

## 2026-04-27 - Fix false infeasible optimization runs from malformed wizard payloads

- Summary: Fixed the optimization launch path so persisted workspace tests with numeric database ids are no longer dropped during backend normalization, prevalence values are defensively rescaled back into fractions on both the browser and Laravel sides, light runs now carry the active project id into the run record, and infeasible/time-limit completions no longer flash a transient toast over the scenarios screen.
- Files or modules affected: `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/actions.js`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/OptimizationService.php`, `web/tests/Unit/OptimizationServiceTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Feasible optimizer runs were being reported as infeasible because the request path could submit an empty effective catalog and an over-scaled prevalence value, especially when the library contained persisted evidence tests with numeric ids instead of UI seed ids.
- Architecture impact: Optimization request normalization is now a defensive boundary in both the browser and Laravel orchestration layer, not just in the Python optimizer. The controller can recover from an empty submitted catalog by loading the authenticated workspace test library, and truly empty catalogs now fail with a validation-style message before a run record is created.
- Migration or deployment impact: Rebuild the frontend bundle and redeploy the PHP app so the request normalization, numeric-id handling, and terminal-state UI changes ship together. No database migration was required for this slice.
- Follow-up notes: Validation passed with `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, and `npm run build`. The existing Vite large-chunk warning remains unchanged.

## 2026-04-26 - Resolve CLI PHP correctly for detached light optimization runs

- Summary: Fixed the light-run launcher so it resolves a CLI-capable PHP executable instead of blindly reusing the current request runtime, updated the initial run stage from `queued` to `starting`, and added a regression test that rejects `php-cgi` style launch paths.
- Files or modules affected: `web/app/Services/PythonEngineBridge.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/OptimizationService.php`, `web/tests/Unit/PythonEngineBridgeTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Light optimization runs could remain stuck because a Windows web request may execute under `php-cgi.exe`, which is not a safe detached Artisan runtime, and the UI also surfaced the misleading `queued` stage text even after the run had been marked as running.
- Architecture impact: Detached optimization launches now use an explicit CLI-runtime resolution step shared with the existing process-bridge runtime rules, and the initial run-stage state now reflects launch progress instead of queue state.
- Migration or deployment impact: Redeploy the PHP app so the new CLI-runtime resolution is active for light runs. No schema change was required.
- Follow-up notes: If a deployment uses a non-standard CLI PHP path, set `PHP_CLI_BINARY` or `PHP_BINARY_CLI` explicitly to avoid relying on sibling binary discovery.

## 2026-04-26 - Fix Process temp directory for detached optimization runs

- Summary: Forced Symfony Process onto a project-local writable temp directory before launching detached light runs and added a regression test that proves a child process can start after the temp directory is initialized, which avoids the `C:\Windows\sf_proc_00.out.lock` permission failure.
- Files or modules affected: `web/app/Services/PythonEngineBridge.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/tests/Unit/PythonEngineBridgeTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Light optimization launches were still failing on this Windows environment because Symfony Process was falling back to `C:\Windows` for its lock files, which is not writable for the app user.
- Architecture impact: Process-based launches now share a project-local temp policy, so detached optimization execution and Python bridge calls no longer depend on machine-wide temp configuration.
- Migration or deployment impact: Redeploy the PHP app so the launcher and bridge changes ship, and ensure the `storage/app/process-temp` directory can be created by the application user.
- Follow-up notes: If another environment overrides `TMP`, `TEMP`, or `TMPDIR` unexpectedly, the bridge now reasserts the project-local path at runtime before launching a child process.

## 2026-04-26 - Fix light-run startup, empty-state, and Python runtime resolution

- Summary: Fixed the live optimization launch path so light runs start through a detached Laravel command instead of waiting indefinitely on a worker, updated the Python bridge to resolve an actual installed interpreter on this Windows setup, and changed the scenarios view to keep a persistent readable message when the optimizer returns infeasible or no-feasible results instead of flashing a white screen.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/PythonEngineBridge.php`, `web/app/Services/OptimizationService.php`, `web/app/Jobs/ExecuteOptimizationRun.php`, `web/routes/console.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The user-facing flow was still failing on this machine because the optimizer bridge could not reliably locate Python, light runs could remain queued too long, and infeasible results were not rendered as a stable screen state.
- Architecture impact: Light runs now have their own detached execution entrypoint, the Python bridge explicitly resolves the interpreter before launching the optimizer, and the scenarios screen treats infeasible or empty results as terminal UI states with a visible exit path.
- Migration or deployment impact: Redeploy the PHP app and rebuild the frontend bundle so the detached launch path, Python resolution, and persistent empty-state UI are live. No database migration was needed for this slice.
- Follow-up notes: If a production environment uses a different Python installation path, set `PYTHON_EXECUTABLE` or `PYTHON_BIN` explicitly so the bridge does not depend on machine-specific defaults.

## 2026-04-26 - Light optimization after-response start

- Summary: Changed light optimization runs to use Laravel's after-response dispatch path so they start processing without depending on a continuously running queue worker, which was leaving the run stuck in `queued` on local SQLite setups. Extensive runs remain on the durable queued path.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Light runs were remaining in the queued state indefinitely in environments where the database queue existed but no worker was active, which made the optimizer look broken even though the backend code was correct.
- Architecture impact: Light runs now use a request/response handoff to start work immediately after the response is sent, while extensive runs continue to require the queue worker for long-lived background execution.
- Migration or deployment impact: No schema change. Rebuild and redeploy the PHP app so the controller dispatch change ships, and ensure the queue worker still runs for extensive jobs.
- Follow-up notes: If a production environment does not support after-response work reliably, the next step is a tiny queue-worker supervision task rather than reverting light runs back to a synchronous browser wait.

## 2026-04-26 - Light run timeout fallback and user-facing optimization overlay

- Summary: Changed light-run polling so a slow queued optimization no longer throws a fatal client timeout; it now falls back to background monitoring and keeps the run state live. Also renamed the in-progress overlay from the technical backend label to a user-facing optimization title and added an explicit exit path into the run-status view.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `CHANGE_LOG.md`.
- Reason for the change: Light runs were still surfacing a hard timeout message with no obvious way to leave the screen, which forced a manual refresh even though the backend run could continue.
- Architecture impact: The browser now treats light-run timeouts as a presentation fallback rather than a fatal optimization failure, and the visible overlay wording is aligned with the product-facing search flow instead of backend implementation details.
- Migration or deployment impact: Rebuild the frontend bundle so the new timeout fallback and overlay copy ship with the app. No schema or PHP deployment change was required for this slice.
- Follow-up notes: If light runs still spend too long in queued state after the timeout fallback, the next step is queue-worker calibration rather than a UI timeout increase.

## 2026-04-26 - Light/extensive optimization modes and backend progress snapshots

- Summary: Added explicit `light` and `extensive` optimization run modes, switched the browser from the fake timer-based optimization progress bar to backend-driven progress snapshots, flattened queued optimization run polling responses so scenarios can consume the selected outputs directly, and sent completion notifications for extensive runs, including failures.
- Files or modules affected: `web/app/Services/OptimizationService.php`, `web/app/Services/PythonEngineBridge.php`, `web/app/Http/Controllers/Api/OptimizationRunController.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Jobs/ExecuteOptimizationRun.php`, `web/app/Models/OptimizationRun.php`, `web/app/Notifications/OptimizationRunCompletedNotification.php`, `web/database/migrations/2026_04_26_000230_add_optimizer_progress_and_modes_to_optimization_runs_table.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `optidx_package/optidx/cli.py`, `optidx_package/optidx/optimizer.py`, `optidx_package/tests/test_optimizer.py`, `web/tests/Unit/OptimizationServiceTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer was still presenting a hardcoded progress experience and the browser timed out on long runs even when the backend was still working, so the UI needed a real backend-owned run lifecycle with separate interactive and background budgets.
- Architecture impact: The optimization run record now owns its mode, live progress, and notification state; Python emits structured progress events during search; Laravel persists those snapshots and sends completion mail for extensive runs; and the scenarios screen consumes the flattened result payload from the polling endpoint.
- Migration or deployment impact: Run the new `optimization_runs` migration, rebuild the frontend bundle, and redeploy the Laravel queue worker so the progress snapshots and completion notifications are active. Validation passed with `python -m compileall optidx_package/optidx`, `pytest optidx_package/tests`, `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, and `npm run build`.
- Follow-up notes: The remaining follow-up is to add a richer run-history surface and tighten the progress estimator if large production catalogs show a better calibration curve.

## 2026-04-26 - CPBB-PF v3 branch-and-bound search rewrite and SQLite ownership repair

- Summary: Replaced the optimizer's remaining template-enumeration path with a Python best-first branch-and-bound CPBB-PF v3 search, hard-renamed the external optimizer constraint contract to the new `*_allowed` fields, added search-state and Pareto-frontier test coverage, and repaired local SQLite schema drift with a defensive ownership-column migration so evidence-test imports succeed on older databases.
- Files or modules affected: `optidx_package/optidx/constraints.py`, `optidx_package/optidx/grammar.py`, `optidx_package/optidx/metrics.py`, `optidx_package/optidx/models.py`, `optidx_package/optidx/optimizer.py`, `optidx_package/optidx/__init__.py`, `optidx_package/tests/test_optimizer.py`, `optidx_package/tests/test_engine.py`, `web/app/Services/OptimizationService.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/database/migrations/2026_04_26_000190_scope_workspace_rows_by_account.php`, `web/database/migrations/2026_04_26_000220_repair_workspace_ownership_columns.php`, `web/tests/Feature/PathwayApiTest.php`, `web/tests/Unit/OptimizationServiceTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`.
- Reason for the change: The optimizer needed to meet the CPBB-PF v3 requirement of intelligent partial-state search and the local evidence-import flow was still failing on drifted SQLite databases that missed the `created_by` ownership migration.
- Architecture impact: Python now owns a grammar-constrained search loop with partial bounds, priority-queue expansion, repeated-test aliasing, and feasible-frontier selection, while Laravel keeps queue orchestration, persistence, and transport responsibilities. Ownership repair remains a schema concern rather than weakening the authenticated model trait.
- Migration or deployment impact: Run `php artisan migrate --force` so the defensive ownership repair executes on older databases, then rebuild the frontend bundle and redeploy the PHP/Python runtime. Validation passed with `python -m compileall optidx_package/optidx`, `pytest optidx_package/tests`, `php artisan migrate --force`, `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, and `npm run build`.
- Follow-up notes: The remaining optimizer follow-up is tighter pruning and continuation equivalence; the remaining UI follow-up is code-splitting the growing frontend bundle.

## 2026-04-26 - CPBB-PF v3 optimizer queue cutover

- Summary: Replaced the synchronous heuristic optimizer path with a Python-authoritative CPBB-PF v3 module, added queued `optimization_runs` processing with a Laravel job and polling endpoint, expanded diagnostic-test canonicalization to include explicit role/sample booleans and repeat metadata, and updated the wizard/scenarios UI to consume the new eight-output optimizer contract.
- Files or modules affected: `optidx_package/optidx/*.py`, `web/app/Services/OptimizationService.php`, `web/app/Jobs/ExecuteOptimizationRun.php`, `web/app/Http/Controllers/Api/OptimizationRunController.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Models/OptimizationRun.php`, `web/database/migrations/2026_04_26_000210_expand_optidx_optimization_runs_table.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/tests/Unit/OptimizationServiceTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`.
- Reason for the change: The optimizer needed to become the most important module in the system, with a deterministic Python search core, explicit run-state persistence, and a browser contract that no longer depended on the old MCDA-led ranking flow.
- Architecture impact: The optimizer is now Python-authoritative, Laravel acts as orchestration and persistence only, and queued run records are the system boundary for optimization lifecycle state.
- Migration or deployment impact: Rebuild the Python package/runtime, rerun the Laravel migration for expanded optimization runs, rebuild the Vite frontend bundle, and redeploy the app so the queued optimizer flow is active. Validation passed with `python -m compileall optidx_package/optidx`, `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, a Python smoke run of `optimize_pathways`, and `npm run build`.
- Follow-up notes: The remaining future work is mostly about richer queued-run progress/cancellation and optional constraint presets, not the core optimization contract itself.

## 2026-04-26 - Add pathway rename and workspace summaries

- Summary: Updated the workspace Home cards to hydrate pathway names, timestamps, and latest evaluation summary metrics from the persisted pathway snapshot, added an in-card rename action that updates both the pathway name and metadata label, and taught the pathway API to eager-load the latest evaluation result on index/show/update responses.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The workspace list was still showing placeholder metrics and there was no user-facing way to rename a pathway into a more understandable label.
- Architecture impact: The workspace snapshot now carries normalized pathway summary data from the latest evaluation result, and the Home screen can rename a pathway through the same persisted `PUT /api/pathways/{id}` flow used by the editor.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy the Laravel app so the updated pathway summary hydration, rename action, and eager-loaded API responses are live.
- Follow-up notes: If users need richer rename controls later, the next step would be an inline editable title field instead of the prompt-based menu action.

## 2026-04-26 - Format wizard optimization progress label

- Summary: Rounded the wizard optimization progress percentage to one decimal place in the overlay meta row instead of rendering the raw floating-point value.
- Files or modules affected: `web/resources/js/optidx/components/ScreenWizard.jsx`, `CHANGE_LOG.md`.
- Reason for the change: The progress label was exposing the full float precision from the timer-driven progress state, which looked noisy and inconsistent with the rest of the UI.
- Architecture impact: None. This is a presentation-only change in the wizard overlay.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the formatted progress label is live.
- Follow-up notes: If the team prefers a whole-number label later, the same helper can be switched from `toFixed(1)` to integer rounding without touching the overlay layout.

## 2026-04-26 - Scope workspace data by authenticated account

- Summary: Added account-owned workspace scoping across projects, pathways, diagnostic tests, and settings; introduced a shared ownership trait that stamps `created_by` on create and filters model queries to the signed-in user; wrapped the workspace API routes in `web` + `auth`; cleared the browser workspace snapshot before reloading account data; and added regression coverage for cross-account isolation.
- Files or modules affected: `web/app/Models/Concerns/BelongsToAuthenticatedUser.php`, `web/app/Models/Project.php`, `web/app/Models/Pathway.php`, `web/app/Models/DiagnosticTest.php`, `web/app/Models/Setting.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Http/Controllers/Api/DiagnosticTestController.php`, `web/app/Http/Controllers/Api/SettingsController.php`, `web/routes/api.php`, `web/database/migrations/2026_04_26_000190_scope_workspace_rows_by_account.php`, `web/resources/js/optidx/actions.js`, `web/tests/Feature/ProjectApiTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Workspace records were visible across accounts because the API returned global rows and the browser snapshot could keep stale data between user sessions.
- Architecture impact: The workspace boundary is now account-scoped at the model and route layers, so each authenticated user sees only their own persisted project, pathway, test, and settings records.
- Migration or deployment impact: Run the new database migration to add ownership columns and settings uniqueness by account, then rebuild/redeploy the Laravel app and frontend bundle so the auth-gated routes and snapshot reset are live.
- Follow-up notes: Legacy rows are backfilled to the first available owner where possible, but any ambiguous historical attribution still deserves a later audit pass.

## 2026-04-26 - Fix wizard prevalence percent entry

- Summary: Adjusted the wizard prevalence field so it accepts decimal percent input without being reinterpreted as a backend fraction during autosave, and loosened the number input step to let browsers handle decimal entry naturally.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `CHANGE_LOG.md`.
- Reason for the change: Typing values like `8.5` was being converted as if the wizard had already supplied a fraction, which caused autosave to send invalid prevalence values and made the field appear capped or unstable.
- Architecture impact: The wizard still stores prevalence as a percent in UI state, while the API payload continues to receive the canonical 0-1 fraction.
- Migration or deployment impact: Rebuild and redeploy the frontend bundle so the corrected prevalence save path and input behavior are live.
- Follow-up notes: If you want stricter input validation later, add a dedicated percent parsing helper and a small frontend test for the wizard payload conversion.

## 2026-04-26 - Persist new-project wizard drafts

- Summary: Added project-backed draft persistence for the new-project wizard, including browser-side active-project tracking, debounced autosave, hydration from `projects` records on return/refresh, and a focused project API regression test for metadata and prevalence persistence.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/tests/Feature/ProjectApiTest.php`, `ARCHITECTURE.md`, `README.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Wizard prevalence and constraint edits were reverting to preset defaults because the flow was only keeping local React state and never persisted the draft project record.
- Architecture impact: The new-project flow now treats `projects` as the persisted draft record, stores wizard-only state in `projects.metadata`, and restores that draft when the wizard is reopened or the page refreshes.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx stack so the autosave-backed wizard flow is live.
- Follow-up notes: Shared diagnostic tests remain workspace-wide for now; project-specific test libraries are deferred to a future task.

## 2026-04-26 - Wire wizard specs into optimizer input

- Summary: Converted the wizard's project/spec fields into real state, passed the selected constraints and prevalence into the optimize request, and updated the backend ranking to honor the chosen objective instead of using a single fixed score for every optimization run.
- Files or modules affected: `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/app/Services/OptimizationService.php`, `web/tests/Unit/OptimizationServiceTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The wizard inputs were previously display-only defaults, so changing the project setup did not affect the optimizer payload and the results appeared identical across runs.
- Architecture impact: Optimization is now driven by live wizard state, and the backend ranking strategy is objective-aware rather than hardwired to one blended metric.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx stack so the new wizard state flow and ranking logic are live.
- Follow-up notes: If you want the objective buttons to do more than influence ranking, the next step is to map each objective to explicit constraint presets as well.

## 2026-04-26 - Preserve optimization prevalence through canvas reruns

- Summary: Carried the optimization prevalence through the saved scenario snapshot, the hydrated canvas draft, and the evaluator default so cost and turnaround metrics rerun under the same cohort assumptions that produced the optimized candidate.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The loaded scenario matched sensitivity and specificity but produced different cost and TAT values because the rerun path was dropping the prevalence used by the optimizer.
- Architecture impact: The browser now treats prevalence as part of the optimization scenario context, not just a one-off request parameter.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx stack so the updated canvas/run behavior is live.
- Follow-up notes: Existing scenarios should now rerun with the captured prevalence as long as the optimization result was generated after this fix.

## 2026-04-26 - Preserve optimizer test snapshots during canvas rerun

- Summary: Updated the browser hydration and canonicalization helpers so optimization candidates keep using the frozen test snapshot embedded in the optimization payload instead of re-resolving test metrics from the live workspace catalog when the pathway is loaded back into the Builder and rerun.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Optimized scenarios could display one set of costs and turnaround times in the scenarios view but produce different results when loaded into the canvas and executed again after the test library changed.
- Architecture impact: The browser now treats the optimization payload's test snapshot as the authoritative input for imported candidates and only falls back to the live workspace catalog when a snapshot is missing.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx stack so the corrected hydration path is live.
- Follow-up notes: Fresh optimization runs will now preserve the candidate-local test values end to end. Legacy payloads without test snapshots may still reflect the current workspace catalog until regenerated.

## 2026-04-26 - Add delete action to Home recent pathway cards

- Summary: Added a kebab menu to each recent pathway card on the Home/Workspace screen with open and delete actions, and wired deletion through the existing Laravel pathway delete endpoint while refreshing the workspace snapshot after removal.
- Files or modules affected: `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The workspace needed an inline way to remove recent pathways directly from the card menu instead of forcing users to open the canvas first.
- Architecture impact: The Home screen now owns pathway-card action affordances for open/delete, while the shared browser action layer continues to own the actual API call and workspace refresh.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx stack so the Home card menu and pathway delete handler are live.
- Follow-up notes: If the deleted pathway was the currently open one, the browser now resets to a fresh starter canvas so the UI does not keep referencing a removed record.

## 2026-04-26 - Fix zero-valued pathway evaluation from id-mismatch serialization

- Summary: Fixed the browser-side pathway hydration, serializer, and results catalog lookup so canvas test ids are matched against the live workspace catalog using string-safe ids before load, serialization, and result rendering, preventing saved graphs from compiling with zero-valued test metadata.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: A saved pathway with numeric test ids was being compiled with empty test definitions because the browser lookup used strict id equality and missed workspace tests whose ids arrived as strings or numbers in a different shape.
- Architecture impact: The frontend now treats the live workspace test library as the authoritative source for test metadata during hydration, serialization, and results rendering, with string-safe id matching to keep numeric database ids and string node ids aligned.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart the OptiDx VPS stack so the corrected serializer and results lookup are active.
- Follow-up notes: Existing saved pathways that already contain zero-valued test snapshots should be re-saved or re-evaluated once the rebuilt frontend is live so the new lookup path can repopulate the test metadata.

## 2026-04-26 - Parallel block summary now resolves live workspace tests

- Summary: Updated the Builder inspector so parallel blocks resolve member tests from the live workspace catalog first and fall back to the stored member snapshot, then recompute combined cost, max TAT, sample types, and max skill from the resolved member records instead of seed-only fixtures.
- Files or modules affected: `web/resources/js/optidx/components/PropertiesPanel.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The parallel block summary was incorrectly showing `$0.00`, `n/a`, and a hardcoded skill label because the inspector only looked at `SEED_TESTS`, which is too narrow for imported or workspace-authored tests.
- Architecture impact: The properties panel now treats the live workspace test catalog as the primary lookup source and uses the member snapshot as a safe fallback, which keeps summary metrics aligned with the actual block contents.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the updated inspector summary logic is published. No database migration was required.
- Follow-up notes: The same helper also improves the test picker options in the inspector so dynamically added workspace tests remain available there.

## 2026-04-26 - Builder run-pathway discordant port compatibility

- Summary: Updated the canvas graph compiler to treat `disc` as an alias for `discord` when compiling discordant parallel branches, and added a regression test that verifies mixed-outcome branches are emitted correctly instead of collapsing to empty conditions.
- Files or modules affected: `web/app/Services/PathwayGraphService.php`, `web/tests/Unit/PathwayGraphServiceTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The builder's saved discordant-referee pathways were compiling empty branch-condition arrays, which the Python evaluator then rejected with a bridge error during `Run pathway`.
- Architecture impact: The backend compiler now accepts both canvas spellings for discordant branches, which keeps old and current builder payloads compatible with the same evaluation engine contract.
- Migration or deployment impact: Rebuild and redeploy the web app so the updated compiler and regression test are active in production.
- Follow-up notes: The live failing pathway should evaluate normally again after the container is rebuilt with this patch.

## 2026-04-26 - Optimization runtime deployment repair

- Summary: Rebuilt the live OptiDx Docker Compose stack on the VPS so the PHP container now includes `python` and mounts the shared `optidx_package` source tree, then verified the optimization API end to end against `http://127.0.0.1:8082/api/pathways/optimize`.
- Files or modules affected: `web/Dockerfile`, `web/docker-compose.yml`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimization wizard was returning a backend server error because the production container had not yet been rebuilt with the Python runtime and package mount required by `PythonEngineBridge`.
- Architecture impact: The deployment contract is now explicit: the app container must ship a `python` executable and the compose stack must bind-mount the canonical Python package into `/var/www/optidx_package` so Laravel can invoke the engine bridge directly.
- Migration or deployment impact: Recreated the live app, queue, and scheduler containers on the VPS; the optimize endpoint now returns `200 OK` with ranked candidates instead of a generic server error.
- Follow-up notes: A small repeatable deployment helper remains on the future-task list so the runtime check is not manual next time.

## 2026-04-26 - Syreon favicon applied to OptiDx

- Summary: Replaced the empty OptiDx favicon with Syreon's published `favicon.png`, added explicit favicon/apple-touch-icon metadata to the app Blade layout, and kept both `favicon.png` and `favicon.ico` paths serving the same asset.
- Files or modules affected: `web/resources/views/app.blade.php`, `web/public/favicon.png`, `web/public/favicon.ico`, `CHANGE_LOG.md`.
- Reason for the change: The OptiDx site needed to match the Syreon brand favicon used on `syreon.me`.
- Architecture impact: None. This is a static asset and document-head update only.
- Migration or deployment impact: Rebuilt and redeployed the OptiDx containers so the new favicon is live on `https://optidx.syreon.me/`.
- Follow-up notes: Verified both `/favicon.png` and `/favicon.ico` return `200 OK` from the VPS origin.

## 2026-04-26 - Homepage 500 fix for containerized OptiDx

- Summary: Fixed the production container startup script so it creates Laravel's full `storage/framework/*` subtree and `storage/logs` before boot, which resolved the homepage 500 while keeping `/api/health` healthy.
- Files or modules affected: `web/docker/entrypoint.sh`, `CHANGE_LOG.md`.
- Reason for the change: The tunnel and container were working, but the root homepage route failed because Laravel could not resolve a valid compiled view cache path when the storage subdirectories were missing.
- Architecture impact: None. This is a runtime bootstrap correction inside the existing Docker Compose deployment path.
- Migration or deployment impact: Rebuilt and restarted the VPS containers. The public homepage now responds with `200 OK` through `https://optidx.syreon.me/`.
- Follow-up notes: No further action required unless the storage layout or Laravel view cache configuration changes again.

## 2026-04-26 - OptiDx VPS deployment verified

- Summary: Deployed the OptiDx Docker Compose stack to `/opt/optidx/web` on the VPS, rebuilt the app, queue, and scheduler containers, and verified both the local origin on `127.0.0.1:8082` and the public `https://optidx.syreon.me/api/health` endpoint through Cloudflare Tunnel.
- Files or modules affected: `web/Dockerfile`, `web/docker-compose.yml`, `web/docker/entrypoint.sh`, `web/.dockerignore`, VPS runtime under `/opt/optidx/web`.
- Reason for the change: The host needed a working containerized origin so the shared tunnel could serve OptiDx without conflicting with the other site on the same VPS.
- Architecture impact: The production deployment path is now live, containerized, and tunnel-backed, with a queue worker and scheduler running alongside the web container.
- Migration or deployment impact: `docker compose up -d --build` completed successfully on the VPS, the app now listens on `127.0.0.1:8082`, and `optidx.syreon.me` returns `200 OK` from `/api/health`.
- Follow-up notes: The only remaining operational refinement is a small scripted deployment helper for repeat releases.

## 2026-04-26 - OptiDx Docker Compose runtime on port 8082

- Summary: Added a production Docker Compose stack for the `web/` app, including a PHP 8.3 CLI runtime image, a Vite asset build stage, a queue worker service, an entrypoint that creates the SQLite database file and runs migrations, and a `.dockerignore` tuned for server builds.
- Files or modules affected: `web/Dockerfile`, `web/docker-compose.yml`, `web/docker/entrypoint.sh`, `web/.dockerignore`, `ARCHITECTURE.md`, `README.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The live OptiDx hostname needs a dedicated containerized origin on host port `8082` so it can coexist with the other Syreon site behind the shared Cloudflare tunnel.
- Architecture impact: The VPS deployment path now has an explicit container boundary, a dedicated queue worker, and a repeatable startup path that matches the tunnel ingress target.
- Migration or deployment impact: `docker compose up -d --build` in `web/` now builds the app image and exposes it on `8082`. The container will run migrations on first boot unless `RUN_MIGRATIONS=0` is set.
- Follow-up notes: The server still needs a verified runtime launch and health check in a live VPS session.

## 2026-04-26 - Shared Cloudflare tunnel deployment for OptiDx

- Summary: Replaced the direct `optidx.syreon.me` A record with a proxied CNAME to the existing Cloudflare tunnel, added an `optidx.syreon.me -> http://127.0.0.1:8082` ingress to the shared tunnel alongside the existing `journalrecommendation.syreon.me -> http://127.0.0.1:8081` route, and documented the shared-tunnel deployment model in the project README and architecture notes.
- Files or modules affected: `ARCHITECTURE.md`, `README.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`, Cloudflare DNS and tunnel configuration for the `Main` account.
- Reason for the change: The VPS already hosts another site on the same machine, so the OptiDx hostname needed to stop pointing at the raw public IP and instead flow through a tunnel-backed origin port that can coexist with the other deployment.
- Architecture impact: The live deployment model is now shared-tunnel based, with hostname routing handled by Cloudflare and the OptiDx origin isolated behind `127.0.0.1:8082` rather than a public port.
- Migration or deployment impact: Cloudflare DNS and tunnel config were updated in place. The VPS still needs the OptiDx service started on `127.0.0.1:8082` for the hostname to serve application traffic.
- Follow-up notes: The remaining bootstrap step is tracked in `FUTURE_TASKS.md` as the VPS container/service definition for OptiDx.

## 2026-04-26 - Optimization grammar expansion and canvas hydration fix

- Summary: Expanded the Laravel optimizer from a narrow pair-only search into a bounded diagnostic grammar covering single-test, serial, parallel, and discordant-referee candidates, ranked the feasible set with a Pareto frontier, preserved node ids when hydrating engine-style pathway payloads into canvas drafts, and replaced the wizard's thin loading state with a fixed orange-accented progress overlay.
- Files or modules affected: `web/app/Services/OptimizationService.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/app.css`, `web/tests/Unit/OptimizationServiceTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer was returning too few candidates, the load-in-canvas action could hydrate to an empty graph when the source payload used keyed node maps, and the run-state UI did not look like a deliberate optimization progress indicator.
- Architecture impact: The optimization service now owns a bounded grammar search plus Pareto ranking, the browser hydration layer now preserves pathway ids when rebuilding canvas drafts from engine-style payloads, and the wizard now presents a proper fixed overlay while the synchronous search is in flight.
- Migration or deployment impact: Rebuild the Laravel app and Vite frontend bundle. No database migration was required.
- Follow-up notes: Verified with `php artisan test --filter=OptimizationServiceTest`, `php artisan test --filter=PathwayApiTest`, `php -l` on touched PHP files, and `npm run build`.

## 2026-04-26 - Parallel-only pathway serialization and live canvas geometry sync

- Summary: Fixed the builder so parallel-member snapshots are written back into the canonical pathway test catalog, which prevents parallel-only graphs from tripping false missing-test validation when the workspace catalog is stale, and updated the canvas to measure rendered port centers and minimap viewport geometry from the live DOM instead of hardcoded offsets.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/canvas.css`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Running a pathway that only contained a parallel block was still producing missing-test validation errors, connector lines were visibly offset from the ports, the ports were still too tightly grouped, the minimap viewport no longer matched the live visible area, and the status ribbon needed to sit below the toolbar on narrower layouts.
- Architecture impact: The canvas now serializes member snapshots into the pathway test catalog so parallel blocks remain evaluable even when the workspace library snapshot lags, the branch renderer anchors edges to measured DOM port centers, the minimap reflects the live pan/zoom window, and the status ribbon is positioned as a lower overlay row instead of competing with the toolbar.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the new canvas geometry, minimap, and serialization behavior are active. No backend or database migration was required.
- Follow-up notes: Verified with `npm run build`.

## 2026-04-26 - Canvas drag snapshot, port spacing, and wheel zoom hardening

- Summary: Reworked canvas drag/drop so a dragged test carries a live snapshot into the canvas, dropped test nodes persist the snapshot data alongside `testId`, parallel blocks start empty instead of seeding invalid placeholder tests, port positions are spaced farther apart and aligned to the rendered circles, and pinch/ctrl zoom is intercepted on the canvas so zoom-in no longer escapes to the whole page.
- Files or modules affected: `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/canvas.css`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Dropped tests were sometimes rendering with missing metadata, the default parallel block members were invalid for the current library, the ports were still too tight, and browser zoom was stealing the canvas pinch gesture on zoom-in.
- Architecture impact: The builder now treats dragged tests as snapshot-bearing objects during authoring, which keeps the visible node metadata stable even when the catalog refresh lags behind the drop interaction.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the new drag snapshot, port geometry, and wheel interception are active. No backend or database migration was required.
- Follow-up notes: Verified with `npm run build`.

## 2026-04-26 - Builder drop grouping, safe path explorer, and breadcrumb navigation

- Summary: Fixed the builder canvas drop coordinate mapping so dropped tests land in the visible stage, added hit-testing so dropping a test onto another test promotes it into a parallel block and dropping onto an existing parallel block adds a member, hardened the Paths panel so missing evaluation metrics no longer white-screen the builder, made the top ribbon breadcrumbs clickable for real back-navigation, and removed the floating design-handoff button from the shell.
- Files or modules affected: `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/Shell.jsx`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/resources/js/optidx/app.css`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The builder was accepting drops but rendering them off the visible stage or not grouping them at all, the path explorer crashed when it tried to render fallback rows without numeric metrics, the breadcrumb ribbon was static text, and the design-handoff affordance was no longer wanted across the site.
- Architecture impact: The canvas now resolves drop targets relative to the actual stage surface, can promote or extend parallel blocks directly from drag-and-drop, and anchors its rendered connection lines to the same visible port geometry used in the CSS.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the stage hit-testing, navigation crumbs, and shell cleanup are active. No backend or database migration was required.
- Follow-up notes: Verified with `npm run build`; the grouping transaction is documented as a low-priority follow-up in `FUTURE_TASKS.md`.

## 2026-04-26 - Wizard test library list now shows all rows

- Summary: Removed the seven-row cap from the project wizard's diagnostic test table so newly added tests remain visible as the library grows.
- Files or modules affected: `web/resources/js/optidx/components/ScreenWizard.jsx`, `CHANGE_LOG.md`.
- Reason for the change: The library was saving new tests correctly, but the table view hid any entries beyond the first seven.
- Architecture impact: None. This is a presentation-only change to the wizard table rendering.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the uncapped list rendering is active. No database migration was required.
- Follow-up notes: If the table becomes too tall in real use, add scrolling or pagination rather than truncating the visible records.

## 2026-04-26 - Seed library id guard for evidence imports

- Summary: Fixed the diagnostic-test persistence path so preset library rows with seed ids like `p-tb-1` are always treated as new records instead of being sent to Laravel as model-bound updates or deletes.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Importing a preset into the project was still failing because the browser tried to update a `DiagnosticTest` model using a fake seed id that does not exist in the database.
- Architecture impact: The test-library persistence path now distinguishes persisted numeric ids from seed-library ids, which keeps evidence imports on the create path and prevents route-model binding errors.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the new id guard is active. No database migration was required.
- Follow-up notes: If future seed data introduces non-numeric persisted ids, the id check should be expanded to match that backend contract.

## 2026-04-26 - Project wizard test CRUD and evidence import fixes

- Summary: Kept the wizard/project naming changes, fixed the preset import modal so it receives the screen setter it needs, preserved the real evidence-test name when importing from the evidence library, and added edit/delete actions to the wizard test table.
- Files or modules affected: `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The evidence import flow still threw a `setScreen is not defined` error, imported rows were being saved under a fallback label instead of the real test name, and the wizard’s three-dot action column was still only decorative.
- Architecture impact: The test-library flow now uses one shared modal-backed persistence path for create, update, import, and delete operations, and the wizard table refreshes itself from the workspace snapshot after CRUD actions.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the modal, evidence import, and row-action behavior are active. No database migration was required.
- Follow-up notes: A few legacy pathway references remain in comments and secondary screens and are tracked as cleanup work in `FUTURE_TASKS.md`.

## 2026-04-26 - Results analysis unique-path weighting and TAT unit fix

- Summary: Reworked the Pathway Analysis results model so the trace view collapses disease-present and disease-absent cohorts into unique human-readable pathways, weights cost and turnaround summaries by path probability, converts mixed turnaround units into hours before aggregation, and falls back to the project prevalence when the evaluation request omits it.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/PathwayGraphService.php`, `optidx_package/optidx/engine.py`, `web/app/Models/Pathway.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The analysis screen was summing mixed turnaround units incorrectly, showing raw alias keys in the trace, weighting cost with raw test values, and dropping prevalence even when the project already had it.
- Architecture impact: Evaluation output now carries a unique-path view model with human-readable labels, probability-weighted cost/TAT summaries, deduped warnings, and prevalence-aware population metrics derived from the project record when needed.
- Migration or deployment impact: Rebuild the Vite frontend bundle and restart/redeploy Laravel so the new results model and prevalence fallback are active. No database migration was required.
- Follow-up notes: Verified with `php artisan test --filter=PathwayApiTest`, `php artisan test --filter=PathwayGraphServiceTest`, and `npm run build`.

## 2026-04-25 - Parallel block duplicate member picker

- Summary: Replaced the parallel-block prompt workflow with a drag-and-drop dropzone plus explicit test dropdowns in the canvas and inspector, allowed the same diagnostic test to be added multiple times in one block, and taught the compiler to alias duplicate member occurrences so they do not collapse into one engine key.
- Files or modules affected: `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/canvas.css`, `web/app/Services/PathwayGraphService.php`, `web/tests/Unit/PathwayGraphServiceTest.php`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Authors needed a clearer way to add tests into a parallel container, and the old duplicate guard prevented the same diagnostic test from being used more than once inside the same block.
- Architecture impact: Parallel blocks now have an explicit UI picker/drop target on the frontend and a canonical backend aliasing step for repeated members so the engine sees each occurrence as a distinct test key while preserving the source test definition.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy/restart Laravel so the new canvas and inspector controls are active. No database migration was required.
- Follow-up notes: Added a regression test for duplicate parallel-member compilation. Run the frontend build and targeted PHP tests before releasing.

## 2026-04-25 - Restore SendGrid mailer and harden CSRF retry

- Summary: Restored the local `web/.env` mailer settings to SendGrid SMTP, mirrored the same default in `web/.env.example`, and added a one-time CSRF refresh/retry path in the shared auth request helper so stale sessions can recover after a restart.
- Files or modules affected: `web/.env`, `web/.env.example`, `web/resources/js/optidx/actions.js`, `ARCHITECTURE.md`, `README.md`, `CHANGE_LOG.md`.
- Reason for the change: The account-creation flow should keep using SendGrid as requested, and the browser auth flow needed a safer recovery path for `419 CSRF token mismatch` errors after local restarts or expired sessions.
- Architecture impact: Preserved the existing Laravel session/auth model and the SendGrid email transport, while making the browser request layer refresh the CSRF token from the app shell when a single retry can safely resolve the mismatch.
- Migration or deployment impact: No database migration. Rebuild the frontend bundle and restart or refresh the Laravel app so the updated request helper and mail settings are active.
- Follow-up notes: If the browser still shows `419` after a hard refresh, inspect the session cookie and `APP_URL`/host pairing before changing the auth flow.

## 2026-04-25 - Local auth mailer switched to log transport

- Summary: Changed the local `web/.env` mailer to `log`, mirrored that default in `web/.env.example`, and documented the local email behavior so registration and password-reset flows do not fail when SendGrid credentials are unavailable.
- Files or modules affected: `web/.env`, `web/.env.example`, `README.md`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Account creation was failing locally because the auth flow attempted to authenticate against SendGrid SMTP with missing or invalid credentials.
- Architecture impact: Kept the auth flow and notification code unchanged, but clarified that local development uses the log transport while deployed environments can still use SMTP.
- Migration or deployment impact: No database migration. Local developers should clear cached config if present and rebuild/restart the Laravel app to pick up the mailer change.
- Follow-up notes: Real email delivery still works by switching `web/.env` back to SMTP and supplying valid SendGrid credentials.

## 2026-04-25 - Required builder endpoints for final pathway outcomes

- Summary: Added required positive and negative terminal endpoints to every builder draft, made new canvas sessions start with those endpoints already placed, prevented those required endpoints from being deleted or retyped, and added an explicit endpoint-creation action for optional positive, negative, or inconclusive terminal nodes.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The builder needed explicit end nodes for considered positive and considered negative outcomes on every pathway, with optional inconclusive endpoints, and those required endpoints needed to exist from the start of authoring without being removable.
- Architecture impact: The frontend canonical graph normalization layer now injects and preserves required terminal roles for the mandatory positive/negative endpoints, while the canvas and inspector enforce the same constraint at the interaction layer.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the updated builder state model and endpoint controls are published. No database migration was required.
- Follow-up notes: `npm run build` and `php artisan test --filter=PathwayApiTest` both passed. Backend-side required-endpoint enforcement is tracked in `FUTURE_TASKS.md`.

## 2026-04-25 - Builder live graph tabs, branch routing, and safer evaluation errors

- Summary: Replaced the Builder's remaining seed-driven `Paths` and `Validate` panel data with live canonical-graph derivation, bound outgoing-branch selectors in the properties panel to real canvas edges, separated the visible output ports for test and parallel nodes, and changed pathway evaluation to return structured validation failures instead of a generic 500 when the graph is invalid.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/canvas.css`, `web/app/Http/Controllers/Api/PathwayController.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Builder was still showing static seed paths and validation findings, outgoing branches in the inspector were dummy placeholders, output ports were visually overlapping, and invalid pathway runs surfaced to the UI as opaque server errors.
- Architecture impact: The Builder side panels now read from live canonical graph state with optional overlay from the latest matching evaluation payload, inspector branch edits now mutate the actual edge graph, and the evaluation controller now enforces a validation boundary before calling the Python bridge.
- Migration or deployment impact: Rebuild the Vite frontend bundle and redeploy Laravel so the updated Builder behavior and `422` evaluation response path are published. No database migration was required.
- Follow-up notes: `php artisan test --filter=PathwayApiTest` and `npm run build` both passed. Full backend-backed live validation is still tracked in `FUTURE_TASKS.md`.

## 2026-04-25 - Hydrate optimization candidates into canvas drafts

- Summary: Added a shared browser-side canvas hydration helper that turns imported pathway records and optimization templates into canvas-ready graphs with layout coordinates, then wired the scenarios and builder screens to use that draft before mounting the canvas.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Optimization results were arriving as engine-style templates, which meant the canvas could not reliably render the selected candidate after clicking load in canvas.
- Architecture impact: Established a browser hydration boundary for engine-style pathway records so optimization output and saved imported pathways are converted into builder-friendly canvas graphs before they reach the editor.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the new hydration logic is published. No backend or database migration was required.
- Follow-up notes: `npm run build` and `php artisan test --filter PathwayApiTest` both passed. The compare screen still targets the first live suggestion, which remains tracked in `FUTURE_TASKS.md`.

## 2026-04-25 - Auth login and home-screen blank-page fix

- Summary: Fixed the login controller so verified users are resolved from the authenticated guard after `Auth::attempt()`, and hardened the authenticated home screen so persisted pathway cards no longer crash when summary metrics are missing.
- Files or modules affected: `web/app/Http/Controllers/AuthController.php`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/tests/Feature/AuthFlowTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Verified login was being misclassified during the same request, and the workspace home was dereferencing missing `cost`/`sens`/`spec` fields from persisted pathway records, which produced the white-screen behavior after login.
- Architecture impact: The auth flow now treats the guard-backed user as authoritative inside the login request, and the workspace home now tolerates partially populated pathway records instead of assuming every record already has evaluation metrics.
- Migration or deployment impact: None.
- Follow-up notes: Added a regression test for verified logins and documented the remaining opportunity to persist hydrated pathway summary fields for the home screen.

## 2026-04-25 - Fix optimization endpoint 500 on completion

- Summary: Batched optimization candidate evaluation into a single Python bridge call, pruned sample-ineligible tests before template generation, and lifted the request time ceiling for `/api/pathways/optimize` so the run no longer dies at the finish line with a 500.
- Files or modules affected: `optidx_package/optidx/cli.py`, `web/app/Services/PythonEngineBridge.php`, `web/app/Services/OptimizationService.php`, `web/app/Http/Controllers/Api/PathwayController.php`, `web/tests/Unit/OptimizationServiceTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer was still spawning a new Python process for every candidate and tripping PHP's default execution limit during the final stage of the request.
- Architecture impact: Preserved the synchronous optimize flow but changed it from per-candidate bridge invocations to one batched Python evaluation pass, with early sample-type filtering on the Laravel side.
- Migration or deployment impact: Rebuild and redeploy the Laravel app and Python package so the new CLI action and batched bridge path are available. No database migration was required.
- Follow-up notes: The optimizer still runs inside one HTTP request, so the queued/workflow runner in `FUTURE_TASKS.md` remains relevant for larger libraries.

## 2026-04-25 - Fix full-bleed top bar stretching

- Summary: Changed the full-bleed frame so Builder and Report keep an intrinsic-height top bar while only the body fills the remaining space, which removes the large blank band above those screen headers.
- Files or modules affected: `web/resources/js/optidx/app.css`, `web/resources/js/optidx/components/Shell.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Builder/Canvas and Report preview were still rendering with a tall blank area because the full-bleed shell was stretching the top bar as a flex-growing child.
- Architecture impact: Preserved the shared shell contract but made the full-bleed frame explicitly two-part: top bar plus expandable content area.
- Migration or deployment impact: Rebuild the Vite frontend bundle so the updated shell layout is published. No backend or database changes were required.
- Follow-up notes: Re-run browser validation on Builder and Report preview after reload; if either screen still leaves space, inspect the screen-local wrapper rather than the shared shell.

## 2026-04-25 - Remove unused shell row

- Summary: Removed the unused middle grid track from the authenticated shell and simplified the frame wrapper so each screen renders directly inside `app__main`, which eliminates the blank band above the page header.
- Files or modules affected: `web/resources/js/optidx/app.css`, `web/resources/js/optidx/components/Shell.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: Browser inspection showed the empty space was caused by an unused shell row, while the screen top bars were already being rendered inside the main content flow.
- Architecture impact: Aligned the shell grid with the real DOM structure and made the authenticated app a two-row layout: beta banner plus content area.
- Migration or deployment impact: Rebuild the Vite frontend bundle to publish the updated shell structure. No backend or database changes were required.
- Follow-up notes: Recheck Home and Results after reload; if a specific page needs extra vertical rhythm, add it locally rather than restoring a reserved shell row.

## 2026-04-25 - Restore shell top band to 48px

- Summary: Restored the shared app shell middle grid row to `48px` so the top bar has the intended breathing room instead of the over-tight `32px` band.
- Files or modules affected: `web/resources/js/optidx/app.css`, `CHANGE_LOG.md`.
- Reason for the change: The previous compaction fixed the visible gap, but the shell should keep the original 48px top-band sizing for the authenticated layout.
- Architecture impact: Preserved the three-row shell structure and adjusted only the shared row height used by all authenticated pages.
- Migration or deployment impact: Rebuild the frontend bundle so the updated shell spacing is published. No backend or database changes were required.
- Follow-up notes: Recheck the Home and Results screens after reload to confirm the 48px row keeps the layout visually balanced without reintroducing the large blank band.

## 2026-04-25 - Shell top-band compaction

- Summary: Tightened the shared app shell header row from 40px to 32px and reduced the top-bar padding so the visible blank band under the beta banner collapses on all pages.
- Files or modules affected: `web/resources/js/optidx/app.css`, `CHANGE_LOG.md`.
- Reason for the change: Browser inspection showed the remaining whitespace was still in the shared shell row, not the page body, so the previous top-padding fix was insufficient.
- Architecture impact: Kept the page layout contract unchanged and only adjusted the shared shell dimensions inherited by all authenticated screens.
- Migration or deployment impact: Rebuild the frontend bundle after deployment. No backend or database changes were required.
- Follow-up notes: Recheck the Results and Home screens after the rebuild; if any content feels cramped, adjust that screen locally instead of expanding the global shell row again.

## 2026-04-25 - Shared top bar compaction

- Summary: Reduced the shared app shell top row from 48px to 40px and tightened the top-bar padding so the breadcrumb/action strip no longer leaves an oversized blank band above the page content.
- Files or modules affected: `web/resources/js/optidx/app.css`, `CHANGE_LOG.md`.
- Reason for the change: The first spacing fix removed page-body inset, but the visible empty band was still coming from the shared shell row height above the main content area.
- Architecture impact: Kept the shell structure intact and adjusted only the shared header sizing that all page-based screens inherit.
- Migration or deployment impact: Rebuild the Vite frontend bundle to publish the updated shell spacing. No backend or database changes were required.
- Follow-up notes: If any page now feels too tight, the local screen wrapper should add spacing intentionally rather than restoring a larger global shell row.

## 2026-04-25 - Shared page top spacing fix

- Summary: Reduced the shared `.page` wrapper top padding so the main content starts flush under the screen top bar instead of leaving a visible empty band on Results, Home, and other page-based screens.
- Files or modules affected: `web/resources/js/optidx/app.css`, `CHANGE_LOG.md`.
- Reason for the change: Multiple screens were showing an unnecessary gap above the main content area because the shared page wrapper always injected a fixed top inset.
- Architecture impact: Kept the shell layout intact and adjusted only the shared page spacing contract used by the page-based screens.
- Migration or deployment impact: Rebuild the Vite frontend bundle to pick up the stylesheet change. No backend or database changes were required.
- Follow-up notes: If any individual page needs extra breathing room later, it should opt in locally rather than reintroducing a global offset in the shared wrapper.

## 2026-04-25 - Live workspace bootstrap and real report exports

- Summary: Added authenticated workspace bootstrap for pathways, diagnostic tests, and scoped settings; wired persisted pathway open/duplicate/evaluate flows to preserve record identity; added scoped settings persistence; and replaced report text downloads with server-generated PDF and DOCX exports.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Http/Controllers/Api/SettingsController.php`, `web/database/migrations/2026_04_25_000180_scope_settings_by_key.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenReport.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Several visible UI actions still behaved like a mockup, and workspace/report behavior needed to use persisted records instead of seed fallbacks.
- Architecture impact: Established the browser workspace snapshot as the first-class source of truth for loaded pathways/tests/settings, preserved pathway record identity during evaluation, and moved report export to a real backend file-generation path.
- Migration or deployment impact: Added a settings-scoping migration to replace the legacy key-only uniqueness constraint with `scope + key`. Rebuild the Laravel app and frontend bundle after deployment.
- Follow-up notes: Frontend and backend validation still need to be rerun after these edits; report formatting is functional but intentionally minimal and remains on the future-task list.

## 2026-04-25 - Live pathway evaluation results binding

- Summary: Rewired the Builder run action to call the live evaluation endpoint, stored the returned evaluation payload in shared browser state, and updated the Results and Trace screens to render from that latest run instead of the bundled seed fixture.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: Different pathways were still showing the same static TB example because the result screens were reading `window.SEED_RESULTS` rather than the latest evaluated pathway.
- Architecture impact: Introduced a browser-side evaluation view cache (`window.OptiDxLatestEvaluationResult` / `window.OptiDxLatestEvaluationView`) so the UI can reflect the current run without re-deriving metrics on the client.
- Migration or deployment impact: Rebuild the Vite frontend bundle. No database migration was required.
- Follow-up notes: Frontend build and backend tests still need to be rerun after this change; the result screens retain a seed fallback only until the first evaluation runs in the current session.

## 2026-04-25 - Optimization timeout and progress UI polish

- Summary: Reduced optimizer candidate permutations by generating pair templates only once per unordered test pair, added a live animated optimization bar with a single current-action message, and removed the static step checklist and marketing text from the wizard overlay.
- Files or modules affected: `web/app/Services/OptimizationService.php`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/css/optidx/app.css`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer was still timing out on the full seed library because mirrored pair permutations made the synchronous run exceed PHP's 30-second limit, and the overlay felt static instead of reflecting the current backend action.
- Architecture impact: Kept optimization synchronous for now but bounded the search space, and shifted the wizard from a stage list to a single live status display that mirrors the current backend step.
- Migration or deployment impact: Rebuild the Laravel app and frontend bundle. No database migration was required.
- Follow-up notes: `php artisan test --filter PathwayApiTest` passed, `php -l` passed on touched PHP/JS files, and a manual full-library optimize run now completes in about 21.5 seconds instead of timing out.

## 2026-04-25 - Optimization payload canonicalization

- Summary: Normalized wizard-sourced optimization test records inside `OptimizationService` so the backend now translates the UI seed shape into the Python engine contract before generating candidate pathways, and added a regression test for the seed-style optimize request.
- Files or modules affected: `web/app/Services/OptimizationService.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The optimizer was forwarding `sens` / `spec` / `tat` / `sample` / `skill` directly into the Python engine, which caused the `/api/pathways/optimize` request to fail with a 500 when the wizard sent the seed library.
- Architecture impact: Established a backend canonicalization boundary for optimizer inputs so the browser can continue using UI-oriented fixture fields while the engine still receives the canonical pathway/test schema.
- Migration or deployment impact: Rebuild the Laravel app and rerun the web test suite; no database migration was required.
- Follow-up notes: `php artisan test --filter PathwayApiTest` and `php -l` on the touched PHP files both passed.

## 2026-04-25 - Canonical pathway graph serializer and hydration

- Summary: Replaced the Builder save/import/export path with a canonical pathway graph flow, added backend canonicalization and hydration through `PathwayGraphService`, taught the canvas to load imported pathway graphs back into the editor, and kept legacy engine-shaped pathway payloads working for API compatibility.
- Files or modules affected: `web/app/Http/Controllers/Api/PathwayController.php`, `web/app/Services/PathwayGraphService.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/data.js`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Builder still relied on a pragmatic live-canvas snapshot, which risked drift between the visual editor, saved records, imports, and the backend engine contract.
- Architecture impact: Established a canonical graph boundary between the browser and Laravel, with the backend owning graph canonicalization/engine compilation and the frontend owning serialization/hydration of the visible canvas state.
- Migration or deployment impact: Rebuilt the Vite frontend bundle. No database migration was required.
- Follow-up notes: `npm run build` and `php artisan test --filter PathwayApiTest` both passed after the change. The old engine-shaped pathway payloads still validate and evaluate for compatibility.

## 2026-04-25 - Builder canvas routing and optimization wiring

- Summary: Fixed the Builder canvas so single-test nodes no longer show parallel-only presets, branch ports now render as distinct outcome anchors, the optimization wizard calls the Laravel optimizer endpoint with a visible running overlay, save/export use the live canvas snapshot, and several formerly dead builder actions now perform real local behavior.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/css/optidx/app.css`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Builder still had mock actions, ambiguous branch routing, and a non-functional optimization flow, which made the canvas feel unfinished and hard to understand.
- Architecture impact: Introduced a browser-side canvas snapshot boundary for save/export, centralized optimization orchestration in the shared action helper, and documented the runtime path from the wizard into `/api/pathways/optimize` and back into the scenarios screen.
- Migration or deployment impact: Rebuilt the Vite frontend bundle. No database migration or backend schema change was required.
- Follow-up notes: `npm run build` and `php artisan test --filter PathwayApiTest` both passed. The current canvas save path persists a pragmatic visual snapshot; the canonical graph serializer/deserializer remains on the future-task list.

## 2026-04-25 - Chrome password manager hints for auth forms

- Summary: Added explicit `name` and `autocomplete` attributes to the login and registration inputs so browsers can correctly identify the password fields and offer saved/strong password suggestions during account creation.
- Files or modules affected: `web/resources/js/optidx/components/ScreenAuth.jsx`, `CHANGE_LOG.md`.
- Reason for the change: The registration password field rendered visually as a password input, but Chrome was not treating it as a discoverable password-creation field.
- Architecture impact: None; this is a frontend form metadata fix that preserves the existing auth flow and backend contract.
- Migration or deployment impact: None beyond rebuilding the frontend assets.
- Follow-up notes: Verified with `npm run build` in `web/`.

## 2026-04-25 - SendGrid sender and host alignment

- Summary: Aligned the mail sender address with the project domain, switched the local app URL to `127.0.0.1:8000`, and cleared cached config so verification links and SendGrid delivery work correctly in the live browser flow.
- Files or modules affected: `web/.env`, `web/.env.example`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The sign-in flow was reaching SendGrid but failing on sender identity and signed URL host mismatches during end-to-end verification.
- Architecture impact: Reinforced that the auth verification flow depends on a consistent app URL and a verified sender identity rather than a generic placeholder mail address.
- Migration or deployment impact: None for production code, but local browser verification now depends on the app being served from `127.0.0.1:8000` during development.
- Follow-up notes: Verified the full loop in browser after the change. Anonymous loads still return the expected 401 from `/auth/me`, but verified sign-in now lands on the home screen without runtime or mailer errors.

## 2026-04-25 - Web bootstrap compatibility fix

- Summary: Fixed the browser boot path so the Vite entry loads the shared Axios bootstrap before mounting the React shell, exposed the React hooks expected by the legacy component modules, and updated the app name metadata so the page title resolves to OptiDx instead of the Laravel default.
- Files or modules affected: `web/resources/js/app.js`, `web/.env`, `web/.env.example`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The live home page was mounting into the shell but failing runtime checks because the bootstrap layer was not imported and some legacy JSX modules still relied on React symbols being available during boot.
- Architecture impact: Formalized the browser boot sequence as part of the frontend application boundary and documented the temporary compatibility shim used while the legacy component modules are being normalized.
- Migration or deployment impact: None beyond rebuilding the Vite assets; the page title now uses `OptiDx` from the local env config.
- Follow-up notes: Verified in browser after the fix. The app now renders the auth shell without React/useState runtime errors, and the only console warning on anonymous load is the expected 401 from `/auth/me`.

## 2026-04-25 - Functional UI shell and SendGrid auth flow

- Summary: Wired the React shell buttons to real local actions where possible, added a shared browser action helper, implemented Laravel session auth with email verification and password reset flows, and configured SMTP mail delivery through SendGrid for verification/reset notifications.
- Files or modules affected: `web/resources/js/app.js`, `web/resources/js/bootstrap.js`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenAuth.jsx`, `web/resources/js/optidx/components/ScreenHome.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenReport.jsx`, `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/resources/js/optidx/components/PropertiesPanel.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/app/Http/Controllers/AuthController.php`, `web/app/Models/User.php`, `web/app/Notifications/VerifyEmailNotification.php`, `web/app/Notifications/ResetPasswordNotification.php`, `web/config/services.php`, `web/.env`, `web/.env.example`, `web/routes/web.php`, `web/tests/Feature/AuthFlowTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`.
- Reason for the change: The UI was still functioning like a mockup in several areas, and the app needed a real authentication and notification path for registration, verification, and forgot-password workflows.
- Architecture impact: Added a session-backed auth layer to the Laravel shell, made email verification mandatory for new accounts, and centralized repetitive browser actions into a shared helper so component-level buttons can reuse the same download/copy/notification primitives.
- Migration or deployment impact: SendGrid SMTP configuration is now required for production email delivery; the current report export buttons still use browser-generated text downloads until a server-side DOCX/PDF pipeline is added.
- Follow-up notes: Feature tests cover registration, verification, password reset, and `/auth/me`; external SendGrid delivery was configured but not fully exercised against a live mailbox in this turn.

## 2026-04-25 - README screenshot refresh

- Summary: Replaced the placeholder prototype imagery in the top-level README with live screenshots captured from the running OptiDx web tool, including auth, home, wizard, builder, and results states.
- Files or modules affected: `README.md`, `docs/screenshots/auth.png`, `docs/screenshots/home.png`, `docs/screenshots/wizard.png`, `docs/screenshots/builder.png`, `docs/screenshots/results.png`.
- Reason: The README needed to reflect the actual application rather than a screenshot from the unrelated UI prototype.
- Architecture impact: None; documentation and asset refresh only.
- Migration or deployment impact: None.
- Follow-up notes: Regenerate the screenshots if the web UI changes materially.

## 2026-04-25 - Initial web productization slice

- Summary: Started the Laragon-compatible web application scaffold for OptiDx, documented the architecture baseline, and implemented the first functional Laravel/React/Python integration slice.
- Files or modules affected: `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`, `web/`, `optidx/`, `optidx_package/optidx/`, `optidx_package/tests/`, `conftest.py`.
- Reason: The repo previously contained only the Python engine package and a UI prototype; the web app boundary needed to be defined and then made executable.
- Architecture impact: Established Laravel 12 + React + Python engine bridge as the working productization direction, with the UI V2 prototype copied into the Laravel Vite app and the canonical Python engine exposed through a module CLI bridge.
- Migration or deployment impact: Added Laravel migrations for projects, diagnostic tests, pathways, evaluation results, optimization runs, reports, benchmark cases, and settings. The Laragon web app now builds through Vite and the canonical engine can be called from Laravel.
- Follow-up notes: Frontend and backend smoke tests pass; remaining work is deeper optimization search, richer report exports, and offline/browser-side evaluation parity.

## 2026-04-25 - Functional web slice

- Summary: Added the OptiDx Laravel shell, imported the Syreon UI V2 styles/components, created API endpoints, wired the Python bridge, and added bridge-backed feature tests.
- Files or modules affected: `web/resources/js/app.js`, `web/resources/views/app.blade.php`, `web/routes/api.php`, `web/bootstrap/app.php`, `web/app/Services/*`, `web/app/Http/Controllers/Api/*`, `web/database/migrations/*`, `web/tests/Feature/PathwayApiTest.php`, `optidx_package/optidx/engine.py`, `optidx_package/optidx/cli.py`.
- Reason: The product needed a real boot path, persisted schema, and end-to-end validation/evaluation flow instead of only a plan.
- Architecture impact: Added a Laravel validation layer in front of the canonical Python engine and made the UI V2 prototype compile as a React/Vite app within Laravel.
- Migration or deployment impact: Frontend build output is generated under `web/public/build`; PHPUnit and `pytest` now cover the new API and engine behavior.
- Follow-up notes: Optimization currently uses a bounded template generator; PDF/report export is still HTML-first.

## 2026-04-25 - Project README refresh

- Summary: Replaced the generic Laravel README with a project-level OptiDx README that includes the Syreon logo, a UI preview, stack summary, local run steps, and documentation maintenance rules.
- Files or modules affected: `README.md`, `web/README.md`, `CHANGE_LOG.md`.
- Reason: The project needed a branded top-level README that reflects the actual OptiDx web tool instead of the default Laravel boilerplate.
- Architecture impact: None; documentation only.
- Migration or deployment impact: None.
- Follow-up notes: Keep the README updated whenever the `web/` app changes materially.
## 2026-04-26 - Named optimization buckets and endpoint-safe canvas imports

- Summary: Added derived optimizer metrics and fixed named scenario buckets to the optimize API, rewired engine-style positive/negative finals onto the required canvas endpoints during import, updated the scenarios screen to render named buckets plus a sortable feasible-candidate table, and moved the canvas minimap to the bottom-right above the legend.
- Files or modules affected: `web/app/Services/OptimizationService.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/canvas.css`, `web/tests/Unit/OptimizationServiceTest.php`, `web/tests/Feature/PathwayApiTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Run step was still using placeholder scenario ranking logic, generated pathways were loading with dummy terminal nodes instead of the required considered-positive/considered-negative endpoints, and the minimap was overlapping the canvas status ribbon.
- Architecture impact: Promoted optimizer-derived metrics to a first-class API contract for the scenarios screen, and formalized a frontend import-normalization step that rewrites generated terminal endpoints onto the builder's required endpoint model before layout.
- Migration or deployment impact: Rebuild the Laravel frontend bundle and rerun the Laravel test suite. No database migration was required.
- Follow-up notes: Validation was rerun after the change; metric help text remains on the future-task list.
## 2026-04-26 - Account profile, logout, delete-account, and optimization trust UX

- Summary: Added persistent user-profile fields and auth profile endpoints, replaced the static Sara placeholders with live account data in the settings/profile UI, exposed logout and permanent-delete actions in the shell, and changed the wizard optimization overlay to hold a deliberate 30-second minimum visible progress experience on fast runs.
- Files or modules affected: `web/app/Http/Controllers/AuthController.php`, `web/app/Models/User.php`, `web/database/migrations/2026_04_26_000200_add_profile_fields_to_users_table.php`, `web/database/factories/UserFactory.php`, `web/routes/web.php`, `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenAuth.jsx`, `web/resources/js/optidx/components/ScreenExtras.jsx`, `web/resources/js/optidx/components/ScreenWizard.jsx`, `web/tests/Feature/AuthFlowTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`.
- Reason for the change: The auth shell was still using placeholder identity values, logout was not surfaced in the UI, account deletion was missing, and the optimization progress card could finish so quickly that it looked like a stub rather than a real calculation.
- Architecture impact: Established the signed-in user as shared browser state, added a structured profile contract on the Laravel user row, introduced logout/delete session cleanup helpers, and documented the 30-second optimization pacing plus preserved-record deletion semantics.
- Migration or deployment impact: Requires the new `users` profile-field migration and a fresh frontend build. The auth feature tests and production Vite build both passed after the change.
- Follow-up notes: Account deletion preserves workspace records by nulling ownership, so the admin reassignment workflow remains a future task.

## 2026-04-26 - Remove remaining Sara preview placeholders

- Summary: Replaced the last hard-coded Sara team-member references in the workspace preview card with the authenticated user so the live bundle no longer ships stale placeholder identity data.
- Files or modules affected: `web/resources/js/optidx/components/ScreenExtras.jsx`, `CHANGE_LOG.md`.
- Reason for the change: The deployed build still contained a visible Sara placeholder in the team preview section, which made the live site appear unchanged even after the broader auth/profile deployment.
- Architecture impact: None beyond keeping the settings/profile shell aligned with the shared `currentUser` state already introduced in the earlier auth/profile slice.
- Migration or deployment impact: Requires another frontend rebuild and redeploy of the Laravel app image.
- Follow-up notes: No schema or API changes were needed.

## 2026-04-26 - Remove duplicate registration verification notification

- Summary: Removed the extra direct `sendEmailVerificationNotification()` call from the registration controller so account creation now dispatches the `Registered` event once and lets Laravel's built-in verification listener send the initial email.
- Files or modules affected: `web/app/Http/Controllers/AuthController.php`, `web/tests/Feature/AuthFlowTest.php`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The registration path was sending the verification email twice, which made the flow fragile and could surface as a server error for recipients that were less tolerant of duplicate messages.
- Architecture impact: Clarified that the framework event listener owns the first verification email, while the controller only creates the account and dispatches the event.
- Migration or deployment impact: Requires a PHP code deploy and a frontend/backend test pass only; no schema migration.
- Follow-up notes: The auth feature test now asserts that registration emits exactly one verification notification.
## 2026-04-27 - Sanitize shared workspace state and legacy screen fallbacks

- Summary: Fixed the shared workspace snapshot helper so array and index fields are always normalized last, and hardened the legacy trace/compare/evidence/results screens so missing seed collections fall back to empty arrays or stub objects instead of throwing during render.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `ARCHITECTURE.md`, `CHANGE_LOG.md`.
- Reason for the change: The same workspace render error was appearing across multiple screens, which pointed to a shared state/seed hydration issue rather than a single view bug.
- Architecture impact: Elevated `setWorkspaceSnapshot()` to the canonical boundary for workspace collection normalization and removed the last unsafe seed-fallback assumptions from the shared legacy screens.
- Migration or deployment impact: Requires only a frontend rebuild/redeploy; no schema or backend changes were introduced.
- Follow-up notes: A separate future task still tracks canonical repair of historical optimization payloads at rest.

## 2026-04-27 - Harden optimization history for legacy infeasible runs

- Summary: Normalized legacy optimization-history rendering so older infeasible runs with `selected_outputs` keys mapped to `null` no longer crash the stored-run detail or scenarios path when reopened from history.
- Files or modules affected: `web/resources/js/optidx/actions.js`, `web/resources/js/optidx/components/ScreenOther.jsx`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The Builder/runtime crash moved to optimization history because historical infeasible runs were persisted with partial fixed-objective payloads that the frontend treated like complete scenario records.
- Architecture impact: Formalized a frontend compatibility rule that historical optimization payloads must be normalized into explicit non-feasible placeholders before any history or scenario screen renders them.
- Migration or deployment impact: Requires a frontend rebuild/redeploy only; no schema migration was added in this fix.
- Follow-up notes: A future repair task was added to canonicalize the legacy `optimization_runs` payloads at rest and remove the need for long-term compatibility branches.
