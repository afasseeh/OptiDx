<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OptimizationRun;
use Illuminate\Http\Request;

class OptimizationRunController extends Controller
{
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
}
