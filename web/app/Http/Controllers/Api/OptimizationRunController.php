<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OptimizationRun;
use App\Services\OptimizationService;
use Illuminate\Http\Request;

class OptimizationRunController extends Controller
{
    public function index(Request $request)
    {
        $query = OptimizationRun::query()
            ->where('created_by', $request->user()?->id)
            ->with(['project:id,title'])
            ->latest('id');

        if ($projectId = $request->integer('project_id')) {
            $query->where('project_id', $projectId);
        }

        if ($request->boolean('terminal', false)) {
            $query->whereIn('status', ['success', 'infeasible', 'no_feasible_found_time_limit', 'failed', 'cancelled']);
        }

        $limit = max(1, min(100, (int) $request->integer('limit', 25)));

        $runs = $query->limit($limit)->get()->map(function (OptimizationRun $run): array {
            $resultPayload = is_array($run->result_payload ?? null) ? $run->result_payload : [];
            $selectedOutputs = is_array($resultPayload['selected_outputs'] ?? null) ? $resultPayload['selected_outputs'] : [];

            return [
                'id' => $run->id,
                'project_id' => $run->project_id,
                'project_name' => $run->project?->title,
                'run_mode' => $run->run_mode,
                'status' => $run->status,
                'progress_percent' => $run->progress_percent,
                'progress_stage' => $run->progress_stage,
                'progress_message' => $run->progress_message,
                'candidate_count' => $run->candidate_count,
                'feasible_count' => $run->feasible_count,
                'search_exhaustive' => $run->search_exhaustive,
                'failure_reason' => $run->failure_reason,
                'message' => $resultPayload['message'] ?? $run->failure_reason ?? null,
                'status_message' => $resultPayload['message'] ?? $run->failure_reason ?? $run->progress_message ?? null,
                'selected_output_count' => count($selectedOutputs),
                'selected_output_keys' => array_keys($selectedOutputs),
                'created_at' => $run->created_at,
                'started_at' => $run->started_at,
                'completed_at' => $run->completed_at,
                'cancelled_at' => $run->cancelled_at,
                'updated_at' => $run->updated_at,
                'has_result' => ! empty($resultPayload),
            ];
        });

        return response()->json([
            'data' => $runs->values(),
            'meta' => [
                'count' => $runs->count(),
                'limit' => $limit,
            ],
        ]);
    }

    public function latest(Request $request)
    {
        $query = OptimizationRun::query()
            ->where('created_by', $request->user()?->id)
            ->latest('id');

        if ($projectId = $request->integer('project_id')) {
            $query->where('project_id', $projectId);
        }

        if ($request->boolean('terminal', true)) {
            $query->whereIn('status', ['success', 'infeasible', 'no_feasible_found_time_limit', 'failed']);
        }

        $run = $query->first();

        if (! $run && $request->boolean('terminal', true)) {
            $fallbackQuery = OptimizationRun::query()
                ->where('created_by', $request->user()?->id)
                ->latest('id');

            if ($projectId = $request->integer('project_id')) {
                $fallbackQuery->where('project_id', $projectId);
            }

            $run = $fallbackQuery->first();
        }

        if (! $run) {
            return response()->json([
                'message' => 'No optimization run was found for the current account.',
            ], 404);
        }

        $resultPayload = is_array($run->result_payload ?? null) ? $run->result_payload : [];

        return response()->json([
            ...$run->toArray(),
            ...$resultPayload,
        ]);
    }

    public function show(OptimizationRun $optimizationRun)
    {
        $run = $optimizationRun->load(['project', 'user']);
        $resultPayload = is_array($run->result_payload ?? null) ? $run->result_payload : [];

        return response()->json([
            ...$run->toArray(),
            ...$resultPayload,
        ]);
    }

    public function cancel(Request $request, OptimizationRun $optimizationRun, OptimizationService $optimizationService)
    {
        if ((int) $optimizationRun->created_by !== (int) $request->user()?->id) {
            abort(404);
        }

        $payload = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $run = $optimizationService->cancelRun($optimizationRun, $payload['reason'] ?? null);
        $resultPayload = is_array($run->result_payload ?? null) ? $run->result_payload : [];

        return response()->json([
            ...$run->toArray(),
            ...$resultPayload,
        ]);
    }
}
