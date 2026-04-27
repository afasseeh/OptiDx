<?php

use App\Http\Controllers\Api\BenchmarkController;
use App\Http\Controllers\Api\DiagnosticTestController;
use App\Http\Controllers\Api\OptimizationRunController;
use App\Http\Controllers\Api\PathwayController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\SettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'optidx',
        'time' => now()->toIso8601String(),
    ]);
});

Route::middleware(['web', 'auth'])->group(function () {
    // Workspace data is account-specific, so every persisted resource route
    // runs behind the session-backed auth layer and the browser gets only the
    // rows owned by the current signed-in user.
    Route::post('pathways/validate', [PathwayController::class, 'validatePathway']);
    Route::post('pathways/evaluate', [PathwayController::class, 'evaluate']);
    Route::post('pathways/optimize', [PathwayController::class, 'optimize']);
    Route::post('pathways/import', [PathwayController::class, 'import']);
    Route::get('pathways/{pathway}/export/json', [PathwayController::class, 'exportJson']);
    Route::get('pathways/{pathway}/export/report', [PathwayController::class, 'exportReport']);
    Route::get('optimization-runs/latest', [OptimizationRunController::class, 'latest']);
    Route::get('optimization-runs/{optimizationRun}', [OptimizationRunController::class, 'show']);

    Route::apiResource('projects', ProjectController::class);
    Route::apiResource('pathways', PathwayController::class);

    Route::prefix('evidence')->group(function () {
        Route::apiResource('tests', DiagnosticTestController::class);
    });

    Route::get('settings', [SettingsController::class, 'index']);
    Route::put('settings', [SettingsController::class, 'update']);
});

Route::get('benchmarks', [BenchmarkController::class, 'index']);
Route::post('benchmarks/run', [BenchmarkController::class, 'run']);
