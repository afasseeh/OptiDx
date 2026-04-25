<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index()
    {
        return Project::query()->latest()->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'disease_area' => ['nullable', 'string', 'max:255'],
            'intended_use' => ['nullable', 'string', 'max:255'],
            'target_population' => ['nullable', 'string', 'max:255'],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
            'country' => ['nullable', 'string', 'max:255'],
            'setting' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        return response()->json(Project::create($data), 201);
    }

    public function show(Project $project)
    {
        return $project;
    }

    public function update(Request $request, Project $project)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'disease_area' => ['nullable', 'string', 'max:255'],
            'intended_use' => ['nullable', 'string', 'max:255'],
            'target_population' => ['nullable', 'string', 'max:255'],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
            'country' => ['nullable', 'string', 'max:255'],
            'setting' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        $project->update($data);

        return $project->refresh();
    }

    public function destroy(Project $project)
    {
        $project->delete();

        return response()->noContent();
    }
}

