<?php

use App\Models\OptimizationRun;
use App\Services\OptimizationService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('optidx:run-optimization {runId}', function (OptimizationService $optimizationService, string $runId): int {
    $run = OptimizationRun::query()->find((int) $runId);
    if (! $run) {
        $this->error("Optimization run {$runId} was not found.");
        return 1;
    }

    try {
        $optimizationService->runOptimizationRun($run);
    } catch (\Throwable $throwable) {
        $failedRun = $optimizationService->recordRunFailure($run, $throwable);
        $optimizationService->notifyCompletionIfNeeded($failedRun);
        $this->error($throwable->getMessage());
        return 1;
    }

    $this->info("Optimization run {$run->id} completed.");

    return 0;
})->purpose('Run a queued OptiDx optimization by id');
