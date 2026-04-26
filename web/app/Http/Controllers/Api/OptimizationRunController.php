<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OptimizationRun;

class OptimizationRunController extends Controller
{
    public function show(OptimizationRun $optimizationRun)
    {
        return $optimizationRun;
    }
}
