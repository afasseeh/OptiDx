<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BenchmarkCase;
use App\Services\PythonEngineBridge;
use Illuminate\Http\Request;

class BenchmarkController extends Controller
{
    public function index()
    {
        return BenchmarkCase::query()->latest()->get();
    }

    public function run(Request $request, PythonEngineBridge $bridge)
    {
        $data = $request->validate([
            'pathway' => ['required', 'array'],
        ]);

        return response()->json($bridge->benchmark($data['pathway']));
    }
}

