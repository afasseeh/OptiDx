<?php

use App\Http\Controllers\Api\BenchmarkController;
use App\Http\Controllers\Api\DiagnosticTestController;
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

Route::post('pathways/validate', [PathwayController::class, 'validatePathway']);
Route::post('pathways/evaluate', [PathwayController::class, 'evaluate']);
Route::post('pathways/optimize', [PathwayController::class, 'optimize']);
Route::post('pathways/import', [PathwayController::class, 'import']);
Route::get('pathways/{pathway}/export/json', [PathwayController::class, 'exportJson']);
Route::get('pathways/{pathway}/export/report', [PathwayController::class, 'exportReport']);

Route::apiResource('projects', ProjectController::class);
Route::apiResource('pathways', PathwayController::class);

Route::prefix('evidence')->group(function () {
    Route::apiResource('tests', DiagnosticTestController::class);
});

Route::get('benchmarks', [BenchmarkController::class, 'index']);
Route::post('benchmarks/run', [BenchmarkController::class, 'run']);

Route::get('settings', [SettingsController::class, 'index']);
Route::put('settings', [SettingsController::class, 'update']);
