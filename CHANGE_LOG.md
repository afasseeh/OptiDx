# Change Log

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
