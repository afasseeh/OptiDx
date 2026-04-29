<?php

namespace App\Services;

use App\Jobs\ExecuteOptimizationRun;
use App\Models\User;
use App\Models\DiagnosticTest;
use App\Models\OptimizationRun;
use App\Notifications\OptimizationRunCompletedNotification;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\Process\Process;

class OptimizationService
{
    public function __construct(
        private readonly PythonEngineBridge $bridge,
    ) {
    }

    public function prepareRunPayload(array $tests, array $constraints = [], array $searchConfig = [], ?string $runMode = null): array
    {
        $resolvedRunMode = $this->normalizeRunMode($runMode ?? $constraints['run_mode'] ?? 'light');

        return [
            'tests' => $this->normalizeTests($tests),
            'constraints' => $this->normalizeConstraints($constraints),
            'search_config' => $this->normalizeSearchConfig($searchConfig, $resolvedRunMode),
            'run_mode' => $resolvedRunMode,
        ];
    }

    public function optimize(array $tests, array $constraints = [], ?float $prevalence = null, array $searchConfig = [], ?string $runMode = null): array
    {
        $payload = $this->prepareRunPayload($tests, [
            ...$constraints,
            'prevalence' => $prevalence ?? $constraints['prevalence'] ?? null,
        ], $searchConfig, $runMode);

        return $this->bridge->optimize($payload);
    }

    public function workspaceOptimizationTests(?int $userId, ?int $projectId = null): array
    {
        if (! $userId) {
            return [];
        }

        $query = DiagnosticTest::query()->where('created_by', $userId);
        if ($projectId) {
            $query->where(function ($builder) use ($projectId): void {
                $builder->whereNull('project_id')->orWhere('project_id', $projectId);
            });
        }

        return $query
            ->latest('id')
            ->get()
            ->map(fn (DiagnosticTest $test) => $test->toArray())
            ->all();
    }

    public function optimizeRun(OptimizationRun $run, ?callable $progressCallback = null): array
    {
        $payload = $run->input_payload ?? [];

        return $this->bridge->optimize($payload, function (array $snapshot) use ($run, $progressCallback): void {
            $this->recordRunProgress($run, $snapshot);

            if ($progressCallback) {
                $progressCallback($snapshot);
            }
        });
    }

    public function runOptimizationRun(OptimizationRun $run, ?callable $progressCallback = null): OptimizationRun
    {
        $this->recordRunStart($run);
        $result = $this->optimizeRun($run, $progressCallback);
        $updatedRun = $this->recordRunResult($run, $result);
        $this->notifyCompletionIfNeeded($updatedRun);

        return $updatedRun;
    }

    public function queueOptimizationRun(OptimizationRun $run): void
    {
        ExecuteOptimizationRun::dispatch($run->id);
    }

    public function launchOptimizationRunProcess(OptimizationRun $run): OptimizationRun
    {
        $this->bridge->ensureWritableProcessTempDirectory();

        if (PHP_OS_FAMILY === 'Windows') {
            $process = new Process([
                $this->bridge->resolvePhpCliBinary(),
                base_path('artisan'),
                'optidx:run-optimization',
                (string) $run->id,
            ], base_path());
            $process->setTimeout(null);
            $process->disableOutput();
            $process->setOptions([
                'create_new_console' => true,
            ]);
            $process->start();
            $run->forceFill([
                'process_pid' => method_exists($process, 'getPid') ? ($process->getPid() ?: null) : null,
            ])->save();

            return $run->refresh();
        }

        $command = sprintf(
            'cd %s && nohup %s artisan optidx:run-optimization %s >/dev/null 2>&1 </dev/null & echo $!',
            escapeshellarg(base_path()),
            escapeshellarg($this->bridge->resolvePhpCliBinary()),
            escapeshellarg((string) $run->id),
        );
        $process = Process::fromShellCommandline($command, base_path());
        $process->setTimeout(10);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException(trim($process->getErrorOutput()) ?: 'Unable to launch optimization worker process.');
        }

        $pid = trim($process->getOutput());
        $run->forceFill([
            'process_pid' => is_numeric($pid) ? (int) $pid : null,
        ])->save();

