<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DiagnosticTest;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiagnosticTestController extends Controller
{
    public function index()
    {
        return DiagnosticTest::query()->latest()->get();
    }

    public function store(Request $request)
    {
        $userId = $request->user()?->id;
        $data = $request->validate([
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(fn ($query) => $query->where('created_by', $userId)),
            ],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'sensitivity' => ['required', 'numeric', 'between:0,1'],
            'specificity' => ['required', 'numeric', 'between:0,1'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'turnaround_time' => ['nullable', 'numeric', 'min:0'],
            'turnaround_time_unit' => ['nullable', 'string', 'max:16'],
            'sample_types' => ['nullable', 'array'],
            'skill_level' => ['nullable', 'integer', 'min:0', 'max:5'],
            'threshold' => ['nullable', 'string', 'max:255'],
            'availability' => ['nullable', 'boolean'],
            'capacity_limit' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'provenance' => ['nullable', 'array'],
            'joint_probabilities' => ['nullable', 'array'],
            'conditional_probabilities' => ['nullable', 'array'],
        ]);

        return response()->json(DiagnosticTest::create($data), 201);
    }

    public function show(DiagnosticTest $test)
    {
        return $test;
    }

    public function update(Request $request, DiagnosticTest $test)
    {
        $userId = $request->user()?->id;
        $data = $request->validate([
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(fn ($query) => $query->where('created_by', $userId)),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'sensitivity' => ['nullable', 'numeric', 'between:0,1'],
            'specificity' => ['nullable', 'numeric', 'between:0,1'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'turnaround_time' => ['nullable', 'numeric', 'min:0'],
            'turnaround_time_unit' => ['nullable', 'string', 'max:16'],
            'sample_types' => ['nullable', 'array'],
            'skill_level' => ['nullable', 'integer', 'min:0', 'max:5'],
            'threshold' => ['nullable', 'string', 'max:255'],
            'availability' => ['nullable', 'boolean'],
            'capacity_limit' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
            'provenance' => ['nullable', 'array'],
            'joint_probabilities' => ['nullable', 'array'],
            'conditional_probabilities' => ['nullable', 'array'],
        ]);

        $test->update($data);

        return $test->refresh();
    }

    public function destroy(DiagnosticTest $test)
    {
        $test->delete();

        return response()->noContent();
    }
}
