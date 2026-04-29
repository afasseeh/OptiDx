<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EvaluationResult;
use App\Models\OptimizationRun;
use App\Models\Pathway;
use App\Services\OptimizationService;
use App\Services\ReportService;
use App\Services\PathwayGraphService;
use App\Services\PathwayDefinitionService;
use App\Services\PythonEngineBridge;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PathwayController extends Controller
{
    public function __construct(
        private readonly PathwayDefinitionService $definitions,
        private readonly PythonEngineBridge $bridge,
        private readonly OptimizationService $optimizer,
        private readonly PathwayGraphService $graph,
        private readonly ReportService $reports,
    ) {
    }

    public function index()
    {
        return Pathway::query()->with(['project:id,title', 'latestEvaluationResult'])->latest()->get();
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
            'version' => ['nullable', 'integer', 'min:1'],
            'schema_version' => ['nullable', 'string', 'max:255'],
            'start_node_id' => ['nullable', 'string', 'max:255'],
            'editor_definition' => ['required', 'array'],
            'validation_status' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        $prepared = $this->prepareDefinitions($data['editor_definition'], $data['metadata'] ?? []);
        $data['schema_version'] = $prepared['schema_version'];
        $data['start_node_id'] = $prepared['start_node_id'];
        $data['editor_definition'] = $prepared['editor_definition'];
        $data['engine_definition'] = $prepared['engine_definition'];
        $data['metadata'] = $prepared['metadata'];

        return response()->json(Pathway::create($data)->load(['project:id,title', 'latestEvaluationResult']), 201);
    }

    public function show(Pathway $pathway)
    {
        return $pathway->load(['project:id,title', 'latestEvaluationResult']);
    }

    public function update(Request $request, Pathway $pathway)
    {
        $userId = $request->user()?->id;
        $data = $request->validate([
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(fn ($query) => $query->where('created_by', $userId)),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'version' => ['nullable', 'integer', 'min:1'],
            'schema_version' => ['nullable', 'string', 'max:255'],
            'start_node_id' => ['nullable', 'string', 'max:255'],
            'editor_definition' => ['sometimes', 'array'],
            'validation_status' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (isset($data['editor_definition'])) {
            $prepared = $this->prepareDefinitions($data['editor_definition'], $data['metadata'] ?? []);
            $data['schema_version'] = $prepared['schema_version'];
            $data['start_node_id'] = $prepared['start_node_id'];
            $data['editor_definition'] = $prepared['editor_definition'];
            $data['engine_definition'] = $prepared['engine_definition'];
            $data['metadata'] = $prepared['metadata'];
        }

        $pathway->update($data);

        return $pathway->refresh()->load(['project:id,title', 'latestEvaluationResult']);
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

        $prepared = $this->prepareDefinitions($payload['pathway']);

        return response()->json($this->definitions->validate($prepared['engine_definition']));
    }

    public function evaluate(Request $request)
    {
        $userId = $request->user()?->id;
        $payload = $request->validate([
            'pathway' => ['required', 'array'],
            'pathway_id' => [
                'nullable',
                'integer',
                Rule::exists('pathways', 'id')->where(fn ($query) => $query->where('created_by', $userId)),
            ],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
        ]);

        $prepared = $this->prepareDefinitions($payload['pathway']);
        $validation = $this->definitions->validate($prepared['engine_definition']);
        if (! ($validation['valid'] ?? false)) {
            return response()->json([
                'message' => 'Pathway validation failed.',
                'validation' => $validation,
            ], 422);
        }

        $pathway = $prepared['editor_definition'];

        $pathwayRecord = null;
        if (! empty($payload['pathway_id'])) {
            $pathwayRecord = Pathway::query()->with('project')->find($payload['pathway_id']);
        }

        $resolvedPrevalence = array_key_exists('prevalence', $payload)
            ? $payload['prevalence']
            : $pathwayRecord?->project?->prevalence;

        if ($resolvedPrevalence !== null) {
            $pathway['prevalence'] = $resolvedPrevalence;
        }

        $result = $this->bridge->evaluate($prepared['engine_definition'] + ['prevalence' => $resolvedPrevalence]);

        $pathwayData = [
            'name' => $pathway['metadata']['label'] ?? $pathwayRecord?->name ?? 'Untitled pathway',
            'version' => $pathwayRecord?->version ?? 1,
            'schema_version' => $pathway['schema_version'] ?? $pathwayRecord?->schema_version ?? 'v1',
            'start_node_id' => $pathway['start_node'] ?? $pathwayRecord?->start_node_id ?? null,
            'editor_definition' => $pathway,
            'engine_definition' => $prepared['engine_definition'],
            'validation_status' => ($result['validation']['valid'] ?? true) ? 'valid' : 'invalid',
            'metadata' => $pathway['metadata'] ?? [],
        ];

        if ($pathwayRecord) {
            $pathwayRecord->update($pathwayData);
            $pathwayRecord = $pathwayRecord->refresh();
        } else {
            $pathwayRecord = Pathway::create($pathwayData);
        }

        EvaluationResult::create([
            'pathway_id' => $pathwayRecord->id,
            'prevalence' => $resolvedPrevalence,
            'result_payload' => $result,
            'engine_version' => $result['engine_version'] ?? null,
            'evaluation_mode' => 'server',
        ]);

        $pathwayRecord->load(['project:id,title', 'latestEvaluationResult']);

        return response()->json([
            ...$result,
            'prevalence' => $resolvedPrevalence,
            'pathway' => $pathwayRecord,
        ]);
    }

    public function optimize(Request $request)
    {
        $userId = $request->user()?->id;
        $payload = $request->validate([
            'project_id' => [
                'nullable',
                'integer',
                Rule::exists('projects', 'id')->where(fn ($query) => $query->where('created_by', $userId)),
            ],
            'tests' => ['present', 'array'],
            'constraints' => ['nullable', 'array'],
            'search_config' => ['nullable', 'array'],
            'run_mode' => ['required', Rule::in(['light', 'extensive'])],
            'prevalence' => ['nullable', 'numeric', 'between:0,1'],
        ]);

        $constraints = array_replace(
            $payload['constraints'] ?? [],
            array_key_exists('prevalence', $payload) ? ['prevalence' => $payload['prevalence']] : []
        );

        $tests = $payload['tests'];
        if ($tests === [] && $userId) {
            $tests = $this->optimizer->workspaceOptimizationTests($userId, $payload['project_id'] ?? null);
        }

        $normalizedPayload = $this->optimizer->prepareRunPayload(
            $tests,
            $constraints,
            $payload['search_config'] ?? [],
            $payload['run_mode'],
        );

        if (($normalizedPayload['tests'] ?? []) === []) {
            return response()->json([
                'message' => 'Add at least one diagnostic test before running the optimization.',
            ], 422);
        }

        $run = OptimizationRun::create([
            'project_id' => $payload['project_id'] ?? null,
            'run_mode' => $payload['run_mode'],
            'status' => 'queued',
            'input_payload' => $normalizedPayload,
            'constraints' => $normalizedPayload['constraints'],
            'heuristic_mode' => false,
            'search_exhaustive' => false,
        ]);

        if (app()->runningUnitTests()) {
            return response()->json($run->fresh(), 202);
        }

        try {
            $this->optimizer->queueOptimizationRun($run);
        } catch (\Throwable $throwable) {
            $failedRun = $this->optimizer->recordRunFailure($run, $throwable);
            return response()->json($failedRun, 500);
        }

        return response()->json($run->fresh(), 202);
    }

    public function import(Request $request)
    {
        $payload = $request->validate([
            'pathway' => ['required', 'array'],
        ]);

        $prepared = $this->prepareDefinitions($payload['pathway']);
        $pathway = $prepared['editor_definition'];

        return response()->json(Pathway::create([
            'name' => $pathway['metadata']['label'] ?? 'Imported pathway',
            'version' => 1,
            'schema_version' => $pathway['schema_version'] ?? 'v1',
            'start_node_id' => $pathway['start_node'] ?? null,
            'editor_definition' => $pathway,
            'engine_definition' => $prepared['engine_definition'],
            'validation_status' => 'draft',
            'metadata' => $pathway['metadata'] ?? [],
        ])->load(['project:id,title', 'latestEvaluationResult']), 201);
    }

    public function exportJson(Pathway $pathway)
    {
        return response()->json($pathway->editor_definition ?? $pathway->engine_definition);
    }

    public function exportReport(Request $request, Pathway $pathway)
    {
        $format = strtolower((string) $request->input('format', $request->query('format', 'html')));
        $pathway->loadMissing(['project', 'latestEvaluationResult']);
        $result = $pathway->latestEvaluationResult?->result_payload ?? [];

        if ($result === []) {
            return response()->json([
                'message' => 'Run the pathway before exporting a report.',
            ], 422);
        }

        $settings = $request->input('settings');
        $reportSettings = is_array($settings) ? $settings : [];
        $report = $this->reports->findOwnedReportForPathway($pathway, $request->integer('report_id'));
        $report = $report
            ? $this->reports->updateReportSettings($report, $reportSettings)
            : $this->reports->generateReport($pathway, $reportSettings);
        $reportData = $this->reports->readSnapshot($report);

        return match ($format) {
            'pdf' => $this->downloadGeneratedFile(
                $report->pdf_path,
                $this->exportFilename($pathway, 'pdf'),
                'application/pdf'
            ),
            'docx' => $this->downloadGeneratedFile(
                $this->buildDocxReport($pathway, $reportData),
                $this->exportFilename($pathway, 'docx'),
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                true
            ),
            'html' => response($report->html_path ? File::get($report->html_path) : '', 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
            ]),
            default => response()->json([
                'pathway' => $pathway,
                'evaluation' => $result,
                'format' => 'html',
                'report' => $reportData,
            ]),
        };
    }

    public function generateAiReport(Request $request, Pathway $pathway)
    {
        $pathway->loadMissing(['project', 'latestEvaluationResult']);
        $validated = $request->validate([
            'settings' => ['nullable', 'array'],
            'report_id' => ['nullable', 'integer'],
        ]);

        $report = $this->reports->findOwnedReportForPathway($pathway, $validated['report_id'] ?? null);
        $generated = $this->reports->generateAiDraft(
            $pathway,
            is_array($validated['settings'] ?? null) ? $validated['settings'] : [],
            $report,
            $request->user()
        );

        return response()->json($this->reports->showReport($generated));
    }

    private function buildReportData(Pathway $pathway, array $evaluation): array
    {
        $metrics = $evaluation['metrics'] ?? [];
        $warnings = [];
        $seenWarnings = [];
        foreach (array_merge(
            array_map(fn ($warning) => (string) $warning, $evaluation['warnings'] ?? []),
            array_map(fn ($warning) => (string) $warning, $evaluation['validation']['warnings'] ?? [])
        ) as $warning) {
            $normalized = trim($warning);
            if ($normalized === '' || isset($seenWarnings[$normalized])) {
                continue;
            }
            $seenWarnings[$normalized] = true;
            $warnings[] = $normalized;
        }

        return [
            'title' => $pathway->name,
            'subtitle' => ($pathway->metadata ?? [])['label'] ?? $pathway->name,
            'summary' => [
                'prevalence' => $evaluation['prevalence'] ?? null,
                'sensitivity' => $metrics['sensitivity'] ?? null,
                'specificity' => $metrics['specificity'] ?? null,
                'expected_cost_population' => $metrics['expected_cost_population'] ?? $metrics['expected_cost_given_disease'] ?? null,
                'expected_turnaround_time_population' => $metrics['expected_turnaround_time_population'] ?? $metrics['expected_turnaround_time_given_disease'] ?? null,
            ],
            'warnings' => $warnings,
            'metrics' => $metrics,
            'pathway' => $pathway->editor_definition ?? [],
            'evaluation' => $evaluation,
            'generated_at' => Carbon::now()->toIso8601String(),
        ];
    }

    private function exportFilename(Pathway $pathway, string $extension): string
    {
        $base = preg_replace('/[^A-Za-z0-9_-]+/', '-', $pathway->name ?: 'optidx-pathway');
        $base = trim($base, '-');

        return ($base !== '' ? $base : 'optidx-pathway') . '.' . $extension;
    }

    private function downloadGeneratedFile(string $filePath, string $downloadName, string $contentType, bool $deleteAfterSend = false): BinaryFileResponse
    {
        $response = response()->download($filePath, $downloadName, [
            'Content-Type' => $contentType,
        ]);

        return $deleteAfterSend ? $response->deleteFileAfterSend(true) : $response;
    }

    private function buildDocxReport(Pathway $pathway, array $reportData): string
    {
        if (! class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('ZipArchive extension is required for DOCX exports.');
        }

        $filePath = $this->temporaryExportPath('docx');
        $zip = new \ZipArchive();
        if ($zip->open($filePath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Unable to create DOCX export.');
        }

        $zip->addFromString('[Content_Types].xml', $this->docxContentTypes());
        $zip->addFromString('_rels/.rels', $this->docxRootRels());
        $zip->addFromString('word/document.xml', $this->docxDocumentXml($pathway, $reportData));
        $zip->addFromString('word/_rels/document.xml.rels', $this->docxDocumentRels());
        $zip->addFromString('docProps/core.xml', $this->docxCoreProps($pathway));
        $zip->addFromString('docProps/app.xml', $this->docxAppProps($pathway));
        $zip->close();

        return $filePath;
    }

    private function temporaryExportPath(string $extension): string
    {
        $directory = storage_path('app/optidx-exports');
        if (! is_dir($directory)) {
            mkdir($directory, 0777, true);
        }

        return $directory . DIRECTORY_SEPARATOR . uniqid('report-', true) . '.' . $extension;
    }

    private function buildReportLines(Pathway $pathway, array $reportData): array
    {
        $summary = $reportData['summary'] ?? [];
        $metrics = $reportData['metrics'] ?? [];
        $lines = [
            'OptiDx Decision Report',
            'Pathway: ' . ($reportData['title'] ?? $pathway->name),
            'Generated: ' . ($reportData['generated_at'] ?? Carbon::now()->toIso8601String()),
            'Prevalence: ' . $this->formatPercent($summary['prevalence'] ?? null),
            'Sensitivity: ' . $this->formatPercent($summary['sensitivity'] ?? null),
            'Specificity: ' . $this->formatPercent($summary['specificity'] ?? null),
            'Expected cost: ' . $this->formatCurrency($summary['expected_cost_population'] ?? $summary['expected_cost'] ?? null),
            'Expected turnaround: ' . $this->formatDuration($summary['expected_turnaround_time_population'] ?? $summary['turnaround'] ?? null),
            'PPV: ' . $this->formatPercent($metrics['ppv'] ?? $summary['ppv'] ?? null),
            'NPV: ' . $this->formatPercent($metrics['npv'] ?? $summary['npv'] ?? null),
            'Warnings:',
        ];

        $warnings = $reportData['warnings'] ?? [];
        if ($warnings === []) {
            $lines[] = ' - None';
        } else {
            foreach ($warnings as $warning) {
                $lines[] = ' - ' . (is_array($warning) ? ($warning['text'] ?? '') : $warning);
            }
        }

        return $lines;
    }

    private function formatPercent(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return number_format((float) $value * 100, 1) . '%';
    }

    private function formatCurrency(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return '$' . number_format((float) $value, 2);
    }

    private function formatDuration(mixed $value): string
    {
        if ($value === null || $value === '') {
            return 'n/a';
        }

        return number_format((float) $value, 2) . ' hr';
    }

    private function docxContentTypes(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
XML;
    }

    private function docxRootRels(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
XML;
    }

    private function docxDocumentRels(): string
    {
        return <<<'XML'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
XML;
    }

    private function docxDocumentXml(Pathway $pathway, array $reportData): string
    {
        $paragraphs = [];
        foreach ($this->buildReportLines($pathway, $reportData) as $line) {
            $paragraphs[] = '<w:p><w:r><w:t>' . htmlspecialchars($line, ENT_XML1 | ENT_COMPAT, 'UTF-8') . '</w:t></w:r></w:p>';
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            . '<w:body>'
            . implode('', $paragraphs)
            . '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
            . '</w:body>'
            . '</w:document>';
    }

    private function docxCoreProps(Pathway $pathway): string
    {
        $title = htmlspecialchars($pathway->name, ENT_XML1 | ENT_COMPAT, 'UTF-8');
        $generated = Carbon::now()->toAtomString();

        return <<<XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{$title}</dc:title>
  <dc:creator>OptiDx</dc:creator>
  <cp:lastModifiedBy>OptiDx</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{$generated}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{$generated}</dcterms:modified>
</cp:coreProperties>
XML;
    }

    private function docxAppProps(Pathway $pathway): string
    {
        $title = htmlspecialchars($pathway->name, ENT_XML1 | ENT_COMPAT, 'UTF-8');

        return <<<XML
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>OptiDx</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Titles</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>{$title}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>Syreon</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>16.0000</AppVersion>
</Properties>
XML;
    }

    private function prepareDefinitions(array $definition, array $metadata = []): array
    {
        if ($this->looksLikeCanvasGraph($definition)) {
            $prepared = $this->graph->canonicalizeAndCompile($definition);
            $editorDefinition = $prepared['editor_definition'];
            $engineDefinition = $prepared['engine_definition'];
        } else {
            $editorDefinition = $this->definitions->normalize($definition);
            $engineDefinition = $editorDefinition;
        }

        $editorDefinition['metadata'] = array_replace($editorDefinition['metadata'] ?? [], $metadata);

        return [
            'schema_version' => $editorDefinition['schema_version'] ?? 'v1',
            'start_node_id' => $editorDefinition['start_node'] ?? null,
            'editor_definition' => $editorDefinition,
            'engine_definition' => $engineDefinition,
            'metadata' => $editorDefinition['metadata'] ?? [],
        ];
    }

    private function looksLikeCanvasGraph(array $definition): bool
    {
        if (! empty($definition['edges'])) {
            return true;
        }

        foreach ($definition['nodes'] ?? [] as $node) {
            if (! is_array($node)) {
                continue;
            }

            if (array_key_exists('testId', $node)
                || array_key_exists('members', $node)
                || array_key_exists('x', $node)
                || array_key_exists('y', $node)
                || array_key_exists('kind', $node)
                || array_key_exists('subtype', $node)) {
                return true;
            }
        }

        return false;
    }
}
