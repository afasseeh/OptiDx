<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvaluationResult;
use App\Models\Pathway;
use App\Services\OptimizationService;
use App\Services\PathwayDefinitionService;
use App\Services\PythonEngineBridge;
use Illuminate\Http\Request;

class PathwayController extends Controller
{
    public function __construct(
        private readonly PathwayDefinitionService $definitions,
        private readonly PythonEngineBridge $bridge,
        private readonly OptimizationService $optimizer,
    ) {
    }

    public function index()
    {
        return Pathway::query()->latest()->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'name' => ['required', 'string', 'max:255'],
            'version' => ['nullable', 'integer', 'min:1'],
            'schema_version' => ['nullable', 'string', 'max:255'],
            'start_node_id' => ['nullable', 'string', 'max:255'],
            'editor_definition' => ['required', 'array'],
            'engine_definition' => ['nullable', 'array'],
            'validation_status' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        $data['engine_definition'] = $data['engine_definition'] ?? $this->definitions->normalize($data['editor_definition']);

        return response()->json(Pathway::create($data), 201);
    }

    public function show(Pathway $pathway)
    {
        return $pathway;
    }

    public function update(Request $request, Pathway $pathway)
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'version' => ['nullable', 'integer', 'min:1'],
            'schema_version' => ['nullable', 'string', 'max:255'],
            'start_node_id' => ['nullable', 'string', 'max:255'],
            'editor_definition' => ['sometimes', 'array'],
            'engine_definition' => ['nullable', 'array'],
            'validation_status' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (isset($data['editor_definition'])) {
            $data['engine_definition'] = $data['engine_definition'] ?? $this->definitions->normalize($data['editor_definition']);
        }

        $pathway->update($data);

        return $pathway->refresh();
    }

    public function destroy(Pathway $pathway)
    {
        $pathway->delete();

        return response()->noContent();
    }

    public function validatePathway(Request $request)
    {
        $payload = $request->validate([
            'pathway' => ['required', 'array'],
        ]);

        return response()->json($this->definitions->validate($payload['pathway']));
    }

    public function evaluate(Request $request)
    {
        $payload = $request->validate([
            'pathway' => ['required', 'array'],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
        ]);

        $pathway = $this->definitions->normalize($payload['pathway']);
        if (array_key_exists('prevalence', $payload)) {
            $pathway['prevalence'] = $payload['prevalence'];
        }

        $result = $this->bridge->evaluate($pathway);

        $pathwayRecord = Pathway::create([
            'name' => $pathway['metadata']['label'] ?? 'Untitled pathway',
            'version' => 1,
            'schema_version' => $pathway['schema_version'] ?? 'v1',
            'start_node_id' => $pathway['start_node'] ?? null,
            'editor_definition' => $pathway,
            'engine_definition' => $pathway,
            'validation_status' => ($result['validation']['valid'] ?? true) ? 'valid' : 'invalid',
            'metadata' => $pathway['metadata'] ?? [],
        ]);

        EvaluationResult::create([
            'pathway_id' => $pathwayRecord->id,
            'prevalence' => $payload['prevalence'] ?? null,
            'result_payload' => $result,
            'engine_version' => $result['engine_version'] ?? null,
            'evaluation_mode' => 'server',
        ]);

        return response()->json($result);
    }

    public function optimize(Request $request)
    {
        $payload = $request->validate([
            'tests' => ['required', 'array'],
            'constraints' => ['nullable', 'array'],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
        ]);

        return response()->json(
            $this->optimizer->optimize($payload['tests'], $payload['constraints'] ?? [], $payload['prevalence'] ?? null)
        );
    }

    public function import(Request $request)
    {
        $payload = $request->validate([
            'pathway' => ['required', 'array'],
        ]);

        $pathway = $this->definitions->normalize($payload['pathway']);

        return response()->json(Pathway::create([
            'name' => $pathway['metadata']['label'] ?? 'Imported pathway',
            'version' => 1,
            'schema_version' => $pathway['schema_version'] ?? 'v1',
            'start_node_id' => $pathway['start_node'] ?? null,
            'editor_definition' => $pathway,
            'engine_definition' => $pathway,
            'validation_status' => 'draft',
            'metadata' => $pathway['metadata'] ?? [],
        ]), 201);
    }

    public function exportJson(Pathway $pathway)
    {
        return response()->json($pathway->engine_definition ?? $pathway->editor_definition);
    }

    public function exportReport(Pathway $pathway)
    {
        $result = $pathway->latestEvaluationResult?->result_payload ?? [];

        return response()->json([
            'pathway' => $pathway,
            'evaluation' => $result,
            'format' => 'html',
        ]);
    }
}

