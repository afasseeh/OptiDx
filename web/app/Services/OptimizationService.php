<?php

namespace App\Services;

use App\Models\DiagnosticTest;
use Illuminate\Support\Arr;

class OptimizationService
{
    public function __construct(
        private readonly PathwayDefinitionService $definitions,
        private readonly PythonEngineBridge $bridge,
    ) {
    }

    public function optimize(array $tests, array $constraints = [], ?float $prevalence = null): array
    {
        $tests = $this->normalizeTests($tests);
        $candidates = [];

        foreach ($this->buildTemplates($tests) as $template) {
            $validation = $this->definitions->validate($template);
            if (! $validation['valid']) {
                continue;
            }

            $evaluation = $this->bridge->evaluate($template + ['prevalence' => $prevalence]);
            $metrics = $evaluation['metrics'] ?? $evaluation;
            $row = [
                'pathway' => $template,
                'metrics' => $metrics,
                'warnings' => $evaluation['warnings'] ?? [],
                'label' => $template['metadata']['label'] ?? 'Candidate pathway',
            ];

            if (! $this->passesConstraints($row['metrics'], $constraints)) {
                continue;
            }

            $candidates[] = $row;
        }

        usort($candidates, function (array $left, array $right): int {
            return ($left['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX) <=> ($right['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX);
        });

        return [
            'candidate_count' => count($candidates),
            'feasible_count' => count($candidates),
            'ranked_results' => $candidates,
            'pareto_frontier' => $candidates,
        ];
    }

    private function buildTemplates(array $tests): array
    {
        $testIds = array_keys($tests);
        $candidates = [];

        foreach ($testIds as $id) {
            $candidates[] = $this->singleTestTemplate($id, $tests[$id]);
        }

        $count = count($testIds);
        for ($i = 0; $i < $count; $i++) {
            for ($j = $i + 1; $j < $count; $j++) {
                $first = $testIds[$i];
                $second = $testIds[$j];

                $candidates[] = $this->serialConfirmatoryTemplate($first, $second, $tests);
                $candidates[] = $this->parallelOrTemplate($first, $second, $tests);
                $candidates[] = $this->parallelAndTemplate($first, $second, $tests);
            }
        }

        return $candidates;
    }

    private function singleTestTemplate(string $testId, array $test): array
    {
        return [
            'start_node' => 'start',
            'tests' => [$testId => $test],
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$testId], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$testId => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$testId => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Single test'],
        ];
    }

    private function serialConfirmatoryTemplate(string $first, string $second, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$first => 'pos'], 'next_node' => 'confirm'],
                        ['conditions' => [$first => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'confirm' => [
                    'action' => ['test_names' => [$second], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$second => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Serial confirmatory'],
        ];
    }

    private function parallelOrTemplate(string $first, string $second, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first, $second], 'mode' => 'parallel', 'parallel_time' => true],
                    'branches' => [
                        ['conditions' => [$first => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$first => 'neg', $second => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Parallel OR'],
        ];
    }

    private function parallelAndTemplate(string $first, string $second, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first, $second], 'mode' => 'parallel', 'parallel_time' => true],
                    'branches' => [
                        ['conditions' => [$first => 'pos', $second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$first => 'neg'], 'next_node' => 'final_negative'],
                        ['conditions' => [$second => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Parallel AND'],
        ];
    }

    private function passesConstraints(array $metrics, array $constraints): bool
    {
        if (isset($constraints['maximum_total_cost']) && ($metrics['expected_cost_population'] ?? PHP_FLOAT_MAX) > $constraints['maximum_total_cost']) {
            return false;
        }

        if (isset($constraints['minimum_sensitivity']) && ($metrics['sensitivity'] ?? 0) < $constraints['minimum_sensitivity']) {
            return false;
        }

        if (isset($constraints['minimum_specificity']) && ($metrics['specificity'] ?? 0) < $constraints['minimum_specificity']) {
            return false;
        }

        return true;
    }

    private function normalizeTests(array $tests): array
    {
        $normalized = [];
        foreach ($tests as $key => $test) {
            if (! is_array($test)) {
                continue;
            }

            $resolvedKey = $test['id'] ?? (is_string($key) ? $key : $test['name'] ?? null);
            if (! $resolvedKey) {
                continue;
            }

            $normalized[(string) $resolvedKey] = $this->normalizeTestRecord($test);
        }

        return $normalized;
    }

    private function normalizeTestRecord(array $test): array
    {
        $sampleTypes = $test['sample_types'] ?? null;
        if (is_string($sampleTypes)) {
            $sampleTypes = [$sampleTypes];
        }

        if (! is_array($sampleTypes)) {
            $sampleTypes = isset($test['sample']) ? [$test['sample']] : [];
        }

        return [
            ...$test,
            'sensitivity' => (float) ($test['sensitivity'] ?? $test['sens'] ?? 0),
            'specificity' => (float) ($test['specificity'] ?? $test['spec'] ?? 0),
            'turnaround_time' => $this->numberOrNull($test['turnaround_time'] ?? $test['tat'] ?? null),
            'turnaround_time_unit' => $test['turnaround_time_unit'] ?? $test['tatUnit'] ?? null,
            'sample_types' => array_values(array_filter(array_map(
                static fn ($value) => is_string($value) ? trim($value) : (string) $value,
                $sampleTypes
            ), static fn (string $value) => $value !== '')),
            'skill_level' => $this->skillLevel($test['skill_level'] ?? null, $test['skill_label'] ?? $test['skill'] ?? null),
        ];
    }

    private function skillLevel(mixed $value, mixed $label = null): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        $source = strtolower(trim((string) ($label ?? $value ?? '')));
        if ($source === '') {
            return null;
        }

        return match (true) {
            str_contains($source, 'chw'), str_contains($source, 'self') => 1,
            str_contains($source, 'nurse') => 2,
            str_contains($source, 'radiographer'), str_contains($source, 'lab tech'), str_contains($source, 'lab technician') => 3,
            str_contains($source, 'radiologist'), str_contains($source, 'specialist'), str_contains($source, 'cardiology'), str_contains($source, 'gastroenterology'), str_contains($source, 'gi specialist'), str_contains($source, 'bsl-2') => 4,
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
