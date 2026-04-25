# Change Log

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
