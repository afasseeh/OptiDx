<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OptimizationRun;

class OptimizationRunController extends Controller
{
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
