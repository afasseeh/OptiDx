<?php

namespace App\Services;

use App\Models\Pathway;
use App\Models\Report;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class ReportService
{
    public function __construct(
        private readonly PathwayGraphService $graph,
        private readonly AiReportGenerationService $aiReports,
    ) {
    }

    public function listPathwayReports(Pathway $pathway)
    {
        return Report::query()
            ->where('pathway_id', $pathway->id)
            ->latest('id')
            ->get()
            ->map(fn (Report $report): array => $this->summarizeReport($report))
            ->values();
    }

    public function showReport(Report $report): array
    {
        return [
            'report' => $this->summarizeReport($report),
            'data' => $this->readSnapshot($report),
        ];
    }

    public function renameReport(Report $report, string $title): Report
    {
        $metadata = $report->metadata ?? [];
        $metadata['title'] = $title;
        $metadata['renamed_at'] = now()->toIso8601String();

        $report->forceFill([
            'metadata' => $metadata,
        ])->save();

        return $report->refresh();
    }

    public function updateReportSettings(Report $report, array $settings): Report
    {
        $snapshot = $this->readSnapshot($report);
        $mergedSettings = array_replace_recursive(
            is_array($snapshot['settings'] ?? null) ? $snapshot['settings'] : $this->defaultReportSettings($report),
            $settings
        );

        return $this->persistExistingReport($report, array_replace_recursive($snapshot, [
            'settings' => $mergedSettings,
        ]));
    }

    public function deleteReport(Report $report): void
    {
        foreach (['html_path', 'pdf_path', 'json_path'] as $pathField) {
            $path = $report->{$pathField};
            if ($path && is_file($path)) {
                @unlink($path);
            }
        }

        $report->delete();
    }

    public function generateReport(Pathway $pathway, array $settings = []): Report
    {
        $pathway = $pathway->loadMissing(['project', 'latestEvaluationResult']);
        $evaluation = $pathway->latestEvaluationResult?->result_payload;
        if (! is_array($evaluation) || $evaluation === []) {
            throw new \InvalidArgumentException('A completed evaluation is required before generating a report.');
        }

        $reportData = $this->buildReportData($pathway, $evaluation, $settings);
        return $this->createReportFromSnapshot($pathway, $evaluation, $reportData);
    }

    public function generateAiDraft(Pathway $pathway, array $settings = [], ?Report $report = null, ?User $user = null): Report
    {
        $pathway = $pathway->loadMissing(['project', 'latestEvaluationResult']);
        $evaluation = $pathway->latestEvaluationResult?->result_payload;
        if (! is_array($evaluation) || $evaluation === []) {
            throw new \InvalidArgumentException('A completed evaluation is required before generating a report.');
        }

        $baseSnapshot = $report ? $this->readSnapshot($report) : $this->buildReportData($pathway, $evaluation, $settings);
        $resolvedSettings = array_replace_recursive(
            is_array($baseSnapshot['settings'] ?? null) ? $baseSnapshot['settings'] : $this->buildSettings($pathway, $this->buildEvaluationView($evaluation), $evaluation),
            $settings
        );
        $snapshot = array_replace_recursive($baseSnapshot, [
            'settings' => $resolvedSettings,
            'sections' => is_array($resolvedSettings['sections'] ?? null) ? $resolvedSettings['sections'] : ($baseSnapshot['sections'] ?? $this->buildSections([])),
        ]);

        $generated = $this->aiReports->generateSections($pathway, $snapshot, $resolvedSettings, $user);
        $snapshot['generated_sections'] = $generated['generated_sections'];
        $snapshot['ai_generation'] = $generated['ai_generation'];

        if ($report) {
            return $this->persistExistingReport($report, $snapshot);
        }

        return $this->createReportFromSnapshot($pathway, $evaluation, $snapshot);
    }

    public function buildReportData(Pathway $pathway, array $evaluation, array $settings = []): array
    {
        $project = $pathway->project;
        $engineDefinition = $pathway->editor_definition ?? $pathway->engine_definition ?? [];
        $evaluationView = $this->buildEvaluationView($evaluation);
        $reportSettings = $this->normalizeReportSettings($pathway, $evaluationView, $evaluation, $settings);

        return [
            'title' => $pathway->name ?: ($pathway->metadata['label'] ?? 'OptiDx report'),
            'subtitle' => $project?->title ?: (($pathway->metadata['label'] ?? null) ?: ($pathway->name ?: 'Workspace pathway')),
            'generated_at' => Carbon::now()->toIso8601String(),
            'project' => [
                'id' => $project?->id,
                'title' => $project?->title,
                'disease_area' => $project?->disease_area,
                'intended_use' => $project?->intended_use,
                'target_population' => $project?->target_population,
                'prevalence' => $project?->prevalence,
                'setting' => $project?->setting,
            ],
            'pathway' => [
                'id' => $pathway->id,
                'name' => $pathway->name,
                'schema_version' => $pathway->schema_version,
                'start_node_id' => $pathway->start_node_id,
                'metadata' => $pathway->metadata ?? [],
            ],
            'summary' => $this->buildSummary($evaluationView, $project?->prevalence ?? null, $evaluation, $reportSettings),
            'settings' => $reportSettings,
            'tests' => $this->buildTests($engineDefinition, $evaluationView),
            'paths' => $evaluationView['paths'],
            'warnings' => $evaluationView['warnings'],
            'validation' => $evaluation['validation'] ?? [],
            'metrics' => $evaluationView['metrics'],
            'sections' => $this->buildSections($evaluationView),
            'generated_sections' => [],
            'ai_generation' => null,
        ];
    }

    public function renderReportHtml(array $reportData): string
    {
        return View::make('reports.optidx', ['report' => $reportData])->render();
    }

    public function renderPdf(string $html, string $outputPath): void
    {
        $tempHtml = tempnam(sys_get_temp_dir(), 'optidx-report-') . '.html';
        File::put($tempHtml, $html);

        try {
            $script = base_path('scripts/render-report-pdf.mjs');
            $process = new Process([$this->resolveNodeExecutable(), $script, $tempHtml, $outputPath], base_path());
            $process->setTimeout(120);
            $process->run();

            if ($process->isSuccessful()) {
                return;
            }

            Log::warning('Playwright report rendering failed; using fallback PDF export.', [
                'error' => trim($process->getErrorOutput()) ?: trim($process->getOutput()) ?: 'Unknown renderer failure',
                'output_path' => $outputPath,
            ]);
        } catch (\Throwable $throwable) {
            Log::warning('Playwright report rendering threw; using fallback PDF export.', [
                'error' => $throwable->getMessage(),
                'output_path' => $outputPath,
            ]);
        } finally {
            if (is_file($tempHtml)) {
                @unlink($tempHtml);
            }
        }

        $this->writeFallbackPdf($outputPath, $html);
    }

    public function readSnapshot(Report $report): array
    {
        if ($report->json_path && is_file($report->json_path)) {
            $decoded = json_decode((string) File::get($report->json_path), true);
            if (is_array($decoded)) {
                $decoded['title'] = $report->metadata['title'] ?? $decoded['title'] ?? $report->pathway?->name ?? 'OptiDx report';
                $decoded['subtitle'] = $report->metadata['subtitle'] ?? $decoded['subtitle'] ?? $report->project?->title ?? 'Workspace pathway';
                $decoded['generated_at'] = $report->metadata['generated_at'] ?? $decoded['generated_at'] ?? optional($report->created_at)?->toIso8601String();
                $decoded['summary'] = $report->metadata['summary'] ?? $decoded['summary'] ?? [];
                $decoded['settings'] = $report->metadata['settings'] ?? $decoded['settings'] ?? $this->defaultReportSettings($report);
                $decoded['sections'] = $report->metadata['sections'] ?? $decoded['sections'] ?? $this->buildSections([]);
                $decoded['generated_sections'] = $report->metadata['generated_sections'] ?? $decoded['generated_sections'] ?? [];
                $decoded['ai_generation'] = $report->metadata['ai_generation'] ?? $decoded['ai_generation'] ?? null;
                return $decoded;
            }
        }

        return [
            'title' => $report->metadata['title'] ?? $report->pathway?->name ?? 'OptiDx report',
            'subtitle' => $report->metadata['subtitle'] ?? $report->project?->title ?? 'Workspace pathway',
            'generated_at' => $report->metadata['generated_at'] ?? optional($report->created_at)?->toIso8601String(),
            'summary' => $report->metadata['summary'] ?? [],
            'settings' => $report->metadata['settings'] ?? $this->defaultReportSettings($report),
            'sections' => $report->metadata['sections'] ?? $this->buildSections([]),
            'generated_sections' => $report->metadata['generated_sections'] ?? [],
            'ai_generation' => $report->metadata['ai_generation'] ?? null,
            'tests' => [],
            'paths' => [],
            'warnings' => [],
        ];
    }

    public function summarizeReport(Report $report): array
    {
        $snapshot = $this->readSnapshot($report);

        return [
            'id' => $report->id,
            'project_id' => $report->project_id,
            'pathway_id' => $report->pathway_id,
            'optimization_run_id' => $report->optimization_run_id,
            'format' => $report->format,
            'title' => $snapshot['title'] ?? $report->metadata['title'] ?? $report->pathway?->name ?? 'OptiDx report',
            'subtitle' => $snapshot['subtitle'] ?? $report->metadata['subtitle'] ?? null,
            'generated_at' => $snapshot['generated_at'] ?? $report->created_at?->toIso8601String(),
            'summary' => $snapshot['summary'] ?? [],
            'settings' => $snapshot['settings'] ?? [],
            'sections' => $snapshot['sections'] ?? [],
            'generated_sections' => $snapshot['generated_sections'] ?? [],
            'ai_generation' => $snapshot['ai_generation'] ?? null,
            'has_html' => $report->html_path && is_file($report->html_path),
            'has_pdf' => $report->pdf_path && is_file($report->pdf_path),
            'created_at' => $report->created_at,
            'updated_at' => $report->updated_at,
        ];
    }

    public function findOwnedReportForPathway(Pathway $pathway, ?int $reportId): ?Report
    {
        if (! $reportId) {
            return null;
        }

        return Report::query()
            ->where('pathway_id', $pathway->id)
            ->whereKey($reportId)
            ->first();
    }

    private function createReportFromSnapshot(Pathway $pathway, array $evaluation, array $reportData): Report
    {
        $storagePaths = $this->reportStoragePaths($pathway);

        return $this->persistReportRecord(
            Report::make([
                'project_id' => $pathway->project_id,
                'pathway_id' => $pathway->id,
                'optimization_run_id' => $evaluation['optimization_run_id'] ?? null,
                'format' => 'pdf',
                'html_path' => $storagePaths['html'],
                'pdf_path' => $storagePaths['pdf'],
                'json_path' => $storagePaths['json'],
            ]),
            $reportData
        );
    }

    private function persistExistingReport(Report $report, array $snapshot): Report
    {
        return $this->persistReportRecord($report, $snapshot);
    }

    private function persistReportRecord(Report $report, array $snapshot): Report
    {
        $pathway = $report->relationLoaded('pathway') && $report->pathway
            ? $report->pathway
            : Pathway::query()->findOrFail($report->pathway_id);
        $storageSeed = $this->reportStoragePaths($pathway);
        $storagePaths = [
            'html' => $report->html_path ?: $storageSeed['html'],
            'pdf' => $report->pdf_path ?: $storageSeed['pdf'],
            'json' => $report->json_path ?: $storageSeed['json'],
        ];

        File::ensureDirectoryExists(dirname($storagePaths['html']));
        File::ensureDirectoryExists(dirname($storagePaths['pdf']));
        File::ensureDirectoryExists(dirname($storagePaths['json']));

        $html = $this->renderReportHtml($snapshot);
        File::put($storagePaths['html'], $html);
        File::put($storagePaths['json'], json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        $this->renderPdf($html, $storagePaths['pdf']);

        $report->forceFill([
            'project_id' => $report->project_id,
            'pathway_id' => $report->pathway_id,
            'optimization_run_id' => $report->optimization_run_id,
            'format' => $report->format ?: 'pdf',
            'html_path' => $storagePaths['html'],
            'pdf_path' => $storagePaths['pdf'],
            'json_path' => $storagePaths['json'],
            'metadata' => [
                'title' => $snapshot['title'],
                'subtitle' => $snapshot['subtitle'],
                'generated_at' => $snapshot['generated_at'] ?? now()->toIso8601String(),
                'summary' => $snapshot['summary'] ?? [],
                'settings' => $snapshot['settings'] ?? [],
                'sections' => $snapshot['sections'] ?? [],
                'generated_sections' => $snapshot['generated_sections'] ?? [],
                'ai_generation' => $snapshot['ai_generation'] ?? null,
            ],
        ])->save();

        return $report->refresh();
    }

    private function reportStoragePaths(Pathway $pathway): array
    {
        $directory = storage_path('app/optidx-reports/' . ($pathway->project_id ? 'project-' . $pathway->project_id : 'standalone') . '/pathway-' . $pathway->id);
        $slug = Str::slug($pathway->name ?: 'report') ?: 'report';
        $stamp = now()->format('Ymd-His');
        $token = Str::lower(Str::random(8));
        $base = $directory . DIRECTORY_SEPARATOR . $stamp . '-' . $slug . '-' . $token;

        return [
            'html' => $base . '.html',
            'pdf' => $base . '.pdf',
            'json' => $base . '.json',
        ];
    }

    private function buildSummary(array $evaluationView, mixed $prevalence, array $evaluation, array $settings = []): array
    {
        $metrics = $evaluationView['metrics'] ?? [];

        return [
            'prevalence' => $prevalence ?? $evaluation['prevalence'] ?? null,
            'sensitivity' => $evaluationView['sens'] ?? $metrics['sensitivity'] ?? null,
            'specificity' => $evaluationView['spec'] ?? $metrics['specificity'] ?? null,
            'ppv' => $evaluationView['ppv'] ?? $metrics['ppv'] ?? null,
            'npv' => $evaluationView['npv'] ?? $metrics['npv'] ?? null,
            'expected_cost' => $evaluationView['summary']['expectedCost'] ?? $metrics['expected_cost_population'] ?? null,
            'turnaround' => $evaluationView['summary']['expectedTatLabel'] ?? $evaluationView['tatAverageLabel'] ?? null,
            'path_count' => $evaluationView['pathCount'] ?? 0,
            'warnings' => count($evaluationView['warnings'] ?? []),
            'audience' => $settings['audience']['selected'] ?? null,
            'format' => $settings['output']['selected_format'] ?? null,
        ];
    }

    private function buildTests(array $engineDefinition, array $evaluationView): array
    {
        $tests = [];
        if (array_is_list($evaluationView['testContributions'] ?? [])) {
            foreach ($evaluationView['testContributions'] as $test) {
                $tests[] = [
                    'id' => $test['id'] ?? $test['name'] ?? null,
                    'name' => $test['label'] ?? $test['name'] ?? $test['id'] ?? 'Test',
                    'cost' => $test['contribution'] ?? $test['cost'] ?? null,
                    'sample' => is_array($test['sample_types'] ?? null) ? implode(', ', $test['sample_types']) : ($test['sample'] ?? null),
                    'skill' => $test['skill_level'] ?? $test['skill'] ?? null,
                ];
            }

            return $tests;
        }

        foreach ($engineDefinition['tests'] ?? [] as $testId => $test) {
            $tests[] = [
                'id' => $testId,
                'name' => $test['name'] ?? $testId,
                'cost' => $test['cost'] ?? null,
                'sample' => is_array($test['sample_types'] ?? null) ? implode(', ', $test['sample_types']) : ($test['sample'] ?? null),
                'skill' => $test['skill_level'] ?? null,
            ];
        }

        return $tests;
    }

    private function buildSections(array $evaluationView): array
    {
        return [
            ['id' => 'cover', 'label' => 'Cover & executive summary', 'description' => 'Report branding, title, and summary metrics.', 'page' => 1, 'enabled' => true],
            ['id' => 'diagram', 'label' => 'Pathway diagram', 'description' => 'Rendered pathway and document identity.', 'page' => 1, 'enabled' => true],
            ['id' => 'aggregate', 'label' => 'Aggregate diagnostic accuracy', 'description' => 'Sensitivity, specificity, PPV, and NPV.', 'page' => 2, 'enabled' => true],
            ['id' => 'inputs', 'label' => 'Input parameters & priors', 'description' => 'Model inputs, priors, and prevalence assumptions.', 'page' => 2, 'enabled' => true],
            ['id' => 'rules', 'label' => 'Decision rules per node', 'description' => 'Node-level branching and routing logic.', 'page' => 2, 'enabled' => true],
            ['id' => 'paths', 'label' => 'Path-level outcome table', 'description' => 'Resolved path trace and per-path metrics.', 'page' => 3, 'enabled' => true],
            ['id' => 'sensitivity', 'label' => 'Sensitivity analysis (tornado)', 'description' => 'Parameter influence and scenario sensitivity summary.', 'page' => 3, 'enabled' => true],
            ['id' => 'costing', 'label' => 'Costing & resource use', 'description' => 'Cost accumulation and resource assumptions.', 'page' => 4, 'enabled' => true],
            ['id' => 'comparators', 'label' => 'Comparator pathways', 'description' => 'Alternative pathway context and comparison points.', 'page' => 5, 'enabled' => true],
            ['id' => 'warnings', 'label' => 'Warnings & assumptions', 'description' => 'Validation warnings and caveats.', 'page' => 5, 'enabled' => true],
            ['id' => 'references', 'label' => 'Evidence sources & references', 'description' => 'Evidence base and references supporting the report.', 'page' => 6, 'enabled' => true],
        ];
    }

    private function buildSettings(Pathway $pathway, array $evaluationView, array $evaluation, array $overrides = []): array
    {
        $settings = [
            'template' => 'OptiDx decision report',
            'brand' => [
                'organization' => 'Syreon',
                'accent' => '#F37739',
                'footer' => "Today's research for tomorrow's health",
                'issuer' => 'Syreon MENA HTA',
            ],
            'output' => [
                'selected_format' => 'pdf',
                'formats' => ['pdf', 'docx'],
                'format_options' => [
                    ['id' => 'pdf', 'label' => 'PDF', 'description' => 'Print-ready, signed digital report'],
                    ['id' => 'docx', 'label' => 'Microsoft Word (.docx)', 'description' => 'Editable for ministry templates'],
                ],
                'render_mode' => 'HTML-first -> PDF conversion',
                'access' => 'Authenticated workspace users',
            ],
            'audience' => [
                'selected' => 'technical',
                'options' => [
                    ['id' => 'technical', 'label' => 'Technical (HTA analyst)', 'description' => 'Full methodology, parameters, sensitivity, path table.'],
                    ['id' => 'clinical', 'label' => 'Clinical', 'description' => 'Pathway interpretation, decision rules, workflow.'],
                    ['id' => 'policymaker', 'label' => 'Policymaker', 'description' => 'Aggregate impact, costing, equity, key takeaways.'],
                ],
            ],
            'include' => [
                'pathway_diagram' => true,
                'aggregate_metrics' => true,
                'cost_per_detected_case' => true,
                'path_level_trace_table' => true,
                'warnings_and_assumptions' => true,
                'evidence_references' => true,
            ],
            'pathway' => [
                'id' => $pathway->id,
                'name' => $pathway->name,
            ],
            'summary_fields' => [
                'prevalence' => $evaluation['prevalence'] ?? null,
                'sensitivity' => $evaluationView['sens'] ?? null,
                'specificity' => $evaluationView['spec'] ?? null,
                'expected_cost' => $evaluationView['summary']['expectedCost'] ?? null,
                'turnaround' => $evaluationView['summary']['expectedTatLabel'] ?? null,
            ],
            'sections' => $this->buildSections($evaluationView),
        ];

        return array_replace_recursive($settings, $overrides);
    }

    private function normalizeReportSettings(Pathway $pathway, array $evaluationView, array $evaluation, array $settings): array
    {
        return array_replace_recursive(
            $this->buildSettings($pathway, $evaluationView, $evaluation),
            $settings
        );
    }

    private function resolveNodeExecutable(): string
    {
        $explicit = getenv('NODE_EXECUTABLE') ?: getenv('NODE_BINARY');
        if (is_string($explicit) && $explicit !== '' && is_file($explicit)) {
            return $explicit;
        }

        $windowsCandidate = 'C:\\Program Files\\nodejs\\node.exe';
        if (PHP_OS_FAMILY === 'Windows' && is_file($windowsCandidate)) {
            return $windowsCandidate;
        }

        $finder = new ExecutableFinder();
        foreach (['node', 'nodejs'] as $candidate) {
            $found = $finder->find($candidate);
            if (is_string($found) && $found !== '') {
                return $found;
            }
        }

        return 'node';
    }

    private function writeFallbackPdf(string $outputPath, string $html): void
    {
        $title = 'OptiDx report export';
        if (preg_match('/<h1[^>]*>(.*?)<\/h1>/is', $html, $matches)) {
            $candidate = trim(html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($candidate !== '') {
                $title = $candidate;
            }
        } elseif (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $matches)) {
            $candidate = trim(html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($candidate !== '') {
                $title = $candidate;
            }
        }

        $lines = [
            'OptiDx report export fallback',
            $title,
            '',
            'The HTML-to-PDF renderer was unavailable on this Windows runtime.',
            'A compatibility PDF was generated so the report request can complete.',
            '',
            'Open the report detail page to review the full stored snapshot.',
        ];

        $pdf = $this->buildSimplePdf($lines);
        File::put($outputPath, $pdf);
    }

    private function buildSimplePdf(array $lines): string
    {
        $pdfLines = [];
        foreach ($lines as $line) {
            $pdfLines[] = $this->escapePdfText((string) $line);
        }

        $stream = "BT\n/F1 18 Tf\n50 800 Td\n";
        $firstLine = true;
        foreach ($pdfLines as $line) {
            if ($firstLine) {
                $stream .= '(' . $line . ") Tj\n";
                $firstLine = false;
            } else {
                $stream .= "0 -20 Td\n(" . $line . ") Tj\n";
            }
        }
        if ($firstLine) {
            $stream .= "( ) Tj\n";
        }
        $stream .= "ET\n";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Length ' . strlen($stream) . " >>\nstream\n{$stream}endstream",
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[$index + 1] = strlen($pdf);
            $pdf .= ($index + 1) . " 0 obj\n{$object}\nendobj\n";
        }

        $xrefStart = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
        $pdf .= "0000000000 65535 f \n";
        foreach (range(1, count($objects)) as $i) {
            $pdf .= sprintf('%010d 00000 n ', $offsets[$i]) . "\n";
        }
        $pdf .= "trailer\n<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xrefStart}\n%%EOF";

        return $pdf;
    }

    private function escapePdfText(string $text): string
    {
        return str_replace(['\\', '(', ')'], ['\\\\', '\(', '\)'], $text);
    }

    private function defaultReportSettings(Report $report): array
    {
        return [
            'template' => 'OptiDx decision report',
            'brand' => [
                'organization' => 'Syreon',
                'accent' => '#F37739',
                'footer' => "Today's research for tomorrow's health",
                'issuer' => 'Syreon MENA HTA',
            ],
            'output' => [
                'selected_format' => 'pdf',
                'formats' => ['pdf', 'docx'],
                'format_options' => [
                    ['id' => 'pdf', 'label' => 'PDF', 'description' => 'Print-ready, signed digital report'],
                    ['id' => 'docx', 'label' => 'Microsoft Word (.docx)', 'description' => 'Editable for ministry templates'],
                ],
                'render_mode' => 'HTML-first -> PDF conversion',
                'access' => 'Authenticated workspace users',
            ],
            'audience' => [
                'selected' => 'technical',
                'options' => [
                    ['id' => 'technical', 'label' => 'Technical (HTA analyst)', 'description' => 'Full methodology, parameters, sensitivity, path table.'],
                    ['id' => 'clinical', 'label' => 'Clinical', 'description' => 'Pathway interpretation, decision rules, workflow.'],
                    ['id' => 'policymaker', 'label' => 'Policymaker', 'description' => 'Aggregate impact, costing, equity, key takeaways.'],
                ],
            ],
            'include' => [
                'pathway_diagram' => true,
                'aggregate_metrics' => true,
                'cost_per_detected_case' => true,
                'path_level_trace_table' => true,
                'warnings_and_assumptions' => true,
                'evidence_references' => true,
            ],
            'pathway' => [
                'id' => $report->pathway_id,
                'name' => $report->pathway?->name,
            ],
            'summary_fields' => [
                'prevalence' => $report->metadata['summary']['prevalence'] ?? null,
                'sensitivity' => $report->metadata['summary']['sensitivity'] ?? null,
                'specificity' => $report->metadata['summary']['specificity'] ?? null,
                'expected_cost' => $report->metadata['summary']['expected_cost'] ?? null,
                'turnaround' => $report->metadata['summary']['turnaround'] ?? null,
            ],
            'sections' => $this->buildSections([]),
        ];
    }

    private function buildEvaluationView(array $evaluation): array
    {
        $metrics = $evaluation['metrics'] ?? [];
        return [
            'metrics' => $metrics,
            'sens' => $metrics['sensitivity'] ?? null,
            'spec' => $metrics['specificity'] ?? null,
            'ppv' => $metrics['ppv'] ?? null,
            'npv' => $metrics['npv'] ?? null,
            'summary' => [
                'expectedCost' => $metrics['expected_cost_population'] ?? $metrics['expected_cost_given_disease'] ?? null,
                'expectedTatLabel' => $metrics['expected_turnaround_time_population'] ?? $metrics['expected_turnaround_time_given_disease'] ?? null,
            ],
            'pathCount' => count($evaluation['paths'] ?? []),
            'paths' => $this->normalizePaths($evaluation['paths'] ?? []),
            'warnings' => $this->normalizeWarnings($evaluation),
            'testContributions' => $evaluation['test_contributions'] ?? [],
            'tatAverageLabel' => $metrics['expected_turnaround_time_population'] ?? null,
        ];
    }

    private function normalizeWarnings(array $evaluation): array
    {
        $warnings = [];
        foreach (array_merge($evaluation['warnings'] ?? [], $evaluation['validation']['warnings'] ?? []) as $warning) {
            if (! is_scalar($warning)) {
                continue;
            }

            $text = trim((string) $warning);
            if ($text === '') {
                continue;
            }

            $warnings[] = ['kind' => 'info', 'text' => $text];
        }

        return $warnings;
    }

    private function normalizePaths(array $paths): array
    {
        return array_values(array_map(function ($path): array {
            return [
                'id' => $path['id'] ?? $path['path_id'] ?? null,
                'sequence' => $path['sequence'] ?? $path['nodes'] ?? null,
                'terminal' => $path['terminal'] ?? null,
                'pIfD' => $path['pIfD'] ?? $path['probability_if_disease'] ?? null,
                'pIfND' => $path['pIfND'] ?? $path['probability_if_no_disease'] ?? null,
                'cost' => $path['cost'] ?? null,
                'tat' => $path['tat'] ?? $path['turnaround'] ?? null,
            ];
        }, $paths));
    }
}
