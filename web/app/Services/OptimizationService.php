<?php

namespace App\Services;

use App\Models\OptimizationRun;

class OptimizationService
{
    public function __construct(
        private readonly PythonEngineBridge $bridge,
    ) {
    }

    public function prepareRunPayload(array $tests, array $constraints = [], array $searchConfig = []): array
    {
        return [
            'tests' => $this->normalizeTests($tests),
            'constraints' => $this->normalizeConstraints($constraints),
            'search_config' => $this->normalizeSearchConfig($searchConfig),
        ];
    }

    public function optimize(array $tests, array $constraints = [], ?float $prevalence = null, array $searchConfig = []): array
    {
        $payload = $this->prepareRunPayload($tests, [
            ...$constraints,
            'prevalence' => $prevalence ?? $constraints['prevalence'] ?? null,
        ], $searchConfig);

        return $this->bridge->optimize($payload);
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
            'prevalence' => (float) $prevalence,
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

    public function normalizeSearchConfig(array $searchConfig): array
    {
        return [
            'max_stages' => max(1, (int) ($searchConfig['max_stages'] ?? 4)),
            'max_tests_per_realized_path' => max(1, (int) ($searchConfig['max_tests_per_realized_path'] ?? $searchConfig['max_invocations_per_path'] ?? 6)),
            'max_parallel_block_size' => max(1, (int) ($searchConfig['max_parallel_block_size'] ?? 3)),
            'max_candidates' => max(1, (int) ($searchConfig['max_candidates'] ?? 5000)),
            'time_limit_seconds' => max(1, (int) ($searchConfig['time_limit_seconds'] ?? 900)),
            'allow_repeated_test' => (bool) ($searchConfig['allow_repeated_test'] ?? true),
            'allow_same_test_in_different_branches' => (bool) ($searchConfig['allow_same_test_in_different_branches'] ?? true),
        ];
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
        ]);
        $run->save();

        return $run->refresh();
    }

    public function recordRunResult(OptimizationRun $run, array $result): OptimizationRun
    {
        $status = $result['status'] ?? 'success';
        $warnings = array_values(array_filter(array_map('strval', $result['warnings'] ?? [])));

        $run->fill([
            'status' => $status,
            'search_exhaustive' => (bool) ($result['search_exhaustive'] ?? false),
            'candidate_count' => (int) ($result['candidate_count'] ?? 0),
            'feasible_count' => (int) ($result['feasible_candidate_count'] ?? 0),
            'warnings' => $warnings,
            'failure_reason' => $result['message'] ?? null,
            'completed_at' => now(),
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
            'failure_reason' => $error->getMessage(),
            'warnings' => array_values(array_filter(array_merge(
                $run->warnings ?? [],
                ['Optimization failed: ' . $error->getMessage()]
            ))),
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
        if (is_string($resolved) && $resolved !== '') {
            return $resolved;
        }

        if (is_string($key) && $key !== '') {
            return $key;
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
}
