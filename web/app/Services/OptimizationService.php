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

        foreach ($testIds as $first) {
            foreach ($testIds as $second) {
                if ($first === $second) {
                    continue;
                }

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
        if (! array_is_list($tests)) {
            return $tests;
        }

        $normalized = [];
        foreach ($tests as $test) {
            if (! is_array($test)) {
                continue;
            }

            $key = $test['id'] ?? $test['name'] ?? null;
            if (! $key) {
                continue;
            }

            $normalized[$key] = $test;
        }

        return $normalized;
    }
}
