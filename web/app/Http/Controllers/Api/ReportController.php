<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pathway;
use App\Models\Report;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
    ) {
    }

    public function index(Request $request, Pathway $pathway)
    {
        if ($request->integer('project_id') && (int) $request->integer('project_id') !== (int) $pathway->project_id) {
            return response()->json(['data' => []]);
        }

        return response()->json([
            'data' => $this->reports->listPathwayReports($pathway),
        ]);
    }

    public function show(Report $report)
    {
        $report->loadMissing(['project:id,title', 'pathway:id,name,project_id', 'optimizationRun:id,run_mode']);

        return response()->json($this->reports->showReport($report));
    }

    public function download(Request $request, Report $report): BinaryFileResponse|\Illuminate\Http\Response
    {
        $format = strtolower((string) $request->query('format', 'pdf'));
        $report->loadMissing(['project:id,title', 'pathway:id,name,project_id']);
        $snapshot = $this->reports->showReport($report);

        return match ($format) {
            'html' => response($report->html_path && File::isFile($report->html_path) ? File::get($report->html_path) : '', 200, [
                'Content-Type' => 'text/html; charset=UTF-8',
            ]),
            default => response()->download($report->pdf_path, $this->downloadName($snapshot['report']['title'] ?? $report->id, 'pdf'), [
                'Content-Type' => 'application/pdf',
            ]),
        };
    }

    public function update(Request $request, Report $report)
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'min:1', 'max:255'],
            'settings' => ['sometimes', 'array'],
        ]);

        $updated = $report;
        if (array_key_exists('title', $validated)) {
            $title = trim($validated['title']);
            if ($title === '') {
                throw ValidationException::withMessages([
                    'title' => 'The report title may not be empty.',
                ]);
            }

            $updated = $this->reports->renameReport($updated, $title);
        }

        if (array_key_exists('settings', $validated)) {
            $updated = $this->reports->updateReportSettings($updated, $validated['settings']);
        }

        $updated->loadMissing(['project:id,title', 'pathway:id,name,project_id', 'optimizationRun:id,run_mode']);

        return response()->json($this->reports->showReport($updated));
    }

    public function destroy(Report $report)
    {
        $this->reports->deleteReport($report);

        return response()->noContent();
    }

    private function downloadName(string $title, string $extension): string
    {
        $slug = preg_replace('/[^A-Za-z0-9_-]+/', '-', $title);
        $slug = trim((string) $slug, '-');

        return ($slug !== '' ? $slug : 'optidx-report') . '.' . $extension;
    }
}
