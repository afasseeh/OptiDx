# Change Log

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
