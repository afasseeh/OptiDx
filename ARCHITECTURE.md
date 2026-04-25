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
- client-side validation feedback
- pathway editor state
- request/response presentation for evaluation and optimization
- browser-side canonical graph serialization and hydration for save/export/import
- orchestration of the optimization run UX while the backend search executes

The UI must preserve the Syreon orange/charcoal language, Carlito/Open Sans typography, and the workflow-builder visual style from UI V2.

### Laravel Backend

The backend owns:

- project, pathway, evidence, report, and settings persistence
- schema validation
- API responses
- user authentication, session state, email verification, and password reset flows
- optimization orchestration
- report generation jobs
- bridge calls to the Python evaluator
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
7. The Builder serializes the live canvas into a canonical pathway graph, and the backend stores and rehydrates that same graph shape so save/export/import stay aligned with the engine contract.
8. The optimization wizard posts the test library and constraints to `/api/pathways/optimize`, then renders the ranked candidates returned by the Laravel optimizer service.
9. The optimizer service normalizes the wizard's UI-shaped test records into the Python engine schema before building candidate templates, so the browser can keep using the compact seed-library field names while the backend preserves the canonical engine contract.

Current bridge shape:

- `web/app/Services/PythonEngineBridge.php` executes `python -m optidx_package.optidx.cli`
- `optidx_package/optidx/cli.py` loads canonical engine payloads, evaluates them, and returns JSON
- `web/app/Services/PathwayDefinitionService.php` performs Laravel-side graph validation before evaluation
- `web/app/Services/PathwayGraphService.php` canonicalizes canvas graphs, hydrates saved graphs back into canvas-ready data, and compiles the engine-facing definition
- `web/app/Services/OptimizationService.php` canonicalizes wizard test-library records into the engine contract, prunes mirrored pair permutations, and then generates/evaluates candidate pathways within the synchronous optimize request
- `web/app/Http/Controllers/AuthController.php` owns the session-backed auth endpoints used by the React shell
- `web/resources/js/app.js` bootstraps the browser runtime with Axios, CSRF/session defaults, and the component registry before mounting the React shell
- `web/resources/js/optidx/actions.js` now owns the shared browser helpers for save, optimize, manual test creation, canonical pathway serialization, import hydration, and canvas export
- `web/resources/js/optidx/components/ScreenCanvas.jsx` keeps the current canvas state mirrored on `window.OptiDxCanvasState` / `window.OptiDxCurrentPathway` so the shell can persist the live builder graph and restore imported canonical graphs

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

## Operational Notes

- Laragon-friendly local setup is the primary deployment target for the first implementation slice.
- Redis is reserved for queueing and transient coordination.
- PostgreSQL remains the preferred long-term system of record, but the Laragon MVP can use MariaDB if needed for local ergonomics.
- Docker should be documented later, but it is not the initial local runtime dependency.
- The browser shell currently uses local file downloads for some export controls; those should be replaced with server-side DOCX/PDF generation when the reporting pipeline is finalized.
- The signed email-verification flow assumes the app URL matches the live dev host. In local development the host is `http://127.0.0.1:8000`, which keeps signed verification links and redirects consistent during browser testing.
- The optimization wizard currently runs synchronously in the browser request/response cycle. The optimizer is intentionally bounded by deduplicating mirrored pair templates, but a queue-backed or workflow-backed runner will be needed if the product needs the earlier sub-3-second UX target at larger test-library sizes.