        return $run->refresh();
    }

    public function normalizeConstraints(array $constraints): array
    {
        $prevalence = $constraints['prevalence'] ?? null;
        if ($prevalence === null || $prevalence === '') {
            throw new \InvalidArgumentException('Prevalence is required for optimization.');
        }

        $sampleFlags = $this->normalizeSampleFlags($constraints);
        $roleFlags = $this->normalizeRoleFlags($constraints);

        return [
            'prevalence' => $this->normalizePrevalence($prevalence),
            'min_sensitivity' => (float) ($constraints['min_sensitivity'] ?? $constraints['minimum_sensitivity'] ?? 0.0),
            'min_specificity' => (float) ($constraints['min_specificity'] ?? $constraints['minimum_specificity'] ?? 0.0),
            'max_cost_per_patient_usd' => $this->numberOrNull($constraints['max_cost_per_patient_usd'] ?? $constraints['maximum_total_cost'] ?? $constraints['max_expected_cost'] ?? null),
            'max_turnaround_time_hours' => $this->numberOrNull($constraints['max_turnaround_time_hours'] ?? $constraints['maximum_turnaround_time'] ?? $constraints['max_expected_tat'] ?? null),
            'lab_technician_allowed' => $roleFlags['lab_technician'],
            'radiologist_allowed' => $roleFlags['radiologist'],
            'specialist_physician_allowed' => $roleFlags['specialist_physician'],
            'primary_care' => (bool) ($constraints['primary_care'] ?? $constraints['setting_primary_care'] ?? false),
            'hospital' => (bool) ($constraints['hospital'] ?? $constraints['setting_hospital'] ?? false),
            'community' => (bool) ($constraints['community'] ?? $constraints['setting_community'] ?? false),
            'mobile_unit' => (bool) ($constraints['mobile_unit'] ?? $constraints['setting_mobile_unit'] ?? false),
            'none_allowed' => $sampleFlags['none'],
            'blood_allowed' => $sampleFlags['blood'],
            'urine_allowed' => $sampleFlags['urine'],
            'stool_allowed' => $sampleFlags['stool'],
            'sputum_allowed' => $sampleFlags['sputum'],
            'nasal_swab_allowed' => $sampleFlags['nasal_swab'],
            'imaging_allowed' => $sampleFlags['imaging'],
        ];
    }

    public function normalizeSearchConfig(array $searchConfig, ?string $runMode = null): array
    {
        return $this->applySearchModePreset($searchConfig, $this->normalizeRunMode($runMode ?? $searchConfig['run_mode'] ?? 'light'));
    }

    public function normalizeTests(array $tests): array
    {
        $normalized = [];
        foreach ($tests as $key => $test) {
            if (! is_array($test)) {
                continue;
            }

            $resolvedKey = $this->resolveTestId($key, $test);
            if (! $resolvedKey) {
                continue;
            }

            $normalized[(string) $resolvedKey] = $this->normalizeTestRecord($resolvedKey, $test);
        }

        return $normalized;
    }

    public function recordRunStart(OptimizationRun $run): OptimizationRun
    {
        $run->fill([
            'status' => 'running',
            'started_at' => now(),
            'failure_reason' => null,
            'process_pid' => null,
            'progress_percent' => 0,
            'progress_stage' => 'starting',
            'progress_message' => 'Optimization run is starting.',
            'progress_payload' => [
                'expanded_count' => 0,
                'completed_count' => 0,
                'pruned_count' => 0,
                'frontier_size' => 0,
                'queue_size' => 0,
                'elapsed_seconds' => 0.0,
                'search_exhaustive' => false,
            ],
        ]);
        $run->save();

        return $run->refresh();
    }

    public function recordRunProgress(OptimizationRun $run, array $progress): OptimizationRun
    {
        $latestRun = $run->fresh();
        if (($latestRun->status ?? $run->status ?? null) === 'cancelled') {
            return $latestRun->refresh();
        }

        $run->fill([
            'progress_percent' => $this->clampProgressPercent($progress['progress_percent'] ?? null),
            'progress_stage' => (string) ($progress['stage'] ?? $run->progress_stage ?? 'searching'),
            'progress_message' => (string) ($progress['message'] ?? $run->progress_message ?? ''),
            'progress_payload' => $progress['progress_payload'] ?? $progress,
        ]);
        $run->save();

        return $run->refresh();
    }

    public function recordRunResult(OptimizationRun $run, array $result): OptimizationRun
    {
        $latestRun = $run->fresh();
        if (($latestRun->status ?? $run->status ?? null) === 'cancelled') {
            return $latestRun->refresh();
        }

        $status = $result['status'] ?? 'success';
        $warnings = array_values(array_filter(array_map('strval', $result['warnings'] ?? [])));

        $run->fill([
            'status' => $status,
            'search_exhaustive' => (bool) ($result['search_exhaustive'] ?? false),
            'candidate_count' => (int) ($result['candidate_count'] ?? 0),
            'feasible_count' => (int) ($result['feasible_candidate_count'] ?? 0),
            'progress_percent' => 100,
            'progress_stage' => 'finalizing outputs',
            'progress_message' => $result['message'] ?? 'Optimization run completed.',
            'progress_payload' => array_merge($run->progress_payload ?? [], [
                'expanded_count' => (int) ($result['search_summary']['expanded_count'] ?? ($run->progress_payload['expanded_count'] ?? 0)),
                'completed_count' => (int) ($result['search_summary']['completed_count'] ?? ($run->progress_payload['completed_count'] ?? 0)),
                'pruned_count' => (int) ($result['search_summary']['pruned_count'] ?? ($run->progress_payload['pruned_count'] ?? 0)),
                'frontier_size' => (int) ($result['search_summary']['frontier_size'] ?? ($run->progress_payload['frontier_size'] ?? 0)),
                'queue_size' => 0,
                'elapsed_seconds' => (float) ($result['search_summary']['time_seconds'] ?? ($run->progress_payload['elapsed_seconds'] ?? 0)),
                'search_exhaustive' => (bool) ($result['search_exhaustive'] ?? false),
            ]),
            'warnings' => $warnings,
            'failure_reason' => $status === 'failed' ? ($result['message'] ?? null) : null,
            'completed_at' => now(),
            'process_pid' => null,
            'result_payload' => $result,
        ]);
        $run->save();

        return $run->refresh();
    }

    public function recordRunFailure(OptimizationRun $run, \Throwable $error): OptimizationRun
    {
        $run->fill([
            'status' => 'failed',
            'completed_at' => now(),
            'process_pid' => null,
            'failure_reason' => $error->getMessage(),
            'progress_stage' => 'failed',
            'progress_message' => $error->getMessage(),
            'warnings' => array_values(array_filter(array_merge(
                $run->warnings ?? [],
                ['Optimization failed: ' . $error->getMessage()]
            ))),
        ]);
        $run->save();

        return $run->refresh();
    }

    public function notifyCompletionIfNeeded(OptimizationRun $run): void
    {
        if (($run->run_mode ?? 'light') !== 'extensive') {
            return;
        }

        if ($run->notified_at) {
            return;
        }

        $user = $run->user;
        if (! $user instanceof User) {
            return;
        }

        Notification::send($user, new OptimizationRunCompletedNotification($run));
        $run->forceFill(['notified_at' => now()])->save();
    }

    public function cancelRun(OptimizationRun $run, ?string $reason = null): OptimizationRun
    {
        $latestRun = $run->fresh();
        if (in_array($latestRun->status ?? $run->status ?? null, ['success', 'infeasible', 'no_feasible_found_time_limit', 'failed', 'cancelled'], true)) {
            return $latestRun->refresh();
        }

        $pid = (int) ($latestRun->process_pid ?? $run->process_pid ?? 0);
        if ($pid > 0) {
            $this->terminateProcess($pid);
        }

        if ($pid <= 0) {
            $this->terminateProcessByRunId((string) $latestRun->id);
        }

        $run->fill([
            'status' => 'cancelled',
            'completed_at' => now(),
            'cancelled_at' => now(),
            'process_pid' => null,
            'failure_reason' => $reason ?? 'Optimization run was cancelled by the user.',
            'progress_stage' => 'cancelled',
            'progress_message' => $reason ?? 'Optimization run was cancelled by the user.',
        ]);
        $run->save();

        return $run->refresh();
    }

    private function normalizeTestRecord(string|int $resolvedKey, array $test): array
    {
        $sampleTypes = $this->normalizeSampleTypes($test);
        $roleFlags = $this->normalizeRoleFlags($test);
        $sampleFlags = $this->sampleFlagsFromTypes($sampleTypes, $test);

        return [
            'id' => (string) $resolvedKey,
            'name' => (string) ($test['name'] ?? $test['label'] ?? $resolvedKey),
            'sensitivity' => (float) ($test['sensitivity'] ?? $test['sens'] ?? 0.0),
            'specificity' => (float) ($test['specificity'] ?? $test['spec'] ?? 0.0),
            'turnaround_time' => $this->numberOrNull($test['turnaround_time'] ?? $test['tat'] ?? null),
            'turnaround_time_unit' => $test['turnaround_time_unit'] ?? $test['tatUnit'] ?? 'hr',
            'sample_types' => $sampleTypes,
            'skill_level' => $this->skillLevel($test['skill_level'] ?? null, $test['skill'] ?? $test['skill_label'] ?? null),
            'cost' => $this->numberOrNull($test['cost'] ?? null),
            'requires_lab_technician' => $roleFlags['lab_technician'],
            'requires_radiologist' => $roleFlags['radiologist'],
            'requires_specialist_physician' => $roleFlags['specialist_physician'],
            'sample_none' => $sampleFlags['none'],
            'sample_blood' => $sampleFlags['blood'],
            'sample_urine' => $sampleFlags['urine'],
            'sample_stool' => $sampleFlags['stool'],
            'sample_sputum' => $sampleFlags['sputum'],
            'sample_nasal_swab' => $sampleFlags['nasal_swab'],
            'sample_imaging' => $sampleFlags['imaging'],
            'base_test_id' => $test['base_test_id'] ?? (string) $resolvedKey,
            'invocation_id' => $test['invocation_id'] ?? (string) $resolvedKey,
            'is_repeat_invocation' => (bool) ($test['is_repeat_invocation'] ?? false),
            'joint_probabilities' => $test['joint_probabilities'] ?? [],
        ];
    }

    private function resolveTestId(mixed $key, array $test): ?string
    {
        $resolved = $test['id'] ?? $test['name'] ?? null;
        if (is_scalar($resolved)) {
            $resolvedString = trim((string) $resolved);
            if ($resolvedString !== '') {
                return $resolvedString;
            }
        }

        if (is_scalar($key)) {
            $keyString = trim((string) $key);
            if ($keyString !== '') {
                return $keyString;
            }
        }

        return null;
    }

    private function normalizeSampleTypes(array $test): array
    {
        $sampleTypes = $test['sample_types'] ?? null;
        if (is_string($sampleTypes)) {
            $sampleTypes = [$sampleTypes];
        }

        if (! is_array($sampleTypes)) {
            $sampleTypes = isset($test['sample']) ? [$test['sample']] : [];
        }

        return array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            $sampleTypes
        ), static fn (string $value) => $value !== ''));
    }

    private function normalizeSampleFlags(array $data): array
    {
        if (
            array_key_exists('none_allowed', $data) || array_key_exists('blood_allowed', $data) || array_key_exists('urine_allowed', $data)
            || array_key_exists('stool_allowed', $data) || array_key_exists('sputum_allowed', $data)
            || array_key_exists('nasal_swab_allowed', $data) || array_key_exists('imaging_allowed', $data)
            || array_key_exists('allow_sample_none', $data) || array_key_exists('allow_sample_blood', $data)
            || array_key_exists('allow_sample_urine', $data) || array_key_exists('allow_sample_stool', $data)
            || array_key_exists('allow_sample_sputum', $data) || array_key_exists('allow_sample_nasal_swab', $data)
            || array_key_exists('allow_sample_imaging', $data)
        ) {
            return [
                'none' => (bool) ($data['none_allowed'] ?? $data['allow_sample_none'] ?? true),
                'blood' => (bool) ($data['blood_allowed'] ?? $data['allow_sample_blood'] ?? true),
                'urine' => (bool) ($data['urine_allowed'] ?? $data['allow_sample_urine'] ?? true),
                'stool' => (bool) ($data['stool_allowed'] ?? $data['allow_sample_stool'] ?? true),
                'sputum' => (bool) ($data['sputum_allowed'] ?? $data['allow_sample_sputum'] ?? true),
                'nasal_swab' => (bool) ($data['nasal_swab_allowed'] ?? $data['allow_sample_nasal_swab'] ?? true),
                'imaging' => (bool) ($data['imaging_allowed'] ?? $data['allow_sample_imaging'] ?? true),
            ];
        }

        $types = array_map(
            static fn (string $value) => strtolower(trim($value)),
            $this->normalizeSampleTypes($data)
        );

        if ($types === []) {
            return [
                'none' => true,
                'blood' => true,
                'urine' => true,
                'stool' => true,
                'sputum' => true,
                'nasal_swab' => true,
                'imaging' => true,
            ];
        }

        return $this->sampleFlagsFromTypes($types, $data);
    }

    private function sampleFlagsFromTypes(array $sampleTypes, array $data): array
    {
        $sampleTypes = array_map(static fn ($value) => strtolower(trim((string) $value)), $sampleTypes);

        return [
            'none' => (bool) ($data['sample_none'] ?? false) || $sampleTypes === [] || $this->containsAny($sampleTypes, ['none', 'no sample', 'not applicable']),
            'blood' => (bool) ($data['sample_blood'] ?? false) || $this->containsAny($sampleTypes, ['blood', 'serum', 'plasma', 'fingerstick']),
            'urine' => (bool) ($data['sample_urine'] ?? false) || $this->containsAny($sampleTypes, ['urine']),
            'stool' => (bool) ($data['sample_stool'] ?? false) || $this->containsAny($sampleTypes, ['stool', 'feces', 'faeces']),
            'sputum' => (bool) ($data['sample_sputum'] ?? false) || $this->containsAny($sampleTypes, ['sputum']),
            'nasal_swab' => (bool) ($data['sample_nasal_swab'] ?? false) || $this->containsAny($sampleTypes, ['nasal swab', 'nasopharyngeal swab', 'swab']),
            'imaging' => (bool) ($data['sample_imaging'] ?? false) || $this->containsAny($sampleTypes, ['imaging', 'x-ray', 'xray', 'ct', 'mri', 'ultrasound', 'radiograph']),
        ];
    }

    private function normalizeRoleFlags(array $data): array
    {
        if (
            array_key_exists('lab_technician_allowed', $data) || array_key_exists('radiologist_allowed', $data) || array_key_exists('specialist_physician_allowed', $data)
            || array_key_exists('allow_lab_technician', $data) || array_key_exists('allow_radiologist', $data) || array_key_exists('allow_specialist_physician', $data)
        ) {
            return [
                'lab_technician' => (bool) ($data['lab_technician_allowed'] ?? $data['allow_lab_technician'] ?? true),
                'radiologist' => (bool) ($data['radiologist_allowed'] ?? $data['allow_radiologist'] ?? true),
                'specialist_physician' => (bool) ($data['specialist_physician_allowed'] ?? $data['allow_specialist_physician'] ?? true),
            ];
        }

        if (array_key_exists('requires_lab_technician', $data) || array_key_exists('requires_radiologist', $data) || array_key_exists('requires_specialist_physician', $data)) {
            return [
                'lab_technician' => (bool) ($data['requires_lab_technician'] ?? false),
                'radiologist' => (bool) ($data['requires_radiologist'] ?? false),
                'specialist_physician' => (bool) ($data['requires_specialist_physician'] ?? false),
            ];
        }

        $skillLevel = $this->skillLevel($data['skill_level'] ?? null, $data['skill'] ?? $data['skill_label'] ?? null);
        if ($skillLevel <= 0) {
            return ['lab_technician' => true, 'radiologist' => true, 'specialist_physician' => true];
        }

        if ($skillLevel === 1) {
            return ['lab_technician' => true, 'radiologist' => false, 'specialist_physician' => false];
        }

        if ($skillLevel === 2) {
            return ['lab_technician' => false, 'radiologist' => true, 'specialist_physician' => false];
        }

        return ['lab_technician' => false, 'radiologist' => false, 'specialist_physician' => true];
    }

    private function normalizeRunMode(mixed $runMode): string
    {
        $value = strtolower(trim((string) ($runMode ?? 'light')));
        return in_array($value, ['light', 'extensive'], true) ? $value : 'light';
    }

    private function applySearchModePreset(array $searchConfig, string $runMode): array
    {
        $preset = $runMode === 'extensive'
            ? [
                'max_stages' => 4,
                'max_tests_per_realized_path' => 6,
                'max_parallel_block_size' => 2,
                'max_candidates' => 20000,
                'time_limit_seconds' => 14400,
                'allow_repeated_test' => true,
                'allow_same_test_in_different_branches' => true,
            ]
            : [
                'max_stages' => 3,
                'max_tests_per_realized_path' => 4,
                'max_parallel_block_size' => 2,
                'max_candidates' => 1500,
                'time_limit_seconds' => 300,
                'allow_repeated_test' => true,
                'allow_same_test_in_different_branches' => true,
            ];

        return array_merge($searchConfig, $preset, [
            'max_stages' => $preset['max_stages'],
            'max_tests_per_realized_path' => $preset['max_tests_per_realized_path'],
            'max_parallel_block_size' => $preset['max_parallel_block_size'],
            'max_candidates' => $preset['max_candidates'],
            'time_limit_seconds' => $preset['time_limit_seconds'],
            'allow_repeated_test' => $preset['allow_repeated_test'],
            'allow_same_test_in_different_branches' => $preset['allow_same_test_in_different_branches'],
        ]);
    }

    private function clampProgressPercent(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $numeric = (int) round((float) $value);
        return max(0, min(100, $numeric));
    }

    private function terminateProcess(int $pid): void
    {
        if ($pid <= 0) {
            return;
        }

        try {
            if (PHP_OS_FAMILY === 'Windows') {
                $process = new Process(['taskkill', '/F', '/T', '/PID', (string) $pid]);
                $process->setTimeout(10);
                $process->run();
                return;
            }

            if (function_exists('posix_kill')) {
                @posix_kill($pid, SIGTERM);
                usleep(500000);
                @posix_kill($pid, SIGKILL);
                return;
            }

            $process = new Process(['kill', '-TERM', (string) $pid]);
            $process->setTimeout(10);
            $process->run();
        } catch (\Throwable) {
            // Best-effort kill only. The run is still marked cancelled so the UI stops treating it as active.
        }
    }

    private function terminateProcessByRunId(string $runId): void
    {
        if (trim($runId) === '') {
            return;
        }

        try {
            $pattern = 'optidx:run-optimization ' . $runId;

            if (PHP_OS_FAMILY === 'Windows') {
                $command = sprintf(
                    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*%s*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }\"",
                    str_replace("'", "''", $pattern)
                );
                $process = Process::fromShellCommandline($command);
                $process->setTimeout(10);
                $process->run();
                return;
            }

            $process = Process::fromShellCommandline(sprintf('pkill -f %s', escapeshellarg($pattern)));
            $process->setTimeout(10);
            $process->run();
        } catch (\Throwable) {
            // Best-effort fallback only. The run is still marked cancelled so the UI stops treating it as active.
        }
    }

    private function containsAny(array $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (in_array($needle, $haystack, true)) {
                return true;
            }
        }

        return false;
    }

    private function skillLevel(mixed $value, mixed $label = null): int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        $source = strtolower(trim((string) ($label ?? $value ?? '')));
        if ($source === '') {
            return 0;
        }

        return match (true) {
            str_contains($source, 'chw'), str_contains($source, 'self') => 1,
            str_contains($source, 'nurse') => 2,
            str_contains($source, 'radiographer'), str_contains($source, 'lab tech'), str_contains($source, 'lab technician') => 3,
            str_contains($source, 'radiologist'), str_contains($source, 'specialist'), str_contains($source, 'bsl-2') => 4,
            str_contains($source, 'bsl-3') => 5,
            default => 3,
        };
    }

    private function numberOrNull(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    private function normalizePrevalence(mixed $value): float
    {
        if (! is_numeric($value)) {
            throw new \InvalidArgumentException('Prevalence must be numeric.');
        }

        $normalized = (float) $value;
        if ($normalized < 0) {
            throw new \InvalidArgumentException('Prevalence must be non-negative.');
        }

        while ($normalized > 1) {
            $normalized /= 100;
        }

        return $normalized;
    }
}
