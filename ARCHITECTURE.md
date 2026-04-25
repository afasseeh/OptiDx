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

The UI must preserve the Syreon orange/charcoal language, Carlito/Open Sans typography, and the workflow-builder visual style from UI V2.

### Laravel Backend

The backend owns:

- project, pathway, evidence, report, and settings persistence
- schema validation
- API responses
- optimization orchestration
- report generation jobs
- bridge calls to the Python evaluator

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

Current bridge shape:

- `web/app/Services/PythonEngineBridge.php` executes `python -m optidx_package.optidx.cli`
- `optidx_package/optidx/cli.py` loads canonical engine payloads, evaluates them, and returns JSON
- `web/app/Services/PathwayDefinitionService.php` performs Laravel-side graph validation before evaluation

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
