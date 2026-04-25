# Change Log

## 2026-04-26 - Builder drop grouping, safe path explorer, and breadcrumb navigation

- Summary: Fixed the builder canvas drop coordinate mapping so dropped tests land in the visible stage, added hit-testing so dropping a test onto another test promotes it into a parallel block and dropping onto an existing parallel block adds a member, hardened the Paths panel so missing evaluation metrics no longer white-screen the builder, made the top ribbon breadcrumbs clickable for real back-navigation, and removed the floating design-handoff button from the shell.
- Files or modules affected: `web/resources/js/optidx/components/ScreenCanvas.jsx`, `web/resources/js/optidx/components/Shell.jsx`, `web/resources/js/optidx/components/App.jsx`, `web/resources/js/optidx/components/ScreenResults.jsx`, `web/resources/js/optidx/components/ScreenOther.jsx`, `web/resources/js/optidx/app.css`, `ARCHITECTURE.md`, `FUTURE_TASKS.md`, `CHANGE_LOG.md`.
- Reason for the change: The builder was accepting drops but rendering them off the visible stage or not grouping them at all, the path explorer crashed when it tried to render fallback rows without numeric metrics, the breadcrumb ribbon was static text, and the design-handoff affordance was no longer wanted across the site.
- Architecture impact: The canvas now resolves drop targets relative to the actual stage surface and can promote or extend parallel blocks directly from drag-and-drop, while the shell top bar now supports clickable crumb descriptors instead of purely decorative directory text.
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
