<?php

namespace App\Jobs;

use App\Models\OptimizationRun;
use App\Services\OptimizationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExecuteOptimizationRun implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 0;

    public function __construct(public readonly int $optimizationRunId)
    {
    }

    public function handle(OptimizationService $optimizationService): void
    {
        $run = OptimizationRun::query()->find($this->optimizationRunId);
        if (! $run || ! in_array($run->status, ['queued', 'running'], true)) {
            return;
        }

        try {
            $optimizationService->recordRunStart($run);

            $payload = $run->input_payload ?? [];
            $result = $optimizationService->optimize(
                $payload['tests'] ?? [],
                $payload['constraints'] ?? [],
                $payload['constraints']['prevalence'] ?? null,
                $payload['search_config'] ?? []
            );

            $optimizationService->recordRunResult($run, $result);
        } catch (\Throwable $throwable) {
            $optimizationService->recordRunFailure($run, $throwable);
            throw $throwable;
        }
    }
}
